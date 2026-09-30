"""Mock-only write acknowledgement checks; no Qdrant or Embedding calls."""

from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from qdrant_client import QdrantClient
from qdrant_client.http import models

from app.integrations.qdrant_client import QdrantError, QdrantVectorStore


@pytest.fixture
def context():
    client = Mock(spec=QdrantClient)
    points = [
        models.PointStruct(
            id="12345678-1234-4234-8234-123456789abc",
            vector=[0.1, 0.2, 0.3],
            payload={"text": "private document", "generation": "unchanged"},
        ),
    ]
    return SimpleNamespace(client=client, store=QdrantVectorStore(client), points=points)


def assert_only_one_write(context):
    context.client.upsert.assert_called_once_with(
        "test_collection", points=context.points, wait=True
    )
    assert len(context.client.mock_calls) == 1


def test_completed_is_success(context):
    context.client.upsert.return_value = models.UpdateResult(
        operation_id=1, status=models.UpdateStatus.COMPLETED
    )
    before = [point.model_dump() for point in context.points]
    assert context.store.upsert("test_collection", context.points) is None
    assert [point.model_dump() for point in context.points] == before
    assert_only_one_write(context)


@pytest.mark.parametrize(
    "response",
    [
        pytest.param(
            models.UpdateResult(status=models.UpdateStatus.ACKNOWLEDGED), id="acknowledged"
        ),
        pytest.param(
            models.UpdateResult(status=models.UpdateStatus.WAIT_TIMEOUT), id="wait-timeout"
        ),
        pytest.param(None, id="missing-result"),
        pytest.param(models.UpdateResult.model_construct(), id="missing-status"),
        pytest.param(models.UpdateResult.model_construct(status=None), id="null-status"),
        pytest.param(
            models.UpdateResult.model_construct(status="private unknown status"), id="unknown"
        ),
        pytest.param(
            models.UpdateResult.model_construct(status="completed"), id="unvalidated-string"
        ),
        pytest.param(
            {"status": "completed", "api_key": "fake-secret"}, id="unexpected-dict"
        ),
        pytest.param(SimpleNamespace(status=models.UpdateStatus.COMPLETED), id="wrong-type"),
        pytest.param(Mock(), id="unconfigured-mock"),
        pytest.param("private response body", id="unexpected-string"),
    ],
)
def test_unconfirmed_or_malformed_response_is_rejected(context, response):
    context.client.upsert.return_value = response
    with pytest.raises(QdrantError) as caught:
        context.store.upsert("test_collection", context.points)
    assert str(caught.value) == "Qdrant向量写入未确认完成，实际写入结果可能不明"
    assert_only_one_write(context)


@pytest.mark.parametrize("error_type", [RuntimeError, TimeoutError, ConnectionError])
def test_sdk_exception_is_wrapped_without_sensitive_message(context, error_type):
    error = error_type("api_key=fake-secret private document [0.1, 0.2, 0.3]")
    context.client.upsert.side_effect = error
    with pytest.raises(QdrantError) as caught:
        context.store.upsert("test_collection", context.points)
    assert str(caught.value) == "Qdrant向量写入未确认完成，实际写入结果可能不明"
    assert caught.value.__cause__ is error
    assert_only_one_write(context)


def test_broken_sdk_response_access_is_wrapped(context):
    class BrokenResult(models.UpdateResult):
        def __getattribute__(self, name):
            if name == "status":
                raise RuntimeError("private response body")
            return super().__getattribute__(name)

    context.client.upsert.return_value = BrokenResult(status=models.UpdateStatus.COMPLETED)
    with pytest.raises(QdrantError) as caught:
        context.store.upsert("test_collection", context.points)
    assert str(caught.value) == "Qdrant向量写入未确认完成，实际写入结果可能不明"
    assert_only_one_write(context)
