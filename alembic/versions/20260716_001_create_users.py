"""创建用户表。

Revision ID: 20260716_001
Revises:
Create Date: 2026-07-16
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260716_001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """创建用户表及唯一索引。"""
    op.create_table(
        "users",
        sa.Column("username", sa.String(length=50), nullable=False, comment="登录用户名"),
        sa.Column("email", sa.String(length=255), nullable=False, comment="电子邮箱"),
        sa.Column("full_name", sa.String(length=100), nullable=True, comment="用户姓名"),
        sa.Column("hashed_password", sa.String(length=255), nullable=False, comment="密码哈希"),
        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default=sa.text("1"),
            nullable=False,
            comment="账号是否启用",
        ),
        sa.Column(
            "is_superuser",
            sa.Boolean(),
            server_default=sa.text("0"),
            nullable=False,
            comment="是否超级管理员",
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
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.create_index("ix_users_email", "users", ["email"], unique=True)


def downgrade() -> None:
    """删除用户表。"""
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_table("users")