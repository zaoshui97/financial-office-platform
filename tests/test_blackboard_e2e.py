"""Blackboard 端到端业务测试（SQLite in-memory）。

覆盖：创建 session → 4 角色写事件 → 列表 + 汇总 → 关闭 session。
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.features.auth.service import create_user
from app.features.auth.schemas import UserCreate
from app.main import app


@pytest.fixture
def client_with_user() -> TestClient:
    """构造独立的内存 SQLite + 已登录 token。"""
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=test_engine)
    testing_session = sessionmaker(
        bind=test_engine, class_=Session, autoflush=False, expire_on_commit=False
    )

    def override_get_db() -> Session:
        s = testing_session()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = override_get_db
    with testing_session() as s:
        user = create_user(
            s,
            UserCreate(
                username="bbuser",
                password="strongpass123",
                email="bbuser@test.com",
            ),
        )
        user_id = user.id

    client = TestClient(app)
    login = client.post(
        "/api/v1/auth/login",
        data={"username": "bbuser", "password": "strongpass123"},
    )
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"

    yield client

    app.dependency_overrides.clear()


def test_full_blackboard_flow(client_with_user: TestClient) -> None:
    """完整 4 Agent 协作闭环。"""
    # 1. 创建 session
    r = client_with_user.post(
        "/api/v1/blackboard/sessions", json={"title": "审批自动化"}
    )
    assert r.status_code == 201, r.text
    session_id = r.json()["session_id"]
    assert len(session_id) == 32

    # 2. 4 角色各写一条
    events = [
        ("planner", "task_started", {"goal": "审批一笔报销"}),
        ("researcher", "fact_found", {"source": "rag", "doc_id": 42}),
        ("executor", "action_done", {"action": "submit", "ok": True}),
        ("reviewer", "approval", {"verdict": "pass"}),
    ]
    for role, etype, payload in events:
        r = client_with_user.post(
            "/api/v1/blackboard/events",
            json={
                "session_id": session_id,
                "agent_role": role,
                "event_type": etype,
                "payload": payload,
            },
        )
        assert r.status_code == 201, r.text

    # 3. 列表
    r = client_with_user.get(
        f"/api/v1/blackboard/events?session_id={session_id}"
    )
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 4
    assert len(body["items"]) == 4
    assert body["next_since_id"] == body["items"][-1]["id"]

    # 4. 汇总
    r = client_with_user.get(
        f"/api/v1/blackboard/sessions/{session_id}/summary"
    )
    assert r.status_code == 200
    summary = r.json()
    assert summary["total_events"] == 4
    assert summary["total_errors"] == 0
    assert len(summary["roles"]) == 4
    role_map = {r_["agent_role"]: r_ for r_ in summary["roles"]}
    assert role_map["researcher"]["latest_event_type"] == "fact_found"
    assert role_map["planner"]["event_count"] == 1

    # 5. 关闭
    r = client_with_user.post(
        f"/api/v1/blackboard/sessions/{session_id}/close"
    )
    assert r.status_code == 200
    assert r.json()["status"] == "closed"

    # 6. 关闭后再写应失败
    r = client_with_user.post(
        "/api/v1/blackboard/events",
        json={
            "session_id": session_id,
            "agent_role": "executor",
            "event_type": "late_write",
            "payload": {},
        },
    )
    assert r.status_code == 409


def test_cross_user_isolation(client_with_user: TestClient) -> None:
    """用户 B 不能用用户 A 的 session_id。"""
    # 用户 A 创建 session
    r = client_with_user.post(
        "/api/v1/blackboard/sessions", json={"title": "private"}
    )
    a_session_id = r.json()["session_id"]

    # 通过 FastAPI 依赖里同样的 session 创建用户 B，再登录
    # 复用 client_with_user 的 _testing_session 不能从外部访问，
    # 这里直接走 HTTP 接口注册 + 登录
    b_client = TestClient(app)
    r = b_client.post(
        "/api/v1/auth/register",
        json={
            "username": "bbuser2",
            "password": "strongpass456",
            "email": "bbuser2@test.com",
        },
    )
    # 已存在则忽略 409
    assert r.status_code in (201, 409), r.text

    r = b_client.post(
        "/api/v1/auth/login",
        data={"username": "bbuser2", "password": "strongpass456"},
    )
    assert r.status_code == 200, r.text
    b_client.headers["Authorization"] = f"Bearer {r.json()['access_token']}"

    # B 写入 A 的 session 应 404
    r = b_client.post(
        "/api/v1/blackboard/events",
        json={
            "session_id": a_session_id,
            "agent_role": "researcher",
            "event_type": "hijack",
            "payload": {},
        },
    )
    assert r.status_code == 404