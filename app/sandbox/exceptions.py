"""沙箱领域异常。

层级：
  SandboxError
  ├── SandboxUnavailable   — 熔断 / 降级 / 离线（HTTP 503）
  ├── SandboxConfigError   — 配置错误（HTTP 500）
  └── SandboxLLMError     — LLM 调用失败（HTTP 502）
"""

from __future__ import annotations

from typing import Any


class SandboxError(Exception):
    """沙箱基础异常。"""

    def __init__(
        self,
        message: str,
        *,
        error_code: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.error_code = error_code or type(self).__name__
        self.details = details or {}


class SandboxUnavailable(SandboxError):
    """沙箱不可用（Kill Switch / 降级策略 / 离线）。"""

    def __init__(
        self,
        message: str,
        *,
        error_code: str = "SANDBOX_UNAVAILABLE",
        audit_id: int | None = None,
        kill_switch_reason: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(
            message,
            error_code=error_code,
            details={
                **(details or {}),
                "audit_id": audit_id,
                "kill_switch_reason": kill_switch_reason,
            },
        )
        self.audit_id = audit_id
        self.kill_switch_reason = kill_switch_reason


class SandboxConfigError(SandboxError):
    """沙箱配置错误（Provider 白名单为空、内网 URL 配置异常）。"""

    def __init__(
        self,
        message: str,
        *,
        error_code: str = "SANDBOX_CONFIG_ERROR",
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message, error_code=error_code, details=details)


class SandboxLLMError(SandboxError):
    """LLM Provider 调用失败（超时 / 鉴权 / 配额）。"""

    def __init__(
        self,
        message: str,
        *,
        error_code: str = "SANDBOX_LLM_ERROR",
        provider: str | None = None,
        model: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(
            message,
            error_code=error_code,
            details={
                **(details or {}),
                "provider": provider,
                "model": model,
            },
        )
        self.provider = provider
        self.model = model


__all__ = [
    "SandboxError",
    "SandboxUnavailable",
    "SandboxConfigError",
    "SandboxLLMError",
]
