"""会议事件总线：基于 BlackboardService 的订阅机制做触发链编排。

职责：
  - Agent 写完黑板后，自动触发下一个 agent（链式 / 并行编排）
  - 一个订阅者抛错不影响其他（错误隔离 + 防御性 try/except）
  - 同步派发（顺序确定，黑板 version 单调）；并行阶段用线程池隔离

设计：
  - 不引入新框架，复用 BlackboardService 的 subscribe（payload 携带 event_type）
  - payload 由 BlackboardService._notify 写入：{"event_type": "...", ...}
  - 订阅者签名：cb(session_id, agent_role, state, version) -> None
    通过解析 state["event_type"] 判断事件类型（避免改 BlackboardService 签名）

事件类型常量：
  - moderator_updated / noter_updated / decision_updated / dispatcher_updated

编排模式：
  - 串行（legacy）：moderator → noter → decision → dispatcher
  - 并行（default）：moderator 单跑，之后 noter / decision / dispatcher 三者并发跑
    - 决策依据：moderator 控场独立；noter / decision / dispatcher 都基于同一快照可独立
    - 并行阶段对 snapshot 做一次性 read 快照，避免三人读到不同版本
    - 任一 Agent 抛错不影响其他（每路独立 try/except + 线程池隔离）

触发链默认装好（按默认并行模式）：
  moderator_updated → 跑 noter / decision / dispatcher（三者并发）
  其余角色写黑板后不再触发（终态）
"""

from __future__ import annotations

import threading
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from app.core.logging import get_logger
from app.features.agent.agents import AGENT_REGISTRY, get_agent

logger = get_logger(__name__)


# 事件类型常量
EVENT_MODERATOR_UPDATED = "moderator_updated"
EVENT_NOTER_UPDATED = "noter_updated"
EVENT_DECISION_UPDATED = "decision_updated"
EVENT_DISPATCHER_UPDATED = "dispatcher_updated"


# 并行阶段调度的最大工作线程数（= 并行 Agent 数）
PARALLEL_MAX_WORKERS = 3


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

    def _run_agent(
        self,
        target_agent: str,
        session_id: int,
        snapshot: dict[str, Any],
        trigger_source: str,
        source_role: str,
        source_version: int,
    ) -> None:
        """跑一个目标 Agent：构造 context + 调 BaseAgent.run()。

        独立 try/except：单 Agent 抛错不影响其他并行 Agent，也不影响触发链。
        """
        try:
            agent = get_agent(target_agent)
            agent.run(
                context={
                    "session_id": session_id,
                    "blackboard_snapshot": snapshot,
                    "trigger_source": trigger_source,
                    "source_role": source_role,
                    "source_version": source_version,
                },
                blackboard=self._blackboard_svc,
            )
            logger.info(
                "event-bus chain | session=%s %s → %s OK",
                session_id, trigger_source, target_agent,
            )
        except Exception as exc:
            logger.exception(
                "event-bus chain 失败 | session=%s %s → %s err=%s",
                session_id, trigger_source, target_agent, exc,
            )

    def _make_parallel_chain_callback(
        self, event_type: str, target_agents: list[str]
    ) -> ChainCallback:
        """生成并行触发回调：event_type 命中后，并行调度 target_agents。

        使用 ThreadPoolExecutor 隔离每路 Agent 抛错。
        snapshot 在调度前一次性 read，避免 3 路读到不同版本。
        """
        def _cb(
            session_id: int,
            agent_role: str,
            state: dict[str, Any],
            version: int,
        ) -> None:
            ev_type = state.get("event_type")
            if ev_type != event_type:
                return
            # 一次性快照：3 路并行都基于同一份 moderator 输出
            try:
                snapshot = self._blackboard_svc.read_all(session_id)
            except Exception:
                logger.exception(
                    "event-bus 快照失败 | session=%s err",
                    session_id,
                )
                return
            with ThreadPoolExecutor(
                max_workers=PARALLEL_MAX_WORKERS,
                thread_name_prefix=f"agent-bus-{session_id}",
            ) as pool:
                futures = [
                    pool.submit(
                        self._run_agent,
                        target,
                        session_id,
                        snapshot,
                        ev_type,
                        agent_role,
                        version,
                    )
                    for target in target_agents
                ]
                # 等全部完成；任一抛错已在 _run_agent 内吞掉
                for f in futures:
                    f.result()  # 不抛错（防御性拿结果）

        return _cb

    def install_default_chain(self) -> None:
        """装默认并行触发链：moderator → 并行跑 noter / decision / dispatcher。

        多次调用幂等：_installed=True 直接返回。
        """
        if self._installed:
            return
        if self._blackboard_svc is None:
            raise RuntimeError(
                "EventBus.attach_blackboard(svc) 必须先调用，再 install_default_chain()"
            )

        # 并行阶段：moderator 写完后，3 个 Agent 同时跑
        parallel_targets = ["noter", "decision", "dispatcher"]
        cb = self._make_parallel_chain_callback(
            EVENT_MODERATOR_UPDATED, parallel_targets
        )
        self._blackboard_svc.subscribe_global(cb)
        self._installed = True
        logger.info(
            "event-bus 默认并行链已装: %s → %s (并发)",
            EVENT_MODERATOR_UPDATED, "+".join(parallel_targets),
        )

    def install_legacy_serial_chain(self) -> None:
        """装串行触发链（兼容老行为）：moderator → noter → decision → dispatcher。

        多数情况下应使用 install_default_chain()。仅在调试或需要确定执行顺序时调用。
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
            # 串行版：单元素 list 走并行回调，行为等价
            cb = self._make_parallel_chain_callback(event_type, [target])
            self._blackboard_svc.subscribe_global(cb)
        self._installed = True
        logger.info(
            "event-bus 串行链已装: %s",
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
