"""会议 REST 请求/响应模型。

范围：
  - 会议生命周期（创建/列表/详情/关闭）
  - 黑板快照读 + 触发 Agent 写
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field

from app.features.agent.models import MeetingStatus


# ---------- 会议生命周期 ----------


class MeetingCreate(BaseModel):
    """创建会议请求。"""

    title: str = Field(min_length=1, max_length=200, description="会议标题")
    topic: str | None = Field(default=None, max_length=500, description="会议主题")
    agenda: str | None = Field(default=None, max_length=500, description="初始议题")


class MeetingPhase(StrEnum):
    """会议阶段：moderator 写入黑板后同步回 MeetingSession。"""

    OPEN = "open"
    DISCUSSING = "discussing"
    CLOSING = "closing"
    CLOSED = "closed"


class MeetingRead(BaseModel):
    """会议只读视图。"""

    id: int
    title: str
    host_user_id: int
    status: MeetingStatus
    created_at: datetime
    updated_at: datetime

    # 会议元数据：来源 MeetingSession 表，不再从 moderator 黑板拼
    topic: str | None = None
    agenda: str | None = None
    current_phase: MeetingPhase | None = Field(
        default=None,
        description="主持人最近写入的 phase（open/discussing/closing/closed）",
    )


class MeetingListResponse(BaseModel):
    """会议列表响应。"""

    items: list[MeetingRead]
    total: int


# ---------- 黑板 ----------


class BlackboardSnapshot(BaseModel):
    """单个 Agent 的状态快照。"""

    agent_role: str
    version: int
    state: dict[str, Any]


class BlackboardReadResponse(BaseModel):
    """会议黑板整体快照：4 个 Agent 各一行最新状态。"""

    session_id: int
    states: list[BlackboardSnapshot] = Field(
        description="按 agent_role 字母序排序",
    )


class AgentTriggerRequest(BaseModel):
    """触发指定 Agent 跑一次的请求。"""

    context: dict[str, Any] = Field(
        default_factory=dict,
        description=(
            "传给 Agent 的 context，可包含 topic/agenda/phase/transcript 等。"
            "无需传 session_id/blackboard_snapshot，框架自动注入。"
        ),
    )
    wait: bool = Field(
        default=True,
        description="True=同步等 Agent 跑完返回新 state；False=立即返回 task_id",
    )


class AgentTriggerResponse(BaseModel):
    """触发 Agent 响应。"""

    session_id: int
    agent_role: str
    new_version: int
    state: dict[str, Any] = Field(
        description="Agent 写入黑板的新状态",
    )