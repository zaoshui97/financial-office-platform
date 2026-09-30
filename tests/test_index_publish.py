"""Publication transactions on temporary SQLite; not MySQL concurrency acceptance."""

from dataclasses import replace
from hashlib import sha256
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine, delete, event, select, update
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool

from app.core.database import Base
from app.features.auth.models import User
from app.features.rag.index_publish import (
    ChunkBuildSnapshot,
    IndexEmbeddingMetadata,
    IndexPublicationError,
    PublishedVectorMapping,
    publish_index_generation,
)
from app.features.rag.indexing import point_id_for_chunk_generation
from app.features.rag.models import DocumentChunk, KnowledgeBase, KnowledgeDocument

OLD = "12345678-1234-4234-8234-123456789abc"
NEW = "12345678-1234-4234-8234-123456789abd"


@pytest.fixture
def database(tmp_path):
    test_engine = create_engine(
        "sqlite:///" + (tmp_path / "publication.sqlite").as_posix(),
        poolclass=NullPool,
    )
    Base.metadata.create_all(test_engine)
    with Session(test_engine) as session:
        user = User(username="publisher", email="publisher@example.com", hashed_password="hash")
        session.add(user)
        session.flush()
        knowledge_base = KnowledgeBase(owner_id=user.id, name="original")
        session.add(knowledge_base)
        session.flush()
        document = KnowledgeDocument(
            owner_id=user.id,
            knowledge_base_id=knowledge_base.id,
            original_filename="sample.txt",
            stored_path="unused",
            file_type="txt",
            file_size=8,
            status="parsed",
            active_index_generation=OLD,
            building_index_generation=NEW,
            index_collection="old_collection",
            index_status="failed",
            index_error="old error",
        )
        session.add(document)
        session.flush()
        chunks = []
        for index in range(2):
            content = f"chunk {index}"
            chunk = DocumentChunk(
                owner_id=user.id,
                knowledge_base_id=knowledge_base.id,
                document_id=document.id,
                chunk_index=index,
                chunk_text=content,
                chunk_metadata={},
                content_hash=sha256(content.encode()).hexdigest(),
                embedding_provider="old-provider",
                embedding_model="old-model",
                embedding_dimension=768,
                embedding_version="old-version",
            )
            session.add(chunk)
            session.flush()
            chunk.vector_id = point_id_for_chunk_generation(document.id, chunk.id, OLD)
            chunks.append(chunk)
        session.commit()
        context = SimpleNamespace(
            engine=test_engine,
            document_id=document.id,
            owner_id=user.id,
            knowledge_base_id=knowledge_base.id,
            snapshot=[ChunkBuildSnapshot(chunk.id, chunk.content_hash) for chunk in chunks],
            mappings=[
                PublishedVectorMapping(
                    chunk.id, point_id_for_chunk_generation(document.id, chunk.id, NEW)
                )
                for chunk in chunks
            ],
            metadata=IndexEmbeddingMetadata("bailian", "text-embedding-v4", 1024, "v1"),
        )
    try:
        yield context
    finally:
        test_engine.dispose()


def publish(database, **overrides):
    arguments = dict(
        document_id=database.document_id,
        owner_id=database.owner_id,
        generation=NEW,
        chunk_snapshot=database.snapshot,
        vector_mappings=database.mappings,
        collection_name="new_collection",
        embedding=database.metadata,
        database_engine=database.engine,
    )
    arguments.update(overrides)
    return publish_index_generation(**arguments)


def state(database):
    with database.engine.connect() as connection:
        document = dict(connection.execute(select(KnowledgeDocument.__table__)).mappings().one())
        chunks = [
            dict(row)
            for row in connection.execute(
                select(DocumentChunk.__table__).order_by(DocumentChunk.id)
            ).mappings()
        ]
        return document, chunks


def test_publish_success(database):
    before, old_chunks = state(database)
    assert publish(database, generation=NEW.upper()) is None
    document, chunks = state(database)
    assert document["active_index_generation"] == NEW
    assert document["building_index_generation"] is None
    assert document["index_collection"] == "new_collection"
    assert document["index_status"] == "indexed"
    assert document["index_error"] is None
    assert document["indexed_at"] is not None
    assert document["status"] == before["status"]
    for chunk, old_chunk, mapping in zip(chunks, old_chunks, database.mappings, strict=True):
        assert chunk["vector_id"] == mapping.point_id
        assert chunk["embedding_provider"] == "bailian"
        assert chunk["embedding_model"] == "text-embedding-v4"
        assert chunk["embedding_dimension"] == 1024
        assert chunk["embedding_version"] == "v1"
        assert chunk["chunk_text"] == old_chunk["chunk_text"]
        assert chunk["content_hash"] == old_chunk["content_hash"]
    published = state(database)
    with pytest.raises(IndexPublicationError):
        publish(database)
    assert state(database) == published


@pytest.mark.parametrize(
    "overrides",
    [
        {"owner_id": 999},
        {"document_id": 999},
        {"generation": OLD},
    ],
)
def test_wrong_identity_or_generation_preserves_state(database, overrides):
    if overrides.get("generation") == OLD:
        overrides = dict(
            overrides,
            vector_mappings=[
                PublishedVectorMapping(
                    chunk.chunk_id,
                    point_id_for_chunk_generation(database.document_id, chunk.chunk_id, OLD),
                )
                for chunk in database.snapshot
            ],
        )
    before = state(database)
    with pytest.raises(IndexPublicationError):
        publish(database, **overrides)
    assert state(database) == before


