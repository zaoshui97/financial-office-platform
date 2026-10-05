"""create decision intelligence domain tables

Revision ID: 20261003_005
Revises: 20261003_004
Create Date: 2026-10-05 15:40:00.000000

创建决策智能域的 6 张表（对应亮点三）：
  - regulations              法规主表
  - regulation_versions      法规版本表
  - regulation_diff_reports  法规差异对比报告
  - industry_news           行业资讯表
  - business_impact         业务影响评估表
  - decision_playbacks      决策回放表（不可篡改）
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261003_005"
down_revision: Union[str, None] = "20261003_004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─── regulations ─────────────────────────────────────────────────────────────
    op.create_table(
        "regulations",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column(
            "regulation_code",
            sa.String(length=50),
            nullable=False,
            comment="法规编号",
        ),
        sa.Column("title", sa.String(length=500), nullable=False, comment="法规标题"),
        sa.Column(
            "issuing_authority", sa.String(length=200), nullable=True, comment="颁布机构"
        ),
        sa.Column(
            "industry", sa.String(length=50), nullable=True, comment="适用行业"
        ),
        sa.Column("category", sa.String(length=100), nullable=True, comment="法规分类"),
        sa.Column(
            "effective_date", sa.String(length=10), nullable=True, comment="生效日期"
        ),
        sa.Column(
            "expiry_date", sa.String(length=10), nullable=True, comment="失效日期"
        ),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=True,
            server_default="active",
            comment="法规状态",
        ),
        sa.Column(
            "source_url", sa.String(length=500), nullable=True, comment="原文链接"
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
        sa.UniqueConstraint("regulation_code"),
    )
    op.create_index("idx_regulation_code", "regulations", ["regulation_code"])
    op.create_index("idx_regulation_industry", "regulations", ["industry"])

    # ─── regulation_versions ────────────────────────────────────────────────────
    op.create_table(
        "regulation_versions",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column(
            "regulation_id", sa.BigInteger(), nullable=False, comment="法规ID"
        ),
        sa.Column(
            "version_no", sa.String(length=20), nullable=False, comment="版本号"
        ),
        sa.Column(
            "document_file_id", sa.BigInteger(), nullable=True, comment="关联文档ID"
        ),
        sa.Column("full_text", sa.Text(), nullable=True, comment="法规全文"),
        sa.Column(
            "effective_date", sa.String(length=10), nullable=True, comment="生效日期"
        ),
        sa.Column(
            "is_current",
            sa.Boolean(),
            nullable=False,
            server_default="0",
            comment="是否为当前版本",
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
    )
    op.create_index("idx_version_regulation", "regulation_versions", ["regulation_id"])

    # ─── regulation_diff_reports ────────────────────────────────────────────────
    op.create_table(
        "regulation_diff_reports",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column(
            "regulation_id", sa.BigInteger(), nullable=False, comment="法规ID"
        ),
        sa.Column(
            "old_version_id", sa.BigInteger(), nullable=True, comment="旧版本ID"
        ),
        sa.Column(
            "new_version_id", sa.BigInteger(), nullable=True, comment="新版本ID"
        ),
        sa.Column(
            "diff_summary", sa.JSON(), nullable=True, comment="差异摘要"
        ),
        sa.Column(
            "detailed_changes", sa.Text(), nullable=True, comment="详细变更内容"
        ),
        sa.Column(
            "impact_analysis", sa.Text(), nullable=True, comment="影响分析"
        ),
        sa.Column(
            "affected_business", sa.JSON(), nullable=True, comment="受影响业务"
        ),
        sa.Column(
            "ai_model", sa.String(length=50), nullable=True, comment="生成模型"
        ),
        sa.Column(
            "generated_at", sa.String(length=19), nullable=True, comment="生成时间"
        ),
        sa.Column(
            "generated_by", sa.BigInteger(), nullable=True, comment="生成人用户ID"
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
    )
    op.create_index("idx_diff_regulation", "regulation_diff_reports", ["regulation_id"])

    # ─── industry_news ─────────────────────────────────────────────────────────
    op.create_table(
        "industry_news",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False, comment="资讯标题"),
        sa.Column("source", sa.String(length=100), nullable=True, comment="来源网站"),
        sa.Column(
            "source_url", sa.String(length=500), nullable=True, comment="原文链接"
        ),
        sa.Column(
            "published_at", sa.String(length=19), nullable=True, comment="发布时间"
        ),
        sa.Column(
            "industry", sa.String(length=50), nullable=True, comment="行业"
        ),
        sa.Column(
            "category", sa.String(length=100), nullable=True, comment="资讯分类"
        ),
        sa.Column("summary", sa.Text(), nullable=True, comment="AI 摘要"),
        sa.Column("full_text", sa.Text(), nullable=True, comment="完整正文"),
        sa.Column(
            "importance_level",
            sa.String(length=20),
            nullable=True,
            server_default="medium",
            comment="重要程度",
        ),
        sa.Column(
            "is_pushed",
            sa.Boolean(),
            nullable=False,
            server_default="0",
            comment="是否已推送",
        ),
        sa.Column(
            "pushed_at", sa.String(length=19), nullable=True, comment="推送时间"
        ),
        sa.Column("tags", sa.JSON(), nullable=True, comment="标签列表"),
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
    op.create_index("idx_news_published", "industry_news", ["published_at"])
    op.create_index("idx_news_industry", "industry_news", ["industry"])
    op.create_index("idx_news_importance", "industry_news", ["importance_level"])

    # ─── business_impact ────────────────────────────────────────────────────────
    op.create_table(
        "business_impact",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column(
            "event_type", sa.String(length=50), nullable=True, comment="事件类型"
        ),
        sa.Column("event_id", sa.BigInteger(), nullable=True, comment="关联事件ID"),
        sa.Column(
            "event_title", sa.String(length=500), nullable=True, comment="事件标题"
        ),
        sa.Column(
            "impact_level",
            sa.String(length=20),
            nullable=True,
            server_default="medium",
            comment="影响等级",
        ),
        sa.Column(
            "impact_scope", sa.JSON(), nullable=True, comment="影响范围"
        ),
        sa.Column(
            "affected_departments", sa.JSON(), nullable=True, comment="受影响部门"
        ),
        sa.Column(
            "predicted_actions", sa.JSON(), nullable=True, comment="建议处理事项"
        ),
        sa.Column(
            "ai_model", sa.String(length=50), nullable=True, comment="评估模型"
        ),
        sa.Column(
            "confidence", sa.Float(), nullable=True, comment="置信度（0-1）"
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
    )
    op.create_index("idx_impact_type", "business_impact", ["event_type"])
    op.create_index("idx_impact_level", "business_impact", ["impact_level"])

    # ─── decision_playbacks ──────────────────────────────────────────────────────
    op.create_table(
        "decision_playbacks",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column(
            "decision_no", sa.String(length=50), nullable=True, comment="决策编号"
        ),
        sa.Column(
            "decision_type", sa.String(length=50), nullable=True, comment="决策类型"
        ),
        sa.Column("title", sa.String(length=200), nullable=False, comment="决策标题"),
        sa.Column("context", sa.Text(), nullable=True, comment="决策背景"),
        sa.Column(
            "data_sources", sa.JSON(), nullable=True, comment="数据来源"
        ),
        sa.Column(
            "reasoning_chain", sa.Text(), nullable=True, comment="推理链"
        ),
        sa.Column(
            "participants", sa.JSON(), nullable=True, comment="参与角色"
        ),
        sa.Column(
            "final_decision", sa.Text(), nullable=True, comment="最终决策"
        ),
        sa.Column("outcome", sa.Text(), nullable=True, comment="决策结果"),
        sa.Column(
            "is_tampered",
            sa.Boolean(),
            nullable=False,
            server_default="0",
            comment="是否检测到篡改",
        ),
        sa.Column(
            "decision_hash", sa.String(length=64), nullable=True, comment="不可篡改哈希"
        ),
        sa.Column(
            "created_by", sa.BigInteger(), nullable=True, comment="创建人用户ID"
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
        sa.UniqueConstraint("decision_no"),
    )
    op.create_index("idx_playback_type", "decision_playbacks", ["decision_type"])
    op.create_index("idx_playback_created", "decision_playbacks", ["created_at"])


def downgrade() -> None:
    op.drop_table("decision_playbacks")
    op.drop_table("business_impact")
    op.drop_table("industry_news")
    op.drop_table("regulation_diff_reports")
    op.drop_table("regulation_versions")
    op.drop_table("regulations")
