"""4 Agent Blackboard 业务：会话管理 + 事件读写 + 汇总。"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.features.blackboard.models import (
    AgentRole,
    BlackboardEvent,
    BlackboardSession,
    BlackboardSessionStatus,
)
from app.features.blackboard.schemas import (
    BlackboardEventCreate,
    BlackboardEventListResponse,
    BlackboardEventRead,
    BlackboardSessionCreate,
    BlackboardSessionRead,
    BlackboardSessionSummary,
    RoleSummary,
)

logger = get_logger(__name__)


def _new_session_id() -> str:
    """生成 session_id（去掉横线的 UUID，32 字符）。"""
    return uuid.uuid4().hex


def _get_owned_session(
    db: Session, session_id: str, owner_id: int
) -> BlackboardSession:
    """获取当前用户拥有的 session，未找到 404。"""
    session = db.scalar(
        select(BlackboardSession).where(
            BlackboardSession.session_id == session_id,
            BlackboardSession.owner_id == owner_id,
        )
    )
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="blackboard session 不存在或不属于当前用户",
        )
    return session


def create_session(
    db: Session,
    owner_id: int,
    data: BlackboardSessionCreate,
) -> BlackboardSessionRead:
    """创建一次新的多 Agent 协作 session。"""
    session = BlackboardSession(
        owner_id=owner_id,
        session_id=_new_session_id(),
        title=data.title,
        status=BlackboardSessionStatus.OPEN.value,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    logger.info(
        "blackboard session 创建 | session_id=%s owner_id=%s",
        session.session_id,
        owner_id,
    )
    return BlackboardSessionRead(
        session_id=session.session_id,
        title=session.title,
        status=BlackboardSessionStatus(session.status),
        created_at=session.created_at,
        closed_at=session.closed_at,
    )


def list_open_sessions(
    db: Session,
    owner_id: int,
) -> list[BlackboardSessionRead]:
    """列出当前用户当前打开的 session。"""
    rows = list(
        db.scalars(
            select(BlackboardSession)
            .where(
                BlackboardSession.owner_id == owner_id,
                BlackboardSession.status == BlackboardSessionStatus.OPEN.value,
            )
            .order_by(BlackboardSession.id.desc())
        ).all()
    )
    return [
        BlackboardSessionRead(
            session_id=row.session_id,
            title=row.title,
            status=BlackboardSessionStatus(row.status),
            created_at=row.created_at,
            closed_at=row.closed_at,
        )
        for row in rows
    ]


def close_session(
    db: Session, session_id: str, owner_id: int
) -> BlackboardSessionRead:
    """手动关闭 session（仅本人 / 仅 OPEN）。"""
    session = _get_owned_session(db, session_id, owner_id)
    if session.status == BlackboardSessionStatus.CLOSED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="session 已处于关闭状态",
        )
    session.status = BlackboardSessionStatus.CLOSED.value
    session.closed_at = datetime.now(tz=timezone.utc).replace(tzinfo=None).isoformat()
    db.commit()
    db.refresh(session)
    return BlackboardSessionRead(
        session_id=session.session_id,
        title=session.title,
        status=BlackboardSessionStatus(session.status),
        created_at=session.created_at,
        closed_at=session.closed_at,
    )


def write_event(
    db: Session,
    owner_id: int,
    data: BlackboardEventCreate,
) -> BlackboardEventRead:
    """Agent 写入一条事件。session 必须存在、归属当前用户、且处于 OPEN 状态。"""
    session = _get_owned_session(db, data.session_id, owner_id)
    if session.status != BlackboardSessionStatus.OPEN.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="session 已关闭，无法写入事件",
        )
    event = BlackboardEvent(
        owner_id=owner_id,
        session_id=data.session_id,
        agent_role=data.agent_role.value,
        event_type=data.event_type,
        payload=data.payload,
        parent_event_id=data.parent_event_id,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return BlackboardEventRead(
        id=event.id,
        session_id=event.session_id,
        agent_role=AgentRole(event.agent_role),
        event_type=event.event_type,
        payload=event.payload,
        parent_event_id=event.parent_event_id,
        created_at=event.created_at,
    )


def list_events(
    db: Session,
    owner_id: int,
    session_id: str,
    since_id: int | None = None,
    limit: int = 100,
) -> BlackboardEventListResponse:
    """分页拉取事件，since_id 用于前端轮询增量。"""
    _get_owned_session(db, session_id, owner_id)  # 权限校验
    stmt = select(BlackboardEvent).where(
        BlackboardEvent.owner_id == owner_id,
        BlackboardEvent.session_id == session_id,
    )
    if since_id is not None:
        stmt = stmt.where(BlackboardEvent.id > since_id)
    stmt = stmt.order_by(BlackboardEvent.id.asc()).limit(limit)
    rows = list(db.scalars(stmt).all())
    count_stmt = select(func.count()).select_from(BlackboardEvent).where(
        BlackboardEvent.owner_id == owner_id,
        BlackboardEvent.session_id == session_id,
    )
    total = int(db.scalar(count_stmt) or 0)
    items = [
        BlackboardEventRead(
            id=row.id,
            session_id=row.session_id,
            agent_role=AgentRole(row.agent_role),
            event_type=row.event_type,
            payload=row.payload,
            parent_event_id=row.parent_event_id,
            created_at=row.created_at,
        )
        for row in rows
    ]
    next_since_id = rows[-1].id if rows else since_id
    return BlackboardEventListResponse(
        items=items, total=total, next_since_id=next_since_id
    )


def summarize_session(
    db: Session,
    owner_id: int,
    session_id: str,
) -> BlackboardSessionSummary:
    """汇总 session：4 角色最新事件 + 错误总数。"""
    session = _get_owned_session(db, session_id, owner_id)
    # SQLite + MySQL 都用：先拉出 (role, payload) 两字段，Python 端做 error 计数。
    rows = list(
        db.scalars(
            select(BlackboardEvent)
            .where(
                BlackboardEvent.owner_id == owner_id,
                BlackboardEvent.session_id == session_id,
            )
            .order_by(BlackboardEvent.id.asc())
        ).all()
    )
    roles_summary: list[RoleSummary] = []
    total_errors = 0
    total_events = 0
    for role in AgentRole:
        role_rows = [r for r in rows if r.agent_role == role.value]
        latest = role_rows[-1] if role_rows else None
        err_count = sum(
            1 for r in role_rows if bool(r.payload.get("error")) is True
        )
        total_errors += err_count
        total_events += len(role_rows)
        roles_summary.append(
            RoleSummary(
                agent_role=role,
                latest_event_id=latest.id if latest else None,
                latest_event_type=latest.event_type if latest else None,
                latest_payload=latest.payload if latest else None,
                event_count=len(role_rows),
                error_count=err_count,
            )
        )
    return BlackboardSessionSummary(
        session_id=session.session_id,
        title=session.title,
        status=BlackboardSessionStatus(session.status),
        total_events=total_events,
        total_errors=total_errors,
        roles=roles_summary,
    )