"""智能聊天业务服务：管理会话、历史、LLM调用和知识库引用。"""

from collections.abc import Iterator

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.llm_gateway import LLMServiceError, llm_gateway
from app.ai.schemas import AIResponse
from app.core.config import settings
from app.features.chat.citation_binding import bind_used_citations
from app.features.chat.models import ChatConversation, ChatMessage
from app.features.chat.rag_retriever import RetrievedContext, retrieve_knowledge_context
from app.features.chat.schemas import ChatCitation, ChatMode, ChatRequest, ChatResponse

NO_KNOWLEDGE_ANSWER = "当前知识库中没有找到足够依据。"


def _build_title(message: str) -> str:
    """使用首条用户消息生成简短会话标题。"""
    normalized = " ".join(message.split())
    return normalized[:40] or "新对话"


def _get_or_create_conversation(
    db: Session,
    owner_id: int,
    data: ChatRequest,
) -> ChatConversation:
    """获取当前用户会话，未传会话ID时创建新会话。"""
    if data.conversation_id is None:
        conversation = ChatConversation(
            owner_id=owner_id,
            title=_build_title(data.message),
        )
        db.add(conversation)
        db.flush()
        return conversation

    conversation = db.scalar(
        select(ChatConversation).where(
            ChatConversation.id == data.conversation_id,
            ChatConversation.owner_id == owner_id,
        )
    )
    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="聊天会话不存在",
        )
    return conversation


def _load_history(db: Session, conversation_id: int) -> list[dict[str, str]]:
    """按时间顺序加载最近的有效用户和助手消息。"""
    messages = list(
        db.scalars(
            select(ChatMessage)
            .where(ChatMessage.conversation_id == conversation_id)
            .order_by(ChatMessage.id.desc())
            .limit(settings.CHAT_HISTORY_LIMIT)
        ).all()
    )
    messages.reverse()
    return [
        {"role": message.role, "content": message.content}
        for message in messages
        if message.role in {"user", "assistant"}
    ]


def _build_rag_payload(
    contexts: list[RetrievedContext],
) -> tuple[list[str], list[ChatCitation]]:
    """为大模型构建编号材料，并生成可返回和持久化的引用。"""
    prompt_contexts: list[str] = []
    citations: list[ChatCitation] = []
    for index, context in enumerate(contexts, start=1):
        prompt_contexts.append(f"[{index}] 文档：{context.filename}\n{context.content}")
        citations.append(
            ChatCitation(
                document_id=context.document_id,
                filename=context.filename,
                content=context.content,
                score=context.score,
                chunk_id=context.chunk_id,
                page_number=context.page_number,
                page_numbers=context.page_numbers or [],
                retrieval_method=context.retrieval_method,
            )
        )
    return prompt_contexts, citations


def create_chat_reply(
    db: Session,
    owner_id: int,
    data: ChatRequest,
) -> ChatResponse:
    try:
        conversation = _get_or_create_conversation(db, owner_id, data)
        history = _load_history(db, conversation.id)
        history.append({"role": "user", "content": data.message})

        # 多 Agent 路由：用户没显式指定 mode → 走 dispatcher 自动调度
        from app.features.chat.dispatcher import auto_dispatch
        mode, dispatch_info = auto_dispatch(data)
        task = data.resolved_task()
        citations: list[ChatCitation] = []
        used_citations: list[ChatCitation] = []
        ai_response: AIResponse | None = None
        retrieval_method: str | None = None

        if mode == ChatMode.LLM:
            ai_response = llm_gateway.complete_with_metadata(history, task=task)
            answer = ai_response.text
        elif mode == ChatMode.WEB_SEARCH:
            ai_response = llm_gateway.complete_with_metadata(history, task=task)
            answer = ai_response.text
        else:
            contexts = retrieve_knowledge_context(
                db=db,
                owner_id=owner_id,
                knowledge_base_id=data.knowledge_base_id,
                question=data.message,
            )
            retrieval_method = (
                contexts[0].retrieval_method
                if contexts
                else ("vector" if settings.RAG_VECTOR_SEARCH_ENABLED else "keyword")
            )
            if not contexts:
                answer = NO_KNOWLEDGE_ANSWER
            else:
                prompt_contexts, citations = _build_rag_payload(contexts)
                ai_response = llm_gateway.complete_with_metadata(
                    history,
                    contexts=prompt_contexts,
                    task=task,
                )
                answer = ai_response.text

        used_citations = bind_used_citations(answer, citations)

        db.add(
            ChatMessage(
                conversation_id=conversation.id,
                role="user",
                mode=mode.value,
                content=data.message,
                citations=None,
            )
        )
        assistant_message = ChatMessage(
            conversation_id=conversation.id,
            role="assistant",
            mode=mode.value,
            content=answer,
            citations=[citation.model_dump() for citation in citations] or None,
        )
        db.add(assistant_message)
        db.commit()
        db.refresh(assistant_message)
    except LLMServiceError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except Exception:
        db.rollback()
        raise

    return ChatResponse(
        conversation_id=conversation.id,
        assistant_message_id=assistant_message.id,
        mode=mode,
        answer=answer,
        citations=citations,
        retrieved_contexts=citations,
        used_citations=used_citations,
        task=task,
        provider=ai_response.provider if ai_response else None,
        model=ai_response.model if ai_response else None,
        latency_ms=ai_response.latency_ms if ai_response else None,
        retrieval_method=retrieval_method,
    )


