"""企业知识库向量索引和检索的纯Mock测试。"""

from hashlib import sha256
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from qdrant_client import QdrantClient
from qdrant_client.http import models
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool

from app.ai.embeddings.schemas import EmbeddingResult
from app.core.config import settings
from app.core.database import Base
from app.features.auth.models import User
from app.features.rag.indexing import (
    VectorIndexError,
    delete_document_vectors,
    index_document,
    retrieve_vector_chunks,
)
from app.features.rag.models import DocumentChunk, KnowledgeDocument
from app.integrations.qdrant_client import QdrantError, QdrantVectorStore, VectorHit


@pytest.fixture
def db_session(tmp_path):
    """Independent transactions require separate connections to a temporary file DB."""
    engine = create_engine(
        "sqlite:///" + (tmp_path / "vector.sqlite").as_posix(), poolclass=NullPool
    )
    Base.metadata.create_all(engine)
    try:
        with Session(engine, expire_on_commit=False) as session:
            yield session
    finally:
        engine.dispose()


@pytest.fixture(autouse=True)
def embedding_configuration(monkeypatch):
    monkeypatch.setattr(settings, "EMBEDDING_PROVIDER", "fake")
    monkeypatch.setattr(settings, "EMBEDDING_MODEL", "fake-embedding")
    monkeypatch.setattr(settings, "EMBEDDING_DIMENSION", 3)


class FakeEmbeddings:
    """返回固定维度向量且不访问外部Embedding服务。"""

    def __init__(self, dimension: int = 3) -> None:
        self.dimension = dimension
        self.document_calls: list[list[str]] = []

    def embed_documents(self, texts: list[str]) -> EmbeddingResult:
        self.document_calls.append(texts)
        return EmbeddingResult(
            vectors=[[float(index)] * self.dimension for index, _ in enumerate(texts)],
            provider="fake",
            model="fake-embedding",
            dimension=self.dimension,
            latency_ms=1.0,
        )

    def embed_query(self, text: str) -> EmbeddingResult:
        return EmbeddingResult(
            vectors=[[0.1] * self.dimension],
            provider="fake",
            model="fake-embedding",
            dimension=self.dimension,
            latency_ms=1.0,
        )


class FakeVectorStore:
    """记录写入、删除和检索参数的Qdrant替身。"""

    def __init__(self) -> None:
        self.upserted = []
        self.deleted: list[tuple[str, list[str]]] = []
        self.search_args = None

    @staticmethod
    def collection_name() -> str:
        return "fake_collection"

    def ensure_collection(self, dimension: int) -> str:
        assert dimension == 3
        return "fake_collection"

    def upsert(self, collection_name: str, points) -> None:
        self.upserted.extend(points)

    def delete_points(self, collection_name: str, point_ids: list[str]) -> None:
        self.deleted.append((collection_name, point_ids))

    def search(self, collection_name, vector, owner_id, knowledge_base_id, limit, *, query_filter):
        self.search_args = (collection_name, vector, owner_id, knowledge_base_id, limit)
        self.query_filter = query_filter
        if not self.upserted:
            return []
        point = self.upserted[0]
        return [VectorHit(point_id=str(point.id), score=0.91, payload=point.payload)]


class FailingVectorStore(FakeVectorStore):
    """在写入后模拟Qdrant失败，验证失败清理和状态记录。"""

    def upsert(self, collection_name: str, points) -> None:
        self.upserted.extend(points)
        raise QdrantError("Qdrant向量写入失败")


def _create_parsed_document(db_session, owner_id: int) -> KnowledgeDocument:
    """创建可索引的最小文档和Chunk。"""
    from app.features.rag.models import KnowledgeBase

    knowledge_base = KnowledgeBase(owner_id=owner_id, name="向量测试库")
    db_session.add(knowledge_base)
    db_session.flush()
    document = KnowledgeDocument(
        knowledge_base_id=knowledge_base.id,
        owner_id=owner_id,
        original_filename="policy.txt",
        stored_path="storage/policy.txt",
        file_type="txt",
        file_size=10,
        status="parsed",
        parsed_text="差旅报销标准为每晚500元。",
        parsed_char_count=12,
    )
    db_session.add(document)
    db_session.flush()
    db_session.add(
        DocumentChunk(
            owner_id=owner_id,
            knowledge_base_id=knowledge_base.id,
            document_id=document.id,
            chunk_index=0,
            chunk_text="差旅报销标准为每晚500元。",
            chunk_metadata={"source_type": "txt", "page_numbers": []},
            content_hash=sha256("差旅报销标准为每晚500元。".encode()).hexdigest(),
        )
    )
    db_session.commit()
    db_session.refresh(document)
    return document


