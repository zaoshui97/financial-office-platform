"""OpenAI Compatible API Provider，统一承载兼容协议模型。"""

import json
import math
from collections.abc import Iterator
from typing import Any

from openai import OpenAI

from app.ai.exceptions import AIConfigurationError, AIProviderError
from app.ai.model_router import ModelProfile, ProviderConfig
from app.ai.providers.base import BaseLLMProvider
from app.ai.schemas import AIRequest, AIResponse, TokenUsage
from app.core.config import settings


class OpenAICompatibleProvider(BaseLLMProvider):
    """通过OpenAI SDK调用兼容Chat Completions或Responses的服务。"""

    def _client(self, provider: ProviderConfig) -> OpenAI:
        """按Provider配置创建客户端。"""
        if not provider.api_key:
            raise AIConfigurationError(
                f"Provider {provider.name} 未配置API密钥环境变量: {provider.api_key_env}"
            )
        return OpenAI(
            api_key=provider.api_key,
            base_url=provider.base_url,
            timeout=provider.timeout_seconds,
            max_retries=provider.max_retries,
        )

    @staticmethod
    def _prepare_request(request: AIRequest, provider: ProviderConfig) -> AIRequest:
        """校验能力并为联网搜索注入默认工具。"""
        if request.need_web_search and provider.api_style != "responses":
            raise AIConfigurationError(
                f"Provider {provider.name} 的API风格不支持联网搜索: {provider.api_style}"
            )
        if request.need_web_search and not request.tools:
            return request.model_copy(
                update={
                    "tools": [
                        {
                            "type": "web_search",
                            "max_keyword": settings.AI_WEB_SEARCH_MAX_KEYWORD,
                        }
                    ]
                }
            )
        return request

    @staticmethod
    def _usage(response: Any) -> TokenUsage:
        """提取两种API风格的Token字段。"""
        usage = getattr(response, "usage", None)
        if usage is None:
            return TokenUsage()
        prompt = getattr(usage, "prompt_tokens", None)
        if prompt is None:
            prompt = getattr(usage, "input_tokens", 0)
        completion = getattr(usage, "completion_tokens", None)
        if completion is None:
            completion = getattr(usage, "output_tokens", 0)
        total = getattr(usage, "total_tokens", 0)
        return TokenUsage(
            prompt_tokens=int(prompt or 0),
            completion_tokens=int(completion or 0),
            total_tokens=int(total or 0),
        )

    @staticmethod
    def _response_text(response: Any) -> str:
        """兼容Responses output_text和嵌套message内容。"""
        output_text = getattr(response, "output_text", None)
        if output_text:
            return str(output_text).strip()

        text_parts: list[str] = []
        for output_item in getattr(response, "output", []) or []:
            for content_item in getattr(output_item, "content", []) or []:
                text = getattr(content_item, "text", None)
                if text:
                    text_parts.append(str(text))
        return "\n".join(text_parts).strip()

    @staticmethod
    def _empty_response_detail(response: Any) -> str:
        """提取Responses未生成最终文本时的状态和截断原因。"""
        status = getattr(response, "status", None) or "unknown"
        incomplete_details = getattr(response, "incomplete_details", None)
        reason = getattr(incomplete_details, "reason", None) or "unknown"
        return f"status={status}, reason={reason}"

    def _responses(
        self,
        request: AIRequest,
        profile: ModelProfile,
        provider: ProviderConfig,
    ) -> AIResponse:
        """调用Responses API。"""
        payload: dict[str, Any] = {
            "model": profile.model,
            "input": request.messages,
        }
        if request.instructions:
            payload["instructions"] = request.instructions
        if request.tools:
            payload["tools"] = request.tools
        if request.max_tokens:
            payload["max_output_tokens"] = request.max_tokens

        response = self._client(provider).responses.create(**payload)
        text = self._response_text(response)
        if not text:
            detail = self._empty_response_detail(response)
            raise AIProviderError(f"Provider {provider.name} 未返回有效文本 ({detail})")
        return AIResponse(
            text=text,
            provider=provider.name,
            model=profile.model,
            usage=self._usage(response),
            response_id=getattr(response, "id", None),
        )

    def _chat_completions(
        self,
        request: AIRequest,
        profile: ModelProfile,
        provider: ProviderConfig,
    ) -> AIResponse:
        """调用Chat Completions API。"""
        messages = list(request.messages)
        if request.instructions:
            messages.insert(0, {"role": "system", "content": request.instructions})
        payload: dict[str, Any] = {
            "model": profile.model,
            "messages": messages,
            "temperature": profile.temperature,
        }
        if request.tools:
            payload["tools"] = request.tools
        if request.max_tokens:
            payload["max_tokens"] = request.max_tokens

        response = self._client(provider).chat.completions.create(**payload)
        text = (response.choices[0].message.content or "").strip()
        if not text:
            raise AIProviderError(f"Provider {provider.name} 未返回有效文本")
        return AIResponse(
            text=text,
            provider=provider.name,
            model=profile.model,
            usage=self._usage(response),
            response_id=getattr(response, "id", None),
        )

    def chat(
        self,
        request: AIRequest,
        profile: ModelProfile,
        provider: ProviderConfig,
    ) -> AIResponse:
        """根据配置选择Responses或Chat Completions调用。"""
        request_for_provider = self._prepare_request(request, provider)

        try:
            if provider.api_style == "responses":
                return self._responses(request_for_provider, profile, provider)
            return self._chat_completions(request_for_provider, profile, provider)
        except (AIConfigurationError, AIProviderError):
            raise
        except Exception as exc:
            if "ToolNotOpen" in str(exc):
                raise AIProviderError(
                    "联网搜索未开通，请先在火山方舟控制台开通内容插件"
                ) from exc
            raise AIProviderError(
                f"Provider {provider.name} 调用失败: {type(exc).__name__}"
            ) from exc

    def stream_chat(
        self,
        request: AIRequest,
        profile: ModelProfile,
        provider: ProviderConfig,
    ) -> Iterator[str]:
        """使用兼容协议逐段返回模型文本。"""
        try:
            request = self._prepare_request(request, provider)
            if provider.api_style == "responses":
                payload: dict[str, Any] = {
                    "model": profile.model,
                    "input": request.messages,
                    "stream": True,
                }
                if request.instructions:
                    payload["instructions"] = request.instructions
                if request.max_tokens:
                    payload["max_output_tokens"] = request.max_tokens
                if request.tools:
                    payload["tools"] = request.tools
                for event in self._client(provider).responses.create(**payload):
                    if getattr(event, "type", None) == "response.output_text.delta":
                        delta = getattr(event, "delta", None)
                        if delta:
                            yield str(delta)
                return

            messages = list(request.messages)
            if request.instructions:
                messages.insert(0, {"role": "system", "content": request.instructions})
            payload = {
                "model": profile.model,
                "messages": messages,
                "temperature": profile.temperature,
                "stream": True,
            }
            if request.max_tokens:
                payload["max_tokens"] = request.max_tokens
            if request.tools:
                payload["tools"] = request.tools
            for chunk in self._client(provider).chat.completions.create(**payload):
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta.content
                if delta:
                    yield str(delta)
        except (AIConfigurationError, AIProviderError):
            raise
        except Exception as exc:
            raise AIProviderError(
                f"Provider {provider.name} 流式调用失败: {type(exc).__name__}"
            ) from exc

    def count_tokens(self, request: AIRequest) -> int:
        """无厂商Tokenizer时使用中英文混合文本的保守估算。"""
        serialized = json.dumps(
            {
                "instructions": request.instructions,
                "messages": request.messages,
                "tools": request.tools,
            },
            ensure_ascii=False,
        )
        ascii_count = sum(character.isascii() for character in serialized)
        non_ascii_count = len(serialized) - ascii_count
        return max(1, math.ceil(ascii_count / 4) + non_ascii_count)
