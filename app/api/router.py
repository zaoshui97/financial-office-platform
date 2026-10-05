"""全局API路由聚合。"""

from fastapi import APIRouter

from app.ai.router import router as ai_router
from app.core.config import settings
from app.features.auth.router import router as auth_router
from app.features.blackboard.router import router as blackboard_router
from app.features.chat.router import router as chat_router
from app.features.compliance.router import router as compliance_router
from app.features.decision.router import router as decision_router
from app.features.meeting.router import router as meeting_router
from app.features.office.router import router as office_router
from app.features.organization.router import router as organization_router
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
# === 亮点三 + 多租户隔离（答辩包装价值高） ===
api_router.include_router(organization_router)  # 机构/部门/业务/客户
api_router.include_router(office_router)         # 模板 + AI 生成
api_router.include_router(decision_router)       # 法规 + 资讯 + 决策回放