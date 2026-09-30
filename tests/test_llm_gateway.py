"""统一AI Gateway、动态路由、fallback和Token用量测试。"""

import json
from dataclasses import dataclass

import pytest

from app.ai.exceptions import AIProviderError
from app.ai.llm_gateway import LLMGateway, LLMServiceError
from app.ai.model_router import model_router
from app.ai.schemas import AIRequest, AIResponse, AITask, TokenUsage
from app.ai.usage import UsageRecord
from app.core.config import settings


@dataclass
class RecordingUsageRecorder:
    """测试用量记录器。"""

    records: list[UsageRecord]

    def record(self, record: UsageRecord) -> None:
        """保存记录供断言。"""
        self.records.append(record)


class FakeProvider:
    """可配置成功或失败的Provider。"""

    def __init__(self, provider_name: str, should_fail: bool = False) -> None:
        self.provider_name = provider_name
        self.should_fail = should_fail
        self.calls = 0

    def chat(self, request, profile, provider) -> AIResponse:
        """返回固定结果或模拟远程失败。"""
        self.calls += 1
        if self.should_fail:
            raise AIProviderError(f"{self.provider_name} temporarily unavailable")
        return AIResponse(
            text="fallback回答",
            provider=provider.name,
            model=profile.model,
            usage=TokenUsage(prompt_tokens=10, completion_tokens=5, total_tokens=15),
        )

    def stream_chat(self, request, profile, provider):
        """返回固定流式结果或模拟首段前失败。"""
        self.calls += 1
        if self.should_fail:
            raise AIProviderError(f"{self.provider_name} temporarily unavailable")
        yield "fallback"
        yield "回答"

    def count_tokens(self, request) -> int:
        """返回固定Token估算。"""
        return 42


def test_dynamic_route_selects_doubao_for_long_document_generation(monkeypatch) -> None:
    """动态路由可按任务能力选择豆包模型。"""
    monkeypatch.setattr(
        settings,
        "AI_MODEL_PROFILES_JSON",
        json.dumps(
            {
                "doubao_document": {
                    "provider": "doubao",
                    "model": "doubao-document",
                    "supports_long_context": True,
                },
                "deepseek_code": {
                    "provider": "deepseek",
                    "model": "deepseek-reasoner",
                    "supports_reasoning": True,
                },
            }
        ),
    )
    monkeypatch.setattr(
        settings,
        "AI_TASK_ROUTES_JSON",
        json.dumps({"document_generation": ["deepseek_code", "doubao_document"]}),
    )

    request = AIRequest(
        task=AITask.DOCUMENT_GENERATION,
        complexity="medium",
        need_long_context=True,
    )

    candidates = model_router.candidates_for(request)

    assert candidates[0].provider == "doubao"
    assert candidates[0].model == "doubao-document"


def test_code_reasoning_route_selects_deepseek(monkeypatch) -> None:
    """复杂代码推理任务可路由到DeepSeek。"""
    monkeypatch.setattr(
        settings,
        "AI_MODEL_PROFILES_JSON",
        json.dumps(
            {
                "deepseek_reasoning": {
                    "provider": "deepseek",
                    "model": "deepseek-reasoner",
                    "supports_reasoning": True,
                }
            }
        ),
    )
    monkeypatch.setattr(
        settings,
        "AI_TASK_ROUTES_JSON",
        json.dumps({"code_reasoning": ["deepseek_reasoning"]}),
    )

    candidates = model_router.candidates_for(
        AIRequest(task=AITask.CODE_REASONING, complexity="high")
    )

    assert candidates[0].provider == "deepseek"
    assert candidates[0].model == "deepseek-reasoner"


def test_route_satisfies_multiple_capability_requirements(monkeypatch) -> None:
    """多个能力要求同时存在时，路由仍应优先选择全部满足的模型。"""
    monkeypatch.setattr(
        settings,
        "AI_MODEL_PROFILES_JSON",
        json.dumps(
            {
                "tools_only": {
                    "provider": "test",
                    "model": "tools-model",
                    "supports_tools": True,
                },
                "context_and_tools": {
                    "provider": "test",
                    "model": "best-model",
                    "supports_long_context": True,
                    "supports_tools": True,
                    "supports_reasoning": True,
                },
                "context_only": {
                    "provider": "test",
                    "model": "context-model",
                    "supports_long_context": True,
                },
            }
        ),
    )
    monkeypatch.setattr(
        settings,
        "AI_TASK_ROUTES_JSON",
        json.dumps(
            {
                "agent": ["tools_only", "context_only", "context_and_tools"],
            }
        ),
    )

    candidates = model_router.candidates_for(
        AIRequest(
            task=AITask.AGENT,
            complexity="high",
            need_long_context=True,
            need_tools=True,
        )
    )

    assert candidates[0].model == "best-model"


