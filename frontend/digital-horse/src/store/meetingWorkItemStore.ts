/**
 * Meeting Approval Bridge —— 会议工单 ↔ 审批的桥接 store
 *
 * 场景：
 *   - 会议结束 → 自动派单 → 部分 action 触发"发起审批"草稿
 *   - 审批被通过/驳回 → 回写到对应的会议工单
 *   - 会议报告中展示对应工单的"闭环状态"
 *
 * 这是会议协同 ↔ 智能审批助手 双向联动的核心存储。
 *
 * 深化（业务闭环）：
 *   - 工单生命周期扩展为 6 态：assigned → pending → in_progress → reviewing → approved / rejected
 *   - 每条工单记录关联的会议转写片段 ID（meetingSegmentId），支持"点击工单回溯会议原文"
 *   - store 内置 Metrics 计算方法：平均闭环时长 / 滞留工单数 / 异常派单率
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** 工单生命周期 6 态 */
export type WorkItemCloseStatus =
  | 'assigned'      // 已派单（待领取）
  | 'pending'       // 待处理（已认领，未开始）
  | 'in_progress'   // 进行中
  | 'reviewing'     // 待复核（执行人完成，等待主管审核）
  | 'approved'      // 已通过
  | 'rejected';     // 已驳回

/** 6 态中文标签 */
export const WORKITEM_STATUS_LABELS: Record<WorkItemCloseStatus, string> = {
  assigned: '待领取',
  pending: '待处理',
  in_progress: '进行中',
  reviewing: '待复核',
  approved: '已通过',
  rejected: '已驳回',
};

/** 6 态对应的 Tag 颜色 */
export const WORKITEM_STATUS_COLORS: Record<WorkItemCloseStatus, string> = {
  assigned: 'default',
  pending: 'blue',
  in_progress: 'processing',
  reviewing: 'gold',
  approved: 'success',
  rejected: 'error',
};

export interface MeetingWorkItem {
  /** 工单唯一 ID（= ApprovalDraft.id，方便联动） */
  id: string;
  /** 关联会议 ID */
  meetingId: string;
  /** 关联会议标题（仅展示） */
  meetingTitle: string;
  /** 工单标题（通常是 action.description） */
  title: string;
  /** 工单描述/正文 */
  text: string;
  /** 工单负责人 */
  assignee: string;
  /** 负责人部门（用于 dept 数据权限） */
  assigneeDept?: string;
  /** 截止日期 ISO */
  dueDate: string;
  /** 优先级 */
  priority: 'low' | 'medium' | 'high';
  /** 当前闭环状态 */
  status: WorkItemCloseStatus;
  /** 创建时间 ISO */
  createdAt: string;
  /** 状态变更时间 ISO（用于计算滞留 / 平均闭环） */
  updatedAt?: string;
  /** 闭环时间（approved/rejected 时填入） */
  closedAt?: string;
  /** 闭环备注（驳回原因等） */
  closeNote?: string;
  /** 关联会议转写片段 ID（用于点击工单回溯到会议原文） */
  meetingSegmentId?: string;
  /** 关联会议原文中触发工单的关键词或片段（前 80 字） */
  meetingSegmentSnippet?: string;
}

/** 闭环指标（演示模式 demo 数据 + 实时计算混合） */
export interface WorkItemMetrics {
  /** 总工单数 */
  total: number;
  /** 各状态数量 */
  byStatus: Record<WorkItemCloseStatus, number>;
  /** 已闭环工单数 */
  closed: number;
  /** 进行中工单数 */
  inFlight: number;
  /** 平均闭环时长（小时） */
  avgCloseHours: number;
  /** 滞留工单数（in_progress 超过 72 小时未推进） */
  stuckCount: number;
  /** 异常派单率（rejected / closed）—— 期望 < 10% */
  rejectRate: number;
  /** 各部门工单分布 */
  byDept: Record<string, number>;
}

interface MeetingWorkItemState {
  /** 所有会议工单（按创建时间倒序） */
  items: MeetingWorkItem[];
  /** 创建工单（会议会后调用） */
  createWorkItem: (item: Omit<MeetingWorkItem, 'id' | 'status' | 'createdAt' | 'updatedAt'>) => MeetingWorkItem;
  /** 批量创建（一次会议可能产生多个工单） */
  bulkCreate: (items: Array<Omit<MeetingWorkItem, 'id' | 'status' | 'createdAt' | 'updatedAt'>>) => MeetingWorkItem[];
  /** 更新工单状态（审批完成/驳回时回调） */
  setStatus: (id: string, status: WorkItemCloseStatus, note?: string) => void;
  /** 按会议 ID 查全部工单 */
  listByMeeting: (meetingId: string) => MeetingWorkItem[];
  /** 按 ID 查工单 */
  getById: (id: string) => MeetingWorkItem | undefined;
  /** 已闭环统计 */
  countClosedByMeeting: (meetingId: string) => number;
  /** 计算闭环指标 */
  metrics: () => WorkItemMetrics;
  /** 关联会议转写片段（按工单 meetingSegmentId） */
  getMeetingSegment: (workItemId: string) => MeetingSegment | undefined;
}

