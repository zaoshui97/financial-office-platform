"""审批模块 REST 路由。"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.features.approval.schemas import (
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
    summary="列我的审批（可选按 status 过滤）",
)
def get_approvals(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
) -> ApprovalListResponse:
    result = list_approvals(db, current_user.id, status_filter, limit)
    return ApprovalListResponse.model_validate(result)


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
            db, approval_id, current_user.id, data.action, data.comment
        )
    )
