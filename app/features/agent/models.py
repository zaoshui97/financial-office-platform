"""会议 Agent 模型：MeetingSession / Blackboard / AgentExecution。"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import JSON, BigInteger, DateTime, ForeignKey, Index, String
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


class AgentExecutionStatus(StrEnum):
    """Agent 执行记录状态。"""

    THINKING = "thinking"
    DONE = "done"
    FAILED = "failed"


class AgentTrigger(StrEnum):
    """Agent 触发来源。"""

    SPEECH_CHUNK = "speech_chunk"
    STATE_UPDATE = "state_update"


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
        String(65535), nullable=False,
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
