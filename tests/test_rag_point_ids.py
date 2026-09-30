"""Pure local tests for legacy and versioned Qdrant point identities."""

from uuid import NAMESPACE_URL, UUID, uuid5

import pytest

from app.features.rag.indexing import point_id_for_chunk, point_id_for_chunk_generation

GENERATION = "12345678-1234-4234-8234-123456789abc"
OTHER_GENERATION = "12345678-1234-4234-8234-123456789abd"


def test_versioned_point_id_is_stable_uuid5() -> None:
    point_id = point_id_for_chunk_generation(1, 2, GENERATION)

    assert point_id == point_id_for_chunk_generation(1, 2, GENERATION)
    assert str(UUID(point_id)) == point_id
    assert UUID(point_id).version == 5


@pytest.mark.parametrize(
    ("document_id", "chunk_id", "generation"),
    [(1, 2, OTHER_GENERATION), (1, 3, GENERATION), (2, 2, GENERATION)],
    ids=["generation-isolation", "chunk-isolation", "document-isolation"],
)
def test_versioned_point_id_isolates_inputs(document_id, chunk_id, generation) -> None:
    assert point_id_for_chunk_generation(1, 2, GENERATION) != point_id_for_chunk_generation(
        document_id, chunk_id, generation
    )


def test_identity_encoding_is_unambiguous() -> None:
    assert point_id_for_chunk_generation(1, 23, GENERATION) != point_id_for_chunk_generation(
        12, 3, GENERATION
    )


@pytest.mark.parametrize(
    "generation", [GENERATION.upper(), GENERATION.replace("-", ""), "{" + GENERATION + "}"]
)
def test_equivalent_uuid_strings_share_identity(generation) -> None:
    assert point_id_for_chunk_generation(1, 2, generation) == point_id_for_chunk_generation(
        1, 2, GENERATION
    )


@pytest.mark.parametrize(
    "generation", ["", "not-a-uuid", "1234", GENERATION[:-1], "g" * 32, None, 123]
)
def test_invalid_generation_is_rejected(generation) -> None:
    with pytest.raises(ValueError, match="generation must be a valid UUID string"):
        point_id_for_chunk_generation(1, 2, generation)


@pytest.mark.parametrize("chunk_id", [1, 2, 123456789])
def test_legacy_point_id_is_unchanged(chunk_id) -> None:
    expected = str(uuid5(NAMESPACE_URL, f"financial-office-platform:document-chunk:{chunk_id}"))

    assert point_id_for_chunk(chunk_id) == expected
    assert point_id_for_chunk(chunk_id) == point_id_for_chunk(chunk_id)
    assert point_id_for_chunk_generation(1, chunk_id, GENERATION) != expected
