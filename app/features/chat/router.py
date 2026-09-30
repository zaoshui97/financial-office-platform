"""企业智能聊天助手API。"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.features.auth.dependencies import CurrentUser
from app.features.chat.schemas import ChatRequest, ChatResponse
from app.features.chat.service import create_chat_reply

router = APIRouter(prefix="/chat", tags=["智能聊天助手"])


@router.post(
    "",
    response_model=ChatResponse,
    summary="企业AI聊天",
)
def chat(
    data: ChatRequest,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> ChatResponse:
    """进行普通大模型对话，或结合指定知识库进行RAG问答。"""
    return create_chat_reply(db, current_user.id, data)
