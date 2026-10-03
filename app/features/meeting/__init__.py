"""会议 feature：REST 路由 + WebSocket + 业务服务 + schemas。"""

from app.features.meeting.schemas import (  # noqa: F401
    AgentTriggerRequest,
    AgentTriggerResponse,
    BlackboardEventItem,
    BlackboardEventListResponse,
    BlackboardReadResponse,
    BlackboardSnapshot,
    MeetingCreate,
    MeetingListResponse,
    MeetingRead,
    MeetingPhase,
)
from app.features.meeting.service import (  # noqa: F401
    close_meeting,
    create_meeting,
    get_meeting,
    list_blackboard_events,
    list_meetings,
    read_blackboard,
    trigger_agent,
)
from app.features.meeting.ws import (  # noqa: F401
    get_blackboard_service,
    meeting_ws,
)