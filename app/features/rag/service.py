"""知识库业务服务：管理资源、解析文档并维护用户隔离。"""

from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.features.rag.chunker import chunk_document
from app.features.rag.models import DocumentChunk, KnowledgeBase, KnowledgeDocument
from app.features.rag.normalization import (
    NORMALIZATION_VERSION,
    normalize_parsed_document,
    normalized_content_hash,
)
from app.features.rag.schemas import KnowledgeBaseCreate, KnowledgeBaseUpdate
from app.integrations.document_parser import DocumentParseError, parse_document
from app.integrations.file_storage import save_upload_file

logger = get_logger(__name__)


def create_knowledge_base(
    db: Session,
    owner_id: int,
    data: KnowledgeBaseCreate,
) -> KnowledgeBase:
    """创建当前用户私有知识库。"""
    knowledge_base = KnowledgeBase(
        owner_id=owner_id,
        name=data.name.strip(),
        description=data.description.strip() if data.description else None,
    )
    db.add(knowledge_base)
    db.commit()
    db.refresh(knowledge_base)
    return knowledge_base


def list_knowledge_bases(db: Session, owner_id: int) -> list[KnowledgeBase]:
    """列出当前用户拥有的知识库。"""
    statement = (
        select(KnowledgeBase)
        .where(KnowledgeBase.owner_id == owner_id)
        .order_by(KnowledgeBase.id.desc())
    )
    return list(db.scalars(statement).all())


def update_knowledge_base(
    db: Session,
    owner_id: int,
    knowledge_base_id: int,
    data: KnowledgeBaseUpdate,
) -> KnowledgeBase:
    """更新当前用户知识库的名称或描述。"""
    knowledge_base = get_owned_knowledge_base(db, knowledge_base_id, owner_id)
    if data.name is not None:
        knowledge_base.name = data.name.strip()
    if data.description is not None:
        knowledge_base.description = data.description.strip() or None
    db.commit()
    db.refresh(knowledge_base)
    return knowledge_base


def delete_knowledge_base(db: Session, owner_id: int, knowledge_base_id: int) -> None:
    """删除知识库前清理其已索引的Qdrant点和本地文件。"""
    knowledge_base = get_owned_knowledge_base(db, knowledge_base_id, owner_id)
    documents = list(
        db.scalars(
            select(KnowledgeDocument).where(
                KnowledgeDocument.knowledge_base_id == knowledge_base_id,
                KnowledgeDocument.owner_id == owner_id,
            )
        ).all()
    )
    from app.features.rag.indexing import delete_document_vectors

    for document in documents:
        chunks = list(
            db.scalars(
                select(DocumentChunk).where(DocumentChunk.document_id == document.id)
            ).all()
        )
        delete_document_vectors(document, chunks)
        _remove_stored_file(document.stored_path)
    db.delete(knowledge_base)
    db.commit()


def get_owned_knowledge_base(
    db: Session,
    knowledge_base_id: int,
    owner_id: int,
) -> KnowledgeBase:
    """查询用户拥有的知识库，阻止跨用户访问。"""
    statement = select(KnowledgeBase).where(
        KnowledgeBase.id == knowledge_base_id,
        KnowledgeBase.owner_id == owner_id,
    )
    knowledge_base = db.scalar(statement)
    if knowledge_base is None:
        raise HTTPException(status_code=404, detail="知识库不存在")
    return knowledge_base


def list_documents(
    db: Session,
    knowledge_base_id: int,
    owner_id: int,
) -> list[KnowledgeDocument]:
    """列出指定知识库中的文档记录。"""
    get_owned_knowledge_base(db, knowledge_base_id, owner_id)
    statement = (
        select(KnowledgeDocument)
        .where(
            KnowledgeDocument.knowledge_base_id == knowledge_base_id,
            KnowledgeDocument.owner_id == owner_id,
        )
        .order_by(KnowledgeDocument.id.desc())
    )
    return list(db.scalars(statement).all())


def get_owned_document(db: Session, document_id: int, owner_id: int) -> KnowledgeDocument:
    """查询当前用户拥有的文档。"""
    statement = select(KnowledgeDocument).where(
        KnowledgeDocument.id == document_id,
        KnowledgeDocument.owner_id == owner_id,
    )
    document = db.scalar(statement)
    if document is None:
        raise HTTPException(status_code=404, detail="文档不存在")
    return document


def get_document_status(db: Session, document_id: int, owner_id: int) -> KnowledgeDocument:
    """返回当前用户文档的解析和索引状态。"""
    return get_owned_document(db, document_id, owner_id)


