"""聊天请求、回答和引用来源数据模型。"""

from enum import StrEnum

from pydantic import BaseModel, Field, model_validator

from app.ai.schemas import AITask


class ChatMode(StrEnum):
    """聊天助手支持的回答模式。"""

    LLM = "llm"
    RAG = "rag"
    WEB_SEARCH = "web_search"


class ChatRequest(BaseModel):
    """企业聊天请求，兼容自动推断和显式指定回答模式。"""

    message: str = Field(min_length=1, max_length=10000)
    conversation_id: int | None = Field(default=None, ge=1)
    knowledge_base_id: int | None = Field(default=None, ge=1)
    mode: ChatMode | None = None
    task: AITask = AITask.CHAT

    @model_validator(mode="after")
    def validate_mode_parameters(self) -> "ChatRequest":
        """校验模式与知识库参数组合。"""
        if self.mode == ChatMode.RAG and self.knowledge_base_id is None:
            raise ValueError("RAG模式必须提供knowledge_base_id")
        if self.task == AITask.RAG and self.knowledge_base_id is None:
            raise ValueError("RAG任务必须提供knowledge_base_id")
        if self.mode in {ChatMode.LLM, ChatMode.WEB_SEARCH} and self.knowledge_base_id:
            raise ValueError("仅RAG模式可以提供knowledge_base_id")
        if self.mode == ChatMode.RAG and self.task != AITask.CHAT and self.task != AITask.RAG:
            raise ValueError("RAG模式只能使用chat或rag任务")
        return self

    def resolved_mode(self) -> ChatMode:
        """显式模式优先，否则根据知识库ID兼容推断。"""
        if self.mode is not None:
            return self.mode
        if self.knowledge_base_id is not None:
            return ChatMode.RAG
        if self.task == AITask.RAG:
            return ChatMode.RAG
        return ChatMode.LLM

    def resolved_task(self) -> AITask:
        """根据回答模式确定任务，RAG模式优先映射为RAG任务。"""
        mode = self.resolved_mode()
        if mode == ChatMode.RAG:
            return AITask.RAG
        if mode == ChatMode.WEB_SEARCH:
            return AITask.WEB_SEARCH
        return self.task


class ChatCitation(BaseModel):
    """RAG回答引用的企业文档片段。"""

    document_id: int
    filename: str
    content: str
    score: float
    chunk_id: int | None = None
    page_number: int | None = None
    page_numbers: list[int] = Field(default_factory=list)
    retrieval_method: str = "keyword"


class ChatResponse(BaseModel):
    """聊天回答及会话状态。"""

    conversation_id: int
    assistant_message_id: int
    mode: ChatMode
    answer: str
    citations: list[ChatCitation] = Field(
        default_factory=list,
        description="兼容字段，内容与retrieved_contexts一致",
    )
    retrieved_contexts: list[ChatCitation] = Field(
        default_factory=list,
        description="实际送入模型Prompt的全部检索上下文",
    )
    used_citations: list[ChatCitation] = Field(
        default_factory=list,
        description="模型回答通过有效编号明确引用的上下文子集",
    )
    task: AITask = AITask.CHAT
    provider: str | None = None
    model: str | None = None
    latency_ms: float | None = None
    retrieval_method: str | None = None
