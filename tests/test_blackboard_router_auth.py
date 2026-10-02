"""Blackboard 路由鉴权测试。"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app as fastapi_app  # noqa: F401


@pytest.fixture
def client() -> TestClient:
    return TestClient(fastapi_app)


def test_create_session_requires_auth(client: TestClient) -> None:
    r = client.post(
        "/api/v1/blackboard/sessions", json={"title": "x"}
    )
    assert r.status_code == 401


def test_list_sessions_requires_auth(client: TestClient) -> None:
    r = client.get("/api/v1/blackboard/sessions")
    assert r.status_code == 401


def test_write_event_requires_auth(client: TestClient) -> None:
    r = client.post(
        "/api/v1/blackboard/events",
        json={
            "session_id": "0123456789abcdef",
            "agent_role": "researcher",
            "event_type": "fact_found",
            "payload": {"k": "v"},
        },
    )
    assert r.status_code == 401


def test_list_events_requires_auth(client: TestClient) -> None:
    r = client.get(
        "/api/v1/blackboard/events?session_id=0123456789abcdef"
    )
    assert r.status_code == 401


def test_summary_requires_auth(client: TestClient) -> None:
    r = client.get("/api/v1/blackboard/sessions/0123456789abcdef/summary")
    assert r.status_code == 401


def test_close_requires_auth(client: TestClient) -> None:
    r = client.post("/api/v1/blackboard/sessions/0123456789abcdef/close")
    assert r.status_code == 401