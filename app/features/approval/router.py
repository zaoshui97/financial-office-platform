"""审批模块 REST 路由。

FastAPI 按定义顺序匹配路径！
子路径路由（/{id}/xxx）必须写在 /{id} 通配符路由之前，
否则 "34/review" 会被 "/{approval_id}" 截获 → 404。
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.features.approval.schemas import (
    AIReviewResponse,
    ApprovalActionRead,
    ApprovalActionRequest,
    ApprovalCreate,
    ApprovalListResponse,
    ApprovalRead,
)
from app.features.approval.service import (
    act_on_approval,
    create_approval,
    get_approval,
    list_approval_actions,
    list_approvals,
    trigger_ai_review,
)
from app.features.auth.dependencies import CurrentUser

router = APIRouter(prefix="/approvals", tags=["智能审批"])


@router.post(
    "",
    response_model=ApprovalRead,
    status_code=status.HTTP_201_CREATED,
    summary="创建审批（默认自动提交 + 沙箱检测）",
)
def post_approval(
    data: ApprovalCreate,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> ApprovalRead:
    return ApprovalRead.model_validate(
        create_approval(db, current_user.id, data.model_dump(), auto_submit=True)
    )


@router.get(
    "",
    response_model=ApprovalListResponse,
    summary="列审批（按 scope 过滤：mine=我的, dept=本部门, all=全部）",
)
def get_approvals(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    status_filter: str | None = Query(default=None, alias="status"),
    scope: str = Query(default="mine", pattern="^(mine|dept|all)$"),
    limit: int = Query(default=50, ge=1, le=200),
) -> ApprovalListResponse:
    result = list_approvals(db, current_user.id, status_filter, limit, scope)
    return ApprovalListResponse.model_validate(result)


# ── 子路径路由（必须在 /{approval_id} 通配符之前）──────────────────────────────


@router.get(
    "/{approval_id}/actions",
    response_model=list[ApprovalActionRead],
    summary="审批操作流水",
)
def get_approval_actions_route(
    approval_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> list[ApprovalActionRead]:
    items = list_approval_actions(db, approval_id, current_user.id)
    return [ApprovalActionRead.model_validate(i) for i in items]


@router.post(
    "/{approval_id}/review",
    response_model=AIReviewResponse,
    summary="手动触发 AI 审查（4 维度合规检查）",
)
def post_ai_review(
    approval_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> AIReviewResponse:
    """任何人可对 pending/draft 状态的审批单手动触发 AI 审查。

    审查完成后更新 approval.ai_review / ai_suggestion / ai_reviewed_at，
    详情页刷新即可看到最新报告。
    """
    return AIReviewResponse.model_validate(
        trigger_ai_review(db, approval_id, current_user.id)
    )


@router.post(
    "/{approval_id}/action",
    response_model=ApprovalActionRead,
    summary="对审批做操作（approve/reject/urge/comment/close）",
)
def post_approval_action(
    approval_id: int,
    data: ApprovalActionRequest,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> ApprovalActionRead:
    return ApprovalActionRead.model_validate(
        act_on_approval(
            db, approval_id, current_user.id, data.action, data.comment, data.override_reason
        )
    )


# ── /{approval_id} 通配符路由（必须在所有子路径之后）───────────────────────────


@router.get(
    "/{approval_id}",
    response_model=ApprovalRead,
    summary="审批详情",
)
def get_approval_route(
    approval_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> ApprovalRead:
    return ApprovalRead.model_validate(
        get_approval(db, approval_id, current_user.id)
    )
