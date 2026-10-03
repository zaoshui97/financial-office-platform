"""动态AI任务路由：模型配置、Provider配置和fallback候选。"""

import json
import os
from dataclasses import dataclass
from typing import Any

from app.ai.exceptions import AIConfigurationError
from app.ai.schemas import AIRequest, AITask
from app.core.config import settings


@dataclass(frozen=True)
class ProviderConfig:
    """一个模型Provider的连接配置。"""

    name: str
    base_url: str
    api_key: str
    api_key_env: str
    api_style: str
    timeout_seconds: int
    max_retries: int = 0


@dataclass(frozen=True)
class ModelProfile:
    """一个可路由模型的配置。"""

    name: str
    provider: str
    model: str
    temperature: float = 0.2
    max_tokens: int | None = None
    api_style: str | None = None
    supports_long_context: bool = False
    supports_tools: bool = False
    supports_reasoning: bool = False


def _json_object(value: str, setting_name: str) -> dict[str, Any]:
    """解析JSON对象配置并提供明确的配置错误。"""
    if not value.strip():
        return {}
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError as exc:
        raise AIConfigurationError(f"{setting_name}不是有效JSON") from exc
    if not isinstance(parsed, dict):
        raise AIConfigurationError(f"{setting_name}必须是JSON对象")
    return parsed


def _api_key_from_env(environment_name: str, fallback: str = "") -> str:
    """优先从Settings读取.env字段，再读取部署环境变量。"""
    configured_values = {
        "AI_API_KEY": settings.AI_API_KEY,
        "ARK_API_KEY": settings.ARK_API_KEY,
        "DEEPSEEK_API_KEY": settings.DEEPSEEK_API_KEY,
        "DOUBAO_API_KEY": settings.DOUBAO_API_KEY,
        "QWEN_API_KEY": settings.QWEN_API_KEY,
    }
    return configured_values.get(environment_name, "") or os.getenv(
        environment_name, fallback
    )


