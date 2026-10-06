"""Dashboard 聚合查询：4 统计卡片 + 7 日折线。

策略：
  - 全部 SQL 聚合，单次请求内串行查多张表（行数小，无需并行）
  - week_buckets 用 SQL DATE() 分组（MySQL 走 date()，SQLite 也兼容）
  - 7 日按日期升序返回，缺日补 0（前端直接出图）
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import Date, and_, cast, func, select
from sqlalchemy.orm import Session

from app.core.logging import get_logger

logger = get_logger(__name__)


def _seven_day_window() -> tuple[datetime, list[str]]:
    """返回 7 日窗口起点 + 7 个日期字符串（升序）。"""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    start = now - timedelta(days=6)  # 含今日 = 7 天
    start = start.replace(hour=0, minute=0, second=0, microsecond=0)
    days = [
        (start + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)
    ]
    return start, days


def compute_dashboard_stats(
    db: Session,
    user_id: int,
) -> dict:
    """聚合 4 卡片 + 7 日折线 + 1 个待审批计数。"""
    # ---------- 1. pending_tasks：meeting_action WHERE status=pending ----------
    from app.features.agent.models import ActionStatus, MeetingAction, MeetingSession

    user_meeting_ids = select(MeetingSession.id).where(
        MeetingSession.host_user_id == user_id
    )
    pending_tasks = int(
        db.scalar(
            select(func.count())
            .select_from(MeetingAction)
            .where(
                MeetingAction.status == ActionStatus.PENDING.value,
                MeetingAction.meeting_id.in_(user_meeting_ids),
            )
        )
        or 0
    )

    # ---------- 2. today_chats：chat_messages created_at >= today 00:00 ----------
    from app.features.chat.models import ChatMessage

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_chats = int(
        db.scalar(
            select(func.count())
            .select_from(ChatMessage)
            .where(ChatMessage.created_at >= today_start)
        )
        or 0
    )

    # ---------- 3. week_charts：近 7 日 chat_messages 按 date 分组 ----------
    week_start, day_labels = _seven_day_window()
    rows = list(
        db.execute(
            select(
                cast(ChatMessage.created_at, Date).label("d"),
                func.count().label("c"),
            )
            .where(ChatMessage.created_at >= week_start)
            .group_by("d")
        ).all()
    )
    bucket_map: dict[str, int] = {
        str(r.d): int(r.c) for r in rows if r.d is not None
    }
    week_charts = [
        {"date": label, "count": bucket_map.get(label, 0)} for label in day_labels
    ]

    # ---------- 4. kb_docs：knowledge_documents WHERE owner_id=me ----------
    from app.features.rag.models import KnowledgeDocument

    kb_docs = int(
        db.scalar(
            select(func.count())
            .select_from(KnowledgeDocument)
            .where(KnowledgeDocument.owner_id == user_id)
        )
        or 0
    )

    # ---------- 5. pending_approvals：approvals WHERE user_id=me AND status=pending ----------
    from app.features.approval.models import Approval, ApprovalStatus

    pending_approvals = int(
        db.scalar(
            select(func.count())
            .select_from(Approval)
            .where(
                and_(
                    Approval.user_id == user_id,
                    Approval.status == ApprovalStatus.PENDING.value,
                )
            )
        )
        or 0
    )

    logger.info(
        "dashboard stats | user_id=%s pending_tasks=%s today=%s kb=%s",
        user_id, pending_tasks, today_chats, kb_docs,
    )
    return {
        "pending_tasks": pending_tasks,
        "today_chats": today_chats,
        "week_charts": week_charts,
        "kb_docs": kb_docs,
        "pending_approvals": pending_approvals,
    }
