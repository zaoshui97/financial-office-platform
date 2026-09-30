"""Versioned indexing on temporary SQLite with real helpers and mock providers."""

from hashlib import sha256
from types import SimpleNamespace
from unittest.mock import Mock
from uuid import UUID

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from qdrant_client import QdrantClient
from qdrant_client.http import models
from qdrant_client.local.payload_filters import check_filter
from sqlalchemy import create_engine, event, select, update
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.database import Base
from app.features.auth.models import User
from app.features.rag import index_publish, indexing
from app.features.rag import router as rag_router
from app.features.rag.index_build import acquire_index_build
from app.features.rag.models import DocumentChunk, KnowledgeDocument
from app.integrations.qdrant_client import QdrantVectorStore
from tests.test_vector_rag import FakeEmbeddings, _create_parsed_document

OTHER = "12345678-1234-4234-8234-123456789abc"


@pytest.fixture
def context(tmp_path, monkeypatch):
    engine = create_engine(
        "sqlite:///" + (tmp_path / "versioned.sqlite").as_posix(), poolclass=NullPool
    )
    Base.metadata.create_all(engine)
    for key, value in {
        "RAG_INDEX_ENABLED": True,
        "EMBEDDING_PROVIDER": "fake",
        "EMBEDDING_MODEL": "fake-embedding",
        "EMBEDDING_DIMENSION": 3,
        "EMBEDDING_VERSION": "test-v1",
    }.items():
        monkeypatch.setattr(settings, key, value)
    monkeypatch.setattr(
        "app.integrations.qdrant_client.QdrantClient",
        Mock(side_effect=AssertionError("Real Qdrant forbidden")),
    )
    monkeypatch.setattr(
        indexing, "embedding_service", Mock(side_effect=AssertionError("Real Embedding forbidden"))
    )
    client = Mock(spec=QdrantClient)
    store = QdrantVectorStore(client)
    client.get_collection.return_value = SimpleNamespace(
        config=SimpleNamespace(
            params=SimpleNamespace(
                vectors=models.VectorParams(size=3, distance=models.Distance.COSINE)
            )
        )
    )
    points = {}

    def upsert(collection_name, *, points, wait):
        assert wait is True
        for point in points:
            stored_points[str(point.id)] = point
        return models.UpdateResult(status=models.UpdateStatus.COMPLETED)

    stored_points = points

    def search(**kwargs):
        hits = [
            SimpleNamespace(id=point.id, payload=point.payload, score=0.9)
            for point in points.values()
            if check_filter(kwargs["query_filter"], point.payload, point.id, {})
        ]
        return SimpleNamespace(points=hits)

    client.upsert.side_effect = upsert
    client.query_points.side_effect = search
    embeddings = Mock(wraps=FakeEmbeddings())
    with Session(engine, expire_on_commit=False) as session:
        user = User(username="builder", email="builder@example.com", hashed_password="hash")
        session.add(user)
        session.flush()
        document = _create_parsed_document(session, user.id)
        chunk = session.scalar(select(DocumentChunk))
        info = SimpleNamespace(
            engine=engine,
            owner_id=user.id,
            document_id=document.id,
            chunk_id=chunk.id,
            knowledge_base_id=document.knowledge_base_id,
            client=client,
            store=store,
            embeddings=embeddings,
            points=points,
            write=upsert,
        )
    try:
        yield info
    finally:
        client.delete.assert_not_called()
        client.delete_collection.assert_not_called()
        engine.dispose()


def state(context):
    with context.engine.connect() as connection:
        document = dict(connection.execute(select(KnowledgeDocument.__table__)).mappings().one())
        chunks = [
            dict(row) for row in connection.execute(select(DocumentChunk.__table__)).mappings()
        ]
    return document, chunks


def run(context, **overrides):
    with Session(context.engine) as session:
        return indexing.index_document(
            session,
            overrides.get("owner_id", context.owner_id),
            context.document_id,
            vector_store=context.store,
            embeddings=context.embeddings,
        )


