"""IM 业务：通讯录 + 一对一消息。"""

from __future__ import annotations

from sqlalchemy import asc, desc, func, or_, select
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.features.auth.models import User
from app.features.im.models import DirectMessage

logger = get_logger(__name__)


# ---------- 通讯录 ----------


def list_contacts(
    db: Session,
    current_user_id: int,
    keyword: str | None = None,
    limit: int = 100,
) -> dict:
    """列所有 active 用户（排除自己），可选按 username/full_name 模糊匹配。"""
    stmt = select(User).where(
        User.is_active.is_(True),
        User.id != current_user_id,
    )
    if keyword:
        kw = f"%{keyword.strip()}%"
        stmt = stmt.where(
            or_(
                User.username.like(kw),
                User.full_name.like(kw),
                User.email.like(kw),
            )
        )
    stmt = stmt.order_by(User.id.asc()).limit(limit)
    rows = list(db.scalars(stmt).all())
    total = int(
        db.scalar(
            select(func.count())
            .select_from(User)
            .where(User.is_active.is_(True), User.id != current_user_id)
        )
        or 0
    )
    return {
        "items": [
            {
                "id": u.id,
                "username": u.username,
                "full_name": u.full_name,
                "email": u.email,
                "department": u.department,
                "position": u.position,
                "phone": u.phone,
                "business_line": u.business_line,
                "is_active": u.is_active,
            }
            for u in rows
        ],
        "total": total,
    }


# ---------- 消息 ----------


def send_direct_message(
    db: Session,
    from_user_id: int,
    to_user_id: int,
    content: str,
) -> dict:
    """发一对一消息：校验接收人存在 + 落库。"""
    from fastapi import HTTPException, status as http_status

    if from_user_id == to_user_id:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="不能给自己发消息",
        )
    target = db.scalar(select(User).where(User.id == to_user_id, User.is_active.is_(True)))
    if target is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="接收人不存在或已禁用",
        )
    msg = DirectMessage(
        from_user_id=from_user_id,
        to_user_id=to_user_id,
        content=content,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    logger.info(
        "im 消息 | from=%s to=%s id=%s len=%s",
        from_user_id, to_user_id, msg.id, len(content),
    )
    return {
        "id": msg.id,
        "from_user_id": msg.from_user_id,
        "to_user_id": msg.to_user_id,
        "content": msg.content,
        "read_at": msg.read_at,
        "created_at": msg.created_at,
    }


def list_direct_messages(
    db: Session,
    current_user_id: int,
    peer_user_id: int,
    limit: int = 100,
) -> dict:
    """列与某人的往来消息（双向，时间升序）。"""
    msgs = list(
        db.scalars(
            select(DirectMessage)
            .where(
                or_(
                    (DirectMessage.from_user_id == current_user_id)
                    & (DirectMessage.to_user_id == peer_user_id),
                    (DirectMessage.from_user_id == peer_user_id)
                    & (DirectMessage.to_user_id == current_user_id),
                )
            )
            .order_by(asc(DirectMessage.id))
            .limit(limit)
        ).all()
    )
    return {
        "items": [
            {
                "id": m.id,
                "from_user_id": m.from_user_id,
                "to_user_id": m.to_user_id,
                "content": m.content,
                "read_at": m.read_at,
                "created_at": m.created_at,
            }
            for m in msgs
        ],
        "total": len(msgs),
    }
