"""模型Provider统一协议。"""

from abc import ABC, abstractmethod
from collections.abc import Iterator
from typing import Protocol

from app.ai.model_router import ModelProfile, ProviderConfig
from app.ai.schemas import AIRequest, AIResponse


class BaseLLMProvider(ABC):
    """所有LLM Provider共享的抽象基类。"""

    @abstractmethod
    def chat(
        self,
        request: AIRequest,
        profile: ModelProfile,
        provider: ProviderConfig,
    ) -> AIResponse:
        """执行一次非流式对话。"""

    @abstractmethod
    def stream_chat(
        self,
        request: AIRequest,
        profile: ModelProfile,
        provider: ProviderConfig,
    ) -> Iterator[str]:
        """执行一次流式对话并逐段返回文本。"""

    @abstractmethod
    def count_tokens(self, request: AIRequest) -> int:
        """估算请求Token数量。"""

    def generate(
        self,
        request: AIRequest,
        profile: ModelProfile,
        provider: ProviderConfig,
    ) -> AIResponse:
        """兼容现有Gateway调用入口。"""
        return self.chat(request, profile, provider)


class AIProvider(Protocol):
    """所有模型提供方必须实现的统一接口。"""

    def chat(
        self,
        request: AIRequest,
        profile: ModelProfile,
        provider: ProviderConfig,
    ) -> AIResponse:
        """执行一次非流式对话。"""

    def stream_chat(
        self,
        request: AIRequest,
        profile: ModelProfile,
        provider: ProviderConfig,
    ) -> Iterator[str]:
        """执行一次流式对话。"""

    def count_tokens(self, request: AIRequest) -> int:
        """估算请求Token数量。"""

    def generate(
        self,
        request: AIRequest,
        profile: ModelProfile,
        provider: ProviderConfig,
    ) -> AIResponse:
        """兼容旧调用入口。"""
