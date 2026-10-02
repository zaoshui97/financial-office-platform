"""HTTP 中间件：负责跨域、请求追踪、访问日志和沙箱熔断拦截。"""

import time
from collections.abc import Awaitable, Callable
from uuid import uuid4

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.logging import get_logger, request_id_context

logger = get_logger(__name__)


# ---- Sandbox Kill-Switch 中间件 ----------------------------------------------


class SandboxKillSwitchMiddleware(BaseHTTPMiddleware):
    """FastAPI 中间件：拦截 /api/v1/compliance/sandbox/* 请求做 Kill Switch 检查。

    设计意图：
    - 最快拦截（HTTP 层，不进业务逻辑）
    - 比 service 层更早拒绝，减少资源浪费
    - 与 service.check_text 内的守卫形成双层防护
    """

    # 沙箱路径前缀（精确匹配，防止误拦截其他 API）
    SANDBOX_PATH_PREFIX = "/api/v1/compliance/sandbox/"

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        if not request.url.path.startswith(self.SANDBOX_PATH_PREFIX):
            return await call_next(request)

        # 延迟导入避免循环依赖
        from app.sandbox.kill_switch import kill_switch

        if kill_switch.is_active():
            from datetime import datetime, timezone
            from fastapi.responses import JSONResponse

            ks_reason = kill_switch.reason
            logger.warning(
                "中间件层 KillSwitch 拦截 | path=%s reason=%s",
                request.url.path,
                ks_reason,
            )
            return JSONResponse(
                status_code=503,
                content={
                    "error_code": "SANDBOX_KILLED",
                    "message": "合规沙箱已熔断，请稍后重试",
                    "fallback": "none",
                    "kill_switch_reason": ks_reason,
                    "timestamp": datetime.now(tz=timezone.utc).isoformat(),
                },
            )

        return await call_next(request)


class RequestContextMiddleware(BaseHTTPMiddleware):
    """为每个请求建立 request_id，并记录访问耗时。"""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid4())
        request.state.request_id = request_id
        context_token = request_id_context.set(request_id)
        started_at = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception:
            logger.exception("请求处理失败 | method=%s path=%s", request.method, request.url.path)
            raise
        finally:
            duration_ms = (time.perf_counter() - started_at) * 1000
            logger.info(
                "请求完成 | method=%s path=%s duration_ms=%.2f",
                request.method,
                request.url.path,
                duration_ms,
            )
            request_id_context.reset(context_token)

        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = f"{duration_ms:.2f}ms"
        return response


def setup_middleware(app: FastAPI) -> None:
    """按统一顺序注册应用中间件。

    注册顺序（后注册先执行）：
    1. SandboxKillSwitchMiddleware — 最快拦截沙箱请求
    2. RequestContextMiddleware    — 请求上下文
    3. CORSMiddleware             — 跨域
    """
    app.add_middleware(SandboxKillSwitchMiddleware)
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
        allow_methods=settings.CORS_ALLOW_METHODS,
        allow_headers=settings.CORS_ALLOW_HEADERS,
    )
