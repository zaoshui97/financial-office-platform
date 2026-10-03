"""全局API路由聚合。"""

from fastapi import APIRouter

from app.ai.router import router as ai_router
from app.core.config import settings
from app.features.auth.router import router as auth_router
from app.features.blackboard.router import router as blackboard_router
from app.features.chat.router import router as chat_router
from app.features.compliance.router import router as compliance_router
from app.features.meeting.router import router as meeting_router
from app.features.rag.router import router as rag_router
from app.features.system.router import router as system_router

api_router = APIRouter(prefix=settings.API_V1_PREFIX)
api_router.include_router(system_router)
api_router.include_router(auth_router)
api_router.include_router(rag_router)
api_router.include_router(chat_router)
api_router.include_router(compliance_router)
api_router.include_router(blackboard_router)
api_router.include_router(meeting_router)
api_router.include_router(ai_router)