def retrieve(context):
    with Session(context.engine) as session:
        return indexing.retrieve_vector_chunks(
            session,
            context.owner_id,
            context.knowledge_base_id,
            "question",
            vector_store=context.store,
            embeddings=context.embeddings,
        )


def seed_legacy(context):
    with Session(context.engine) as session:
        document = session.get(KnowledgeDocument, context.document_id)
        chunk = session.get(DocumentChunk, context.chunk_id)
        document.index_status = "indexed"
        document.index_collection = context.store.collection_name()
        chunk.vector_id = indexing.point_id_for_chunk(chunk.id)
        chunk.embedding_provider = "fake"
        chunk.embedding_model = "fake-embedding"
        chunk.embedding_dimension = 3
        chunk.embedding_version = "test-v1"
        context.points[chunk.vector_id] = models.PointStruct(
            id=chunk.vector_id, vector=[0.1] * 3, payload=indexing._chunk_payload(document, chunk)
        )
        session.commit()


def assert_old_preserved(context, before):
    document, chunks = state(context)
    assert chunks == before[1]
    for key in ("active_index_generation", "index_collection", "indexed_at"):
        assert document[key] == before[0][key]
    assert [hit.chunk.vector_id for hit in retrieve(context)] == [before[1][0]["vector_id"]]


@pytest.mark.parametrize("legacy", [False, True])
def test_success_and_unpublished_points_invisible(context, monkeypatch, legacy):
    if legacy:
        seed_legacy(context)
    before = state(context)
    original = index_publish.publish_index_generation

    def inspect_then_publish(*args, **kwargs):
        document, chunks = state(context)
        assert document["index_status"] == "indexing"
        assert chunks == before[1]
        assert document["active_index_generation"] == before[0]["active_index_generation"]
        hits = retrieve(context)
        assert len(hits) == int(legacy)
        if legacy:
            assert hits[0].chunk.vector_id == before[1][0]["vector_id"]
        return original(*args, **kwargs)

    monkeypatch.setattr(index_publish, "publish_index_generation", inspect_then_publish)
    response = run(context)
    document, chunks = state(context)
    assert response.index_status == document["index_status"] == "indexed"
    generation = document["active_index_generation"]
    assert str(UUID(generation)) == generation
    assert document["building_index_generation"] is None
    point = context.points[chunks[0]["vector_id"]]
    assert point.payload["generation"] == generation
    assert point.id == indexing.point_id_for_chunk_generation(
        context.document_id, context.chunk_id, generation
    )
    assert len(context.points) == 1 + int(legacy)
    assert retrieve(context)[0].chunk.vector_id == point.id


def test_rebuild_of_versioned_index_keeps_old_points(context):
    run(context)
    first = state(context)
    run(context)
    second = state(context)
    assert first[0]["active_index_generation"] != second[0]["active_index_generation"]
    assert first[1][0]["vector_id"] in context.points
    assert len(context.points) == 2
    assert retrieve(context)[0].chunk.vector_id == second[1][0]["vector_id"]


def test_conflict_makes_no_external_calls(context):
    assert acquire_index_build(
        context.document_id, context.owner_id, OTHER, database_engine=context.engine
    )
    before = state(context)
    with pytest.raises(indexing.VectorIndexError, match="conflict"):
        run(context)
    context.embeddings.embed_documents.assert_not_called()
    assert context.client.mock_calls == []
    assert state(context) == before


def test_wrong_user_rejected(context):
    with pytest.raises(HTTPException) as caught:
        run(context, owner_id=999)
    assert caught.value.status_code == 404
    context.embeddings.embed_documents.assert_not_called()
    assert context.client.mock_calls == []


@pytest.mark.parametrize(
    "field,value",
    [
        ("index_collection", "other"),
        ("embedding_model", "other"),
        ("embedding_provider", "other"),
        ("embedding_dimension", 4),
        ("embedding_version", "other"),
    ],
)
def test_incompatible_rebuild_rejected_before_claim(context, field, value):
    seed_legacy(context)
    table = KnowledgeDocument if field == "index_collection" else DocumentChunk
    with context.engine.begin() as connection:
        connection.execute(update(table).values({field: value}))
    before = state(context)
    with pytest.raises(indexing.VectorIndexError, match="incompatible"):
        run(context)
    assert state(context) == before
    context.embeddings.embed_documents.assert_not_called()
    assert context.client.mock_calls == []


