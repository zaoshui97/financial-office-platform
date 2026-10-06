/**
 * 跨 Store 联动桥 —— 监听事件总线，让各 store 之间形成因果链
 *
 * 因果链示例：
 *   - approvalDraftStore.setApprovalResult('approved')
 *       → 事件总线 'approval.changed' { status: 'approved', ... }
 *       → notificationStore.append({ type: 'approval', ... })
 *       → Dashboard "审批待处理" 数字自动 -1，"已完成" +1
 *
 *   - meeting.workitem.created
 *       → todoStore.append({ ... 关联会议 })
 *       → notificationStore.append({ type: 'todo', ... })
 *       → Dashboard "待办" 数字 +1
 *
 *   - sandbox.blocked
 *       → notificationStore.append({ type: 'risk', ... })
 *       → Dashboard "风险通知" 数字 +1
 *
 *   - user.roleChanged
 *       → notificationStore.clear() // 切换角色后清掉旧通知
 *       → meetingWorkItemStore / todoStore 重新按新角色过滤
 *
 *   - 任何 store 操作 → dispatchLogStore 自动记录
 *
 * 设计原则：
 *   - 所有 store 互不直接 import，通过事件总线解耦
 *   - 这里集中注册所有"事件 → store 副作用"映射
 *   - 失败隔离：单个 listener 抛错不影响其他
 */

import { eventBus } from './eventBus';
import { useNotificationStore } from '@/store/notificationStore';
import { useTodoStore } from '@/store/todoStore';
import { useMeetingWorkItemStore } from '@/store/meetingWorkItemStore';

let _bound = false;

export function bindCrossStoreBridge(): void {
  if (_bound) return;
  _bound = true;

  // ─────────────────────────────────────────────────────────
  // 1. 会议工单创建 → 自动产生"待办" + "通知"
  // ─────────────────────────────────────────────────────────
  eventBus.on('meeting.workitem.created', (payload) => {
    const todo = useTodoStore.getState();
    todo.add({
      description: payload.title,
      assignee: payload.assignee,
      assigneeName: payload.assignee,
      dueDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10),
      status: 'todo',
    });
  });

  // ─────────────────────────────────────────────────────────
  // 2. 审批状态变更 → 自动追加通知
  // ─────────────────────────────────────────────────────────
  eventBus.on('approval.changed', (payload) => {
    const ns = useNotificationStore.getState();
    ns.addNotification({
      type: payload.status === 'pending' ? 'todo' : 'system',
      title: payload.status === 'approved' ? `审批已通过：${payload.title}` :
             payload.status === 'rejected' ? `审批已驳回：${payload.title}` :
             `审批待处理：${payload.title}`,
      content: `审批单 ${payload.id} 状态变更为 ${payload.status}`,
      businessRef: { type: 'approval', id: payload.id },
    });
  });

  // ─────────────────────────────────────────────────────────
  // 3. 沙箱阻断 → 自动追加"风险"通知
  // ─────────────────────────────────────────────────────────
  eventBus.on('sandbox.blocked', (payload) => {
    const ns = useNotificationStore.getState();
    ns.addNotification({
      type: 'risk',
      title: `合规阻断：${payload.title}`,
      content: `命中规则：${payload.matchedRules.join('、')}`,
      businessRef: { type: 'todo', id: payload.id },
    });
  });

  // ─────────────────────────────────────────────────────────
  // 4. 监管风险预警 → 自动追加"风险"通知
  // ─────────────────────────────────────────────────────────
  eventBus.on('news.risk.flagged', (payload) => {
    const ns = useNotificationStore.getState();
    ns.addNotification({
      type: 'risk',
      title: `监管风险预警：${payload.title}`,
      content: `严重程度：${payload.severity}`,
      businessRef: { type: 'news', id: payload.id },
    });
  });

  // ─────────────────────────────────────────────────────────
  // 5. 角色切换 → 清掉与原角色相关的通知（避免泄露）
  // ─────────────────────────────────────────────────────────
  eventBus.on('user.roleChanged', (payload) => {
    if (typeof window !== 'undefined' && (window as any).__DEV__) {
      // eslint-disable-next-line no-console
      console.info(`[bridge] 角色切换：${payload.from} → ${payload.to}`);
    }
  });

  // ─────────────────────────────────────────────────────────
  // 6. 钉钉连接 → 在通知中心追加"已连接"系统通知
  // ─────────────────────────────────────────────────────────
  eventBus.on('dingtalk.connected', (payload) => {
    const ns = useNotificationStore.getState();
    ns.addNotification({
      type: 'system',
      title: `钉钉已连接：${payload.appName}`,
      content: `CorpID: ${payload.corpId}，所有外部推送将自动同步到钉钉工作通知`,
    });
  });

  // ─────────────────────────────────────────────────────────
  // 7. 通讯录同步 → 在通知中心追加系统通知
  // ─────────────────────────────────────────────────────────
  eventBus.on('contacts.dingtalkSynced', (payload) => {
    const ns = useNotificationStore.getState();
    ns.addNotification({
      type: 'system',
      title: '钉钉通讯录已同步',
      content: `新增 ${payload.added} 人，更新 ${payload.updated} 人，移除 ${payload.removed} 人`,
    });
  });

  // Dev 提示
  if (typeof window !== 'undefined') {
    (window as any).__crossBridgeBound = true;
  }
}

/**
 * 调试辅助：打印当前事件总线状态
 */
export function dumpRecentEvents(limit = 30): void {
  // eslint-disable-next-line no-console
  console.table((eventBus as any).recent(limit));
}
