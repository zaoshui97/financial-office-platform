"""IM 通讯录 + 一对一消息模型。

只做一对一极简消息，不做群聊 / 不做已读回执。
contact 不单独建表——直接复用 users 表（username/full_name/department/position/email）。
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin


class DirectMessage(TimestampMixin, Base):
    """一对一消息表（chat_message_v2）。"""

    __tablename__ = "im_direct_messages"
    __table_args__ = (
        Index("idx_im_pair_created", "from_user_id", "to_user_id", "created_at"),
        Index("idx_im_to_created", "to_user_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    from_user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="发送人 user_id",
    )
    to_user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="接收人 user_id",
    )
    content: Mapped[str] = mapped_column(
        Text().with_variant(LONGTEXT, "mysql"),
        nullable=False,
        comment="消息内容（≤64KB）",
    )
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True,
        comment="已读时间（不实现已读回执，留字段）",
    )
