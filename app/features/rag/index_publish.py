"""Database-only publication, to be called after confirmed versioned vector writes.

Publication owns a separate SERIALIZABLE transaction, never a caller Session.
MySQL requires transactional InnoDB tables: document and chunk range locks protect
validation through commit. SQLite obtains its write lock before reading chunks.
Any database exception propagates unchanged. A commit exception may have an
unknown outcome: callers must reconcile it and must not delete vectors on that
basis. This module performs neither external calls nor cleanup or automatic retry.
"""

import re
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from hashlib import sha256
from uuid import UUID

from sqlalchemy import Engine, select, update

from app.core.database import engine
from app.features.rag.indexing import point_id_for_chunk_generation
from app.features.rag.models import DocumentChunk, KnowledgeBase, KnowledgeDocument


class IndexPublicationError(ValueError):
    """Publication validation failed; no new version was committed."""


@dataclass(frozen=True)
class ChunkBuildSnapshot:
    chunk_id: int
    content_hash: str


@dataclass(frozen=True)
class PublishedVectorMapping:
    chunk_id: int
    point_id: str


@dataclass(frozen=True)
class IndexEmbeddingMetadata:
    provider: str
    model: str
    dimension: int
    version: str


def publish_index_generation(
    document_id: int,
    owner_id: int,
    generation: str,
    chunk_snapshot: Sequence[ChunkBuildSnapshot],
    vector_mappings: Sequence[PublishedVectorMapping],
    collection_name: str,
    embedding: IndexEmbeddingMetadata,
    *,
    database_engine: Engine = engine,
) -> None:
    """Validate and publish atomically; normal return means commit succeeded.

    Callers must supply the entire build snapshot and all confirmed vector IDs.
    Prerequisite data must already be committed. Do not hold target write locks
    in another transaction when calling this function.
    """
    if not isinstance(database_engine, Engine):
        raise TypeError("An independent Engine is required")
    if database_engine.dialect.name not in ("mysql", "sqlite"):
        raise ValueError("Publication supports MySQL/InnoDB and test SQLite only")
    for identifier in (document_id, owner_id):
        if type(identifier) is not int or identifier <= 0:
            raise IndexPublicationError("Document and owner IDs must be positive integers")
    if not isinstance(generation, str):
        raise IndexPublicationError("generation must be a valid UUID string")
    try:
        generation = str(UUID(generation))
    except ValueError as exc:
        raise IndexPublicationError("generation must be a valid UUID string") from exc
    for value, maximum in (
        (collection_name, 255),
        (embedding.provider, 50),
        (embedding.model, 100),
        (embedding.version, 50),
    ):
        if not isinstance(value, str) or not value.strip() or len(value) > maximum:
            raise IndexPublicationError("Invalid Collection or Embedding metadata")
    if type(embedding.dimension) is not int or embedding.dimension <= 0:
        raise IndexPublicationError("Embedding dimension must be a positive integer")

    expected_hashes: dict[int, str] = {}
    for chunk in chunk_snapshot:
        if (
            type(chunk.chunk_id) is not int
            or chunk.chunk_id <= 0
            or chunk.chunk_id in expected_hashes
            or not isinstance(chunk.content_hash, str)
            or re.fullmatch(r"[0-9a-f]{64}", chunk.content_hash) is None
        ):
            raise IndexPublicationError("Invalid or duplicate chunk snapshot")
        expected_hashes[chunk.chunk_id] = chunk.content_hash
    if not expected_hashes:
        raise IndexPublicationError("Chunk snapshot must not be empty")
    mappings: dict[int, str] = {}
    point_ids: set[str] = set()
    for mapping in vector_mappings:
        if (
            type(mapping.chunk_id) is not int
            or mapping.chunk_id not in expected_hashes
            or mapping.chunk_id in mappings
            or mapping.point_id
            != point_id_for_chunk_generation(document_id, mapping.chunk_id, generation)
            or mapping.point_id in point_ids
        ):
            raise IndexPublicationError(
                "Incomplete, duplicate or invalid versioned Point ID mapping"
            )
        mappings[mapping.chunk_id] = mapping.point_id
        point_ids.add(mapping.point_id)
    if mappings.keys() != expected_hashes.keys():
        raise IndexPublicationError("Vector mappings must cover the entire chunk snapshot")

    documents = KnowledgeDocument.__table__
    chunks = DocumentChunk.__table__
    knowledge_bases = KnowledgeBase.__table__
    document_condition = (
        documents.c.id == document_id,
        documents.c.owner_id == owner_id,
        documents.c.status == "parsed",
        documents.c.building_index_generation == generation,
    )
    with database_engine.connect().execution_options(isolation_level="SERIALIZABLE") as connection:
        with connection.begin():
            locked = connection.execute(
                update(documents)
                .where(*document_condition)
                .values(building_index_generation=generation, updated_at=documents.c.updated_at)
            )
            if locked.rowcount != 1:
                raise IndexPublicationError(
                    "Document is not owned, parsed, or held by this generation"
                )
            document = (
                connection.execute(
                    select(documents).where(documents.c.id == document_id).with_for_update()
                )
                .mappings()
                .one()
            )
            if document["building_index_generation"] != generation:
                raise IndexPublicationError("Build generation does not match")
            knowledge_base = connection.execute(
                select(knowledge_bases.c.owner_id)
                .where(knowledge_bases.c.id == document["knowledge_base_id"])
                .with_for_update()
            ).scalar_one_or_none()
            if knowledge_base != owner_id:
                raise IndexPublicationError("Knowledge base ownership does not match")
            current_chunks = (
                connection.execute(
                    select(chunks)
                    .where(chunks.c.document_id == document_id)
                    .order_by(chunks.c.id)
                    .with_for_update()
                )
                .mappings()
                .all()
            )
            if {chunk["id"]: chunk["content_hash"] for chunk in current_chunks} != expected_hashes:
                raise IndexPublicationError(
                    "Complete chunk set or content hashes changed during build"
                )
            for chunk in current_chunks:
                if (
                    chunk["owner_id"] != owner_id
                    or chunk["knowledge_base_id"] != document["knowledge_base_id"]
                    or sha256(chunk["chunk_text"].encode("utf-8")).hexdigest()
                    != chunk["content_hash"]
                ):
                    raise IndexPublicationError(
                        "Chunk ownership or actual content hash is inconsistent"
                    )
            for chunk in current_chunks:
                result = connection.execute(
                    update(chunks)
                    .where(
                        chunks.c.id == chunk["id"],
                        chunks.c.document_id == document_id,
                        chunks.c.owner_id == owner_id,
                        chunks.c.knowledge_base_id == document["knowledge_base_id"],
                        chunks.c.content_hash == expected_hashes[chunk["id"]],
                    )
                    .values(
                        vector_id=mappings[chunk["id"]],
                        embedding_provider=embedding.provider,
                        embedding_model=embedding.model,
                        embedding_dimension=embedding.dimension,
                        embedding_version=embedding.version,
                    )
                )
                if result.rowcount != 1:
                    raise IndexPublicationError("Chunk changed during publication")
            published = connection.execute(
                update(documents)
                .where(*document_condition)
                .values(
                    active_index_generation=generation,
                    building_index_generation=None,
                    index_collection=collection_name,
                    index_status="indexed",
                    index_error=None,
                    indexed_at=datetime.now(UTC).replace(tzinfo=None),
                )
            )
            if published.rowcount != 1:
                raise IndexPublicationError("Document changed during publication")