def test_gateway_falls_back_and_records_token_usage(monkeypatch) -> None:
    """主模型失败时应调用备用模型并记录每次尝试。"""
    monkeypatch.setattr(settings, "AI_MAX_RETRIES", 1)
    monkeypatch.setattr(
        settings,
        "AI_MODEL_PROFILES_JSON",
        json.dumps(
            {
                "primary": {"provider": "primary", "model": "primary-model"},
                "fallback": {"provider": "fallback", "model": "fallback-model"},
            }
        ),
    )
    monkeypatch.setattr(
        settings,
        "AI_TASK_ROUTES_JSON",
        json.dumps({"chat": ["primary", "fallback"]}),
    )
    monkeypatch.setattr(
        settings,
        "AI_PROVIDERS_JSON",
        json.dumps(
            {
                "primary": {"base_url": "https://primary.test", "api_key": "test"},
                "fallback": {"base_url": "https://fallback.test", "api_key": "test"},
            }
        ),
    )
    recorder = RecordingUsageRecorder([])
    gateway = LLMGateway(
        providers={
            "primary": FakeProvider("primary", should_fail=True),
            "fallback": FakeProvider("fallback"),
        },
        recorder=recorder,
    )

    response = gateway.generate(
        AIRequest(task=AITask.CHAT, messages=[{"role": "user", "content": "hello"}])
    )

    assert response.text == "fallback回答"
    assert len(recorder.records) == 3
    assert recorder.records[0].success is False
    assert recorder.records[1].success is False
    assert recorder.records[2].success is True
    assert recorder.records[2].usage.total_tokens == 15


def test_gateway_can_disable_fallback(monkeypatch) -> None:
    """关闭fallback时主模型失败应直接结束。"""
    monkeypatch.setattr(settings, "AI_FALLBACK_ENABLED", False)
    monkeypatch.setattr(
        settings,
        "AI_MODEL_PROFILES_JSON",
        json.dumps(
            {
                "primary": {"provider": "primary", "model": "primary-model"},
                "fallback": {"provider": "fallback", "model": "fallback-model"},
            }
        ),
    )
    monkeypatch.setattr(
        settings,
        "AI_TASK_ROUTES_JSON",
        json.dumps({"chat": ["primary", "fallback"]}),
    )
    monkeypatch.setattr(
        settings,
        "AI_PROVIDERS_JSON",
        json.dumps(
            {
                "primary": {"base_url": "https://primary.test", "api_key": "test"},
                "fallback": {"base_url": "https://fallback.test", "api_key": "test"},
            }
        ),
    )
    gateway = LLMGateway(providers={"primary": FakeProvider("primary", True)})

    with pytest.raises(LLMServiceError, match="所有候选模型调用失败"):
        gateway.generate(AIRequest(task=AITask.CHAT))


def test_builtin_routes_assign_business_tasks_to_expected_models(monkeypatch) -> None:
    """默认路由应按业务定位选择三类国产模型。"""
    monkeypatch.setattr(settings, "AI_MODEL_PROFILES_JSON", "")
    monkeypatch.setattr(settings, "AI_TASK_ROUTES_JSON", "")
    monkeypatch.setattr(settings, "DOUBAO_MODEL", "doubao-office")

    financial = model_router.candidates_for(AIRequest(task="financial_analysis"))
    document = model_router.candidates_for(AIRequest(task="document_generation"))
    knowledge = model_router.candidates_for(AIRequest(task="knowledge_question"))
    rag = model_router.candidates_for(AIRequest(task="rag_answer"))

    assert financial[0].provider == "deepseek"
    assert document[0].provider == "doubao"
    assert knowledge[0].provider == "qwen"
    assert [candidate.provider for candidate in rag[:2]] == ["qwen", "deepseek"]


def test_gateway_streams_from_fallback_provider(monkeypatch) -> None:
    """首选模型在输出前失败时流式调用应切换备用模型。"""
    monkeypatch.setattr(settings, "AI_FALLBACK_ENABLED", True)
    monkeypatch.setattr(
        settings,
        "AI_MODEL_PROFILES_JSON",
        json.dumps(
            {
                "primary": {"provider": "primary", "model": "primary-model"},
                "fallback": {"provider": "fallback", "model": "fallback-model"},
            }
        ),
    )
    monkeypatch.setattr(
        settings,
        "AI_TASK_ROUTES_JSON",
        json.dumps({"chat": ["primary", "fallback"]}),
    )
    monkeypatch.setattr(
        settings,
        "AI_PROVIDERS_JSON",
        json.dumps(
            {
                "primary": {"base_url": "https://primary.test", "api_key": "test"},
                "fallback": {"base_url": "https://fallback.test", "api_key": "test"},
            }
        ),
    )
    gateway = LLMGateway(
        providers={
            "primary": FakeProvider("primary", True),
            "fallback": FakeProvider("fallback"),
        }
    )

    chunks = list(gateway.stream_chat(AIRequest(task=AITask.CHAT)))

    assert chunks == ["fallback", "回答"]


def test_gateway_delegates_token_count_to_routed_provider(monkeypatch) -> None:
    """Token预估应由路由后的Provider负责。"""
    monkeypatch.setattr(
        settings,
        "AI_MODEL_PROFILES_JSON",
        json.dumps({"selected": {"provider": "selected", "model": "selected-model"}}),
    )
    monkeypatch.setattr(
        settings,
        "AI_TASK_ROUTES_JSON",
        json.dumps({"chat": ["selected"]}),
    )
    gateway = LLMGateway(providers={"selected": FakeProvider("selected")})

    count = gateway.count_tokens(AIRequest(task=AITask.CHAT))

    assert count == 42
