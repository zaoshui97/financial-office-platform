"""附件模块 REST 路由。"""

from __future__ import annotations

import os
import sys
import traceback
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.logging import get_logger
from app.features.attachment.models import (
    delete_attachment as delete_attachment_svc,
    attachment_path,
    create_attachment_record,
    get_attachment,
    get_attachment_by_preview_token,
    list_business_attachments,
    list_my_attachments,
)
from app.features.attachment.schemas import AttachmentListResponse, AttachmentRead
from app.features.auth.dependencies import CurrentUser

logger = get_logger(__name__)
router = APIRouter(prefix="/attachments", tags=["附件"])

# Office / 图片 MIME 对照表
_MIME_FALLBACK = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".csv": "text/csv",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".zip": "application/zip",
    ".7z": "application/x-7z-compressed",
    ".rar": "application/vnd.rar",
}


@router.post(
    "/upload",
    response_model=AttachmentRead,
    status_code=status.HTTP_201_CREATED,
    summary="上传附件（multipart/form-data，字段名 file）",
)
async def upload_attachment(
    file: Annotated[UploadFile, File(description="文件二进制")],
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    business_type: str | None = None,
    business_id: int | None = None,
) -> AttachmentRead:
    try:
        att = create_attachment_record(
            db, current_user.id, file,
            business_type=business_type,
            business_id=business_id,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("attachment upload failed: %s", traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"上传失败：{type(e).__name__}: {e}")
    return AttachmentRead.model_validate(att)


@router.get(
    "",
    response_model=AttachmentListResponse,
    summary="列我的附件（最近 N 条）",
)
def list_my(
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    limit: int = 50,
) -> AttachmentListResponse:
    rows = list_my_attachments(db, current_user.id, limit)
    return AttachmentListResponse.model_validate({
        "items": [AttachmentRead.model_validate(r) for r in rows],
        "total": len(rows),
    })


@router.get(
    "/by-business/{business_type}/{business_id}",
    response_model=AttachmentListResponse,
    summary="按业务类型+id 列附件（审批详情用）",
)
def list_by_business(
    business_type: str,
    business_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> AttachmentListResponse:
    rows = list_business_attachments(db, business_type, business_id)
    return AttachmentListResponse.model_validate({
        "items": [AttachmentRead.model_validate(r) for r in rows],
        "total": len(rows),
    })


@router.get(
    "/{attachment_id}",
    response_model=AttachmentRead,
    summary="附件元数据",
)
def get_meta(
    attachment_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> AttachmentRead:
    att = get_attachment(db, attachment_id)
    if att is None:
        raise HTTPException(status_code=404, detail="附件不存在")
    return AttachmentRead.model_validate(att)


@router.get(
    "/{attachment_id}/download",
    summary="下载附件（鉴权：登录用户）",
)
def download(
    attachment_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    att = get_attachment(db, attachment_id)
    if att is None:
        raise HTTPException(status_code=404, detail="附件不存在")
    path = attachment_path(att)
    if not path.exists():
        raise HTTPException(status_code=410, detail="文件已丢失")
    # 中文文件名走 RFC 5987
    from urllib.parse import quote
    encoded_name = quote(att.original_filename)
    media_type = att.content_type or _MIME_FALLBACK.get(att.extension, "application/octet-stream")
    return FileResponse(
        path=str(path),
        media_type=media_type,
        filename=att.original_filename,
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_name}",
            "Cache-Control": "private, max-age=300",
        },
    )


@router.get(
    "/download-public/{token}",
    summary="免鉴权临时下载（仅用于第三方预览服务，24h 有效）",
)
def download_public(
    token: str,
    db: Annotated[Session, Depends(get_db)],
):
    """
    通过 24h 临时 token 免鉴权下载。

    设计动机：
      - Microsoft Office Online / Google Docs Viewer 等第三方预览服务要求 src 是公网可访问的 URL
      - 我们正常下载接口 (/download) 需要 Bearer Token，第三方无法加 header
      - 解决方案：DB 里给每个附件预生成 24h token，对外暴露一个无鉴权下载接口
      - 安全控制：
          * token 是 32 字节 URL-safe 随机串（256 bit 熵），不可枚举
          * DB 索引查 token + 校验过期
          * token 默认 24h 过期；可定时任务清理过期附件

    注意：业务侧仍应使用 /{id}/download（带鉴权），本接口只用于预览。
    """
    att = get_attachment_by_preview_token(db, token)
    if att is None:
        raise HTTPException(status_code=404, detail="预览链接不存在或已过期")
    path = attachment_path(att)
    if not path.exists():
        raise HTTPException(status_code=410, detail="文件已丢失")
    from urllib.parse import quote
    encoded_name = quote(att.original_filename)
    media_type = att.content_type or _MIME_FALLBACK.get(att.extension, "application/octet-stream")
    # inline 渲染而不是 attachment，否则 Microsoft Web Viewer 看不到内容会下载
    return FileResponse(
        path=str(path),
        media_type=media_type,
        filename=att.original_filename,
        headers={
            "Content-Disposition": f"inline; filename*=UTF-8''{encoded_name}",
            "Cache-Control": "public, max-age=300",
        },
    )


@router.post(
    "/{attachment_id}/refresh-preview-token",
    response_model=AttachmentRead,
    summary="刷新临时预览 token（旧 token 失效，返回新 token）",
)
def refresh_preview_token(
    attachment_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> AttachmentRead:
    """
    上传者或超级管理员可刷新预览 token，重新计时 24h 并签发新 token。
    业务场景：管理员审批时附带的预览链接过期，调用此接口延长。
    """
    from app.features.attachment.models import _generate_preview_token
    att = get_attachment(db, attachment_id)
    if att is None:
        raise HTTPException(status_code=404, detail="附件不存在")
    if att.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="仅上传者或超级管理员可刷新预览 token")
    token, expires = _generate_preview_token()
    att.preview_token = token
    att.preview_expires_at = expires
    db.add(att)
    db.commit()
    db.refresh(att)
    return AttachmentRead.model_validate(att)


@router.delete(
    "/{attachment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除附件（仅上传者本人）",
)
def delete(
    attachment_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    delete_attachment_svc(db, attachment_id, current_user.id)
    return None