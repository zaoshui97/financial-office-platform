"""合规沙箱路由：聊天、审计查询、Kill Switch。"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.features.auth.dependencies import CurrentUser
from app.features.compliance.check_service import execute_sandbox_check
from app.features.compliance.models import ComplianceAuditLog
from app.features.compliance.schemas import (
    AuditLogListResponse,
    AuditLogRead,
    KillSwitchRequest,
    KillSwitchResponse,
    SandboxChatRequest,
    SandboxChatResponse,
    SandboxCheckRequest,
    SandboxCheckResponse,
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


@router.post(
    "/check",
    response_model=SandboxCheckResponse,
    summary="合规沙箱结构化审查（4 层防御 + 词库 + 脱敏 + 审计）",
)
def sandbox_check(
    data: SandboxCheckRequest,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> SandboxCheckResponse:
    """结构化审查输入文本，返回 9 大类风险清单 + 评分 + 法规引用 + 审计 ID。

    不调 LLM 生成回答，纯粹基于守卫 4 层防御 + 内置规则库 + PII 脱敏 + 审计。
    供前端 SandboxRunner 调用，替代前端本地 mock 引擎。
    """
    return execute_sandbox_check(db, current_user.id, data)


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
    """返回当前合规沙箱熔断开关状态。"""
    from app.sandbox.kill_switch import kill_switch

    return KillSwitchResponse(
        enabled=kill_switch.is_active(),
        updated_by=None,
        updated_at=None,
        reason=kill_switch.reason,
    )


@router.post(
    "/kill-switch",
    response_model=KillSwitchResponse,
    summary="开启 Kill Switch（熔断）",
    status_code=status.HTTP_200_OK,
)
def activate_kill_switch(
    data: KillSwitchRequest,
    current_user: CurrentUser,
) -> KillSwitchResponse:
    """运行时开启沙箱熔断（超级管理员）；标记文件 .sandbox_killed 持久化。"""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="仅超级管理员可操作 Kill Switch",
        )
    if data.enabled:
        from app.sandbox.kill_switch import kill_switch

        kill_switch.activate(reason=data.reason or "admin_api")
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="关闭 Kill Switch 请使用 POST /kill-switch/resume",
        )
    from datetime import datetime, timezone

    return KillSwitchResponse(
        enabled=True,
        updated_by=data.operator,
        updated_at=datetime.now(tz=timezone.utc).replace(tzinfo=None),
        reason=data.reason,
    )


@router.post(
    "/kill-switch/resume",
    response_model=KillSwitchResponse,
    summary="关闭 Kill Switch（恢复）",
    status_code=status.HTTP_200_OK,
)
def deactivate_kill_switch(
    current_user: CurrentUser,
) -> KillSwitchResponse:
    """关闭沙箱熔断（超级管理员）；删除 .sandbox_killed 标记文件。"""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="仅超级管理员可操作 Kill Switch",
        )
    from app.sandbox.kill_switch import kill_switch

    kill_switch.deactivate()
    from datetime import datetime, timezone

    return KillSwitchResponse(
        enabled=False,
        updated_by=None,
        updated_at=datetime.now(tz=timezone.utc).replace(tzinfo=None),
        reason=None,
    )