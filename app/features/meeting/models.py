"""会议协同域：会议全生命周期（对应亮点一）。

包含 5 张核心表：
  - meetings            会议主表（含 AI 生成的议程/简报）
  - meeting_participants 参会人员
  - meeting_transcripts  实时转写（带 ASR 置信度 + 决策标记）
  - meeting_minutes      AI 生成的会议纪要
  - meeting_todos        会议待办（含钉钉/企微推送状态）
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin


# ---------- 枚举定义 ----------

class MeetingType(StrEnum):
    """会议类型。"""
    INTERNAL = "internal"      # 内部会议
    CLIENT = "client"          # 客户会议
    COMPLIANCE = "compliance"  # 合规审查会
    PROJECT = "project"       # 项目评审会


class MeetingStatus(StrEnum):
    """会议状态。"""
    SCHEDULED = "scheduled"    # 已排期
    IN_PROGRESS = "in_progress"  # 进行中
    FINISHED = "finished"       # 已结束
    CANCELLED = "cancelled"     # 已取消


class AttendanceStatus(StrEnum):
    """参会状态。"""
    PENDING = "pending"    # 待确认
    CONFIRMED = "confirmed"  # 已确认
    ATTENDED = "attended"   # 已出席
    ABSENT = "absent"       # 缺席


class ParticipantRole(StrEnum):
    """参会人角色。"""
    HOST = "host"       # 主持人
    RECORDER = "recorder"  # 记录员
    ATTENDEE = "attendee"  # 普通参会者


class TodoStatus(StrEnum):
    """待办状态。"""
    PENDING = "pending"      # 待处理
    IN_PROGRESS = "in_progress"  # 处理中
    COMPLETED = "completed"  # 已完成
    OVERDUE = "overdue"      # 已逾期


class PushChannel(StrEnum):
    """推送渠道。"""
    DINGTALK = "dingtalk"  # 钉钉
    WECOM = "wecom"        # 企业微信
    EMAIL = "email"         # 邮件
    IN_APP = "in_app"      # 站内通知


class PushStatus(StrEnum):
    """推送状态。"""
    PENDING = "pending"   # 待推送
    SENT = "sent"         # 已发送
    FAILED = "failed"     # 推送失败
    SKIPPED = "skipped"   # 跳过（未配置渠道）


# ---------- 表定义 ----------

class Meeting(TimestampMixin, Base):
    """会议主表：覆盖会议全生命周期，含 AI 生成的议程和简报。"""

    __tablename__ = "meetings"
    __table_args__ = (
        Index("idx_meeting_organizer", "organizer_id"),
        Index("idx_meeting_scheduled", "scheduled_at"),
        Index("idx_meeting_status", "status"),
        Index("idx_meeting_department", "department_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # 会议编号（业务唯一）
    meeting_no: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False,
        comment="会议编号",
    )

    # 基本信息
    title: Mapped[str] = mapped_column(
        String(200), nullable=False,
        comment="会议标题",
    )
    meeting_type: Mapped[str] = mapped_column(
        String(50),
        default=MeetingType.INTERNAL.value,
        comment="会议类型",
    )

    # 组织者
    organizer_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="主持人用户ID",
    )
    department_id: Mapped[int | None] = mapped_column(
        BigInteger,
        nullable=True,
        comment="部门ID",
    )

    # 时间地点
    scheduled_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False,
        comment="计划开始时间",
    )
    duration_minutes: Mapped[int] = mapped_column(
        Integer, default=60,
        comment="预计时长（分钟）",
    )
    location: Mapped[str | None] = mapped_column(
        String(200),
        comment="会议地点",
    )
    online_meeting_url: Mapped[str | None] = mapped_column(
        String(500),
        comment="线上会议链接（钉钉/腾讯会议）",
    )

    # 状态
    status: Mapped[str] = mapped_column(
        String(20),
        default=MeetingStatus.SCHEDULED.value,
        comment="会议状态",
    )

    # AI 生成内容
    meeting_agenda: Mapped[str | None] = mapped_column(
        Text,
        comment="AI 生成的会议议程",
    )
    pre_meeting_briefing: Mapped[str | None] = mapped_column(
        Text,
        comment="会前简报（AI 生成）",
    )
    pre_meeting_materials: Mapped[dict | None] = mapped_column(
        JSON,
        comment="关联知识库文档列表 [{kb_id, doc_id, title}]",
    )

    # 关联字段
    host_user_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="实际主持人用户ID（可与 organizer 不同）",
    )
    topic: Mapped[str | None] = mapped_column(
        String(500),
        comment="会议主题（冗余方便检索）",
    )
    agenda: Mapped[str | None] = mapped_column(
        String(500),
        comment="初始议题（冗余方便检索）",
    )
    current_phase: Mapped[str | None] = mapped_column(
        String(32),
        comment="当前阶段（moderator 写入）",
    )


class MeetingParticipant(TimestampMixin, Base):
    """参会人员表。"""

    __tablename__ = "meeting_participants"
    __table_args__ = (
        Index("idx_participant_meeting", "meeting_id"),
        Index("idx_participant_user", "user_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    meeting_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("meetings.id", ondelete="CASCADE"),
        nullable=False,
        comment="会议ID",
    )
    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="用户ID",
    )
    role: Mapped[str] = mapped_column(
        String(20),
        default=ParticipantRole.ATTENDEE.value,
        comment="参会角色",
    )
    attendance_status: Mapped[str] = mapped_column(
        String(20),
        default=AttendanceStatus.PENDING.value,
        comment="参会状态",
    )
    speaking_time_seconds: Mapped[int] = mapped_column(
        Integer, default=0,
        comment="发言时长（秒）",
    )


class MeetingTranscript(TimestampMixin, Base):
    """会议转写表：实时记录每个语音段落。"""

    __tablename__ = "meeting_transcripts"
    __table_args__ = (
        Index("idx_transcript_meeting", "meeting_id"),
        Index("idx_transcript_meeting_index", "meeting_id", "segment_index"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    meeting_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("meetings.id", ondelete="CASCADE"),
        nullable=False,
        comment="会议ID",
    )
    speaker_id: Mapped[int | None] = mapped_column(
        BigInteger,
        nullable=True,
        comment="说话人用户ID",
    )
    speaker_name: Mapped[str | None] = mapped_column(
        String(100),
        comment="说话人姓名",
    )
    segment_text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="段落文本",
    )
    segment_index: Mapped[int] = mapped_column(
        Integer,
        comment="段落序号",
    )
    start_timestamp_ms: Mapped[int | None] = mapped_column(
        BigInteger,
        comment="段落开始时间（毫秒）",
    )
    end_timestamp_ms: Mapped[int | None] = mapped_column(
        BigInteger,
        comment="段落结束时间（毫秒）",
    )
    confidence: Mapped[float | None] = mapped_column(
        comment="ASR 置信度（0-1）",
    )
    is_decision: Mapped[bool] = mapped_column(
        default=False,
        comment="是否为决策点",
    )
    is_todo: Mapped[bool] = mapped_column(
        default=False,
        comment="是否为待办项",
    )


class MeetingMinute(TimestampMixin, Base):
    """会议纪要表：AI 生成的会议摘要、决议和待办。"""

    __tablename__ = "meeting_minutes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    meeting_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("meetings.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        comment="会议ID",
    )
    summary: Mapped[str | None] = mapped_column(
        Text,
        comment="AI 生成的摘要",
    )
    key_points: Mapped[list[str] | None] = mapped_column(
        JSON,
        comment="要点列表",
    )
    decisions: Mapped[list[dict[str, Any]] | None] = mapped_column(
        JSON,
        comment="决议列表 [{item, owner, deadline, confidence}]",
    )
    full_minutes: Mapped[str | None] = mapped_column(
        Text().with_variant(LONGTEXT, "mysql"),
        comment="完整会议纪要",
    )
    ai_model: Mapped[str | None] = mapped_column(
        String(50),
        comment="生成使用的模型",
    )
    generation_time_ms: Mapped[int | None] = mapped_column(
        Integer,
        comment="生成耗时（毫秒）",
    )
    generated_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        comment="生成时间",
    )


class MeetingTodo(TimestampMixin, Base):
    """会议待办表：会后自动从 DispatcherAgent 拆解的工单。"""

    __tablename__ = "meeting_todos"
    __table_args__ = (
        Index("idx_todo_meeting", "meeting_id"),
        Index("idx_todo_assignee", "assignee_id"),
        Index("idx_todo_status", "status"),
        Index("idx_todo_due_date", "due_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    meeting_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("meetings.id", ondelete="CASCADE"),
        nullable=False,
        comment="会议ID",
    )
    minute_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("meeting_minutes.id", ondelete="SET NULL"),
        nullable=True,
        comment="关联纪要ID",
    )
    title: Mapped[str] = mapped_column(
        String(500), nullable=False,
        comment="待办标题",
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        comment="详细描述",
    )
    assignee_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="责任人用户ID",
    )
    priority: Mapped[str] = mapped_column(
        String(20),
        default="medium",
        comment="优先级（P0/P1/P2/P3）",
    )
    due_date: Mapped[datetime | None] = mapped_column(
        DateTime,
        comment="截止时间",
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default=TodoStatus.PENDING.value,
        comment="待办状态",
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
        comment="完成时间",
    )
    push_channel: Mapped[str | None] = mapped_column(
        String(50),
        comment="推送渠道",
    )
    push_status: Mapped[str] = mapped_column(
        String(20),
        default=PushStatus.PENDING.value,
        comment="推送状态",
    )
    source_decision: Mapped[str | None] = mapped_column(
        Text,
        comment="来源决议项",
    )
