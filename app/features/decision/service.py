"""决策智能域 service：法规 + 资讯 + 影响 + 决策回放。"""

from __future__ import annotations

import hashlib
import json
from typing import Sequence

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.features.decision.models import (
    BusinessImpact,
    DecisionPlayback,
    IndustryNews,
    Regulation,
)
from app.features.decision.schemas import (
    BusinessImpactCreate,
    DecisionPlaybackCreate,
    IndustryNewsCreate,
    RegulationCreate,
)


def _decision_hash(payload: dict) -> str:
    """决策回放 SM3 哈希：先用 SHA-256 替代（fallback 兼容）。

    实际生产应使用 SM3 国密算法（pysmx 或 gmssl）。
    """
    serialized = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


# ────────── Regulation ──────────


def create_regulation(db: Session, data: RegulationCreate) -> Regulation:
    reg = Regulation(**data.model_dump())
    db.add(reg)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"regulation_code 已存在: {data.regulation_code}",
        ) from exc
    db.refresh(reg)
    return reg


def list_regulations(
    db: Session, page: int = 1, page_size: int = 20
) -> tuple[Sequence[Regulation], int]:
    base = select(Regulation).order_by(Regulation.id.desc())
    items = list(db.scalars(base.offset((page - 1) * page_size).limit(page_size)).all())
    total = db.scalar(select(func.count(Regulation.id))) or 0
    return items, total


# ────────── IndustryNews ──────────


def create_news(db: Session, data: IndustryNewsCreate) -> IndustryNews:
    item = IndustryNews(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def list_news(
    db: Session,
    importance: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[Sequence[IndustryNews], int]:
    base = select(IndustryNews).order_by(IndustryNews.id.desc())
    if importance:
        base = base.where(IndustryNews.importance_level == importance)
    items = list(db.scalars(base.offset((page - 1) * page_size).limit(page_size)).all())
    count_q = select(func.count(IndustryNews.id))
    if importance:
        count_q = count_q.where(IndustryNews.importance_level == importance)
    total = db.scalar(count_q) or 0
    return items, total


# ────────── BusinessImpact ──────────


def create_business_impact(db: Session, data: BusinessImpactCreate) -> BusinessImpact:
    item = BusinessImpact(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def list_business_impacts(db: Session, limit: int = 50) -> Sequence[BusinessImpact]:
    return db.scalars(
        select(BusinessImpact).order_by(BusinessImpact.id.desc()).limit(limit)
    ).all()


# ────────── DecisionPlayback ──────────


def create_decision_playback(db: Session, data: DecisionPlaybackCreate) -> DecisionPlayback:
    payload = data.model_dump()
    # 计算防篡改哈希（落库时一并写入，字段集与 verify 保持一致）
    hash_payload = {
        "decision_no": payload.get("decision_no") or "",
        "decision_type": payload.get("decision_type") or "",
        "title": payload.get("title") or "",
        "context": payload.get("context") or "",
        "reasoning_chain": payload.get("reasoning_chain") or "",
        "final_decision": payload.get("final_decision") or "",
        "outcome": payload.get("outcome") or "",
    }
    payload["decision_hash"] = _decision_hash(hash_payload)
    item = DecisionPlayback(**payload)
    db.add(item)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"decision_no 已存在: {data.decision_no}",
        ) from exc
    db.refresh(item)
    return item


def list_decision_playbacks(db: Session, limit: int = 50) -> Sequence[DecisionPlayback]:
    return db.scalars(
        select(DecisionPlayback).order_by(DecisionPlayback.id.desc()).limit(limit)
    ).all()


def verify_decision_playback(db: Session, playback_id: int) -> bool:
    """重新计算哈希并比对，若不一致则标记 is_tampered。"""
    item = db.get(DecisionPlayback, playback_id)
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"决策回放 {playback_id} 不存在",
        )
    payload = {
        "decision_no": item.decision_no or "",
        "decision_type": item.decision_type or "",
        "title": item.title or "",
        "context": item.context or "",
        "reasoning_chain": item.reasoning_chain or "",
        "final_decision": item.final_decision or "",
        "outcome": item.outcome or "",
    }
    expected = _decision_hash(payload)
    if expected != item.decision_hash:
        item.is_tampered = True
        db.commit()
        return False
    return True
