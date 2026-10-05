"""决策智能域 REST 路由：亮点三（法规管理 + 行业资讯 + 决策回放）。"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.features.decision.schemas import (
    BusinessImpactCreate,
    BusinessImpactRead,
    DecisionPlaybackCreate,
    DecisionPlaybackRead,
    IndustryNewsCreate,
    IndustryNewsListResponse,
    IndustryNewsRead,
    RegulationCreate,
    RegulationListResponse,
    RegulationRead,
)
from app.features.decision.service import (
    create_business_impact,
    create_decision_playback,
    create_news,
    create_regulation,
    list_business_impacts,
    list_decision_playbacks,
    list_news,
    list_regulations,
    verify_decision_playback,
)

router = APIRouter(prefix="/decision", tags=["决策智能域（亮点三）"])


# ────────── Regulation ──────────


@router.post(
    "/regulations",
    response_model=RegulationRead,
    status_code=201,
    summary="录入法规",
)
def post_regulation(
    data: RegulationCreate,
    db: Annotated[Session, Depends(get_db)],
) -> RegulationRead:
    return RegulationRead.model_validate(create_regulation(db, data))


@router.get(
    "/regulations",
    response_model=RegulationListResponse,
    summary="分页查询法规",
)
def get_regulations(
    db: Annotated[Session, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> RegulationListResponse:
    items, total = list_regulations(db, page, page_size)
    return RegulationListResponse(
        items=[RegulationRead.model_validate(r) for r in items],
        total=total,
    )


# ────────── IndustryNews ──────────


@router.post(
    "/news",
    response_model=IndustryNewsRead,
    status_code=201,
    summary="录入行业资讯",
)
def post_news(
    data: IndustryNewsCreate,
    db: Annotated[Session, Depends(get_db)],
) -> IndustryNewsRead:
    return IndustryNewsRead.model_validate(create_news(db, data))


@router.get(
    "/news",
    response_model=IndustryNewsListResponse,
    summary="查询行业资讯（可选按重要度过滤）",
)
def get_news(
    db: Annotated[Session, Depends(get_db)],
    importance: str | None = Query(default=None, description="high/medium/low"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> IndustryNewsListResponse:
    items, total = list_news(db, importance, page, page_size)
    return IndustryNewsListResponse(
        items=[IndustryNewsRead.model_validate(n) for n in items],
        total=total,
    )


# ────────── BusinessImpact ──────────


@router.post(
    "/business-impact",
    response_model=BusinessImpactRead,
    status_code=201,
    summary="AI 评估业务影响",
)
def post_business_impact(
    data: BusinessImpactCreate,
    db: Annotated[Session, Depends(get_db)],
) -> BusinessImpactRead:
    return BusinessImpactRead.model_validate(create_business_impact(db, data))


@router.get(
    "/business-impact",
    response_model=list[BusinessImpactRead],
    summary="查询业务影响列表",
)
def get_business_impacts(
    db: Annotated[Session, Depends(get_db)],
    limit: int = Query(default=50, ge=1, le=200),
) -> list[BusinessImpactRead]:
    items = list_business_impacts(db, limit)
    return [BusinessImpactRead.model_validate(x) for x in items]


# ────────── DecisionPlayback（防篡改） ──────────


@router.post(
    "/decision-playbacks",
    response_model=DecisionPlaybackRead,
    status_code=201,
    summary="记录决策回放（自动计算防篡改哈希）",
)
def post_decision_playback(
    data: DecisionPlaybackCreate,
    db: Annotated[Session, Depends(get_db)],
) -> DecisionPlaybackRead:
    return DecisionPlaybackRead.model_validate(create_decision_playback(db, data))


@router.get(
    "/decision-playbacks",
    response_model=list[DecisionPlaybackRead],
    summary="查询决策回放",
)
def get_decision_playbacks(
    db: Annotated[Session, Depends(get_db)],
    limit: int = Query(default=50, ge=1, le=200),
) -> list[DecisionPlaybackRead]:
    items = list_decision_playbacks(db, limit)
    return [DecisionPlaybackRead.model_validate(x) for x in items]


@router.post(
    "/decision-playbacks/{playback_id}/verify",
    summary="校验决策回放完整性（防篡改）",
    response_model=dict,
)
def post_verify_playback(
    playback_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    ok = verify_decision_playback(db, playback_id)
    return {
        "playback_id": playback_id,
        "is_intact": ok,
        "message": "完整性校验通过" if ok else "检测到篡改！is_tampered 已置位",
    }
