"""文档向量索引与检索服务，不负责Agent、Rerank或异步调度。"""

import json
from dataclasses import dataclass
from hashlib import sha256
from math import isfinite
from time import perf_counter
from uuid import NAMESPACE_URL, UUID, uuid4, uuid5

from fastapi import HTTPException
from qdrant_client.http import models
from sqlalchemy import Connection, Engine, select, update
from sqlalchemy.orm import Session

from app.ai.embeddings.service import EmbeddingService, embedding_service
from app.core.config import settings
from app.core.logging import get_logger
from app.features.rag.index_build import acquire_index_build, fail_index_build
from app.features.rag.models import DocumentChunk, KnowledgeBase, KnowledgeDocument
from app.features.rag.retrieval_selector import (
    RetrievalDocumentRef,
    filter_retrieval_candidates_by_score,
    select_retrieval_candidates,
)
from app.integrations.qdrant_client import (
    DocumentIndexSnapshot,
    QdrantError,
    QdrantVectorStore,
    build_active_index_filter,
    qdrant_store,
)

logger = get_logger(__name__)


class VectorIndexError(RuntimeError):
    """索引失败或结果待核对；不能据此推断发布已回滚。"""


@dataclass(frozen=True)
class VectorChunkHit:
    """经过MySQL身份校验后的向量命中。"""

    chunk: DocumentChunk
    filename: str
    score: float


def point_id_for_chunk(chunk_id: int) -> str:
    """生成稳定、可重复索引的Qdrant Point ID。"""
    return str(uuid5(NAMESPACE_URL, f"financial-office-platform:document-chunk:{chunk_id}"))


def point_id_for_chunk_generation(document_id: int, chunk_id: int, generation: str) -> str:
    """Generate a versioned UUID5 without changing legacy point mappings."""
    if not isinstance(generation, str):
        raise ValueError("generation must be a valid UUID string")
    try:
        normalized_generation = str(UUID(generation))
    except ValueError as exc:
        raise ValueError("generation must be a valid UUID string") from exc
    identity = json.dumps([document_id, chunk_id, normalized_generation], separators=(",", ":"))
    return str(
        uuid5(NAMESPACE_URL, f"financial-office-platform:document-chunk-generation:{identity}")
    )


def _chunk_payload(document: KnowledgeDocument, chunk: DocumentChunk) -> dict[str, object]:
    """构造包含租户、来源和正文校验信息的Qdrant Payload。"""
    page_numbers = list(chunk.chunk_metadata.get("page_numbers", []))
    return {
        "owner_id": document.owner_id,
        "knowledge_base_id": document.knowledge_base_id,
        "document_id": document.id,
        "chunk_id": chunk.id,
        "filename": document.original_filename,
        "page_number": chunk.page_number,
        "page_numbers": page_numbers,
        "text": chunk.chunk_text,
        "content_hash": chunk.content_hash,
    }


