"""AI 模型诊断路由：手动触发三方模型健康检查（明确不自动跑）。"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.ai.diagnostics import (
    DIAGNOSTIC_PROFILES,
    ModelDiagnosticResult,
    run_model_diagnostics,
)
from app.features.auth.dependencies import CurrentUser


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