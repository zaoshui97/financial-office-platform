"""增加文档解析状态之外的向量索引状态。

Revision ID: 20260914_006
Revises: 20260914_005
Create Date: 2026-09-14
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260914_006"
down_revision: str | None = "20260914_005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """增加索引状态、错误、完成时间和Collection字段。"""
    op.add_column(
        "knowledge_documents",
        sa.Column(
            "index_status",
            sa.String(length=20),
            server_default="pending",
            nullable=False,
            comment="向量索引状态",
        ),
    )
    op.add_column(
        "knowledge_documents",
        sa.Column("index_error", sa.String(length=1000), nullable=True, comment="向量索引失败原因"),
    )
    op.add_column(
        "knowledge_documents",
        sa.Column("indexed_at", sa.DateTime(), nullable=True, comment="向量索引完成时间"),
    )
    op.add_column(
        "knowledge_documents",
        sa.Column(
            "index_collection",
            sa.String(length=255),
            nullable=True,
            comment="向量所在Collection",
        ),
    )


def downgrade() -> None:
    """删除向量索引状态字段。"""
    op.drop_column("knowledge_documents", "index_collection")
    op.drop_column("knowledge_documents", "indexed_at")
    op.drop_column("knowledge_documents", "index_error")
    op.drop_column("knowledge_documents", "index_status")
