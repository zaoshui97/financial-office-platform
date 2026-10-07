"""
会议邀请码服务
  - 生成 / 重置邀请码（仅主持人）
  - 验证邀请码并加入会议
  - 邀请码格式：6 位字母数字（易念、易输入、不易混淆 I/O/0/1）
"""
from __future__ import annotations
import secrets
import string
from datetime import datetime, timedelta
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.features.agent.models import MeetingSession
from app.features.meeting.models import MeetingParticipant
from app.core.logging import get_logger

logger = get_logger(__name__)

# 邀请码字符表（去掉容易混淆的 0/O/1/I/l）
CODE_CHARS = "".join(c for c in (string.ascii_uppercase + string.digits)
                     if c not in "0OIL1")
CODE_LEN = 6
DEFAULT_EXPIRES_DAYS = 7


def _generate_code() -> str:
    """生成 6 位邀请码，去除容易混淆的字符。"""
    return "".join(secrets.choice(CODE_CHARS) for _ in range(CODE_LEN))


def generate_or_reset_invite(
    db: Session,
    meeting_id: int,
    host_user_id: int,
    expires_in_days: int | None = DEFAULT_EXPIRES_DAYS,
) -> dict[str, Any]:
    """为会议生成或重置邀请码。仅主持人可调用。"""
    meeting = db.scalar(
        select(MeetingSession).where(
            MeetingSession.id == meeting_id,
            MeetingSession.host_user_id == host_user_id,
        )
    )
    if meeting is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="会议不存在或你不是主持人",
        )
    # 重新生成（保证唯一）
    for _ in range(5):
        code = _generate_code()
        existing = db.scalar(
            select(MeetingSession).where(MeetingSession.invite_code == code)
        )
        if existing is None:
            break
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="邀请码生成失败（重试 5 次仍冲突）",
        )
    meeting.invite_code = code
    meeting.invite_expires_at = (
        datetime.utcnow() + timedelta(days=expires_in_days)
        if expires_in_days else None
    )
    db.commit()
    db.refresh(meeting)
    logger.info(
        "meeting invite code generated | meeting_id=%s host=%s code=%s expires=%s",
        meeting_id, host_user_id, code, meeting.invite_expires_at,
    )
    return {
        "meeting_id": meeting.id,
        "meeting_title": meeting.title,
        "invite_code": code,
        "expires_at": meeting.invite_expires_at.isoformat() if meeting.invite_expires_at else None,
    }


def join_meeting_by_code(
    db: Session,
    user_id: int,
    code: str,
) -> dict[str, Any]:
    """通过邀请码加入会议。"""
    code = (code or "").strip().upper()
    if not code or len(code) != CODE_LEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"邀请码格式错误（应为 {CODE_LEN} 位）",
        )
    meeting = db.scalar(
        select(MeetingSession).where(MeetingSession.invite_code == code)
    )
    if meeting is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="邀请码无效或会议不存在",
        )
    if meeting.invite_expires_at and meeting.invite_expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="邀请码已过期，请向主持人索要新码",
        )
    # 检查是否已是参会人
    existing = db.scalar(
        select(MeetingParticipant).where(
            MeetingParticipant.meeting_id == meeting.id,
            MeetingParticipant.user_id == user_id,
        )
    )
    if existing is not None:
        return {
            "meeting_id": meeting.id,
            "meeting_title": meeting.title,
            "joined": False,
            "message": "你已经是该会议的参会人",
        }
    participant = MeetingParticipant(
        meeting_id=meeting.id,
        user_id=user_id,
        role="attendee",
    )
    db.add(participant)
    db.commit()
    logger.info(
        "meeting join via invite | meeting_id=%s user=%s code=%s",
        meeting.id, user_id, code,
    )
    return {
        "meeting_id": meeting.id,
        "meeting_title": meeting.title,
        "joined": True,
        "message": "已加入会议",
    }