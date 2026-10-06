/**
 * Push Channel Config Store —— 外部推送渠道配置
 *
 * 功能：
 *   - 系统管理员为每个事件类型配置：是否开启推送、推送渠道、接收人
 *   - 持久化到 localStorage，刷新后保留
 *   - 提供 getConfigForEvent() 给 notificationDispatchService 读取
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { NotificationEventType, PushChannel } from '@/services/notificationDispatchService';

export interface EventChannelConfig {
  /** 事件类型 */
  eventType: NotificationEventType;
  /** 事件中文名 */
  label: string;
  /** 事件描述 */
  description: string;
  /** 总开关 */
  enabled: boolean;
  /** 各渠道开关 */
  channels: Record<PushChannel, boolean>;
  /** 接收人列表（钉钉 userId / 企业微信 userId / 邮箱地址） */
  recipients: string[];
  /** 最近一次推送时间（统计用） */
  lastSentAt?: string;
}

interface PushChannelConfigState {
  configs: Record<NotificationEventType, EventChannelConfig>;
  // 更新某事件的总开关
  toggleEvent: (eventType: NotificationEventType, enabled: boolean) => void;
  // 更新某事件某渠道开关
  toggleChannel: (eventType: NotificationEventType, channel: PushChannel, enabled: boolean) => void;
  // 更新接收人
  setRecipients: (eventType: NotificationEventType, recipients: string[]) => void;
  // 记录最近推送时间
  recordSent: (eventType: NotificationEventType) => void;
  // 读取某事件配置
  getConfigForEvent: (eventType: NotificationEventType) => EventChannelConfig;
  // 全量替换（导入用）
  reset: () => void;
}

// ============================================================
// 默认配置：所有事件默认开启「钉钉 + 邮件」，企业微信默认关闭
// ============================================================

const defaultConfigs: Record<NotificationEventType, EventChannelConfig> = {
  meeting_todo: {
    eventType: 'meeting_todo',
    label: '会议待办生成',
    description: '会议结束后产生待办工单时，自动推送',
    enabled: true,
    channels: { dingtalk: true, wecom: false, email: true },
    recipients: ['manager@company.com', 'team-lead'],
  },
  workitem_due: {
    eventType: 'workitem_due',
    label: '工单到期催办',
    description: '工单距截止日期 ≤ 1 天时自动催办',
    enabled: true,
    channels: { dingtalk: true, wecom: true, email: true },
    recipients: ['admin@company.com', 'ops-team'],
  },
  approval_change: {
    eventType: 'approval_change',
    label: '审批状态变更',
    description: '审批待审批 / 通过 / 驳回时通知相关人',
    enabled: true,
    channels: { dingtalk: true, wecom: false, email: true },
    recipients: ['approver@company.com'],
  },
  sandbox_critical: {
    eventType: 'sandbox_critical',
    label: '沙箱高危合规告警',
    description: '合规沙箱检测到阻断级违规时紧急推送',
    enabled: true,
    channels: { dingtalk: true, wecom: true, email: true },
    recipients: ['compliance-officer@company.com', 'cto'],
  },
  risk_alert: {
    eventType: 'risk_alert',
    label: '监管情报重大风险',
    description: '行业资讯识别出重大监管风险事件',
    enabled: true,
    channels: { dingtalk: true, wecom: true, email: true },
    recipients: ['compliance-officer@company.com', 'risk-team'],
  },
};

export const usePushChannelConfigStore = create<PushChannelConfigState>()(
  persist(
    (set, get) => ({
      configs: defaultConfigs,

      toggleEvent: (eventType, enabled) => {
        set((state) => ({
          configs: {
            ...state.configs,
            [eventType]: { ...state.configs[eventType], enabled },
          },
        }));
      },

      toggleChannel: (eventType, channel, enabled) => {
        set((state) => ({
          configs: {
            ...state.configs,
            [eventType]: {
              ...state.configs[eventType],
              channels: { ...state.configs[eventType].channels, [channel]: enabled },
            },
          },
        }));
      },

      setRecipients: (eventType, recipients) => {
        set((state) => ({
          configs: {
            ...state.configs,
            [eventType]: { ...state.configs[eventType], recipients },
          },
        }));
      },

      recordSent: (eventType) => {
        set((state) => ({
          configs: {
            ...state.configs,
            [eventType]: { ...state.configs[eventType], lastSentAt: new Date().toISOString() },
          },
        }));
      },

      getConfigForEvent: (eventType) => get().configs[eventType],

      reset: () => set({ configs: defaultConfigs }),
    }),
    {
      name: 'push-channel-config-storage',
      version: 1,
    }
  )
);
