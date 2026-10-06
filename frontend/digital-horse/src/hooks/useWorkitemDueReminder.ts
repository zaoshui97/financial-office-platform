/**
 * useWorkitemDueReminder —— 工单到期催办定时器
 *
 * 每 60 秒扫描一次 meetingWorkItemStore + todoStore：
 *   - 距截止日期 ≤ 1 天的 pending 工单 → 触发外部推送（钉钉/企微/邮件）
 *   - 已催办过的工单通过 reminded 标记去重
 *
 * 用法：在 AppLayout 顶层挂一次即可
 */

import { useEffect, useRef } from 'react';
import { useMeetingWorkItemStore } from '@/store/meetingWorkItemStore';
import { useTodoStore } from '@/store/todoStore';
import { useNotificationStore } from '@/store/notificationStore';
import { dispatchWorkitemDue } from '@/services/notificationDispatchService';
import { usePushChannelConfigStore } from '@/store/pushChannelConfigStore';

const CHECK_INTERVAL_MS = 60_000;        // 每 60 秒扫描一次
const DUE_SOON_DAYS = 1;                  // 距截止日期 ≤ 1 天触发催办
const REMINDER_COOLDOWN_HOURS = 24;       // 同一工单 24 小时内只催办一次

export function useWorkitemDueReminder() {
  const remindedRef = useRef<Map<string, number>>(new Map()); // id → last remind timestamp

  useEffect(() => {
    const scanAndRemind = async () => {
      const now = Date.now();
      const dueThreshold = now + DUE_SOON_DAYS * 86400_000;
      const cooldownMs = REMINDER_COOLDOWN_HOURS * 3600_000;

      // 1. 扫描会议工单
      const meetingItems = useMeetingWorkItemStore.getState().items;
      for (const item of meetingItems) {
        if (item.status !== 'pending') continue;
        const due = new Date(item.dueDate).getTime();
        if (isNaN(due)) continue;
        if (due > dueThreshold) continue;
        const lastRemind = remindedRef.current.get(item.id) || 0;
        if (now - lastRemind < cooldownMs) continue;

        // 触发外部推送
        remindedRef.current.set(item.id, now);
        await dispatchWorkitemDue({
          title: `工单即将到期：${item.title}`,
          content: `会议「${item.meetingTitle}」的工单「${item.title}」将于 ${item.dueDate} 到期，请尽快处理。负责人：${item.assignee}。`,
          workItemId: item.id,
          link: '/approval',
          priority: due < now ? 'urgent' : 'high',
        });
        useNotificationStore.getState().addNotification({
          type: 'urgent',
          title: '工单即将到期',
          content: `${item.title}（截止：${item.dueDate}，负责人：${item.assignee}）`,
          action: [{ label: '查看工单', key: 'view' }],
        });
        usePushChannelConfigStore.getState().recordSent('workitem_due');
      }

      // 2. 扫描 todoStore 待办
      const todos = useTodoStore.getState().items;
      for (const todo of todos) {
        if (todo.status === 'done') continue;
        const due = new Date(todo.dueDate).getTime();
        if (isNaN(due)) continue;
        if (due > dueThreshold) continue;
        const todoKey = `todo_${todo.id}`;
        const lastRemind = remindedRef.current.get(todoKey) || 0;
        if (now - lastRemind < cooldownMs) continue;

        remindedRef.current.set(todoKey, now);
        await dispatchWorkitemDue({
          title: `待办即将到期：${todo.description.slice(0, 30)}`,
          content: `待办将于 ${todo.dueDate} 到期，负责人：${todo.assigneeName}。`,
          link: '/dashboard',
          priority: due < now ? 'urgent' : 'high',
        });
        useNotificationStore.getState().addNotification({
          type: 'urgent',
          title: '待办即将到期',
          content: `${todo.description}（截止：${todo.dueDate}）`,
        });
        usePushChannelConfigStore.getState().recordSent('workitem_due');
      }
    };

    // 立即跑一次，5 秒后开始（让应用先初始化完）
    const initialTimer = window.setTimeout(scanAndRemind, 5_000);
    const interval = window.setInterval(scanAndRemind, CHECK_INTERVAL_MS);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, []);
}
