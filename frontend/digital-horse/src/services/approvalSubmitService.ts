/**
 * Approval Pre-Submit Sandbox Hook
 *
 * 业务联动：
 *   - 任何业务模块（会议、研报、AI 等）提交审批前，调用本工具
 *   - 自动调用沙箱检测；命中阻断级违规则抛出 SandboxError
 *   - 通过则把结果写入 approvalDraftStore，等待用户在审批页确认
 *
 * 用法：
 *   try {
 *     await submitApprovalWithSandbox({
 *       title: '采购合同审批',
 *       text: '...',
 *       approvalType: 'contract',
 *       meetingWorkItemId: 'wi_xxx',
 *       meetingId: 'meeting_xxx',
 *     });
 *     navigate('/approval');
 *   } catch (e) {
 *     showBlockedDialog(e);
 *   }
 */

import { checkCompliance, type SandboxCheckRequest } from '@/services/sandbox/sandboxApiContract';
import { useApprovalDraftStore } from '@/store/approvalDraftStore';
import type { ApprovalDraft } from '@/store/approvalDraftStore';

export interface SubmitApprovalParams {
  title: string;
  text: string;
  approvalType: ApprovalDraft['approvalType'];
  /** 关联会议工单 ID（可选；联动时填写） */
  meetingWorkItemId?: string;
  /** 关联会议 ID（可选；展示用） */
  meetingId?: string;
  /** 是否跳过沙箱（草稿保存场景） */
  skipSandbox?: boolean;
}

export interface SandboxBlockedError extends Error {
  name: 'SandboxBlockedError';
  result: import('@/services/sandbox/sandboxEngine').SandboxResult;
  businessRef?: import('@/services/sandbox/sandboxLog').BusinessRef;
}

/**
 * 提交审批 + 自动沙箱检测
 * @returns 通过检测时返回 sandboxResult；阻断时抛出 SandboxBlockedError
 */
export async function submitApprovalWithSandbox(
  params: SubmitApprovalParams
): Promise<import('@/services/sandbox/sandboxEngine').SandboxResult> {
  if (params.skipSandbox) {
    // 草稿模式：直接创建 draft，不检测
    useApprovalDraftStore.getState().createDraft({
      title: params.title,
      text: params.text,
      result: { passed: true, blocked: false, score: 5, issues: [], hitSpans: [], regulations: [], totalHits: 0, categoryHits: {} as any, rewritten: '', durationMs: 0 },
      approvalType: params.approvalType,
      meetingWorkItemId: params.meetingWorkItemId,
      meetingId: params.meetingId,
    });
    return {} as any;
  }

  // 1. 调用沙箱
  const req: SandboxCheckRequest = {
    text: params.text,
    source: 'approval',
    businessRef: params.meetingId
      ? { type: 'meeting', id: params.meetingId, title: params.title }
      : undefined,
  };
  const result = await checkCompliance(req);

  // 2. 阻断级违规 → 直接抛错
  if (result.blocked) {
    const err = new Error(
      `提交被拦截：检测到 ${result.issues.length} 项阻断级合规违规，请前往沙箱修改。`
    ) as SandboxBlockedError;
    err.name = 'SandboxBlockedError';
    err.result = result;
    err.businessRef = req.businessRef;
    throw err;
  }

  // 3. 通过 / 仅警告 → 写入审批草稿
  useApprovalDraftStore.getState().createDraft({
    title: params.title,
    text: params.text,
    result,
    approvalType: params.approvalType,
    meetingWorkItemId: params.meetingWorkItemId,
    meetingId: params.meetingId,
  });

  return result;
}
