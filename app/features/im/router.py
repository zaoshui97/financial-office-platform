"""IM 模块 REST 路由：通讯录 + 一对一消息。"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.features.auth.dependencies import CurrentUser
from app.features.im.schemas import (
    ContactListResponse,
    ContactRead,
    DirectMessageListResponse,
    DirectMessageRead,
    DirectMessageSendRequest,
)
from app.features.im.service import (
    list_contacts,
    list_direct_messages,
    send_direct_message,
)

router = APIRouter(tags=["通讯录 + 一对一消息"])


# ---------- 通讯录 ----------


@router.get(
    "/contacts",
    response_model=ContactListResponse,
    summary="列通讯录（排除自己）",
)
def get_contacts(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    keyword: str | None = Query(default=None, max_length=50),
    limit: int = Query(default=100, ge=1, le=500),
) -> ContactListResponse:
    result = list_contacts(db, current_user.id, keyword, limit)
    return ContactListResponse.model_validate(result)


# ---------- IM 消息 ----------


@router.post(
    "/im/send",
    response_model=DirectMessageRead,
    status_code=status.HTTP_201_CREATED,
    summary="发送一对一消息",
)
def post_im_send(
    data: DirectMessageSendRequest,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> DirectMessageRead:
    return DirectMessageRead.model_validate(
        send_direct_message(
            db, current_user.id, data.to_user_id, data.content
        )
    )


@router.get(
    "/im/messages",
    response_model=DirectMessageListResponse,
    summary="列与某人的往来消息（双向升序）",
)
def get_im_messages(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    to: int = Query(..., ge=1, description="对方 user_id"),
    limit: int = Query(default=100, ge=1, le=500),
) -> DirectMessageListResponse:
    result = list_direct_messages(db, current_user.id, to, limit)
    return DirectMessageListResponse.model_validate(result)
