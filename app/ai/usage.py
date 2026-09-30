"""AI调用用量记录与结构化日志。"""

from dataclasses import dataclass
from time import perf_counter
from typing import Protocol
from uuid import uuid4

from app.ai.schemas import TokenUsage
from app.core.logging import get_logger

logger = get_logger(__name__)


@dataclass(frozen=True)
class UsageRecord:
    """一次模型尝试的审计用量记录，不保存提示词和回答正文。"""

    request_id: str
    task: str
    provider: str
    model: str
    usage: TokenUsage
    latency_ms: float
    success: bool
    attempt: int
    error: str | None = None


class UsageRecorder(Protocol):
    """用量记录器协议，未来可替换为MySQL、Redis或消息队列实现。"""

    def record(self, record: UsageRecord) -> None:
        """记录一次模型调用。"""


class LoggingUsageRecorder:
    """默认用结构化日志记录模型调用和Token消耗。"""

    def record(self, record: UsageRecord) -> None:
        """输出不包含业务正文的用量日志。"""
        logger.info(
            "AI调用 | request_id=%s task=%s provider=%s model=%s attempt=%s "
            "prompt_tokens=%s completion_tokens=%s total_tokens=%s latency_ms=%.2f "
            "success=%s error=%s",
            record.request_id,
            record.task,
            record.provider,
            record.model,
            record.attempt,
            record.usage.prompt_tokens,
            record.usage.completion_tokens,
            record.usage.total_tokens,
            record.latency_ms,
            record.success,
            record.error,
        )


usage_recorder: UsageRecorder = LoggingUsageRecorder()


def new_request_id() -> str:
    """生成不依赖业务数据库的AI请求追踪ID。"""
    return str(uuid4())


def elapsed_ms(started_at: float) -> float:
    """计算调用耗时。"""
    return (perf_counter() - started_at) * 1000
