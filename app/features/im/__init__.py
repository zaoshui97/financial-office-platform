"""IM 通讯录 + 一对一消息模块。"""

from app.features.im.schemas import (  # noqa: F401
    ContactListResponse,
    ContactRead,
    DirectMessageListResponse,
    DirectMessageRead,
    DirectMessageSendRequest,
)
from app.features.im.service import (  # noqa: F401
    list_contacts,
    list_direct_messages,
    send_direct_message,
)
