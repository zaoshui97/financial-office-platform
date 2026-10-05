"""智能办公域 REST 路由：模板 + AI 生成内容。"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.features.office.schemas import (
    DocumentTemplateCreate,
    DocumentTemplateListResponse,
    DocumentTemplateRead,
    GeneratedContentCreate,
    GeneratedContentRead,
)
from app.features.office.service import (
    create_generated_content,
    create_template,
    get_template,
    list_generated_contents,
    list_templates,
)

router = APIRouter(prefix="/office", tags=["智能办公"])


# ────────── DocumentTemplate ──────────


@router.post(
    "/templates",
    response_model=DocumentTemplateRead,
    status_code=201,
    summary="创建文档模板",
)
def post_template(
    data: DocumentTemplateCreate,
    db: Annotated[Session, Depends(get_db)],
) -> DocumentTemplateRead:
    return DocumentTemplateRead.model_validate(create_template(db, data))


@router.get(
    "/templates",
    response_model=DocumentTemplateListResponse,
    summary="分页查询模板",
)
def get_templates(
    db: Annotated[Session, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> DocumentTemplateListResponse:
    items, total = list_templates(db, page, page_size)
    return DocumentTemplateListResponse(
        items=[DocumentTemplateRead.model_validate(t) for t in items],
        total=total,
    )


@router.get(
    "/templates/{template_id}",
    response_model=DocumentTemplateRead,
    summary="模板详情",
)
def get_template_route(
    template_id: int, db: Annotated[Session, Depends(get_db)]
) -> DocumentTemplateRead:
    return DocumentTemplateRead.model_validate(get_template(db, template_id))


# ────────── GeneratedContent ──────────


@router.post(
    "/generated-contents",
    response_model=GeneratedContentRead,
    status_code=201,
    summary="记录 AI 生成内容",
)
def post_generated_content(
    data: GeneratedContentCreate,
    db: Annotated[Session, Depends(get_db)],
) -> GeneratedContentRead:
    return GeneratedContentRead.model_validate(create_generated_content(db, data))


@router.get(
    "/generated-contents",
    response_model=list[GeneratedContentRead],
    summary="分页查询 AI 生成内容",
)
def get_generated_contents(
    db: Annotated[Session, Depends(get_db)],
    user_id: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> list[GeneratedContentRead]:
    items, _ = list_generated_contents(db, user_id, page, page_size)
    return [GeneratedContentRead.model_validate(x) for x in items]
