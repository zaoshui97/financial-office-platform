"""会议 REST 路由：会议生命周期 + 黑板读 + 触发 Agent。"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.features.agent.models import MeetingStatus
from app.features.auth.dependencies import CurrentUser
from app.features.meeting.schemas import (
    AgentTriggerRequest,
    AgentTriggerResponse,
    BlackboardEventListResponse,
    BlackboardReadResponse,
    MeetingCreate,
    MeetingListResponse,
    MeetingRead,
)
from app.features.meeting.service import (
    close_meeting,
    create_meeting,
    get_meeting,
    list_blackboard_events,
    list_meetings,
    read_blackboard,
    trigger_agent,
)

router = APIRouter(prefix="/meetings", tags=["会议 Agent"])


# ---------- 会议生命周期 ----------


@router.post(
    "",
    response_model=MeetingRead,
    status_code=status.HTTP_201_CREATED,
    summary="创建会议（自动激活 + 写 moderator 初始 state）",
)
def post_meeting(
    data: MeetingCreate,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> MeetingRead:
    """创建即 active；topic/agenda 写入 moderator 黑板。"""
    return create_meeting(db, current_user.id, data)


@router.get(
    "",
    response_model=MeetingListResponse,
    summary="列出当前用户的会议（可选按状态过滤）",
)
def get_meetings(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    status_filter: MeetingStatus | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
) -> MeetingListResponse:
    return list_meetings(db, current_user.id, status_filter, limit)


@router.get(
    "/{meeting_id}",
    response_model=MeetingRead,
    summary="会议详情（含 moderator 最新的 topic/agenda/phase）",
)
def get_meeting_route(
    meeting_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> MeetingRead:
    return get_meeting(db, meeting_id, current_user.id)


@router.delete(
    "/{meeting_id}",
    response_model=MeetingRead,
    summary="关闭会议（仅 host / 仅 active）",
)
def delete_meeting(
    meeting_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> MeetingRead:
    return close_meeting(db, meeting_id, current_user.id)


# ---------- 黑板 ----------


@router.get(
    "/{meeting_id}/blackboard",
    response_model=BlackboardReadResponse,
    summary="读会议黑板全部 Agent 最新状态",
)
def get_blackboard(
    meeting_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> BlackboardReadResponse:
    return read_blackboard(db, meeting_id, current_user.id)


@router.post(
    "/{meeting_id}/blackboard/{agent_role}",
    response_model=AgentTriggerResponse,
    summary="触发指定 Agent 跑一次（同步等结果）",
)
def post_agent(
    meeting_id: int,
    agent_role: str,
    data: AgentTriggerRequest,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> AgentTriggerResponse:
    """agent_role ∈ {moderator, noter, decision, dispatcher}"""
    return trigger_agent(
        db, meeting_id, current_user.id, agent_role, data.context,
    )


@router.get(
    "/{meeting_id}/blackboard/events",
    response_model=BlackboardEventListResponse,
    summary="拉取 id > since_event_id 的事件流（重连后增量同步）",
)
def get_blackboard_events(
    meeting_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    since_event_id: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=500),
) -> BlackboardEventListResponse:
    """前端重连后用本地最大 event id 调此接口，缺失事件全量补齐。"""
    return list_blackboard_events(
        db, meeting_id, current_user.id, since_event_id, limit,
    )