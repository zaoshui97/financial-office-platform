"""将不同格式的解析结果转换为稳定、可追溯的知识库文本。"""

import hashlib
import re
import unicodedata
from dataclasses import replace

from app.integrations.document_parser import ParsedDocument, ParsedSegment

NORMALIZATION_VERSION = "text-v1"

_HORIZONTAL_SPACE = re.compile(r"[^\S\n]+")
_EXCESS_BLANK_LINES = re.compile(r"\n{3,}")


def normalize_text(text: str) -> str:
    """统一 Unicode、空白和换行；不改写标点、数字或大小写。"""
    text = unicodedata.normalize("NFC", text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\ufeff", "").replace("\u200b", "")
    text = text.replace("\u00a0", " ").replace("\u3000", " ")
    lines = [_HORIZONTAL_SPACE.sub(" ", line).strip() for line in text.split("\n")]
    return _EXCESS_BLANK_LINES.sub("\n\n", "\n".join(lines)).strip()


def normalize_parsed_document(document: ParsedDocument) -> ParsedDocument:
    """以来源片段为准重建全文，保留页码、段落和表格等定位信息。"""
    segments: list[ParsedSegment] = []
    for segment in document.segments:
        normalized = normalize_text(segment.text)
        if normalized:
            segments.append(replace(segment, text=normalized))

    # 兼容仅提供全文的解析器；正常上传路径均提供结构化片段。
    if not segments:
        normalized = normalize_text(document.text)
        if normalized:
            segments = [ParsedSegment(text=normalized)]

    return ParsedDocument(
        text="\n".join(segment.text for segment in segments),
        page_count=document.page_count,
        segments=segments,
    )


def normalized_content_hash(text: str) -> str:
    """同一规范化正文得到相同 SHA-256，供核对和后续去重使用。"""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()
