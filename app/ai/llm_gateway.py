"""统一AI Gateway：路由、Provider调用、fallback、用量和日志。"""

from collections.abc import Iterator
from dataclasses import replace
from time import perf_counter, sleep

from app.ai.exceptions import AIConfigurationError, AIError, AIProviderError
from app.ai.model_router import ModelProfile, model_router
from app.ai.providers import AIProvider, create_default_providers
from app.ai.schemas import AIRequest, AIResponse, AITask
from app.ai.usage import UsageRecord, UsageRecorder, elapsed_ms, new_request_id, usage_recorder
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

PLAIN_SYSTEM_PROMPT = """你是金融企业智能办公平台的AI助手。
请使用简体中文提供准确、清晰、可执行的回答。
不确定的信息需要明确说明，不要虚构企业内部制度。
用户未指定篇幅时，将回答控制在800字以内，直接给出最终结果，不输出思考过程。"""

RAG_SYSTEM_PROMPT = """你是企业知识库问答助手。
请严格依据系统提供的企业文档片段回答，不要使用未在材料中出现的内部制度或数字。
重要结论后使用[1]、[2]格式标注对应材料。如果材料不足，请明确说明。"""

WEB_SEARCH_SYSTEM_PROMPT = """你是金融企业智能办公平台的联网信息助手。
请优先使用搜索结果回答，区分事实与推断，并在信息可能变化时明确说明查询时效。
不得把互联网信息表述为企业内部制度。"""


class LLMServiceError(RuntimeError):
    """保持旧业务层兼容的统一AI调用异常。"""


