"""Embedding基础设施测试，默认不访问外部服务。"""

from types import SimpleNamespace

import httpx
import pytest
from openai import APIConnectionError, APIStatusError, APITimeoutError

from app.ai.embeddings.bailian import BailianEmbeddingProvider
from app.ai.embeddings.base import BaseEmbeddingProvider, ProviderEmbeddingResult
from app.ai.embeddings.schemas import (
    EmbeddedChunk,
    EmbeddingChunkInput,
    EmbeddingInputType,
    EmbeddingRequest,
)
from app.ai.embeddings.service import EmbeddingService
from app.ai.exceptions import (
    EmbeddingConfigurationError,
    EmbeddingError,
    EmbeddingInputError,
    EmbeddingProviderError,
)
from app.core.config import settings


class FakeEmbeddingProvider(BaseEmbeddingProvider):
    """可控制结果、调用次数和异常的Provider。"""

    name = "fake"

    def __init__(self, dimension: int = 3, failures: int = 0, wrong_count: bool = False):
        self.dimension = dimension
        self.failures = failures
        self.wrong_count = wrong_count
        self.calls: list[tuple[list[str], EmbeddingInputType]] = []

    def embed(
        self,
        texts: list[str],
        input_type: EmbeddingInputType,
    ) -> ProviderEmbeddingResult:
        self.calls.append((texts, input_type))
        if len(self.calls) <= self.failures:
            raise EmbeddingProviderError("simulated timeout", retryable=True)
        count = len(texts) - 1 if self.wrong_count else len(texts)
        return ProviderEmbeddingResult(
            vectors=[[float(index)] * self.dimension for index in range(count)],
            token_usage=len(texts),
        )


def _service(monkeypatch, provider: BaseEmbeddingProvider) -> EmbeddingService:
    """创建测试服务并设置小批大小。"""
    monkeypatch.setattr(settings, "EMBEDDING_PROVIDER", "fake")
    monkeypatch.setattr(settings, "EMBEDDING_DIMENSION", 3)
    monkeypatch.setattr(settings, "EMBEDDING_BATCH_SIZE", 2)
    monkeypatch.setattr(settings, "EMBEDDING_MAX_RETRIES", 0)
    return EmbeddingService(providers={"fake": provider})


def test_embed_query_uses_query_input_type(monkeypatch) -> None:
    """查询向量应通过统一Provider并标记query用途。"""
    provider = FakeEmbeddingProvider()
    service = _service(monkeypatch, provider)

    result = service.embed_query("报销标准是什么？")

    assert len(result.vectors) == 1
    assert provider.calls == [(["报销标准是什么？"], EmbeddingInputType.QUERY)]
    assert result.dimension == 3


def test_embed_documents_batches_and_preserves_order(monkeypatch) -> None:
    """文档向量应按配置拆批且保持返回顺序。"""
    provider = FakeEmbeddingProvider()
    service = _service(monkeypatch, provider)

    result = service.embed_documents(["第一条", "第二条", "第三条"])

    assert [call[0] for call in provider.calls] == [["第一条", "第二条"], ["第三条"]]
    assert result.vectors == [[0.0, 0.0, 0.0], [1.0, 1.0, 1.0], [0.0, 0.0, 0.0]]
    assert result.token_usage == 3


def test_embed_chunks_returns_identity_without_persistence(monkeypatch) -> None:
    """Chunk适配接口只返回向量结果，不触碰数据库或Qdrant。"""
    service = _service(monkeypatch, FakeEmbeddingProvider())
    chunks = [EmbeddingChunkInput(chunk_id=7, chunk_text="制度内容", content_hash="a" * 64)]

    result = service.embed_chunks(chunks)

    assert result == [
        EmbeddedChunk(
            chunk_id=7,
            vector=[0.0, 0.0, 0.0],
            provider="fake",
            model=settings.EMBEDDING_MODEL,
            dimension=3,
            content_hash="a" * 64,
        )
    ]


