"""合规沙箱路由：聊天、审计查询、Kill Switch。"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.features.auth.dependencies import CurrentUser
from app.features.compliance.models import ComplianceAuditLog
from app.features.compliance.schemas import (
    AuditLogListResponse,
    AuditLogRead,
    KillSwitchRequest,
    KillSwitchResponse,
    SandboxChatRequest,
    SandboxChatResponse,
)
from app.features.compliance.service import execute_sandbox_chat

router = APIRouter(prefix="/compliance/sandbox", tags=["合规沙箱"])


@router.post(
    "/chat",
    response_model=SandboxChatResponse,
    summary="合规沙箱 LLM 聊天",
)
def sandbox_chat(
    data: SandboxChatRequest,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> SandboxChatResponse:
    """在受限 Provider + 脱敏 + 全量审计下进行 LLM 对话。"""
    return execute_sandbox_chat(db, current_user.id, data)


@router.get(
    "/audit",
    response_model=AuditLogListResponse,
    summary="审计日志查询",
)
def list_audit_logs(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    only_blocked: bool = Query(default=False),
) -> AuditLogListResponse:
    """分页查询当前用户的合规审计日志。"""
    base_query = select(ComplianceAuditLog).where(
        ComplianceAuditLog.user_id == current_user.id
    )
    if only_blocked:
        base_query = base_query.where(ComplianceAuditLog.blocked.is_(True))

    items_stmt = (
        base_query.order_by(ComplianceAuditLog.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = list(db.scalars(items_stmt).all())

    count_stmt = select(ComplianceAuditLog.id).where(
        ComplianceAuditLog.user_id == current_user.id
    )
    if only_blocked:
        count_stmt = count_stmt.where(ComplianceAuditLog.blocked.is_(True))
    total = len(list(db.scalars(count_stmt).all()))

    return AuditLogListResponse(
        items=[AuditLogRead.model_validate(item) for item in items],
        total=total,
    )


@router.get(
    "/kill-switch",
    response_model=KillSwitchResponse,
    summary="查看 Kill Switch 状态",
)
def read_kill_switch(
    _current_user: CurrentUser,
) -> KillSwitchResponse:
    """返回当前合规沙箱熔断开关状态（仅登录用户）。"""
    return KillSwitchResponse(
        enabled=settings.SANDBOX_KILL_SWITCH,
        updated_by=None,
        updated_at=None,
        reason=None,
    )


@router.post(
    "/kill-switch",
    response_model=KillSwitchResponse,
    summary="切换 Kill Switch",
    status_code=status.HTTP_200_OK,
)
def toggle_kill_switch(
    data: KillSwitchRequest,
    current_user: CurrentUser,
) -> KillSwitchResponse:
    """运行时切换 SANDBOX_KILL_SWITCH，仅超级管理员可操作；进程重启后回到 .env 默认。"""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="仅超级管理员可切换 Kill Switch",
        )
    if settings.SANDBOX_DEGRADATION_POLICY == "off" and data.enabled:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="SANDBOX_DEGRADATION_POLICY=off 时无法启用沙箱",
        )
    settings.SANDBOX_KILL_SWITCH = data.enabled
    from datetime import datetime, timezone

    return KillSwitchResponse(
        enabled=data.enabled,
        updated_by=data.operator,
        updated_at=datetime.now(tz=timezone.utc).replace(tzinfo=None),
        reason=data.reason,
    )