"""add sandbox_audit_log

Revision ID: 20260919
Revises: 20260918
Create Date: 2026-10-03 15:55:00
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260919"
down_revision = "20260918"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """创建 sandbox_audit_log 表（合规沙箱风险检查的精简审计）。"""
    op.create_table(
        "sandbox_audit_log",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False, comment="主键ID"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False, comment="创建时间"),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False, comment="更新时间"),
        sa.Column("user_id", sa.BigInteger(), nullable=False, comment="调用用户 ID"),
        sa.Column("biz_type", sa.String(length=32), nullable=False, comment="业务类型：chat/document/approval"),
        sa.Column("biz_id", sa.String(length=64), nullable=False, comment="业务对象 ID"),
        sa.Column("text_hash", sa.String(length=64), nullable=False, comment="原文 SHA-256 摘要（原文永不落库）"),
        sa.Column("risk_level", sa.String(length=16), nullable=False, comment="最终风险等级：low/medium/high"),
        sa.Column("matched_rules", sa.JSON(), nullable=False, comment="命中规则详情（JSON）"),
        sa.Column("llm_reasoning", sa.String(length=2048), nullable=True, comment="LLM 判定理由"),
        sa.Column("suggestions", sa.String(length=1024), nullable=True, comment="处置建议"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_sandbox_audit_user_created",
        "sandbox_audit_log",
        ["user_id", "created_at"],
    )
    op.create_index(
        "idx_sandbox_audit_biz",
        "sandbox_audit_log",
        ["biz_type", "biz_id"],
    )
    op.create_index(
        "idx_sandbox_audit_risk",
        "sandbox_audit_log",
        ["risk_level"],
    )


def downgrade() -> None:
    """删除 sandbox_audit_log 表。"""
    op.drop_index("idx_sandbox_audit_risk", table_name="sandbox_audit_log")
    op.drop_index("idx_sandbox_audit_biz", table_name="sandbox_audit_log")
    op.drop_index("idx_sandbox_audit_user_created", table_name="sandbox_audit_log")
    op.drop_table("sandbox_audit_log")