def test_embed_rejects_empty_input_and_text(monkeypatch) -> None:
    """空列表和空文本必须显式失败。"""
    service = _service(monkeypatch, FakeEmbeddingProvider())

    with pytest.raises(EmbeddingInputError):
        service.embed(EmbeddingRequest())
    with pytest.raises(EmbeddingInputError):
        service.embed_documents(["  "])


def test_embed_rejects_count_mismatch_without_retry(monkeypatch) -> None:
    """供应商返回数量错误时整体失败且不伪造结果。"""
    provider = FakeEmbeddingProvider(wrong_count=True)
    service = _service(monkeypatch, provider)

    with pytest.raises(EmbeddingError, match="返回数量不一致"):
        service.embed_documents(["第一条", "第二条"])

    assert len(provider.calls) == 1


def test_embed_rejects_vector_dimension_mismatch(monkeypatch) -> None:
    """实际向量维度必须严格等于配置维度。"""
    service = _service(monkeypatch, FakeEmbeddingProvider(dimension=2))

    with pytest.raises(EmbeddingError, match="维度不一致"):
        service.embed_documents(["制度内容"])


def test_embed_rejects_non_finite_values(monkeypatch) -> None:
    """NaN和无穷值不能进入后续向量数据库。"""

    class NonFiniteProvider(FakeEmbeddingProvider):
        def embed(self, texts, input_type):
            return ProviderEmbeddingResult(vectors=[[float("nan"), 0.0, 1.0]])

    service = _service(monkeypatch, NonFiniteProvider())

    with pytest.raises(EmbeddingError, match="非有限数值"):
        service.embed_documents(["制度内容"])


def test_embed_rejects_overlong_text(monkeypatch) -> None:
    """超过显式字符限制的文本不得静默截断。"""
    service = _service(monkeypatch, FakeEmbeddingProvider())
    monkeypatch.setattr(settings, "EMBEDDING_MAX_TEXT_CHARS", 3)

    with pytest.raises(EmbeddingInputError, match="超过长度限制"):
        service.embed_documents(["超过三个字符"])


def test_provider_failure_has_finite_retries(monkeypatch) -> None:
    """超时只按配置进行有限重试。"""
    provider = FakeEmbeddingProvider(failures=3)
    service = _service(monkeypatch, provider)
    monkeypatch.setattr(settings, "EMBEDDING_MAX_RETRIES", 2)
    service.sleep_fn = lambda _: None

    with pytest.raises(EmbeddingProviderError, match="simulated timeout"):
        service.embed_documents(["制度内容"])

    assert len(provider.calls) == 3


def test_non_retryable_provider_error_is_not_retried(monkeypatch) -> None:
    """认证、参数等不可重试错误应立即失败。"""

    class BadRequestProvider(FakeEmbeddingProvider):
        def embed(self, texts, input_type):
            self.calls.append((texts, input_type))
            raise EmbeddingProviderError("bad request", retryable=False)

    provider = BadRequestProvider()
    service = _service(monkeypatch, provider)
    monkeypatch.setattr(settings, "EMBEDDING_MAX_RETRIES", 3)

    with pytest.raises(EmbeddingProviderError, match="bad request"):
        service.embed_documents(["制度内容"])

    assert len(provider.calls) == 1


def test_later_batch_failure_returns_no_partial_result(monkeypatch) -> None:
    """任意后续批次失败时整个调用必须失败。"""

    class SecondBatchFailureProvider(FakeEmbeddingProvider):
        def embed(self, texts, input_type):
            self.calls.append((texts, input_type))
            if len(self.calls) == 2:
                raise EmbeddingProviderError("second batch failed", retryable=False)
            return ProviderEmbeddingResult(vectors=[[0.0, 0.0, 0.0] for _ in texts])

    provider = SecondBatchFailureProvider()
    service = _service(monkeypatch, provider)

    with pytest.raises(EmbeddingProviderError, match="second batch failed"):
        service.embed_documents(["第一条", "第二条", "第三条"])

    assert len(provider.calls) == 2


