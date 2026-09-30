"""Embedding统一服务：批处理、重试、校验和安全日志。"""

from collections.abc import Callable
from math import isfinite
from time import perf_counter, sleep

from app.ai.embeddings.bailian import BailianEmbeddingProvider
from app.ai.embeddings.base import BaseEmbeddingProvider, ProviderEmbeddingResult
from app.ai.embeddings.schemas import (
    EmbeddedChunk,
    EmbeddingChunkInput,
    EmbeddingInputType,
    EmbeddingRequest,
    EmbeddingResult,
)
from app.ai.exceptions import (
    EmbeddingConfigurationError,
    EmbeddingError,
    EmbeddingInputError,
    EmbeddingProviderError,
)
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class EmbeddingService:
    """向业务层提供稳定的Embedding入口，不写入数据库或向量库。"""

    def __init__(
        self,
        providers: dict[str, BaseEmbeddingProvider] | None = None,
        sleep_fn: Callable[[float], None] = sleep,
    ) -> None:
        self.providers = providers or {"bailian": BailianEmbeddingProvider()}
        self.sleep_fn = sleep_fn

    def _provider(self) -> BaseEmbeddingProvider:
        """根据配置选择Embedding Provider。"""
        try:
            return self.providers[settings.EMBEDDING_PROVIDER]
        except KeyError as exc:
            raise EmbeddingConfigurationError(
                f"未配置Embedding Provider: {settings.EMBEDDING_PROVIDER}"
            ) from exc

    @staticmethod
    def _validate_texts(texts: list[str]) -> None:
        """拒绝空输入、空文本和超过配置上限的文本。"""
        if not texts:
            raise EmbeddingInputError("Embedding文本列表不能为空")
        for index, text in enumerate(texts):
            if not isinstance(text, str) or not text.strip():
                raise EmbeddingInputError(f"第{index}条Embedding文本为空")
            if len(text) > settings.EMBEDDING_MAX_TEXT_CHARS:
                raise EmbeddingInputError(
                    f"第{index}条Embedding文本超过长度限制"
                    f"({settings.EMBEDDING_MAX_TEXT_CHARS}字符)"
                )

    @staticmethod
    def _validate_batch_result(
        result: ProviderEmbeddingResult,
        expected_count: int,
        batch_number: int,
    ) -> None:
        """校验供应商返回数量和配置维度。"""
        if len(result.vectors) != expected_count:
            raise EmbeddingError(
                f"Embedding第{batch_number}批返回数量不一致: "
                f"expected={expected_count}, actual={len(result.vectors)}"
            )
        for vector_index, vector in enumerate(result.vectors):
            if len(vector) != settings.EMBEDDING_DIMENSION:
                raise EmbeddingError(
                    f"Embedding第{batch_number}批第{vector_index}个向量维度不一致: "
                    f"expected={settings.EMBEDDING_DIMENSION}, actual={len(vector)}"
                )
            if any(not isfinite(value) for value in vector):
                raise EmbeddingError(
                    f"Embedding第{batch_number}批第{vector_index}个向量包含非有限数值"
                )

    def _call_batch(
        self,
        provider: BaseEmbeddingProvider,
        texts: list[str],
        input_type: EmbeddingInputType,
        batch_number: int,
    ) -> ProviderEmbeddingResult:
        """以有限次数重试单个批次，任何最终失败都向上抛出。"""
        max_attempts = settings.EMBEDDING_MAX_RETRIES + 1
        for attempt in range(1, max_attempts + 1):
            try:
                result = provider.embed(texts, input_type)
            except (EmbeddingConfigurationError, EmbeddingInputError):
                raise
            except EmbeddingProviderError as exc:
                if not exc.retryable:
                    raise
                if attempt >= max_attempts:
                    logger.warning(
                        "Embedding批次失败 | provider=%s model=%s batch=%s attempts=%s "
                        "status_code=%s provider_code=%s provider_message=%s request_id=%s "
                        "connection_types=%s errnos=%s winerrors=%s timeout_stages=%s",
                        provider.name,
                        settings.EMBEDDING_MODEL,
                        batch_number,
                        attempt,
                        exc.status_code,
                        exc.provider_code,
                        exc.provider_message,
                        exc.request_id,
                        tuple(item.exception_type for item in exc.connection_diagnostics),
                        tuple(item.errno for item in exc.connection_diagnostics),
                        tuple(item.winerror for item in exc.connection_diagnostics),
                        tuple(item.timeout_stage for item in exc.connection_diagnostics),
                    )
                    raise
                logger.warning(
                    "Embedding批次重试 | provider=%s model=%s batch=%s attempt=%s/%s "
                    "status_code=%s provider_code=%s provider_message=%s request_id=%s",
                    provider.name,
                    settings.EMBEDDING_MODEL,
                    batch_number,
                    attempt,
                    max_attempts,
                    exc.status_code,
                    exc.provider_code,
                    exc.provider_message,
                    exc.request_id,
                )
                self.sleep_fn(settings.EMBEDDING_RETRY_BACKOFF_SECONDS)
            except Exception as exc:
                logger.warning(
                    "Embedding批次失败 | provider=%s model=%s batch=%s attempts=%s "
                    "status_code=%s provider_code=%s provider_message=%s request_id=%s",
                    provider.name,
                    settings.EMBEDDING_MODEL,
                    batch_number,
                    attempt,
                    None,
                    None,
                    None,
                    None,
                )
                if isinstance(exc, EmbeddingError):
                    raise
                raise EmbeddingProviderError(
                    f"Embedding Provider调用失败: {type(exc).__name__}"
                ) from exc
            else:
                self._validate_batch_result(result, len(texts), batch_number)
                return result
        raise EmbeddingError("Embedding批次处理未返回结果")

    def embed(self, request: EmbeddingRequest) -> EmbeddingResult:
        """批量生成向量并返回统一结果。"""
        self._validate_texts(request.texts)
        provider = self._provider()
        started_at = perf_counter()
        vectors: list[list[float]] = []
        total_token_usage = 0
        has_token_usage = False
        batch_size = settings.EMBEDDING_BATCH_SIZE

        for offset in range(0, len(request.texts), batch_size):
            batch = request.texts[offset : offset + batch_size]
            result = self._call_batch(
                provider,
                batch,
                request.input_type,
                batch_number=offset // batch_size + 1,
            )
            vectors.extend(result.vectors)
            if result.token_usage is not None:
                total_token_usage += result.token_usage
                has_token_usage = True

        latency_ms = (perf_counter() - started_at) * 1000
        logger.info(
            "Embedding调用成功 | provider=%s model=%s input_type=%s "
            "texts=%s batches=%s dimension=%s latency_ms=%.2f",
            provider.name,
            settings.EMBEDDING_MODEL,
            request.input_type.value,
            len(request.texts),
            (len(request.texts) + batch_size - 1) // batch_size,
            settings.EMBEDDING_DIMENSION,
            latency_ms,
        )
        return EmbeddingResult(
            vectors=vectors,
            provider=provider.name,
            model=settings.EMBEDDING_MODEL,
            dimension=settings.EMBEDDING_DIMENSION,
            token_usage=total_token_usage if has_token_usage else None,
            latency_ms=latency_ms,
        )

    def embed_documents(self, texts: list[str]) -> EmbeddingResult:
        """生成文档向量。"""
        return self.embed(
            EmbeddingRequest(texts=texts, input_type=EmbeddingInputType.DOCUMENT)
        )

    def embed_query(self, text: str) -> EmbeddingResult:
        """生成查询向量。"""
        return self.embed(
            EmbeddingRequest(texts=[text], input_type=EmbeddingInputType.QUERY)
        )

    def embed_chunks(self, chunks: list[EmbeddingChunkInput]) -> list[EmbeddedChunk]:
        """为未来索引层生成带Chunk身份的向量，不执行任何写入。"""
        if not chunks:
            return []
        result = self.embed_documents([chunk.chunk_text for chunk in chunks])
        return [
            EmbeddedChunk(
                chunk_id=chunk.chunk_id,
                vector=vector,
                provider=result.provider,
                model=result.model,
                dimension=result.dimension,
                content_hash=chunk.content_hash,
            )
            for chunk, vector in zip(chunks, result.vectors, strict=True)
        ]


embedding_service = EmbeddingService()
