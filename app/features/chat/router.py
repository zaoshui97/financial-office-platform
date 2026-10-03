"""企业智能聊天助手API（含流式）。"""

from collections.abc import Iterator
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.features.auth.dependencies import CurrentUser
from app.features.chat.schemas import ChatRequest, ChatResponse
from app.features.chat.service import create_chat_reply, create_chat_reply_stream

router = APIRouter(prefix="/chat", tags=["智能聊天助手"])


@router.post(
    "",
    response_model=ChatResponse,
    summary="企业AI聊天（一次性响应）",
)
def chat(
    data: ChatRequest,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> ChatResponse:
    """进行普通大模型对话，或结合指定知识库进行RAG问答。"""
    return create_chat_reply(db, current_user.id, data)


@router.post(
    "/stream",
    summary="企业AI聊天（流式 SSE）",
    response_class=StreamingResponse,
)
def chat_stream(
    data: ChatRequest,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> StreamingResponse:
    """SSE 流式输出 LLM 回复 chunk。

    响应格式：
      - data: {"event": "chunk", "content": "..."}\\n\\n
      - data: {"event": "done", "conversation_id": N, "title": "..."}\\n\\n
      - data: {"event": "error", "detail": "..."}\\n\\n

    注意：
      - 不绑 knowledge 检索（流式不便分 chunk 输出 citation）
      - 不写 ChatMessage（流式不便 commit 时机；如需保留可前端收到 done 后再 POST 保存）
    """
    iterator: Iterator[str] = create_chat_reply_stream(current_user.id, data)
    return StreamingResponse(
        iterator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # 禁用 nginx 缓冲
        },
    )