def create_chat_reply_stream(
    owner_id: int,
    data: ChatRequest,
) -> Iterator[str]:
    """流式版 chat：逐段 yield SSE 事件 JSON。

    简化：
      - 跳过 RAG citation 绑定（流式不便分 chunk 判断引用）
      - 跳过 ChatMessage 落库（前端可在收到 'done' 后自行 POST 保存）
      - 错误转 SSE error 事件而非 HTTP 状态码（流已开始后只能这样）
    """
    import json
    from app.ai.llm_gateway import llm_gateway
    from app.ai.schemas import AITask

    history = [{"role": "user", "content": data.message}]
    task = data.resolved_task()
    # 多 Agent 路由：用户没显式指定 mode → 走 dispatcher 自动调度
    from app.features.chat.dispatcher import auto_dispatch
    _dispatched_mode, dispatch_info = auto_dispatch(data)

    def _sse(event: str, payload: dict) -> str:
        return f"data: {json.dumps({'event': event, **payload}, ensure_ascii=False)}\n\n"

    try:
        # 简单 LLM 调用（流式）：不支持 RAG 的 citation
        # 流式只支持 LLM / WEB_SEARCH；RAG / COMPLIANCE 走一次性接口
        mode = data.resolved_mode()
        if mode in (ChatMode.RAG, ChatMode.COMPLIANCE_SANDBOX):
            # RAG 流式要检索 + 注入上下文（一次性），实现稍重
            # 这里走非流式 RAG 然后单 chunk yield
            from app.core.database import SessionLocal
            from app.features.chat.rag_retriever import retrieve_knowledge_context
            db = SessionLocal()
            try:
                contexts = retrieve_knowledge_context(
                    db=db,
                    owner_id=owner_id,
                    knowledge_base_id=data.knowledge_base_id,
                    question=data.message,
                )
                prompt_contexts, _citations = _build_rag_payload(contexts)
                if not contexts:
                    yield _sse("chunk", {"content": NO_KNOWLEDGE_ANSWER})
                else:
                    # 一次性调完整 LLM 然后切段（伪流式）
                    full = llm_gateway.complete(
                        history, contexts=prompt_contexts, task=task,
                    )
                    # 按句号切分做简单"流式"（不实现真正的 token 级流）
                    for seg in _split_to_chunks(full, 8):
                        yield _sse("chunk", {"content": seg})
            finally:
                db.close()
        else:
            # LLM 模式：真流式
            for chunk in llm_gateway.stream_complete(history, task=task):
                yield _sse("chunk", {"content": chunk})

        yield _sse("done", {"task": task.value})
    except Exception as exc:
        from app.ai.llm_gateway import LLMServiceError
        msg = str(exc) if isinstance(exc, LLMServiceError) else f"{type(exc).__name__}: {exc}"
        yield _sse("error", {"detail": msg})


def _split_to_chunks(text: str, chars_per_chunk: int) -> Iterator[str]:
    """把完整文本切成 chunk 用于伪流式（RAG 模式）。"""
    text = text or ""
    for i in range(0, len(text), chars_per_chunk):
        yield text[i : i + chars_per_chunk]
