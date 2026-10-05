"""create compliance audit domain tables

Revision ID: 20261003_004
Revises: 20261003_003
Create Date: 2026-10-05 15:35:00.000000

创建合规审计域的 5 张表（对应亮点二）：
  - audit_logs          7 段链路指纹审计日志（防篡改链式哈希）
  - policy_rules         合规规则库（9 大风险分类）
  - policy_violations    违规事件表（复核流程）
  - risk_alerts          风险告警表（分级响应）
  - user_sessions        增强版会话管理（AES-256 加密）
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261003_004"
down_revision: Union[str, None] = "20261003_003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─── audit_logs ──────────────────────────────────────────────────────────────
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column(
            "trace_id", sa.String(length=64), nullable=False, comment="链路追踪ID"
        ),
        sa.Column("user_id", sa.BigInteger(), nullable=False, comment="操作用户ID"),
        sa.Column("session_id", sa.String(length=64), nullable=True, comment="会话ID"),
        sa.Column("request_text", sa.Text(), nullable=True, comment="用户输入（脱敏）"),
        sa.Column(
            "request_hash", sa.String(length=64), nullable=False, comment="输入哈希"
        ),
        sa.Column(
            "stage_1_intent_parse", sa.JSON(), nullable=True, comment="①意图解析"
        ),
        sa.Column(
            "stage_2_rag_retrieval", sa.JSON(), nullable=True, comment="②RAG检索"
        ),
        sa.Column(
            "stage_3_prompt_construction", sa.JSON(), nullable=True, comment="③Prompt构造"
        ),
        sa.Column(
            "stage_4_model_call", sa.JSON(), nullable=True, comment="④模型调用"
        ),
        sa.Column(
            "stage_5_output_validation", sa.JSON(), nullable=True, comment="⑤输出校验"
        ),
        sa.Column(
            "stage_6_user_confirmation", sa.JSON(), nullable=True, comment="⑥用户确认"
        ),
        sa.Column(
            "stage_7_action_execution", sa.JSON(), nullable=True, comment="⑦执行落地"
        ),
        sa.Column(
            "risk_level", sa.String(length=20), nullable=True, comment="风险等级"
        ),
        sa.Column(
            "policy_violation_id", sa.BigInteger(), nullable=True, comment="违规规则ID"
        ),
        sa.Column(
            "is_blocked", sa.Boolean(), nullable=False, server_default="0", comment="是否拦截"
        ),
        sa.Column(
            "final_response", sa.Text(), nullable=True, comment="最终输出（脱敏）"
        ),
        sa.Column(
            "log_hash", sa.String(length=64), nullable=False, comment="SM3哈希（链式）"
        ),
        sa.Column(
            "prev_log_hash", sa.String(length=64), nullable=True, comment="上一条哈希"
        ),
        sa.Column(
            "is_tampered",
            sa.Boolean(),
            nullable=False,
            server_default="0",
            comment="是否检测到篡改",
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
        sa.UniqueConstraint("trace_id"),
    )
    op.create_index("idx_audit_trace", "audit_logs", ["trace_id"])
    op.create_index("idx_audit_user", "audit_logs", ["user_id"])
    op.create_index("idx_audit_session", "audit_logs", ["session_id"])
    op.create_index("idx_audit_risk", "audit_logs", ["risk_level"])
    op.create_index("idx_audit_created", "audit_logs", ["created_at"])

    # ─── policy_rules ───────────────────────────────────────────────────────────
    op.create_table(
        "policy_rules",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column(
            "rule_code", sa.String(length=50), nullable=False, comment="规则编码"
        ),
        sa.Column("rule_name", sa.String(length=200), nullable=False, comment="规则名称"),
        sa.Column("rule_type", sa.String(length=50), nullable=True, comment="规则类型"),
        sa.Column(
            "rule_category", sa.String(length=50), nullable=True, comment="风险分类"
        ),
        sa.Column(
            "industry", sa.String(length=50), nullable=True, comment="适用行业"
        ),
        sa.Column(
            "match_pattern", sa.Text(), nullable=False, comment="匹配模式"
        ),
        sa.Column(
            "match_mode", sa.String(length=20), nullable=True, comment="匹配模式"
        ),
        sa.Column("action", sa.String(length=20), nullable=True, comment="命中后动作"),
        sa.Column(
            "severity", sa.String(length=20), nullable=True, comment="严重程度"
        ),
        sa.Column(
            "regulation_ref", sa.String(length=500), nullable=True, comment="引用法规"
        ),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default="1", comment="是否启用"
        ),
        sa.Column("version", sa.Integer(), nullable=True, server_default="1", comment="版本号"),
        sa.Column(
            "effective_date", sa.String(length=10), nullable=True, comment="生效日期"
        ),
        sa.Column(
            "expiry_date", sa.String(length=10), nullable=True, comment="失效日期"
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
        sa.UniqueConstraint("rule_code"),
    )
    op.create_index("idx_rule_code", "policy_rules", ["rule_code"])
    op.create_index("idx_rule_category", "policy_rules", ["rule_category"])
    op.create_index("idx_rule_active", "policy_rules", ["is_active"])

    # ─── policy_violations ─────────────────────────────────────────────────────
    op.create_table(
        "policy_violations",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column(
            "audit_log_id", sa.BigInteger(), nullable=True, comment="关联审计日志ID"
        ),
        sa.Column("rule_id", sa.BigInteger(), nullable=False, comment="命中的规则ID"),
        sa.Column(
            "user_id", sa.BigInteger(), nullable=True, comment="操作用户ID"
        ),
        sa.Column(
            "violated_text", sa.Text(), nullable=True, comment="违规内容（脱敏）"
        ),
        sa.Column(
            "regulation_reference",
            sa.String(length=500),
            nullable=True,
            comment="引用法规",
        ),
        sa.Column(
            "action_taken", sa.String(length=50), nullable=True, comment="处理动作"
        ),
        sa.Column(
            "review_status",
            sa.String(length=20),
            nullable=True,
            server_default="pending",
            comment="复核状态",
        ),
        sa.Column(
            "reviewer_id", sa.BigInteger(), nullable=True, comment="复核人用户ID"
        ),
        sa.Column(
            "review_comment", sa.Text(), nullable=True, comment="复核意见"
        ),
        sa.Column(
            "reviewed_at", sa.String(length=19), nullable=True, comment="复核时间"
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
    op.create_index("idx_violation_audit", "policy_violations", ["audit_log_id"])
    op.create_index("idx_violation_rule", "policy_violations", ["rule_id"])
    op.create_index("idx_violation_user", "policy_violations", ["user_id"])

    # ─── risk_alerts ────────────────────────────────────────────────────────────
    op.create_table(
        "risk_alerts",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column(
            "alert_no", sa.String(length=50), nullable=True, comment="告警编号"
        ),
        sa.Column(
            "alert_type", sa.String(length=50), nullable=True, comment="告警类型"
        ),
        sa.Column(
            "risk_level", sa.String(length=20), nullable=True, comment="风险等级"
        ),
        sa.Column("source", sa.String(length=50), nullable=True, comment="触发源"),
        sa.Column("title", sa.String(length=200), nullable=False, comment="告警标题"),
        sa.Column(
            "description", sa.Text(), nullable=True, comment="告警描述"
        ),
        sa.Column(
            "related_user_id", sa.BigInteger(), nullable=True, comment="关联用户ID"
        ),
        sa.Column(
            "related_session_id", sa.String(length=64), nullable=True, comment="关联会话ID"
        ),
        sa.Column(
            "related_audit_id", sa.BigInteger(), nullable=True, comment="关联审计日志ID"
        ),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=True,
            server_default="pending",
            comment="告警状态",
        ),
        sa.Column(
            "assignee_id", sa.BigInteger(), nullable=True, comment="处理人用户ID"
        ),
        sa.Column("resolution", sa.Text(), nullable=True, comment="处理结果"),
        sa.Column(
            "resolved_at", sa.String(length=19), nullable=True, comment="解决时间"
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
        sa.UniqueConstraint("alert_no"),
    )
    op.create_index("idx_alert_type", "risk_alerts", ["alert_type"])
    op.create_index("idx_alert_level", "risk_alerts", ["risk_level"])
    op.create_index("idx_alert_status", "risk_alerts", ["status"])

    # ─── user_sessions ─────────────────────────────────────────────────────────
    op.create_table(
        "user_sessions",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column(
            "session_id", sa.String(length=64), nullable=False, comment="会话ID"
        ),
        sa.Column("user_id", sa.BigInteger(), nullable=False, comment="用户ID"),
        sa.Column(
            "device_fingerprint", sa.String(length=255), nullable=True, comment="设备指纹"
        ),
        sa.Column("ip_address", sa.String(length=50), nullable=True, comment="IP地址"),
        sa.Column("user_agent", sa.Text(), nullable=True, comment="User-Agent"),
        sa.Column(
            "encrypted_payload", sa.Text(), nullable=True, comment="AES-256 加密会话"
        ),
        sa.Column(
            "encryption_key_id", sa.String(length=64), nullable=True, comment="密钥ID"
        ),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=True,
            server_default="active",
            comment="会话状态",
        ),
        sa.Column(
            "created_at",
            sa.String(length=19),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "last_active_at", sa.String(length=19), nullable=True, comment="最后活跃时间"
        ),
        sa.Column("expires_at", sa.String(length=19), nullable=True, comment="过期时间"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id"),
    )
    op.create_index("idx_session_user", "user_sessions", ["user_id"])
    op.create_index("idx_session_expires", "user_sessions", ["expires_at"])


def downgrade() -> None:
    op.drop_table("user_sessions")
    op.drop_table("risk_alerts")
    op.drop_table("policy_violations")
    op.drop_table("policy_rules")
    op.drop_table("audit_logs")
