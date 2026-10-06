"""工作台 Dashboard 模块。"""

from app.features.dashboard.schemas import (  # noqa: F401
    DashboardStatsResponse,
    DayBucket,
)
from app.features.dashboard.service import (  # noqa: F401
    compute_dashboard_stats,
)
