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
    # 结构化风险分类：与 guard 的 GuardDecision 对齐，供前端分级展示
    risk_category: str | None = Field(
        default=None,
        description=(
            "风险分类：money_laundering/insider_trading/tax_evasion/bribery/"
            "privacy_leak/illegal_commitment/conflict_of_interest/"
            "illegal_finance/regulatory_evasion/other"
        ),
    )
    confidence: float | None = Field(
        default=None, ge=0.0, le=1.0, description="Judge 置信度（0-1）"
    )
    judge_source: str | None = Field(
        default=None, description="判定来源：rule / llm_judge"
    )


# =====================================================================
# 沙箱结构化审查接口（/sandbox/check）
#   - 区别于 /chat：只做"输入→结构化风险清单"，
#     不调 LLM 生成回答，纯粹基于守卫 4 层防御 + 词库 + 脱敏 + 审计。
#   - 返回前端 SandboxRunner 需要的所有字段：score / passed / blocked /
#     issues[] / regulations[] / hitSpans / sanitizedFields / auditId。
# =====================================================================

class SandboxCheckRequest(BaseModel):
    """合规沙箱结构化审查请求。"""

    text: str = Field(min_length=1, max_length=20000, description="待审查文本")
    source: str | None = Field(
        default="sandbox_page",
        description="业务来源：approval/report/qa/sandbox_page/demo 等",
    )
    business_ref: dict[str, Any] | None = Field(
        default=None, description="业务单据绑定：{type, id}",
    )


class SandboxCheckIssue(BaseModel):
    """单条命中风险的结构化描述。"""

    rule_id: str
    rule_name: str
    category: str
    severity: str  # block / high / medium / low
    snippet: str = ""
    suggestion: str = ""
    regulation_ids: list[str] = Field(default_factory=list)


class SandboxCheckResponse(BaseModel):
    """合规沙箱结构化审查响应（供前端 SandboxRunner 直接消费）。"""

    score: float = Field(ge=0.0, le=5.0, description="综合评分 0-5")
    passed: bool = Field(description="是否通过（无任何命中）")
    blocked: bool = Field(description="是否包含阻断级风险")
    issues: list[SandboxCheckIssue] = Field(default_factory=list)
    total_hits: int = 0
    duration_ms: int = 0
    sanitized_text: str = ""
    sanitized_fields: dict[str, int] = Field(default_factory=dict)
    risk_category: str | None = None
    confidence: float | None = None
    judge_source: str | None = None
    audit_id: int | None = None
    model_version: str = "sandbox-check-v1.0"


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