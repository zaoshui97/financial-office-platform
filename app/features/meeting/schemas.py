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


class BlackboardEventItem(BaseModel):
    """单条黑板变更事件，供重连后增量拉取。"""

    id: int
    agent_role: str
    version: int
    state: dict[str, Any]
    created_at: str | None = None


class BlackboardEventListResponse(BaseModel):
    """事件流响应：前端用 since_event_id 增量同步。"""

    session_id: int
    since_event_id: int
    events: list[BlackboardEventItem] = Field(
        description="id > since_event_id 的事件，升序；空 list 表示已追平",
    )
    has_more: bool = Field(
        description="True=还有未拉取完（命中 limit），前端应继续翻页",
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


# ---------- 会后报告 + 派单 + 转审批 ----------


class MeetingReportResponse(BaseModel):
    """会后结构化报告：汇总 4 Agent 黑板最新 state。"""

    session_id: int
    title: str
    topic: str | None = None
    agenda: str | None = None
    current_phase: str | None = None
    status: str
    moderator: dict[str, Any] = Field(
        default_factory=dict,
        description="主持人最近 state（action/questions/pacing_notes）",
    )
    noter: dict[str, Any] = Field(
        default_factory=dict,
        description="记录员最近 state（key_points/decisions/open_questions）",
    )
    decision: dict[str, Any] = Field(
        default_factory=dict,
        description="决策追踪 state（decisions/risks/consensus_score）",
    )
    dispatcher: dict[str, Any] = Field(
        default_factory=dict,
        description="派单 state（tickets/total_workload_hours）",
    )
    generated_at: str = Field(
        description="报告生成时间（ISO8601）",
    )


class MeetingActionRead(BaseModel):
    """会议工单只读视图。"""

    id: int
    meeting_id: int
    title: str
    description: str | None = None
    owner_user_id: int | None = None
    owner_role: str | None = None
    priority: str
    status: str
    source_decision: str | None = None
    estimate_hours: int | None = None
    deadline: str | None = None
    approval_id: int | None = None
    created_at: datetime
    updated_at: datetime


class DispatchResponse(BaseModel):
    """会后派单响应。"""

    session_id: int
    extracted: int = Field(
        description="从 dispatcher.tickets 抽出的工单数",
    )
    skipped_duplicates: int = Field(
        description="已存在工单被跳过的数量（按 source_decision 去重）",
    )
    actions: list[MeetingActionRead] = Field(
        description="本次新写入的工单列表",
    )


class ActionApprovalDraft(BaseModel):
    """工单转审批草稿响应。"""

    action_id: int
    approval_id: int = Field(
        description="已写入 approval 表的草稿 ID（status=draft）",
    )
    approval_type: str
    content_preview: str = Field(
        description="审批内容预览（前 200 字）",
    )


class ActionApprovalRequest(BaseModel):
    """工单转审批草稿请求（可覆盖字段）。"""

    approval_type: str = Field(
        default="general",
        description="leave / reimburse / seal / general",
    )
    note: str | None = Field(
        default=None, max_length=500,
        description="附加备注",
    )