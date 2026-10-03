"""共享黑板服务：MySQL 持久化 + 进程内内存缓存 + 订阅回调。

设计要点：
- MySQL 是真相源（meeting_blackboard 表，version 乐观锁）。
- 进程内字典缓存 {session_id: {agent_role: state}}：减少 DB 读、毫秒级响应。
- 写入用乐观锁，失败时 N 次重试，重试都失败再抛错（避免死锁）。
- 订阅回调在写入成功后同步通知（不阻塞主流程）。
- WebSocket 适配器由调用方在 callback 里实现。

典型用法：

    svc = BlackboardService(db)
    svc.write(session_id=1, agent_role="moderator", state={"phase": "open"})

    # 另起一个协程 / 线程订阅
    def on_state(session_id, role, state, version):
        ws.broadcast(f"session-{session_id}", {"role": role, "state": state})
    svc.subscribe(session_id=1, callback=on_state)
"""

from __future__ import annotations

import asyncio
import threading
from collections.abc import Callable
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.features.agent.models import Blackboard

logger = get_logger(__name__)

# 写冲突时重试次数（MySQL 乐观锁常见值，3 次足够覆盖偶发冲突）。
MAX_RETRY = 3

# 缓存条目软上限（防止单次黑板无限制增长；state_json ≤ 64KB × 4 角色 ≈ 256KB）。
MAX_STATE_BYTES = 64 * 1024

# 订阅回调签名：(session_id, agent_role, state, version)。
StateCallback = Callable[[int, str, dict[str, Any], int], None]


class BlackboardConflictError(RuntimeError):
    """乐观锁并发冲突，重试耗尽后抛出。"""


