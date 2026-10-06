/**
 * 会议黑板 WebSocket 客户端（Phase 3）
 *
 * 设计：
 *   1) 服务端 push 三类消息：
 *      - "snapshot"          { session_id, states } — 连接初始全量快照
 *      - "blackboard_update" { session_id, agent_role, state, version } — 实时变更
 *      - "ping"              { ts } — 心跳（无需回 pong，协议层保活）
 *   2) 客户端事件回调：
 *      - onSnapshot(states)
 *      - onUpdate(agent_role, state, version)
 *   3) 重连策略：指数退避 1s → 2s → 5s → 10s → 30s（封顶）
 *   4) 增量同步：重连后用本地缓存的最大 event id（通过 state.version 推断）
 *      → 拉 /blackboard/events 补齐 → apply 到本地
 *
 * 注意：
 *   - state 里含 event_type 字段（"moderator_updated" 等），可辅助前端分类渲染
 *   - 服务端同步派发，乱序风险低；前端只需按 version 覆盖即可
 */

import { meetingApi, AgentRole, BlackboardEventItem } from '@/api/meeting';

export type WSMessage =
  | {
      type: 'snapshot';
      session_id: number;
      states: Record<AgentRole, Record<string, unknown>>;
    }
  | {
      type: 'blackboard_update';
      session_id: number;
      agent_role: AgentRole;
      state: Record<string, unknown>;
      version: number;
      ts: string;
    }
  | { type: 'ping'; ts: string };

export interface MeetingWSOptions {
  meetingId: number;
  token: string;
  /** 自定义 ws base（如测试用 mock） */
  baseUrl?: string;
  onSnapshot?: (states: Record<string, Record<string, unknown>>) => void;
  onUpdate?: (
    agentRole: AgentRole,
    state: Record<string, unknown>,
    version: number,
  ) => void;
  onError?: (err: Event) => void;
  onClose?: () => void;
  onAuthFailure?: (reason: 'token_expired' | 'unauthorized') => void;
}

export class MeetingWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private closed = false;
  private localMaxEventId = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  /** 鉴权失败标记：true 后不再重连（避免死循环）。 */
  private authFailed = false;

  constructor(private readonly opts: MeetingWSOptions) {}

  connect(): void {
    if (this.authFailed) return;
    this.closed = false;
    const url = this.buildUrl();
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempts = 0;
      // 增量同步：拿 since_event_id = localMaxEventId
      this.replayMissedEvents().catch((e) =>
        console.warn('[meeting-ws] 回放事件失败', e),
      );
    };

    ws.onmessage = (ev) => {
        let msg: WSMessage | { type: 'token_expired' | 'token_expiring'; ts: string; remaining_seconds?: number };
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        // 服务端主动推送鉴权事件
        if ('type' in msg && msg.type === 'token_expired') {
          this.authFailed = true;
          this.opts.onAuthFailure?.('token_expired');
          this.close();
          return;
        }
        if ('type' in msg && msg.type === 'token_expiring') {
          // 仅警告，不主动断
          console.warn('[meeting-ws] token 即将过期', (msg as any).remaining_seconds);
          return;
        }
        this.handleMessage(msg as WSMessage);
      };

    ws.onerror = (err) => {
      this.opts.onError?.(err);
    };

    ws.onclose = (ev) => {
      this.cleanupHeartbeat();
      this.opts.onClose?.();
      // 401 / 4001 等鉴权失败 close code → 不重连
      if (ev.code === 1008 || ev.code === 4401) {
        this.authFailed = true;
        this.opts.onAuthFailure?.('unauthorized');
        return;
      }
      if (!this.closed && !this.authFailed) this.scheduleReconnect();
    };
  }

  close(): void {
    this.closed = true;
    this.cleanupHeartbeat();
    this.ws?.close();
    this.ws = null;
  }

  /** 拿当前本地缓存最大 event id（用于增量同步）。 */
  getLocalMaxEventId(): number {
    return this.localMaxEventId;
  }

  private handleMessage(msg: WSMessage): void {
    switch (msg.type) {
      case 'snapshot':
        this.opts.onSnapshot?.(msg.states);
        break;
      case 'blackboard_update':
        // 触发链的 chain event 携带 source_role 用 state 字段推断
        this.opts.onUpdate?.(msg.agent_role, msg.state, msg.version);
        break;
      case 'ping':
        // 服务端主动探测，客户端不需要响应
        break;
    }
  }

  private async replayMissedEvents(): Promise<void> {
    // 仅当本地有缓存过事件时才有意义（首次连接 localMaxEventId=0 → 拉全部）
    try {
      const resp = await meetingApi.listBlackboardEvents(
        this.opts.meetingId,
        { since_event_id: this.localMaxEventId },
      );
      // 补齐历史事件
      for (const ev of resp.events) {
        this.opts.onUpdate?.(ev.agent_role, ev.state, ev.version);
        if (ev.id > this.localMaxEventId) this.localMaxEventId = ev.id;
      }
      // 翻页
      while (resp.has_more) {
        const next = await meetingApi.listBlackboardEvents(
          this.opts.meetingId,
          { since_event_id: this.localMaxEventId },
        );
        for (const ev of next.events) {
          this.opts.onUpdate?.(ev.agent_role, ev.state, ev.version);
          if (ev.id > this.localMaxEventId) this.localMaxEventId = ev.id;
        }
        if (!next.has_more) break;
      }
    } catch (e) {
      // 增量失败不影响主连接
      throw e;
    }
  }

  private buildUrl(): string {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const base =
      this.opts.baseUrl ||
      (import.meta.env.VITE_WS_BASE_URL as string | undefined) ||
      `${proto}://${window.location.host}/api/v1`;
    return `${base}/meetings/ws/${this.opts.meetingId}?token=${encodeURIComponent(this.opts.token)}`;
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts += 1;
    const delays = [1000, 2000, 5000, 10000, 30000];
    const delay =
      delays[Math.min(this.reconnectAttempts - 1, delays.length - 1)];
    setTimeout(() => {
      if (!this.closed) this.connect();
    }, delay);
  }

  private cleanupHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}