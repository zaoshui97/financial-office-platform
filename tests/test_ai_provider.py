"""OpenAI Compatible Provider协议适配测试。"""

from types import SimpleNamespace

import pytest

from app.ai.exceptions import AIProviderError
from app.ai.model_router import ModelProfile, ProviderConfig
from app.ai.providers import create_default_providers
from app.ai.providers.deepseek_provider import DeepSeekProvider
from app.ai.providers.doubao_provider import DoubaoProvider
from app.ai.providers.openai_compatible import OpenAICompatibleProvider
from app.ai.providers.qwen_provider import QwenProvider
from app.ai.schemas import AIRequest


class FakeChatCompletions:
    """记录Chat Completions调用并返回预设结果。"""

    def __init__(self, response=None, error: Exception | None = None) -> None:
        self.response = response
        self.error = error
        self.payload: dict[str, object] | None = None

    def create(self, **payload):
        self.payload = payload
        if self.error:
            raise self.error
        return self.response


class FakeResponses:
    """记录Responses API调用并返回预设结果。"""

    def __init__(self, response=None) -> None:
        self.response = response
        self.payload: dict[str, object] | None = None

    def create(self, **payload):
        self.payload = payload
        return self.response


def _provider_config(api_style: str) -> ProviderConfig:
    """构造测试用Provider配置。"""
    return ProviderConfig(
        name="test-provider",
        base_url="https://example.test/v1",
        api_key="test-key",
        api_key_env="TEST_API_KEY",
        api_style=api_style,
        timeout_seconds=10,
    )


def _profile() -> ModelProfile:
    """构造测试用模型档案。"""
    return ModelProfile(
        name="test-model-profile",
        provider="test-provider",
        model="test-model",
        temperature=0.3,
    )


def test_chat_completions_builds_payload_and_extracts_usage(monkeypatch) -> None:
    """Chat Completions应注入系统指令并解析标准Token字段。"""
    completions = FakeChatCompletions(
        response=SimpleNamespace(
            id="chat-response-1",
            choices=[SimpleNamespace(message=SimpleNamespace(content="  已完成  "))],
            usage=SimpleNamespace(
                prompt_tokens=11,
                completion_tokens=7,
                total_tokens=18,
            ),
        )
    )
    client = SimpleNamespace(
        chat=SimpleNamespace(completions=completions),
        responses=SimpleNamespace(),
    )
    provider = OpenAICompatibleProvider()
    monkeypatch.setattr(provider, "_client", lambda config: client)

    response = provider.generate(
        AIRequest(
            task="chat",
            messages=[{"role": "user", "content": "你好"}],
            instructions="使用简体中文回答",
            max_tokens=200,
        ),
        _profile(),
        _provider_config("chat_completions"),
    )

    assert response.text == "已完成"
    assert response.response_id == "chat-response-1"
    assert response.usage.prompt_tokens == 11
    assert response.usage.completion_tokens == 7
    assert response.usage.total_tokens == 18
    assert completions.payload == {
        "model": "test-model",
        "messages": [
            {"role": "system", "content": "使用简体中文回答"},
            {"role": "user", "content": "你好"},
        ],
        "temperature": 0.3,
        "max_tokens": 200,
    }


def test_responses_api_parses_output_text_and_input_output_usage(monkeypatch) -> None:
    """Responses API应解析output_text及input/output Token字段。"""
    responses = FakeResponses(
        response=SimpleNamespace(
            id="responses-1",
            output_text="  文档已生成  ",
            usage=SimpleNamespace(input_tokens=23, output_tokens=9, total_tokens=32),
        )
    )
    client = SimpleNamespace(
        chat=SimpleNamespace(),
        responses=responses,
    )
    provider = OpenAICompatibleProvider()
    monkeypatch.setattr(provider, "_client", lambda config: client)

    response = provider.generate(
        AIRequest(
            task="document_generation",
            messages=[{"role": "user", "content": "生成通知"}],
            instructions="输出正式文案",
            tools=[{"type": "web_search", "max_keyword": 2}],
            max_tokens=500,
        ),
        _profile(),
        _provider_config("responses"),
    )

    assert response.text == "文档已生成"
    assert response.response_id == "responses-1"
    assert response.usage.prompt_tokens == 23
    assert response.usage.completion_tokens == 9
    assert response.usage.total_tokens == 32
    assert responses.payload == {
        "model": "test-model",
        "input": [{"role": "user", "content": "生成通知"}],
        "instructions": "输出正式文案",
        "tools": [{"type": "web_search", "max_keyword": 2}],
        "max_output_tokens": 500,
    }


