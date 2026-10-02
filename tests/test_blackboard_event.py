"""Blackboard payload 64KB 校验 + 角色枚举测试。"""

import pytest

from app.features.blackboard.models import AgentRole, MAX_PAYLOAD_BYTES
from app.features.blackboard.schemas import BlackboardEventCreate


def test_agent_role_enum() -> None:
    """4 个角色都存在。"""
    assert {r.value for r in AgentRole} == {
        "researcher",
        "planner",
        "executor",
        "reviewer",
    }


def test_payload_64kb_limit_rejected() -> None:
    """序列化超 64KB 的 payload 应被拒绝。"""
    big = "x" * (MAX_PAYLOAD_BYTES + 10)
    with pytest.raises(Exception):
        BlackboardEventCreate(
            session_id="0123456789abcdef",
            agent_role="researcher",
            event_type="fact_found",
            payload={"text": big},
        )


def test_payload_within_64kb_accepted() -> None:
    """刚好 64KB 附近应被接受。"""
    payload = {"text": "x" * (MAX_PAYLOAD_BYTES - 100)}
    event = BlackboardEventCreate(
        session_id="0123456789abcdef",
        agent_role="planner",
        event_type="subtask_created",
        payload=payload,
    )
    assert event.payload == payload


def test_payload_nested_dict_validated() -> None:
    """嵌套 dict 序列化后也按 64KB 校验。"""
    payload = {"outer": {"inner": "x" * (MAX_PAYLOAD_BYTES - 50)}}
    event = BlackboardEventCreate(
        session_id="0123456789abcdef",
        agent_role="executor",
        event_type="action_done",
        payload=payload,
    )
    assert "outer" in event.payload