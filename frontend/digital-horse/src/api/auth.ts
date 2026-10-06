/**
 * 真实后端鉴权 API（Phase 1）
 *
 * 后端 OpenAPI 形状：
 *   POST /api/v1/auth/login   application/x-www-form-urlencoded  → TokenResponse
 *   POST /api/v1/auth/register application/json                  → UserRead
 *   GET  /api/v1/auth/me                                         → UserRead
 *
 * 注意：登录用 form 格式（OAuth2PasswordRequestForm），所以这里用 URLSearchParams，
 * 不能直接 http.post('/auth/login', { username, password })。
 */

import { http } from '@/utils/request';

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface UserRead {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  full_name?: string;
}

export const authApi = {
  /** 后端 OAuth2PasswordRequestForm 用 x-www-form-urlencoded */
  login: (username: string, password: string) => {
    const body = new URLSearchParams();
    body.set('username', username);
    body.set('password', password);
    return http.post<TokenResponse>('/auth/login', body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  },

  register: (payload: RegisterPayload) =>
    http.post<UserRead>('/auth/register', payload),

  me: () => http.get<UserRead>('/auth/me'),
};

export default authApi;