"""会议业务编排：会议生命周期 + 黑板读 + Agent 触发。

依赖：
  - BlackboardService：乐观锁黑板
  - 4 Agent (moderator/noter/decision/dispatcher)：BaseAgent.run()

设计：
  - 会议元数据 topic/agenda/current_phase 存在 MeetingSession 表
  - 黑板只放 4 Agent 运行时状态（不存会议级元数据）
  - moderator 跑完会写新 phase 回 MeetingSession.current_phase
  - 触发 Agent 时框架自动注入 session_id + blackboard_snapshot
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.features.agent.agents import AGENT_REGISTRY, get_agent
from app.features.agent.models import MeetingSession, MeetingStatus
from app.features.meeting.schemas import (
    ActionApprovalDraft,
    ActionApprovalRequest,
    AgentTriggerResponse,
    BlackboardEventItem,
    BlackboardEventListResponse,
    BlackboardReadResponse,
    BlackboardSnapshot,
    DispatchResponse,
    MeetingActionRead,
    MeetingCreate,
    MeetingListResponse,
    MeetingRead,
    MeetingPhase,
    MeetingReportResponse,
)
from app.features.meeting.ws import get_blackboard_service as _get_shared_blackboard
from app.features.agent.models import (
    ActionStatus,
    MeetingAction,
)

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


def _normalize_phase(raw: str | None) -> MeetingPhase | None:
    """从 moderator state 抽出合法 phase；非法值忽略。"""
    if not raw:
        return None
    try:
        return MeetingPhase(raw)
    except ValueError:
        return None


def _to_read(meeting: MeetingSession) -> MeetingRead:
    """DB 行 → API 出参。topic/agenda/phase 直接读表。"""
    from fastapi import HTTPException, status

    if meeting.status not in {s.value for s in MeetingStatus}:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"会议 status 异常: {meeting.status}",
        )
    return MeetingRead(
        id=meeting.id,
        title=meeting.title,
        host_user_id=meeting.host_user_id,
        status=MeetingStatus(meeting.status),
        created_at=meeting.created_at,
        updated_at=meeting.updated_at,
        topic=meeting.topic,
        agenda=meeting.agenda,
        current_phase=_normalize_phase(meeting.current_phase),
    )


def _sync_phase_from_state(
    db: Session, meeting: MeetingSession, new_state: dict
) -> None:
    """Agent 跑完从新 state 抽取 phase 写回 MeetingSession。

    仅在新 state 含合法 phase 时更新；不抛错（不阻塞 Agent 调用结果返回）。
    """
    raw = new_state.get("action") or new_state.get("phase")
    phase = _normalize_phase(raw)
    if phase is None:
        return
    if meeting.current_phase == phase.value:
        return
    meeting.current_phase = phase.value
    db.commit()
    db.refresh(meeting)
    logger.info(
        "meeting phase 同步 | meeting_id=%s phase=%s", meeting.id, phase.value,
    )


# ---------- 会议生命周期 ----------

def create_meeting(
    db: Session,
    owner_id: int,
    data: MeetingCreate,
) -> MeetingRead:
    """创建会议 → 自动激活 → 写入 topic/agenda/current_phase='open'。"""
    meeting = MeetingSession(
        title=data.title,
        host_user_id=owner_id,
        status=MeetingStatus.ACTIVE.value,
        topic=data.topic,
        agenda=data.agenda,
        current_phase=MeetingPhase.OPEN.value,
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    logger.info(
        "meeting 创建 | meeting_id=%s owner_id=%s title=%s",
        meeting.id, owner_id, data.title,
    )
    return _to_read(meeting)


def list_meetings(
    db: Session,
    owner_id: int,
    status_filter: MeetingStatus | None = None,
    limit: int = 50,
) -> MeetingListResponse:
    """列出当前用户相关的会议（我主持的 + 我作为参会人加入的），按 id desc。

    多用户联机场景下：teammate 通过邀请码加入会议后，
    列表页（/meetings）要能看到这些会议，否则队友登录进来一片空白。
    """
    from app.features.meeting.models import MeetingParticipant

    # 我作为参会人加入的会议 id 集合
    participant_meeting_ids = list(db.scalars(
        select(MeetingParticipant.meeting_id).where(
            MeetingParticipant.user_id == owner_id
        )
    ).all())

    stmt = select(MeetingSession).where(
        (MeetingSession.host_user_id == owner_id)
        | (MeetingSession.id.in_(participant_meeting_ids) if participant_meeting_ids else False)
    )
    if status_filter is not None:
        stmt = stmt.where(MeetingSession.status == status_filter.value)
    stmt = stmt.order_by(MeetingSession.id.desc()).limit(limit)

    rows = list(db.scalars(stmt).all())
    total = int(
        db.scalar(
            select(func.count())
            .select_from(MeetingSession)
            .where(
                (MeetingSession.host_user_id == owner_id)
                | (MeetingSession.id.in_(participant_meeting_ids) if participant_meeting_ids else False)
            )
        )
        or 0
    )
    return MeetingListResponse(
        items=[_to_read(m) for m in rows],
        total=total,
    )


def get_meeting(
    db: Session,
    meeting_id: int,
    owner_id: int,
) -> MeetingRead:
    """会议详情。"""
    meeting = _get_owned_meeting(db, meeting_id, owner_id)
    return _to_read(meeting)


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
    meeting.current_phase = MeetingPhase.CLOSED.value
    db.commit()
    db.refresh(meeting)
    logger.info("meeting 关闭 | meeting_id=%s", meeting.id)
    return _to_read(meeting)


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


def list_blackboard_events(
    db: Session,
    meeting_id: int,
    owner_id: int,
    since_event_id: int = 0,
    limit: int = 200,
) -> BlackboardEventListResponse:
    """拉取 id > since_event_id 的事件流（升序），供前端重连增量同步。

    limit 默认 200（防止一次拉太多），最大 500。
    返回 has_more=True 表示有下一页。
    """
    from fastapi import HTTPException, status

    _get_owned_meeting(db, meeting_id, owner_id)
    if since_event_id < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="since_event_id 不能为负",
        )
    if limit < 1 or limit > 500:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="limit 必须在 1-500",
        )
    svc = _get_shared_blackboard()
    raw_events = svc.list_events(meeting_id, since_event_id, limit)
    has_more = len(raw_events) == limit
    return BlackboardEventListResponse(
        session_id=meeting_id,
        since_event_id=since_event_id,
        events=[BlackboardEventItem(**e) for e in raw_events],
        has_more=has_more,
    )


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
      2. 注入 session_id + blackboard_snapshot + 会议元数据到 context
      3. Agent.run() 内部完成：build_prompt → llm_gateway → write blackboard
      4. 抽取新 state 中的 phase 同步回 MeetingSession.current_phase
      5. 返回新 state（含 new_version）
    """
    from fastapi import HTTPException, status

    meeting = _get_owned_meeting(db, meeting_id, owner_id)

    if agent_role not in AGENT_REGISTRY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"未知 agent_role: {agent_role} | 已知: {list(AGENT_REGISTRY.keys())}",
        )

    svc = _get_shared_blackboard()
    # 注入运行时上下文：会议元数据 + 黑板快照
    full_context = {
        **context,
        "session_id": meeting_id,
        "blackboard_snapshot": svc.read_all(meeting_id),
        "topic": meeting.topic,
        "agenda": meeting.agenda,
        "phase": meeting.current_phase or MeetingPhase.OPEN.value,
    }

    agent = get_agent(agent_role)
    new_state = agent.run(full_context, svc)

    if "version" not in new_state:
        # Agent 异常路径返回 {error, status: failed}，version 缺失
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Agent {agent_role} 执行失败: {new_state.get('error', 'unknown')}",
        )

    # 同步 phase 回表（不抛错）
    _sync_phase_from_state(db, meeting, new_state)

    return AgentTriggerResponse(
        session_id=meeting_id,
        agent_role=agent_role,
        new_version=int(new_state["version"]),
        state=new_state,
    )


