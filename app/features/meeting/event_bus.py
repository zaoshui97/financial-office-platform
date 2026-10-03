"""会议事件总线：基于 BlackboardService 的订阅机制做触发链编排。

职责：
  - Agent 写完黑板后，自动触发下一个 agent（链式编排）
  - 一个订阅者抛错不影响其他（错误隔离 + 防御性 try/except）
  - 同步派发（顺序确定，黑板 version 单调）

设计：
  - 不引入新框架，复用 BlackboardService 的 subscribe（payload 携带 event_type）
  - payload 由 BlackboardService._notify 写入：{"event_type": "...", ...}
  - 订阅者签名：cb(session_id, agent_role, state, version) -> None
    通过解析 state["event_type"] 判断事件类型（避免改 BlackboardService 签名）

事件类型常量：
  - moderator_updated / noter_updated / decision_updated / dispatcher_updated

触发链默认装好：
  moderator_updated → 跑 noter
  noter_updated      → 跑 decision
  decision_updated   → 跑 dispatcher
  dispatcher_updated → 终态（不再触发）
"""

from __future__ import annotations

import threading
from collections.abc import Callable
from typing import Any

from app.core.logging import get_logger
from app.features.agent.agents import AGENT_REGISTRY, get_agent

logger = get_logger(__name__)


# 事件类型常量
EVENT_MODERATOR_UPDATED = "moderator_updated"
EVENT_NOTER_UPDATED = "noter_updated"
EVENT_DECISION_UPDATED = "decision_updated"
EVENT_DISPATCHER_UPDATED = "dispatcher_updated"


# 订阅者签名：cb(session_id, agent_role, state, version) -> None
ChainCallback = Callable[[int, str, dict[str, Any], int], None]


class EventBus:
    """进程级事件总线单例。

    内部不重存订阅，回调直接通过 BlackboardService.subscribe 注册。
    触发链的"下一个 agent"由 EventBus 自己调度（拿到 BlackboardService 引用）。
    """

    _instance: "EventBus | None" = None
    _lock_init = threading.Lock()

    def __new__(cls) -> "EventBus":
        if cls._instance is None:
            with cls._lock_init:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._blackboard_svc: Any | None = None
                    cls._instance._installed = False
        return cls._instance

    def attach_blackboard(self, svc: Any) -> None:
        """绑定 BlackboardService（必须在 install_default_chain 之前调用）。"""
        self._blackboard_svc = svc

    def _make_chain_callback(self, event_type: str, target_agent: str) -> ChainCallback:
        """生成一个 wrapper 回调：从 state 取 event_type，命中就跑 target_agent。"""
        def _cb(
            session_id: int,
            agent_role: str,
            state: dict[str, Any],
            version: int,
        ) -> None:
            ev_type = state.get("event_type")
            if ev_type != event_type:
                return
            try:
                all_states = self._blackboard_svc.read_all(session_id)
                agent = get_agent(target_agent)
                agent.run(
                    context={
                        "session_id": session_id,
                        "blackboard_snapshot": all_states,
                        "trigger_source": ev_type,
                        "source_role": agent_role,
                        "source_version": version,
                    },
                    blackboard=self._blackboard_svc,
                )
                logger.info(
                    "event-bus chain | session=%s %s → %s v=%s OK",
                    session_id, event_type, target_agent, version,
                )
            except Exception as exc:
                logger.exception(
                    "event-bus chain 失败 | session=%s %s → %s err=%s",
                    session_id, event_type, target_agent, exc,
                )
        return _cb

    def install_default_chain(self) -> None:
        """装默认触发链：moderator → noter → decision → dispatcher。

        多次调用幂等：_installed=True 直接返回。
        """
        if self._installed:
            return
        if self._blackboard_svc is None:
            raise RuntimeError(
                "EventBus.attach_blackboard(svc) 必须先调用，再 install_default_chain()"
            )

        chain = [
            (EVENT_MODERATOR_UPDATED, "noter"),
            (EVENT_NOTER_UPDATED, "decision"),
            (EVENT_DECISION_UPDATED, "dispatcher"),
        ]
        for event_type, target in chain:
            cb = self._make_chain_callback(event_type, target)
            self._blackboard_svc.subscribe_global(cb)
        self._installed = True
        logger.info(
            "event-bus 默认链已装: %s",
            " -> ".join(f"{ev}=>{t}" for ev, t in chain),
        )

    def is_installed(self) -> bool:
        return self._installed


# 模块级单例访问
_event_bus: EventBus | None = None


def get_event_bus() -> EventBus:
    global _event_bus
    if _event_bus is None:
        _event_bus = EventBus()
    return _event_bus


def reset_event_bus_for_test() -> None:
    """测试间清理单例状态。"""
    global _event_bus
    _event_bus = None
    EventBus._instance = None