"""会议 feature：REST 路由 + 业务服务 + schemas。"""

from app.features.meeting.schemas import (  # noqa: F401
    AgentTriggerRequest,
    AgentTriggerResponse,
    BlackboardReadResponse,
    BlackboardSnapshot,
    MeetingCreate,
    MeetingListResponse,
    MeetingRead,
)
from app.features.meeting.service import (  # noqa: F401
    close_meeting,
    create_meeting,
    get_meeting,
    list_meetings,
    read_blackboard,
    trigger_agent,
)