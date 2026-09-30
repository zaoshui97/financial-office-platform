"""将结构化解析结果切分为可持久化的文档片段。"""

import hashlib
from dataclasses import dataclass
from typing import Any

from app.core.config import settings
from app.integrations.document_parser import ParsedDocument, ParsedSegment


@dataclass(frozen=True)
class Chunk:
    """一个带来源追踪信息的文档片段。"""

    chunk_index: int
    chunk_text: str
    page_number: int | None
    metadata: dict[str, Any]
    content_hash: str


def _segment_metadata(segments: list[ParsedSegment]) -> dict[str, Any]:
    """合并片段来源信息，确保结果可以直接写入JSON字段。"""
    page_numbers = sorted(
        {segment.page_number for segment in segments if segment.page_number is not None}
    )
    paragraph_indexes = sorted(
        {
            segment.paragraph_index
            for segment in segments
            if segment.paragraph_index is not None
        }
    )
    table_indexes = sorted(
        {
            segment.metadata["table_index"]
            for segment in segments
            if "table_index" in segment.metadata
        }
    )
    metadata: dict[str, Any] = {
        "source_type": segments[0].metadata.get("source_type"),
        "page_numbers": page_numbers,
        "paragraph_indexes": paragraph_indexes,
        "table_indexes": table_indexes,
    }
    headings = [segment.heading for segment in segments if segment.heading]
    if headings:
        metadata["heading"] = headings[0]
    heading_paths = [
        segment.metadata["heading_path"]
        for segment in segments
        if segment.metadata.get("heading_path")
    ]
    if heading_paths:
        metadata["heading_path"] = heading_paths[0]
    return metadata


def _intersecting_segments(
    segments_with_ranges: list[tuple[int, int, ParsedSegment]],
    start: int,
    end: int,
) -> list[ParsedSegment]:
    """返回与字符窗口相交的结构化片段。"""
    return [
        segment
        for segment_start, segment_end, segment in segments_with_ranges
        if segment_start < end and segment_end > start
    ]


def chunk_document(
    document: ParsedDocument,
    chunk_size: int | None = None,
    overlap: int | None = None,
) -> list[Chunk]:
    """按现有聊天RAG的字符窗口规则切分文档并保留来源元数据。"""
    effective_size = chunk_size if chunk_size is not None else settings.CHAT_RAG_CHUNK_SIZE
    effective_overlap = overlap if overlap is not None else settings.CHAT_RAG_CHUNK_OVERLAP
    if effective_size <= 0:
        raise ValueError("chunk_size必须大于0")
    if effective_overlap < 0 or effective_overlap >= effective_size:
        raise ValueError("overlap必须大于等于0且小于chunk_size")

    segments = [segment for segment in document.segments if segment.text.strip()]
    if not segments:
        return []

    parts: list[str] = []
    segment_ranges: list[tuple[int, int, ParsedSegment]] = []
    cursor = 0
    for segment in segments:
        text = segment.text.strip()
        if parts:
            parts.append("\n\n")
            cursor += 2
        start = cursor
        parts.append(text)
        cursor += len(text)
        segment_ranges.append((start, cursor, segment))

    full_text = "".join(parts)
    chunks: list[Chunk] = []
    start = 0
    while start < len(full_text):
        end = min(start + effective_size, len(full_text))
        chunk_text = full_text[start:end].strip()
        if chunk_text:
            source_segments = _intersecting_segments(segment_ranges, start, end)
            page_numbers = sorted(
                {
                    segment.page_number
                    for segment in source_segments
                    if segment.page_number is not None
                }
            )
            metadata = _segment_metadata(source_segments or segments[:1])
            chunks.append(
                Chunk(
                    chunk_index=len(chunks),
                    chunk_text=chunk_text,
                    page_number=page_numbers[0] if len(page_numbers) == 1 else None,
                    metadata=metadata,
                    content_hash=hashlib.sha256(chunk_text.encode("utf-8")).hexdigest(),
                )
            )
        if end >= len(full_text):
            break
        start = end - effective_overlap
    return chunks
