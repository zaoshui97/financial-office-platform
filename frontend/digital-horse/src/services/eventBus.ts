/**
 * 事件总线 —— 跨模块仿真联动
 *
 * 作用：
 *   - 让 store / 页面 / 服务之间通过"事件"解耦
 *   - 一个动作（如：会议派单）可以同时触发通知中心 / Dashboard / 钉钉推送，无需直接 import 对方
 *   - 调试时可在 eventBus 上挂监听，打印所有事件流
 *
 * 用法：
 *   // 触发
 *   eventBus.emit('meeting.workitem.created', { id, title, ... });
 *
 *   // 监听
 *   useEffect(() => {
 *     const off = eventBus.on('meeting.workitem.created', (payload) => { ... });
 *     return off;
 *   }, []);
 *
 * 设计原则：
 *   - 事件名采用 'domain.action.pastTense' 格式（如 approval.changed / workitem.due / sandbox.blocked）
 *   - payload 用 plain object，便于序列化到 console / localStorage（未来）
 */

export type AppEventMap = {
  // ─── 会议 ─────────────────────────────────────────
  'meeting.created':         { id: string; title: string; startAt: string };
  'meeting.updated':         { id: string; changes: Record<string, unknown> };
  'meeting.deleted':         { id: string };
  'meeting.workitem.created':{ id: string; meetingId: string; title: string; assignee: string; priority: 'low' | 'normal' | 'high' | 'urgent' };
  'meeting.workitem.changed':{ id: string; status: 'pending' | 'in_progress' | 'done' | 'cancelled' };

  // ─── 审批 ─────────────────────────────────────────
  'approval.draft.created':  { id: string; title: string; fromWorkitemId?: string };
  'approval.submitted':      { id: string; title: string; approverId: string };
  'approval.changed':        { id: string; status: 'pending' | 'approved' | 'rejected'; title: string };

  // ─── 知识库 ───────────────────────────────────────
  'knowledge.uploaded':      { id: string; title: string; category: string; size: number };
  'knowledge.searched':      { keyword: string; hits: number };
  'knowledge.linked':        { id: string; targetType: 'meeting' | 'report'; targetId: string };

  // ─── 报告 ─────────────────────────────────────────
  'report.generated':        { id: string; title: string; format: 'docx' | 'pdf' | 'html' };

  // ─── 沙箱 ─────────────────────────────────────────
  'sandbox.scanned':         { id: string; score: number; riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'block' };
  'sandbox.blocked':         { id: string; title: string; matchedRules: string[] };

  // ─── 行业资讯 ─────────────────────────────────────
  'news.subscribed':         { id: string; keyword: string };
  'news.risk.flagged':       { id: string; title: string; severity: 'low' | 'medium' | 'high' };

  // ─── 用户 / 权限 ──────────────────────────────────
  'user.loggedIn':           { userId: string; method: 'password' | 'dingtalk' | 'wecom' | 'sso' };
  'user.loggedOut':          { userId: string };
  'user.roleChanged':        { userId: string; from: string; to: string };

  // ─── 通讯录 / 钉钉 ────────────────────────────────
  'contacts.dingtalkSynced': { added: number; updated: number; removed: number };
  'dingtalk.connected':      { corpId: string; appName: string };
  'dingtalk.disconnected':   void;

  // ─── 通知 / 推送 ──────────────────────────────────
  'notification.pushed':     { id: string; channel: 'dingtalk' | 'wecom' | 'email' | 'system'; eventType: string; success: boolean };
};

type EventKey = keyof AppEventMap;
type Listener<K extends EventKey> = (payload: AppEventMap[K]) => void;

class EventBus {
  private listeners = new Map<EventKey, Set<Listener<EventKey>>>();
  private history: Array<{ event: EventKey; payload: unknown; at: string }> = [];
  private readonly MAX_HISTORY = 200;

  emit<K extends EventKey>(event: K, payload: AppEventMap[K]): void {
    // 历史记录
    this.history.push({ event, payload, at: new Date().toISOString() });
    if (this.history.length > this.MAX_HISTORY) {
      this.history = this.history.slice(-this.MAX_HISTORY);
    }

    const set = this.listeners.get(event);
    if (set) {
      set.forEach((fn) => {
        try {
          (fn as Listener<K>)(payload);
        } catch (err) {
          // 防止单个监听器报错影响其他监听器
          // eslint-disable-next-line no-console
          console.error(`[eventBus] listener for "${String(event)}" threw:`, err);
        }
      });
    }
  }

  on<K extends EventKey>(event: K, fn: Listener<K>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn as Listener<EventKey>);
    return () => {
      set!.delete(fn as Listener<EventKey>);
    };
  }

  /** 一次性监听（首次触发后自动解绑） */
  once<K extends EventKey>(event: K, fn: Listener<K>): void {
    const off = this.on(event, ((payload: AppEventMap[K]) => {
      off();
      fn(payload);
    }) as Listener<K>);
  }

  /** 查看最近 N 条事件（调试用） */
  recent(limit = 30): ReadonlyArray<{ event: EventKey; payload: unknown; at: string }> {
    return this.history.slice(-limit);
  }

  /** 清空所有监听器 + 历史（用于切角色 / 重置场景） */
  clear(): void {
    this.listeners.clear();
    this.history = [];
  }
}

export const eventBus = new EventBus();

if (typeof window !== 'undefined') {
  // 开发态挂到 window，方便 console 调试：window.__eventBus
  (window as unknown as { __eventBus?: EventBus }).__eventBus = eventBus;
}

export type { EventKey, Listener };
