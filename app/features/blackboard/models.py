"""4 Agent 共享黑板模型。

4 个经典 Agent：researcher / planner / executor / reviewer。
每条事件属于一次协作 session（session_id），由用户手动开/关。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from sqlalchemy import JSON, BigInteger, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin

# Payload 最大 64 KB（MySQL JSON 字段上限，序列化后字节数估算）。
MAX_PAYLOAD_BYTES = 64 * 1024


class AgentRole(StrEnum):
    """4 个经典 Agent 角色。"""

    RESEARCHER = "researcher"
    PLANNER = "planner"
    EXECUTOR = "executor"
    REVIEWER = "reviewer"


class BlackboardSessionStatus(StrEnum):
    """协作 session 生命周期状态。"""

    OPEN = "open"
    CLOSED = "closed"


class BlackboardSession(TimestampMixin, Base):
    """一次多 Agent 协作会话。"""

    __tablename__ = "blackboard_sessions"

    owner_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="session 所有者",
    )
    session_id: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, index=True,
        comment="对外暴露的 session ID（UUID）",
    )
    title: Mapped[str] = mapped_column(
        String(200), nullable=False, comment="session 标题"
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=BlackboardSessionStatus.OPEN.value,
        comment="open / closed",
    )
    closed_at: Mapped[Any | None] = mapped_column(
        String(32), nullable=True,
        comment="关闭时间（ISO8601 字符串，简单起见）",
    )


class BlackboardEvent(TimestampMixin, Base):
    """黑板上的事实 / 任务 / 结果 / 审阅事件。"""

    __tablename__ = "blackboard_events"

    owner_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="事件归属 user_id（防越权）",
    )
    session_id: Mapped[str] = mapped_column(
        String(64), nullable=False, index=True,
        comment="关联的 session_id",
    )
    agent_role: Mapped[str] = mapped_column(
        String(32), nullable=False,
        comment="researcher / planner / executor / reviewer",
    )
    event_type: Mapped[str] = mapped_column(
        String(64), nullable=False,
        comment="agent 自定义事件类型",
    )
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSON, nullable=False, comment="事件负载（≤64KB）",
    )
    parent_event_id: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True,
        comment="父事件 ID（事件链，可选）",
    )

    __table_args__ = (
        Index("idx_blackboard_session_created", "session_id", "created_at"),
        Index("idx_blackboard_role_type", "agent_role", "event_type"),
        Index("idx_blackboard_owner_session", "owner_id", "session_id"),
    )