@pytest.mark.parametrize(
    "change",
    [
        "added",
        "removed",
        "hash",
        "text-with-stale-hash",
        "chunk-owner",
        "chunk-kb",
        "unparsed",
        "kb-owner",
        "building-replaced",
    ],
)
def test_changed_database_snapshot_is_rejected(database, change):
    with database.engine.begin() as connection:
        chunk = DocumentChunk.__table__
        first = chunk.c.id == database.snapshot[0].chunk_id
        if change == "added":
            connection.execute(
                chunk.insert().values(
                    owner_id=database.owner_id,
                    knowledge_base_id=database.knowledge_base_id,
                    document_id=database.document_id,
                    chunk_index=2,
                    chunk_text="added",
                    content_hash=sha256(b"added").hexdigest(),
                )
            )
        elif change == "removed":
            connection.execute(delete(chunk).where(first))
        elif change == "hash":
            connection.execute(
                update(chunk)
                .where(first)
                .values(chunk_text="changed", content_hash=sha256(b"changed").hexdigest())
            )
        elif change == "text-with-stale-hash":
            connection.execute(update(chunk).where(first).values(chunk_text="changed"))
        elif change in ("chunk-owner", "chunk-kb"):
            field = "owner_id" if change == "chunk-owner" else "knowledge_base_id"
            connection.execute(update(chunk).where(first).values(**{field: 999}))
        elif change == "unparsed":
            connection.execute(update(KnowledgeDocument).values(status="failed"))
        elif change == "kb-owner":
            connection.execute(update(KnowledgeBase).values(owner_id=999))
        else:
            connection.execute(update(KnowledgeDocument).values(building_index_generation=OLD))
    before = state(database)
    with pytest.raises(IndexPublicationError):
        publish(database)
    assert state(database) == before


@pytest.mark.parametrize("change", ["missing", "duplicate", "wrong-id", "extra", "duplicate-point"])
def test_invalid_mapping_rejected_without_changes(database, change):
    mappings = list(database.mappings)
    if change == "missing":
        mappings.pop()
    elif change == "duplicate":
        mappings.append(mappings[0])
    elif change == "wrong-id":
        mappings[0] = replace(mappings[0], point_id=OLD)
    elif change == "extra":
        mappings.append(PublishedVectorMapping(999, OLD))
    else:
        mappings[1] = replace(mappings[1], point_id=mappings[0].point_id)
    before = state(database)
    with pytest.raises(IndexPublicationError):
        publish(database, vector_mappings=mappings)
    assert state(database) == before


@pytest.mark.parametrize("change", ["empty", "duplicate", "missing", "wrong-hash"])
def test_invalid_build_snapshot(database, change):
    snapshot = list(database.snapshot)
    if change == "empty":
        snapshot.clear()
    elif change == "duplicate":
        snapshot.append(snapshot[0])
    elif change == "missing":
        snapshot.pop()
    else:
        snapshot[0] = replace(snapshot[0], content_hash="bad")
    before = state(database)
    with pytest.raises(IndexPublicationError):
        publish(database, chunk_snapshot=snapshot)
    assert state(database) == before


@pytest.mark.parametrize("failure_stage", ["first-chunk", "document-published", "before-commit"])
def test_transaction_failure_has_no_partial_publication(database, failure_stage):
    before = state(database)

    def fail_after_statement(connection, cursor, statement, parameters, context, executemany):
        normalized = statement.upper()
        if failure_stage == "first-chunk" and normalized.startswith("UPDATE DOCUMENT_CHUNKS"):
            raise RuntimeError("injected failure")
        if failure_stage == "document-published" and "SET INDEX_STATUS=" in normalized:
            raise RuntimeError("injected failure")
        if failure_stage == "document-published" and (
            normalized.startswith("UPDATE KNOWLEDGE_DOCUMENTS")
            and "ACTIVE_INDEX_GENERATION=" in normalized
        ):
            raise RuntimeError("injected failure")

    def fail_commit(connection):
        raise RuntimeError("injected failure")

    name = "commit" if failure_stage == "before-commit" else "after_cursor_execute"
    listener = fail_commit if failure_stage == "before-commit" else fail_after_statement
    event.listen(database.engine, name, listener)
    try:
        with pytest.raises(RuntimeError, match="injected failure"):
            publish(database)
    finally:
        event.remove(database.engine, name, listener)
    assert state(database) == before


def test_commit_acknowledgement_loss_is_not_reported_as_rollback(database, monkeypatch):
    original_commit = database.engine.dialect.do_commit
    error = RuntimeError("commit outcome unknown")

    def commit_then_fail(connection):
        original_commit(connection)
        raise error

    with monkeypatch.context() as patch:
        patch.setattr(database.engine.dialect, "do_commit", commit_then_fail)
        with pytest.raises(RuntimeError) as caught:
            publish(database)
        assert caught.value is error
    document, chunks = state(database)
    assert document["active_index_generation"] == NEW
    assert document["building_index_generation"] is None
    assert [chunk["vector_id"] for chunk in chunks] == [item.point_id for item in database.mappings]


def test_caller_pending_changes_are_not_committed(database):
    with Session(database.engine) as caller:
        knowledge_base = caller.get(KnowledgeBase, database.knowledge_base_id)
        knowledge_base.name = "unrelated pending change"
        publish(database)
        assert knowledge_base in caller.dirty
        with database.engine.connect() as connection:
            assert connection.scalar(select(KnowledgeBase.name)) == "original"
        caller.rollback()