def _read_index_snapshot(
    connection: Connection,
    owner_id: int,
    document_id: int,
) -> tuple[KnowledgeDocument, list[DocumentChunk]]:
    """Read complete document/chunk columns in one statement, outside the identity map."""
    document_columns = {
        attr.key: attr.columns[0] for attr in KnowledgeDocument.__mapper__.column_attrs
    }
    chunk_columns = {attr.key: attr.columns[0] for attr in DocumentChunk.__mapper__.column_attrs}
    rows = (
        connection.execute(
            select(
                *(column.label(f"document_{key}") for key, column in document_columns.items()),
                *(column.label(f"chunk_{key}") for key, column in chunk_columns.items()),
            )
            .select_from(KnowledgeDocument)
            .join(KnowledgeBase, KnowledgeBase.id == KnowledgeDocument.knowledge_base_id)
            .outerjoin(DocumentChunk, DocumentChunk.document_id == KnowledgeDocument.id)
            .where(
                KnowledgeDocument.id == document_id,
                KnowledgeDocument.owner_id == owner_id,
                KnowledgeBase.owner_id == owner_id,
            )
            .order_by(DocumentChunk.chunk_index, DocumentChunk.id)
        )
        .mappings()
        .all()
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Document not found")
    document = KnowledgeDocument(**{key: rows[0][f"document_{key}"] for key in document_columns})
    chunks = [
        DocumentChunk(**{key: row[f"chunk_{key}"] for key in chunk_columns})
        for row in rows
        if row["chunk_id"] is not None
    ]
    return document, chunks


def _check_index_snapshot(
    document: KnowledgeDocument,
    chunks: list[DocumentChunk],
    collection_name: str,
    embedding_config: tuple[str, str, int, str],
) -> None:
    """Reject invalid input and unsupported migrations before any external calls."""
    if document.status != "parsed" or not chunks:
        raise VectorIndexError("Document must be parsed and have persisted chunks")
    active = document.active_index_generation is not None or any(
        chunk.vector_id for chunk in chunks
    )
    if active and document.index_collection != collection_name:
        raise VectorIndexError("Active index Collection is incompatible; migration is unsupported")
    for chunk in chunks:
        if (
            chunk.owner_id != document.owner_id
            or chunk.knowledge_base_id != document.knowledge_base_id
            or sha256(chunk.chunk_text.encode("utf-8")).hexdigest() != chunk.content_hash
        ):
            raise VectorIndexError("Chunk ownership or content hash is inconsistent")
        if (
            chunk.vector_id
            and (
                chunk.embedding_provider,
                chunk.embedding_model,
                chunk.embedding_dimension,
                chunk.embedding_version,
            )
            != embedding_config
        ):
            raise VectorIndexError(
                "Active index Embedding is incompatible; migration is unsupported"
            )


def _finish_unpublished_build(
    database_engine: Engine,
    document_id: int,
    owner_id: int,
    generation: str,
    error: Exception,
) -> None:
    """Never retry uncertain failure finalization or touch another task's build."""
    try:
        handled = fail_index_build(
            document_id, owner_id, generation, error, database_engine=database_engine
        )
    except Exception as exc:
        raise VectorIndexError(
            "Failure finalization outcome unknown; reconciliation required"
        ) from exc
    if not handled:
        raise VectorIndexError("Build ownership changed; reconciliation required") from error


def _reconcile_publication(
    database_engine: Engine,
    owner_id: int,
    document_id: int,
    generation: str,
) -> str:
    """Use a new locking transaction, not a caller's repeatable-read snapshot."""
    with database_engine.begin() as connection:
        row = connection.execute(
            select(
                KnowledgeDocument.active_index_generation,
                KnowledgeDocument.building_index_generation,
            )
            .where(KnowledgeDocument.id == document_id, KnowledgeDocument.owner_id == owner_id)
            .with_for_update()
        ).one_or_none()
        if row is not None and row.active_index_generation == generation:
            return "published"
        if row is not None and row.building_index_generation == generation:
            return "unpublished"
    return "unknown"


def _read_index_response(
    database_engine: Engine,
    owner_id: int,
    document_id: int,
) -> KnowledgeDocument:
    """Build a detached response after publication; errors must not undo publication."""
    with database_engine.connect() as connection:
        document, _ = _read_index_snapshot(connection, owner_id, document_id)
    return document


def index_document(
    db: Session,
    owner_id: int,
    document_id: int,
    *,
    vector_store: QdrantVectorStore | None = None,
    embeddings: EmbeddingService | None = None,
) -> KnowledgeDocument:
    """Build isolated vectors, then atomically publish; never delete versioned points.

    Independent transactions do not flush/commit the caller Session. The returned
    document is detached; pending RAG changes must be committed before invocation.
    """
    from app.features.rag.index_publish import (
        ChunkBuildSnapshot,
        IndexEmbeddingMetadata,
        PublishedVectorMapping,
        publish_index_generation,
    )

    database_engine = db.get_bind()
    if not isinstance(database_engine, Engine):
        raise VectorIndexError("Indexing requires an independent Engine")
    if any(
        isinstance(item, (KnowledgeDocument, DocumentChunk, KnowledgeBase))
        for item in list(db.new) + list(db.dirty) + list(db.deleted)
    ):
        raise VectorIndexError("Commit pending RAG changes before indexing")
    if not settings.RAG_INDEX_ENABLED:
        raise VectorIndexError("向量索引未启用，请先配置RAG_INDEX_ENABLED=true")
    store = vector_store or qdrant_store
    embedding_service_instance = embeddings or embedding_service
    collection_name = store.collection_name()
    embedding_config = (
        settings.EMBEDDING_PROVIDER,
        settings.EMBEDDING_MODEL,
        settings.EMBEDDING_DIMENSION,
        settings.EMBEDDING_VERSION,
    )
    with database_engine.connect() as connection:
        document, chunks = _read_index_snapshot(connection, owner_id, document_id)
    _check_index_snapshot(document, chunks, collection_name, embedding_config)
    generation = str(uuid4())
    try:
        acquired = acquire_index_build(
            document_id, owner_id, generation, database_engine=database_engine
        )
    except Exception as exc:
        raise VectorIndexError(
            "Build acquisition outcome unknown; reconciliation required"
        ) from exc
    if not acquired:
        raise VectorIndexError("Build ownership conflict; no external calls performed")

    try:
        with database_engine.begin() as connection:
            marked = connection.execute(
                update(KnowledgeDocument.__table__)
                .where(
                    KnowledgeDocument.id == document_id,
                    KnowledgeDocument.owner_id == owner_id,
                    KnowledgeDocument.building_index_generation == generation,
                    KnowledgeDocument.status == "parsed",
                )
                .values(index_status="indexing", index_error=None)
            )
            if marked.rowcount != 1:
                raise VectorIndexError("Build ownership or document validity changed")
            document, chunks = _read_index_snapshot(connection, owner_id, document_id)
            _check_index_snapshot(document, chunks, collection_name, embedding_config)
        snapshot = [ChunkBuildSnapshot(chunk.id, chunk.content_hash) for chunk in chunks]
        mappings = [
            PublishedVectorMapping(
                chunk.id, point_id_for_chunk_generation(document_id, chunk.id, generation)
            )
            for chunk in chunks
        ]
        result = embedding_service_instance.embed_documents([chunk.chunk_text for chunk in chunks])
        if (
            (result.provider, result.model, result.dimension) != embedding_config[:3]
            or len(result.vectors) != len(chunks)
            or any(
                len(vector) != result.dimension or not all(isfinite(value) for value in vector)
                for vector in result.vectors
            )
        ):
            raise VectorIndexError("Embedding response does not match build configuration")
        if store.ensure_collection(result.dimension) != collection_name:
            raise VectorIndexError("Target Collection changed during build")
        points = [
            models.PointStruct(
                id=mapping.point_id,
                vector=vector,
                payload=dict(_chunk_payload(document, chunk), generation=generation),
            )
            for mapping, vector, chunk in zip(mappings, result.vectors, chunks, strict=True)
        ]
        store.upsert(collection_name, points)
    except Exception as exc:
        _finish_unpublished_build(database_engine, document_id, owner_id, generation, exc)
        raise VectorIndexError(_safe_index_error(exc)) from exc

    try:
        publish_index_generation(
            document_id,
            owner_id,
            generation,
            snapshot,
            mappings,
            collection_name,
            IndexEmbeddingMetadata(*embedding_config),
            database_engine=database_engine,
        )
    except Exception as exc:
        try:
            outcome = _reconcile_publication(database_engine, owner_id, document_id, generation)
        except Exception as check_error:
            raise VectorIndexError(
                "Publication outcome unknown; reconciliation required"
            ) from check_error
        if outcome == "unpublished":
            _finish_unpublished_build(database_engine, document_id, owner_id, generation, exc)
            raise VectorIndexError("Index publication failed; active index preserved") from exc
        if outcome != "published":
            raise VectorIndexError("Publication outcome unknown; reconciliation required") from exc
    logger.info("Index published | document_id=%s generation=%s", document_id, generation)
    return _read_index_response(database_engine, owner_id, document_id)


def delete_document_vectors(
    document: KnowledgeDocument,
    chunks: list[DocumentChunk],
    *,
    vector_store: QdrantVectorStore | None = None,
) -> None:
    """删除文档对应的全部Point，避免删除数据库后失去清理依据。"""
    point_ids = [chunk.vector_id for chunk in chunks if chunk.vector_id]
    if not point_ids:
        return
    store = vector_store or qdrant_store
    collection_name = document.index_collection or store.collection_name()
    try:
        store.delete_points(collection_name, point_ids)
    except QdrantError:
        raise


def retrieve_vector_chunks(
    db: Session,
    owner_id: int,
    knowledge_base_id: int,
    question: str,
    *,
    vector_store: QdrantVectorStore | None = None,
    embeddings: EmbeddingService | None = None,
) -> list[VectorChunkHit]:
    """Validate active mappings in SQL; return content only from the matching Point.

    Historical points without valid text, hash or filename are not returned.
    Missing page information stays unknown and is never filled from mutable SQL.
    """
    store = vector_store or qdrant_store
    embedding_service_instance = embeddings or embedding_service
    collection_name = store.collection_name()
    embedding_config = (
        settings.EMBEDDING_PROVIDER,
        settings.EMBEDDING_MODEL,
        settings.EMBEDDING_DIMENSION,
        settings.EMBEDDING_VERSION,
    )
    chunk_columns = {
        key: getattr(DocumentChunk, key)
        for key in (
            "id",
            "owner_id",
            "knowledge_base_id",
            "document_id",
            "vector_id",
            "embedding_provider",
            "embedding_model",
            "embedding_dimension",
            "embedding_version",
        )
    }
    statement = (
        select(
            *(column.label(key) for key, column in chunk_columns.items()),
            KnowledgeDocument.original_filename,
            KnowledgeDocument.active_index_generation,
            KnowledgeDocument.index_collection,
        )
        .select_from(DocumentChunk)
        .join(KnowledgeDocument, DocumentChunk.document_id == KnowledgeDocument.id)
        .join(KnowledgeBase, KnowledgeDocument.knowledge_base_id == KnowledgeBase.id)
        .where(
            KnowledgeBase.owner_id == owner_id,
            KnowledgeBase.id == knowledge_base_id,
            KnowledgeDocument.owner_id == owner_id,
            KnowledgeDocument.knowledge_base_id == knowledge_base_id,
            KnowledgeDocument.status == "parsed",
            DocumentChunk.owner_id == owner_id,
            DocumentChunk.knowledge_base_id == knowledge_base_id,
        )
    )
    with db.no_autoflush:
        rows = db.execute(statement).mappings().all()

    chunks_by_id = {}
    generations = {}
    document_filenames: dict[int, str] = {}
    document_point_ids: dict[int, list[str]] = {}
    for row in rows:
        try:
            point_id = str(UUID(row["vector_id"]))
        except (ValueError, TypeError, AttributeError):
            continue
        document_id = row["document_id"]
        stored_config = (
            row["embedding_provider"],
            row["embedding_model"],
            row["embedding_dimension"],
            row["embedding_version"],
        )
        if row["index_collection"] != collection_name or stored_config != embedding_config:
            raise VectorIndexError(
                "Active index is incompatible with query Embedding/Collection: "
                f"document_id={document_id}"
            )
        generation = row["active_index_generation"]
        if generation is not None:
            try:
                generation = str(UUID(generation))
            except (ValueError, TypeError, AttributeError) as exc:
                raise VectorIndexError("Invalid active index generation") from exc
        generations[document_id] = generation
        document_filenames[document_id] = row["original_filename"]
        document_point_ids.setdefault(document_id, []).append(point_id)
        chunks_by_id[row["id"]] = (row, point_id)
    if not chunks_by_id:
        return []
    query_filter = build_active_index_filter(
        owner_id,
        knowledge_base_id,
        [
            DocumentIndexSnapshot(document_id, generations[document_id], tuple(point_ids))
            for document_id, point_ids in document_point_ids.items()
        ],
    )
    query_result = embedding_service_instance.embed_query(question)
    if (
        (query_result.provider, query_result.model, query_result.dimension) != embedding_config[:3]
        or len(query_result.vectors) != 1
        or len(query_result.vectors[0]) != embedding_config[2]
    ):
        raise VectorIndexError("Query Embedding does not match the active index configuration")
    hits = store.search(
        collection_name,
        query_result.vectors[0],
        owner_id,
        knowledge_base_id,
        settings.RAG_VECTOR_TOP_K,
        query_filter=query_filter,
    )

    validated_hits: list[VectorChunkHit] = []
    seen_chunks: set[int] = set()
    for hit in hits:
        chunk_id = hit.payload.get("chunk_id")
        if type(chunk_id) is not int or chunk_id not in chunks_by_id or chunk_id in seen_chunks:
            continue
        row, point_id = chunks_by_id[chunk_id]
        if any(
            type(hit.payload.get(key)) is not int or hit.payload[key] != row[key]
            for key in ("owner_id", "knowledge_base_id", "document_id")
        ):
            continue
        if hit.point_id != point_id:
            continue
        generation = generations[row["document_id"]]
        if hit.payload.get("generation") != generation:
            continue
        text = hit.payload.get("text")
        content_hash = hit.payload.get("content_hash")
        filename = hit.payload.get("filename")
        if (
            not isinstance(text, str)
            or not text.strip()
            or not isinstance(content_hash, str)
            or not isinstance(filename, str)
            or not filename.strip()
        ):
            continue
        try:
            actual_hash = sha256(text.encode("utf-8")).hexdigest()
        except UnicodeEncodeError:
            continue
        if actual_hash != content_hash:
            continue
        page_number = hit.payload.get("page_number")
        page_numbers = hit.payload.get("page_numbers", [])
        if (
            (page_number is not None and (type(page_number) is not int or page_number < 1))
            or not isinstance(page_numbers, list)
            or any(type(page) is not int or page < 1 for page in page_numbers)
            or (page_number is not None and page_numbers and page_numbers != [page_number])
        ):
            continue
        validated_hits.append(
            VectorChunkHit(
                chunk=DocumentChunk(
                    **{key: row[key] for key in chunk_columns},
                    chunk_text=text,
                    content_hash=content_hash,
                    page_number=page_number,
                    chunk_metadata={"page_numbers": list(page_numbers)},
                ),
                filename=filename,
                score=hit.score,
            )
        )
        seen_chunks.add(chunk_id)
    threshold_started = perf_counter()
    threshold_hits = filter_retrieval_candidates_by_score(
        validated_hits,
        settings.RAG_VECTOR_SCORE_THRESHOLD,
        score_of=lambda hit: hit.score,
    )
    logger.info(
        "向量分数阈值过滤 | threshold=%.4f before=%s after=%s latency_ms=%.2f",
        settings.RAG_VECTOR_SCORE_THRESHOLD,
        len(validated_hits),
        len(threshold_hits),
        (perf_counter() - threshold_started) * 1000,
    )
    return select_retrieval_candidates(
        question,
        threshold_hits,
        [
            RetrievalDocumentRef(document_id, document_filenames[document_id])
            for document_id in document_point_ids
        ],
        settings.RAG_VECTOR_TOP_N,
        document_id_of=lambda hit: hit.chunk.document_id,
        chunk_id_of=lambda hit: hit.chunk.id,
        score_of=lambda hit: hit.score,
    )


def _safe_index_error(error: Exception) -> str:
    """只返回安全的错误摘要，不把请求密钥写入数据库。"""
    if isinstance(error, (QdrantError, VectorIndexError)):
        return str(error)
    return f"{type(error).__name__}: 向量索引失败"
