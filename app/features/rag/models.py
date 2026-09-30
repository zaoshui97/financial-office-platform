"""企业知识库和文档SQLAlchemy模型。"""

from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin


class KnowledgeBase(TimestampMixin, Base):
    """当前用户拥有的企业知识库。"""

    __tablename__ = "knowledge_bases"

    owner_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="知识库所有者ID",
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="知识库名称")
    description: Mapped[str | None] = mapped_column(
        String(500), nullable=True, comment="知识库描述"
    )


class KnowledgeDocument(TimestampMixin, Base):
    """知识库中的原始文件、解析状态和提取文本。"""

    __tablename__ = "knowledge_documents"

    knowledge_base_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("knowledge_bases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="知识库ID",
    )
    owner_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="文档所有者ID",
    )
    original_filename: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="原始文件名"
    )
    stored_path: Mapped[str] = mapped_column(String(500), nullable=False, comment="保存路径")
    file_type: Mapped[str] = mapped_column(String(20), nullable=False, comment="文件类型")
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False, comment="文件大小")
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="processing", comment="解析状态"
    )
    parsed_text: Mapped[str | None] = mapped_column(
        Text().with_variant(LONGTEXT, "mysql"),
        nullable=True,
        comment="解析后的全文",
    )
    page_count: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="PDF页数"
    )
    parsed_char_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, comment="解析文本字符数"
    )
    error_message: Mapped[str | None] = mapped_column(
        String(1000), nullable=True, comment="解析失败原因"
    )
    index_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending",
        server_default="pending",
        comment="向量索引状态",
    )
    index_error: Mapped[str | None] = mapped_column(
        String(1000), nullable=True, comment="向量索引失败原因"
    )
    indexed_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True, comment="向量索引完成时间"
    )
    index_collection: Mapped[str | None] = mapped_column(
        String(255), nullable=True, comment="向量所在Collection"
    )
    active_index_generation: Mapped[str | None] = mapped_column(
        String(36), nullable=True, comment="当前已发布的索引版本"
    )
    building_index_generation: Mapped[str | None] = mapped_column(
        String(36), nullable=True, comment="正在构建的索引版本"
    )


class DocumentChunk(TimestampMixin, Base):
    """文档的持久化文本片段，为后续向量索引保留扩展字段。"""

    __tablename__ = "document_chunks"
    __table_args__ = (
        UniqueConstraint(
            "document_id",
            "chunk_index",
            name="uq_document_chunks_document_index",
        ),
        Index(
            "ix_document_chunks_owner_knowledge_base",
            "owner_id",
            "knowledge_base_id",
        ),
    )

    owner_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="片段所有者ID",
    )
    knowledge_base_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("knowledge_bases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="知识库ID",
    )
    document_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("knowledge_documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="文档ID",
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False, comment="片段序号")
    chunk_text: Mapped[str] = mapped_column(
        Text().with_variant(LONGTEXT, "mysql"),
        nullable=False,
        comment="片段正文",
    )
    page_number: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="单页片段的页码，跨页时为空",
    )
    chunk_metadata: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSON,
        nullable=False,
        default=dict,
        comment="解析来源元数据",
    )
    vector_id: Mapped[str | None] = mapped_column(
        String(128),
        nullable=True,
        comment="未来向量数据库点位ID",
    )
    embedding_provider: Mapped[str | None] = mapped_column(
        String(50), nullable=True, comment="Embedding提供方"
    )
    embedding_model: Mapped[str | None] = mapped_column(
        String(100), nullable=True, comment="Embedding模型"
    )
    embedding_dimension: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="Embedding向量维度"
    )
    embedding_version: Mapped[str | None] = mapped_column(
        String(50), nullable=True, comment="Embedding版本"
    )
    content_hash: Mapped[str] = mapped_column(
        String(64), nullable=False, comment="片段正文SHA-256"
    )
