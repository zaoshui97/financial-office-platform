"""Active snapshot retrieval using SQLite and mocked external services only."""

from copy import deepcopy
from hashlib import sha256
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from qdrant_client import QdrantClient
from qdrant_client.local.payload_filters import check_filter
from sqlalchemy import select, update

from app.core.config import settings
from app.features.auth.models import User
from app.features.rag import indexing
from app.features.rag.indexing import (
    VectorIndexError,
    point_id_for_chunk,
    point_id_for_chunk_generation,
    retrieve_vector_chunks,
)
from app.features.rag.models import DocumentChunk, KnowledgeBase, KnowledgeDocument
from app.integrations.qdrant_client import QdrantVectorStore
from tests.test_vector_rag import FakeEmbeddings, _create_parsed_document

ACTIVE = "12345678-1234-4234-8234-123456789abc"
BUILDING = "12345678-1234-4234-8234-123456789abd"


@pytest.fixture
def context(db_session, monkeypatch):
    monkeypatch.setattr(settings, "EMBEDDING_PROVIDER", "fake")
    monkeypatch.setattr(settings, "EMBEDDING_MODEL", "fake-embedding")
    monkeypatch.setattr(settings, "EMBEDDING_DIMENSION", 3)
    monkeypatch.setattr(settings, "EMBEDDING_VERSION", "test-v1")
    monkeypatch.setattr(
        "app.integrations.qdrant_client.QdrantClient",
        Mock(side_effect=AssertionError("Real Qdrant is forbidden")),
    )
    monkeypatch.setattr(
        "app.features.rag.indexing.embedding_service.embed_query",
        Mock(side_effect=AssertionError("Real Embedding is forbidden")),
    )
    user = User(username="snapshot", email="snapshot@example.com", hashed_password="hash")
    db_session.add(user)
    db_session.flush()
    document = _create_parsed_document(db_session, user.id)
    chunk = db_session.scalar(select(DocumentChunk).where(DocumentChunk.document_id == document.id))
    client = Mock(spec=QdrantClient)
    store = QdrantVectorStore(client=client)
    document.index_collection = store.collection_name()
    document.index_status = "indexed"
    chunk.vector_id = point_id_for_chunk(chunk.id)
    chunk.embedding_provider = "fake"
    chunk.embedding_model = "fake-embedding"
    chunk.embedding_dimension = 3
    chunk.embedding_version = "test-v1"
    db_session.commit()
    point = SimpleNamespace(
        id=chunk.vector_id,
        score=0.9,
        payload={
            "owner_id": user.id,
            "knowledge_base_id": document.knowledge_base_id,
            "document_id": document.id,
            "chunk_id": chunk.id,
            "text": chunk.chunk_text,
            "content_hash": chunk.content_hash,
            "filename": document.original_filename,
            "page_number": chunk.page_number,
            "page_numbers": list(chunk.chunk_metadata["page_numbers"]),
        },
    )
    client.query_points.return_value = SimpleNamespace(points=[point])
    embeddings = Mock()
    embeddings.embed_query.return_value = FakeEmbeddings().embed_query("test")
    return SimpleNamespace(
        user=user,
        document=document,
        chunk=chunk,
        client=client,
        store=store,
        point=point,
        embeddings=embeddings,
    )


def retrieve(db_session, context):
    return retrieve_vector_chunks(
        db_session,
        context.user.id,
        context.document.knowledge_base_id,
        "question",
        vector_store=context.store,
        embeddings=context.embeddings,
    )


