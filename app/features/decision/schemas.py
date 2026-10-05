"""决策智能域 schemas：法规 + 资讯 + 业务影响 + 决策回放。"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


# ────────── Regulation（法规） ──────────


class RegulationCreate(BaseModel):
    regulation_code: str = Field(min_length=1, max_length=50)
    title: str = Field(min_length=1, max_length=500)
    issuing_authority: str | None = Field(default=None, max_length=200)
    industry: str | None = Field(default=None, max_length=50)
    category: str | None = Field(default=None, max_length=100)
    effective_date: str | None = Field(default=None, max_length=10)
    expiry_date: str | None = Field(default=None, max_length=10)
    source_url: str | None = Field(default=None, max_length=500)


class RegulationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    regulation_code: str
    title: str
    issuing_authority: str | None = None
    industry: str | None = None
    category: str | None = None
    effective_date: str | None = None
    expiry_date: str | None = None
    status: str = "active"
    source_url: str | None = None


class RegulationListResponse(BaseModel):
    items: list[RegulationRead]
    total: int


# ────────── IndustryNews（行业资讯） ──────────


class IndustryNewsCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    source: str | None = Field(default=None, max_length=100)
    source_url: str | None = Field(default=None, max_length=500)
    published_at: str | None = None
    industry: str | None = None
    category: str | None = None
    summary: str | None = None
    importance_level: str = "medium"
    tags: list[str] | None = None


class IndustryNewsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    source: str | None = None
    source_url: str | None = None
    published_at: str | None = None
    industry: str | None = None
    category: str | None = None
    summary: str | None = None
    importance_level: str = "medium"
    is_pushed: bool = False
    pushed_at: str | None = None
    tags: list[str] | None = None


class IndustryNewsListResponse(BaseModel):
    items: list[IndustryNewsRead]
    total: int


# ────────── BusinessImpact（业务影响评估） ──────────


class BusinessImpactCreate(BaseModel):
    event_type: str = Field(default="regulation", description="regulation/news/internal")
    event_id: int | None = None
    event_title: str | None = None
    impact_level: str = "medium"
    impact_scope: list[str] | None = None
    affected_departments: list[str] | None = None
    predicted_actions: list[dict[str, Any]] | None = None
    ai_model: str | None = None
    confidence: float | None = None


class BusinessImpactRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_type: str | None = None
    event_id: int | None = None
    event_title: str | None = None
    impact_level: str = "medium"
    impact_scope: list[str] | None = None
    affected_departments: list[str] | None = None
    predicted_actions: list[dict[str, Any]] | None = None
    ai_model: str | None = None
    confidence: float | None = None


# ────────── DecisionPlayback（决策回放） ──────────


class DecisionPlaybackCreate(BaseModel):
    decision_no: str | None = None
    decision_type: str = "compliance_review"
    title: str = Field(min_length=1, max_length=200)
    context: str | None = None
    data_sources: list[dict[str, Any]] | None = None
    reasoning_chain: str | None = None
    participants: list[str] | None = None
    final_decision: str | None = None
    outcome: str | None = None


class DecisionPlaybackRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    decision_no: str | None = None
    decision_type: str | None = None
    title: str
    context: str | None = None
    data_sources: list[dict[str, Any]] | None = None
    reasoning_chain: str | None = None
    participants: list[str] | None = None
    final_decision: str | None = None
    outcome: str | None = None
    is_tampered: bool = False
    decision_hash: str | None = None