# ---------- 会后报告 + 派单 + 转审批 ----------


def _to_action_read(action: MeetingAction) -> MeetingActionRead:
    """DB 行 → API 出参。"""
    return MeetingActionRead(
        id=action.id,
        meeting_id=action.meeting_id,
        title=action.title,
        description=action.description,
        owner_user_id=action.owner_user_id,
        owner_role=action.owner_role,
        priority=action.priority,
        status=action.status,
        source_decision=action.source_decision,
        estimate_hours=action.estimate_hours,
        deadline=action.deadline,
        approval_id=action.approval_id,
        created_at=action.created_at,
        updated_at=action.updated_at,
    )


def generate_meeting_report(
    db: Session,
    meeting_id: int,
    owner_id: int,
) -> MeetingReportResponse:
    """汇总 4 Agent 黑板最新 state，生成结构化报告。"""
    meeting = _get_owned_meeting(db, meeting_id, owner_id)
    svc = _get_shared_blackboard()
    all_states = svc.read_all(meeting_id)
    return MeetingReportResponse(
        session_id=meeting_id,
        title=meeting.title,
        topic=meeting.topic,
        agenda=meeting.agenda,
        current_phase=meeting.current_phase,
        status=meeting.status,
        moderator=all_states.get("moderator", {}),
        noter=all_states.get("noter", {}),
        decision=all_states.get("decision", {}),
        dispatcher=all_states.get("dispatcher", {}),
        generated_at=datetime.now(timezone.utc).replace(tzinfo=None).isoformat(
            timespec="seconds"
        ),
    )


