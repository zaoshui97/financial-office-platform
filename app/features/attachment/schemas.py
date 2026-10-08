"""附件模块 Pydantic 视图。"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, model_validator


def _orm_to_dict(obj: Any) -> dict:
    """SQLAlchemy ORM 行 → dict（兼容 None/已有 dict）。"""
    if obj is None:
        return {}
    if isinstance(obj, dict):
        return obj
    return {c.key: getattr(obj, c.key) for c in obj.__table__.columns}


class AttachmentRead(BaseModel):
    id: int
    user_id: int
    original_filename: str
    extension: str
    content_type: str | None = None
    size: int
    business_type: str | None = None
    business_id: int | None = None
    # 24h 临时预览 token（用于 Office Online 等第三方预览服务的免鉴权下载）
    preview_token: str | None = None
    preview_expires_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def _accept_orm(cls, data: Any) -> Any:
        """允许传入 SQLAlchemy ORM 实例或 dict。"""
        return _orm_to_dict(data)

    # 便于前端拼接下载 / 预览 URL
    @property
    def download_url(self) -> str:  # noqa: D401
        return f"/api/v1/attachments/{self.id}/download"


class AttachmentListResponse(BaseModel):
    items: list[AttachmentRead]
    total: int