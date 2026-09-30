"""统一Embedding基础设施。"""

from app.ai.embeddings.bailian import BailianEmbeddingProvider
from app.ai.embeddings.base import BaseEmbeddingProvider, ProviderEmbeddingResult
from app.ai.embeddings.schemas import (
    EmbeddedChunk,
    EmbeddingChunkInput,
    EmbeddingInputType,
    EmbeddingRequest,
    EmbeddingResult,
)
from app.ai.embeddings.service import EmbeddingService, embedding_service

__all__ = [
    "BailianEmbeddingProvider",
    "BaseEmbeddingProvider",
    "EmbeddedChunk",
    "EmbeddingChunkInput",
    "EmbeddingInputType",
    "EmbeddingRequest",
    "EmbeddingResult",
    "EmbeddingService",
    "ProviderEmbeddingResult",
    "embedding_service",
]
