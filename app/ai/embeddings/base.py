"""Embedding Provider抽象和供应商内部返回结构。"""

from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.ai.embeddings.schemas import EmbeddingInputType


@dataclass(frozen=True)
class ProviderEmbeddingResult:
    """单次供应商请求的原始向量结果。"""

    vectors: list[list[float]]
    token_usage: int | None = None


class BaseEmbeddingProvider(ABC):
    """所有Embedding供应商的统一接口。"""

    name: str

    @abstractmethod
    def embed(
        self,
        texts: list[str],
        input_type: EmbeddingInputType,
    ) -> ProviderEmbeddingResult:
        """生成一批文本向量。"""

    def embed_documents(self, texts: list[str]) -> ProviderEmbeddingResult:
        """生成文档向量。"""
        return self.embed(texts, EmbeddingInputType.DOCUMENT)

    def embed_query(self, text: str) -> ProviderEmbeddingResult:
        """生成查询向量。"""
        return self.embed([text], EmbeddingInputType.QUERY)