class LLMGateway:
    """对业务层提供稳定入口，对底层Provider提供可扩展边界。"""

    def __init__(
        self,
        providers: dict[str, AIProvider] | None = None,
        recorder: UsageRecorder | None = None,
    ) -> None:
        """创建Gateway，测试或扩展Provider时可注入依赖。"""
        self._providers = providers or create_default_providers()
        self._recorder = recorder or usage_recorder
        self._last_response: AIResponse | None = None

    @property
    def last_response(self) -> AIResponse | None:
        """返回最近一次成功的统一响应，供兼容业务入口读取调用元数据。"""
        return self._last_response

    @staticmethod
    def _instructions(task: str, contexts: list[str] | None) -> str:
        """构建任务系统指令。"""
        if task == AITask.RAG.value:
            knowledge_context = "\n\n".join(contexts or [])
            return (
                f"{RAG_SYSTEM_PROMPT}\n\n"
                f"以下是可引用的企业知识库材料：\n{knowledge_context}"
            )
        if task == AITask.WEB_SEARCH.value:
            return WEB_SEARCH_SYSTEM_PROMPT
        return PLAIN_SYSTEM_PROMPT

    @staticmethod
    def _provider_for(
        provider_name: str,
        providers: dict[str, AIProvider],
    ) -> AIProvider:
        """按Provider名获取具名实现，未知兼容厂商回退通用实现。"""
        provider = providers.get(provider_name) or providers.get("openai_compatible")
        if provider is None:
            raise AIConfigurationError(f"未注册Provider实现: {provider_name}")
        return provider

    def generate(self, request: AIRequest) -> AIResponse:
        """执行统一AI请求，按路由顺序尝试主模型和fallback模型。"""
        request_id = str(request.metadata.get("request_id") or new_request_id())
        candidates = model_router.candidates_for(request)
        failures: list[str] = []

        for candidate_index, profile in enumerate(candidates):
            if candidate_index > 0 and not settings.AI_FALLBACK_ENABLED:
                break
            provider_config = model_router.provider_for(profile.provider)
            if profile.api_style and profile.api_style != provider_config.api_style:
                provider_config = replace(provider_config, api_style=profile.api_style)
            provider = self._provider_for(profile.provider, self._providers)
            attempts = settings.AI_MAX_RETRIES + 1

            for attempt in range(1, attempts + 1):
                started_at = perf_counter()
                try:
                    request_for_attempt = request
                    if request.max_tokens is None and profile.max_tokens is not None:
                        request_for_attempt = request.model_copy(
                            update={"max_tokens": profile.max_tokens}
                        )
                    response = provider.chat(
                        request_for_attempt,
                        profile,
                        provider_config,
                    )
                    response = response.model_copy(
                        update={
                            "task": request.task_name,
                            "latency_ms": elapsed_ms(started_at),
                            "request_id": request_id,
                        }
                    )
                    self._last_response = response
                    self._record_usage(
                        request_id=request_id,
                        request=request,
                        profile=profile,
                        response=response,
                        latency_ms=elapsed_ms(started_at),
                        success=True,
                        attempt=attempt,
                    )
                    logger.info(
                        "AI模型调用成功 | request_id=%s task=%s provider=%s model=%s "
                        "latency_ms=%.2f fallback_count=%s",
                        request_id,
                        request.task_name,
                        profile.provider,
                        profile.model,
                        elapsed_ms(started_at),
                        candidate_index,
                    )
                    return response
                except Exception as exc:
                    error = self._safe_error(exc)
                    failures.append(f"{profile.provider}/{profile.model}: {error}")
                    self._record_usage(
                        request_id=request_id,
                        request=request,
                        profile=profile,
                        response=None,
                        latency_ms=elapsed_ms(started_at),
                        success=False,
                        attempt=attempt,
                        error=error,
                    )
                    logger.warning(
                        "AI模型调用失败，将尝试备用模型 | request_id=%s provider=%s "
                        "model=%s attempt=%s error=%s",
                        request_id,
                        profile.provider,
                        profile.model,
                        attempt,
                        error,
                    )
                    if attempt < attempts or candidate_index < len(candidates) - 1:
                        sleep(settings.AI_RETRY_BACKOFF_SECONDS * attempt)

        raise LLMServiceError("所有候选模型调用失败: " + "; ".join(failures))

    def stream_chat(self, request: AIRequest) -> Iterator[str]:
        """按任务路由执行流式对话，首段输出前允许切换fallback。"""
        candidates = model_router.candidates_for(request)
        failures: list[str] = []

        for candidate_index, profile in enumerate(candidates):
            if candidate_index > 0 and not settings.AI_FALLBACK_ENABLED:
                break
            provider_config = model_router.provider_for(profile.provider)
            if profile.api_style and profile.api_style != provider_config.api_style:
                provider_config = replace(provider_config, api_style=profile.api_style)
            provider = self._provider_for(profile.provider, self._providers)
            request_for_attempt = request
            if request.max_tokens is None and profile.max_tokens is not None:
                request_for_attempt = request.model_copy(
                    update={"max_tokens": profile.max_tokens}
                )

            emitted = False
            try:
                for chunk in provider.stream_chat(
                    request_for_attempt,
                    profile,
                    provider_config,
                ):
                    emitted = True
                    yield chunk
                return
            except Exception as exc:
                error = self._safe_error(exc)
                failures.append(f"{profile.provider}/{profile.model}: {error}")
                if emitted:
                    raise LLMServiceError(f"流式模型响应中断: {error}") from exc

        raise LLMServiceError("所有候选模型流式调用失败: " + "; ".join(failures))

    def count_tokens(self, request: AIRequest) -> int:
        """使用首选模型Provider估算请求Token数量。"""
        profile = model_router.candidates_for(request)[0]
        provider = self._provider_for(profile.provider, self._providers)
        return provider.count_tokens(request)

    def complete(
        self,
        history: list[dict[str, str]],
        contexts: list[str] | None = None,
        task: AITask | None = None,
    ) -> str:
        """兼容现有业务层的文本调用入口。"""
        self._last_response = None
        resolved_task = task or (AITask.RAG if contexts else AITask.CHAT)
        task_name = resolved_task.value
        if resolved_task == AITask.RAG and not contexts:
            raise LLMServiceError("RAG任务缺少知识库上下文")
        request = AIRequest(
            task=task_name,
            messages=history,
            instructions=self._instructions(task_name, contexts),
            need_long_context=resolved_task
            in {AITask.RAG, AITask.LONG_CONTEXT_SUMMARY},
            need_web_search=resolved_task == AITask.WEB_SEARCH,
            need_tools=resolved_task in {AITask.WEB_SEARCH, AITask.AGENT},
        )
        return self.generate(request).text

    def stream_complete(
        self,
        history: list[dict[str, str]],
        contexts: list[str] | None = None,
        task: AITask | None = None,
    ) -> Iterator[str]:
        """流式版本 complete：逐段 yield 文本 chunk。

        与 complete 区别：
          - 不返回完整字符串，逐段 yield（流式）
          - 失败时（首段前）抛 LLMServiceError；失败时（已开始 yield）静默终止
          - 内部用 self.stream_chat(AIRequest) 实现，自动复用路由 + fallback
        """
        self._last_response = None
        resolved_task = task or (AITask.RAG if contexts else AITask.CHAT)
        task_name = resolved_task.value
        if resolved_task == AITask.RAG and not contexts:
            raise LLMServiceError("RAG任务缺少知识库上下文")
        request = AIRequest(
            task=task_name,
            messages=history,
            instructions=self._instructions(task_name, contexts),
            need_long_context=resolved_task
            in {AITask.RAG, AITask.LONG_CONTEXT_SUMMARY},
            need_web_search=resolved_task == AITask.WEB_SEARCH,
            need_tools=resolved_task in {AITask.WEB_SEARCH, AITask.AGENT},
        )
        yield from self.stream_chat(request)

    def complete_with_metadata(
        self,
        history: list[dict[str, str]],
        contexts: list[str] | None = None,
        task: AITask | None = None,
    ) -> AIResponse:
        """保留文本兼容性的同时返回Provider、模型和耗时元数据。"""
        self._last_response = None
        resolved_task = task or (AITask.RAG if contexts else AITask.CHAT)
        answer = self.complete(history, contexts=contexts, task=resolved_task)
        if self._last_response is not None:
            return self._last_response
        return AIResponse(text=answer, task=resolved_task.value)

    def _record_usage(
        self,
        request_id: str,
        request: AIRequest,
        profile: ModelProfile,
        response: AIResponse | None,
        latency_ms: float,
        success: bool,
        attempt: int,
        error: str | None = None,
    ) -> None:
        """记录每次尝试的Token、耗时和结果。"""
        usage = response.usage if response is not None else None
        self._recorder.record(
            UsageRecord(
                request_id=request_id,
                task=request.task_name,
                provider=profile.provider,
                model=profile.model,
                usage=usage or self._empty_usage(),
                latency_ms=latency_ms,
                success=success,
                attempt=attempt,
                error=error,
            )
        )

    @staticmethod
    def _empty_usage():
        """构造失败调用的空用量，避免在失败路径伪造Token。"""
        from app.ai.schemas import TokenUsage

        return TokenUsage()

    @staticmethod
    def _safe_error(error: Exception) -> str:
        """过滤异常文本中的潜在密钥，只保留可用于排障的信息。"""
        if isinstance(error, (AIError, AIProviderError)):
            return str(error)
        return f"{type(error).__name__}: remote provider failure"


llm_gateway = LLMGateway()
