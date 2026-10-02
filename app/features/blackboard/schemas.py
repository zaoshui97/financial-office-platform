"""4 Agent Blackboard 请求/响应模型。"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.features.blackboard.models import (
    AgentRole,
    BlackboardSessionStatus,
    MAX_PAYLOAD_BYTES,
)


class BlackboardSessionCreate(BaseModel):
    """创建一次多 Agent 协作 session。"""

    title: str = Field(min_length=1, max_length=200)


class BlackboardSessionRead(BaseModel):
    """session 只读视图。"""

    session_id: str
    title: str
    status: BlackboardSessionStatus
    created_at: datetime
    closed_at: str | None = None


class BlackboardEventCreate(BaseModel):
    """Agent 写入事件。"""

    session_id: str = Field(min_length=8, max_length=64)
    agent_role: AgentRole
    event_type: str = Field(min_length=1, max_length=64)
    payload: dict[str, Any] = Field(default_factory=dict)
    parent_event_id: int | None = Field(default=None, ge=1)

    @field_validator("payload")
    @classmethod
    def payload_within_64kb(cls, value: dict[str, Any]) -> dict[str, Any]:
        """MySQL JSON 字段上限约 64KB，序列化后超限即拒绝。"""
        import json

        serialized = json.dumps(value, ensure_ascii=False, default=str)
        if len(serialized.encode("utf-8")) > MAX_PAYLOAD_BYTES:
            raise ValueError(
                f"payload 序列化后超过 {MAX_PAYLOAD_BYTES} 字节上限"
            )
        return value


class BlackboardEventRead(BaseModel):
    """事件只读视图。"""

    id: int
    session_id: str
    agent_role: AgentRole
    event_type: str
    payload: dict[str, Any]
    parent_event_id: int | None
    created_at: datetime


class BlackboardEventListResponse(BaseModel):
    """事件列表响应。"""

    items: list[BlackboardEventRead]
    total: int
    next_since_id: int | None = Field(
        default=None, description="前端轮询用：上次最后一条 id"
    )


class RoleSummary(BaseModel):
    """单个 Agent 角色汇总。"""

    agent_role: AgentRole
    latest_event_id: int | None
    latest_event_type: str | None
    latest_payload: dict[str, Any] | None
    event_count: int
    error_count: int = Field(description="payload 含 error: true 的事件数")


class BlackboardSessionSummary(BaseModel):
    """session 汇总：4 角色最新事件 + 总错误数。"""

    session_id: str
    title: str
    status: BlackboardSessionStatus
    total_events: int
    total_errors: int
    roles: list[RoleSummary]