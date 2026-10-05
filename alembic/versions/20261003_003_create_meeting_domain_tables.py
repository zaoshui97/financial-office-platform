"""create meeting domain tables

Revision ID: 20261003_003
Revises: 20261003_001
Create Date: 2026-10-05 15:30:00.000000

创建会议协同域的 5 张表（对应亮点一）：
  - meetings             会议主表（含 AI 生成的议程/简报）
  - meeting_participants 参会人员表
  - meeting_transcripts  实时转写表（ASR + 决策标记）
  - meeting_minutes      AI 生成的会议纪要
  - meeting_todos        会议待办表（含钉钉/企微推送状态）

说明：
  - 此迁移与旧的 meeting_sessions / meeting_blackboard 表并存；
    新表为业务主表，旧表为黑板状态表，后续统一走新表。
  - meeting_no 业务唯一，scheduled_at / status / department_id 均建索引。
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261003_003"
down_revision: Union[str, None] = "20261003_002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─── meetings ────────────────────────────────────────────────────────────────
    op.create_table(
        "meetings",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column(
            "meeting_no", sa.String(length=50), nullable=False, comment="会议编号"
        ),
        sa.Column("title", sa.String(length=200), nullable=False, comment="会议标题"),
        sa.Column(
            "meeting_type",
            sa.String(length=50),
            nullable=True,
            comment="会议类型",
        ),
        sa.Column(
            "organizer_id", sa.BigInteger(), nullable=False, comment="主持人用户ID"
        ),
        sa.Column("department_id", sa.BigInteger(), nullable=True, comment="部门ID"),
        sa.Column(
            "scheduled_at", sa.DateTime(), nullable=False, comment="计划开始时间"
        ),
        sa.Column(
            "duration_minutes", sa.Integer(), nullable=True, comment="预计时长（分钟）"
        ),
        sa.Column("location", sa.String(length=200), nullable=True, comment="会议地点"),
        sa.Column(
            "online_meeting_url",
            sa.String(length=500),
            nullable=True,
            comment="线上会议链接",
        ),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=True,
            server_default="scheduled",
            comment="会议状态",
        ),
        sa.Column(
            "meeting_agenda", sa.Text(), nullable=True, comment="AI 生成的会议议程"
        ),
        sa.Column(
            "pre_meeting_briefing", sa.Text(), nullable=True, comment="会前简报"
        ),
        sa.Column(
            "pre_meeting_materials", sa.JSON(), nullable=True, comment="关联知识库文档"
        ),
        sa.Column(
            "host_user_id", sa.BigInteger(), nullable=True, comment="实际主持人用户ID"
        ),
        sa.Column("topic", sa.String(length=500), nullable=True, comment="会议主题"),
        sa.Column("agenda", sa.String(length=500), nullable=True, comment="初始议题"),
        sa.Column(
            "current_phase", sa.String(length=32), nullable=True, comment="当前阶段"
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
            comment="创建时间",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
            comment="更新时间",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("meeting_no"),
    )
    op.create_index("idx_meeting_organizer", "meetings", ["organizer_id"])
    op.create_index("idx_meeting_scheduled", "meetings", ["scheduled_at"])
    op.create_index("idx_meeting_status", "meetings", ["status"])
    op.create_index("idx_meeting_department", "meetings", ["department_id"])

    # ─── meeting_participants ──────────────────────────────────────────────────
    op.create_table(
        "meeting_participants",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("meeting_id", sa.BigInteger(), nullable=False, comment="会议ID"),
        sa.Column("user_id", sa.BigInteger(), nullable=False, comment="用户ID"),
        sa.Column(
            "role",
            sa.String(length=20),
            nullable=True,
            server_default="attendee",
            comment="参会角色",
        ),
        sa.Column(
            "attendance_status",
            sa.String(length=20),
            nullable=True,
            server_default="pending",
            comment="参会状态",
        ),
        sa.Column(
            "speaking_time_seconds",
            sa.Integer(),
            nullable=True,
            server_default="0",
            comment="发言时长（秒）",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
            comment="创建时间",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
            comment="更新时间",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["meeting_id"], ["meetings.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("meeting_id", "user_id", name="uk_meeting_user"),
    )
    op.create_index("idx_participant_meeting", "meeting_participants", ["meeting_id"])
    op.create_index("idx_participant_user", "meeting_participants", ["user_id"])

    # ─── meeting_transcripts ───────────────────────────────────────────────────
    op.create_table(
        "meeting_transcripts",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("meeting_id", sa.BigInteger(), nullable=False, comment="会议ID"),
        sa.Column("speaker_id", sa.BigInteger(), nullable=True, comment="说话人用户ID"),
        sa.Column("speaker_name", sa.String(length=100), nullable=True, comment="说话人姓名"),
        sa.Column("segment_text", sa.Text(), nullable=False, comment="段落文本"),
        sa.Column("segment_index", sa.Integer(), nullable=True, comment="段落序号"),
        sa.Column(
            "start_timestamp_ms", sa.BigInteger(), nullable=True, comment="开始时间（毫秒）"
        ),
        sa.Column(
            "end_timestamp_ms", sa.BigInteger(), nullable=True, comment="结束时间（毫秒）"
        ),
        sa.Column("confidence", sa.Float(), nullable=True, comment="ASR 置信度"),
        sa.Column(
            "is_decision",
            sa.Boolean(),
            nullable=False,
            server_default="0",
            comment="是否为决策点",
        ),
        sa.Column(
            "is_todo",
            sa.Boolean(),
            nullable=False,
            server_default="0",
            comment="是否为待办项",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
            comment="创建时间",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
            comment="更新时间",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["meeting_id"], ["meetings.id"], ondelete="CASCADE"),
    )
    op.create_index("idx_transcript_meeting", "meeting_transcripts", ["meeting_id"])
    op.create_index(
        "idx_transcript_meeting_index",
        "meeting_transcripts",
        ["meeting_id", "segment_index"],
    )

    # ─── meeting_minutes ───────────────────────────────────────────────────────
    op.create_table(
        "meeting_minutes",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("meeting_id", sa.BigInteger(), nullable=False, comment="会议ID"),
        sa.Column("summary", sa.Text(), nullable=True, comment="AI 摘要"),
        sa.Column("key_points", sa.JSON(), nullable=True, comment="要点列表"),
        sa.Column("decisions", sa.JSON(), nullable=True, comment="决议列表"),
        sa.Column("full_minutes", sa.Text(), nullable=True, comment="完整会议纪要"),
        sa.Column("ai_model", sa.String(length=50), nullable=True, comment="生成模型"),
        sa.Column(
            "generation_time_ms", sa.Integer(), nullable=True, comment="生成耗时（毫秒）"
        ),
        sa.Column("generated_at", sa.DateTime(), nullable=True, comment="生成时间"),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
            comment="创建时间",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
            comment="更新时间",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["meeting_id"], ["meetings.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("meeting_id"),
    )

    # ─── meeting_todos ─────────────────────────────────────────────────────────
    op.create_table(
        "meeting_todos",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("meeting_id", sa.BigInteger(), nullable=False, comment="会议ID"),
        sa.Column("minute_id", sa.BigInteger(), nullable=True, comment="关联纪要ID"),
        sa.Column("title", sa.String(length=500), nullable=False, comment="待办标题"),
        sa.Column("description", sa.Text(), nullable=True, comment="详细描述"),
        sa.Column(
            "assignee_id", sa.BigInteger(), nullable=False, comment="责任人用户ID"
        ),
        sa.Column(
            "priority", sa.String(length=20), nullable=True, server_default="medium", comment="优先级"
        ),
        sa.Column("due_date", sa.DateTime(), nullable=True, comment="截止时间"),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=True,
            server_default="pending",
            comment="待办状态",
        ),
        sa.Column("completed_at", sa.DateTime(), nullable=True, comment="完成时间"),
        sa.Column("push_channel", sa.String(length=50), nullable=True, comment="推送渠道"),
        sa.Column(
            "push_status",
            sa.String(length=20),
            nullable=True,
            server_default="pending",
            comment="推送状态",
        ),
        sa.Column(
            "source_decision", sa.Text(), nullable=True, comment="来源决议项"
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
            comment="创建时间",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
            comment="更新时间",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["meeting_id"], ["meetings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assignee_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("idx_todo_meeting", "meeting_todos", ["meeting_id"])
    op.create_index("idx_todo_assignee", "meeting_todos", ["assignee_id"])
    op.create_index("idx_todo_status", "meeting_todos", ["status"])
    op.create_index("idx_todo_due_date", "meeting_todos", ["due_date"])


def downgrade() -> None:
    op.drop_table("meeting_todos")
    op.drop_table("meeting_minutes")
    op.drop_table("meeting_transcripts")
    op.drop_table("meeting_participants")
    op.drop_table("meetings")
