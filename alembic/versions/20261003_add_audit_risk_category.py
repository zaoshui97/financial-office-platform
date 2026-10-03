"""add risk_category confidence judge_source to compliance_audit_logs

Revision ID: 20261003
Revises: 20260919
Create Date: 2026-10-03 17:30:00
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20261003"
down_revision = "20260919"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """在 compliance_audit_logs 上加 4 层防御配套字段。"""
    op.add_column(
        "compliance_audit_logs",
        sa.Column(
            "risk_category",
            sa.String(length=32),
            nullable=True,
            comment="风险分类（money_laundering/insider_trading 等）",
        ),
    )
    op.add_column(
        "compliance_audit_logs",
        sa.Column(
            "confidence",
            sa.Float(),
            nullable=True,
            comment="Judge 置信度 0-1",
        ),
    )
    op.add_column(
        "compliance_audit_logs",
        sa.Column(
            "judge_source",
            sa.String(length=16),
            nullable=True,
            comment="判定来源 rule/llm_judge",
        ),
    )
    op.create_index(
        "idx_compliance_audit_category",
        "compliance_audit_logs",
        ["risk_category"],
    )


def downgrade() -> None:
    """回滚：删除新增字段与索引。"""
    op.drop_index("idx_compliance_audit_category", table_name="compliance_audit_logs")
    op.drop_column("compliance_audit_logs", "judge_source")
    op.drop_column("compliance_audit_logs", "confidence")
    op.drop_column("compliance_audit_logs", "risk_category")
