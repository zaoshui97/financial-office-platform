"""阿里云百炼Embedding Provider。"""

import re
from typing import Any

import httpx
from openai import APIConnectionError, APIStatusError, APITimeoutError, OpenAI, RateLimitError

from app.ai.embeddings.base import BaseEmbeddingProvider, ProviderEmbeddingResult
from app.ai.embeddings.schemas import EmbeddingInputType
from app.ai.exceptions import (
    EmbeddingConfigurationError,
    EmbeddingConnectionDiagnostic,
    EmbeddingInputError,
    EmbeddingProviderError,
)
from app.core.config import settings


class BailianEmbeddingProvider(BaseEmbeddingProvider):
    """通过百炼OpenAI Compatible接口生成文本向量。"""

    name = "bailian"
    _MAX_ERROR_CODE_LENGTH = 128
    _MAX_ERROR_MESSAGE_LENGTH = 512
    _MAX_REQUEST_ID_LENGTH = 128

    _TIMEOUT_STAGES: tuple[tuple[type[Exception], str], ...] = (
        (httpx.ConnectTimeout, "connect"),
        (httpx.ReadTimeout, "read"),
        (httpx.WriteTimeout, "write"),
        (httpx.PoolTimeout, "pool"),
    )

    def __init__(self) -> None:
        self._client_instance: OpenAI | None = None

    def _build_client(self) -> OpenAI:
        """按配置懒加载并复用客户端，不在初始化时发起网络请求。"""
        api_key = settings.EMBEDDING_API_KEY or settings.QWEN_API_KEY
        if not api_key:
            raise EmbeddingConfigurationError(
                "Embedding未配置API密钥，请设置EMBEDDING_API_KEY或QWEN_API_KEY"
            )
        if self._client_instance is None:
            self._client_instance = OpenAI(
                api_key=api_key,
                base_url=settings.EMBEDDING_BASE_URL,
                timeout=settings.EMBEDDING_TIMEOUT_SECONDS,
                max_retries=0,
                http_client=httpx.Client(trust_env=settings.EMBEDDING_TRUST_ENV),
            )
        return self._client_instance

    @staticmethod
    def _extract_vectors(response: Any, expected_count: int) -> list[list[float]]:
        """读取OpenAI Compatible响应并按index恢复输入顺序。"""
        items = list(getattr(response, "data", []) or [])
        indexed_items = [
            (int(getattr(item, "index", index)), list(getattr(item, "embedding", [])))
            for index, item in enumerate(items)
        ]
        indexed_items.sort(key=lambda item: item[0])
        indexes = [index for index, _ in indexed_items]
        if indexes != list(range(expected_count)):
            raise EmbeddingProviderError("百炼Embedding响应索引无效")
        return [vector for _, vector in indexed_items]

    @staticmethod
    def _provider_error(exc: Exception) -> EmbeddingProviderError:
        """将SDK异常转换为可识别是否适合重试的安全错误。"""
        retryable = isinstance(
            exc,
            (APIConnectionError, APITimeoutError, RateLimitError),
        )
        if isinstance(exc, APIStatusError):
            retryable = exc.status_code in {408, 409, 429} or exc.status_code >= 500
            provider_code, provider_message = BailianEmbeddingProvider._extract_error_fields(exc)
            request_id = BailianEmbeddingProvider._safe_request_id(
                getattr(exc, "request_id", None)
            )
            if not request_id:
                response = getattr(exc, "response", None)
                headers = getattr(response, "headers", {})
                for header_name in ("x-request-id", "request-id"):
                    request_id = BailianEmbeddingProvider._safe_request_id(
                        headers.get(header_name)
                    )
                    if request_id:
                        break
            if not request_id:
                request_id = BailianEmbeddingProvider._safe_request_id(
                    BailianEmbeddingProvider._body_value(exc.body, "request_id")
                )
            return EmbeddingProviderError(
                f"百炼Embedding调用失败: {type(exc).__name__}",
                retryable=retryable,
                status_code=exc.status_code,
                provider_code=provider_code,
                provider_message=provider_message,
                request_id=request_id,
            )
        connection_diagnostics = ()
        if isinstance(exc, (APIConnectionError, APITimeoutError)):
            connection_diagnostics = BailianEmbeddingProvider._connection_diagnostics(exc)
        return EmbeddingProviderError(
            f"百炼Embedding调用失败: {type(exc).__name__}",
            retryable=retryable,
            connection_diagnostics=connection_diagnostics,
        )

    @staticmethod
    def _connection_diagnostics(
        exc: Exception,
    ) -> tuple[EmbeddingConnectionDiagnostic, ...]:
        """遍历连接异常链，仅提取安全的类型、系统错误码和超时阶段。"""
        diagnostics: list[EmbeddingConnectionDiagnostic] = []
        pending: list[BaseException] = [exc]
        seen: set[int] = set()
        while pending:
            current = pending.pop(0)
            if id(current) in seen:
                continue
            seen.add(id(current))
            timeout_stage = next(
                (
                    stage
                    for exception_type, stage in BailianEmbeddingProvider._TIMEOUT_STAGES
                    if isinstance(current, exception_type)
                ),
                None,
            )
            errno = getattr(current, "errno", None)
            winerror = getattr(current, "winerror", None)
            diagnostics.append(
                EmbeddingConnectionDiagnostic(
                    exception_type=type(current).__name__[:128],
                    errno=errno if isinstance(errno, int) and not isinstance(errno, bool) else None,
                    winerror=(
                        winerror
                        if isinstance(winerror, int) and not isinstance(winerror, bool)
                        else None
                    ),
                    timeout_stage=timeout_stage,
                )
            )
            for linked in (current.__cause__, current.__context__):
                if linked is not None and id(linked) not in seen:
                    pending.append(linked)
        return tuple(diagnostics)

    @staticmethod
    def _body_value(body: object, key: str) -> object | None:
        """从供应商错误结构中读取单个字段，不保留完整响应正文。"""
        if not isinstance(body, dict):
            return None
        error = body.get("error")
        if isinstance(error, dict) and key in error:
            return error[key]
        return body.get(key)

    @staticmethod
    def _safe_text(value: object, limit: int) -> str | None:
        """将服务端字段限制为短文本，并遮蔽可能的敏感内容。"""
        if not isinstance(value, (str, int, float)) or isinstance(value, bool):
            return None
        text = str(value).strip()
        if not text:
            return None
        text = re.sub(
            r"(?i)authorization\s*:\s*bearer\s+[^\s,;]+",
            "Authorization: [REDACTED]",
            text,
        )
        text = re.sub(
            r"(?i)(api[-_ ]?key|access[-_ ]?token|secret)\s*[:=]\s*[^\s,;]+",
            r"\1=[REDACTED]",
            text,
        )
        text = re.sub(r"https?://[^\s]+\?[^\s]+", "[URL_REDACTED]", text)
        text = re.sub(
            r'(?i)(input|text|content|prompt|embedding)\s*[=:]\s*("[^"]*"|\[[^\]]*\])',
            r"\1=[REDACTED]",
            text,
        )
        return text[:limit]

    @staticmethod
    def _safe_request_id(value: object) -> str | None:
        """仅保留可作为追踪标识的短请求ID。"""
        text = BailianEmbeddingProvider._safe_text(
            value, BailianEmbeddingProvider._MAX_REQUEST_ID_LENGTH
        )
        if text and re.fullmatch(r"[A-Za-z0-9._:-]+", text):
            return text
        return None

    @staticmethod
    def _extract_error_fields(exc: APIStatusError) -> tuple[str | None, str | None]:
        """从SDK已解析的错误体提取code和message，不读取完整响应正文。"""
        body = getattr(exc, "body", None)
        code = BailianEmbeddingProvider._safe_text(
            BailianEmbeddingProvider._body_value(body, "code"),
            BailianEmbeddingProvider._MAX_ERROR_CODE_LENGTH,
        )
        message = BailianEmbeddingProvider._safe_text(
            BailianEmbeddingProvider._body_value(body, "message"),
            BailianEmbeddingProvider._MAX_ERROR_MESSAGE_LENGTH,
        )
        return code, message

    def embed(
        self,
        texts: list[str],
        input_type: EmbeddingInputType,
    ) -> ProviderEmbeddingResult:
        """调用百炼Embedding接口生成一批向量。"""
        if not texts:
            raise EmbeddingInputError("Embedding文本列表不能为空")
        if any(not text.strip() for text in texts):
            raise EmbeddingInputError("Embedding文本不能包含空文本")

        payload: dict[str, Any] = {
            "model": settings.EMBEDDING_MODEL,
            "input": texts,
            "dimensions": settings.EMBEDDING_DIMENSION,
            "encoding_format": "float",
        }
        # 百炼兼容接口不接收input_type；用途仅保留在统一服务层。
        _ = input_type
        try:
            response = self._build_client().embeddings.create(**payload)
            vectors = self._extract_vectors(response, len(texts))
            usage = getattr(getattr(response, "usage", None), "total_tokens", None)
            return ProviderEmbeddingResult(
                vectors=vectors,
                token_usage=int(usage) if usage is not None else None,
            )
        except (EmbeddingConfigurationError, EmbeddingInputError, EmbeddingProviderError):
            raise
        except Exception as exc:
            raise self._provider_error(exc) from exc
