"""审批模块业务：CRUD + 状态流转 + 沙箱检测钩子 + 操作流水。

沙箱检测在 submit 时由 service 调用，失败 → 仍可提交（status=pending），
仅 sandbox_passed=False 标记，由审批人 review。
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.features.approval.models import (
    Approval,
    ApprovalAction,
    ApprovalActionType,
    ApprovalStatus,
    ApprovalType,
)

logger = get_logger(__name__)


# ---------- 工具 ----------


_ALLOWED_TYPES: set[str] = {t.value for t in ApprovalType}
_ALLOWED_STATUS: set[str] = {s.value for s in ApprovalStatus}
_ALLOWED_ACTIONS: set[str] = {a.value for a in ApprovalActionType}


def _normalize_type(raw: str | None) -> str:
    """归一化 type，未知值降级为 general。"""
    raw = (raw or "general").strip().lower()
    return raw if raw in _ALLOWED_TYPES else ApprovalType.GENERAL.value


def _to_read(a: Approval) -> dict:
    """DB 行 → 出参 dict（不直接返回 SQLAlchemy 行给上层）。"""
    return {
        "id": a.id,
        "user_id": a.user_id,
        "type": a.type,
        "title": a.title,
        "content": a.content,
        "status": a.status,
        "sandbox_passed": a.sandbox_passed,
        "approved_by": a.approved_by,
        "closed_at": a.closed_at,
        "created_at": a.created_at,
        "updated_at": a.updated_at,
    }


def _to_action_read(act: ApprovalAction) -> dict:
    return {
        "id": act.id,
        "approval_id": act.approval_id,
        "operator_id": act.operator_id,
        "action": act.action,
        "comment": act.comment,
        "created_at": act.created_at,
    }


def _run_sandbox_check(content: str) -> bool:
    """调沙箱检测：未启用则放行（True）。

    接入 sandbox.service.sandbox_check_text 时改成：
        from app.sandbox.service import sandbox_check_text
        result = sandbox_check_text(content)
        return bool(result.get("passed"))
    当前未启用 → 直接放行，不抛错。
    """
    return True


# ---------- 申请 CRUD ----------


def create_approval(
    db: Session,
    user_id: int,
    data: dict,
    auto_submit: bool = True,
) -> dict:
    """创建审批。auto_submit=True 时立即 submit 并跑沙箱。"""
    title = (data.get("title") or "").strip() or None
    if not title and data.get("content"):
        first_line = data["content"].splitlines()[0][:200]
        title = first_line or None
    approval = Approval(
        user_id=user_id,
        type=_normalize_type(data.get("type")),
        title=title,
        content=data["content"],
        status=ApprovalStatus.DRAFT.value,
    )
    db.add(approval)
    db.flush()

    if auto_submit:
        # 立即提交 + 沙箱检测
        sandbox_passed = _run_sandbox_check(approval.content)
        approval.sandbox_passed = sandbox_passed
        approval.status = ApprovalStatus.PENDING.value
        action = ApprovalAction(
            approval_id=approval.id,
            operator_id=user_id,
            action=ApprovalActionType.SUBMIT.value,
            comment="创建并提交" if sandbox_passed else "创建并提交（沙箱未通过）",
        )
        db.add(action)

    db.commit()
    db.refresh(approval)
    logger.info(
        "approval 创建 | id=%s user_id=%s type=%s status=%s",
        approval.id, user_id, approval.type, approval.status,
    )
    return _to_read(approval)


def list_approvals(
    db: Session,
    user_id: int,
    status_filter: str | None = None,
    limit: int = 50,
) -> dict:
    """列我的审批（按 user_id 隔离）。"""
    stmt = select(Approval).where(Approval.user_id == user_id)
    if status_filter:
        normalized = status_filter.strip().lower()
        if normalized in _ALLOWED_STATUS:
            stmt = stmt.where(Approval.status == normalized)
    stmt = stmt.order_by(Approval.id.desc()).limit(limit)
    rows = list(db.scalars(stmt).all())
    total = int(
        db.scalar(
            select(func.count())
            .select_from(Approval)
            .where(Approval.user_id == user_id)
        )
        or 0
    )
    return {
        "items": [_to_read(r) for r in rows],
        "total": total,
    }


def get_approval(
    db: Session,
    approval_id: int,
    user_id: int,
) -> dict:
    """审批详情（仅本人可见，404 处理）。"""
    from fastapi import HTTPException, status as http_status
    row = db.scalar(
        select(Approval).where(
            Approval.id == approval_id,
            Approval.user_id == user_id,
        )
    )
    if row is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="审批不存在或不属于当前用户",
        )
    return _to_read(row)


def list_approval_actions(
    db: Session,
    approval_id: int,
    user_id: int,
) -> list[dict]:
    """列出审批操作流水（先校验权限）。"""
    get_approval(db, approval_id, user_id)  # 权限校验
    rows = list(
        db.scalars(
            select(ApprovalAction)
            .where(ApprovalAction.approval_id == approval_id)
            .order_by(ApprovalAction.id.asc())
        ).all()
    )
    return [_to_action_read(r) for r in rows]


def act_on_approval(
    db: Session,
    approval_id: int,
    operator_id: int,
    action: str,
    comment: str | None,
) -> dict:
    """对审批做操作（通过/驳回/催办/评论/关闭）。

    权限规则：
      - 申请人本人才可催办/评论/关闭
      - 审批人（approved_by）通过/驳回
      - 简化：当前实现中申请人本人可对自己的审批做全部动作
    """
    from fastapi import HTTPException, status as http_status

    act = (action or "").strip().lower()
    if act not in _ALLOWED_ACTIONS:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"未知 action: {action} | 已知: {sorted(_ALLOWED_ACTIONS)}",
        )
    approval = db.scalar(
        select(Approval).where(Approval.id == approval_id)
    )
    if approval is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="审批不存在",
        )
    if approval.user_id != operator_id and not _is_admin(db, operator_id):
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="无权操作该审批",
        )

    # 状态流转
    now = datetime.now(timezone.utc).replace(tzinfo=None).isoformat(timespec="seconds")
    if act == ApprovalActionType.APPROVE.value:
        approval.status = ApprovalStatus.APPROVED.value
        approval.approved_by = operator_id
        approval.closed_at = now
    elif act == ApprovalActionType.REJECT.value:
        approval.status = ApprovalStatus.REJECTED.value
        approval.approved_by = operator_id
        approval.closed_at = now
    elif act == ApprovalActionType.CLOSE.value:
        approval.status = ApprovalStatus.CLOSED.value
        approval.closed_at = now
    # submit / urge / comment 不改 status

    action_row = ApprovalAction(
        approval_id=approval.id,
        operator_id=operator_id,
        action=act,
        comment=comment,
    )
    db.add(action_row)
    db.commit()
    db.refresh(approval)
    db.refresh(action_row)
    logger.info(
        "approval 操作 | id=%s action=%s operator=%s new_status=%s",
        approval.id, act, operator_id, approval.status,
    )
    return _to_action_read(action_row)


def _is_admin(db: Session, user_id: int) -> bool:
    """简化版：admin 判定 = is_superuser=True。"""
    from app.features.auth.models import User
    user = db.scalar(select(User).where(User.id == user_id))
    return bool(user and user.is_superuser)
