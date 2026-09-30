"""创建持久化文档片段表，为后续向量索引保留扩展字段。

Revision ID: 20260914_005
Revises: 20260722_004
Create Date: 2026-09-14
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import mysql

from alembic import op

revision: str = "20260914_005"
down_revision: str | None = "20260722_004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """创建文档片段表。"""
    op.create_table(
        "document_chunks",
        sa.Column("owner_id", sa.BigInteger(), nullable=False, comment="片段所有者ID"),
        sa.Column("knowledge_base_id", sa.BigInteger(), nullable=False, comment="知识库ID"),
        sa.Column("document_id", sa.BigInteger(), nullable=False, comment="文档ID"),
        sa.Column("chunk_index", sa.Integer(), nullable=False, comment="片段序号"),
        sa.Column("chunk_text", mysql.LONGTEXT(), nullable=False, comment="片段正文"),
        sa.Column(
            "page_number",
            sa.Integer(),
            nullable=True,
            comment="单页片段的页码，跨页时为空",
        ),
        sa.Column("metadata", sa.JSON(), nullable=False, comment="解析来源元数据"),
        sa.Column(
            "vector_id", sa.String(length=128), nullable=True, comment="未来向量数据库点位ID"
        ),
        sa.Column(
            "embedding_provider", sa.String(length=50), nullable=True, comment="Embedding提供方"
        ),
        sa.Column(
            "embedding_model", sa.String(length=100), nullable=True, comment="Embedding模型"
        ),
        sa.Column("embedding_dimension", sa.Integer(), nullable=True, comment="Embedding向量维度"),
        sa.Column(
            "embedding_version", sa.String(length=50), nullable=True, comment="Embedding版本"
        ),
        sa.Column("content_hash", sa.String(length=64), nullable=False, comment="片段正文SHA-256"),
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
        sa.ForeignKeyConstraint(
            ["knowledge_base_id"], ["knowledge_bases.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["document_id"], ["knowledge_documents.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "document_id",
            "chunk_index",
            name="uq_document_chunks_document_index",
        ),
    )
    op.create_index("ix_document_chunks_owner_id", "document_chunks", ["owner_id"])
    op.create_index(
        "ix_document_chunks_knowledge_base_id",
        "document_chunks",
        ["knowledge_base_id"],
    )
    op.create_index("ix_document_chunks_document_id", "document_chunks", ["document_id"])
    op.create_index(
        "ix_document_chunks_owner_knowledge_base",
        "document_chunks",
        ["owner_id", "knowledge_base_id"],
    )


def downgrade() -> None:
    """删除文档片段表。"""
    op.drop_index("ix_document_chunks_owner_knowledge_base", table_name="document_chunks")
    op.drop_index("ix_document_chunks_document_id", table_name="document_chunks")
    op.drop_index("ix_document_chunks_knowledge_base_id", table_name="document_chunks")
    op.drop_index("ix_document_chunks_owner_id", table_name="document_chunks")
    op.drop_table("document_chunks")
