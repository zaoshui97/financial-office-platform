/**
 * 审批模块 API（Phase 1：联调真实后端）
 *
 * 后端路径：/api/v1/approvals
 *  - GET    /?scope=mine|dept|all&status=pending
 *  - POST   /                      创建（auto_submit=True → 立即入 pending）
 *  - GET    /{id}                  详情
 *  - GET    /{id}/actions          操作流水
 *  - POST   /{id}/action           approve / reject / urge / comment / close
 *
 * scope 权限：
 *  - mine     任何角色
 *  - dept     dept_admin / super_admin
 *  - all      super_admin only
 */
import { http } from '@/utils/request';
import type { AIReviewReport } from './aiReview';

// ─────────── Approval ───────────

export type ApprovalType =
  | 'leave'
  | 'reimburse'
  | 'seal'
  | 'general';

export type ApprovalStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'closed';

export type ApprovalActionType =
  | 'submit'
  | 'approve'
  | 'reject'
  | 'urge'
  | 'comment'
  | 'close';

export interface Approval {
  id: number;
  user_id: number;
  type: ApprovalType;
  title: string | null;
  content: string;
  status: ApprovalStatus;
  sandbox_passed: boolean | null;
  approved_by: number | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  attachment_ids: number[];
  // AI 辅助审批
  ai_review?: AIReviewReport | null;
  ai_suggestion?: 'pass' | 'review' | 'reject' | null;
  ai_reviewed_at?: string | null;
}

export interface ApprovalListResponse {
  items: Approval[];
  total: number;
}

export interface ApprovalAction {
  id: number;
  approval_id: number;
  operator_id: number;
  action: ApprovalActionType;
  comment: string | null;
  created_at: string;
  ai_suggestion?: 'pass' | 'review' | 'reject' | null;
  override_reason?: string | null;
}

export type ApprovalScope = 'mine' | 'dept' | 'all';

export interface ListApprovalsParams {
  scope?: ApprovalScope;
  status?: ApprovalStatus;
  limit?: number;
}

export const approvalsApi = {
  /** 列审批（带 scope 过滤） */
  list: (params: ListApprovalsParams = {}) => {
    const { scope = 'mine', status, limit = 50 } = params;
    const search: Record<string, string | number> = { scope, limit };
    if (status) search.status = status;
    return http.get<ApprovalListResponse>('/approvals', { params: search });
  },

  /** 创建审批 */
  create: (data: {
    type: ApprovalType;
    title?: string;
    content: string;
    attachment_ids?: number[];
  }) => http.post<Approval>('/approvals', data),

  /** 审批详情 */
  get: (id: number) => http.get<Approval>(`/approvals/${id}`),

  /** 操作流水 */
  actions: (id: number) => http.get<ApprovalAction[]>(`/approvals/${id}/actions`),

  /** 对审批做操作 */
  act: (id: number, data: { action: ApprovalActionType; comment?: string }) =>
    http.post<ApprovalAction>(`/approvals/${id}/action`, data),

  /** 手动触发 AI 审查 */
  triggerReview: (id: number) =>
    http.post<{ approval_id: number; ai_review: AIReviewReport; ai_suggestion: string; ai_reviewed_at: string }>(
      `/approvals/${id}/review`,
      {},
    ),
};

export default approvalsApi;
