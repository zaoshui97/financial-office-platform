"""通义千问Provider实现。"""

from app.ai.providers.openai_compatible import OpenAICompatibleProvider


class QwenProvider(OpenAICompatibleProvider):
    """承载知识库RAG、长文档理解和文件问答任务。"""