class BlackboardService:
    """会议共享黑板：4 Agent 写、最新读、订阅推送。"""

    def __init__(self, db: Session | None = None) -> None:
        # 单例场景下 db 不传，每次写/读自开新 session
        self._db = db
        # {session_id: {agent_role: state}}
        self._cache: dict[int, dict[str, dict[str, Any]]] = {}
        # {session_id: {callback_id: callback}}
        self._subscribers: dict[int, dict[int, StateCallback]] = {}
        # 防止回调内部修改订阅列表导致迭代错误。
        self._lock = threading.RLock()
        self._next_callback_id = 1

    # ---------- 写入 ----------

    def _session(self) -> Session:
        """获取操作 session：单例场景下自开，注入场景下复用。"""
        if self._db is not None:
            return self._db
        # 单例：自开 session（用完即关）
        from app.core.database import SessionLocal
        return SessionLocal()

    def _close_session(self, session: Session) -> None:
        """操作完成后是否需要关闭 session。"""
        if self._db is None:  # 单例自开场景
            session.close()

    def write(
        self,
        session_id: int,
        agent_role: str,
        state: dict[str, Any],
    ) -> int:
        """乐观锁写入一个 Agent 的状态快照，返回新 version。

        流程：
          1. 读缓存（命中即用），未命中则从 DB 加载。
          2. UPDATE ... WHERE version = old_version，影响 0 行则冲突 → 重试。
          3. 写入成功后更新缓存 + 同步通知订阅者。
        """
        payload = self._validate_state(state)
        session = self._session()
        try:
            for attempt in range(1, MAX_RETRY + 1):
                row = self._get_or_load(session, session_id, agent_role)
                old_version = row.version
                new_version = old_version + 1

                updated = session.execute(
                    Blackboard.__table__.update()
                    .where(Blackboard.id == row.id, Blackboard.version == old_version)
                    .values(
                        state_json=payload,
                        version=new_version,
                        updated_at=func.now(),
                    ),
                )
                if updated.rowcount == 1:
                    session.commit()
                    # 写缓存
                    with self._lock:
                        cache_for_session = self._cache.setdefault(session_id, {})
                        cache_for_session[agent_role] = payload
                    # 通知订阅者（同步，避免异步丢失顺序）
                    self._notify(session_id, agent_role, payload, new_version)
                    logger.info(
                        "blackboard 写入 | session=%s role=%s version=%s",
                        session_id, agent_role, new_version,
                    )
                    return new_version

                # 冲突：被别人先写了，回滚 + 重读
                session.rollback()
                logger.warning(
                    "blackboard 乐观锁冲突 | session=%s role=%s attempt=%s",
                    session_id, agent_role, attempt,
                )

            raise BlackboardConflictError(
                f"blackboard 写入冲突：session={session_id} role={agent_role}"
            )
        finally:
            self._close_session(session)

    # ---------- 读取 ----------

    def read_one(self, session_id: int, agent_role: str) -> dict[str, Any]:
        """读单个 Agent 的最新状态。"""
        with self._lock:
            cached = self._cache.get(session_id, {}).get(agent_role)
        if cached is not None:
            return cached
        session = self._session()
        try:
            row = session.scalar(
                select(Blackboard).where(
                    Blackboard.session_id == session_id,
                    Blackboard.agent_role == agent_role,
                )
            )
        finally:
            self._close_session(session)
        if row is None:
            return {}
        with self._lock:
            self._cache.setdefault(session_id, {})[agent_role] = row.state_json
        return row.state_json

    def read_all(self, session_id: int) -> dict[str, dict[str, Any]]:
        """读全部 Agent 的最新状态：{agent_role: state}。"""
        with self._lock:
            cached = self._cache.get(session_id)
        if cached is not None:
            return {role: dict(state) for role, state in cached.items()}

        session = self._session()
        try:
            rows = list(
                session.scalars(
                    select(Blackboard).where(Blackboard.session_id == session_id)
                ).all()
            )
        finally:
            self._close_session(session)
        with self._lock:
            bucket = self._cache.setdefault(session_id, {})
            for row in rows:
                bucket[row.agent_role] = row.state_json
            return {role: dict(state) for role, state in bucket.items()}

    # ---------- 订阅 ----------

    def subscribe(self, session_id: int, callback: StateCallback) -> int:
        """注册状态变更回调，返回 callback_id（用于 unsubscribe）。"""
        with self._lock:
            bucket = self._subscribers.setdefault(session_id, {})
            cid = self._next_callback_id
            self._next_callback_id += 1
            bucket[cid] = callback
            logger.info("blackboard 订阅 | session=%s callback_id=%s", session_id, cid)
            return cid

    def unsubscribe(self, session_id: int, callback_id: int) -> None:
        """取消订阅。"""
        with self._lock:
            bucket = self._subscribers.get(session_id, {})
            bucket.pop(callback_id, None)

    # ---------- 内部 ----------

    def _get_or_load(
        self, session: Session, session_id: int, agent_role: str
    ) -> Blackboard:
        """从缓存取行（DB 实体），没有就读 DB 一次。"""
        # cache 里只存 state_json，所以这里仍要从 DB 拿 row 实体做 UPDATE。
        row = session.scalar(
            select(Blackboard).where(
                Blackboard.session_id == session_id,
                Blackboard.agent_role == agent_role,
            )
        )
        if row is None:
            # 第一次写这个 role → 新建一行
            row = Blackboard(
                session_id=session_id,
                agent_role=agent_role,
                state_json={},
                version=0,
            )
            session.add(row)
            session.flush()
            logger.info(
                "blackboard 初始化 | session=%s role=%s",
                session_id, agent_role,
            )
        return row

    def _notify(
        self,
        session_id: int,
        agent_role: str,
        state: dict[str, Any],
        version: int,
    ) -> None:
        """同步通知所有订阅者；回调抛错不影响其他订阅者。"""
        with self._lock:
            callbacks = list(self._subscribers.get(session_id, {}).items())
        for cid, cb in callbacks:
            try:
                cb(session_id, agent_role, state, version)
            except Exception:
                logger.exception(
                    "blackboard 订阅回调异常 | session=%s callback_id=%s",
                    session_id, cid,
                )

    @staticmethod
    def _validate_state(state: dict[str, Any]) -> dict[str, Any]:
        """校验 state 大小，防止 OOM。"""
        import json
        encoded = json.dumps(state, ensure_ascii=False, default=str)
        if len(encoded.encode("utf-8")) > MAX_STATE_BYTES:
            raise ValueError(
                f"blackboard state 超过 {MAX_STATE_BYTES} 字节上限"
            )
        return state


# ---------- 异步适配（可选） ----------

async def broadcast_async(
    callbacks: list[StateCallback],
    session_id: int,
    agent_role: str,
    state: dict[str, Any],
    version: int,
) -> None:
    """把同步回调列表用 asyncio 异步触发，用于 WebSocket 推送。"""
    for cb in callbacks:
        try:
            result = cb(session_id, agent_role, state, version)
            if asyncio.iscoroutine(result):
                await result
        except Exception:
            logger.exception("async blackboard 回调异常 | role=%s", agent_role)
