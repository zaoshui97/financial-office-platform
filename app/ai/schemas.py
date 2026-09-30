"""AI Gateway的统一请求、响应和用量模型。"""

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field, field_validator


class AITask(StrEnum):
    """平台级AI任务，不暴露具体厂商模型名称。"""

    CHAT = "chat"
    RAG = "rag"
    WEB_SEARCH = "web_search"
    DOCUMENT = "document"
    DOCUMENT_GENERATION = "document_generation"
    SUMMARY = "summary"
    LONG_CONTEXT_SUMMARY = "long_context_summary"
    CODE_REASONING = "code_reasoning"
    FINANCIAL_ANALYSIS = "financial_analysis"
    AGENT_PLANNING = "agent_planning"
    WORKFLOW_DECISION = "workflow_decision"
    SQL_GENERATION = "sql_generation"
    COMPLEX_LOGIC = "complex_logic"
    KNOWLEDGE_QUESTION = "knowledge_question"
    RAG_ANSWER = "rag_answer"
    FILE_QA = "file_qa"
    DOCUMENT_ANALYSIS = "document_analysis"
    EMAIL_GENERATION = "email_generation"
    OFFICIAL_DOCUMENT = "official_document"
    CHINESE_POLISHING = "chinese_polishing"
    MEETING_MINUTES = "meeting_minutes"
    MEETING = "meeting"
    AGENT = "agent"


class AIComplexity(StrEnum):
    """任务复杂度，用于路由决策。"""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class AIRequest(BaseModel):
    """模型无关的统一AI请求。"""

    task: AITask | str
    messages: list[dict[str, str]] = Field(default_factory=list)
    instructions: str | None = None
    complexity: AIComplexity = AIComplexity.MEDIUM
    need_long_context: bool = False
    need_web_search: bool = False
    need_tools: bool = False
    max_tokens: int | None = Field(default=None, ge=1, le=100000)
    tools: list[dict[str, Any]] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("task")
    @classmethod
    def normalize_task(cls, value: AITask | str) -> AITask | str:
        """清理任务名，保留未来扩展任务的字符串兼容性。"""
        if isinstance(value, AITask):
            return value
        normalized = value.strip().lower()
        return AITask(normalized) if normalized in {item.value for item in AITask} else normalized

    @property
    def task_name(self) -> str:
        """返回路由使用的标准任务名称。"""
        task = self.task.value if isinstance(self.task, AITask) else self.task
        aliases = {
            "document": AITask.DOCUMENT_GENERATION.value,
            "summary": AITask.LONG_CONTEXT_SUMMARY.value
            if self.need_long_context
            else AITask.SUMMARY.value,
        }
        return aliases.get(task, task)


class TokenUsage(BaseModel):
    """统一不同模型API的Token用量字段。"""

    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class AIResponse(BaseModel):
    """Provider返回给Gateway的标准结果。"""

    text: str
    provider: str | None = None
    model: str | None = None
    task: str | None = None
    latency_ms: float | None = None
    request_id: str | None = None
    usage: TokenUsage = Field(default_factory=TokenUsage)
    response_id: str | None = None