def add_indexed_document(db_session, context, filename, scores):
    document = KnowledgeDocument(
        knowledge_base_id=context.document.knowledge_base_id,
        owner_id=context.user.id,
        original_filename=filename,
        stored_path=f"storage/{filename}",
        file_type="pdf",
        file_size=100,
        status="parsed",
        parsed_text="indexed test document",
        parsed_char_count=21,
        index_status="indexed",
        index_collection=context.store.collection_name(),
    )
    db_session.add(document)
    db_session.flush()
    chunks = []
    for index, score in enumerate(scores):
        text = f"{filename} chunk {index}"
        chunk = DocumentChunk(
            owner_id=context.user.id,
            knowledge_base_id=document.knowledge_base_id,
            document_id=document.id,
            chunk_index=index,
            chunk_text=text,
            page_number=index + 1,
            chunk_metadata={"page_numbers": [index + 1]},
            content_hash=sha256(text.encode("utf-8")).hexdigest(),
            embedding_provider="fake",
            embedding_model="fake-embedding",
            embedding_dimension=3,
            embedding_version="test-v1",
        )
        db_session.add(chunk)
        chunks.append((chunk, score))
    db_session.flush()

    points = []
    for chunk, score in chunks:
        chunk.vector_id = point_id_for_chunk(chunk.id)
        points.append(
            SimpleNamespace(
                id=chunk.vector_id,
                score=score,
                payload={
                    "owner_id": context.user.id,
                    "knowledge_base_id": document.knowledge_base_id,
                    "document_id": document.id,
                    "chunk_id": chunk.id,
                    "text": chunk.chunk_text,
                    "content_hash": chunk.content_hash,
                    "filename": filename,
                    "page_number": chunk.page_number,
                    "page_numbers": list(chunk.chunk_metadata["page_numbers"]),
                },
            )
        )
    db_session.commit()
    return document, points


@pytest.mark.parametrize("status", ["indexed", "indexing", "failed"])
@pytest.mark.parametrize("generation", [None, ACTIVE])
def test_active_mapping_remains_readable(db_session, context, status, generation):
    context.document.index_status = status
    context.document.active_index_generation = generation
    context.document.building_index_generation = BUILDING
    if generation:
        context.chunk.vector_id = point_id_for_chunk_generation(
            context.document.id, context.chunk.id, generation
        )
        context.point.id = context.chunk.vector_id
        context.point.payload["generation"] = generation
    db_session.commit()

    hits = retrieve(db_session, context)

    assert len(hits) == 1
    assert hits[0].chunk.id == context.chunk.id
    assert hits[0].chunk not in db_session
    arguments = context.client.query_points.call_args.kwargs
    assert arguments["collection_name"] == context.document.index_collection
    query_filter = arguments["query_filter"]
    assert check_filter(query_filter, context.point.payload, context.point.id, {})
    building_id = point_id_for_chunk_generation(context.document.id, context.chunk.id, BUILDING)
    building_payload = dict(context.point.payload, generation=BUILDING)
    assert not check_filter(query_filter, building_payload, building_id, {})
    assert not check_filter(
        query_filter, dict(context.point.payload, owner_id=999), context.point.id, {}
    )
    assert not check_filter(
        query_filter, dict(context.point.payload, knowledge_base_id=999), context.point.id, {}
    )
    context.client.upsert.assert_not_called()
    context.client.delete.assert_not_called()


def test_top_twenty_multi_title_selection_includes_document_ranked_eighteenth(
    db_session, context, monkeypatch
):
    monkeypatch.setattr(settings, "RAG_VECTOR_TOP_K", 20)
    monkeypatch.setattr(settings, "RAG_VECTOR_TOP_N", 6)
    industry, industry_points = add_indexed_document(
        db_session,
        context,
        "银行保险机构数据安全管理办法.pdf",
        [1.0 - index / 100 for index in range(17)],
    )
    general, general_points = add_indexed_document(
        db_session,
        context,
        "中华人民共和国数据安全法.pdf",
        [0.56, 0.55, 0.54],
    )
    context.client.query_points.return_value = SimpleNamespace(
        points=[*industry_points, *general_points]
    )
    question = (
        "《中华人民共和国数据安全法》的通用义务如何在"
        "《银行保险机构数据安全管理办法》中被细化？"
    )

    hits = retrieve_vector_chunks(
        db_session,
        context.user.id,
        context.document.knowledge_base_id,
        question,
        vector_store=context.store,
        embeddings=context.embeddings,
    )

    assert [hit.chunk.document_id for hit in hits] == [
        general.id,
        industry.id,
        general.id,
        industry.id,
        general.id,
        industry.id,
    ]
    assert len(hits) == settings.RAG_VECTOR_TOP_N
    context.embeddings.embed_query.assert_called_once_with(question)
    context.client.query_points.assert_called_once()
    assert context.client.query_points.call_args.kwargs["limit"] == 20


