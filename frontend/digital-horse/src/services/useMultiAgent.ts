/**
 * React Hooks for Multi-Agent system
 */

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  blackboardStore,
  agentRunStore,
  AgentRunState,
  Blackboard,
} from './multiAgentOrchestrator';
import { AgentRole, agentBus, AgentEventType, AgentEvent } from './multiAgentBus';

/** 订阅 Blackboard 全量状态
 *  修复：blackboardStore.get() 返回的是可变引用，每次 notify 后 data 都是新对象但底层字段是同一个
 *  改用版本号 + useMemo 派生，保证 React 不会因引用变化重渲染
 */
export function useBlackboard(): Blackboard {
  const tick = useSyncExternalStore(
    (fn) => blackboardStore.subscribe(fn),
    () => blackboardStore.getTick(),
    () => blackboardStore.getTick()
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => blackboardStore.get(), [tick]);
}

/** 订阅单个 Agent 的运行状态
 *  修复：返回新对象会触发 tearing 检测循环；改用版本号 + useMemo 派生
 */
export function useAgentRunState(role: AgentRole): AgentRunState {
  const tick = useSyncExternalStore(
    (fn) => agentRunStore.subscribe(fn),
    () => agentRunStore.getTick(),
    () => agentRunStore.getTick()
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => agentRunStore.get(role), [tick, role]);
}

/** 订阅全部 4 个 Agent 的运行状态
 *  修复：返回新对象会触发 React tearing 检测循环，必须保持引用稳定
 *  改用 useSyncExternalStore 订阅 agentRunStore，再用 useMemo 派生对象
 */
export function useAllAgentRunStates(): Record<AgentRole, AgentRunState> {
  // 订阅一个稳定的 tick 数字（每次 notify 自增）
  const tick = useSyncExternalStore(
    (fn) => agentRunStore.subscribe(fn),
    () => agentRunStore.getTick(),
    () => agentRunStore.getTick()
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(
    () => ({
      moderator: agentRunStore.get('moderator'),
      notetaker: agentRunStore.get('notetaker'),
      decision: agentRunStore.get('decision'),
      action: agentRunStore.get('action'),
    }),
    [tick]
  );
}

/** 订阅特定事件类型 */
export function useAgentEvent(type: AgentEventType, fn: (e: AgentEvent) => void) {
  useEffect(() => {
    return agentBus.subscribe(type, fn);
  }, [type, fn]);
}

/** 订阅所有事件 */
export function useAllAgentEvents(fn: (e: AgentEvent) => void) {
  useEffect(() => {
    return agentBus.subscribeAll(fn);
  }, [fn]);
}