class ModelRouter:
    """按任务、复杂度和能力要求返回有序模型候选。"""

    def provider_configs(self) -> dict[str, ProviderConfig]:
        """加载Provider连接配置，密钥只从环境变量读取。"""
        compatibility_key = settings.AI_API_KEY.strip()
        ark_key = settings.ARK_API_KEY.strip()
        if (
            compatibility_key.lower().startswith("ark-")
            and len(compatibility_key) > len(ark_key)
        ):
            ark_key = compatibility_key

        defaults = {
            "openai_compatible": ProviderConfig(
                name="openai_compatible",
                base_url=settings.AI_BASE_URL,
                api_key=compatibility_key,
                api_key_env="AI_API_KEY",
                api_style=settings.AI_API_STYLE,
                timeout_seconds=settings.AI_TIMEOUT_SECONDS,
                max_retries=settings.AI_SDK_MAX_RETRIES,
            ),
            "ark": ProviderConfig(
                name="ark",
                base_url=settings.ARK_BASE_URL,
                api_key=ark_key,
                api_key_env="ARK_API_KEY or AI_API_KEY",
                api_style="responses",
                timeout_seconds=settings.AI_TIMEOUT_SECONDS,
                max_retries=settings.AI_SDK_MAX_RETRIES,
            ),
            "deepseek": ProviderConfig(
                name="deepseek",
                base_url=settings.DEEPSEEK_BASE_URL,
                api_key=settings.DEEPSEEK_API_KEY or os.getenv("DEEPSEEK_API_KEY", ""),
                api_key_env="DEEPSEEK_API_KEY",
                api_style="chat_completions",
                timeout_seconds=settings.AI_TIMEOUT_SECONDS,
                max_retries=settings.AI_SDK_MAX_RETRIES,
            ),
            "doubao": ProviderConfig(
                name="doubao",
                base_url=settings.DOUBAO_BASE_URL,
                api_key=(
                    settings.DOUBAO_API_KEY
                    or os.getenv("DOUBAO_API_KEY", "")
                    or ark_key
                ),
                api_key_env="DOUBAO_API_KEY or ARK_API_KEY",
                api_style="responses",
                timeout_seconds=settings.AI_TIMEOUT_SECONDS,
                max_retries=settings.AI_SDK_MAX_RETRIES,
            ),
            "qwen": ProviderConfig(
                name="qwen",
                base_url=settings.QWEN_BASE_URL,
                api_key=settings.QWEN_API_KEY or os.getenv("QWEN_API_KEY", ""),
                api_key_env="QWEN_API_KEY",
                api_style="chat_completions",
                timeout_seconds=settings.AI_TIMEOUT_SECONDS,
                max_retries=settings.AI_SDK_MAX_RETRIES,
            ),
        }
        for name, raw_config in _json_object(
            settings.AI_PROVIDERS_JSON, "AI_PROVIDERS_JSON"
        ).items():
            if not isinstance(raw_config, dict):
                raise AIConfigurationError(f"Provider配置必须是对象: {name}")
            current = defaults.get(
                name,
                ProviderConfig(
                    name=name,
                    base_url="",
                    api_key="",
                    api_key_env="",
                    api_style="chat_completions",
                    timeout_seconds=settings.AI_TIMEOUT_SECONDS,
                    max_retries=settings.AI_SDK_MAX_RETRIES,
                ),
            )
            api_key_env = str(raw_config.get("api_key_env", current.api_key_env))
            api_key = (
                _api_key_from_env(api_key_env, current.api_key)
                if api_key_env
                else current.api_key
            )
            defaults[name] = ProviderConfig(
                name=name,
                base_url=str(raw_config.get("base_url", current.base_url)),
                api_key=api_key or str(raw_config.get("api_key", current.api_key)),
                api_key_env=api_key_env,
                api_style=str(raw_config.get("api_style", current.api_style)),
                timeout_seconds=int(
                    raw_config.get("timeout_seconds", current.timeout_seconds)
                ),
                max_retries=int(raw_config.get("max_retries", current.max_retries)),
            )
        return defaults

    def _legacy_profiles(self) -> dict[str, ModelProfile]:
        """从现有单Provider配置生成兼容模型档案。"""
        model_by_task = {
            "chat": settings.AI_CHAT_MODEL,
            "rag": settings.AI_RAG_MODEL,
            "web_search": settings.AI_WEB_SEARCH_MODEL,
            "document_generation": settings.AI_DOCUMENT_MODEL,
            "summary": settings.AI_SUMMARY_MODEL,
            "long_context_summary": settings.AI_SUMMARY_MODEL,
            "meeting": settings.AI_MEETING_MODEL,
            "agent": settings.AI_AGENT_MODEL,
            "code_reasoning": settings.AI_CHAT_MODEL,
        }
        temperature_by_task = {
            "chat": 0.4,
            "rag": 0.2,
            "web_search": 0.2,
            "document_generation": 0.6,
            "summary": 0.2,
            "long_context_summary": 0.2,
            "meeting": 0.1,
            "agent": 0.1,
            "code_reasoning": 0.1,
        }
        profiles: dict[str, ModelProfile] = {}
        for task_name, model in model_by_task.items():
            resolved_model = model.strip() or settings.AI_CHAT_MODEL.strip()
            if not resolved_model:
                continue
            profiles[task_name] = ModelProfile(
                name=task_name,
                provider=settings.AI_PROVIDER,
                model=resolved_model,
                temperature=temperature_by_task[task_name],
                api_style="responses"
                if settings.AI_PROVIDER in {"ark", "doubao"}
                else settings.AI_API_STYLE,
                supports_long_context=task_name in {"rag", "long_context_summary"},
                supports_tools=task_name in {"web_search", "agent"},
                supports_reasoning=task_name in {"code_reasoning", "agent"},
            )
        return profiles

    def _builtin_profiles(self) -> dict[str, ModelProfile]:
        """生成DeepSeek、豆包和Qwen的标准能力档案。"""
        deepseek_model = settings.DEEPSEEK_MODEL.strip()
        doubao_model = settings.DOUBAO_MODEL.strip() or settings.AI_DOCUMENT_MODEL.strip()
        qwen_model = settings.QWEN_MODEL.strip()
        profiles: dict[str, ModelProfile] = {}
        if deepseek_model:
            profiles["deepseek_reasoning"] = ModelProfile(
                name="deepseek_reasoning",
                provider="deepseek",
                model=deepseek_model,
                temperature=0.1,
                supports_tools=True,
                supports_reasoning=True,
            )
        if qwen_model:
            profiles["qwen_knowledge"] = ModelProfile(
                name="qwen_knowledge",
                provider="qwen",
                model=qwen_model,
                temperature=0.2,
                supports_long_context=True,
                supports_tools=True,
            )
        if doubao_model:
            profiles["doubao_office"] = ModelProfile(
                name="doubao_office",
                provider="doubao",
                model=doubao_model,
                temperature=0.5,
                supports_long_context=True,
                supports_tools=True,
            )
        return profiles

    @staticmethod
    def _builtin_routes() -> dict[str, list[str]]:
        """返回平台任务到模型能力档案的默认路由。"""
        return {
            AITask.CHAT.value: ["doubao_office", "qwen_knowledge", "deepseek_reasoning"],
            AITask.DOCUMENT_GENERATION.value: ["doubao_office", "qwen_knowledge"],
            AITask.EMAIL_GENERATION.value: ["doubao_office", "qwen_knowledge"],
            AITask.OFFICIAL_DOCUMENT.value: ["doubao_office", "qwen_knowledge"],
            AITask.CHINESE_POLISHING.value: ["doubao_office", "qwen_knowledge"],
            AITask.MEETING.value: ["doubao_office", "qwen_knowledge"],
            AITask.MEETING_MINUTES.value: ["doubao_office", "qwen_knowledge"],
            AITask.WEB_SEARCH.value: ["doubao_office"],
            AITask.SUMMARY.value: ["qwen_knowledge", "doubao_office"],
            AITask.LONG_CONTEXT_SUMMARY.value: ["qwen_knowledge", "doubao_office"],
            AITask.RAG.value: ["qwen_knowledge", "deepseek_reasoning"],
            AITask.RAG_ANSWER.value: ["qwen_knowledge", "deepseek_reasoning"],
            AITask.KNOWLEDGE_QUESTION.value: ["qwen_knowledge", "deepseek_reasoning"],
            AITask.FILE_QA.value: ["qwen_knowledge", "deepseek_reasoning"],
            AITask.DOCUMENT_ANALYSIS.value: ["qwen_knowledge", "deepseek_reasoning"],
            AITask.CODE_REASONING.value: ["deepseek_reasoning", "qwen_knowledge"],
            AITask.FINANCIAL_ANALYSIS.value: ["deepseek_reasoning", "qwen_knowledge"],
            AITask.AGENT.value: ["deepseek_reasoning", "qwen_knowledge"],
            AITask.AGENT_PLANNING.value: ["deepseek_reasoning", "qwen_knowledge"],
            AITask.WORKFLOW_DECISION.value: ["deepseek_reasoning", "qwen_knowledge"],
            AITask.SQL_GENERATION.value: ["deepseek_reasoning", "qwen_knowledge"],
            AITask.COMPLEX_LOGIC.value: ["deepseek_reasoning", "qwen_knowledge"],
            AITask.SINK.value: ["qwen3_max", "deepseek_v3"],
            "default": ["doubao_office", "qwen_knowledge", "deepseek_reasoning"],
        }

    def profiles(self) -> dict[str, ModelProfile]:
        """加载动态模型档案，没有JSON时回退现有配置。"""
        profiles = self._legacy_profiles()
        profiles.update(self._builtin_profiles())
        for name, raw_profile in _json_object(
            settings.AI_MODEL_PROFILES_JSON, "AI_MODEL_PROFILES_JSON"
        ).items():
            if not isinstance(raw_profile, dict):
                raise AIConfigurationError(f"模型档案必须是对象: {name}")
            try:
                profiles[name] = ModelProfile(
                    name=name,
                    provider=str(raw_profile["provider"]),
                    model=str(raw_profile["model"]),
                    temperature=float(raw_profile.get("temperature", 0.2)),
                    max_tokens=(
                        int(raw_profile["max_tokens"])
                        if raw_profile.get("max_tokens") is not None
                        else None
                    ),
                    api_style=(
                        str(raw_profile["api_style"])
                        if raw_profile.get("api_style")
                        else None
                    ),
                    supports_long_context=bool(raw_profile.get("supports_long_context")),
                    supports_tools=bool(raw_profile.get("supports_tools")),
                    supports_reasoning=bool(raw_profile.get("supports_reasoning")),
                )
            except (KeyError, TypeError, ValueError) as exc:
                raise AIConfigurationError(f"模型档案配置无效: {name}") from exc
        return profiles

    def candidates_for(self, request: AIRequest) -> list[ModelProfile]:
        """按路由JSON返回主模型和fallback模型的有序列表。"""
        task_name = request.task_name
        profiles = self.profiles()
        routes = self._builtin_routes()
        routes.update(_json_object(settings.AI_TASK_ROUTES_JSON, "AI_TASK_ROUTES_JSON"))
        configured_route = routes.get(task_name)
        if configured_route is None:
            configured_route = routes.get("default")
        if not isinstance(configured_route, list):
            raise AIConfigurationError(f"任务路由必须是数组: {task_name}")

        candidates: list[ModelProfile] = []
        for profile_name in configured_route:
            if not isinstance(profile_name, str):
                raise AIConfigurationError(f"任务路由模型档案名必须是字符串: {task_name}")
            if profile_name not in profiles:
                if profile_name in {
                    "deepseek_reasoning",
                    "doubao_office",
                    "qwen_knowledge",
                }:
                    continue
                raise AIConfigurationError(f"任务路由引用了不存在的模型档案: {profile_name}")
            candidates.append(profiles[profile_name])
        if not candidates:
            raise AIConfigurationError(f"任务没有可用模型: {task_name}")

        candidates.sort(
            key=lambda item: (
                request.need_long_context and not item.supports_long_context,
                request.need_tools and not item.supports_tools,
                request.complexity.value == "high" and not item.supports_reasoning,
            )
        )
        return candidates

    def profile_for(self, task: AITask | str) -> ModelProfile:
        """保留旧调用方式，返回任务的首选模型。"""
        request = AIRequest(task=task)
        return self.candidates_for(request)[0]

    def provider_for(self, name: str) -> ProviderConfig:
        """返回Provider连接配置。"""
        try:
            return self.provider_configs()[name]
        except KeyError as exc:
            raise AIConfigurationError(f"未配置Provider: {name}") from exc


model_router = ModelRouter()
