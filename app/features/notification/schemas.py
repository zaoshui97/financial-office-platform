"""通知模块 Pydantic 模型。"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


NotifyChannelEnum = Literal["dingtalk", "email", "inapp"]
NotifyStatusEnum = Literal["sent", "skipped", "failed"]


class NotificationSendRequest(BaseModel):
    """发送通知请求（内部接口，不强制鉴权要求 sender）。"""

    user_id: int = Field(description="接收人 user_id")
    biz_type: str = Field(
        default="general",
        max_length=32,
        description="业务类型：approval/meeting/dispatch/general",
    )
    biz_id: int | None = Field(default=None, ge=1)
    channel: NotifyChannelEnum = Field(default="dingtalk")
    content: str = Field(min_length=1, max_length=2000)


class NotificationRecordRead(BaseModel):
    """通知记录只读视图。"""

    id: int
    user_id: int
    biz_type: str
    biz_id: int | None = None
    channel: str
    status: str
    content: str
    error_message: str | None = None
    sent_at: str | None = None
    created_at: datetime
    updated_at: datetime


class NotificationListResponse(BaseModel):
    """通知列表响应。"""

    items: list[NotificationRecordRead]
    total: int
