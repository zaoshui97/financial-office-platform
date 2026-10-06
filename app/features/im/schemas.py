"""IM 模块 Pydantic 模型。"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# ---------- 通讯录 ----------


class ContactRead(BaseModel):
    """通讯录条目（基于 users 表）。"""

    id: int
    username: str
    full_name: str | None = None
    email: EmailStr
    department: str | None = None
    position: str | None = None
    phone: str | None = None
    business_line: str | None = None
    is_active: bool


class ContactListResponse(BaseModel):
    """通讯录响应（分页）。"""

    items: list[ContactRead]
    total: int


# ---------- 一对一消息 ----------


class DirectMessageSendRequest(BaseModel):
    """发送一对一消息。"""

    to_user_id: int = Field(ge=1, description="接收人 user_id")
    content: str = Field(min_length=1, max_length=64_000)


class DirectMessageRead(BaseModel):
    """一对一消息只读视图。"""

    id: int
    from_user_id: int
    to_user_id: int
    content: str
    read_at: datetime | None = None
    created_at: datetime


class DirectMessageListResponse(BaseModel):
    """一对一消息列表。"""

    items: list[DirectMessageRead]
    total: int
