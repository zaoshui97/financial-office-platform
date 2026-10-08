"""AI 模型诊断路由：手动触发三方模型健康检查（明确不自动跑）。"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.ai.diagnostics import (
    DIAGNOSTIC_PROFILES,
    ModelDiagnosticResult,
    run_model_diagnostics,
)
from app.ai.llm_gateway import llm_gateway
from app.ai.schemas import AITask
from app.core.config import settings
from app.core.logging import get_logger
from app.features.auth.dependencies import CurrentUser

logger = get_logger(__name__)

router = APIRouter(prefix="/ai", tags=["AI 诊断"])


class DiagnosticItem(BaseModel):
    """单模型诊断结果（不含 API key）。"""

    provider: str
    model: str
    success: bool
    latency_ms: float
    response_text: str
    input_tokens: int
    output_tokens: int
    error: str | None = None


class DiagnosticResponse(BaseModel):
    """三方模型诊断响应。"""

    items: list[DiagnosticItem]


@router.get(
    "/diagnostics",
    response_model=DiagnosticResponse,
    summary="显式触发三方模型健康检查（产生远程调用，仅供运维）",
)
def ai_diagnostics(
    current_user: CurrentUser,
) -> DiagnosticResponse:
    """逐个调用 deepseek/doubao/qwen 让 'OK'；返回每家的延迟与 token 统计。

    注意：
      - 必须由 SUPER_ADMIN 触发（运维场景）
      - 不在启动时自动调用，避免烧配额
    """
    results: list[ModelDiagnosticResult] = run_model_diagnostics()
    return DiagnosticResponse(
        items=[
            DiagnosticItem(
                provider=r.provider,
                model=r.model,
                success=r.success,
                latency_ms=r.latency_ms,
                response_text=r.response_text,
                input_tokens=r.input_tokens,
                output_tokens=r.output_tokens,
                error=r.error,
            )
            for r in results
        ],
    )


@router.get(
    "/diagnostics/profiles",
    summary="列出被诊断的 profile 名（仅元数据，不产生远程调用）",
)
def ai_diagnostic_profiles() -> dict[str, str]:
    """返回 DIAGNOSTIC_PROFILES 的映射，便于前端展示。"""
    return dict(DIAGNOSTIC_PROFILES)


# =====================================================================
# AI 代理（演示场景：让前端不再直连 DeepSeek，Key 走后端 .env）
# =====================================================================

class AIProxyChatRequest(BaseModel):
    """AI 代理请求。"""

    messages: list[dict] = Field(
        default_factory=list,
        description='消息列表：[{role: "system"|"user"|"assistant", content: str}, ...]',
    )
    temperature: float = Field(default=0.3, ge=0.0, le=2.0)
    max_tokens: int = Field(default=1000, ge=1, le=4000)
    model: str | None = Field(
        default=None, description="指定模型；留空走主路由"
    )


class AIProxyChatResponse(BaseModel):
    """AI 代理响应。"""

    content: str
    provider: str | None = None
    model: str | None = None
    latency_ms: float | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None


@router.post(
    "/chat",
    response_model=AIProxyChatResponse,
    summary="后端 AI 代理（演示场景：不让 Key 出后端）",
)
def ai_proxy_chat(
    data: AIProxyChatRequest,
    _current_user: CurrentUser,
) -> AIProxyChatResponse:
    """统一入口，代理到 LLMGateway。

    演示场景下，前端不再直连 DeepSeek 公网，
    而是把 prompt 发到 /api/v1/ai/chat，Key 在后端 .env 中。
    """
    if not data.messages:
        raise HTTPException(status_code=422, detail="messages 不能为空")
    try:
        response = llm_gateway.complete_with_metadata(
            data.messages,
            task=AITask.CHAT,
        )
        return AIProxyChatResponse(
            content=response.text,
            provider=response.provider,
            model=response.model,
            latency_ms=response.latency_ms,
            input_tokens=response.usage.input_tokens if response.usage else None,
            output_tokens=response.usage.output_tokens if response.usage else None,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("AI 代理失败: %s", exc)
        raise HTTPException(
            status_code=503, detail=f"AI 服务暂不可用: {exc}"
        ) from exc