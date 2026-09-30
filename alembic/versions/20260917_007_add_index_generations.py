"""增加文档索引版本隔离字段。

Revision ID: 20260917_007
Revises: 20260914_006
Create Date: 2026-09-17
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260917_007"
down_revision: str | None = "20260914_006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """增加当前已发布和正在构建的索引版本字段。"""
    op.add_column(
        "knowledge_documents",
        sa.Column(
            "active_index_generation",
            sa.String(length=36),
            nullable=True,
            comment="当前已发布的索引版本",
        ),
    )
    op.add_column(
        "knowledge_documents",
        sa.Column(
            "building_index_generation",
            sa.String(length=36),
            nullable=True,
            comment="正在构建的索引版本",
        ),
    )


def downgrade() -> None:
    """删除索引版本字段。"""
    op.drop_column("knowledge_documents", "building_index_generation")
    op.drop_column("knowledge_documents", "active_index_generation")
