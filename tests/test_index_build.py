"""Real conditional updates on temporary SQLite files, not the application DB."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from threading import Barrier
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool

from app.core.database import Base
from app.features.auth.models import User
from app.features.rag.index_build import (
    acquire_index_build,
    fail_index_build,
    release_index_build,
)
from app.features.rag.models import DocumentChunk, KnowledgeBase, KnowledgeDocument

FIRST = "12345678-1234-4234-8234-123456789abc"
SECOND = "12345678-1234-4234-8234-123456789abd"


@pytest.fixture
def database(tmp_path):
    test_engine = create_engine(
        "sqlite:///" + (tmp_path / "build-ownership.sqlite").as_posix(),
        poolclass=NullPool,
        connect_args={"timeout": 10},
    )
    Base.metadata.create_all(test_engine)
    with Session(test_engine) as session:
        user = User(username="build-owner", email="build@example.com", hashed_password="hash")
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
            file_size=4,
            status="parsed",
            active_index_generation=FIRST,
            index_status="failed",
            index_error="preserved",
            index_collection="original",
            indexed_at=datetime(2026, 9, 17, 12, 0),
        )
        session.add(document)
        session.flush()
        chunk = DocumentChunk(
            owner_id=user.id,
            knowledge_base_id=knowledge_base.id,
            document_id=document.id,
            chunk_index=0,
            chunk_text="test",
            content_hash="a" * 64,
            chunk_metadata={},
            vector_id=FIRST,
            embedding_provider="bailian",
            embedding_model="text-embedding-v4",
            embedding_dimension=1024,
            embedding_version="v1",
        )
        session.add(chunk)
        session.commit()
        context = SimpleNamespace(
            engine=test_engine,
            document_id=document.id,
            owner_id=user.id,
            knowledge_base_id=knowledge_base.id,
        )
    try:
        yield context
    finally:
        test_engine.dispose()


def acquire(database, generation=FIRST, **overrides):
    return acquire_index_build(
        overrides.get("document_id", database.document_id),
        overrides.get("owner_id", database.owner_id),
        generation,
        database_engine=database.engine,
    )


def release(database, generation=FIRST, **overrides):
    return release_index_build(
        overrides.get("document_id", database.document_id),
        overrides.get("owner_id", database.owner_id),
        generation,
        database_engine=database.engine,
    )


def marker(database):
    with database.engine.connect() as connection:
        return connection.scalar(
            select(KnowledgeDocument.building_index_generation).where(
                KnowledgeDocument.id == database.document_id
            )
        )


def fail(database, generation=FIRST, error=None, **overrides):
    return fail_index_build(
        overrides.get("document_id", database.document_id),
        overrides.get("owner_id", database.owner_id),
        generation,
        error if error is not None else RuntimeError("private provider response"),
        database_engine=database.engine,
    )


def state(database):
    with database.engine.connect() as connection:
        document = dict(connection.execute(select(KnowledgeDocument.__table__)).mappings().one())
        chunks = [
            dict(row)
            for row in connection.execute(select(DocumentChunk.__table__)).mappings()
        ]
        return document, chunks


def test_acquire_commit_duplicate_and_normalization(database):
    assert acquire(database, FIRST.upper()) is True
    assert marker(database) == FIRST
    assert acquire(database) is False
    assert acquire(database, SECOND) is False
    assert marker(database) == FIRST


@pytest.mark.parametrize("overrides", [{"owner_id": 999}, {"document_id": 999}])
def test_wrong_identity_cannot_acquire_or_release(database, overrides):
    assert acquire(database, **overrides) is False
    assert marker(database) is None
    assert acquire(database) is True
    assert release(database, **overrides) is False
    assert marker(database) == FIRST


def test_release_and_old_task_cannot_clear_new_marker(database):
    assert acquire(database) is True
    assert release(database, SECOND) is False
    assert marker(database) == FIRST
    assert release(database, FIRST.upper()) is True
    assert marker(database) is None
    assert acquire(database, SECOND) is True
    assert release(database, FIRST) is False
    assert marker(database) == SECOND
    assert release(database, SECOND) is True
    assert release(database, SECOND) is False


@pytest.mark.parametrize("generation", ["", "invalid", "g" * 32, None, 123])
@pytest.mark.parametrize("operation", [acquire, release, fail])
def test_invalid_generation_rejected(database, generation, operation):
    with pytest.raises(ValueError, match="UUID"):
        operation(database, generation)
    assert marker(database) is None


@pytest.mark.parametrize("operation", [acquire, release, fail])
def test_commit_failure_rolls_back_and_never_returns_success(database, operation):
    if operation is not acquire:
        assert acquire(database) is True
    before = state(database)

    def fail_before_commit(connection):
        raise RuntimeError("injected commit failure")

    event.listen(database.engine, "commit", fail_before_commit)
    try:
        with pytest.raises(RuntimeError, match="commit failure"):
            operation(database)
    finally:
        event.remove(database.engine, "commit", fail_before_commit)
    assert state(database) == before
    assert operation(database) is True


def test_execution_failure_after_update_rolls_back(database):
    def fail_after_update(connection, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith("UPDATE"):
            raise RuntimeError("injected post-update failure")

    event.listen(database.engine, "after_cursor_execute", fail_after_update)
    try:
        with pytest.raises(RuntimeError, match="post-update failure"):
            acquire(database)
    finally:
        event.remove(database.engine, "after_cursor_execute", fail_after_update)
    assert marker(database) is None


def test_other_fields_and_chunk_mapping_unchanged(database):
    def snapshot():
        with database.engine.connect() as connection:
            document = dict(
                connection.execute(select(KnowledgeDocument.__table__)).mappings().one()
            )
            document.pop("building_index_generation")
            chunk = dict(connection.execute(select(DocumentChunk.__table__)).mappings().one())
            return document, chunk

    before = snapshot()
    assert acquire(database) is True
    assert snapshot() == before
    assert release(database) is True
    assert snapshot() == before


def test_does_not_commit_caller_unrelated_changes(database):
    with Session(database.engine) as caller:
        knowledge_base = caller.get(KnowledgeBase, database.knowledge_base_id)
        knowledge_base.name = "uncommitted change"
        assert acquire(database) is True
        assert release(database) is True
        assert knowledge_base in caller.dirty
        with database.engine.connect() as connection:
            assert connection.scalar(select(KnowledgeBase.name)) == "original"
        caller.rollback()


def test_two_independent_connections_have_only_one_winner(database):
    barrier = Barrier(2)

    def compete(generation):
        barrier.wait(timeout=10)
        return generation, acquire(database, generation)

    with ThreadPoolExecutor(max_workers=2) as executor:
        outcomes = list(executor.map(compete, [FIRST, SECOND]))
    winners = [generation for generation, success in outcomes if success]
    assert len(winners) == 1
    assert marker(database) == winners[0]


def test_caller_connection_is_rejected(database):
    with database.engine.begin() as connection:
        with pytest.raises(TypeError, match="Engine"):
            acquire_index_build(
                database.document_id, database.owner_id, FIRST, database_engine=connection
            )
    assert marker(database) is None


def test_failure_is_one_update_preserving_active_index(database):
    assert acquire(database) is True
    before_document, before_chunks = state(database)
    statements = []

    def record(connection, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    event.listen(database.engine, "before_cursor_execute", record)
    try:
        assert fail(database, FIRST.upper()) is True
    finally:
        event.remove(database.engine, "before_cursor_execute", record)
    assert len(statements) == 1
    assert statements[0].upper().startswith("UPDATE KNOWLEDGE_DOCUMENTS")
    document, chunks = state(database)
    expected = dict(before_document)
    expected.update(
        index_status="failed",
        index_error="Index build failed; error details redacted.",
        building_index_generation=None,
    )
    assert document == expected
    assert chunks == before_chunks
    assert acquire(database, SECOND) is True


@pytest.mark.parametrize("overrides", [{"owner_id": 999}, {"document_id": 999}])
def test_failure_wrong_identity_has_no_effect(database, overrides):
    assert acquire(database) is True
    before = state(database)
    assert fail(database, **overrides) is False
    assert state(database) == before


def test_failure_wrong_generation_and_duplicate_have_no_effect(database):
    assert acquire(database) is True
    before = state(database)
    assert fail(database, SECOND) is False
    assert state(database) == before
    assert fail(database) is True
    after = state(database)
    assert fail(database) is False
    assert state(database) == after


def test_late_failure_cannot_change_new_build(database):
    assert acquire(database) is True
    assert release(database) is True
    assert acquire(database, SECOND) is True
    with Session(database.engine) as session:
        document = session.get(KnowledgeDocument, database.document_id)
        document.index_status = "indexing"
        document.index_error = None
        session.commit()
    before = state(database)
    assert fail(database, FIRST) is False
    assert state(database) == before
    assert marker(database) == SECOND


@pytest.mark.parametrize("error_type", [RuntimeError, TimeoutError, ConnectionError, ValueError])
def test_failure_summary_redacts_body_and_respects_column_length(database, error_type):
    assert acquire(database) is True
    secret = "Bearer fake-secret https://user:password@example.com?api_key=private\n" * 100
    assert fail(database, error=error_type(secret)) is True
    document, _ = state(database)
    summary = document["index_error"]
    assert 0 < len(summary) <= KnowledgeDocument.__table__.c.index_error.type.length
    assert "redacted" in summary
    for sensitive in ["fake-secret", "password", "example.com", "api_key", "\n"]:
        assert sensitive not in summary


def test_failure_does_not_stringify_error(database):
    class UnsafeError(Exception):
        def __str__(self):
            raise AssertionError("Do not inspect exception body")

    assert acquire(database) is True
    assert fail(database, error=UnsafeError()) is True


def test_failure_execution_error_rolls_back_all_changes(database):
    assert acquire(database) is True
    before = state(database)

    def fail_after_update(connection, cursor, statement, parameters, context, executemany):
        if statement.upper().startswith("UPDATE"):
            raise RuntimeError("injected failure after update")

    event.listen(database.engine, "after_cursor_execute", fail_after_update)
    try:
        with pytest.raises(RuntimeError, match="after update"):
            fail(database)
    finally:
        event.remove(database.engine, "after_cursor_execute", fail_after_update)
    assert state(database) == before


def test_failure_unknown_commit_outcome_propagates(database, monkeypatch):
    assert acquire(database) is True
    original_commit = database.engine.dialect.do_commit
    error = RuntimeError("commit outcome unknown")

    def commit_then_fail(connection):
        original_commit(connection)
        raise error

    with monkeypatch.context() as patch:
        patch.setattr(database.engine.dialect, "do_commit", commit_then_fail)
        with pytest.raises(RuntimeError) as caught:
            fail(database)
        assert caught.value is error
    document, _ = state(database)
    assert document["index_status"] == "failed"
    assert document["building_index_generation"] is None


def test_failure_does_not_commit_caller_changes(database):
    assert acquire(database) is True
    with Session(database.engine) as caller:
        knowledge_base = caller.get(KnowledgeBase, database.knowledge_base_id)
        knowledge_base.name = "unrelated pending change"
        assert fail(database) is True
        assert knowledge_base in caller.dirty
        with database.engine.connect() as connection:
            assert connection.scalar(select(KnowledgeBase.name)) == "original"
        caller.rollback()


def test_failure_rejects_caller_connection_and_invalid_error(database):
    with database.engine.begin() as connection:
        with pytest.raises(TypeError, match="Engine"):
            fail_index_build(
                database.document_id, database.owner_id, FIRST, RuntimeError(),
                database_engine=connection,
            )
    with pytest.raises(TypeError, match="Exception"):
        fail(database, error="unsafe raw error")
    assert marker(database) is None
