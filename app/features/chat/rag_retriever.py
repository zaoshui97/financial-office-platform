"""聊天模块的轻量RAG适配器，只读访问已解析知识库文档。"""

import re
from dataclasses import dataclass

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import get_logger
from app.features.rag.indexing import retrieve_vector_chunks
from app.features.rag.models import KnowledgeBase, KnowledgeDocument

logger = get_logger(__name__)

COMMON_TERMS = {
    "什么",
    "怎么",
    "如何",
    "是否",
    "哪些",
    "可以",
    "需要",
    "企业",
    "公司",
}


@dataclass(frozen=True)
class RetrievedContext:
    """从知识库文档中召回的文本片段。"""

    document_id: int
    filename: str
    content: str
    score: float
    chunk_id: int | None = None
    page_number: int | None = None
    page_numbers: list[int] | None = None
    retrieval_method: str = "keyword"


def _question_terms(question: str) -> set[str]:
    """提取英文词和中文二至四字片段用于轻量匹配。"""
    terms = {
        word.lower()
        for word in re.findall(r"[A-Za-z0-9_]{2,}", question)
    }
    for chinese_text in re.findall(r"[\u4e00-\u9fff]+", question):
        for size in (2, 3, 4):
            terms.update(
                chinese_text[index : index + size]
                for index in range(max(len(chinese_text) - size + 1, 0))
            )
    return {term for term in terms if term not in COMMON_TERMS}


def _split_text(text: str) -> list[str]:
    """将文档全文切为适合模型上下文的重叠片段。"""
    chunk_size = settings.CHAT_RAG_CHUNK_SIZE
    overlap = settings.CHAT_RAG_CHUNK_OVERLAP
    if overlap >= chunk_size:
        raise ValueError("CHAT_RAG_CHUNK_OVERLAP必须小于CHAT_RAG_CHUNK_SIZE")

    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        content = text[start:end].strip()
        if content:
            chunks.append(content)
        if end >= len(text):
            break
        start = end - overlap
    return chunks


def retrieve_knowledge_context(
    db: Session,
    owner_id: int,
    knowledge_base_id: int,
    question: str,
) -> list[RetrievedContext]:
    """校验权限，优先使用向量检索，失败时按配置回退关键词检索。

    若知识库不存在（owner_id 不匹配或 id 不存在），返回空列表（而非抛异常），
    上层 service 会自动降级到 LLM 模式。这保证：
      - 前端没有知识库时仍能正常对话
      - 用户指定了不存在的 KB 时优雅降级
    """
    knowledge_base = db.scalar(
        select(KnowledgeBase.id).where(
            KnowledgeBase.id == knowledge_base_id,
            KnowledgeBase.owner_id == owner_id,
        )
    )
    if knowledge_base is None:
        # 知识库不存在 → 返回空上下文，上层自动降级到 LLM
        logger.info(
            "知识库 id=%s 不存在或无权限，跳过 RAG，降级到 LLM（owner_id=%s）",
            knowledge_base_id,
            owner_id,
        )
        return []

    if settings.RAG_VECTOR_SEARCH_ENABLED:
        try:
            vector_hits = retrieve_vector_chunks(
                db=db,
                owner_id=owner_id,
                knowledge_base_id=knowledge_base_id,
                question=question,
            )
            return [
                RetrievedContext(
                    document_id=hit.chunk.document_id,
                    filename=hit.filename,
                    content=hit.chunk.chunk_text,
                    score=hit.score,
                    chunk_id=hit.chunk.id,
                    page_number=hit.chunk.page_number,
                    page_numbers=list(hit.chunk.chunk_metadata.get("page_numbers", [])),
                    retrieval_method="vector",
                )
                for hit in vector_hits
            ]
        except Exception as exc:
            logger.warning(
                "向量检索失败 | knowledge_base_id=%s error=%s fallback=%s",
                knowledge_base_id,
                exc,
                settings.RAG_VECTOR_FALLBACK_TO_KEYWORD,
            )
            if not settings.RAG_VECTOR_FALLBACK_TO_KEYWORD:
                raise HTTPException(status_code=503, detail="向量检索服务不可用") from exc

    documents = list(
        db.scalars(
            select(KnowledgeDocument)
            .where(
                KnowledgeDocument.knowledge_base_id == knowledge_base_id,
                KnowledgeDocument.owner_id == owner_id,
                KnowledgeDocument.status == "parsed",
                KnowledgeDocument.parsed_text.is_not(None),
            )
            .order_by(KnowledgeDocument.id.desc())
            .limit(settings.CHAT_RAG_MAX_DOCUMENTS)
        ).all()
    )
    terms = _question_terms(question)
    candidates: list[RetrievedContext] = []
    for document in documents:
        for chunk in _split_text(document.parsed_text or ""):
            lowered = chunk.lower()
            score = float(sum(lowered.count(term) * len(term) for term in terms))
            if score > 0:
                candidates.append(
                    RetrievedContext(
                        document_id=document.id,
                        filename=document.original_filename,
                        content=chunk,
                        score=score,
                        retrieval_method="keyword",
                    )
                )

    candidates.sort(key=lambda item: item.score, reverse=True)
    unique_results: list[RetrievedContext] = []
    seen_content: set[str] = set()
    for candidate in candidates:
        signature = candidate.content[:200]
        if signature in seen_content:
            continue
        seen_content.add(signature)
        unique_results.append(candidate)
        if len(unique_results) >= settings.CHAT_RAG_TOP_K:
            break
    return unique_results
