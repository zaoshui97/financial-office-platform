"""智能办公域 schemas：文档模板 + AI 生成内容。"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


# ────────── DocumentTemplate ──────────


class DocumentTemplateCreate(BaseModel):
    template_code: str = Field(min_length=1, max_length=50)
    template_name: str = Field(min_length=1, max_length=200)
    template_type: str = Field(default="notice", description="notice/email/weekly/monthly/minutes")
    industry: str | None = Field(default=None, max_length=50)
    content: str = Field(min_length=1, description="模板正文（支持 {var} 占位符）")
    variables: list[dict[str, Any]] | None = None


class DocumentTemplateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    template_code: str | None = None
    template_name: str | None = None
    template_type: str | None = None
    industry: str | None = None
    content: str
    variables: list[dict[str, Any]] | None = None
    is_active: bool = True
    usage_count: int = 0


class DocumentTemplateListResponse(BaseModel):
    items: list[DocumentTemplateRead]
    total: int


# ────────── GeneratedContent ──────────


class GeneratedContentCreate(BaseModel):
    user_id: int
    content_type: str = Field(default="notice")
    title: str | None = Field(default=None, max_length=200)
    prompt: str | None = None
    content: str | None = None
    template_id: int | None = None
    ai_model: str | None = None


class GeneratedContentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    content_type: str | None = None
    title: str | None = None
    prompt: str | None = None
    content: str | None = None
    template_id: int | None = None
    ai_model: str | None = None
    compliance_check_result: dict[str, Any] | None = None
    push_status: str = "unsent"
    push_channel: str | None = None
    pushed_at: str | None = None