def test_provider_error_does_not_log_text_or_api_key(monkeypatch, caplog) -> None:
    """失败日志只包含批次元数据，不包含正文或密钥。"""
    provider = FakeEmbeddingProvider(failures=1)
    service = _service(monkeypatch, provider)
    monkeypatch.setattr(settings, "EMBEDDING_MAX_RETRIES", 0)
    secret = "test-embedding-secret"
    caplog.set_level("WARNING")

    with pytest.raises(EmbeddingProviderError):
        service.embed_documents([secret])

    assert secret not in caplog.text


def test_bailian_provider_uses_configured_model_and_dimensions(monkeypatch) -> None:
    """百炼Provider应通过兼容接口发送配置的模型和维度。"""
    captured: dict[str, object] = {}

    class FakeEmbeddings:
        def create(self, **payload):
            captured.update(payload)
            return SimpleNamespace(
                data=[
                    SimpleNamespace(index=1, embedding=[0.4, 0.5, 0.6]),
                    SimpleNamespace(index=0, embedding=[0.1, 0.2, 0.3]),
                ],
                usage=SimpleNamespace(total_tokens=8),
            )

    class FakeClient:
        embeddings = FakeEmbeddings()

    provider = BailianEmbeddingProvider()
    monkeypatch.setattr(settings, "EMBEDDING_API_KEY", "test-key")
    monkeypatch.setattr(settings, "EMBEDDING_MODEL", "text-embedding-v4")
    monkeypatch.setattr(settings, "EMBEDDING_DIMENSION", 3)
    monkeypatch.setattr(provider, "_build_client", lambda: FakeClient())

    result = provider.embed_documents(["第一条", "第二条"])

    assert result.vectors == [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]
    assert captured["model"] == "text-embedding-v4"
    assert captured["dimensions"] == 3
    assert "input" in captured
    assert "input_type" not in captured
    assert "extra_body" not in captured


@pytest.mark.parametrize("trust_env", [False, True])
def test_bailian_client_receives_http_settings_and_is_reused(
    monkeypatch,
    caplog,
    trust_env: bool,
) -> None:
    """HTTP客户端应显式控制环境代理并在多个调用间复用连接池。"""
    constructor_calls: list[dict[str, object]] = []
    http_client_calls: list[dict[str, object]] = []
    http_client = object()

    class FakeEmbeddings:
        def create(self, **payload):
            return SimpleNamespace(
                data=[SimpleNamespace(index=0, embedding=[0.1, 0.2, 0.3])],
                usage=None,
            )

    class FakeClient:
        embeddings = FakeEmbeddings()

    def fake_openai(**kwargs):
        constructor_calls.append(kwargs)
        return FakeClient()

    def fake_http_client(**kwargs):
        http_client_calls.append(kwargs)
        return http_client

    monkeypatch.setattr("app.ai.embeddings.bailian.OpenAI", fake_openai)
    monkeypatch.setattr("app.ai.embeddings.bailian.httpx.Client", fake_http_client)
    secret = "test-embedding-secret"
    text = "sensitive embedding text"
    monkeypatch.setattr(settings, "EMBEDDING_API_KEY", secret)
    monkeypatch.setattr(settings, "EMBEDDING_TIMEOUT_SECONDS", 17)
    monkeypatch.setattr(settings, "EMBEDDING_TRUST_ENV", trust_env)
    monkeypatch.setattr(settings, "EMBEDDING_DIMENSION", 3)
    caplog.set_level("INFO")
    provider = BailianEmbeddingProvider()

    provider.embed_query(text)
    provider.embed_query("第二条")

    assert len(constructor_calls) == 1
    assert http_client_calls == [{"trust_env": trust_env}]
    assert constructor_calls[0]["timeout"] == 17
    assert constructor_calls[0]["max_retries"] == 0
    assert constructor_calls[0]["base_url"] == settings.EMBEDDING_BASE_URL
    assert constructor_calls[0]["http_client"] is http_client
    assert secret not in caplog.text
    assert text not in caplog.text