@pytest.mark.parametrize(
    "failure", ["embedding", "upsert", "acknowledged", "wait_timeout", "missing"]
)
@pytest.mark.parametrize("legacy", [False, True])
def test_build_failures_keep_old_readable(context, monkeypatch, failure, legacy):
    if legacy:
        seed_legacy(context)
    else:
        run(context)
    before = state(context)
    publisher = Mock(wraps=index_publish.publish_index_generation)
    monkeypatch.setattr(index_publish, "publish_index_generation", publisher)
    if failure == "embedding":
        context.embeddings.embed_documents.side_effect = RuntimeError("fake-secret")
    else:

        def write_unconfirmed(*args, **kwargs):
            context.write(*args, **kwargs)
            if failure == "upsert":
                raise RuntimeError("partial write; fake-secret")
            if failure == "missing":
                return None
            return models.UpdateResult(status=models.UpdateStatus(failure))

        context.client.upsert.side_effect = write_unconfirmed
    with pytest.raises(indexing.VectorIndexError):
        run(context)
    publisher.assert_not_called()
    document, _ = state(context)
    assert document["index_status"] == "failed"
    assert document["building_index_generation"] is None
    assert "fake-secret" not in document["index_error"]
    assert_old_preserved(context, before)


@pytest.mark.parametrize("stage", ["before", "midway", "before-commit", "ack-lost"])
def test_publication_transactions_and_uncertainty(context, monkeypatch, stage):
    seed_legacy(context)
    before = state(context)
    original = index_publish.publish_index_generation

    def publish(*args, **kwargs):
        if stage == "before":
            raise RuntimeError("before publication")

        def fail_update(connection, cursor, statement, parameters, execution_context, executemany):
            if statement.upper().startswith("UPDATE DOCUMENT_CHUNKS"):
                raise RuntimeError("midway failure")

        def fail_commit(connection):
            raise RuntimeError("commit not sent")

        commit = context.engine.dialect.do_commit

        def commit_ack_lost(connection):
            commit(connection)
            raise RuntimeError("commit acknowledgement lost")

        if stage == "ack-lost":
            with monkeypatch.context() as patch:
                patch.setattr(context.engine.dialect, "do_commit", commit_ack_lost)
                return original(*args, **kwargs)
        name = "commit" if stage == "before-commit" else "after_cursor_execute"
        listener = fail_commit if stage == "before-commit" else fail_update
        event.listen(context.engine, name, listener)
        try:
            return original(*args, **kwargs)
        finally:
            event.remove(context.engine, name, listener)

    monkeypatch.setattr(index_publish, "publish_index_generation", publish)
    if stage == "ack-lost":
        assert run(context).index_status == "indexed"
        assert state(context)[0]["active_index_generation"] is not None
    else:
        with pytest.raises(indexing.VectorIndexError, match="publication failed"):
            run(context)
        assert_old_preserved(context, before)
        assert state(context)[0]["building_index_generation"] is None


@pytest.mark.parametrize("published", [False, True])
def test_unverifiable_publication_does_not_finalize(context, monkeypatch, published):
    seed_legacy(context)
    original = index_publish.publish_index_generation

    def publish(*args, **kwargs):
        if published:
            original(*args, **kwargs)
        raise RuntimeError("unknown outcome")

    monkeypatch.setattr(index_publish, "publish_index_generation", publish)
    monkeypatch.setattr(
        indexing, "_reconcile_publication", Mock(side_effect=RuntimeError("offline"))
    )
    finalizer = Mock(wraps=indexing.fail_index_build)
    monkeypatch.setattr(indexing, "fail_index_build", finalizer)
    with pytest.raises(indexing.VectorIndexError, match="reconciliation required"):
        run(context)
    finalizer.assert_not_called()
    document, _ = state(context)
    assert document["index_status"] == ("indexed" if published else "indexing")
    assert (document["building_index_generation"] is None) == published


