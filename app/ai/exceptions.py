"""AI Gateway异常类型。"""

from dataclasses import dataclass
from typing import Literal

EmbeddingTimeoutStage = Literal["connect", "read", "write", "pool"]


@dataclass(frozen=True, slots=True)
class EmbeddingConnectionDiagnostic:
    """不含异常原文或请求数据的连接失败诊断项。"""

    exception_type: str
    errno: int | None = None
    winerror: int | None = None
    timeout_stage: EmbeddingTimeoutStage | None = None


class AIError(RuntimeError):
    """AI模块基础异常。"""


class AIConfigurationError(AIError):
    """Provider或模型配置错误。"""


class AIProviderError(AIError):
    """单个Provider调用失败。"""


class AIAllProvidersFailed(AIError):
    """所有候选模型均调用失败。"""


class EmbeddingError(AIError):
    """Embedding基础设施统一异常。"""


class EmbeddingConfigurationError(EmbeddingError):
    """Embedding配置错误。"""


class EmbeddingInputError(EmbeddingError):
    """Embedding输入不符合约束。"""


class EmbeddingProviderError(EmbeddingError):
    """Embedding供应商调用失败。"""

    def __init__(
        self,
        message: str,
        *,
        retryable: bool = False,
        status_code: int | None = None,
        provider_code: str | None = None,
        provider_message: str | None = None,
        request_id: str | None = None,
        connection_diagnostics: tuple[EmbeddingConnectionDiagnostic, ...] = (),
    ) -> None:
        super().__init__(message)
        self.retryable = retryable
        self.status_code = status_code
        self.provider_code = provider_code
        self.provider_message = provider_message
        self.request_id = request_id
        self.connection_diagnostics = connection_diagnostics
