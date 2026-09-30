"""三模型诊断结果和密钥安全性测试。"""

from dataclasses import dataclass

from app.ai.diagnostics import run_model_diagnostics
from app.ai.model_router import ModelProfile, ProviderConfig
from app.ai.schemas import AIResponse, TokenUsage


@dataclass
class FakeProvider:
    """返回固定结果的诊断测试Provider。"""

    response_text: str = "OK"

    def chat(self, request, profile, provider) -> AIResponse:
        """模拟一次成功模型调用。"""
        return AIResponse(
            text=self.response_text,
            provider=provider.name,
            model=profile.model,
            usage=TokenUsage(prompt_tokens=11, completion_tokens=2, total_tokens=13),
        )

    def stream_chat(self, request, profile, provider):
        """满足Provider协议的最小流式实现。"""
        yield self.response_text

    def count_tokens(self, request) -> int:
        """满足Provider协议的最小Token估算实现。"""
        return 13


class FakeRouter:
    """提供固定三模型配置的测试Router。"""

    def profiles(self):
        return {
            "deepseek_reasoning": ModelProfile("deepseek_reasoning", "deepseek", "deepseek-test"),
            "doubao_office": ModelProfile("doubao_office", "doubao", "doubao-test"),
            "qwen_knowledge": ModelProfile("qwen_knowledge", "qwen", "qwen-test"),
        }

    def provider_for(self, name):
        return ProviderConfig(
            name,
            "https://example.test/v1",
            "test-key",
            "TEST_KEY",
            "chat_completions",
            1,
        )


def test_model_diagnostics_returns_each_model_and_usage() -> None:
    """诊断应分别返回三个Provider及Token字段。"""
    providers = {
        "deepseek": FakeProvider(),
        "doubao": FakeProvider(),
        "qwen": FakeProvider(),
    }

    results = run_model_diagnostics(providers=providers, router=FakeRouter())

    assert [result.provider for result in results] == ["deepseek", "doubao", "qwen"]
    assert all(result.success for result in results)
    assert all(result.response_text == "OK" for result in results)
    assert all(result.input_tokens == 11 for result in results)
    assert all(result.output_tokens == 2 for result in results)


def test_model_diagnostics_reports_missing_profile_without_calling_provider() -> None:
    """缺少模型档案时应返回安全错误，而不是发起调用。"""
    class IncompleteRouter(FakeRouter):
        def profiles(self):
            profiles = super().profiles()
            profiles.pop("qwen_knowledge")
            return profiles

    results = run_model_diagnostics(
        providers={"deepseek": FakeProvider(), "doubao": FakeProvider(), "qwen": FakeProvider()},
        router=IncompleteRouter(),
    )

    qwen_result = results[-1]
    assert not qwen_result.success
    assert qwen_result.error == "未找到模型档案: qwen_knowledge"
    assert "test-key" not in str(qwen_result)
