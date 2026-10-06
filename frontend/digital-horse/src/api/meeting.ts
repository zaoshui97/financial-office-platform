/**
 * 会议 Agent REST API（Phase 3）
 *
 * 后端 OpenAPI 形状（app/features/meeting/）：
 *   POST   /api/v1/meetings                     → MeetingRead
 *   GET    /api/v1/meetings?status=             → MeetingListResponse
 *   GET    /api/v1/meetings/{id}                → MeetingRead
 *   DELETE /api/v1/meetings/{id}                → MeetingRead
 *   GET    /api/v1/meetings/{id}/blackboard     → BlackboardReadResponse
 *   POST   /api/v1/meetings/{id}/blackboard/{role} → AgentTriggerResponse
 *   GET    /api/v1/meetings/{id}/blackboard/events → BlackboardEventListResponse
 */

import { http } from '@/utils/request';

// ---------- 类型 ----------

export type MeetingStatus = 'preparing' | 'active' | 'closed';
export type MeetingPhase = 'open' | 'discussing' | 'closing' | 'closed';
export type AgentRole = 'moderator' | 'noter' | 'decision' | 'dispatcher';

export interface MeetingRead {
  id: number;
  title: string;
  host_user_id: number;
  status: MeetingStatus;
  topic: string | null;
  agenda: string | null;
  current_phase: MeetingPhase | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingCreate {
  title: string;
  topic?: string | null;
  agenda?: string | null;
}

export interface MeetingListResponse {
  items: MeetingRead[];
  total: number;
}

export interface BlackboardSnapshot {
  agent_role: AgentRole;
  version: number;
  state: Record<string, unknown>;
}

export interface BlackboardReadResponse {
  session_id: number;
  states: BlackboardSnapshot[];
}

export interface AgentTriggerRequest {
  context?: Record<string, unknown>;
  wait?: boolean;
}

export interface AgentTriggerResponse {
  session_id: number;
  agent_role: AgentRole;
  new_version: number;
  state: Record<string, unknown>;
}

export interface BlackboardEventItem {
  id: number;
  agent_role: AgentRole;
  version: number;
  state: Record<string, unknown>;
  created_at: string | null;
}

export interface BlackboardEventListResponse {
  session_id: number;
  since_event_id: number;
  events: BlackboardEventItem[];
  has_more: boolean;
}

// ---------- API ----------

export const meetingApi = {
  create: (payload: MeetingCreate) =>
    http.post<MeetingRead>('/meetings', payload),

  list: (params?: { status?: MeetingStatus; limit?: number }) =>
    http.get<MeetingListResponse>('/meetings', { params }),

  get: (id: number) =>
    http.get<MeetingRead>(`/meetings/${id}`),

  close: (id: number) =>
    http.delete<MeetingRead>(`/meetings/${id}`),

  readBlackboard: (id: number) =>
    http.get<BlackboardReadResponse>(`/meetings/${id}/blackboard`),

  triggerAgent: (
    id: number,
    role: AgentRole,
    payload: AgentTriggerRequest = {},
  ) =>
    http.post<AgentTriggerResponse>(
      `/meetings/${id}/blackboard/${role}`,
      payload,
    ),

  listBlackboardEvents: (
    id: number,
    params: { since_event_id?: number; limit?: number } = {},
  ) =>
    http.get<BlackboardEventListResponse>(
      `/meetings/${id}/blackboard/events`,
      { params },
    ),
};

export default meetingApi;