@pytest.mark.parametrize(
    ("vectors", "expected_error"),
    [
        pytest.param(
            models.VectorParams(size=3, distance=models.Distance.COSINE), None, id="match"
        ),
        pytest.param(
            models.VectorParams(size=4, distance=models.Distance.COSINE),
            "维度不匹配: expected=3, actual=4",
            id="dimension-mismatch",
        ),
        pytest.param(
            models.VectorParams(size=3, distance=models.Distance.DOT),
            "距离算法不匹配: expected=Cosine, actual=Dot",
            id="dot-mismatch",
        ),
        pytest.param(
            models.VectorParams(size=3, distance=models.Distance.EUCLID),
            "距离算法不匹配: expected=Cosine, actual=Euclid",
            id="euclid-mismatch",
        ),
        pytest.param(
            {"text": models.VectorParams(size=3, distance=models.Distance.COSINE)},
            "向量配置不支持",
            id="named-vectors",
        ),
        pytest.param(None, "向量配置不支持", id="missing-vectors"),
        pytest.param(
            {"size": 3, "distance": "Cosine"},
            "向量配置不支持",
            id="untyped-config",
        ),
        pytest.param(
            models.VectorParams(
                size=3,
                distance=models.Distance.COSINE,
                multivector_config=models.MultiVectorConfig(
                    comparator=models.MultiVectorComparator.MAX_SIM,
                ),
            ),
            "向量配置不支持",
            id="multivector",
        ),
    ],
)
def test_existing_collection_parameters_before_write(
    db_session, monkeypatch, vectors, expected_error
) -> None:
    """通过真实适配器和Mock客户端校验已有Collection，失败时禁止任何写入。"""
    monkeypatch.setattr(settings, "RAG_INDEX_ENABLED", True)
    monkeypatch.setattr(settings, "EMBEDDING_DIMENSION", 3)
    user = User(
        username="collection-check-user",
        email="collection-check@example.com",
        hashed_password="hash",
    )
    db_session.add(user)
    db_session.flush()
    document = _create_parsed_document(db_session, user.id)
    client = Mock(spec=QdrantClient)
    client.upsert.return_value = models.UpdateResult(status=models.UpdateStatus.COMPLETED)
    client.get_collection.return_value = SimpleNamespace(
        config=SimpleNamespace(params=SimpleNamespace(vectors=vectors))
    )
    store = QdrantVectorStore(client=client)

    if expected_error is None:
        indexed = index_document(
            db_session, user.id, document.id, vector_store=store, embeddings=FakeEmbeddings()
        )
        assert indexed.index_status == "indexed"
        client.upsert.assert_called_once()
        assert client.upsert.call_args.kwargs["wait"] is True
    else:
        with pytest.raises(VectorIndexError, match=expected_error):
            index_document(
                db_session, user.id, document.id, vector_store=store, embeddings=FakeEmbeddings()
            )
        client.upsert.assert_not_called()
        db_session.refresh(document)
        assert document.index_status == "failed"
        assert "redacted" in document.index_error

    client.get_collection.assert_called_once_with(store.collection_name())
    client.create_collection.assert_not_called()
    client.update_collection.assert_not_called()
    client.delete_collection.assert_not_called()
    client.delete.assert_not_called()


def test_index_marks_document_only_after_qdrant_write(db_session, monkeypatch) -> None:
    """Qdrant写入成功后才更新indexed和Chunk映射。"""
    monkeypatch.setattr(settings, "RAG_INDEX_ENABLED", True)
    user = User(
        username="vector-user",
        email="vector@example.com",
        hashed_password="hash",
    )
    db_session.add(user)
    db_session.flush()
    document = _create_parsed_document(db_session, user.id)
    store = FakeVectorStore()

    indexed = index_document(
        db_session,
        user.id,
        document.id,
        vector_store=store,
        embeddings=FakeEmbeddings(),
    )

    assert indexed.index_status == "indexed"
    assert indexed.index_collection == "fake_collection"
    chunk = db_session.scalar(select(DocumentChunk).where(DocumentChunk.document_id == document.id))
    assert chunk is not None
    assert chunk.vector_id is not None
    assert len(chunk.vector_id) == 36
    assert store.upserted[0].payload["owner_id"] == user.id
    assert store.upserted[0].payload["knowledge_base_id"] == document.knowledge_base_id
    assert store.upserted[0].payload["chunk_id"] == chunk.id


def test_index_dimension_mismatch_marks_failure(db_session, monkeypatch) -> None:
    """维度不匹配必须失败，不能自动重建Collection。"""
    monkeypatch.setattr(settings, "RAG_INDEX_ENABLED", True)
    user = User(
        username="dimension-user",
        email="dimension@example.com",
        hashed_password="hash",
    )
    db_session.add(user)
    db_session.flush()
    document = _create_parsed_document(db_session, user.id)

    class MismatchStore(FakeVectorStore):
        def ensure_collection(self, dimension: int) -> str:
            raise QdrantError("Qdrant Collection维度不匹配")

    with pytest.raises(VectorIndexError, match="维度不匹配"):
        index_document(
            db_session,
            user.id,
            document.id,
            vector_store=MismatchStore(),
            embeddings=FakeEmbeddings(),
        )

    db_session.refresh(document)
    failed = db_session.get(KnowledgeDocument, document.id)
    assert failed is not None
    assert failed.index_status == "failed"
    assert "redacted" in failed.index_error