@pytest.mark.parametrize(
    ("status_code", "retryable"),
    [
        (400, False),
        (401, False),
        (404, False),
        (408, True),
        (409, True),
        (429, True),
        (500, True),
        (503, True),
    ],
)
def test_bailian_provider_classifies_http_status_for_retry(
    status_code: int,
    retryable: bool,
) -> None:
    """仅限流、冲突、超时和服务端错误允许重试。"""
    response = httpx.Response(
        status_code,
        request=httpx.Request("POST", settings.EMBEDDING_BASE_URL),
    )
    error = APIStatusError("simulated status", response=response, body=None)

    converted = BailianEmbeddingProvider._provider_error(error)

    assert converted.retryable is retryable


def test_bailian_provider_extracts_safe_server_error_fields() -> None:
    """供应商错误只保留脱敏后的短字段，不泄露请求凭据或正文。"""
    secret = "super-secret-api-key"
    response = httpx.Response(
        400,
        headers={"x-request-id": "req-400-safe"},
        request=httpx.Request("POST", settings.EMBEDDING_BASE_URL),
    )
    error = APIStatusError(
        "simulated status",
        response=response,
        body={
            "error": {
                "code": "InvalidParameter",
                "message": (
                    f"Authorization: Bearer {secret}; api_key={secret}; "
                    "https://example.test/embeddings?token=hidden "
                    'input="员工出差住宿报销须提交发票"'
                ),
            }
        },
    )

    converted = BailianEmbeddingProvider._provider_error(error)

    assert converted.status_code == 400
    assert converted.provider_code == "InvalidParameter"
    assert converted.request_id == "req-400-safe"
    assert "Authorization: [REDACTED]" in (converted.provider_message or "")
    assert secret not in str(converted)
    assert secret not in (converted.provider_message or "")
    assert "员工出差住宿报销须提交发票" not in (converted.provider_message or "")
    assert "token=hidden" not in (converted.provider_message or "")


def test_bailian_provider_handles_missing_error_body() -> None:
    """没有服务端正文时保留状态码，结构化详情为空。"""
    response = httpx.Response(
        400,
        request=httpx.Request("POST", settings.EMBEDDING_BASE_URL),
    )
    error = APIStatusError("simulated status", response=response, body=None)

    converted = BailianEmbeddingProvider._provider_error(error)

    assert converted.status_code == 400
    assert converted.provider_code is None
    assert converted.provider_message is None
    assert converted.request_id is None


def test_bailian_provider_limits_server_error_fields() -> None:
    """服务端诊断字段必须有固定长度上限。"""
    response = httpx.Response(
        400,
        headers={"request-id": "req-limit"},
        request=httpx.Request("POST", settings.EMBEDDING_BASE_URL),
    )
    error = APIStatusError(
        "simulated status",
        response=response,
        body={"code": "c" * 300, "message": "m" * 2000},
    )

    converted = BailianEmbeddingProvider._provider_error(error)

    assert converted.provider_code == "c" * 128
    assert converted.provider_message == "m" * 512
    assert converted.request_id == "req-limit"


def test_bailian_provider_captures_multilevel_connection_chain() -> None:
    """连接异常链只保留类型和系统错误码。"""
    request = httpx.Request("POST", settings.EMBEDDING_BASE_URL)
    system_error = OSError(10061, "Authorization: Bearer secret-token")
    transport_error = httpx.ConnectError(
        "https://example.test/embeddings?api_key=secret-token",
        request=request,
    )
    transport_error.__cause__ = system_error
    error = APIConnectionError(request=request)
    error.__cause__ = transport_error

    converted = BailianEmbeddingProvider._provider_error(error)

    assert [item.exception_type for item in converted.connection_diagnostics] == [
        "APIConnectionError",
        "ConnectError",
        "ConnectionRefusedError",
    ]
    assert converted.connection_diagnostics[-1].errno == 10061
    assert "secret-token" not in str(converted.connection_diagnostics)
    assert "example.test" not in str(converted.connection_diagnostics)


