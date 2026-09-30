"""Atomic build ownership and conditional failure finalization used by indexing.

Each operation owns a short, independent engine transaction. True is returned
only after commit succeeds; False means no matching row. Exceptions propagate
and must never be treated as permission to call external services. No caller
Session is accepted or committed. Callers must commit prerequisite documents
first and must not hold a write lock on the target while invoking these helpers.
Use a fresh generation per build attempt; abandoned markers need manual recovery.
Commit exceptions can have an unknown outcome and propagate without reinterpretation.
"""

from uuid import UUID

from sqlalchemy import Engine, update

from app.core.database import engine
from app.features.rag.models import KnowledgeDocument


def acquire_index_build(
    document_id: int,
    owner_id: int,
    generation: str,
    *,
    database_engine: Engine = engine,
) -> bool:
    """Claim an unowned document build and commit before granting permission."""
    return _update_build_marker(
        document_id, owner_id, generation, acquire=True, database_engine=database_engine
    )


def release_index_build(
    document_id: int,
    owner_id: int,
    generation: str,
    *,
    database_engine: Engine = engine,
) -> bool:
    """Clear only this task's marker; never clear a newer task's generation."""
    return _update_build_marker(
        document_id, owner_id, generation, acquire=False, database_engine=database_engine
    )


def _update_build_marker(
    document_id: int,
    owner_id: int,
    generation: str,
    *,
    acquire: bool,
    database_engine: Engine,
) -> bool:
    """Execute compare-and-set in a transaction independent of caller sessions."""
    normalized_generation = _normalize_build_identity(
        document_id, owner_id, generation, database_engine
    )
    documents = KnowledgeDocument.__table__
    marker = documents.c.building_index_generation
    condition = marker.is_(None) if acquire else marker == normalized_generation
    statement = (
        update(documents)
        .where(documents.c.id == document_id, documents.c.owner_id == owner_id, condition)
        .values(
            building_index_generation=normalized_generation if acquire else None,
            updated_at=documents.c.updated_at,
        )
    )
    with database_engine.begin() as connection:
        affected = connection.execute(statement).rowcount
        if affected not in (0, 1):
            raise RuntimeError("Unexpected build ownership update row count")
    return affected == 1


def fail_index_build(
    document_id: int,
    owner_id: int,
    generation: str,
    error: Exception,
    *,
    database_engine: Engine = engine,
) -> bool:
    """Atomically record failure and release only this build, preserving its active index.

    True means one row matched and commit succeeded; False means no matching build.
    Exceptions propagate, including an unknown commit outcome. Exception bodies,
    including provider errors, are never persisted or logged by this helper.
    """
    normalized_generation = _normalize_build_identity(
        document_id, owner_id, generation, database_engine
    )
    if not isinstance(error, Exception):
        raise TypeError("error must be an Exception")
    category = "Index build failed"
    for error_type, summary in (
        (TimeoutError, "Index build timed out"),
        (ConnectionError, "Index build connection failed"),
        (ValueError, "Index build validation failed"),
    ):
        if isinstance(error, error_type):
            category = summary
            break
    documents = KnowledgeDocument.__table__
    summary = f"{category}; error details redacted."
    statement = (
        update(documents)
        .where(
            documents.c.id == document_id,
            documents.c.owner_id == owner_id,
            documents.c.building_index_generation == normalized_generation,
        )
        .values(
            index_status="failed",
            index_error=summary[:documents.c.index_error.type.length],
            building_index_generation=None,
            updated_at=documents.c.updated_at,
        )
    )
    with database_engine.begin() as connection:
        affected = connection.execute(statement).rowcount
        if affected not in (0, 1):
            raise RuntimeError("Unexpected build failure update row count")
    return affected == 1


def _normalize_build_identity(
    document_id: int, owner_id: int, generation: str, database_engine: Engine
) -> str:
    """Validate helper inputs without accessing caller sessions or the database."""
    if not isinstance(database_engine, Engine):
        raise TypeError("An Engine is required, not a caller Session or Connection")
    if any(
        type(identifier) is not int or identifier <= 0 for identifier in (document_id, owner_id)
    ):
        raise ValueError("Document and owner IDs must be positive integers")
    if not isinstance(generation, str):
        raise ValueError("generation must be a valid UUID string")
    try:
        return str(UUID(generation))
    except ValueError as exc:
        raise ValueError("generation must be a valid UUID string") from exc
