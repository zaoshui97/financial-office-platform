"""HTTP 中间件：负责跨域、请求追踪和访问日志。"""

import time
from collections.abc import Awaitable, Callable
from uuid import uuid4

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.logging import get_logger, request_id_context

logger = get_logger(__name__)


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
    """按统一顺序注册应用中间件。"""
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
        allow_methods=settings.CORS_ALLOW_METHODS,
        allow_headers=settings.CORS_ALLOW_HEADERS,
    )
