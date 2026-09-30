"""豆包Provider实现。"""

from app.ai.providers.openai_compatible import OpenAICompatibleProvider


class DoubaoProvider(OpenAICompatibleProvider):
    """承载企业办公、文档、公文和中文润色任务。"""
