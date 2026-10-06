/**
 * Notification Dispatch Service —— 外部办公系统推送（钉钉 / 企业微信 / 邮件）
 *
 * 一期：仅消息通知推送（SSO 单点登录放到二期）
 *
 * API 契约：
 *   POST /api/v1/notifications/send
 *   body: {
 *     eventType: 'meeting_todo' | 'workitem_due' | 'approval_change' | 'sandbox_critical' | 'risk_alert',
 *     channels: ('dingtalk' | 'wecom' | 'email')[],
 *     recipients: string[],    // 钉钉 userId / 企业微信 userId / 邮箱地址
 *     payload: {
 *       title: string,
 *       content: string,
 *       businessRef?: { type, id, title },
 *       link?: string,        // 业务跳转链接
 *       priority?: 'normal' | 'high' | 'urgent',
 *     },
 *     sourceNotificationId?: string,  // 系统内通知 ID，便于关联
 *   }
 *   response: { success: boolean, dispatchId: string, channelResults: Record<Channel, { ok, messageId?, error? }> }
 *
 * 真实对接时：把 mock 内部实现替换为 axios.post('/api/v1/notifications/send', ...)
 */

import { usePushChannelConfigStore } from '@/store/pushChannelConfigStore';
import { useDispatchLogStore } from '@/store/dispatchLogStore';
import { eventBus } from './eventBus';
import { generateId } from '@/utils/format';

export type PushChannel = 'dingtalk' | 'wecom' | 'email';
export type NotificationEventType =
  | 'meeting_todo'          // 会议待办生成
  | 'workitem_due'          // 工单到期催办
  | 'approval_change'       // 审批状态变更
  | 'sandbox_critical'      // 沙箱高危合规告警
  | 'risk_alert';           // 监管情报重大风险预警

export interface PushPayload {
  title: string;
  content: string;
  businessRef?: { type: 'meeting' | 'report' | 'approval' | 'news' | 'todo'; id: string; title?: string };
  link?: string;
  priority?: 'normal' | 'high' | 'urgent';
}

export interface PushRequest {
  eventType: NotificationEventType;
  channels: PushChannel[];
  recipients: string[];
  payload: PushPayload;
  sourceNotificationId?: string;
}

export interface PushChannelResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  sentAt?: string;
}

export interface PushResponse {
  success: boolean;
  dispatchId: string;
  channelResults: Partial<Record<PushChannel, PushChannelResult>>;
}