def test_responses_api_ignores_output_items_without_content(monkeypatch) -> None:
    """豆包返回content为空的中间输出项时应继续解析最终文本。"""
    responses = FakeResponses(
        response=SimpleNamespace(
            id="responses-with-reasoning",
            output_text=None,
            output=[
                SimpleNamespace(content=None),
                SimpleNamespace(
                    content=[SimpleNamespace(text="豆包接入成功")],
                ),
            ],
            usage=SimpleNamespace(input_tokens=5, output_tokens=4, total_tokens=9),
        )
    )
    client = SimpleNamespace(chat=SimpleNamespace(), responses=responses)
    provider = OpenAICompatibleProvider()
    monkeypatch.setattr(provider, "_client", lambda config: client)

    response = provider.generate(
        AIRequest(task="chat", messages=[{"role": "user", "content": "测试"}]),
        _profile(),
        _provider_config("responses"),
    )

    assert response.text == "豆包接入成功"
    assert response.usage.total_tokens == 9


def test_responses_api_reports_incomplete_reason_without_final_text(monkeypatch) -> None:
    """推理耗尽输出额度时应返回可定位的截断原因。"""
    responses = FakeResponses(
        response=SimpleNamespace(
            id="incomplete-response",
            status="incomplete",
            incomplete_details=SimpleNamespace(reason="max_output_tokens"),
            output_text=None,
            output=[SimpleNamespace(content=None)],
            usage=SimpleNamespace(input_tokens=5, output_tokens=2048, total_tokens=2053),
        )
    )
    client = SimpleNamespace(chat=SimpleNamespace(), responses=responses)
    provider = OpenAICompatibleProvider()
    monkeypatch.setattr(provider, "_client", lambda config: client)

    with pytest.raises(
        AIProviderError,
        match="status=incomplete, reason=max_output_tokens",
    ):
        provider.generate(
            AIRequest(task="chat", messages=[{"role": "user", "content": "测试"}]),
            _profile(),
            _provider_config("responses"),
        )


def test_provider_converts_remote_exception_to_provider_error(monkeypatch) -> None:
    """底层SDK异常不应泄漏到业务层。"""
    completions = FakeChatCompletions(error=TimeoutError("upstream timeout"))
    client = SimpleNamespace(
        chat=SimpleNamespace(completions=completions),
        responses=SimpleNamespace(),
    )
    provider = OpenAICompatibleProvider()
    monkeypatch.setattr(provider, "_client", lambda config: client)

    with pytest.raises(AIProviderError, match="Provider test-provider 调用失败: TimeoutError"):
        provider.generate(
            AIRequest(task="chat", messages=[{"role": "user", "content": "测试"}]),
            _profile(),
            _provider_config("chat_completions"),
        )


def test_web_search_tool_injection_does_not_mutate_request(monkeypatch) -> None:
    """Provider注入默认搜索工具时不应修改调用方请求。"""
    responses = FakeResponses(
        response=SimpleNamespace(
            id="search-1",
            output_text="搜索完成",
            usage=SimpleNamespace(input_tokens=0, output_tokens=0, total_tokens=0),
        )
    )
    client = SimpleNamespace(
        chat=SimpleNamespace(),
        responses=responses,
    )
    provider = OpenAICompatibleProvider()
    monkeypatch.setattr(provider, "_client", lambda config: client)
    request = AIRequest(
        task="web_search",
        messages=[{"role": "user", "content": "查询天气"}],
        need_web_search=True,
    )

    provider.generate(request, _profile(), _provider_config("responses"))

    assert request.tools == []
    assert responses.payload is not None
    assert responses.payload["tools"] == [{"type": "web_search", "max_keyword": 2}]


def test_default_registry_contains_named_domestic_providers() -> None:
    """默认注册表应提供三家具名Provider。"""
    providers = create_default_providers()

    assert isinstance(providers["deepseek"], DeepSeekProvider)
    assert isinstance(providers["doubao"], DoubaoProvider)
    assert isinstance(providers["qwen"], QwenProvider)


def test_responses_stream_chat_yields_text_deltas(monkeypatch) -> None:
    """Responses流式事件应统一转换为文本片段。"""
    responses = FakeResponses(
        response=[
            SimpleNamespace(type="response.created"),
            SimpleNamespace(type="response.output_text.delta", delta="企业"),
            SimpleNamespace(type="response.output_text.delta", delta="通知"),
        ]
    )
    client = SimpleNamespace(chat=SimpleNamespace(), responses=responses)
    provider = OpenAICompatibleProvider()
    monkeypatch.setattr(provider, "_client", lambda config: client)

    chunks = list(
        provider.stream_chat(
            AIRequest(task="document_generation"),
            _profile(),
            _provider_config("responses"),
        )
    )

    assert chunks == ["企业", "通知"]


def test_count_tokens_returns_conservative_positive_estimate() -> None:
    """中英文混合请求应得到稳定的正整数Token估算。"""
    provider = OpenAICompatibleProvider()
    request = AIRequest(
        task="chat",
        instructions="使用中文回答",
        messages=[{"role": "user", "content": "Analyze 2026年度财务数据"}],
    )

    count = provider.count_tokens(request)

    assert isinstance(count, int)
    assert count > 10
