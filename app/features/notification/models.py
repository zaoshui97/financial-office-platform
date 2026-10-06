"""通知推送模块模型。

一张表：notification_records
  - 写入即落库（status=skipped/sent/failed）
  - channel=dingtalk / email / inapp
  - 失败不抛错，记录在 status=failed + error_message
"""

from __future__ import annotations

from enum import StrEnum

from sqlalchemy import (
    BigInteger,
    ForeignKey,
    Index,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin


class NotifyChannel(StrEnum):
    """推送渠道。"""

    DINGTALK = "dingtalk"
    EMAIL = "email"
    INAPP = "inapp"


class NotifyStatus(StrEnum):
    """推送状态。"""

    SENT = "sent"
    SKIPPED = "skipped"  # 未配置渠道，仅落库
    FAILED = "failed"


class NotificationRecord(TimestampMixin, Base):
    """通知记录：每次推送一条。"""

    __tablename__ = "notification_records"
    __table_args__ = (
        Index("idx_notify_user", "user_id"),
        Index("idx_notify_status", "status"),
        Index("idx_notify_biz", "biz_type", "biz_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="接收人 user_id",
    )
    biz_type: Mapped[str] = mapped_column(
        String(32), nullable=False,
        comment="业务类型：approval/meeting/dispatch/general",
    )
    biz_id: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True,
        comment="业务 ID（approval_id / meeting_id）",
    )
    channel: Mapped[str] = mapped_column(
        String(16), nullable=False,
        comment="dingtalk/email/inapp",
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False,
        comment="sent/skipped/failed",
    )
    content: Mapped[str] = mapped_column(
        Text, nullable=False,
        comment="推送内容（≤ 通知字符上限）",
    )
    error_message: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment="失败原因（status=failed 时填）",
    )
    sent_at: Mapped[str | None] = mapped_column(
        String(19), nullable=True,
        comment="实际发送时间（ISO8601）",
    )
