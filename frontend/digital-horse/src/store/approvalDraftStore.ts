/**
 * 审批草稿 Store —— Sandbox 检测结果 → 审批草稿的桥梁
 *
 * 流程：Sandbox 检测完成 → 用户点"提交审批" → 草稿存入 store → 跳转 /approval
 * Approval 页读取草稿并预填 AI 预审结果
 *
 * 改动（会议联动）：
 *   - ApprovalDraft 新增 meetingWorkItemId 字段，建立与会议工单的关联
 *   - 新增 setApprovalResult：审批通过/驳回时调用，同步回写到 meetingWorkItemStore
 */

import { create } from 'zustand';
import type { SandboxResult } from '@/services/sandbox/sandboxEngine';
import { useMeetingWorkItemStore } from './meetingWorkItemStore';
import { eventBus } from '@/services/eventBus';

export interface ApprovalDraft {
  id: string;
  title: string;
  /** Sandbox 检测文本（用于合规报告附件） */
  text: string;
  /** Sandbox 检测结果 */
  sandboxResult: SandboxResult;
  createdAt: string;
  /** 审批类型（英文枚举） */
  approvalType: 'contract' | 'document' | 'reimbursement' | 'procurement' | 'travel' | 'budget' | 'seal';
  /** 关联会议工单 ID（来自会议派单时填写；其他场景为空） */
  meetingWorkItemId?: string;
  /** 关联会议 ID（展示用） */
  meetingId?: string;
}

interface ApprovalDraftState {
  drafts: ApprovalDraft[];
  latestDraft: ApprovalDraft | null;
  /** 从 Sandbox 检测结果创建草稿 */
  createDraft: (params: {
    title: string;
    text: string;
    result: SandboxResult;
    approvalType: ApprovalDraft['approvalType'];
    meetingWorkItemId?: string;
    meetingId?: string;
  }) => void;
  /** 消费最新草稿（读取后清空） */
  consumeDraft: () => ApprovalDraft | null;
  /** 追加 AI 预审结果到已有草稿（Approval 页内部更新） */
  appendAiPrecheck: (approvalId: string, result: SandboxResult) => void;
  /**
   * 审批结果回写
   * - 当 approval 关联了 meetingWorkItemId 时，同步把会议工单标记为 approved/rejected
   * - 返回回写是否成功（用于 UI 提示）
   */
  setApprovalResult: (
    approvalId: string,
    status: 'approved' | 'rejected',
    note?: string
  ) => { synced: boolean; meetingWorkItemId?: string };
}

export const useApprovalDraftStore = create<ApprovalDraftState>()((set, get) => ({
  drafts: [],
  latestDraft: null,

  createDraft: ({ title, text, result, approvalType, meetingWorkItemId, meetingId }) => {
    const draft: ApprovalDraft = {
      id: `draft_${Date.now()}`,
      title,
      text,
      sandboxResult: result,
      createdAt: new Date().toISOString(),
      approvalType,
      meetingWorkItemId,
      meetingId,
    };
    set((state) => ({
      drafts: [draft, ...state.drafts],
      latestDraft: draft,
    }));
  },

  consumeDraft: () => {
    const { latestDraft } = get();
    set({ latestDraft: null });
    return latestDraft;
  },

  appendAiPrecheck: (approvalId, result) => {
    set((state) => ({
      drafts: state.drafts.map((d) =>
        d.id === approvalId ? { ...d, sandboxResult: result } : d
      ),
    }));
  },

  setApprovalResult: (approvalId, status, note) => {
    const draft = get().drafts.find((d) => d.id === approvalId);
    if (!draft) return { synced: false };

    // 回写会议工单状态
    if (draft.meetingWorkItemId) {
      useMeetingWorkItemStore.getState().setStatus(
        draft.meetingWorkItemId,
        status,
        note
      );

      // 外部推送：审批状态变更
      (async () => {
        const { dispatchApprovalChange } = await import('@/services/notificationDispatchService');
        const { usePushChannelConfigStore } = await import('@/store/pushChannelConfigStore');
        const statusText = status === 'approved' ? '已通过' : '已驳回';
        const result = await dispatchApprovalChange({
          title: `审批${statusText}：${draft.title}`,
          content: note
            ? `审批${statusText}。备注：${note}`
            : `审批${statusText}（AI 预审：${draft.sandboxResult.score.toFixed(1)}/5）`,
          approvalId,
          status,
          link: `/approval`,
        });
        if (result.success || Object.values(result.channelResults).some((r) => r?.ok)) {
          usePushChannelConfigStore.getState().recordSent('approval_change');
        }

        // 仿真联动：触发事件总线（通知中心 / Dashboard 自动追加）
        eventBus.emit('approval.changed', {
          id: approvalId,
          status,
          title: draft.title,
        });
      })();

      return { synced: true, meetingWorkItemId: draft.meetingWorkItemId };
    }
    return { synced: false };
  },
}));
