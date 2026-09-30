"""创建智能聊天会话和消息表。

Revision ID: 20260722_004
Revises: 20260721_003
Create Date: 2026-07-22
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import mysql

from alembic import op

revision: str = "20260722_004"
down_revision: str | None = "20260721_003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """创建聊天会话和聊天消息表。"""
    op.create_table(
        "chat_conversations",
        sa.Column("owner_id", sa.BigInteger(), nullable=False, comment="会话所有者ID"),
        sa.Column("title", sa.String(length=200), nullable=False, comment="会话标题"),
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False, comment="主键ID"),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
            comment="创建时间",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
            comment="更新时间",
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_chat_conversations_owner_id", "chat_conversations", ["owner_id"])

    op.create_table(
        "chat_messages",
        sa.Column("conversation_id", sa.BigInteger(), nullable=False, comment="会话ID"),
        sa.Column("role", sa.String(length=20), nullable=False, comment="消息角色"),
        sa.Column(
            "mode",
            sa.String(length=20),
            server_default="llm",
            nullable=False,
            comment="回答模式",
        ),
        sa.Column("content", mysql.LONGTEXT(), nullable=False, comment="消息内容"),
        sa.Column("citations", sa.JSON(), nullable=True, comment="RAG引用来源"),
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False, comment="主键ID"),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
            comment="创建时间",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
            comment="更新时间",
        ),
        sa.ForeignKeyConstraint(
            ["conversation_id"], ["chat_conversations.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_chat_messages_conversation_id",
        "chat_messages",
        ["conversation_id"],
    )


def downgrade() -> None:
    """删除聊天消息和会话表。"""
    op.drop_index("ix_chat_messages_conversation_id", table_name="chat_messages")
    op.drop_table("chat_messages")
    op.drop_index("ix_chat_conversations_owner_id", table_name="chat_conversations")
    op.drop_table("chat_conversations")