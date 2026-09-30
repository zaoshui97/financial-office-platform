"""全局API路由聚合。"""

from fastapi import APIRouter

from app.core.config import settings
from app.features.auth.router import router as auth_router
from app.features.chat.router import router as chat_router
from app.features.rag.router import router as rag_router
from app.features.system.router import router as system_router

api_router = APIRouter(prefix=settings.API_V1_PREFIX)
api_router.include_router(system_router)
api_router.include_router(auth_router)
api_router.include_router(rag_router)
api_router.include_router(chat_router)
