"""合规沙箱审计入库与摘要计算。"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.features.compliance.models import ComplianceAuditLog

logger = get_logger(__name__)


@dataclass(frozen=True)
class AuditPayload:
    """单次调用需要写入审计日志的内容（不含原文）。"""

    user_id: int
    conversation_id: int | None
    request_id: str
    provider: str
    model: str
    prompt: str
    answer: str | None
    pii_detected: dict[str, int]
    risk_hits: list[str]
    blocked: bool
    block_reason: str | None
    latency_ms: float | None
    scenario: dict[str, Any] | None = None
    # 结构化分类与置信度（合规沙箱 4 层防御配套字段）
    risk_category: str | None = None
    confidence: float | None = None
    judge_source: str | None = None


def _sha256(text: str) -> str:
    """计算文本的 SHA-256 十六进制摘要。"""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def write_audit_log(
    db: Session,
    payload: AuditPayload,
    preview_chars: int,
) -> ComplianceAuditLog:
    """写入审计日志并返回持久化对象。原文永不直接入库。"""
    prompt_preview = payload.prompt[:preview_chars]
    answer_preview = (payload.answer or "")[:preview_chars]
    record = ComplianceAuditLog(
        user_id=payload.user_id,
        conversation_id=payload.conversation_id,
        request_id=payload.request_id,
        mode="compliance_sandbox",
        provider=payload.provider,
        model=payload.model,
        prompt_hash=_sha256(payload.prompt),
        prompt_length=len(payload.prompt),
        prompt_preview=prompt_preview,
        answer_hash=(
            _sha256(payload.answer) if payload.answer is not None else None
        ),
        answer_length=(len(payload.answer) if payload.answer is not None else None),
        answer_preview=answer_preview or None,
        pii_detected=payload.pii_detected or None,
        risk_hits=payload.risk_hits or None,
        risk_category=payload.risk_category,
        confidence=payload.confidence,
        judge_source=payload.judge_source,
        blocked=payload.blocked,
        block_reason=payload.block_reason,
        latency_ms=payload.latency_ms,
        scenario=payload.scenario,
        completed_at=datetime.now(tz=timezone.utc).replace(tzinfo=None),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    logger.info(
        "合规沙箱审计 | audit_id=%s user_id=%s blocked=%s pii=%s risk=%s",
        record.id,
        payload.user_id,
        payload.blocked,
        payload.pii_detected,
        payload.risk_hits,
    )
    return record