def dispatch_actions(
    db: Session,
    meeting_id: int,
    owner_id: int,
) -> DispatchResponse:
    """从 dispatcher 黑板抽 tickets，写入 meeting_action。

    去重策略：按 source_decision 字符串去重，相同决策的工单跳过（避免重跑覆盖）。
    失败容错：dispatcher 黑板缺失/格式异常 → 返回 0 + 空 actions，不抛错。
    """
    meeting = _get_owned_meeting(db, meeting_id, owner_id)
    svc = _get_shared_blackboard()
    all_states = svc.read_all(meeting_id)
    dispatcher_state = all_states.get("dispatcher", {}) or {}
    tickets = dispatcher_state.get("tickets") or []

    if not isinstance(tickets, list):
        logger.warning(
            "dispatch tickets 格式异常 | meeting_id=%s type=%s",
            meeting_id, type(tickets).__name__,
        )
        tickets = []

    # 已存在 source_decision → 跳过
    existing_rows = list(
        db.scalars(
            select(MeetingAction).where(
                MeetingAction.meeting_id == meeting_id,
                MeetingAction.source_decision.is_not(None),
            )
        ).all()
    )
    seen_sources: set[str] = {row.source_decision for row in existing_rows if row.source_decision}

    new_actions: list[MeetingAction] = []
    skipped = 0
    for ticket in tickets:
        if not isinstance(ticket, dict):
            skipped += 1
            continue
        source = str(ticket.get("source_decision") or ticket.get("title") or "")
        if source and source in seen_sources:
            skipped += 1
            continue
        action = MeetingAction(
            meeting_id=meeting_id,
            title=str(ticket.get("title") or "未命名工单")[:200],
            description=ticket.get("description"),
            owner_role=ticket.get("owner"),
            priority=str(ticket.get("priority") or "P2")[:8],
            status=ActionStatus.PENDING.value,
            source_decision=source or None,
            estimate_hours=ticket.get("estimate_hours"),
            deadline=str(ticket.get("deadline")) if ticket.get("deadline") else None,
        )
        db.add(action)
        if source:
            seen_sources.add(source)
        new_actions.append(action)

    if new_actions:
        db.commit()
        for action in new_actions:
            db.refresh(action)

    logger.info(
        "meeting 派单 | meeting_id=%s extracted=%s skipped=%s",
        meeting_id, len(new_actions), skipped,
    )
    return DispatchResponse(
        session_id=meeting_id,
        extracted=len(new_actions),
        skipped_duplicates=skipped,
        actions=[_to_action_read(a) for a in new_actions],
    )


def action_to_approval(
    db: Session,
    meeting_id: int,
    action_id: int,
    owner_id: int,
    payload: ActionApprovalRequest,
) -> ActionApprovalDraft:
    """工单 → 审批草稿（写 approval 表，status=draft，写回 action.approval_id）。

    不直接走 approval 业务流（避免 service 间循环 import）。
    这里做的是"草稿"：写入 approval 表的 status=draft 行，approval 模块后续
    可被独立调用 submit 走沙箱 + 审批。
    """
    from fastapi import HTTPException, status as http_status

    meeting = _get_owned_meeting(db, meeting_id, owner_id)
    action = db.scalar(
        select(MeetingAction).where(
            MeetingAction.id == action_id,
            MeetingAction.meeting_id == meeting_id,
        )
    )
    if action is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="工单不存在或不属于该会议",
        )
    if action.approval_id is not None:
        # 幂等：已经生成过草稿 → 直接返回
        return ActionApprovalDraft(
            action_id=action.id,
            approval_id=action.approval_id,
            approval_type=payload.approval_type,
            content_preview=(
                f"[{meeting.title}] {action.title}（已生成审批草稿）"
            )[:200],
        )

    # 内联写 approval 行（避免循环 import approval.service）
    from app.features.approval.models import Approval, ApprovalStatus

    content_lines = [
        f"来源会议：{meeting.title}（ID={meeting.id}）",
        f"工单标题：{action.title}",
        f"工单描述：{action.description or '（无）'}",
        f"负责人角色：{action.owner_role or '未指定'}",
        f"优先级：{action.priority}",
        f"预估工时：{action.estimate_hours or 0} 小时",
        f"截止：{action.deadline or '未指定'}",
    ]
    if payload.note:
        content_lines.append(f"附加备注：{payload.note}")
    content = "\n".join(content_lines)

    approval = Approval(
        user_id=owner_id,
        type=payload.approval_type,
        content=content,
        status=ApprovalStatus.DRAFT.value,
    )
    db.add(approval)
    db.flush()
    action.approval_id = approval.id
    db.commit()
    db.refresh(approval)
    logger.info(
        "action → approval 草稿 | action_id=%s approval_id=%s type=%s",
        action.id, approval.id, payload.approval_type,
    )
    return ActionApprovalDraft(
        action_id=action.id,
        approval_id=approval.id,
        approval_type=approval.type,
        content_preview=content[:200],
    )