"""附件模块：审批/工单附件上传、下载、列表、删除。

设计：
  - 文件存在 storage/uploads/attachments/<user_id>/<file_id><ext>
  - 公开 random UUID 文件名 + DB 存 original_filename / content_type / size
  - 附件 owner 可以删除；他人不能删
  - download 鉴权：需要登录；不限制部门（与审批业务逻辑耦合）
"""
from __future__ import annotations

import os
import re
import secrets
import unicodedata
from datetime import datetime, timedelta
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, Integer, String, Text, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.core.config import settings
from app.core.database import Base, TimestampMixin
from app.core.logging import get_logger

logger = get_logger(__name__)


# ─────────────── 允许的扩展名 / MIME ───────────────

ALLOWED_EXTS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".ppt", ".pptx",
    ".txt", ".md", ".csv",
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp",
    ".zip", ".7z", ".rar",
}
MAX_FILE_SIZE_MB = 20
_READ_BUFFER = 1024 * 1024


class Attachment(TimestampMixin, Base):
    """附件表。"""

    __tablename__ = "attachments"
    __table_args__ = (
        Index("idx_attachment_uploader", "user_id"),
        Index("idx_attachment_business", "business_type", "business_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
        comment="上传者",
    )
    stored_name: Mapped[str] = mapped_column(String(255), nullable=False, comment="存储文件名（随机）")
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    extension: Mapped[str] = mapped_column(String(16), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    size: Mapped[int] = mapped_column(Integer, nullable=False)
    business_type: Mapped[str | None] = mapped_column(
        String(32), nullable=True,
        comment="业务关联类型：approval / meeting 等",
    )
    business_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, comment="业务关联 id")
    # 临时预览 token：用于 Office Online 等需要公网可访问地址的第三方预览服务
    #  - 上传时自动生成 32 字节 URL-safe 字符串
    #  - 配套接口 /download-public/{token} 在 24 小时内免鉴权下载
    #  - 仅用于预览，不要用于业务下载（业务请走 /{id}/download）
    preview_token: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    preview_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


# ─────────────── 工具函数 ───────────────

_INVALID_FILENAME_CHARS = re.compile(r'[\\/:*?"<>|\x00-\x1f]')


def _sanitize_filename(raw: str | None) -> str:
    """规范化上传文件名（保留中文 / 空格 / 点号；过滤路径字符）。"""
    if not raw:
        raise ValueError("文件名为空")
    s = unicodedata.normalize("NFKC", raw).strip()
    s = _INVALID_FILENAME_CHARS.sub("_", s)
    if not s or s in {".", ".."}:
        raise ValueError("文件名无效")
    if len(s) > 200:
        raise ValueError("文件名过长")
    return s


def _ext_of(filename: str) -> str:
    return Path(filename).suffix.lower()


def _attachment_dir(user_id: int) -> Path:
    base = Path(settings.STORAGE_DIR) / "attachments" / str(user_id)
    base.mkdir(parents=True, exist_ok=True)
    return base


def save_attachment(file: UploadFile, user_id: int) -> Attachment:
    """保存上传文件并返回 DB 行（未 commit）。"""
    try:
        original_filename = _sanitize_filename(file.filename)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    extension = _ext_of(original_filename)
    if extension not in ALLOWED_EXTS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"不支持的文件类型：{extension}。允许：{', '.join(sorted(ALLOWED_EXTS))}",
        )

    stored_name = f"{uuid4().hex}{extension}"
    target_path = _attachment_dir(user_id) / stored_name
    max_bytes = MAX_FILE_SIZE_MB * 1024 * 1024
    total_size = 0

    try:
        with target_path.open("wb") as f:
            while chunk := file.file.read(_READ_BUFFER):
                total_size += len(chunk)
                if total_size > max_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"文件大小不能超过 {MAX_FILE_SIZE_MB} MB",
                    )
                f.write(chunk)
    except Exception:
        target_path.unlink(missing_ok=True)
        raise
    finally:
        file.file.close()

    if total_size == 0:
        target_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="上传文件不能为空")

    att = Attachment(
        user_id=user_id,
        stored_name=stored_name,
        original_filename=original_filename,
        extension=extension,
        content_type=file.content_type,
        size=total_size,
    )
    logger.info("attachment saved user=%s stored=%s ext=%s size=%s", user_id, stored_name, extension, total_size)
    return att


def attachment_path(att: Attachment) -> Path:
    return _attachment_dir(att.user_id) / att.stored_name


def delete_attachment_file(att: Attachment) -> None:
    try:
        attachment_path(att).unlink(missing_ok=True)
    except Exception as e:
        logger.warning("删除附件文件失败 att_id=%s err=%s", att.id, e)


# ─────────────── CRUD ───────────────

PREVIEW_TOKEN_TTL = timedelta(hours=24)


def _generate_preview_token() -> tuple[str, datetime]:
    """生成临时预览 token + 过期时间。
    用于 /download-public/{token} 的免鉴权下载，给第三方预览服务（如 Office Online）用。
    """
    return secrets.token_urlsafe(32), datetime.utcnow() + PREVIEW_TOKEN_TTL


def create_attachment_record(
    db: Session,
    user_id: int,
    file: UploadFile,
    business_type: str | None = None,
    business_id: int | None = None,
) -> Attachment:
    """保存文件 + 写入 DB + 自动签发 24h 预览 token。"""
    att = save_attachment(file, user_id)
    att.business_type = business_type
    att.business_id = business_id
    # 自动签发临时预览 token，方便前端 Office Online 等第三方预览
    token, expires = _generate_preview_token()
    att.preview_token = token
    att.preview_expires_at = expires
    db.add(att)
    db.commit()
    db.refresh(att)
    return att


def get_attachment_by_preview_token(db: Session, token: str) -> Attachment | None:
    """按 token 查附件（用于免鉴权下载接口）。"""
    return db.scalar(
        select(Attachment).where(
            Attachment.preview_token == token,
            Attachment.preview_expires_at > datetime.utcnow(),
        )
    )


def get_attachment(db: Session, attachment_id: int) -> Attachment | None:
    return db.scalar(select(Attachment).where(Attachment.id == attachment_id))


def list_my_attachments(db: Session, user_id: int, limit: int = 50) -> list[Attachment]:
    stmt = select(Attachment).where(Attachment.user_id == user_id).order_by(Attachment.id.desc()).limit(limit)
    return list(db.scalars(stmt).all())


def list_business_attachments(db: Session, business_type: str, business_id: int) -> list[Attachment]:
    stmt = (
        select(Attachment)
        .where(Attachment.business_type == business_type, Attachment.business_id == business_id)
        .order_by(Attachment.id.asc())
    )
    return list(db.scalars(stmt).all())


def delete_attachment(db: Session, attachment_id: int, user_id: int) -> None:
    att = get_attachment(db, attachment_id)
    if att is None:
        raise HTTPException(status_code=404, detail="附件不存在")
    if att.user_id != user_id:
        raise HTTPException(status_code=403, detail="无权删除他人附件")
    delete_attachment_file(att)
    db.delete(att)
    db.commit()