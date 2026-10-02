"""全局兜底异常处理，HTTP和参数异常继续使用FastAPI默认格式。"""

from datetime import datetime, timezone

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.core.logging import get_logger
from app.sandbox.exceptions import SandboxUnavailable

logger = get_logger(__name__)


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """记录未捕获异常并隐藏内部实现信息。"""
    logger.exception(
        "未处理异常 | method=%s path=%s error=%s",
        request.method,
        request.url.path,
        exc,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "服务器内部错误"},
    )


def register_exception_handlers(app: FastAPI) -> None:
    """注册应用级兜底异常处理器。"""
    app.add_exception_handler(SandboxUnavailable, sandbox_unavailable_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)


async def sandbox_unavailable_handler(request: Request, exc: SandboxUnavailable) -> JSONResponse:
    """处理沙箱不可用异常（Kill Switch / 降级），返回 503。"""
    logger.warning(
        "沙箱不可用 | error_code=%s audit_id=%s ks_reason=%s path=%s",
        exc.error_code,
        exc.audit_id,
        exc.kill_switch_reason,
        request.url.path,
    )
    body = {
        "error_code": exc.error_code,
        "message": exc.message,
        "fallback": "none",
        "audit_id": exc.audit_id,
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
    }
    if exc.kill_switch_reason:
        body["kill_switch_reason"] = exc.kill_switch_reason
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content=body,
    )