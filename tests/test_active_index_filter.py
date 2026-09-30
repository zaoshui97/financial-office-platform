"""Mock-only filter construction with the SDK's local predicate evaluator."""

from unittest.mock import Mock

import pytest
from qdrant_client.http import models
from qdrant_client.local.payload_filters import check_filter

from app.integrations.qdrant_client import DocumentIndexSnapshot, build_active_index_filter

ACTIVE_A = "12345678-1234-4234-8234-123456789abc"
ACTIVE_B = "12345678-1234-4234-8234-123456789abd"
BUILDING = "12345678-1234-4234-8234-123456789abe"
LEGACY_POINT = "12345678-1234-5234-8234-123456789abc"
OTHER_POINT = "12345678-1234-5234-8234-123456789abd"


@pytest.fixture(autouse=True)
def no_qdrant_client(monkeypatch):
    client = Mock(side_effect=AssertionError("Filter construction must not create a client"))
    monkeypatch.setattr("app.integrations.qdrant_client.QdrantClient", client)
    yield
    client.assert_not_called()


@pytest.fixture
def active_filter():
    return build_active_index_filter(
        3,
        10,
        [
            DocumentIndexSnapshot(1, ACTIVE_A),
            DocumentIndexSnapshot(2, ACTIVE_B),
            DocumentIndexSnapshot(4, None, (LEGACY_POINT,)),
        ],
    )


@pytest.mark.parametrize(
    ("owner_id", "knowledge_base_id", "document_id", "generation", "point_id", "expected"),
    [
        (3, 10, 1, ACTIVE_A, OTHER_POINT, True),
        (3, 10, 2, ACTIVE_B, OTHER_POINT, True),
        (9, 10, 1, ACTIVE_A, OTHER_POINT, False),
        (3, 99, 1, ACTIVE_A, OTHER_POINT, False),
        (3, 10, 1, ACTIVE_B, OTHER_POINT, False),
        (3, 10, 2, ACTIVE_A, OTHER_POINT, False),
        (3, 10, 1, BUILDING, OTHER_POINT, False),
        (3, 10, 2, BUILDING, OTHER_POINT, False),
        (3, 10, 1, None, OTHER_POINT, False),
        (3, 10, 99, ACTIVE_A, OTHER_POINT, False),
        (3, 10, 4, None, LEGACY_POINT, True),
        (3, 10, 4, None, OTHER_POINT, False),
        (3, 10, 4, BUILDING, OTHER_POINT, False),
        (3, 10, 99, None, LEGACY_POINT, False),
        (9, 10, 4, None, LEGACY_POINT, False),
        (3, 99, 4, None, LEGACY_POINT, False),
    ],
)
def test_filter_semantics(
    active_filter, owner_id, knowledge_base_id, document_id, generation, point_id, expected
):
    payload = {
        "owner_id": owner_id,
        "knowledge_base_id": knowledge_base_id,
        "document_id": document_id,
    }
    if generation is not None:
        payload["generation"] = generation
    restored_filter = models.Filter.model_validate_json(active_filter.model_dump_json())
    assert check_filter(restored_filter, payload, point_id, {}) is expected


@pytest.mark.parametrize(
    "snapshots",
    [
        [],
        [DocumentIndexSnapshot(1, None)],
        [DocumentIndexSnapshot(1, None, ("invalid",))],
        [DocumentIndexSnapshot(1, None, (LEGACY_POINT, ""))],
        [DocumentIndexSnapshot(1, "invalid")],
        [DocumentIndexSnapshot(1, "")],
        [DocumentIndexSnapshot(1, ACTIVE_A), DocumentIndexSnapshot(2, None)],
        [DocumentIndexSnapshot(1, ACTIVE_A), DocumentIndexSnapshot(1, BUILDING)],
    ],
)
def test_invalid_snapshots_fail_closed(snapshots):
    with pytest.raises(ValueError):
        build_active_index_filter(3, 10, snapshots)


def test_multiple_legacy_points_and_uuid_normalization():
    query_filter = build_active_index_filter(
        3,
        10,
        [
            DocumentIndexSnapshot(1, ACTIVE_A.upper(), (LEGACY_POINT,)),
            DocumentIndexSnapshot(4, None, (LEGACY_POINT, OTHER_POINT)),
        ],
    )
    for point_id in (LEGACY_POINT, OTHER_POINT):
        assert check_filter(
            query_filter, {"owner_id": 3, "knowledge_base_id": 10, "document_id": 4}, point_id, {}
        )
    payload = {
        "owner_id": 3, "knowledge_base_id": 10, "document_id": 1, "generation": ACTIVE_A
    }
    assert check_filter(query_filter, payload, OTHER_POINT, {})
    payload["generation"] = BUILDING
    assert not check_filter(query_filter, payload, LEGACY_POINT, {})
