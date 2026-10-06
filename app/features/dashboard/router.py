"""Dashboard REST 路由。"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.features.auth.dependencies import CurrentUser
from app.features.dashboard.schemas import DashboardStatsResponse
from app.features.dashboard.service import compute_dashboard_stats

router = APIRouter(prefix="/dashboard", tags=["工作台"])


@router.get(
    "/stats",
    response_model=DashboardStatsResponse,
    summary="工作台统计（4 卡片 + 7 日折线 + 待审批）",
)
def get_dashboard_stats(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> DashboardStatsResponse:
    return DashboardStatsResponse.model_validate(
        compute_dashboard_stats(db, current_user.id)
    )
