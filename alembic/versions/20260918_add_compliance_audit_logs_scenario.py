"""add compliance_audit_logs.scenario

Revision ID: 20260918
Revises: 20260917_007
Create Date: 2026-10-02 23:52:34
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260918"
down_revision = "20260917_007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "compliance_audit_logs",
        sa.Column(
            "scenario",
            sa.JSON(),
            nullable=True,
            comment=(
                "调用场景元数据：mode(rule_only/llm_only/combined)、"
                "biz_type、biz_id、rule_risk_level、llm_risk_level 等"
            ),
        ),
    )


def downgrade() -> None:
    op.drop_column("compliance_audit_logs", "scenario")
