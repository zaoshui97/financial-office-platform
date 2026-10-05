"""add financial fields to users table

Revision ID: 20261003_008
Revises: 20261003_007
Create Date: 2026-10-05 15:55:00.000000

在 users 表增加金融行业扩展字段：
  - organization_id   所属机构ID（多租户隔离）
  - department        部门
  - position          职位
  - business_line     业务条线
  - compliance_level  合规等级
  - phone             手机号（脱敏存储）
  - last_login_at     最后登录时间
  - last_login_ip     最后登录IP

同时为 organizations 建 FK 引用（不影响历史数据）。
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261003_008"
down_revision: Union[str, None] = "20261003_007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "organization_id",
            sa.BigInteger(),
            nullable=True,
            comment="所属机构ID（多租户隔离）",
        ),
    )
    op.add_column(
        "users",
        sa.Column("department", sa.String(length=100), nullable=True, comment="部门"),
    )
    op.add_column(
        "users",
        sa.Column("position", sa.String(length=100), nullable=True, comment="职位"),
    )
    op.add_column(
        "users",
        sa.Column(
            "business_line", sa.String(length=100), nullable=True, comment="业务条线"
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "compliance_level",
            sa.String(length=20),
            nullable=True,
            comment="合规等级",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "phone", sa.String(length=20), nullable=True, comment="手机号（脱敏存储）"
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "last_login_at",
            sa.String(length=19),
            nullable=True,
            comment="最后登录时间",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "last_login_ip", sa.String(length=45), nullable=True, comment="最后登录IP"
        ),
    )
    op.create_index("idx_users_organization", "users", ["organization_id"])


def downgrade() -> None:
    op.drop_index("idx_users_organization", table_name="users")
    op.drop_column("users", "last_login_ip")
    op.drop_column("users", "last_login_at")
    op.drop_column("users", "phone")
    op.drop_column("users", "compliance_level")
    op.drop_column("users", "business_line")
    op.drop_column("users", "position")
    op.drop_column("users", "department")
    op.drop_column("users", "organization_id")