def test_single_title_returns_only_the_named_document(db_session, context, monkeypatch):
    monkeypatch.setattr(settings, "RAG_VECTOR_TOP_K", 20)
    monkeypatch.setattr(settings, "RAG_VECTOR_TOP_N", 6)
    other, other_points = add_indexed_document(
        db_session,
        context,
        "其他制度.pdf",
        [0.99, 0.98, 0.97, 0.96],
    )
    target, target_points = add_indexed_document(
        db_session,
        context,
        "目标制度.pdf",
        [0.60, 0.59, 0.58, 0.57, 0.56, 0.55],
    )
    context.client.query_points.return_value = SimpleNamespace(
        points=[*other_points, *target_points]
    )

    hits = retrieve_vector_chunks(
        db_session,
        context.user.id,
        context.document.knowledge_base_id,
        "请依据《目标制度》回答。",
        vector_store=context.store,
        embeddings=context.embeddings,
    )

    assert other.id != target.id
    assert [hit.chunk.document_id for hit in hits] == [target.id] * 6
    assert [hit.score for hit in hits] == [0.60, 0.59, 0.58, 0.57, 0.56, 0.55]
    assert context.embeddings.embed_query.call_count == 1
    assert context.client.query_points.call_count == 1


def test_no_title_preserves_validated_global_score_order(db_session, context, monkeypatch):
    monkeypatch.setattr(settings, "RAG_VECTOR_TOP_K", 20)
    monkeypatch.setattr(settings, "RAG_VECTOR_TOP_N", 6)
    first, first_points = add_indexed_document(
        db_session, context, "第一份.pdf", [0.95, 0.75]
    )
    second, second_points = add_indexed_document(
        db_session, context, "第二份.pdf", [0.90, 0.80, 0.70, 0.60]
    )
    context.client.query_points.return_value = SimpleNamespace(
        points=[
            second_points[2],
            first_points[1],
            second_points[0],
            first_points[0],
            second_points[1],
            second_points[3],
        ]
    )

    hits = retrieve_vector_chunks(
        db_session,
        context.user.id,
        context.document.knowledge_base_id,
        "请比较相关制度。",
        vector_store=context.store,
        embeddings=context.embeddings,
    )

    assert first.id != second.id
    assert [hit.score for hit in hits] == [0.95, 0.90, 0.80, 0.75, 0.70, 0.60]


def test_selector_runs_only_after_point_generation_and_hash_validation(
    db_session, context, monkeypatch
):
    monkeypatch.setattr(settings, "RAG_VECTOR_TOP_K", 20)
    monkeypatch.setattr(settings, "RAG_VECTOR_TOP_N", 6)
    context.document.original_filename = "安全制度.pdf"
    context.document.active_index_generation = ACTIVE
    context.chunk.vector_id = point_id_for_chunk_generation(
        context.document.id, context.chunk.id, ACTIVE
    )
    context.point.id = context.chunk.vector_id
    context.point.payload["filename"] = context.document.original_filename
    context.point.payload["generation"] = ACTIVE
    context.point.score = 0.50
    db_session.commit()

    invalid_point = deepcopy(context.point)
    invalid_point.id = point_id_for_chunk_generation(
        context.document.id, context.chunk.id, BUILDING
    )
    invalid_point.score = 0.99
    invalid_generation = deepcopy(context.point)
    invalid_generation.payload["generation"] = BUILDING
    invalid_generation.score = 0.98
    invalid_hash = deepcopy(context.point)
    invalid_hash.payload["content_hash"] = sha256(b"tampered").hexdigest()
    invalid_hash.score = 0.97
    context.client.query_points.return_value = SimpleNamespace(
        points=[invalid_point, invalid_generation, invalid_hash, context.point]
    )

    hits = retrieve_vector_chunks(
        db_session,
        context.user.id,
        context.document.knowledge_base_id,
        "请依据《安全制度》回答。",
        vector_store=context.store,
        embeddings=context.embeddings,
    )

    assert len(hits) == 1
    assert hits[0].chunk.id == context.chunk.id
    assert hits[0].score == 0.50


