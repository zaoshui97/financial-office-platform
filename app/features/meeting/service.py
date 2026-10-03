"""会议业务编排：会议生命周期 + 黑板读 + Agent 触发。

依赖：
  - BlackboardService：乐观锁黑板
  - 4 Agent (moderator/noter/decision/dispatcher)：BaseAgent.run()

设计：
  - 会议生命周期仅管 status (preparing/active/closed)
  - topic / agenda / phase 一律存在黑板的 moderator.state 里
  - 触发 Agent 时框架自动注入 session_id + blackboard_snapshot
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.features.agent.agents import AGENT_REGISTRY, get_agent
from app.features.agent.blackboard import BlackboardService
from app.features.agent.models import MeetingSession, MeetingStatus
from app.features.meeting.schemas import (
    AgentTriggerResponse,
    BlackboardReadResponse,
    BlackboardSnapshot,
    MeetingCreate,
    MeetingListResponse,
    MeetingRead,
)
from app.features.meeting.ws import get_blackboard_service as _get_shared_blackboard

logger = get_logger(__name__)


# ---------- 工具 ----------

def _get_owned_meeting(
    db: Session, meeting_id: int, owner_id: int
) -> MeetingSession:
    """获取当前用户拥有的会议，未找到 404。"""
    from fastapi import HTTPException, status

    meeting = db.scalar(
        select(MeetingSession).where(
            MeetingSession.id == meeting_id,
            MeetingSession.host_user_id == owner_id,
        )
    )
    if meeting is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="meeting 不存在或不属于当前用户",
        )
    return meeting


def _to_read(
    db: Session,
    meeting: MeetingSession,
) -> MeetingRead:
    """DB 行 → API 出参，附带 moderator 的 phase（如果写过）。"""
    from fastapi import HTTPException, status

    if meeting.status not in {s.value for s in MeetingStatus}:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"会议 status 异常: {meeting.status}",
        )
    # 拿 moderator state 里的 phase / topic / agenda
    svc = _get_shared_blackboard()
    moderator_state = svc.read_one(meeting.id, "moderator")
    topic = moderator_state.get("topic")
    agenda = moderator_state.get("agenda")
    return MeetingRead(
        id=meeting.id,
        title=meeting.title,
        host_user_id=meeting.host_user_id,
        status=MeetingStatus(meeting.status),
        created_at=meeting.created_at,
        updated_at=meeting.updated_at,
        topic=str(topic) if topic is not None else None,
        agenda=str(agenda) if agenda is not None else None,
        current_phase=moderator_state.get("action") or moderator_state.get("phase"),
    )


# ---------- 会议生命周期 ----------

def create_meeting(
    db: Session,
    owner_id: int,
    data: MeetingCreate,
) -> MeetingRead:
    """创建会议 → 自动激活 → 写入 moderator 初始 state（topic/agenda）。"""
    meeting = MeetingSession(
        title=data.title,
        host_user_id=owner_id,
        status=MeetingStatus.ACTIVE.value,  # 创建即激活，简化流程
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    # 初始化 moderator 黑板（含 topic/agenda）
    svc = _get_shared_blackboard()
    initial_state = {
        "agent_role": "moderator",
        "topic": data.topic,
        "agenda": data.agenda,
        "action": "open",
        "version": 1,
    }
    svc.write(meeting.id, "moderator", initial_state)

    logger.info(
        "meeting 创建 | meeting_id=%s owner_id=%s title=%s",
        meeting.id, owner_id, data.title,
    )
    return _to_read(db, meeting)


def list_meetings(
    db: Session,
    owner_id: int,
    status_filter: MeetingStatus | None = None,
    limit: int = 50,
) -> MeetingListResponse:
    """列出当前用户的会议（默认按 id desc）。"""
    stmt = select(MeetingSession).where(
        MeetingSession.host_user_id == owner_id,
    )
    if status_filter is not None:
        stmt = stmt.where(MeetingSession.status == status_filter.value)
    stmt = stmt.order_by(MeetingSession.id.desc()).limit(limit)

    rows = list(db.scalars(stmt).all())
    total = int(
        db.scalar(
            select(func.count())
            .select_from(MeetingSession)
            .where(MeetingSession.host_user_id == owner_id)
        )
        or 0
    )
    return MeetingListResponse(
        items=[_to_read(db, m) for m in rows],
        total=total,
    )


def get_meeting(
    db: Session,
    meeting_id: int,
    owner_id: int,
) -> MeetingRead:
    """会议详情。"""
    meeting = _get_owned_meeting(db, meeting_id, owner_id)
    return _to_read(db, meeting)


def close_meeting(
    db: Session,
    meeting_id: int,
    owner_id: int,
) -> MeetingRead:
    """关闭会议（仅 host / 仅 active）。"""
    from fastapi import HTTPException, status

    meeting = _get_owned_meeting(db, meeting_id, owner_id)
    if meeting.status == MeetingStatus.CLOSED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="会议已处于关闭状态",
        )
    meeting.status = MeetingStatus.CLOSED.value
    db.commit()
    db.refresh(meeting)
    logger.info("meeting 关闭 | meeting_id=%s", meeting.id)
    return _to_read(db, meeting)


# ---------- 黑板 ----------

def read_blackboard(
    db: Session,
    meeting_id: int,
    owner_id: int,
) -> BlackboardReadResponse:
    """读会议黑板全部 Agent 的最新状态。"""
    _get_owned_meeting(db, meeting_id, owner_id)  # 权限校验
    svc = _get_shared_blackboard()
    all_states = svc.read_all(meeting_id)
    # 按角色字母序固定输出顺序
    snapshots = [
        BlackboardSnapshot(
            agent_role=role,
            version=int(state.get("version", 0)),
            state=state,
        )
        for role, state in sorted(all_states.items())
    ]
    return BlackboardReadResponse(session_id=meeting_id, states=snapshots)


def trigger_agent(
    db: Session,
    meeting_id: int,
    owner_id: int,
    agent_role: str,
    context: dict,
) -> AgentTriggerResponse:
    """触发指定 Agent 跑一次，返回写入黑板的新 state。

    流程：
      1. 校验会议存在 + 角色合法
      2. 注入 session_id + blackboard_snapshot 到 context
      3. Agent.run() 内部完成：build_prompt → llm_gateway → write blackboard
      4. 返回新 state（含 new_version）
    """
    from fastapi import HTTPException, status

    _get_owned_meeting(db, meeting_id, owner_id)

    if agent_role not in AGENT_REGISTRY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"未知 agent_role: {agent_role} | 已知: {list(AGENT_REGISTRY.keys())}",
        )

    svc = _get_shared_blackboard()
    # 注入运行时上下文
    full_context = {
        **context,
        "session_id": meeting_id,
        "blackboard_snapshot": svc.read_all(meeting_id),
    }
    # 从 moderator state 兜底补 topic/agenda
    moderator_state = svc.read_one(meeting_id, "moderator")
    for k in ("topic", "agenda"):
        if k not in full_context and moderator_state.get(k) is not None:
            full_context[k] = moderator_state[k]
    full_context.setdefault("phase", moderator_state.get("action", "open"))

    agent = get_agent(agent_role)
    new_state = agent.run(full_context, svc)

    if "version" not in new_state:
        # Agent 异常路径返回 {error, status: failed}，version 缺失
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Agent {agent_role} 执行失败: {new_state.get('error', 'unknown')}",
        )

    return AgentTriggerResponse(
        session_id=meeting_id,
        agent_role=agent_role,
        new_version=int(new_state["version"]),
        state=new_state,
    )