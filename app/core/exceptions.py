"""全局兜底异常处理，HTTP和参数异常继续使用FastAPI默认格式。"""

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.core.logging import get_logger

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
    app.add_exception_handler(Exception, unhandled_exception_handler)