def test_score_threshold_runs_after_security_checks_and_before_title_selection(
    db_session, context, monkeypatch, caplog
):
    monkeypatch.setattr(settings, "RAG_VECTOR_SCORE_THRESHOLD", 0.45)
    context.point.score = 0.449999
    invalid_hash = deepcopy(context.point)
    invalid_hash.score = 0.99
    invalid_hash.payload["content_hash"] = sha256(b"tampered").hexdigest()
    context.client.query_points.return_value = SimpleNamespace(
        points=[invalid_hash, context.point]
    )
    stages: dict[str, list[int]] = {}
    original_filter = indexing.filter_retrieval_candidates_by_score
    original_selector = indexing.select_retrieval_candidates

    def observe_filter(candidates, threshold, *, score_of):
        stages["threshold_input"] = [candidate.chunk.id for candidate in candidates]
        return original_filter(candidates, threshold, score_of=score_of)

    def observe_selector(question, candidates, documents, top_n, **kwargs):
        stages["selector_input"] = [candidate.chunk.id for candidate in candidates]
        return original_selector(question, candidates, documents, top_n, **kwargs)

    monkeypatch.setattr(indexing, "filter_retrieval_candidates_by_score", observe_filter)
    monkeypatch.setattr(indexing, "select_retrieval_candidates", observe_selector)
    caplog.set_level("INFO", logger="app.features.rag.indexing")

    hits = retrieve(db_session, context)

    assert hits == []
    assert stages == {"threshold_input": [context.chunk.id], "selector_input": []}
    threshold_logs = [
        record.getMessage()
        for record in caplog.records
        if "向量分数阈值过滤" in record.getMessage()
    ]
    assert len(threshold_logs) == 1
    assert "threshold=0.4500" in threshold_logs[0]
    assert "before=1" in threshold_logs[0]
    assert "after=0" in threshold_logs[0]
    assert context.chunk.chunk_text not in threshold_logs[0]
    assert context.document.original_filename not in threshold_logs[0]


def test_low_score_named_document_is_not_reintroduced_by_title_selection(
    db_session, context, monkeypatch
):
    monkeypatch.setattr(settings, "RAG_VECTOR_TOP_K", 20)
    monkeypatch.setattr(settings, "RAG_VECTOR_TOP_N", 6)
    monkeypatch.setattr(settings, "RAG_VECTOR_SCORE_THRESHOLD", 0.45)
    target, target_points = add_indexed_document(
        db_session, context, "目标制度.pdf", [0.449999]
    )
    other, other_points = add_indexed_document(
        db_session, context, "其他制度.pdf", [0.90]
    )
    context.client.query_points.return_value = SimpleNamespace(
        points=[*other_points, *target_points]
    )

    hits = retrieve_vector_chunks(
        db_session,
        context.user.id,
        context.document.knowledge_base_id,
        "请依据《目标制度》回答。",
        vector_store=context.store,
        embeddings=context.embeddings,
    )

    assert target.id != other.id
    assert hits == []
    context.embeddings.embed_query.assert_called_once()
    context.client.query_points.assert_called_once()
    assert context.client.query_points.call_args.kwargs["limit"] == 20


@pytest.mark.parametrize("reason", ["no-point", "invalid-point", "unparsed", "foreign", "other-kb"])
def test_no_active_mapping_does_not_query(db_session, context, reason):
    if reason == "no-point":
        context.chunk.vector_id = None
    elif reason == "invalid-point":
        context.chunk.vector_id = "not-a-uuid"
    elif reason == "unparsed":
        context.document.status = "failed"
    elif reason == "foreign":
        context.document.owner_id = 999
    else:
        context.chunk.knowledge_base_id = 999
    db_session.commit()
    assert retrieve(db_session, context) == []
    context.embeddings.embed_query.assert_not_called()
    context.client.query_points.assert_not_called()


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("index_collection", "other"),
        ("index_collection", None),
        ("embedding_provider", "other"),
        ("embedding_model", "other"),
        ("embedding_dimension", 1024),
        ("embedding_version", "other"),
        ("embedding_model", None),
    ],
)
def test_incompatible_mapping_is_explicit(db_session, context, field, value):
    target = context.document if field == "index_collection" else context.chunk
    setattr(target, field, value)
    db_session.commit()
    with pytest.raises(VectorIndexError, match="incompatible"):
        retrieve(db_session, context)
    context.embeddings.embed_query.assert_not_called()
    context.client.query_points.assert_not_called()


