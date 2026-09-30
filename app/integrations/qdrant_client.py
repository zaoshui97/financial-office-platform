"""Qdrant适配器：统一Collection、租户过滤、写入和检索。"""

import re
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from qdrant_client import QdrantClient
from qdrant_client.http import models

from app.core.config import settings


class QdrantError(RuntimeError):
    """Qdrant不可用、配置不匹配或操作失败。"""


@dataclass(frozen=True)
class VectorHit:
    """Qdrant返回的最小命中结构。"""

    point_id: str
    score: float
    payload: dict[str, Any]


@dataclass(frozen=True)
class DocumentIndexSnapshot:
    """Caller-owned active version and exact legacy MySQL point mappings."""

    document_id: int
    active_index_generation: str | None
    legacy_point_ids: tuple[str, ...] = ()


def build_active_index_filter(
    owner_id: int,
    knowledge_base_id: int,
    snapshots: Sequence[DocumentIndexSnapshot],
) -> models.Filter:
    """Build a fail-closed filter without I/O; future payloads use `generation`.

    Callers must provide authorized, active-only snapshots. Building versions
    must never be supplied as active. Legacy IDs must come from saved MySQL mappings.
    UUID generations are normalized, matching the versioned point ID convention.
    """
    if not snapshots:
        raise ValueError("Active index snapshots must not be empty")
    for identifier in (owner_id, knowledge_base_id):
        if type(identifier) is not int or identifier <= 0:
            raise ValueError("Owner and knowledge base IDs must be positive integers")

    document_conditions: list[models.Filter] = []
    seen_documents: set[int] = set()
    for snapshot in snapshots:
        document_id = snapshot.document_id
        if type(document_id) is not int or document_id <= 0 or document_id in seen_documents:
            raise ValueError("Document IDs must be positive and unique in the snapshot")
        seen_documents.add(document_id)
        version_condition: models.FieldCondition | models.HasIdCondition
        if snapshot.active_index_generation is not None:
            generation = _canonical_uuid(snapshot.active_index_generation)
            version_condition = models.FieldCondition(
                key="generation", match=models.MatchValue(value=generation)
            )
        else:
            if not snapshot.legacy_point_ids:
                raise ValueError("Legacy documents require exact saved point IDs")
            point_ids = [_canonical_uuid(point_id) for point_id in snapshot.legacy_point_ids]
            version_condition = models.HasIdCondition(has_id=point_ids)
        document_conditions.append(
            models.Filter(
                must=[
                    models.FieldCondition(
                        key="document_id", match=models.MatchValue(value=document_id)
                    ),
                    version_condition,
                ]
            )
        )
    return models.Filter(
        must=[
            models.FieldCondition(key="owner_id", match=models.MatchValue(value=owner_id)),
            models.FieldCondition(
                key="knowledge_base_id", match=models.MatchValue(value=knowledge_base_id)
            ),
            models.Filter(should=document_conditions),
        ]
    )


def _canonical_uuid(value: str) -> str:
    """Reject malformed generations or legacy UUID point mappings before querying."""
    if not isinstance(value, str):
        raise ValueError("Generation and legacy point IDs must be valid UUID strings")
    try:
        return str(UUID(value))
    except ValueError as exc:
        raise ValueError("Generation and legacy point IDs must be valid UUID strings") from exc


