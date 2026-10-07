/**
 * 会议邀请码 API
 *  - POST /meetings/{id}/invite         生成/重置邀请码（仅主持人）
 *  - POST /meetings/join                通过邀请码加入
 */
import { http } from '@/utils/request';

export interface InviteCode {
  meeting_id: number;
  meeting_title: string;
  invite_code: string;
  expires_at: string | null;
}

export interface JoinResult {
  meeting_id: number;
  meeting_title: string;
  joined: boolean;
  message: string;
}

export const meetingInviteApi = {
  generate: (meetingId: number, expiresInDays = 7) =>
    http.post<InviteCode>(`/meetings/${meetingId}/invite`, null, {
      params: { expires_in_days: expiresInDays },
    }),

  join: (code: string) => http.post<JoinResult>('/meetings/join', { code }),
};

export default meetingInviteApi;