def test_bailian_provider_captures_windows_error_code() -> None:
    """Windows错误码应独立保留，不依赖异常原文。"""
    request = httpx.Request("POST", settings.EMBEDDING_BASE_URL)
    system_error = OSError("sensitive proxy credential")
    system_error.winerror = 10060
    error = APIConnectionError(request=request)
    error.__cause__ = system_error

    converted = BailianEmbeddingProvider._provider_error(error)

    assert converted.connection_diagnostics[-1].winerror == 10060
    assert "sensitive proxy credential" not in str(converted.connection_diagnostics)


@pytest.mark.parametrize(
    ("timeout_type", "expected_stage"),
    [
        (httpx.ConnectTimeout, "connect"),
        (httpx.ReadTimeout, "read"),
        (httpx.WriteTimeout, "write"),
        (httpx.PoolTimeout, "pool"),
    ],
)
def test_bailian_provider_captures_timeout_stage(timeout_type, expected_stage) -> None:
    """仅HTTPX明确区分的超时类型应映射到具体阶段。"""
    request = httpx.Request("POST", settings.EMBEDDING_BASE_URL)
    timeout_error = timeout_type("sensitive timeout detail", request=request)
    error = APITimeoutError(request)
    error.__cause__ = timeout_error

    converted = BailianEmbeddingProvider._provider_error(error)

    assert converted.connection_diagnostics[0].timeout_stage is None
    assert converted.connection_diagnostics[1].timeout_stage == expected_stage
    assert "sensitive timeout detail" not in str(converted.connection_diagnostics)


def test_bailian_provider_deduplicates_circular_exception_chain() -> None:
    """异常链存在循环时应终止遍历且每个对象只记录一次。"""
    request = httpx.Request("POST", settings.EMBEDDING_BASE_URL)
    first = httpx.ConnectError("first secret", request=request)
    second = OSError("second secret")
    first.__cause__ = second
    second.__context__ = first
    error = APIConnectionError(request=request)
    error.__cause__ = first

    converted = BailianEmbeddingProvider._provider_error(error)

    assert [item.exception_type for item in converted.connection_diagnostics] == [
        "APIConnectionError",
        "ConnectError",
        "OSError",
    ]


def test_connection_diagnostics_log_only_safe_fields(monkeypatch, caplog) -> None:
    """最终失败日志不得包含连接异常原文、输入或密钥。"""
    request = httpx.Request("POST", settings.EMBEDDING_BASE_URL)
    secret = "secret-input-and-key"
    system_error = OSError(10061, f"Authorization: Bearer {secret}")
    system_error.winerror = 10061
    timeout_error = httpx.ConnectTimeout(
        f"https://example.test/embeddings?token={secret}",
        request=request,
    )
    timeout_error.__cause__ = system_error
    sdk_error = APITimeoutError(request)
    sdk_error.__cause__ = timeout_error
    converted = BailianEmbeddingProvider._provider_error(sdk_error)

    class DiagnosticProvider(FakeEmbeddingProvider):
        def embed(self, texts, input_type):
            self.calls.append((texts, input_type))
            raise converted

    service = _service(monkeypatch, DiagnosticProvider())
    caplog.set_level("WARNING")

    with pytest.raises(EmbeddingProviderError):
        service.embed_query(secret)

    assert "APIConnectionError" not in caplog.text
    assert "APITimeoutError" in caplog.text
    assert "ConnectTimeout" in caplog.text
    assert "10061" in caplog.text
    assert "connect" in caplog.text
    assert secret not in caplog.text
    assert "example.test" not in caplog.text


def test_bailian_provider_requires_api_key(monkeypatch) -> None:
    """未配置Embedding密钥时不应发起请求。"""
    provider = BailianEmbeddingProvider()
    monkeypatch.setattr(settings, "EMBEDDING_API_KEY", "")
    monkeypatch.setattr(settings, "QWEN_API_KEY", "")

    with pytest.raises(EmbeddingConfigurationError):
        provider.embed_documents(["制度内容"])
