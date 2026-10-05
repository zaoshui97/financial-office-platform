"""create organization and permission domain tables

Revision ID: 20261003_007
Revises: 20261003_006
Create Date: 2026-10-05 15:50:00.000000

创建以下域的表：
  机构域（4 张）：
    - organizations   机构/租户表（多租户隔离根表）
    - departments     部门表
    - business_domains 业务领域表
    - customer_types   客户类型表
  权限管控域（4 张）：
    - roles           角色表
    - permissions     权限表
    - role_permissions 角色-权限关联
    - user_roles      用户-角色-部门关联
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261003_007"
down_revision: Union[str, None] = "20261003_006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─── organizations ─────────────────────────────────────────────────────────
    op.create_table(
        "organizations",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False, comment="机构名称"),
        sa.Column(
            "org_type", sa.String(length=20), nullable=True, comment="机构类型"
        ),
        sa.Column(
            "credit_code", sa.String(length=50), nullable=True, comment="统一社会信用代码"
        ),
        sa.Column(
            "license_no", sa.String(length=100), nullable=True, comment="金融许可证号"
        ),
        sa.Column(
            "industry", sa.String(length=50), nullable=True, comment="行业"
        ),
        sa.Column(
            "contact_person", sa.String(length=100), nullable=True, comment="联系人"
        ),
        sa.Column(
            "contact_phone", sa.String(length=20), nullable=True, comment="联系电话"
        ),
        sa.Column(
            "contact_email", sa.String(length=255), nullable=True, comment="联系邮箱"
        ),
        sa.Column("address", sa.String(length=500), nullable=True, comment="注册地址"),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=True,
            server_default="active",
            comment="机构状态",
        ),
        sa.Column("config", sa.Text(), nullable=True, comment="机构级配置 JSON"),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("credit_code"),
    )
    op.create_index("idx_org_code", "organizations", ["credit_code"])

    # ─── departments ───────────────────────────────────────────────────────────
    op.create_table(
        "departments",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column(
            "organization_id", sa.BigInteger(), nullable=False, comment="机构ID"
        ),
        sa.Column("name", sa.String(length=100), nullable=False, comment="部门名称"),
        sa.Column("parent_id", sa.BigInteger(), nullable=True, comment="父部门ID"),
        sa.Column(
            "manager_id", sa.BigInteger(), nullable=True, comment="部门负责人用户ID"
        ),
        sa.Column("description", sa.Text(), nullable=True, comment="部门描述"),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_dept_org", "departments", ["organization_id"])

    # ─── business_domains ──────────────────────────────────────────────────────
    op.create_table(
        "business_domains",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False, comment="业务领域编码"),
        sa.Column(
            "name", sa.String(length=100), nullable=False, comment="业务领域名称"
        ),
        sa.Column(
            "description", sa.Text(), nullable=True, comment="业务领域描述"
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default="1",
            comment="是否启用",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )

    # ─── customer_types ────────────────────────────────────────────────────────
    op.create_table(
        "customer_types",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column(
            "name", sa.String(length=100), nullable=False, comment="客户类型名称"
        ),
        sa.Column(
            "code", sa.String(length=50), nullable=False, comment="客户类型编码"
        ),
        sa.Column(
            "risk_preference", sa.String(length=50), nullable=True, comment="风险偏好"
        ),
        sa.Column(
            "description", sa.Text(), nullable=True, comment="类型描述"
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default="1",
            comment="是否启用",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )

    # ─── roles ────────────────────────────────────────────────────────────────
    op.create_table(
        "roles",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("role_code", sa.String(length=50), nullable=False, comment="角色编码"),
        sa.Column(
            "role_name", sa.String(length=100), nullable=False, comment="角色名称"
        ),
        sa.Column(
            "description", sa.Text(), nullable=True, comment="角色描述"
        ),
        sa.Column(
            "is_system",
            sa.Boolean(),
            nullable=False,
            server_default="0",
            comment="是否系统内置",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("role_code"),
    )

    # ─── permissions ──────────────────────────────────────────────────────────
    op.create_table(
        "permissions",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column(
            "permission_code",
            sa.String(length=100),
            nullable=False,
            comment="权限编码",
        ),
        sa.Column(
            "permission_name",
            sa.String(length=200),
            nullable=False,
            comment="权限名称",
        ),
        sa.Column(
            "resource_type", sa.String(length=50), nullable=True, comment="资源类型"
        ),
        sa.Column("action", sa.String(length=50), nullable=True, comment="操作类型"),
        sa.Column(
            "description", sa.Text(), nullable=True, comment="权限描述"
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("permission_code"),
    )
    op.create_index("idx_permission_code", "permissions", ["permission_code"])

    # ─── role_permissions ──────────────────────────────────────────────────────
    op.create_table(
        "role_permissions",
        sa.Column(
            "role_id", sa.BigInteger(), primary_key=True, comment="角色ID"
        ),
        sa.Column(
            "permission_id", sa.BigInteger(), primary_key=True, comment="权限ID"
        ),
    )

    # ─── user_roles ────────────────────────────────────────────────────────────
    op.create_table(
        "user_roles",
        sa.Column(
            "user_id", sa.BigInteger(), primary_key=True, comment="用户ID"
        ),
        sa.Column(
            "role_id", sa.BigInteger(), primary_key=True, comment="角色ID"
        ),
        sa.Column(
            "department_id", sa.BigInteger(), nullable=True, primary_key=True, comment="部门ID"
        ),
    )
    op.create_index("idx_user_role_user", "user_roles", ["user_id"])
    op.create_index("idx_user_role_role", "user_roles", ["role_id"])


def downgrade() -> None:
    op.drop_table("user_roles")
    op.drop_table("role_permissions")
    op.drop_table("permissions")
    op.drop_table("roles")
    op.drop_table("customer_types")
    op.drop_table("business_domains")
    op.drop_table("departments")
    op.drop_table("organizations")
