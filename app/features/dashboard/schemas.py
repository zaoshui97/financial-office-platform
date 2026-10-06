"""Dashboard Pydantic 模型。"""

from __future__ import annotations

from pydantic import BaseModel, Field


class DayBucket(BaseModel):
    """单日桶（用于 7 日折线图）。"""

    date: str = Field(description="日期 YYYY-MM-DD")
    count: int = Field(description="当日消息数")


class DashboardStatsResponse(BaseModel):
    """工作台统计。"""

    pending_tasks: int = Field(description="待办工单数（meeting_action.status=pending）")
    today_chats: int = Field(description="今日对话消息数")
    week_charts: list[DayBucket] = Field(
        description="近 7 日每日消息数（含今日）",
    )
    kb_docs: int = Field(description="我的知识库文档数")
    pending_approvals: int = Field(
        description="待我审批数（status=pending 且 user_id=我）",
    )
