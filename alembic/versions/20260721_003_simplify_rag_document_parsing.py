"""裁剪RAG为文档解析入库阶段。

Revision ID: 20260721_003
Revises: 20260717_002
Create Date: 2026-07-21
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import mysql

from alembic import op

revision: str = "20260721_003"
down_revision: str | None = "20260717_002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """删除切片表，并为文档增加解析全文字段。"""
    # 删除表时数据库会自动删除其索引，可兼容旧环境缺失部分索引的情况。
    op.drop_table("document_chunks")

    op.add_column(
        "knowledge_documents",
        sa.Column("parsed_text", mysql.LONGTEXT(), nullable=True, comment="解析后的全文"),
    )
    op.add_column(
        "knowledge_documents",
        sa.Column("page_count", sa.Integer(), nullable=True, comment="PDF页数"),
    )
    op.add_column(
        "knowledge_documents",
        sa.Column(
            "parsed_char_count",
            sa.Integer(),
            server_default="0",
            nullable=False,
            comment="解析文本字符数",
        ),
    )
    op.drop_column("knowledge_documents", "chunk_count")


def downgrade() -> None:
    """恢复原切片表结构。"""
    op.add_column(
        "knowledge_documents",
        sa.Column("chunk_count", sa.Integer(), server_default="0", nullable=False),
    )
    op.create_table(
        "document_chunks",
        sa.Column("document_id", sa.BigInteger(), nullable=False),
        sa.Column("knowledge_base_id", sa.BigInteger(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=True),
        sa.Column("qdrant_point_id", sa.String(length=36), nullable=False),
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["document_id"], ["knowledge_documents.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["knowledge_base_id"], ["knowledge_bases.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_document_chunks_document_id", "document_chunks", ["document_id"])
    op.create_index(
        "ix_document_chunks_knowledge_base_id", "document_chunks", ["knowledge_base_id"]
    )
    op.create_index(
        "ix_document_chunks_qdrant_point_id",
        "document_chunks",
        ["qdrant_point_id"],
        unique=True,
    )
    op.drop_column("knowledge_documents", "parsed_char_count")
    op.drop_column("knowledge_documents", "page_count")
    op.drop_column("knowledge_documents", "parsed_text")
