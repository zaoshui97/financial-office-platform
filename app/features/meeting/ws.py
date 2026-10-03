"""会议 WebSocket：把 BlackboardService 订阅回调推给前端。

路径：/api/v1/meetings/ws/{meeting_id}
鉴权：同 REST，header `Authorization: Bearer <jwt>`

数据流：
  客户端 connect
    ↓
  [ws] 解析 token → 校验 meeting 归属 → 新建 DB session
    ↓
  注册 BlackboardService.subscribe(callback)
  callback 内部 asynctransit 入 asyncio.Queue
    ↓
  后台 task: queue.get() → send_json
    ↓
  客户端 disconnect → unsubscribe + 关 task
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.logging import get_logger
from app.core.security import TokenDecodeError, decode_access_token
from app.features.agent.blackboard import BlackboardService
from app.features.agent.models import MeetingSession
from app.features.auth.models import User

logger = get_logger(__name__)

router = APIRouter(prefix="/meetings/ws", tags=["会议 WebSocket"])

# 心跳：服务端每 30s 推 ping，客户端需回 pong 才能维持连接
HEARTBEAT_INTERVAL_SECONDS = 30

# 单连接最大排队消息数（防慢消费阻塞回调）
QUEUE_MAX_SIZE = 256


# ---------- 全局 BlackboardService 单例 ----------
# 多 ws 连接 + 业务 svc 必须共享同一个 BlackboardService 实例，否则各跑各的
# 内存缓存 + 订阅列表互不可见。
_blackboard_singleton: BlackboardService | None = None
# EventBus 启动标志：装默认触发链时上锁，避免并发
_eventbus_installed = False
_eventbus_lock = None  # type: ignore[var-annotated]


def get_blackboard_service() -> BlackboardService:
    """进程级 BlackboardService 单例（懒加载，首次访问时建）。

    首次创建时自动绑定 EventBus 并装默认触发链（moderator → noter → decision → dispatcher）。
    触发链只装一次：后续调用幂等。
    """
    global _blackboard_singleton, _eventbus_installed, _eventbus_lock
    if _blackboard_singleton is None:
        _blackboard_singleton = BlackboardService(SessionLocal())
        # 安装 EventBus 默认链
        from app.features.meeting.event_bus import get_event_bus
        bus = get_event_bus()
        bus.attach_blackboard(_blackboard_singleton)
        if not bus.is_installed():
            bus.install_default_chain()
            _eventbus_installed = True
    return _blackboard_singleton


# ---------- 鉴权工具 ----------

async def _authenticate(websocket: WebSocket) -> tuple[int, int] | None:
    """从 ws header 解析 JWT，返回 (user_id, meeting_id) 或 None。"""
    token = websocket.headers.get("authorization", "").removeprefix("Bearer ").strip()
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="missing token")
        return None
    try:
        user_id = int(decode_access_token(token))
    except (TokenDecodeError, ValueError):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="invalid token")
        return None

    # meeting_id 来自 path，由 ws_router 在 connect 后再校验（用 db session 上下文外）
    return user_id, -1


def _check_meeting_ownership(
    user_id: int, meeting_id: int
) -> MeetingSession | None:
    """校验会议归属当前用户；返回 MeetingSession 或 None。"""
    db = SessionLocal()
    try:
        meeting = db.scalar(
            select(MeetingSession).where(
                MeetingSession.id == meeting_id,
                MeetingSession.host_user_id == user_id,
            )
        )
        if meeting is None:
            return None
        # detached，避免后续 lazy load 报错
        db.expunge(meeting)
        return meeting
    finally:
        db.close()


# ---------- 主入口 ----------

@router.websocket("/{meeting_id}")
async def meeting_ws(websocket: WebSocket, meeting_id: int) -> None:
    """会议黑板 WebSocket：服务端 push 状态变更给前端。"""
    # 1) JWT 鉴权（失败直接 close，不 accept）
    auth = await _authenticate(websocket)
    if auth is None:
        return
    user_id, _ = auth

    # 2) 校验会议归属
    if _check_meeting_ownership(user_id, meeting_id) is None:
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="meeting not found or not owned",
        )
        return

    await websocket.accept()
    logger.info(
        "ws 连接 | user=%s meeting=%s client=%s",
        user_id, meeting_id, websocket.client,
    )

    # 3) 准备订阅：使用进程级 BlackboardService 单例
    #    关键：其他业务（如 meeting_router.trigger_agent）也用同一个 svc，
    #    才能把状态变更同步通知到当前 ws 连接。
    svc = get_blackboard_service()
    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=QUEUE_MAX_SIZE)

    def on_blackboard_update(
        session_id: int,
        agent_role: str,
        state: dict[str, Any],
        version: int,
    ) -> None:
        """同步回调：把消息丢进 asyncio.Queue（不阻塞 DB 写流程）。"""
        # ws 中断时 queue 没人消费 → 丢弃新消息
        try:
            queue.put_nowait({
                "type": "blackboard_update",
                "session_id": session_id,
                "agent_role": agent_role,
                "state": state,
                "version": version,
                "ts": datetime.now(timezone.utc).isoformat(),
            })
        except asyncio.QueueFull:
            logger.warning(
                "ws 队列满，丢弃 | user=%s meeting=%s role=%s",
                user_id, meeting_id, agent_role,
            )

    callback_id = svc.subscribe(meeting_id, on_blackboard_update)

    # 4) 推送初始全量快照
    try:
        initial = svc.read_all(meeting_id)
        await websocket.send_json({
            "type": "snapshot",
            "session_id": meeting_id,
            "states": initial,
        })
    except Exception:
        logger.exception("ws 初始快照失败 | meeting=%s", meeting_id)

    # 5) 启动心跳任务
    heartbeat_task = asyncio.create_task(
        _heartbeat_loop(websocket, user_id, meeting_id),
        name=f"ws-heartbeat-{user_id}-{meeting_id}",
    )

    # 6) 收发主循环
    try:
        # 读端：收客户端 pong / 自定义消息（这里只用来保活）
        receiver = asyncio.create_task(
            _receive_loop(websocket, user_id, meeting_id),
            name=f"ws-receiver-{user_id}-{meeting_id}",
        )
        sender = asyncio.create_task(
            _send_loop(websocket, queue, user_id, meeting_id),
            name=f"ws-sender-{user_id}-{meeting_id}",
        )
        done, pending = await asyncio.wait(
            {receiver, sender, heartbeat_task},
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()
            for t in pending:
                try:
                    await t
                except (asyncio.CancelledError, Exception):
                    pass
    except WebSocketDisconnect:
        logger.info("ws 客户端断开 | user=%s meeting=%s", user_id, meeting_id)
    except Exception:
        logger.exception("ws 异常 | user=%s meeting=%s", user_id, meeting_id)
    finally:
        svc.unsubscribe(meeting_id, callback_id)
        # 不关单例的 db，会随进程退出
        logger.info(
            "ws 资源清理 | user=%s meeting=%s callback_id=%s",
            user_id, meeting_id, callback_id,
        )


# ---------- 收发循环 ----------

async def _send_loop(
    websocket: WebSocket,
    queue: asyncio.Queue[dict[str, Any]],
    user_id: int,
    meeting_id: int,
) -> None:
    """从 queue 取消息 → send_json。queue 空时让出。"""
    while True:
        message = await queue.get()
        try:
            await websocket.send_json(message)
        except Exception:
            # 客户端断了 → 让主协程退出
            raise


async def _receive_loop(
    websocket: WebSocket,
    user_id: int,
    meeting_id: int,
) -> None:
    """接收客户端消息：仅用于检测断开 / 协议消息。

    客户端主动断开 → 视为正常关闭，主循环会从 asyncio.wait 中收到 FIRST_COMPLETED。
    其他异常 → 也按断开处理。
    """
    while True:
        try:
            text = await websocket.receive_text()
        except WebSocketDisconnect:
            logger.info("ws 接收端检测到断开 | user=%s meeting=%s", user_id, meeting_id)
            return
        except Exception:
            logger.info("ws 接收异常，按断开处理 | user=%s meeting=%s", user_id, meeting_id)
            return
        # 静默忽略内容，仅用于保活探测
        logger.debug(
            "ws 收到客户端消息 | user=%s meeting=%s msg=%r",
            user_id, meeting_id, text[:100],
        )


async def _heartbeat_loop(
    websocket: WebSocket,
    user_id: int,
    meeting_id: int,
) -> None:
    """每 30s 推 ping；推不出去说明客户端已死。"""
    try:
        while True:
            await asyncio.sleep(HEARTBEAT_INTERVAL_SECONDS)
            try:
                await websocket.send_json({
                    "type": "ping",
                    "ts": datetime.now(timezone.utc).isoformat(),
                })
            except Exception:
                # 发送失败 → 客户端已断开
                return
    except asyncio.CancelledError:
        pass