/** 会议转写片段（简化结构，演示模式） */
export interface MeetingSegment {
  segmentId: string;
  meetingId: string;
  /** 说话人 */
  speaker: string;
  /** 原文 */
  text: string;
  /** 时间戳 ms */
  ts: number;
  /** 关键词（命中用于生成工单） */
  keywords: string[];
}

export const useMeetingWorkItemStore = create<MeetingWorkItemState>()(
  persist(
    (set, get) => ({
      items: [],

      createWorkItem: (item) => {
        const now = new Date().toISOString();
        const w: MeetingWorkItem = {
          ...item,
          id: `wi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          status: 'assigned',
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ items: [w, ...state.items] }));
        return w;
      },

      bulkCreate: (items) => {
        const now = new Date().toISOString();
        const created: MeetingWorkItem[] = items.map((it) => ({
          ...it,
          id: `wi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          status: 'assigned' as WorkItemCloseStatus,
          createdAt: now,
          updatedAt: now,
        }));
        set((state) => ({ items: [...created, ...state.items] }));
        return created;
      },

      setStatus: (id, status, note) => {
        const now = new Date().toISOString();
        set((state) => ({
          items: state.items.map((w) =>
            w.id === id
              ? {
                  ...w,
                  status,
                  closeNote: note ?? w.closeNote,
                  updatedAt: now,
                  closedAt: status === 'approved' || status === 'rejected'
                    ? new Date().toISOString()
                    : w.closedAt,
                }
              : w
          ),
        }));
      },

      listByMeeting: (meetingId) =>
        get().items.filter((w) => w.meetingId === meetingId),

      getById: (id) => get().items.find((w) => w.id === id),

      countClosedByMeeting: (meetingId) =>
        get().items.filter(
          (w) => w.meetingId === meetingId && (w.status === 'approved' || w.status === 'rejected')
        ).length,

      metrics: () => {
        const items = get().items;
        const total = items.length;
        const byStatus: Record<WorkItemCloseStatus, number> = {
          assigned: 0, pending: 0, in_progress: 0, reviewing: 0, approved: 0, rejected: 0,
        };
        const byDept: Record<string, number> = {};
        let closed = 0;
        let inFlight = 0;
        let totalCloseMs = 0;
        let stuckCount = 0;
        const now = Date.now();

        for (const w of items) {
          byStatus[w.status] = (byStatus[w.status] || 0) + 1;
          const dept = w.assigneeDept || '未分配部门';
          byDept[dept] = (byDept[dept] || 0) + 1;

          if (w.status === 'approved' || w.status === 'rejected') {
            closed++;
            if (w.closedAt) {
              totalCloseMs += new Date(w.closedAt).getTime() - new Date(w.createdAt).getTime();
            }
          } else {
            inFlight++;
            // 滞留：in_progress / reviewing 超过 72h 未推进
            const lastUpdate = w.updatedAt ? new Date(w.updatedAt).getTime() : new Date(w.createdAt).getTime();
            if ((w.status === 'in_progress' || w.status === 'reviewing') && (now - lastUpdate > 72 * 3600 * 1000)) {
              stuckCount++;
            }
          }
        }

        const avgCloseHours = closed > 0 ? totalCloseMs / closed / 3600000 : 0;
        const rejectRate = closed > 0 ? (byStatus.rejected || 0) / closed : 0;

        return {
          total,
          byStatus,
          closed,
          inFlight,
          avgCloseHours: Math.round(avgCloseHours * 10) / 10,
          stuckCount,
          rejectRate: Math.round(rejectRate * 1000) / 1000,
          byDept,
        };
      },

      getMeetingSegment: (workItemId) => {
        const w = get().items.find((it) => it.id === workItemId);
        if (!w?.meetingSegmentId) return undefined;
        // 真实对接：fetch(`/api/meetings/${w.meetingId}/segments/${w.meetingSegmentId}`)
        // 演示模式：从 store 数据合成一条片段
        return {
          segmentId: w.meetingSegmentId,
          meetingId: w.meetingId,
          speaker: w.assignee,
          text: w.meetingSegmentSnippet || `${w.assignee} 在会议中提出：${w.title}`,
          ts: Date.now() - 24 * 3600 * 1000,
          keywords: [],
        };
      },
    }),
    {
      name: 'meeting-work-item-storage',
      version: 2, // 升级：6 态 + metrics
    }
  )
);
