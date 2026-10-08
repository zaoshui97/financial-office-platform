"""知识库与文档上传API数据模型。"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class KnowledgeBaseCreate(BaseModel):
    """创建知识库请求。"""

    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)


class KnowledgeBaseUpdate(BaseModel):
    """重命名或更新知识库描述请求。"""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)


class KnowledgeBaseRead(BaseModel):
    """知识库响应。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    owner_id: int
    created_at: datetime


class DocumentRead(BaseModel):
    """文档元数据与解析状态。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    knowledge_base_id: int
    original_filename: str
    file_type: str
    file_size: int
    status: str
    page_count: int | None
    parsed_char_count: int
    error_message: str | None
    index_status: str
    index_error: str | None
    indexed_at: datetime | None
    index_collection: str | None
    created_at: datetime


class DocumentContentRead(DocumentRead):
    """文档元数据和解析后的完整文本。"""

    parsed_text: str


class DocumentNormalizationRead(BaseModel):
    """前端可读取的归一化状态；旧文档不会被误标为已归一化。"""

    document_id: int
    status: str
    normalization_version: str | None
    content_hash: str | None
    normalized_char_count: int
    chunk_count: int
