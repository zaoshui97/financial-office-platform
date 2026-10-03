"""合规沙箱风险检查的精简审计模型。

按需求字段集：user_id / biz_type / biz_id / text_hash (SHA-256) /
risk_level (low/medium/high) / matched_rules (JSON) / llm_reasoning /
suggestions / created_at。

与 `app.features.compliance.models.ComplianceAuditLog`（LLM 调用完整链路审计）
并存的精简版本，仅记录"风险检查"事件本身。
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import JSON, BigInteger, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin


class SandboxAuditLog(TimestampMixin, Base):
    """合规沙箱单次风险检查的审计记录（精简版）。"""

    __tablename__ = "sandbox_audit_log"

    user_id: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        comment="调用用户 ID（不建外键，保持与 compliance_audit_logs 一致）",
    )
    biz_type: Mapped[str] = mapped_column(
        String(32), nullable=False, comment="业务类型：chat / document / approval"
    )
    biz_id: Mapped[str] = mapped_column(
        String(64), nullable=False, comment="业务对象 ID"
    )
    text_hash: Mapped[str] = mapped_column(
        String(64), nullable=False, comment="原文 SHA-256 摘要（原文永不落库）"
    )
    risk_level: Mapped[str] = mapped_column(
        String(16), nullable=False, comment="最终风险等级：low / medium / high"
    )
    matched_rules: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        nullable=False,
        comment="命中规则详情：规则名、命中次数、命中片段哈希",
    )
    llm_reasoning: Mapped[str | None] = mapped_column(
        String(2048), nullable=True, comment="LLM 判定理由（仅在触发 LLM 时有）"
    )
    suggestions: Mapped[str | None] = mapped_column(
        String(1024), nullable=True, comment="处置建议（拦截 / 脱敏 / 通过）"
    )

    __table_args__ = (
        Index("idx_sandbox_audit_user_created", "user_id", "created_at"),
        Index("idx_sandbox_audit_biz", "biz_type", "biz_id"),
        Index("idx_sandbox_audit_risk", "risk_level"),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<SandboxAuditLog id={self.id} user={self.user_id} "
            f"biz={self.biz_type}/{self.biz_id} risk={self.risk_level}>"
        )