@pytest.mark.parametrize("field", ["provider", "model", "dimension", "vectors"])
def test_query_embedding_mismatch_never_queries_qdrant(db_session, context, field):
    result = context.embeddings.embed_query.return_value
    values = {"provider": "other", "model": "other", "dimension": 4, "vectors": [[0.1, 0.2]]}
    context.embeddings.embed_query.return_value = result.model_copy(update={field: values[field]})
    with pytest.raises(VectorIndexError, match="Query Embedding"):
        retrieve(db_session, context)
    context.client.query_points.assert_not_called()


@pytest.mark.parametrize(
    "field",
    [
        "point",
        "generation",
        "chunk_id",
        "document_id",
        "owner_id",
        "knowledge_base_id",
        "missing-generation",
    ],
)
def test_mismatched_response_is_rejected(db_session, context, field):
    context.document.active_index_generation = ACTIVE
    context.chunk.vector_id = point_id_for_chunk_generation(
        context.document.id, context.chunk.id, ACTIVE
    )
    context.point.id = context.chunk.vector_id
    context.point.payload["generation"] = ACTIVE
    db_session.commit()
    if field == "point":
        context.point.id = point_id_for_chunk_generation(
            context.document.id, context.chunk.id, BUILDING
        )
    elif field == "generation":
        context.point.payload[field] = BUILDING
    elif field == "missing-generation":
        context.point.payload.pop("generation")
    else:
        context.point.payload[field] = 999
    assert retrieve(db_session, context) == []


def test_snapshot_does_not_follow_orm_changes_during_query(db_session, context):
    original_text = context.chunk.chunk_text
    original_point = context.chunk.vector_id
    original_filename = context.document.original_filename

    def change_orm(**kwargs):
        context.document.active_index_generation = BUILDING
        context.document.original_filename = "changed.txt"
        context.chunk.vector_id = point_id_for_chunk_generation(
            context.document.id, context.chunk.id, BUILDING
        )
        context.chunk.chunk_text = "changed"
        db_session.flush()
        return SimpleNamespace(points=[context.point])

    context.client.query_points.side_effect = change_orm
    hits = retrieve(db_session, context)
    assert len(hits) == 1
    assert hits[0].chunk.vector_id == original_point
    assert hits[0].chunk.chunk_text == original_text
    assert hits[0].filename == original_filename


def test_snapshot_bypasses_stale_orm_identity(db_session, context):
    point_id = point_id_for_chunk_generation(context.document.id, context.chunk.id, ACTIVE)
    db_session.execute(
        update(KnowledgeDocument)
        .where(KnowledgeDocument.id == context.document.id)
        .values(active_index_generation=ACTIVE)
        .execution_options(synchronize_session=False)
    )
    db_session.execute(
        update(DocumentChunk)
        .where(DocumentChunk.id == context.chunk.id)
        .values(vector_id=point_id)
        .execution_options(synchronize_session=False)
    )
    assert context.document.active_index_generation is None
    context.point.id = point_id
    context.point.payload["generation"] = ACTIVE
    hits = retrieve(db_session, context)
    assert len(hits) == 1
    assert hits[0].chunk.vector_id == point_id


def test_foreign_knowledge_base_is_excluded(db_session, context):
    knowledge_base = db_session.get(KnowledgeBase, context.document.knowledge_base_id)
    knowledge_base.owner_id = 999
    db_session.commit()
    assert retrieve(db_session, context) == []
    context.client.query_points.assert_not_called()