// ============================================================
// 内部 mock 实现：每个渠道都模拟 90% 成功率
// ============================================================

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function mockSendToChannel(
  channel: PushChannel,
  req: PushRequest
): Promise<PushChannelResult> {
  await delay(300 + Math.random() * 500); // 300-800ms

  const ok = Math.random() > 0.1; // 90% 成功

  const channelNames: Record<PushChannel, string> = {
    dingtalk: '钉钉',
    wecom: '企业微信',
    email: '邮件',
  };

  if (!ok) {
    return {
      ok: false,
      error: `${channelNames[channel]}推送失败：网络超时`,
    };
  }

  return {
    ok: true,
    messageId: `${channel}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sentAt: new Date().toISOString(),
  };
}

// ============================================================
// 对外函数：dispatchNotification —— 触发外部推送
//
// 用法：
//   import { dispatchNotification } from '@/services/notificationDispatchService';
//   await dispatchNotification({ eventType, ... });
//
// 内部会自动读取 pushChannelConfigStore 配置（是否开启 + 接收人）
// 如果没有显式传 channels，会从配置中推断
// ============================================================

export interface DispatchOptions {
  /** 不读配置，直接发送（用于系统级强制推送） */
  force?: boolean;
}

export async function dispatchNotification(
  req: PushRequest,
  options: DispatchOptions = {}
): Promise<PushResponse> {
  const dispatchId = generateId('dispatch');

  // 1. 如果没有显式指定 channels，从配置读取
  let channels = req.channels;
  let recipients = req.recipients;
  if (!options.force && (channels.length === 0 || recipients.length === 0)) {
    const config = usePushChannelConfigStore.getState().getConfigForEvent(req.eventType);
    if (!config || !config.enabled) {
      // 配置未启用 → 跳过外部推送
      return {
        success: false,
        dispatchId,
        channelResults: {
          dingtalk: { ok: false, error: '钉钉渠道未启用' },
          wecom: { ok: false, error: '企业微信渠道未启用' },
          email: { ok: false, error: '邮件渠道未启用' },
        },
      };
    }
    channels = (Object.keys(config.channels) as PushChannel[]).filter((c) => config.channels[c]);
    recipients = config.recipients;
  }

  // 2. 并发推送到所有渠道
  const channelResults: Partial<Record<PushChannel, PushChannelResult>> = {};
  await Promise.all(
    channels.map(async (ch) => {
      channelResults[ch] = await mockSendToChannel(ch, req);
      // 仿真日志：每次推送都写入 dispatchLogStore + 触发事件总线
      const result = channelResults[ch]!;
      useDispatchLogStore.getState().append({
        channel: ch,
        eventType: req.eventType,
        title: req.payload.title,
        content: req.payload.content,
        recipients,
        success: !!result.ok,
        error: result.error,
        link: req.payload.link,
        businessRef: req.payload.businessRef,
      });
      eventBus.emit('notification.pushed', {
        id: result.messageId || dispatchId,
        channel: ch,
        eventType: req.eventType,
        success: !!result.ok,
      });
    })
  );

  const allOk = Object.values(channelResults).every((r) => r?.ok);

  return {
    success: allOk,
    dispatchId,
    channelResults,
  };
}

// ============================================================
// 便捷方法：按事件类型快捷触发（自动读取配置）
// ============================================================

export async function dispatchMeetingTodo(payload: {
  title: string;
  content: string;
  meetingId?: string;
  link?: string;
}) {
  return dispatchNotification({
    eventType: 'meeting_todo',
    channels: [],
    recipients: [],
    payload: {
      title: payload.title,
      content: payload.content,
      link: payload.link,
      businessRef: payload.meetingId
        ? { type: 'meeting', id: payload.meetingId, title: payload.title }
        : undefined,
    },
  });
}

export async function dispatchWorkitemDue(payload: {
  title: string;
  content: string;
  workItemId?: string;
  link?: string;
  priority?: 'high' | 'urgent';
}) {
  return dispatchNotification({
    eventType: 'workitem_due',
    channels: [],
    recipients: [],
    payload: {
      title: payload.title,
      content: payload.content,
      link: payload.link,
      priority: payload.priority || 'high',
    },
  });
}

export async function dispatchApprovalChange(payload: {
  title: string;
  content: string;
  approvalId?: string;
  status: 'pending' | 'approved' | 'rejected';
  link?: string;
}) {
  return dispatchNotification({
    eventType: 'approval_change',
    channels: [],
    recipients: [],
    payload: {
      title: payload.title,
      content: payload.content,
      link: payload.link,
      businessRef: payload.approvalId
        ? { type: 'approval', id: payload.approvalId, title: payload.title }
        : undefined,
    },
  });
}

export async function dispatchSandboxCritical(payload: {
  title: string;
  content: string;
  link?: string;
  priority?: 'urgent';
}) {
  return dispatchNotification({
    eventType: 'sandbox_critical',
    channels: [],
    recipients: [],
    payload: {
      title: payload.title,
      content: payload.content,
      link: payload.link,
      priority: payload.priority || 'urgent',
    },
  });
}

export async function dispatchRiskAlert(payload: {
  title: string;
  content: string;
  newsId?: string;
  link?: string;
}) {
  return dispatchNotification({
    eventType: 'risk_alert',
    channels: [],
    recipients: [],
    payload: {
      title: payload.title,
      content: payload.content,
      link: payload.link,
      businessRef: payload.newsId
        ? { type: 'news', id: payload.newsId, title: payload.title }
        : undefined,
    },
  });
}
