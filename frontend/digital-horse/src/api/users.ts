/**
 * 用户基础信息 API
 *  - GET /auth/me      当前用户
 *  - GET /auth/users/{id}  按 id 查
 */
import { http } from '@/utils/request';

export interface UserInfo {
  id: number;
  username: string;
  email?: string | null;
  full_name?: string | null;
  department?: string | null;
  position?: string | null;
  is_active?: boolean;
  is_superuser?: boolean;
  role?: string;
  /** 展示用，full_name || username，组件内可调 getDisplayName() */
  display_name?: string;
}

export function getDisplayName(u: UserInfo | null | undefined): string {
  if (!u) return '—';
  return u.full_name || u.username || '—';
}

export const userApi = {
  me: () => http.get<UserInfo>('/auth/me'),
  get: (id: number) => http.get<UserInfo>(`/auth/users/${id}`),
};

export default userApi;