class QdrantVectorStore:
    """Qdrant客户端封装，客户端和网络操作均按需执行。"""

    def __init__(self, client: QdrantClient | None = None) -> None:
        self._client = client

    @property
    def client(self) -> QdrantClient:
        """创建并复用Qdrant客户端，不在导入时连接服务。"""
        if self._client is None:
            self._client = QdrantClient(
                url=settings.QDRANT_URL,
                api_key=settings.QDRANT_API_KEY or None,
                timeout=settings.QDRANT_TIMEOUT_SECONDS,
            )
        return self._client

    @staticmethod
    def collection_name() -> str:
        """按基础名称、模型、版本和维度隔离Collection。"""
        model = re.sub(r"[^a-zA-Z0-9]+", "_", settings.EMBEDDING_MODEL).strip("_")
        version = re.sub(r"[^a-zA-Z0-9]+", "_", settings.EMBEDDING_VERSION).strip("_")
        return (
            f"{settings.QDRANT_COLLECTION}_{model}_{version}_"
            f"{settings.EMBEDDING_DIMENSION}"
        )

    def ensure_collection(self, dimension: int) -> str:
        """创建缺失Collection，已有Collection必须匹配维度和Cosine距离。"""
        name = self.collection_name()
        try:
            collection = self.client.get_collection(name)
        except Exception as exc:
            if not self._is_not_found(exc):
                raise QdrantError("Qdrant读取Collection失败") from exc
            try:
                self.client.create_collection(
                    collection_name=name,
                    vectors_config=models.VectorParams(
                        size=dimension,
                        distance=models.Distance.COSINE,
                    ),
                )
            except Exception as create_exc:
                raise QdrantError("Qdrant创建Collection失败") from create_exc
            return name

        vectors = self._collection_vectors(collection)
        existing_dimension = vectors.size
        if existing_dimension != dimension:
            raise QdrantError(
                f"Qdrant Collection维度不匹配: expected={dimension}, actual={existing_dimension}"
            )
        if vectors.distance != models.Distance.COSINE:
            raise QdrantError(
                "Qdrant Collection距离算法不匹配: "
                f"expected=Cosine, actual={vectors.distance.value}"
            )
        return name

    def upsert(
        self,
        collection_name: str,
        points: list[models.PointStruct],
    ) -> None:
        """仅在SDK明确确认完成时返回；其他结果可能已部分或全部写入。"""
        try:
            result = self.client.upsert(collection_name, points=points, wait=True)
            completed = (
                isinstance(result, models.UpdateResult)
                and getattr(result, "status", None) is models.UpdateStatus.COMPLETED
            )
        except Exception as exc:
            raise QdrantError("Qdrant向量写入未确认完成，实际写入结果可能不明") from exc
        if not completed:
            raise QdrantError("Qdrant向量写入未确认完成，实际写入结果可能不明")

    def delete_points(self, collection_name: str, point_ids: list[str]) -> None:
        """删除指定Point，空列表不发起远程请求。"""
        if not point_ids:
            return
        try:
            self.client.delete(collection_name, points_selector=point_ids, wait=True)
        except Exception as exc:
            raise QdrantError("Qdrant向量删除失败") from exc

    def search(
        self,
        collection_name: str,
        vector: list[float],
        owner_id: int,
        knowledge_base_id: int,
        limit: int,
        *,
        query_filter: models.Filter,
    ) -> list[VectorHit]:
        """Apply the required active snapshot filter inside the tenant boundary."""
        query_filter = models.Filter(
            must=[
                models.FieldCondition(
                    key="owner_id",
                    match=models.MatchValue(value=owner_id),
                ),
                models.FieldCondition(
                    key="knowledge_base_id",
                    match=models.MatchValue(value=knowledge_base_id),
                ),
                query_filter,
            ]
        )
        try:
            response = self.client.query_points(
                collection_name=collection_name,
                query=vector,
                query_filter=query_filter,
                limit=limit,
                with_payload=True,
            )
        except Exception as exc:
            raise QdrantError("Qdrant向量检索失败") from exc
        return [
            VectorHit(
                point_id=str(point.id),
                score=float(point.score),
                payload=dict(point.payload or {}),
            )
            for point in response.points
        ]

    @staticmethod
    def _is_not_found(error: Exception) -> bool:
        """兼容Qdrant不同版本的404异常文本。"""
        return "404" in str(error) or "not found" in str(error).lower()

    @staticmethod
    def _collection_vectors(collection: Any) -> models.VectorParams:
        """仅支持SDK返回的单个未命名稠密向量配置。"""
        config = getattr(collection, "config", None)
        params = getattr(config, "params", None)
        vectors = getattr(params, "vectors", None)
        if not isinstance(vectors, models.VectorParams) or vectors.multivector_config is not None:
            raise QdrantError(
                "Qdrant Collection向量配置不支持: 仅支持单个未命名稠密向量"
            )
        return vectors


qdrant_store = QdrantVectorStore()
