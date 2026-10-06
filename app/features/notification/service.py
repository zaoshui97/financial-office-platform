"""通知推送：写库 + 调外部渠道（钉钉 webhook）。

降级策略：
  - 未配置 DINGTALK_WEBHOOK → 落库 status=skipped，不报错
  - HTTP 调用异常 → 落库 status=failed + error_message，不抛
  - 内容超长 → 截断
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import get_logger
from app.features.notification.models import (
    NotificationRecord,
    NotifyChannel,
    NotifyStatus,
)

logger = get_logger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat(timespec="seconds")


def _truncate(content: str, max_chars: int) -> str:
    if len(content) <= max_chars:
        return content
    return content[: max_chars - 3] + "..."


def _send_dingtalk(content: str) -> tuple[bool, str | None]:
    """调钉钉 webhook，未配置或异常返回 (False, reason)。"""
    if not settings.DINGTALK_WEBHOOK:
        return False, "DINGTALK_WEBHOOK 未配置"
    payload = json.dumps(
        {"msgtype": "text", "text": {"content": content}},
        ensure_ascii=False,
    ).encode("utf-8")
    req = urllib.request.Request(
        settings.DINGTALK_WEBHOOK,
        data=payload,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode("utf-8", errors="replace")
        if resp.status >= 400:
            return False, f"HTTP {resp.status}: {body[:200]}"
        return True, None
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        return False, f"{type(exc).__name__}: {exc}"


def send_notification(
    db: Session,
    user_id: int,
    biz_type: str,
    biz_id: int | None,
    channel: str,
    content: str,
) -> dict:
    """发送通知：先落库 → 调渠道 → 更新状态。"""
    channel = (channel or "").strip().lower()
    if channel not in {c.value for c in NotifyChannel}:
        channel = NotifyChannel.DINGTALK.value
    content = _truncate(content, settings.NOTIFICATION_MAX_CONTENT_CHARS)

    record = NotificationRecord(
        user_id=user_id,
        biz_type=(biz_type or "general")[:32],
        biz_id=biz_id,
        channel=channel,
        status=NotifyStatus.PENDING.value if False else NotifyStatus.SKIPPED.value,
        content=content,
    )
    db.add(record)
    db.flush()

    if channel == NotifyChannel.DINGTALK.value:
        ok, err = _send_dingtalk(content)
        if ok:
            record.status = NotifyStatus.SENT.value
            record.sent_at = _now_iso()
        else:
            record.status = NotifyStatus.FAILED.value if settings.DINGTALK_WEBHOOK else NotifyStatus.SKIPPED.value
            record.error_message = err
    else:
        # email / inapp：本版仅落库，不实际发送
        record.status = NotifyStatus.SKIPPED.value
        record.error_message = f"渠道 {channel} 暂未实现推送，仅落库"

    db.commit()
    db.refresh(record)
    logger.info(
        "notification 发送 | id=%s user_id=%s channel=%s status=%s",
        record.id, user_id, channel, record.status,
    )
    return {
        "id": record.id,
        "user_id": record.user_id,
        "biz_type": record.biz_type,
        "biz_id": record.biz_id,
        "channel": record.channel,
        "status": record.status,
        "content": record.content,
        "error_message": record.error_message,
        "sent_at": record.sent_at,
        "created_at": record.created_at,
        "updated_at": record.updated_at,
    }


def list_notifications(
    db: Session,
    user_id: int,
    limit: int = 50,
) -> dict:
    """列我的通知记录。"""
    rows = list(
        db.scalars(
            select(NotificationRecord)
            .where(NotificationRecord.user_id == user_id)
            .order_by(NotificationRecord.id.desc())
            .limit(limit)
        ).all()
    )
    total = int(
        db.scalar(
            select(func.count())
            .select_from(NotificationRecord)
            .where(NotificationRecord.user_id == user_id)
        )
        or 0
    )
    return {
        "items": [
            {
                "id": r.id,
                "user_id": r.user_id,
                "biz_type": r.biz_type,
                "biz_id": r.biz_id,
                "channel": r.channel,
                "status": r.status,
                "content": r.content,
                "error_message": r.error_message,
                "sent_at": r.sent_at,
                "created_at": r.created_at,
                "updated_at": r.updated_at,
            }
            for r in rows
        ],
        "total": total,
    }
