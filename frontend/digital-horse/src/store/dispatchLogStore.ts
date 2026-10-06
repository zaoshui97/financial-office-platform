/**
 * 推送日志 Store —— 仿真可视化推送历史
 *
 * 用途：
 *   - 记录所有外部推送（钉钉 / 企微 / 邮件 / 系统）的尝试结果
 *   - 通知中心 / Dashboard / 设置页可查看最近 N 条
 *   - 事件总线 notification.pushed 自动写入
 *
 * 容量：最近 200 条（FIFO）
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { eventBus } from '@/services/eventBus';

export type LogChannel = 'dingtalk' | 'wecom' | 'email' | 'system' | 'inapp';

export interface DispatchLogEntry {
  /** 唯一 ID */
  id: string;
  /** 推送渠道 */
  channel: LogChannel;
  /** 事件类型 */
  eventType: string;
  /** 业务标题 */
  title: string;
  /** 业务内容摘要 */
  content: string;
  /** 接收人 */
  recipients: string[];
  /** 是否成功 */
  success: boolean;
  /** 错误信息（失败时） */
  error?: string;
  /** 推送时间 */
  sentAt: string;
  /** 业务跳转链接 */
  link?: string;
  /** 业务类型（用于反查） */
  businessRef?: {
    type: 'meeting' | 'approval' | 'report' | 'news' | 'todo' | 'workitem';
    id: string;
    title?: string;
  };
}

interface DispatchLogState {
  logs: DispatchLogEntry[];

  /** 新增一条日志（自动 trim 到 200） */
  append: (entry: Omit<DispatchLogEntry, 'id' | 'sentAt'> & { sentAt?: string }) => void;
  /** 清空 */
  clear: () => void;
  /** 按渠道过滤 */
  getByChannel: (channel: LogChannel) => DispatchLogEntry[];
  /** 按事件类型过滤 */
  getByEventType: (eventType: string) => DispatchLogEntry[];
  /** 最近 N 条 */
  recent: (limit?: number) => DispatchLogEntry[];
}

const MAX_LOGS = 200;

export const useDispatchLogStore = create<DispatchLogState>()(
  persist(
    (set, get) => ({
      logs: [],

      append: (entry) => {
        const id = `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const sentAt = entry.sentAt || new Date().toISOString();
        const full: DispatchLogEntry = { ...entry, id, sentAt };
        set((state) => {
          const next = [full, ...state.logs];
          return { logs: next.slice(0, MAX_LOGS) };
        });
      },

      clear: () => set({ logs: [] }),

      getByChannel: (channel) => get().logs.filter((l) => l.channel === channel),
      getByEventType: (eventType) => get().logs.filter((l) => l.eventType === eventType),
      recent: (limit = 30) => get().logs.slice(0, limit),
    }),
    {
      name: 'dispatch-log-storage',
      version: 1,
    }
  )
);

// ============================================================
// 自动订阅事件总线（任何模块 dispatchXxx() 后自动落日志）
// ============================================================

let _eventBusBound = false;

export function bindDispatchLogToEventBus(): void {
  if (_eventBusBound) return;
  _eventBusBound = true;

  // 钉钉 / 企微 / 邮件推送事件
  eventBus.on('notification.pushed', (payload) => {
    const { id, channel, eventType, success } = payload;
    useDispatchLogStore.getState().append({
      channel,
      eventType,
      title: success ? `${channel} 推送成功` : `${channel} 推送失败`,
      content: success ? `已向接收人发送业务通知（消息 ID：${id}）` : '推送失败，请检查网络或凭证',
      recipients: [],
      success,
    });
  });

  // 钉钉连接事件
  eventBus.on('dingtalk.connected', (payload) => {
    useDispatchLogStore.getState().append({
      channel: 'dingtalk',
      eventType: 'dingtalk.connected',
      title: `钉钉已连接：${payload.appName}`,
      content: `企业 CorpID：${payload.corpId}`,
      recipients: [],
      success: true,
    });
  });

  eventBus.on('dingtalk.disconnected', () => {
    useDispatchLogStore.getState().append({
      channel: 'dingtalk',
      eventType: 'dingtalk.disconnected',
      title: '钉钉已断开',
      content: '已清除钉钉登录态，所有工作通知将暂停发送',
      recipients: [],
      success: true,
    });
  });
}
