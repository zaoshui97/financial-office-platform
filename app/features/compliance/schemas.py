"""合规沙箱请求 / 响应模型。"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.ai.schemas import AITask


class SandboxChatRequest(BaseModel):
    """合规沙箱聊天请求。"""

    message: str = Field(min_length=1, max_length=10000)
    conversation_id: int | None = Field(default=None, ge=1)
    task: AITask = AITask.CHAT


class SandboxChatResponse(BaseModel):
    """合规沙箱聊天响应。"""

    conversation_id: int | None
    assistant_message_id: str
    answer: str
    mode: str
    provider: str | None = None
    model: str | None = None
    latency_ms: float | None = None
    sanitized_fields: dict[str, int] = Field(
        default_factory=dict, description="本次请求命中的 PII 规则及次数"
    )
    risk_hits: list[str] = Field(default_factory=list, description="风险词命中")
    audit_id: int | None = Field(
        default=None, description="合规审计日志 ID"
    )


class KillSwitchRequest(BaseModel):
    """Kill Switch 切换请求（仅管理员）。"""

    enabled: bool
    operator: str = Field(min_length=1, max_length=64)
    reason: str | None = Field(default=None, max_length=200)


class KillSwitchResponse(BaseModel):
    """Kill Switch 当前状态。"""

    enabled: bool
    updated_by: str | None = None
    updated_at: datetime | None = None
    reason: str | None = None


class AuditLogRead(BaseModel):
    """审计日志只读视图。"""

    id: int
    user_id: int
    request_id: str
    mode: str
    provider: str
    model: str
    prompt_length: int
    prompt_preview: str
    answer_length: int | None
    answer_preview: str | None
    pii_detected: dict[str, Any] | None
    risk_hits: list[str] | None
    blocked: bool
    block_reason: str | None
    latency_ms: float | None
    created_at: datetime


class AuditLogListResponse(BaseModel):
    """审计日志分页响应。"""

    items: list[AuditLogRead]
    total: int