@pytest.mark.parametrize("legacy", [True, False])
def test_chunk_change_rejects_publication(context, legacy):
    with context.engine.begin() as connection:
        connection.execute(
            update(DocumentChunk).values(
                page_number=2, chunk_metadata={"page_numbers": [2], "source_type": "pdf"}
            )
        )
    if legacy:
        seed_legacy(context)
    else:
        run(context)
    old_generation = state(context)[0]["active_index_generation"]
    old_point = state(context)[1][0]["vector_id"]
    old_payload = dict(context.points[old_point].payload)

    def write_and_change(*args, **kwargs):
        result = context.write(*args, **kwargs)
        with context.engine.begin() as connection:
            connection.execute(
                update(DocumentChunk).values(
                    chunk_text="changed",
                    content_hash=sha256(b"changed").hexdigest(),
                    page_number=99,
                    chunk_metadata={"page_numbers": [99], "source_type": "pdf"},
                )
            )
            connection.execute(update(KnowledgeDocument).values(original_filename="changed.pdf"))
        return result

    context.client.upsert.side_effect = write_and_change
    with pytest.raises(indexing.VectorIndexError, match="publication failed"):
        run(context)
    document, chunks = state(context)
    assert document["active_index_generation"] == old_generation
    assert chunks[0]["vector_id"] == old_point
    hits = retrieve(context)
    assert len(hits) == 1
    assert hits[0].chunk.vector_id == old_point
    assert hits[0].chunk.chunk_text == old_payload["text"]
    assert hits[0].chunk.content_hash == old_payload["content_hash"]
    assert hits[0].chunk.page_number == old_payload["page_number"] == 2
    assert hits[0].chunk.chunk_metadata["page_numbers"] == old_payload["page_numbers"] == [2]
    assert hits[0].filename == old_payload["filename"]


def test_response_failure_never_reverts_publication(context, monkeypatch):
    monkeypatch.setattr(
        indexing, "_read_index_response", Mock(side_effect=RuntimeError("response"))
    )
    finalizer = Mock(wraps=indexing.fail_index_build)
    monkeypatch.setattr(indexing, "fail_index_build", finalizer)
    with pytest.raises(RuntimeError, match="response"):
        run(context)
    finalizer.assert_not_called()
    document, _ = state(context)
    assert document["index_status"] == "indexed"
    assert document["active_index_generation"] is not None
    assert document["building_index_generation"] is None
    assert len(retrieve(context)) == 1


def test_acquire_commit_unknown_stops_without_external_calls(context, monkeypatch):
    original = indexing.acquire_index_build

    def acquire(*args, **kwargs):
        original(*args, **kwargs)
        raise RuntimeError("unknown acknowledgement")

    monkeypatch.setattr(indexing, "acquire_index_build", acquire)
    with pytest.raises(indexing.VectorIndexError, match="acquisition outcome unknown"):
        run(context)
    assert state(context)[0]["building_index_generation"] is not None
    context.embeddings.embed_documents.assert_not_called()
    assert context.client.mock_calls == []


def test_stale_caller_is_not_used_or_committed(context):
    with Session(context.engine, expire_on_commit=False) as caller:
        document = caller.get(KnowledgeDocument, context.document_id)
        chunk = caller.get(DocumentChunk, context.chunk_id)
        user = caller.get(User, context.owner_id)
        user.username = "unrelated-pending-change"
        response = indexing.index_document(
            caller,
            context.owner_id,
            context.document_id,
            vector_store=context.store,
            embeddings=context.embeddings,
        )
        assert response is not document
        assert response not in caller
        assert document.active_index_generation is None
        assert chunk.vector_id is None
        assert user in caller.dirty
        with context.engine.connect() as connection:
            assert connection.scalar(select(User.username)) == "builder"
        caller.rollback()
    assert state(context)[0]["index_status"] == "indexed"


def test_snapshot_is_reread_after_acquisition(context, monkeypatch):
    original = indexing.acquire_index_build

    def acquire_then_change(*args, **kwargs):
        result = original(*args, **kwargs)
        with context.engine.begin() as connection:
            connection.execute(
                update(DocumentChunk).values(
                    chunk_text="fresh content", content_hash=sha256(b"fresh content").hexdigest()
                )
            )
        return result

    monkeypatch.setattr(indexing, "acquire_index_build", acquire_then_change)
    run(context)
    context.embeddings.embed_documents.assert_called_once_with(["fresh content"])
    assert next(iter(context.points.values())).payload["text"] == "fresh content"