def delete_document(db: Session, document_id: int, owner_id: int) -> None:
    """按用户权限删除文档、Chunk、本地文件和对应向量。"""
    document = get_owned_document(db, document_id, owner_id)
    chunks = list(
        db.scalars(select(DocumentChunk).where(DocumentChunk.document_id == document.id)).all()
    )
    from app.features.rag.indexing import delete_document_vectors

    delete_document_vectors(document, chunks)
    _remove_stored_file(document.stored_path)
    db.delete(document)
    db.commit()


def _mark_document_failed(db: Session, document_id: int, message: str) -> None:
    """保存文档解析失败状态。"""
    db.rollback()
    document = db.get(KnowledgeDocument, document_id)
    if document is not None:
        document.status = "failed"
        document.error_message = message[:1000]
        db.commit()


def upload_and_parse_document(
    db: Session,
    owner_id: int,
    knowledge_base_id: int,
    upload: UploadFile,
) -> KnowledgeDocument:
    """保存PDF、DOCX或TXT，解析全文并写入数据库。"""
    get_owned_knowledge_base(db, knowledge_base_id, owner_id)
    stored_file = save_upload_file(upload, owner_id, knowledge_base_id)
    document = KnowledgeDocument(
        knowledge_base_id=knowledge_base_id,
        owner_id=owner_id,
        original_filename=stored_file.original_filename,
        stored_path=str(stored_file.path),
        file_type=stored_file.extension.lstrip("."),
        file_size=stored_file.size,
        status="processing",
        parsed_char_count=0,
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    try:
        parsed = normalize_parsed_document(parse_document(stored_file.path))
        if not parsed.text:
            raise DocumentParseError("文档归一化后没有可提取文本")
        chunks = chunk_document(parsed)
        db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document.id))
        db.add_all(
            [
                DocumentChunk(
                    owner_id=owner_id,
                    knowledge_base_id=knowledge_base_id,
                    document_id=document.id,
                    chunk_index=chunk.chunk_index,
                    chunk_text=chunk.chunk_text,
                    page_number=chunk.page_number,
                    chunk_metadata={
                        **chunk.metadata,
                        "normalization_version": NORMALIZATION_VERSION,
                    },
                    content_hash=chunk.content_hash,
                )
                for chunk in chunks
            ]
        )
        document.parsed_text = parsed.text
        document.page_count = parsed.page_count
        document.parsed_char_count = len(parsed.text)
        document.status = "parsed"
        document.error_message = None
        db.commit()
        db.refresh(document)
        return document
    except DocumentParseError as exc:
        logger.warning("文档解析失败 | document_id=%s error=%s", document.id, exc)
        _mark_document_failed(db, document.id, str(exc))
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"文档解析失败: {exc}",
        ) from exc
    except Exception:
        logger.exception("文档解析发生未预期错误 | document_id=%s", document.id)
        _mark_document_failed(db, document.id, "文档解析发生内部错误")
        raise


def read_document_content(
    db: Session,
    document_id: int,
    owner_id: int,
) -> KnowledgeDocument:
    """返回已解析文档及其完整文本。"""
    document = get_owned_document(db, document_id, owner_id)
    if document.status != "parsed" or document.parsed_text is None:
        raise HTTPException(status_code=409, detail="文档尚未解析成功")
    return document


def get_document_normalization(db: Session, document_id: int, owner_id: int) -> dict:
    """读取文档规范化版本和指纹，区分历史上传的未归一化记录。"""
    document = get_owned_document(db, document_id, owner_id)
    chunks = list(
        db.scalars(select(DocumentChunk).where(DocumentChunk.document_id == document_id)).all()
    )
    normalized = (
        document.status == "parsed"
        and document.parsed_text is not None
        and bool(chunks)
        and all(
            (chunk.chunk_metadata or {}).get("normalization_version") == NORMALIZATION_VERSION
            for chunk in chunks
        )
    )
    return {
        "document_id": document.id,
        "status": "normalized" if normalized else "legacy_or_unavailable",
        "normalization_version": NORMALIZATION_VERSION if normalized else None,
        "content_hash": normalized_content_hash(document.parsed_text) if normalized else None,
        "normalized_char_count": document.parsed_char_count if normalized else 0,
        "chunk_count": len(chunks),
    }


def _remove_stored_file(stored_path: str) -> None:
    """删除本地文件，文件已不存在时保持幂等。"""
    try:
        Path(stored_path).unlink(missing_ok=True)
    except OSError as exc:
        logger.warning("删除文档文件失败 | path=%s error=%s", stored_path, exc)
