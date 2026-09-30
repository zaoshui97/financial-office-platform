"""聊天会话和消息SQLAlchemy模型。"""

from typing import Any

from sqlalchemy import JSON, BigInteger, ForeignKey, String, Text
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin


class ChatConversation(TimestampMixin, Base):
    """用户的一次连续聊天会话。"""

    __tablename__ = "chat_conversations"

    owner_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="会话所有者ID",
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False, comment="会话标题")


class ChatMessage(TimestampMixin, Base):
    """会话中的用户或助手消息。"""

    __tablename__ = "chat_messages"

    conversation_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("chat_conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="会话ID",
    )
    role: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="消息角色"
    )
    mode: Mapped[str] = mapped_column(
        String(20), nullable=False, default="llm", comment="回答模式"
    )
    content: Mapped[str] = mapped_column(
        Text().with_variant(LONGTEXT, "mysql"),
        nullable=False,
        comment="消息内容",
    )
    citations: Mapped[list[dict[str, Any]] | None] = mapped_column(
        JSON,
        nullable=True,
        comment="RAG引用来源",
    )