def test_dimension_mismatch_does_not_delete_existing_points(db_session, monkeypatch) -> None:
    """Collection维度不匹配时不得删除既有Point。"""
    monkeypatch.setattr(settings, "RAG_INDEX_ENABLED", True)
    user = User(
        username="dimension-safe-user",
        email="dimension-safe@example.com",
        hashed_password="hash",
    )
    db_session.add(user)
    db_session.flush()
    document = _create_parsed_document(db_session, user.id)

    class MismatchStore(FakeVectorStore):
        def ensure_collection(self, dimension: int) -> str:
            raise QdrantError("Qdrant Collection维度不匹配")

    store = MismatchStore()
    with pytest.raises(VectorIndexError, match="维度不匹配"):
        index_document(
            db_session,
            user.id,
            document.id,
            vector_store=store,
            embeddings=FakeEmbeddings(),
        )

    assert store.deleted == []


def test_index_write_failure_preserves_points_and_marks_failure(db_session, monkeypatch) -> None:
    """Unconfirmed vectors remain unpublished; the build never deletes any points."""
    monkeypatch.setattr(settings, "RAG_INDEX_ENABLED", True)
    user = User(
        username="write-failure-user",
        email="write-failure@example.com",
        hashed_password="hash",
    )
    db_session.add(user)
    db_session.flush()
    document = _create_parsed_document(db_session, user.id)
    store = FailingVectorStore()

    with pytest.raises(VectorIndexError, match="向量写入失败"):
        index_document(
            db_session,
            user.id,
            document.id,
            vector_store=store,
            embeddings=FakeEmbeddings(),
        )

    db_session.refresh(document)
    failed = db_session.get(KnowledgeDocument, document.id)
    assert failed is not None
    assert failed.index_status == "failed"
    assert store.deleted == []
    assert failed.active_index_generation is None


def test_reindex_uses_isolated_point_ids(db_session, monkeypatch) -> None:
    """Each rebuild gets new point IDs and keeps previous vectors untouched."""
    monkeypatch.setattr(settings, "RAG_INDEX_ENABLED", True)
    user = User(
        username="repeat-index-user",
        email="repeat-index@example.com",
        hashed_password="hash",
    )
    db_session.add(user)
    db_session.flush()
    document = _create_parsed_document(db_session, user.id)
    store = FakeVectorStore()

    index_document(
        db_session,
        user.id,
        document.id,
        vector_store=store,
        embeddings=FakeEmbeddings(),
    )
    first_point_id = str(store.upserted[0].id)
    store.upserted.clear()
    index_document(
        db_session,
        user.id,
        document.id,
        vector_store=store,
        embeddings=FakeEmbeddings(),
    )

    assert str(store.upserted[0].id) != first_point_id
    assert store.deleted == []


def test_vector_search_passes_owner_and_knowledge_base_filters(db_session, monkeypatch) -> None:
    """检索必须把用户和知识库过滤条件传入Qdrant。"""
    monkeypatch.setattr(settings, "RAG_INDEX_ENABLED", True)
    monkeypatch.setattr(settings, "EMBEDDING_PROVIDER", "fake")
    monkeypatch.setattr(settings, "EMBEDDING_MODEL", "fake-embedding")
    monkeypatch.setattr(settings, "EMBEDDING_DIMENSION", 3)
    user = User(
        username="search-user",
        email="search@example.com",
        hashed_password="hash",
    )
    db_session.add(user)
    db_session.flush()
    document = _create_parsed_document(db_session, user.id)
    store = FakeVectorStore()
    index_document(
        db_session,
        user.id,
        document.id,
        vector_store=store,
        embeddings=FakeEmbeddings(),
    )

    hits = retrieve_vector_chunks(
        db_session,
        user.id,
        document.knowledge_base_id,
        "报销标准",
        vector_store=store,
        embeddings=FakeEmbeddings(),
    )

    assert len(hits) == 1
    assert hits[0].chunk.id == store.upserted[0].payload["chunk_id"]
    assert store.search_args[2:] == (user.id, document.knowledge_base_id, settings.RAG_VECTOR_TOP_K)


def test_delete_vectors_uses_stable_chunk_ids(db_session, monkeypatch) -> None:
    """删除文档时先使用MySQL保存的Point ID清理向量。"""
    user = User(
        username="delete-user",
        email="delete@example.com",
        hashed_password="hash",
    )
    db_session.add(user)
    db_session.flush()
    document = _create_parsed_document(db_session, user.id)
    chunk = db_session.scalar(select(DocumentChunk).where(DocumentChunk.document_id == document.id))
    assert chunk is not None
    chunk.vector_id = "chunk-previous"
    document.index_collection = "old_collection"
    db_session.commit()
    store = FakeVectorStore()

    delete_document_vectors(document, [chunk], vector_store=store)

    assert store.deleted == [("old_collection", ["chunk-previous"])]
