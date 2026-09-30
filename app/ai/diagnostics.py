"""显式三模型健康诊断，不绑定FastAPI启动流程。"""

import json
from collections.abc import Mapping
from dataclasses import dataclass
from time import perf_counter

from app.ai.exceptions import AIError
from app.ai.model_router import ModelRouter, model_router
from app.ai.providers import AIProvider, create_default_providers
from app.ai.schemas import AIRequest, AIResponse
from app.core.logging import get_logger

logger = get_logger(__name__)


@dataclass(frozen=True)
class ModelDiagnosticResult:
    """单个模型诊断结果，不包含任何API密钥。"""

    provider: str
    model: str
    success: bool
    latency_ms: float
    response_text: str
    input_tokens: int
    output_tokens: int
    error: str | None = None


DIAGNOSTIC_PROFILES: Mapping[str, str] = {
    "deepseek": "deepseek_reasoning",
    "doubao": "doubao_office",
    "qwen": "qwen_knowledge",
}
DIAGNOSTIC_MESSAGE = "请只回复：OK"


def _safe_error(error: Exception) -> str:
    """只返回安全错误摘要，避免远程异常泄露密钥。"""
    if isinstance(error, AIError):
        return str(error)
    return f"{type(error).__name__}: remote provider failure"


def _result_from_response(
    provider_name: str,
    model: str,
    response: AIResponse,
    latency_ms: float,
) -> ModelDiagnosticResult:
    """将统一AI响应转换为诊断结果。"""
    text = response.text.strip()
    return ModelDiagnosticResult(
        provider=provider_name,
        model=model,
        success=bool(text),
        latency_ms=round(latency_ms, 2),
        response_text=text[:2000],
        input_tokens=response.usage.prompt_tokens,
        output_tokens=response.usage.completion_tokens,
        error=None if text else "模型未返回有效文本",
    )


def run_model_diagnostics(
    providers: dict[str, AIProvider] | None = None,
    router: ModelRouter | None = None,
) -> list[ModelDiagnosticResult]:
    """分别调用三个配置模型；只有显式调用本函数时才产生远程请求。"""
    resolved_router = router or model_router
    resolved_providers = providers or create_default_providers()
    profiles = resolved_router.profiles()
    results: list[ModelDiagnosticResult] = []

    for provider_name, profile_name in DIAGNOSTIC_PROFILES.items():
        profile = profiles.get(profile_name)
        if profile is None:
            results.append(
                ModelDiagnosticResult(
                    provider=provider_name,
                    model="",
                    success=False,
                    latency_ms=0.0,
                    response_text="",
                    input_tokens=0,
                    output_tokens=0,
                    error=f"未找到模型档案: {profile_name}",
                )
            )
            continue

        started_at = perf_counter()
        try:
            provider_config = resolved_router.provider_for(profile.provider)
            provider = resolved_providers.get(profile.provider)
            if provider is None:
                raise RuntimeError(f"未注册Provider: {profile.provider}")

            request = AIRequest(
                task="model_diagnostic",
                messages=[{"role": "user", "content": DIAGNOSTIC_MESSAGE}],
                instructions="请只回复OK，不要补充其他内容。",
                max_tokens=512,
                metadata={"diagnostic": True, "provider": provider_name},
            )
            response = provider.chat(request, profile, provider_config)
            result = _result_from_response(
                provider_name,
                profile.model,
                response,
                (perf_counter() - started_at) * 1000,
            )
        except Exception as exc:
            result = ModelDiagnosticResult(
                provider=provider_name,
                model=profile.model,
                success=False,
                latency_ms=round((perf_counter() - started_at) * 1000, 2),
                response_text="",
                input_tokens=0,
                output_tokens=0,
                error=_safe_error(exc),
            )
        logger.info(
            "AI模型诊断 | provider=%s model=%s success=%s latency_ms=%.2f "
            "input_tokens=%s output_tokens=%s error=%s",
            result.provider,
            result.model,
            result.success,
            result.latency_ms,
            result.input_tokens,
            result.output_tokens,
            result.error,
        )
        results.append(result)

    return results


if __name__ == "__main__":
    print(
        json.dumps(
            [result.__dict__ for result in run_model_diagnostics()],
            ensure_ascii=False,
            indent=2,
        )
    )