def test_two_chunks_partial_write_does_not_publish(context, monkeypatch):
    with Session(context.engine) as session:
        session.add(
            DocumentChunk(
                owner_id=context.owner_id,
                knowledge_base_id=context.knowledge_base_id,
                document_id=context.document_id,
                chunk_index=1,
                chunk_text="second",
                content_hash=sha256(b"second").hexdigest(),
                chunk_metadata={},
            )
        )
        session.commit()
    publisher = Mock(wraps=index_publish.publish_index_generation)
    monkeypatch.setattr(index_publish, "publish_index_generation", publisher)

    def partial_write(collection_name, *, points, wait):
        assert len(points) == 2
        context.write(collection_name, points=points[:1], wait=wait)
        raise RuntimeError("partial write")

    context.client.upsert.side_effect = partial_write
    with pytest.raises(indexing.VectorIndexError):
        run(context)
    publisher.assert_not_called()
    assert len(context.points) == 1
    assert retrieve(context) == []
    assert all(chunk["vector_id"] is None for chunk in state(context)[1])


def test_changed_build_owner_during_publication_is_not_finalized(context, monkeypatch):
    def fail_with_new_owner(*args, **kwargs):
        with context.engine.begin() as connection:
            connection.execute(update(KnowledgeDocument).values(building_index_generation=OTHER))
        raise RuntimeError("owner changed")

    monkeypatch.setattr(index_publish, "publish_index_generation", fail_with_new_owner)
    finalizer = Mock(wraps=indexing.fail_index_build)
    monkeypatch.setattr(indexing, "fail_index_build", finalizer)
    with pytest.raises(indexing.VectorIndexError, match="reconciliation required"):
        run(context)
    finalizer.assert_not_called()
    assert state(context)[0]["building_index_generation"] == OTHER
    assert retrieve(context) == []


def test_failure_finalization_uncertainty_does_not_retry(context, monkeypatch):
    context.embeddings.embed_documents.side_effect = RuntimeError("embedding failure")
    finalizer = Mock(side_effect=RuntimeError("commit outcome unknown"))
    monkeypatch.setattr(indexing, "fail_index_build", finalizer)
    with pytest.raises(indexing.VectorIndexError, match="finalization outcome unknown"):
        run(context)
    finalizer.assert_called_once()
    assert state(context)[0]["building_index_generation"] is not None


@pytest.mark.parametrize("assembly_failure", [False, True])
def test_actual_index_and_reindex_routes(context, monkeypatch, assembly_failure):
    from fastapi import FastAPI

    from app.core.database import get_db
    from app.features.auth.dependencies import get_current_user

    app = FastAPI()
    app.include_router(rag_router.router)

    def test_db():
        with Session(context.engine) as session:
            yield session

    app.dependency_overrides[get_db] = test_db
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=context.owner_id)
    monkeypatch.setattr(indexing, "qdrant_store", context.store)
    monkeypatch.setattr(indexing, "embedding_service", context.embeddings)
    with TestClient(app, raise_server_exceptions=False) as client:
        first = client.post(f"{rag_router.router.prefix}/documents/{context.document_id}/index")
        assert first.status_code == 200
        assert first.json()["index_status"] == "indexed"
        first_generation = state(context)[0]["active_index_generation"]
        if assembly_failure:
            monkeypatch.setattr(
                rag_router.DocumentRead,
                "model_validate",
                Mock(side_effect=RuntimeError("response")),
            )
        second = client.post(f"{rag_router.router.prefix}/documents/{context.document_id}/reindex")
        assert second.status_code == (500 if assembly_failure else 200)
    document, _ = state(context)
    assert document["index_status"] == "indexed"
    assert document["active_index_generation"] != first_generation
    assert document["building_index_generation"] is None
    assert len(retrieve(context)) == 1
