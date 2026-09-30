"""AI模型Provider实现与默认注册表。"""

from app.ai.providers.base import AIProvider, BaseLLMProvider
from app.ai.providers.deepseek_provider import DeepSeekProvider
from app.ai.providers.doubao_provider import DoubaoProvider
from app.ai.providers.openai_compatible import OpenAICompatibleProvider
from app.ai.providers.qwen_provider import QwenProvider


def create_default_providers() -> dict[str, AIProvider]:
    """创建进程内无状态Provider注册表。"""
    return {
        "openai_compatible": OpenAICompatibleProvider(),
        "ark": DoubaoProvider(),
        "deepseek": DeepSeekProvider(),
        "doubao": DoubaoProvider(),
        "qwen": QwenProvider(),
    }


__all__ = [
    "AIProvider",
    "BaseLLMProvider",
    "DeepSeekProvider",
    "DoubaoProvider",
    "OpenAICompatibleProvider",
    "QwenProvider",
    "create_default_providers",
]
