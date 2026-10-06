"""会议 feature：REST 路由 + WebSocket + 业务服务 + schemas。"""

from app.features.meeting.schemas import (  # noqa: F401
    ActionApprovalDraft,
    ActionApprovalRequest,
    AgentTriggerRequest,
    AgentTriggerResponse,
    BlackboardEventItem,
    BlackboardEventListResponse,
    BlackboardReadResponse,
    BlackboardSnapshot,
    DispatchResponse,
    MeetingActionRead,
    MeetingCreate,
    MeetingListResponse,
    MeetingRead,
    MeetingPhase,
    MeetingReportResponse,
)
from app.features.meeting.service import (  # noqa: F401
    action_to_approval,
    close_meeting,
    create_meeting,
    dispatch_actions,
    generate_meeting_report,
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