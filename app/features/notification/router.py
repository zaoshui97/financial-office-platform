"""通知模块 REST 路由。"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.features.auth.dependencies import CurrentUser
from app.features.notification.schemas import (
    NotificationListResponse,
    NotificationRecordRead,
    NotificationSendRequest,
)
from app.features.notification.service import (
    list_notifications,
    send_notification,
)

router = APIRouter(prefix="/notifications", tags=["通知推送"])


@router.post(
    "/send",
    response_model=NotificationRecordRead,
    summary="发送通知（内部接口）",
)
def post_send_notification(
    data: NotificationSendRequest,
    db: Annotated[Session, Depends(get_db)],
) -> NotificationRecordRead:
    """鉴权：仅登录用户可发，无强制 owner 校验（内部接口）。

    未来可加白名单（仅 service role 可调）。
    """
    return NotificationRecordRead.model_validate(
        send_notification(
            db,
            data.user_id,
            data.biz_type,
            data.biz_id,
            data.channel,
            data.content,
        )
    )


@router.get(
    "",
    response_model=NotificationListResponse,
    summary="列我的通知记录",
)
def get_notifications(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    limit: int = Query(default=50, ge=1, le=200),
) -> NotificationListResponse:
    return NotificationListResponse.model_validate(
        list_notifications(db, current_user.id, limit)
    )
