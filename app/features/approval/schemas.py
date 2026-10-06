"""审批模块 Pydantic 模型。"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum as _StrEnum

from pydantic import BaseModel, Field


# 透传枚举给 API 层
ApprovalTypeEnum = _StrEnum(
    "ApprovalTypeEnum",
    {"LEAVE": "leave", "REIMBURSE": "reimburse", "SEAL": "seal", "GENERAL": "general"},
)
ApprovalStatusEnum = _StrEnum(
    "ApprovalStatusEnum",
    {
        "DRAFT": "draft",
        "PENDING": "pending",
        "APPROVED": "approved",
        "REJECTED": "rejected",
        "CLOSED": "closed",
    },
)
ApprovalActionTypeEnum = _StrEnum(
    "ApprovalActionTypeEnum",
    {
        "SUBMIT": "submit",
        "APPROVE": "approve",
        "REJECT": "reject",
        "URGE": "urge",
        "COMMENT": "comment",
        "CLOSE": "close",
    },
)


# ---------- 申请 ----------


class ApprovalCreate(BaseModel):
    """创建审批请求。"""

    type: str = Field(
        default="general",
        description="leave/reimburse/seal/general",
    )
    title: str | None = Field(default=None, max_length=200)
    content: str = Field(min_length=1, max_length=64_000)


class ApprovalRead(BaseModel):
    """审批只读视图。"""

    id: int
    user_id: int
    type: str
    title: str | None = None
    content: str
    status: str
    sandbox_passed: bool | None = None
    approved_by: int | None = None
    closed_at: str | None = None
    created_at: datetime
    updated_at: datetime


class ApprovalListResponse(BaseModel):
    """审批列表响应。"""

    items: list[ApprovalRead]
    total: int


# ---------- 操作 ----------


class ApprovalActionRequest(BaseModel):
    """审批操作请求（通过/驳回/催办/评论/关闭）。"""

    action: str = Field(
        description="approve/reject/urge/comment/close",
    )
    comment: str | None = Field(default=None, max_length=1000)


class ApprovalActionRead(BaseModel):
    """审批操作流水视图。"""

    id: int
    approval_id: int
    operator_id: int
    action: str
    comment: str | None = None
    created_at: datetime
