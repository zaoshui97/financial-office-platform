"""创建企业知识库RAG数据表。

Revision ID: 20260717_002
Revises: 20260716_001
Create Date: 2026-07-17
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260717_002"
down_revision: str | None = "20260716_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """创建知识库、文档和文档切片表。"""
    op.create_table(
        "knowledge_bases",
        sa.Column("owner_id", sa.BigInteger(), nullable=False, comment="知识库所有者ID"),
        sa.Column("name", sa.String(length=100), nullable=False, comment="知识库名称"),
        sa.Column("description", sa.String(length=500), nullable=True, comment="知识库描述"),
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
    op.create_index("ix_knowledge_bases_owner_id", "knowledge_bases", ["owner_id"])

    op.create_table(
        "knowledge_documents",
        sa.Column("knowledge_base_id", sa.BigInteger(), nullable=False, comment="知识库ID"),
        sa.Column("owner_id", sa.BigInteger(), nullable=False, comment="文档所有者ID"),
        sa.Column(
            "original_filename", sa.String(length=255), nullable=False, comment="原始文件名"
        ),
        sa.Column("stored_path", sa.String(length=500), nullable=False, comment="保存路径"),
        sa.Column("file_type", sa.String(length=20), nullable=False, comment="文件类型"),
        sa.Column("file_size", sa.BigInteger(), nullable=False, comment="文件大小"),
        sa.Column(
            "status",
            sa.String(length=20),
            server_default="processing",
            nullable=False,
            comment="索引状态",
        ),
        sa.Column(
            "chunk_count", sa.Integer(), server_default="0", nullable=False, comment="切片数量"
        ),
        sa.Column(
            "error_message", sa.String(length=1000), nullable=True, comment="索引失败原因"
        ),
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
            ["knowledge_base_id"], ["knowledge_bases.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_knowledge_documents_knowledge_base_id",
        "knowledge_documents",
        ["knowledge_base_id"],
    )
    op.create_index("ix_knowledge_documents_owner_id", "knowledge_documents", ["owner_id"])

    op.create_table(
        "document_chunks",
        sa.Column("document_id", sa.BigInteger(), nullable=False, comment="文档ID"),
        sa.Column("knowledge_base_id", sa.BigInteger(), nullable=False, comment="知识库ID"),
        sa.Column("chunk_index", sa.Integer(), nullable=False, comment="切片序号"),
        sa.Column("content", sa.Text(), nullable=False, comment="切片正文"),
        sa.Column("page_number", sa.Integer(), nullable=True, comment="PDF页码"),
        sa.Column(
            "qdrant_point_id",
            sa.String(length=36),
            nullable=False,
            comment="Qdrant点位ID",
        ),
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


def downgrade() -> None:
    """删除RAG相关数据表。"""
    op.drop_index("ix_document_chunks_qdrant_point_id", table_name="document_chunks")
    op.drop_index("ix_document_chunks_knowledge_base_id", table_name="document_chunks")
    op.drop_index("ix_document_chunks_document_id", table_name="document_chunks")
    op.drop_table("document_chunks")
    op.drop_index("ix_knowledge_documents_owner_id", table_name="knowledge_documents")
    op.drop_index(
        "ix_knowledge_documents_knowledge_base_id", table_name="knowledge_documents"
    )
    op.drop_table("knowledge_documents")
    op.drop_index("ix_knowledge_bases_owner_id", table_name="knowledge_bases")
    op.drop_table("knowledge_bases")