"""4 Agent Blackboard 路由：session 管理 + 事件读写 + 汇总。"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.features.auth.dependencies import CurrentUser
from app.features.blackboard.schemas import (
    BlackboardEventCreate,
    BlackboardEventListResponse,
    BlackboardEventRead,
    BlackboardSessionCreate,
    BlackboardSessionRead,
    BlackboardSessionSummary,
)
from app.features.blackboard.service import (
    close_session,
    create_session,
    list_events,
    list_open_sessions,
    summarize_session,
    write_event,
)

router = APIRouter(prefix="/blackboard", tags=["4 Agent 共享黑板"])


@router.post(
    "/sessions",
    response_model=BlackboardSessionRead,
    status_code=status.HTTP_201_CREATED,
    summary="创建协作 session",
)
def post_session(
    data: BlackboardSessionCreate,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> BlackboardSessionRead:
    """创建一次多 Agent 协作 session，拿到 session_id 后 Agent 才能写事件。"""
    return create_session(db, current_user.id, data)


@router.get(
    "/sessions",
    response_model=list[BlackboardSessionRead],
    summary="列出当前用户 OPEN 的 session",
)
def get_sessions(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> list[BlackboardSessionRead]:
    return list_open_sessions(db, current_user.id)


@router.post(
    "/sessions/{session_id}/close",
    response_model=BlackboardSessionRead,
    summary="手动关闭 session",
)
def post_close_session(
    session_id: str,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> BlackboardSessionRead:
    return close_session(db, session_id, current_user.id)


@router.post(
    "/events",
    response_model=BlackboardEventRead,
    status_code=status.HTTP_201_CREATED,
    summary="Agent 写入事件",
)
def post_event(
    data: BlackboardEventCreate,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> BlackboardEventRead:
    """任意 Agent 写入事件：session 必须 OPEN 且属于当前用户。"""
    return write_event(db, current_user.id, data)


@router.get(
    "/events",
    response_model=BlackboardEventListResponse,
    summary="按 session 拉取事件（支持 since_id 轮询）",
)
def get_events(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    session_id: str = Query(..., min_length=8, max_length=64),
    since_id: int | None = Query(default=None, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
) -> BlackboardEventListResponse:
    return list_events(
        db,
        current_user.id,
        session_id=session_id,
        since_id=since_id,
        limit=limit,
    )


@router.get(
    "/sessions/{session_id}/summary",
    response_model=BlackboardSessionSummary,
    summary="汇总 4 角色最新事件 + 错误数",
)
def get_session_summary(
    session_id: str,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> BlackboardSessionSummary:
    return summarize_session(db, current_user.id, session_id)