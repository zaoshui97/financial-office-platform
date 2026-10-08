"""审批模块业务：CRUD + 状态流转 + 沙箱检测钩子 + 操作流水。

沙箱检测在 submit 时由 service 调用，失败 → 仍可提交（status=pending），
仅 sandbox_passed=False 标记，由审批人 review。
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select, text
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


def _to_read(db: Session, a: Approval) -> dict:
    """DB 行 → 出参 dict（不直接返回 SQLAlchemy 行给上层）。"""
    import json as _json
    ai_review = None
    if a.ai_review:
        try:
            ai_review = _json.loads(a.ai_review)
        except Exception:
            ai_review = None
    # 关联附件 ID（与 list 保持一致）
    att_rows = db.execute(
        text("SELECT id FROM attachments WHERE business_type='approval' AND business_id=:bid"),
        {"bid": a.id},
    ).fetchall()
    return {
        "id": a.id,
        "user_id": a.user_id,
        "type": a.type,
        "title": a.title,
        "content": a.content,
        "status": a.status,
        "sandbox_passed": a.sandbox_passed,
        "ai_review": ai_review,
        "ai_suggestion": a.ai_suggestion,
        "ai_reviewed_at": a.ai_reviewed_at,
        "approved_by": a.approved_by,
        "closed_at": a.closed_at,
        "created_at": a.created_at,
        "updated_at": a.updated_at,
        "attachment_ids": [r[0] for r in att_rows],
    }


def _to_action_read(act: ApprovalAction) -> dict:
    return {
        "id": act.id,
        "approval_id": act.approval_id,
        "operator_id": act.operator_id,
        "action": act.action,
        "comment": act.comment,
        "ai_suggestion": act.ai_suggestion,
        "override_reason": act.override_reason,
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
    """创建审批。auto_submit=True 时立即 submit 并跑沙箱。

    data 可包含 attachment_ids: list[int]，创建后绑定到审批。
    """
    title = (data.get("title") or "").strip() or None
    if not title and data.get("content"):
        first_line = data["content"].splitlines()[0][:200]
        title = first_line or None
    attachment_ids = list(data.get("attachment_ids") or [])
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
    db.flush()
    # 绑定附件（如果有）
    if attachment_ids:
        _link_attachments(db, approval.id, attachment_ids)

    # AI 辅助审批 — 4 维度审查（不阻断流程，仅写建议）
    try:
        from app.features.approval.ai_reviewer import review_approval
        ai_report = review_approval(db, approval, attachment_ids)
        import json as _json
        approval.ai_review = _json.dumps(ai_report, ensure_ascii=False)
        approval.ai_suggestion = ai_report.get("overall", {}).get("suggestion")
        approval.ai_reviewed_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    except Exception as e:
        logger.warning("AI 审查失败（不影响流程）: %s", e)

    db.commit()
    db.refresh(approval)
    logger.info(
        "approval 创建 | id=%s user_id=%s type=%s status=%s attachments=%s",
        approval.id, user_id, approval.type, approval.status, attachment_ids,
    )
    out = _to_read(db, approval)
    out["attachment_ids"] = attachment_ids
    # 通知提交人（Phase 1：in-app；Phase 2 接 dispatcher）
    _notify_approval_submitted(db, out)
    return out


def list_approvals(
    db: Session,
    user_id: int,
    status_filter: str | None = None,
    limit: int = 50,
    scope: str = "mine",
) -> dict:
    """列审批。

    scope:
      - mine     只看自己提交的（任何角色可见）
      - dept     看本部门员工提交的（仅 DEPT_ADMIN/SUPER_ADMIN）
      - all      看全公司（仅 SUPER_ADMIN）

    role 判定（简化版，Phase 1）：
      - SUPER_ADMIN（is_superuser=True）  → 看到 all
      - DEPT_ADMIN（admin_role='DEPT_ADMIN' 或 自定义标记）  → 看到 dept
      - USER         → 只能看 mine
    """
    from fastapi import HTTPException, status as http_status
    from app.features.auth.models import User

    stmt = select(Approval)
    if scope == "all":
        if not _is_admin(db, user_id):
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="需要超级管理员权限查看全部审批",
            )
        # 全员
    elif scope == "dept":
        if not (_is_admin(db, user_id) or _is_dept_admin(db, user_id)):
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="需要部门管理员权限查看本部门审批",
            )
        me = db.scalar(select(User).where(User.id == user_id))
        my_dept = (me.department or "").strip() if me else ""
        if not my_dept:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="您尚未设置部门，无法查看本部门审批",
            )
        # 同部门员工的 id
        subq = select(User.id).where(User.department == my_dept)
        stmt = stmt.where(Approval.user_id.in_(subq))
    else:
        # mine（默认）
        stmt = stmt.where(Approval.user_id == user_id)

    if status_filter:
        normalized = status_filter.strip().lower()
        if normalized in _ALLOWED_STATUS:
            stmt = stmt.where(Approval.status == normalized)
    # 先算 total（复用所有过滤条件，不含 limit/order）
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = int(db.scalar(count_stmt) or 0)
    stmt = stmt.order_by(Approval.id.desc()).limit(limit)
    rows = list(db.scalars(stmt).all())
    # 一次性把 attachment_ids 取出来
    ids = [r["id"] for r in []]
    items_out = []
    if rows:
        from app.features.attachment.models import Attachment
        approval_ids = [a.id for a in rows]
        att_stmt = (
            select(Attachment.id, Attachment.business_id)
            .where(
                Attachment.business_type == "approval",
                Attachment.business_id.in_(approval_ids),
            )
        )
        att_map: dict[int, list[int]] = {}
        for aid, bid in db.execute(att_stmt).all():
            att_map.setdefault(bid, []).append(aid)
        for a in rows:
            d = _to_read(db, a)
            d["attachment_ids"] = att_map.get(a.id, [])
            items_out.append(d)
    return {
        "items": items_out,
        "total": total,
    }


def get_approval(
    db: Session,
    approval_id: int,
    user_id: int,
) -> dict:
    """审批详情。

    权限：
      - 申请人本人 → 必可见
      - 同部门的部门管理员（DEPT_ADMIN）→ 可看本部门员工单据
      - 超级管理员（SUPER_ADMIN）→ 可见全部
    """
    from fastapi import HTTPException, status as http_status
    from app.features.auth.models import User

    row = db.scalar(select(Approval).where(Approval.id == approval_id))
    if row is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="审批不存在",
        )

    # 申请人本人
    if row.user_id == user_id:
        return _to_read(db, row)

    # 超级管理员
    me = db.scalar(select(User).where(User.id == user_id))
    if me and me.is_superuser:
        return _to_read(db, row)

    # 部门管理员 + 同部门
    if me and (me.position or "").strip() == "部门经理":
        applicant = db.scalar(select(User).where(User.id == row.user_id))
        if applicant and (applicant.department or "").strip() == (me.department or "").strip():
            return _to_read(db, row)

    raise HTTPException(
        status_code=http_status.HTTP_404_NOT_FOUND,
        detail="审批不存在或不属于当前用户",
    )


def trigger_ai_review(db: Session, approval_id: int, user_id: int) -> dict:
    """手动触发指定审批单的 AI 审查。

    适用于：创建时未审查 / 提交后内容有变更 / 审批人想重新审查。
    仅 PENDING 状态的工单可重新审查。
    """
    from fastapi import HTTPException, status as http_status
    from app.features.approval.ai_reviewer import review_approval

    approval = db.query(Approval).filter(Approval.id == approval_id).first()
    if not approval:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="审批不存在")
    if approval.status not in (ApprovalStatus.PENDING.value, ApprovalStatus.DRAFT.value):
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="仅待审批 / 草稿状态可重新审查",
        )

    # 拉附件列表
    att_rows = db.execute(
        text(
            "SELECT id FROM attachments WHERE business_type='approval' AND business_id=:bid"
        ),
        {"bid": approval_id},
    ).fetchall()
    attachment_ids = [r[0] for r in att_rows]

    ai_report = review_approval(db, approval, attachment_ids)
    import json as _json
    approval.ai_review = _json.dumps(ai_report, ensure_ascii=False)
    approval.ai_suggestion = ai_report.get("overall", {}).get("suggestion")
    approval.ai_reviewed_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    approval.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(approval)

    return {
        "approval_id": approval_id,
        "ai_review": ai_report,
        "ai_suggestion": approval.ai_suggestion,
        "ai_reviewed_at": approval.ai_reviewed_at,
    }


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
    override_reason: str | None = None,
) -> dict:
    """对审批做操作（通过/驳回/催办/评论/关闭）。

    权限规则（Phase 1）：
      - 申请人本人：可催办 / 评论 / 关闭（自己的申请）
      - 部门管理员：可 approve/reject 本部门员工申请
      - 超级管理员：可 approve/reject 任何申请
      - 申请人自己不能 approve/reject 自己的申请（避免自批自）

    dept_admin 判定见 _is_dept_admin（position 含"主管/经理/总监/主任" 等关键字 或 is_superuser=True）
    """
    from fastapi import HTTPException, status as http_status
    from app.features.auth.models import User

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

    is_owner = approval.user_id == operator_id
    is_super = _is_admin(db, operator_id)
    is_dept_lead = _is_dept_admin(db, operator_id)

    # 越权检查：非申请人 非审批人 一律拒绝
    if not (is_owner or is_super or is_dept_lead):
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="无权操作该审批",
        )

    # approve / reject 必须由非本人的审批人执行
    if act in (
        ApprovalActionType.APPROVE.value,
        ApprovalActionType.REJECT.value,
    ):
        if is_owner:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="申请人不能审批自己的申请，请联系部门管理员或超级管理员",
            )
        if not (is_super or is_dept_lead):
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="需要审批权限（部门管理员或超级管理员）",
            )
        # 部门管理员越界检查：必须同部门
        if is_dept_lead and not is_super:
            me = db.scalar(select(User).where(User.id == operator_id))
            applicant = db.scalar(select(User).where(User.id == approval.user_id))
            me_dept = (me.department or "").strip() if me else ""
            ap_dept = (applicant.department or "").strip() if applicant else ""
            if not me_dept or me_dept != ap_dept:
                raise HTTPException(
                    status_code=http_status.HTTP_403_FORBIDDEN,
                    detail=f"只能审批本部门申请（您：{me_dept or '未设置'}，申请人：{ap_dept or '未设置'}）",
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
        if not is_owner:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="只有申请人本人可以关闭申请",
            )
        approval.status = ApprovalStatus.CLOSED.value
        approval.closed_at = now
    # submit / urge / comment 不改 status

    action_row = ApprovalAction(
        approval_id=approval.id,
        operator_id=operator_id,
        action=act,
        comment=comment,
        ai_suggestion=approval.ai_suggestion,
        override_reason=override_reason,
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


# ---------- 附件关联 ----------

def _link_attachments(db: Session, approval_id: int, attachment_ids: list[int]) -> list[int]:
    """把 attachments 表的若干 id 关联到当前审批（仅当 ownership 匹配时不校验；外部传进来的）。

    通过 attachment.business_type/business_id 反向建立关联。
    这里采用"绑定"语义：直接 update attachments.business_type = 'approval', business_id = approval_id
    """
    from sqlalchemy import update
    from app.features.attachment.models import Attachment
    if not attachment_ids:
        return []
    stmt = (
        update(Attachment)
        .where(Attachment.id.in_(attachment_ids))
        .values(business_type="approval", business_id=approval_id)
    )
    db.execute(stmt)
    return list(attachment_ids)


def list_approval_attachments(db: Session, approval_id: int) -> list[int]:
    """列出审批关联的 attachment_id 列表。"""
    from app.features.attachment.models import Attachment
    rows = db.scalars(
        select(Attachment.id)
        .where(Attachment.business_type == "approval", Attachment.business_id == approval_id)
        .order_by(Attachment.id.asc())
    ).all()
    return list(rows)


# ---------- /me 通知 helper ----------

def _notify_approval_submitted(db: Session, approval: dict) -> None:
    """审批提交后通知（Phase 1 简化版：写入一条 in-app notification；后续接入钉钉/邮件）。

    失败不阻塞主流程。
    """
    try:
        from app.features.notification.service import send_notification
        send_notification(
            db,
            user_id=approval["user_id"],
            biz_type="approval",
            biz_id=approval["id"],
            channel="inapp",
            content=f"审批 #{approval['id']} 已提交：{approval.get('title') or '（无标题）'}，等待审核。",
        )
    except Exception as e:
        logger.warning("通知写入失败（不阻塞主流程）：approval_id=%s err=%s", approval.get("id"), e)


def _is_admin(db: Session, user_id: int) -> bool:
    """超级管理员判定 = is_superuser=True。"""
    from app.features.auth.models import User
    user = db.scalar(select(User).where(User.id == user_id))
    return bool(user and user.is_superuser)


def _is_dept_admin(db: Session, user_id: int) -> bool:
    """部门管理员判定（Phase 1 简化版）：

    判定条件（满足任一）：
      1) is_superuser=True（兼容：超级管理员也是高级部门管理员）
      2) 用户表 department 字段非空 + 当前实现以"首位员工为部门主管"启发式判定
         （更严谨的方案需要 RBAC role 表 + user_roles 关联，Phase 2 接入）

    当前阶段建议：测试账号 admin_role 列在 users 表用 is_superuser=True 标记
    部门管理员（由运营手动 SQL 设置），dept_admin_user_ids 列表维护在配置/常量。
    """
    from app.features.auth.models import User
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        return False
    if user.is_superuser:
        return True
    # 启发式：position 字段包含"主管/经理/总监/主任"视为部门管理员
    pos = (user.position or "").strip()
    keywords = ("主管", "经理", "总监", "主任", "leader", "manager", "director")
    return any(kw in pos.lower() if pos else False for kw in keywords)
