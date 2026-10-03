"""全局兜底异常处理：HTTPException 统一返回带 code 字段，5xx 隐藏细节。"""

from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.logging import get_logger
from app.sandbox.exceptions import SandboxUnavailable

logger = get_logger(__name__)


# HTTPException status_code → 业务错误码（前端可识别）
_STATUS_CODE_MAP: dict[int, str] = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    409: "conflict",
    422: "validation_error",
    429: "rate_limited",
    500: "internal_error",
    502: "bad_gateway",
    503: "service_unavailable",
}


async def http_exception_handler(
    request: Request, exc: HTTPException
) -> JSONResponse:
    """统一 HTTPException → {code, detail, status} JSON 响应。

    401 额外带 WWW-Authenticate header 触发前端跳登录。
    业务 detail 字段保持原样透传给前端。
    """
    code = _STATUS_CODE_MAP.get(exc.status_code, f"http_{exc.status_code}")
    body: dict = {
        "code": code,
        "detail": exc.detail if exc.detail is not None else "",
        "status": exc.status_code,
    }
    headers = dict(getattr(exc, "headers", None) or {})
    return JSONResponse(
        status_code=exc.status_code,
        content=body,
        headers=headers,
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """FastAPI 参数校验失败（422）→ 统一格式 + 第一条错误详情。"""
    errs = exc.errors()
    first_msg = ""
    if errs:
        first = errs[0]
        loc = ".".join(str(x) for x in first.get("loc", []))
        first_msg = f"{loc}: {first.get('msg', '')}"
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "code": "validation_error",
            "detail": first_msg or "参数校验失败",
            "status": 422,
            "errors": errs,
        },
    )


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
        content={
            "code": "internal_error",
            "detail": "服务器内部错误",
            "status": 500,
        },
    )


def register_exception_handlers(app: FastAPI) -> None:
    """注册应用级异常处理器：HTTPException / Validation / 全局兜底 / 沙箱。"""
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
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
        "code": exc.error_code,
        "detail": exc.message,
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