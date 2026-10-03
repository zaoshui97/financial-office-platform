"""合规沙箱审计日志SQLAlchemy模型。

按需求仅存储：prompt_hash + prompt_len + prompt_preview(脱敏前500字)，
answer_hash + answer_len + answer_preview(脱敏前500字)；原文永不落库。
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import JSON, BigInteger, DateTime, Float, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin


class ComplianceAuditLog(TimestampMixin, Base):
    """合规沙箱单次调用的审计记录。"""

    __tablename__ = "compliance_audit_logs"

    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="调用用户ID",
    )
    conversation_id: Mapped[int | None] = mapped_column(
        BigInteger,
        nullable=True,
        comment="关联的聊天会话ID，可为空",
    )
    request_id: Mapped[str] = mapped_column(
        String(64), nullable=False, comment="AI 请求追踪 ID"
    )
    mode: Mapped[str] = mapped_column(
        String(32), nullable=False, comment="回答模式（compliance_sandbox）"
    )
    provider: Mapped[str] = mapped_column(
        String(64), nullable=False, comment="实际调用的 Provider 名称"
    )
    model: Mapped[str] = mapped_column(
        String(128), nullable=False, comment="实际调用的模型名"
    )
    prompt_hash: Mapped[str] = mapped_column(
        String(64), nullable=False, comment="原始 prompt 的 SHA-256 摘要"
    )
    prompt_length: Mapped[int] = mapped_column(
        BigInteger, nullable=False, comment="原始 prompt 字符数"
    )
    prompt_preview: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="原始 prompt 脱敏后前 500 字（永不含 PII 原文）",
    )
    answer_hash: Mapped[str | None] = mapped_column(
        String(64), nullable=True, comment="模型回答的 SHA-256 摘要"
    )
    answer_length: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, comment="模型回答字符数"
    )
    answer_preview: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="模型回答脱敏后前 500 字"
    )
    pii_detected: Mapped[dict[str, Any] | None] = mapped_column(
        JSON, nullable=True, comment="命中了哪些 PII 规则及次数"
    )
    risk_hits: Mapped[list[str] | None] = mapped_column(
        JSON, nullable=True, comment="命中了哪些风险词"
    )
    risk_category: Mapped[str | None] = mapped_column(
        String(32), nullable=True, comment="风险分类（money_laundering 等）"
    )
    confidence: Mapped[float | None] = mapped_column(
        Float, nullable=True, comment="Judge 置信度（0-1）"
    )
    judge_source: Mapped[str | None] = mapped_column(
        String(16), nullable=True, comment="判定来源 rule/llm_judge"
    )
    blocked: Mapped[bool] = mapped_column(
        nullable=False, default=False, comment="是否被拦截"
    )
    block_reason: Mapped[str | None] = mapped_column(
        String(128), nullable=True, comment="拦截原因"
    )
    latency_ms: Mapped[float | None] = mapped_column(
        Float, nullable=True, comment="调用耗时（毫秒）"
    )
    completed_at: Mapped[Any | None] = mapped_column(
        DateTime, nullable=True, comment="调用结束时间（含失败）"
    )
    scenario: Mapped[dict[str, Any] | None] = mapped_column(
        JSON, nullable=True,
        comment=(
            "调用场景元数据：mode(rule_only/llm_only/combined)、"
            "biz_type、biz_id、rule_risk_level、llm_risk_level 等"
        ),
    )

    __table_args__ = (
        Index("idx_compliance_audit_user_created", "user_id", "created_at"),
        Index("idx_compliance_audit_request", "request_id"),
        Index("idx_compliance_audit_blocked", "blocked"),
        Index("idx_compliance_audit_category", "risk_category"),
    )