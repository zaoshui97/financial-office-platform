"""create agent and office domain tables

Revision ID: 20261003_006
Revises: 20261003_005
Create Date: 2026-10-05 15:45:00.000000

创建以下域的表：
  多 Agent 协作域（3 张）：
    - agent_configs       Agent 配置表
    - agent_tasks         Agent 任务表
    - agent_collaborations Agent 协作链路表
  智能办公域（2 张）：
    - document_templates   文档模板表
    - generated_contents   AI 生成内容记录
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261003_006"
down_revision: Union[str, None] = "20261003_005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─── agent_configs ───────────────────────────────────────────────────────────
    op.create_table(
        "agent_configs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column(
            "agent_code", sa.String(length=50), nullable=False, comment="Agent 编码"
        ),
        sa.Column("agent_name", sa.String(length=100), nullable=False, comment="Agent 名称"),
        sa.Column(
            "agent_type", sa.String(length=50), nullable=True, comment="Agent 类型"
        ),
        sa.Column("description", sa.Text(), nullable=True, comment="功能描述"),
        sa.Column(
            "system_prompt", sa.Text(), nullable=True, comment="系统提示词"
        ),
        sa.Column(
            "model_name", sa.String(length=50), nullable=True, comment="使用的模型"
        ),
        sa.Column("tools", sa.JSON(), nullable=True, comment="可用工具列表"),
        sa.Column(
            "capabilities", sa.JSON(), nullable=True, comment="能力定义"
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default="1",
            comment="是否启用",
        ),
        sa.Column(
            "version", sa.Integer(), nullable=True, server_default="1", comment="版本号"
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
        sa.UniqueConstraint("agent_code"),
    )
    op.create_index("idx_config_code", "agent_configs", ["agent_code"])
    op.create_index("idx_config_type", "agent_configs", ["agent_type"])

    # ─── agent_tasks ────────────────────────────────────────────────────────────
    op.create_table(
        "agent_tasks",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column(
            "task_no", sa.String(length=50), nullable=True, comment="任务编号"
        ),
        sa.Column(
            "session_id", sa.String(length=64), nullable=True, comment="关联会话ID"
        ),
        sa.Column(
            "parent_task_id", sa.BigInteger(), nullable=True, comment="父任务ID"
        ),
        sa.Column("agent_id", sa.BigInteger(), nullable=True, comment="Agent 配置ID"),
        sa.Column(
            "task_type", sa.String(length=50), nullable=True, comment="任务类型"
        ),
        sa.Column("input_data", sa.JSON(), nullable=True, comment="输入数据"),
        sa.Column("output_data", sa.JSON(), nullable=True, comment="输出数据"),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=True,
            server_default="pending",
            comment="任务状态",
        ),
        sa.Column(
            "started_at", sa.String(length=19), nullable=True, comment="开始时间"
        ),
        sa.Column(
            "finished_at", sa.String(length=19), nullable=True, comment="结束时间"
        ),
        sa.Column(
            "duration_ms", sa.Integer(), nullable=True, comment="执行耗时（毫秒）"
        ),
        sa.Column(
            "error_message", sa.Text(), nullable=True, comment="错误信息"
        ),
        sa.Column(
            "retry_count",
            sa.Integer(),
            nullable=True,
            server_default="0",
            comment="重试次数",
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
        sa.UniqueConstraint("task_no"),
    )
    op.create_index("idx_task_session", "agent_tasks", ["session_id"])
    op.create_index("idx_task_agent", "agent_tasks", ["agent_id"])
    op.create_index("idx_task_status", "agent_tasks", ["status"])
    op.create_index("idx_task_parent", "agent_tasks", ["parent_task_id"])

    # ─── agent_collaborations ──────────────────────────────────────────────────
    op.create_table(
        "agent_collaborations",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column(
            "collaboration_no",
            sa.String(length=50),
            nullable=True,
            comment="协作编号",
        ),
        sa.Column(
            "scenario", sa.String(length=50), nullable=True, comment="协作场景"
        ),
        sa.Column(
            "scenario_id", sa.BigInteger(), nullable=True, comment="场景ID"
        ),
        sa.Column(
            "participants", sa.JSON(), nullable=True, comment="参与的 Agent 列表"
        ),
        sa.Column(
            "message_flow", sa.JSON(), nullable=True, comment="Agent 间消息流"
        ),
        sa.Column(
            "collaboration_result", sa.JSON(), nullable=True, comment="协作结果"
        ),
        sa.Column(
            "started_at", sa.String(length=19), nullable=True, comment="开始时间"
        ),
        sa.Column(
            "finished_at", sa.String(length=19), nullable=True, comment="结束时间"
        ),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=True,
            server_default="pending",
            comment="协作状态",
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
        sa.UniqueConstraint("collaboration_no"),
    )
    op.create_index("idx_collab_scenario", "agent_collaborations", ["scenario", "scenario_id"])

    # ─── document_templates ────────────────────────────────────────────────────
    op.create_table(
        "document_templates",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column(
            "template_code", sa.String(length=50), nullable=True, comment="模板编码"
        ),
        sa.Column(
            "template_name", sa.String(length=200), nullable=True, comment="模板名称"
        ),
        sa.Column(
            "template_type", sa.String(length=50), nullable=True, comment="模板类型"
        ),
        sa.Column(
            "industry", sa.String(length=50), nullable=True, comment="适用行业"
        ),
        sa.Column("content", sa.Text(), nullable=False, comment="模板正文"),
        sa.Column("variables", sa.JSON(), nullable=True, comment="模板变量"),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default="1",
            comment="是否启用",
        ),
        sa.Column(
            "usage_count",
            sa.Integer(),
            nullable=True,
            server_default="0",
            comment="使用次数",
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
        sa.UniqueConstraint("template_code"),
    )

    # ─── generated_contents ────────────────────────────────────────────────────
    op.create_table(
        "generated_contents",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column(
            "user_id", sa.BigInteger(), nullable=False, comment="生成用户ID"
        ),
        sa.Column(
            "content_type", sa.String(length=50), nullable=True, comment="内容类型"
        ),
        sa.Column("title", sa.String(length=200), nullable=True, comment="内容标题"),
        sa.Column("prompt", sa.Text(), nullable=True, comment="生成 Prompt"),
        sa.Column("content", sa.Text(), nullable=True, comment="生成内容正文"),
        sa.Column(
            "template_id", sa.BigInteger(), nullable=True, comment="来源模板ID"
        ),
        sa.Column(
            "ai_model", sa.String(length=50), nullable=True, comment="生成模型"
        ),
        sa.Column(
            "compliance_check_result", sa.JSON(), nullable=True, comment="合规检测结果"
        ),
        sa.Column(
            "push_status",
            sa.String(length=20),
            nullable=True,
            server_default="unsent",
            comment="推送状态",
        ),
        sa.Column(
            "push_channel", sa.String(length=50), nullable=True, comment="推送渠道"
        ),
        sa.Column(
            "push_target", sa.JSON(), nullable=True, comment="推送目标"
        ),
        sa.Column(
            "pushed_at", sa.String(length=19), nullable=True, comment="推送时间"
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
    op.create_index("idx_content_user", "generated_contents", ["user_id"])
    op.create_index("idx_content_type", "generated_contents", ["content_type"])
    op.create_index("idx_content_created", "generated_contents", ["created_at"])


def downgrade() -> None:
    op.drop_table("generated_contents")
    op.drop_table("document_templates")
    op.drop_table("agent_collaborations")
    op.drop_table("agent_tasks")
    op.drop_table("agent_configs")
