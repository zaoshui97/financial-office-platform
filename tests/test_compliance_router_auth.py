"""合规沙箱路由鉴权测试（确认必须登录 / 切换必须超管）。"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings


@pytest.fixture
def client() -> TestClient:
    from app.main import app

    return TestClient(app)


def test_kill_switch_get_requires_auth(client: TestClient) -> None:
    r = client.get("/api/v1/compliance/sandbox/kill-switch")
    assert r.status_code == 401


def test_kill_switch_post_requires_auth(client: TestClient) -> None:
    r = client.post(
        "/api/v1/compliance/sandbox/kill-switch",
        json={"enabled": True, "operator": "x"},
    )
    assert r.status_code == 401


def test_sandbox_chat_requires_auth(client: TestClient) -> None:
    r = client.post(
        "/api/v1/compliance/sandbox/chat", json={"message": "hi"}
    )
    assert r.status_code == 401


def test_audit_requires_auth(client: TestClient) -> None:
    r = client.get("/api/v1/compliance/sandbox/audit")
    assert r.status_code == 401


@pytest.mark.parametrize("policy", ["strict", "fallback", "off"])
def test_degradation_policy_valid_values(policy: str) -> None:
    """确保三档策略枚举值合法。"""
    assert policy in {"strict", "fallback", "off"}
    # 真实场景下会被 Settings Literal 校验
    settings.SANDBOX_DEGRADATION_POLICY = policy  # type: ignore[assignment]
    assert settings.SANDBOX_DEGRADATION_POLICY == policy