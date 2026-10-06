/**
 * Multi-Agent Event Bus
 *
 * 前端模拟的多 Agent 协作事件总线。后端真实多 Agent 服务上线后，
 * 只需把这里的 dispatch() / subscribe() 内部实现替换为 WebSocket 即可，
 * 上层业务代码 (Blackboard / AgentPanel / MeetingRoom) 完全不用改。
 */

export type AgentRole = 'moderator' | 'notetaker' | 'decision' | 'action';

export type AgentEventType =
  | 'agent:started'
  | 'agent:thinking'
  | 'agent:token'
  | 'agent:completed'
  | 'agent:failed'
  | 'blackboard:updated'
  | 'meeting:state'
  | 'transcript:chunk';

export interface AgentEvent {
  id: string;
  type: AgentEventType;
  role?: AgentRole;
  meetingId: string;
  timestamp: number;
  payload: any;
}

type Listener = (evt: AgentEvent) => void;

class AgentEventBus {
  private listeners = new Map<AgentEventType, Set<Listener>>();
  private anyListeners = new Set<Listener>();
  private history: AgentEvent[] = [];
  private maxHistory = 200;

  subscribe(type: AgentEventType, fn: Listener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(fn);
    return () => {
      this.listeners.get(type)?.delete(fn);
    };
  }

  subscribeAll(fn: Listener): () => void {
    this.anyListeners.add(fn);
    return () => {
      this.anyListeners.delete(fn);
    };
  }

  dispatch(evt: Omit<AgentEvent, 'id' | 'timestamp'>) {
    const full: AgentEvent = {
      ...evt,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };
    this.history.push(full);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    this.listeners.get(full.type)?.forEach((fn) => {
      try {
        fn(full);
      } catch (e) {
        console.error('[AgentEventBus] listener error', e);
      }
    });
    this.anyListeners.forEach((fn) => {
      try {
        fn(full);
      } catch (e) {
        console.error('[AgentEventBus] any-listener error', e);
      }
    });
  }

  /** 给指定会议的历史事件快照 */
  historyOf(meetingId: string): AgentEvent[] {
    return this.history.filter((e) => e.meetingId === meetingId);
  }
}

export const agentBus = new AgentEventBus();

export const AGENT_META: Record<
  AgentRole,
  { name: string; icon: string; color: string; desc: string }
> = {
  moderator: {
    name: '主持人 Agent',
    icon: 'M',
    color: '#0F2B5B',
    desc: '掌控会议节奏，引导讨论方向，自动总结每段议题',
  },
  notetaker: {
    name: '记录员 Agent',
    icon: 'N',
    color: '#52c41a',
    desc: '实时转写 + 结构化抽取要点、关键数据、风险信号',
  },
  decision: {
    name: '决策追踪 Agent',
    icon: 'D',
    color: '#fa8c16',
    desc: '识别决策点，构建决策链，标记分歧与共识',
  },
  action: {
    name: '待办分派 Agent',
    icon: 'A',
    color: '#0F2B5B',
    desc: '自动抽取待办、指派责任人、设置截止时间、追踪完成度',
  },
};
