"""智能办公域：文档模板 + AI 生成内容管理。

包含 2 张核心表：
  - document_templates    文档模板表
  - generated_contents    AI 生成内容记录（含合规检测结果）
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
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

class TemplateType(StrEnum):
    """模板类型。"""
    NOTICE = "notice"       # 通知
    EMAIL = "email"         # 邮件
    WEEKLY = "weekly"     # 周报
    MONTHLY = "monthly"   # 月报
    MINUTES = "minutes"   # 会议纪要


class ContentType(StrEnum):
    """生成内容类型。"""
    NOTICE = "notice"
    EMAIL = "email"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    MINUTES = "minutes"


class PushStatus(StrEnum):
    """推送状态。"""
    UNSENT = "unsent"
    SENT = "sent"
    FAILED = "failed"


# ---------- 表定义 ----------

class DocumentTemplate(TimestampMixin, Base):
    """文档模板表：支持通知/邮件/周报/月报等多种场景。"""

    __tablename__ = "document_templates"
    __table_args__ = (
        Index("idx_template_code", "template_code", unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # 模板标识
    template_code: Mapped[str] = mapped_column(
        String(50), unique=True,
        comment="模板编码",
    )
    template_name: Mapped[str] = mapped_column(
        String(200),
        comment="模板名称",
    )
    template_type: Mapped[str] = mapped_column(
        String(50),
        default=TemplateType.NOTICE.value,
        comment="模板类型",
    )
    industry: Mapped[str | None] = mapped_column(
        String(50),
        comment="适用行业",
    )

    # 内容
    content: Mapped[str] = mapped_column(
        Text().with_variant(LONGTEXT, "mysql"),
        nullable=False,
        comment="模板正文（支持变量占位符 {var_name}）",
    )
    variables: Mapped[list[dict[str, Any]] | None] = mapped_column(
        JSON,
        comment="模板变量 [{name, type, required, description}]",
    )

    # 生命周期
    is_active: Mapped[bool] = mapped_column(
        default=True,
        comment="是否启用",
    )
    usage_count: Mapped[int] = mapped_column(
        default=0,
        comment="使用次数",
    )


class GeneratedContent(TimestampMixin, Base):
    """AI 生成内容记录：记录生成过程和合规检测结果。"""

    __tablename__ = "generated_contents"
    __table_args__ = (
        Index("idx_content_user", "user_id"),
        Index("idx_content_type", "content_type"),
        Index("idx_content_created", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # 生成者
    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="生成用户ID",
    )

    # 内容信息
    content_type: Mapped[str] = mapped_column(
        String(50),
        default=ContentType.NOTICE.value,
        comment="内容类型",
    )
    title: Mapped[str | None] = mapped_column(
        String(200),
        comment="内容标题",
    )
    prompt: Mapped[str | None] = mapped_column(
        Text,
        comment="生成 Prompt",
    )
    content: Mapped[str | None] = mapped_column(
        Text().with_variant(LONGTEXT, "mysql"),
        comment="生成内容正文",
    )

    # 模板来源
    template_id: Mapped[int | None] = mapped_column(
        BigInteger,
        comment="来源模板ID",
    )

    # 生成信息
    ai_model: Mapped[str | None] = mapped_column(
        String(50),
        comment="生成模型",
    )

    # 合规检测结果
    compliance_check_result: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        comment="合规检测结果 {passed, risk_level, hits}",
    )

    # 推送状态
    push_status: Mapped[str] = mapped_column(
        String(20),
        default=PushStatus.UNSENT.value,
        comment="推送状态",
    )
    push_channel: Mapped[str | None] = mapped_column(
        String(50),
        comment="推送渠道",
    )
    push_target: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        comment="推送目标 [{type, id, name}]",
    )
    pushed_at: Mapped[str | None] = mapped_column(
        String(19),
        comment="推送时间",
    )
