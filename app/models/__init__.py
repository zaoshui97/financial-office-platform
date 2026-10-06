"""应用层所有 SQLAlchemy 模型。

alembic 迁移、以及任何需要扫描所有已注册模型的代码，都应从
此处导入 Base.metadata，而非直接引用各 feature 模块。

导入顺序（字母序）：agent → approval → auth → blackboard → chat →
    compliance → dashboard → decision → im → meeting → notification →
    office → organization → rag → system
"""

from app.core.database import Base  # noqa: F401

# 导入所有 feature 模型（alembic autogenerate 依赖这些 import）
from app.features.agent import models as agent_models  # noqa: F401
from app.features.approval import models as approval_models  # noqa: F401
from app.features.auth import models as auth_models  # noqa: F401
from app.features.blackboard import models as blackboard_models  # noqa: F401
from app.features.chat import models as chat_models  # noqa: F401
from app.features.compliance import models as compliance_models  # noqa: F401
from app.features.dashboard import models as dashboard_models  # noqa: F401
from app.features.decision import models as decision_models  # noqa: F401
from app.features.im import models as im_models  # noqa: F401
from app.features.meeting import models as meeting_models  # noqa: F401
from app.features.notification import models as notification_models  # noqa: F401
from app.features.office import models as office_models  # noqa: F401
from app.features.organization import models as organization_models  # noqa: F401
from app.features.rag import models as rag_models  # noqa: F401