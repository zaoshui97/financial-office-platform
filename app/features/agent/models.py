"""会议 Agent 模型：MeetingSession / Blackboard / AgentExecution。"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import JSON, BigInteger, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin


class MeetingStatus(StrEnum):
    """会议会话生命周期。"""

    PREPARING = "preparing"
    ACTIVE = "active"
    CLOSED = "closed"


class Blackboard(Base):
    """共享黑板：会议中多 Agent 共享状态。

    每个 Agent（moderator / noter / decision / dispatcher）在自己的 state_json
    中写入自己的状态；version 字段实现乐观锁防止并发写冲突。
    """

    __tablename__ = "meeting_blackboard"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("meeting_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="关联的会议会话 ID",
    )
    agent_role: Mapped[str] = mapped_column(
        String(32), nullable=False,
        comment="moderator / noter / decision / dispatcher",
    )
    state_json: Mapped[dict[str, Any]] = mapped_column(
        JSON, nullable=False, default=dict,
        comment="该 Agent 写入的状态快照（≤64KB）",
    )
    version: Mapped[int] = mapped_column(
        BigInteger, nullable=False, default=0,
        comment="乐观锁版本号，每次更新 +1",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default="CURRENT_TIMESTAMP(6)",
        onupdate="CURRENT_TIMESTAMP(6)",
        comment="最后更新时间",
    )

    __table_args__ = (
        Index("idx_blackboard_session_role", "session_id", "agent_role", unique=True),
    )


class BlackboardEvent(Base):
    """黑板变更事件：每次 write 落一条，供前端重连后增量拉取。

    设计：
      - 单 meeting 内按 (session_id, agent_role, version) 唯一
      - 自增 ID 仅用于排序/分页游标
      - 写时机：BlackboardService.write 成功后 1 次 INSERT（同步，与 cache 同步）
      - 读时机：前端断线重连后 → GET /blackboard/events?since_version=N
    """

    __tablename__ = "meeting_blackboard_events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("meeting_sessions.id", ondelete="CASCADE"),
        nullable=False,
        comment="关联的会议会话 ID",
    )
    agent_role: Mapped[str] = mapped_column(
        String(32), nullable=False,
        comment="moderator / noter / decision / dispatcher",
    )
    version: Mapped[int] = mapped_column(
        BigInteger, nullable=False,
        comment="写黑板后自增的 version 号",
    )
    state: Mapped[dict[str, Any]] = mapped_column(
        JSON, nullable=False,
        comment="写入的 state 快照（与 meeting_blackboard.state_json 同步）",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False,
        server_default="CURRENT_TIMESTAMP",
        comment="事件落库时间",
    )

    __table_args__ = (
        Index(
            "idx_event_session_version",
            "session_id", "version",
        ),
        Index(
            "uq_event_session_role_version",
            "session_id", "agent_role", "version",
            unique=True,
        ),
    )


class MeetingSession(TimestampMixin, Base):
    """会议会话：主持人的一次实时会议上下文。"""

    __tablename__ = "meeting_sessions"

    title: Mapped[str] = mapped_column(
        String(200), nullable=False, comment="会议标题",
    )
    host_user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="主持人用户 ID",
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False,
        default=MeetingStatus.PREPARING.value,
        comment="preparing / active / closed",
    )
    # ---------- 会议元数据（不再混入 moderator 黑板） ----------
    topic: Mapped[str | None] = mapped_column(
        String(500), nullable=True,
        comment="会议主题",
    )
    agenda: Mapped[str | None] = mapped_column(
        String(500), nullable=True,
        comment="初始议题",
    )
    current_phase: Mapped[str | None] = mapped_column(
        String(32), nullable=True,
        comment="主持人最近写入的 phase（open/discussing/closing）",
    )


class AgentExecutionStatus(StrEnum):
    """Agent 执行记录状态。"""

    THINKING = "thinking"
    DONE = "done"
    FAILED = "failed"


class AgentTrigger(StrEnum):
    """Agent 触发来源。"""

    SPEECH_CHUNK = "speech_chunk"
    STATE_UPDATE = "state_update"


class ActionStatus(StrEnum):
    """会议派单工单状态。"""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    DONE = "done"


class MeetingAction(TimestampMixin, Base):
    """会议派单：从 dispatcher 输出的工单落到表里，可一键转审批。"""

    __tablename__ = "meeting_actions"
    __table_args__ = (
        Index("idx_action_meeting", "meeting_id"),
        Index("idx_action_status", "status"),
        Index("idx_action_owner", "owner_user_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    meeting_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("meeting_sessions.id", ondelete="CASCADE"),
        nullable=False,
        comment="关联的会议 ID",
    )
    title: Mapped[str] = mapped_column(
        String(200), nullable=False, comment="工单标题",
    )
    description: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="工单详细描述",
    )
    owner_user_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="工单负责人 user_id（owner=角色时为 NULL）",
    )
    owner_role: Mapped[str | None] = mapped_column(
        String(50), nullable=True,
        comment="owner 角色（风控/合规/业务/IT 等）",
    )
    priority: Mapped[str] = mapped_column(
        String(8), nullable=False, default="P2",
        comment="P0/P1/P2/P3",
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=ActionStatus.PENDING.value,
        comment="pending/approved/rejected/done",
    )
    source_decision: Mapped[str | None] = mapped_column(
        String(500), nullable=True,
        comment="对应的决策项原文（来自 dispatcher Agent）",
    )
    estimate_hours: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, comment="预估工时",
    )
    deadline: Mapped[str | None] = mapped_column(
        String(19), nullable=True,
        comment="截止时间（ISO8601 字符串）",
    )
    approval_id: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True,
        comment="转审批后写入的 approval.id（草稿态为 NULL）",
    )


class AgentExecution(TimestampMixin, Base):
    """Agent 执行记录：每次语音片段或状态更新触发一次 Agent 调用快照。"""

    __tablename__ = "agent_executions"

    session_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("meeting_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="关联的会议会话 ID",
    )
    agent_role: Mapped[str] = mapped_column(
        String(32), nullable=False,
        comment="moderator / noter / decision / dispatcher",
    )
    trigger: Mapped[str] = mapped_column(
        String(32), nullable=False,
        comment="speech_chunk / state_update",
    )
    input_snapshot: Mapped[dict[str, Any]] = mapped_column(
        JSON, nullable=False,
        comment="触发时的输入快照（如语音文本 / 状态 diff）",
    )
    output: Mapped[str] = mapped_column(
        Text, nullable=False,
        comment="Agent 输出内容（纯文本，最大 64KB）",
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False,
        default=AgentExecutionStatus.THINKING.value,
        comment="thinking / done / failed",
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True,
        comment="执行结束时间（thinking 阶段为 null）",
    )

    __table_args__ = (
        Index("idx_execution_session_role", "session_id", "agent_role"),
        Index("idx_execution_status", "status"),
    )


# ============================================================================
# 多 Agent 协作域（亮点一：4 Agent 混合触发链 + 通用 Agent 配置）
# ============================================================================

from enum import StrEnum
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin


# ---------- 枚举定义 ----------

class AgentType(StrEnum):
    """Agent 类型。"""
    MEETING = "meeting"     # 会议 Agent
    CHAT = "chat"         # 对话 Agent
    WORKFLOW = "workflow"  # 工作流 Agent


class TaskType(StrEnum):
    """任务类型。"""
    RETRIEVAL = "retrieval"   # 检索
    ANALYSIS = "analysis"     # 分析
    GENERATION = "generation" # 生成
    REVIEW = "review"         # 审核


class TaskStatus(StrEnum):
    """任务状态。"""
    PENDING = "pending"    # 待处理
    RUNNING = "running"   # 运行中
    SUCCESS = "success"  # 成功
    FAILED = "failed"    # 失败


class CollaborationStatus(StrEnum):
    """协作状态。"""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"


class Scenario(StrEnum):
    """协作场景。"""
    MEETING = "meeting"
    CHAT = "chat"
    WORKFLOW = "workflow"


# ---------- 表定义 ----------

class AgentConfig(TimestampMixin, Base):
    """Agent 配置表：定义每个 Agent 的系统提示词、模型和工具。"""

    __tablename__ = "agent_configs"
    __table_args__ = (
        Index("idx_config_code", "agent_code", unique=True),
        Index("idx_config_type", "agent_type"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Agent 标识
    agent_code: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False,
        comment="Agent 编码（唯一）",
    )
    agent_name: Mapped[str] = mapped_column(
        String(100), nullable=False,
        comment="Agent 显示名称",
    )
    agent_type: Mapped[str] = mapped_column(
        String(50),
        default=AgentType.CHAT.value,
        comment="Agent 类型",
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        comment="Agent 功能描述",
    )

    # 核心配置
    system_prompt: Mapped[str | None] = mapped_column(
        Text().with_variant(LONGTEXT, "mysql"),
        comment="系统提示词（BaseAgent 通用模板）",
    )
    model_name: Mapped[str | None] = mapped_column(
        String(50),
        comment="使用的模型名",
    )
    tools: Mapped[list[str] | None] = mapped_column(
        JSON,
        comment="可用工具列表 [tool_code1, tool_code2]",
    )
    capabilities: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        comment="能力定义 {input_types: [], output_types: [], constraints: {}}",
    )

    # 生命周期
    is_active: Mapped[bool] = mapped_column(
        default=True,
        comment="是否启用",
    )
    version: Mapped[int] = mapped_column(
        default=1,
        comment="配置版本号",
    )


class AgentTask(TimestampMixin, Base):
    """Agent 任务表：支持任务分解（父子关系）。"""

    __tablename__ = "agent_tasks"
    __table_args__ = (
        Index("idx_task_session", "session_id"),
        Index("idx_task_agent", "agent_id"),
        Index("idx_task_status", "status"),
        Index("idx_task_parent", "parent_task_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # 任务标识
    task_no: Mapped[str] = mapped_column(
        String(50), unique=True,
        comment="任务编号",
    )
    session_id: Mapped[str | None] = mapped_column(
        String(64),
        comment="关联会话ID",
    )

    # 任务分解
    parent_task_id: Mapped[int | None] = mapped_column(
        BigInteger,
        comment="父任务ID（支持任务树分解）",
    )
    agent_id: Mapped[int | None] = mapped_column(
        BigInteger,
        comment="Agent 配置ID",
    )

    # 任务内容
    task_type: Mapped[str] = mapped_column(
        String(50),
        default=TaskType.ANALYSIS.value,
        comment="任务类型",
    )
    input_data: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        comment="输入数据",
    )
    output_data: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        comment="输出数据",
    )

    # 执行状态
    status: Mapped[str] = mapped_column(
        String(20),
        default=TaskStatus.PENDING.value,
        comment="任务状态",
    )
    started_at: Mapped[str | None] = mapped_column(
        String(19),
        comment="开始时间",
    )
    finished_at: Mapped[str | None] = mapped_column(
        String(19),
        comment="结束时间",
    )
    duration_ms: Mapped[int | None] = mapped_column(
        Integer,
        comment="执行耗时（毫秒）",
    )
    error_message: Mapped[str | None] = mapped_column(
        Text,
        comment="错误信息",
    )
    retry_count: Mapped[int] = mapped_column(
        default=0,
        comment="重试次数",
    )


class AgentCollaboration(TimestampMixin, Base):
    """Agent 协作链路表：记录多 Agent 间的消息流转和协作结果。"""

    __tablename__ = "agent_collaborations"
    __table_args__ = (
        Index("idx_collab_scenario", "scenario", "scenario_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # 协作标识
    collaboration_no: Mapped[str] = mapped_column(
        String(50), unique=True,
        comment="协作编号",
    )

    # 协作上下文
    scenario: Mapped[str] = mapped_column(
        String(50),
        default=Scenario.MEETING.value,
        comment="协作场景",
    )
    scenario_id: Mapped[int | None] = mapped_column(
        BigInteger,
        comment="场景ID（如会议ID）",
    )

    # 协作内容
    participants: Mapped[list[dict[str, Any]] | None] = mapped_column(
        JSON,
        comment="参与的 Agent 列表 [{agent_code, agent_name, order}]",
    )
    message_flow: Mapped[list[dict[str, Any]] | None] = mapped_column(
        JSON,
        comment="Agent 间消息流 [{from_agent, to_agent, message, timestamp}]",
    )
    collaboration_result: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        comment="协作结果 {status, output, duration_ms}",
    )

    # 时间
    started_at: Mapped[str | None] = mapped_column(
        String(19),
        comment="开始时间",
    )
    finished_at: Mapped[str | None] = mapped_column(
        String(19),
        comment="结束时间",
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default=CollaborationStatus.PENDING.value,
        comment="协作状态",
    )