def test_empty_knowledge_base_does_not_query(db_session, context):
    knowledge_base = KnowledgeBase(owner_id=context.user.id, name="empty")
    db_session.add(knowledge_base)
    db_session.commit()
    assert (
        retrieve_vector_chunks(
            db_session,
            context.user.id,
            knowledge_base.id,
            "question",
            vector_store=context.store,
            embeddings=context.embeddings,
        )
        == []
    )
    context.embeddings.embed_query.assert_not_called()
    context.client.query_points.assert_not_called()


def test_building_generation_alone_is_not_active(db_session, context):
    context.document.active_index_generation = None
    context.document.building_index_generation = BUILDING
    context.document.index_status = "indexing"
    context.chunk.vector_id = None
    db_session.commit()
    assert retrieve(db_session, context) == []
    context.embeddings.embed_query.assert_not_called()
    context.client.query_points.assert_not_called()


@pytest.mark.parametrize("generation", [None, ACTIVE])
@pytest.mark.parametrize("field", ["text", "content_hash", "filename"])
@pytest.mark.parametrize("invalid", ["missing", None, "", 123])
def test_required_payload_fields_rejected(db_session, context, generation, field, invalid):
    context.document.active_index_generation = generation
    if generation:
        context.chunk.vector_id = point_id_for_chunk_generation(
            context.document.id, context.chunk.id, generation
        )
        context.point.id = context.chunk.vector_id
        context.point.payload["generation"] = generation
    db_session.commit()
    if invalid == "missing":
        context.point.payload.pop(field)
    else:
        context.point.payload[field] = invalid
    assert retrieve(db_session, context) == []


@pytest.mark.parametrize(
    "field,value",
    [
        ("text", "tampered"),
        ("text", "\ud800"),
        ("content_hash", sha256(b"tampered").hexdigest()),
        ("content_hash", "invalid-hash"),
    ],
)
def test_payload_hash_must_match_utf8_text(db_session, context, field, value):
    context.point.payload[field] = value
    assert retrieve(db_session, context) == []


@pytest.mark.parametrize("page_number,page_numbers", [(None, []), (2, [2]), (None, [2, 3])])
def test_citations_use_only_point_snapshot(db_session, context, page_number, page_numbers):
    context.point.payload.update(page_number=page_number, page_numbers=page_numbers)
    old_payload = dict(context.point.payload)
    context.chunk.chunk_text = "unpublished"
    context.chunk.content_hash = sha256(b"unpublished").hexdigest()
    context.chunk.page_number = 99
    context.chunk.chunk_metadata = {"page_numbers": [99], "unpublished_metadata": True}
    context.document.original_filename = "unpublished.pdf"
    db_session.commit()

    hits = retrieve(db_session, context)

    assert len(hits) == 1
    assert hits[0].chunk.chunk_text == old_payload["text"]
    assert hits[0].chunk.content_hash == old_payload["content_hash"]
    assert hits[0].filename == old_payload["filename"]
    assert hits[0].chunk.page_number == page_number
    assert hits[0].chunk.chunk_metadata == {"page_numbers": page_numbers}
    assert hits[0].chunk not in db_session


def test_missing_pages_never_use_current_database_pages(db_session, context):
    context.point.payload.pop("page_number")
    context.point.payload.pop("page_numbers")
    context.chunk.page_number = 99
    context.chunk.chunk_metadata = {"page_numbers": [99]}
    db_session.commit()
    hit = retrieve(db_session, context)[0]
    assert hit.chunk.page_number is None
    assert hit.chunk.chunk_metadata == {"page_numbers": []}


@pytest.mark.parametrize(
    "page_number,page_numbers",
    [(0, []), (True, [1]), (None, [False]), (None, "2"), (None, [-1]), (2, [3])],
)
def test_invalid_payload_pages_rejected(db_session, context, page_number, page_numbers):
    context.point.payload.update(page_number=page_number, page_numbers=page_numbers)
    assert retrieve(db_session, context) == []


def test_legacy_point_with_unexpected_generation_rejected(db_session, context):
    context.point.payload["generation"] = BUILDING
    assert retrieve(db_session, context) == []
