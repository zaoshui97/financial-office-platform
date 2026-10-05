"""智能办公域 service：模板 CRUD + 生成内容管理。"""

from __future__ import annotations

from typing import Sequence

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.features.office.models import DocumentTemplate, GeneratedContent
from app.features.office.schemas import (
    DocumentTemplateCreate,
    GeneratedContentCreate,
)


# ────────── DocumentTemplate ──────────


def create_template(db: Session, data: DocumentTemplateCreate) -> DocumentTemplate:
    tpl = DocumentTemplate(**data.model_dump())
    db.add(tpl)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"template_code 已存在: {data.template_code}",
        ) from exc
    db.refresh(tpl)
    return tpl


def list_templates(
    db: Session, page: int = 1, page_size: int = 20
) -> tuple[Sequence[DocumentTemplate], int]:
    base = select(DocumentTemplate).order_by(DocumentTemplate.id.desc())
    items = list(db.scalars(base.offset((page - 1) * page_size).limit(page_size)).all())
    total = db.scalar(select(func.count(DocumentTemplate.id))) or 0
    return items, total


def get_template(db: Session, template_id: int) -> DocumentTemplate:
    tpl = db.get(DocumentTemplate, template_id)
    if tpl is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"模板 {template_id} 不存在",
        )
    return tpl


# ────────── GeneratedContent ──────────


def create_generated_content(
    db: Session, data: GeneratedContentCreate
) -> GeneratedContent:
    item = GeneratedContent(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def list_generated_contents(
    db: Session, user_id: int | None = None, page: int = 1, page_size: int = 20
) -> tuple[Sequence[GeneratedContent], int]:
    base = select(GeneratedContent)
    if user_id is not None:
        base = base.where(GeneratedContent.user_id == user_id)
    base = base.order_by(GeneratedContent.id.desc())
    items = list(db.scalars(base.offset((page - 1) * page_size).limit(page_size)).all())
    count_q = select(func.count(GeneratedContent.id))
    if user_id is not None:
        count_q = count_q.where(GeneratedContent.user_id == user_id)
    total = db.scalar(count_q) or 0
    return items, total
