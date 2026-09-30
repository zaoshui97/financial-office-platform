"""Embedding请求和响应的统一数据结构。"""

from enum import StrEnum

from pydantic import BaseModel, Field


class EmbeddingInputType(StrEnum):
    """Embedding文本用途。"""

    DOCUMENT = "document"
    QUERY = "query"


class EmbeddingRequest(BaseModel):
    """与供应商无关的Embedding请求。"""

    texts: list[str] = Field(default_factory=list)
    input_type: EmbeddingInputType = EmbeddingInputType.DOCUMENT


class EmbeddingResult(BaseModel):
    """统一Embedding结果，供未来Qdrant索引层使用。"""

    vectors: list[list[float]]
    provider: str
    model: str
    dimension: int
    token_usage: int | None = None
    latency_ms: float


class EmbeddingChunkInput(BaseModel):
    """未来向量索引阶段需要的最小Chunk输入。"""

    chunk_id: int
    chunk_text: str
    content_hash: str


class EmbeddedChunk(BaseModel):
    """带Chunk身份信息的向量结果，不负责持久化。"""

    chunk_id: int
    vector: list[float]
    provider: str
    model: str
    dimension: int
    content_hash: str
