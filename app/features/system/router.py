"""系统存活和数据库就绪检查接口。"""

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from app import __version__
from app.core.config import settings
from app.core.database import check_database_connection

router = APIRouter(prefix="/system", tags=["系统"])


@router.get("/health/live", summary="存活检查")
def liveness() -> dict[str, object]:
    """返回服务进程存活状态，不访问外部依赖。"""
    return {
        "status": "alive",
        "service": settings.APP_NAME,
        "version": __version__,
    }


@router.get("/health/ready", summary="就绪检查", response_model=None)
def readiness() -> dict[str, str] | JSONResponse:
    """验证MySQL连接是否可用。"""
    try:
        check_database_connection()
    except Exception:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "not_ready", "database": "disconnected"},
        )
    return {"status": "ready", "database": "connected"}