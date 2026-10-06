import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const USE_MOCK: boolean = import.meta.env.VITE_USE_MOCK === 'true';

export type NotificationType = 'urgent' | 'meeting' | 'ai' | 'system' | 'risk' | 'todo';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  content: string;
  timestamp: string; // ISO string for persist
  read: boolean;
  action?: { label: string; key: string }[];
  /** 业务单据引用（用于跳转联动） */
  businessRef?: {
    type: 'meeting' | 'report' | 'approval' | 'news' | 'todo';
    id: string;
  };
  /** 本次通知关联的外部推送结果（用于通知中心展示推送状态） */
  pushResult?: {
    dispatchId: string;
    channelResults: Partial<Record<import('@/services/notificationDispatchService').PushChannel, {
      ok: boolean;
      error?: string;
      sentAt?: string;
    }>>;
    attemptedAt: string;
  };
}

interface NotificationState {
  notifications: Notification[];
  // actions
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAll: () => void;
  addNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  // computed
  unreadCount: () => number;
}

const initialNotifications: Notification[] = [
  {
    id: '1',
    type: 'todo',
    title: '「设备采购审批」即将到期',
    content: '任务将在 2 小时后到期，请尽快处理，避免影响项目进度',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    read: false,
    action: [
      { label: '查看任务', key: 'view' },
      { label: '一键完成', key: 'complete' },
    ],
    businessRef: { type: 'todo', id: 'todo-equipment-procurement' },
  },
  {
    id: '2',
    type: 'meeting',
    title: '会议提醒：5 分钟后开始',
    content: 'Q4 预算审批会议 · 主讲人：财务总监 · 已确认参会 8 人',
    timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    read: false,
    action: [
      { label: '加入会议', key: 'join' },
      { label: '推迟 15 分钟', key: 'delay' },
    ],
    businessRef: { type: 'meeting', id: 'meeting-q4-budget' },
  },
  {
    id: '3',
    type: 'ai',
    title: 'AI 智能体有新动态',
    content: '你收藏的「衍生品监管合规审查」话题，AI 已生成 3 条最新解读',
    timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    read: false,
    action: [
      { label: '查看详情', key: 'view' },
      { label: '取消收藏', key: 'unfavorite' },
    ],
  },
  {
    id: '4',
    type: 'urgent',
    title: '合规风险预警',
    content: '上周合规沙箱检测发现 3 条阻断级违规，已自动上报至合规委员会',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    read: false,
    action: [
      { label: '立即查看', key: 'view' },
    ],
  },
  {
    id: '5',
    type: 'meeting',
    title: '会议邀请待确认',
    content: '张总邀请你参加「年度风险复盘会」，时间：本周五 14:00 - 16:00',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    read: false,
    action: [
      { label: '接受', key: 'accept' },
      { label: '婉拒', key: 'decline' },
    ],
    businessRef: { type: 'meeting', id: 'meeting-annual-risk-review' },
  },
  {
    id: '6',
    type: 'ai',
    title: '文档生成完成',
    content: '你的「Q3 工作报告」已自动生成并通过合规检查，可一键提交',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    read: false,
    action: [
      { label: '查看文档', key: 'view' },
      { label: '立即提交', key: 'submit' },
    ],
  },
  {
    id: '7',
    type: 'ai',
    title: 'AI 知识库更新',
    content: '本周新增 12 篇行业报告，覆盖资管新规、反洗钱、ESG 等热门话题',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    read: true,
    action: [
      { label: '浏览报告', key: 'view' },
    ],
  },
  {
    id: '8',
    type: 'meeting',
    title: '会议已开始',
    content: '周例会 · 技术团队 已开始，已参会 6/12 人',
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    read: true,
    action: [
      { label: '加入会议', key: 'join' },
    ],
  },
  {
    id: '9',
    type: 'system',
    title: '系统通知：角色已更新',
    content: '你的角色已从「普通用户」更新为「部门管理员」，权限范围已生效',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    read: true,
  },
  {
    id: '10',
    type: 'urgent',
    title: '安全中心告警',
    content: '检测到 1 次异常登录尝试，登录地：境外 IP，请确认是否本人操作',
    timestamp: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    read: true,
    action: [
      { label: '查看详情', key: 'view' },
      { label: '不是我，立即冻结', key: 'freeze' },
    ],
  },
];

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: USE_MOCK ? initialNotifications : [],

      markAsRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),

      markAllAsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        })),

      deleteNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),

      clearAll: () => set({ notifications: [] }),

      addNotification: (n) =>
        set((state) => ({
          notifications: [
            {
              ...n,
              id: Date.now().toString(),
              timestamp: new Date().toISOString(),
              read: false,
            },
            ...state.notifications,
          ],
        })),

      unreadCount: () => get().notifications.filter((n) => !n.read).length,
    }),
    {
      name: 'notification-storage',
      version: 2,
      migrate: (persistedState, version) => {
        // mock 模式下永远用最新 mock 覆盖；真实模式按版本升级后保留空让后端接管
        if (USE_MOCK) return { notifications: initialNotifications };
        if (version < 2) return { notifications: [] };
        return persistedState as NotificationState;
      },
    }
  )
);
