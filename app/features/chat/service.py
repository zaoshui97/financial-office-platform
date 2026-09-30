"""智能聊天业务服务：管理会话、历史、LLM调用和知识库引用。"""

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
    """生成聊天回答，并将完整一轮对话原子保存到数据库。"""
    try:
        conversation = _get_or_create_conversation(db, owner_id, data)
        history = _load_history(db, conversation.id)
        history.append({"role": "user", "content": data.message})

        mode = data.resolved_mode()
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
