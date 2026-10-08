"""知识库正文归一化与接口状态测试。"""

from sqlalchemy import select

from app.core.config import settings
from app.features.rag.models import DocumentChunk
from app.features.rag.normalization import (
    NORMALIZATION_VERSION,
    normalize_parsed_document,
    normalize_text,
    normalized_content_hash,
)
from app.integrations.document_parser import ParsedDocument, ParsedSegment
from tests.test_rag import _authorize, _create_knowledge_base


def test_normalize_text_is_idempotent_and_preserves_semantics() -> None:
    raw = "\ufeffＡ  B\u00a0\r\n\r\n\r\n价款  ①\u200b\u3000\rCafé"
    # NFC 不把全角字母、带圈数字和标点折叠成其它字符。
    expected = "Ａ B\n\n价款 ①\nCafé"
    assert normalize_text(raw) == expected
    assert normalize_text(expected) == expected


def test_normalize_parsed_document_keeps_provenance_and_stable_hash() -> None:
    segments = [
        ParsedSegment(
            text="制度\u3000规定  \r\n第一条",
            page_number=2,
            paragraph_index=3,
            heading="制度",
            metadata={"source_type": "pdf", "extraction_method": "ocr"},
        ),
        ParsedSegment(
            text="  审批\u00a0流程  ",
            page_number=3,
            paragraph_index=4,
            metadata={"source_type": "pdf"},
        ),
    ]
    parsed = ParsedDocument(text="not authoritative", page_count=3, segments=segments)

    result = normalize_parsed_document(parsed)
    repeated = normalize_parsed_document(result)

    assert result.text == "制度 规定\n第一条\n审批 流程"
    assert repeated == result
    assert result.segments[0].page_number == 2
    assert result.segments[0].paragraph_index == 3
    assert result.segments[0].metadata["extraction_method"] == "ocr"
    assert parsed.segments[0].text == "制度\u3000规定  \r\n第一条"
    assert normalized_content_hash(result.text) == normalized_content_hash(repeated.text)


def test_upload_normalization_status_and_legacy_distinction(
    client, db_session, monkeypatch, tmp_path
) -> None:
    headers = _authorize(client, username="normalization_owner")
    kb_id = _create_knowledge_base(client, headers)
    monkeypatch.setattr(settings, "STORAGE_DIR", tmp_path)
    raw = "制度\u3000规定  \r\n\r\n审批\u00a0流程"
    response = client.post(
        f"/api/v1/rag/knowledge-bases/{kb_id}/documents",
        headers=headers,
        files={"file": ("rules.txt", raw.encode("utf-8"), "text/plain")},
    )
    assert response.status_code == 201
    document_id = response.json()["id"]

    content = client.get(f"/api/v1/rag/documents/{document_id}/content", headers=headers)
    state = client.get(f"/api/v1/rag/documents/{document_id}/normalization", headers=headers)
    assert content.json()["parsed_text"] == "制度 规定\n审批 流程"
    assert state.status_code == 200
    assert state.json()["status"] == "normalized"
    assert state.json()["normalization_version"] == NORMALIZATION_VERSION
    assert state.json()["content_hash"] == normalized_content_hash(content.json()["parsed_text"])
    assert state.json()["chunk_count"] == 1

    other_headers = _authorize(client, username="normalization_other")
    assert client.get(
        f"/api/v1/rag/documents/{document_id}/normalization", headers=other_headers
    ).status_code == 404

    chunk = db_session.scalar(select(DocumentChunk).where(DocumentChunk.document_id == document_id))
    assert chunk is not None
    assert chunk.chunk_metadata["normalization_version"] == NORMALIZATION_VERSION
    chunk.chunk_metadata = {"source_type": "txt"}
    db_session.commit()
    legacy = client.get(f"/api/v1/rag/documents/{document_id}/normalization", headers=headers)
    assert legacy.json()["status"] == "legacy_or_unavailable"
    assert legacy.json()["content_hash"] is None
