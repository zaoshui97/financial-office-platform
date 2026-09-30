"""FastAPI应用工厂：统一装配路由、中间件和生命周期。"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import __version__
from app.api.router import api_router
from app.core.config import settings
from app.core.database import check_database_connection, dispose_database_engine
from app.core.exceptions import register_exception_handlers
from app.core.logging import get_logger, setup_logging
from app.core.middleware import setup_middleware
from app.core.swagger import register_swagger_routes

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None, None]:
    """执行启动检查，并在关闭时释放数据库连接。"""
    setup_logging()
    logger.info(
        "应用启动 | name=%s version=%s environment=%s",
        settings.APP_NAME,
        __version__,
        settings.APP_ENV.value,
    )
    if settings.DATABASE_CHECK_ON_STARTUP:
        check_database_connection()

    yield

    dispose_database_engine()
    logger.info("应用关闭 | name=%s", settings.APP_NAME)


def create_app() -> FastAPI:
    """创建可独立测试的FastAPI应用。"""
    application = FastAPI(
        title=settings.APP_NAME,
        version=__version__,
        description="金融企业智能办公提效平台后端API",
        docs_url=None,
        redoc_url="/redoc" if settings.DEBUG else None,
        openapi_url="/openapi.json" if settings.DEBUG else None,
        lifespan=lifespan,
    )
    setup_middleware(application)
    register_exception_handlers(application)
    application.include_router(api_router)
    if settings.DEBUG:
        register_swagger_routes(application)
    return application