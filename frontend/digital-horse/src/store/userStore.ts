/**
 * 用户状态管理（Phase 1：连真实后端）
 *
 * 关键变更：
 * 1) Token 不再只是字符串，而是 { access_token, token_type, expires_in, saved_at }
 *    —— 因为后端 OAuth2PasswordRequestForm 返回的是 TokenResponse。
 * 2) 通过 zustand persist 的 `partialize` 把 token / isAuthenticated 也写入 localStorage，
 *    key 名 'auth-storage'，避免和旧 'user-storage' / 'token' 冲突。
 * 3) `role` 字段来自后端 UserRead.is_superuser：
 *    - is_superuser=true → SUPER_ADMIN
 *    - 其余 → USER（DEPT_ADMIN 待 Phase 2 由后端角色字段支持后再映射）
 *    这只是登录后的初值；具体页面的角色控制由 usePermission / ProtectedRoute 处理。
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Role } from '@/types/permission';

export interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  avatar?: string;
  role: Role;
  department?: string;
  position?: string;
}

export interface AuthToken {
  access_token: string;
  token_type: 'bearer' | string;
  expires_in: number; // 秒
  /** 客户端本地写入时刻，便于判断是否过期 */
  saved_at: number;
}

interface UserState {
  user: User | null;
  token: AuthToken | null;
  isAuthenticated: boolean;

  setUser: (user: User) => void;
  setToken: (token: AuthToken) => void;
  setRole: (role: Role) => void;
  updateAvatar: (avatar: string) => void;
  clearAuth: () => void;
  /** 旧 alias：兼容现有调用 */
  logout: () => void;
}

/** 根据后端 UserRead 判断前端 Role */
export function mapRoleFromBackend(user: {
  is_superuser?: boolean;
  role?: string;
  position?: string;
}): Role {
  if (user?.role === 'SUPER_ADMIN' || user?.role === 'DEPT_ADMIN' || user?.role === 'USER' || user?.role === 'AUDITOR') {
    return user.role;
  }
  if (user?.position === '审计员') return 'AUDITOR';
  return user?.is_superuser ? 'SUPER_ADMIN' : 'USER';
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setUser: (user) => set({ user, isAuthenticated: true }),
      setToken: (token) => set({ token, isAuthenticated: !!token?.access_token }),
      setRole: (role) =>
        set((state) => ({
          user: state.user ? { ...state.user, role } : null,
        })),
      updateAvatar: (avatar) =>
        set((state) => ({
          user: state.user ? { ...state.user, avatar } : null,
        })),

      clearAuth: () => set({ user: null, token: null, isAuthenticated: false }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      // 持久化这三项即可，避免 UI 状态被反序列化时混淆
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      version: 1,
    },
  ),
);

/** 简单判断 token 是否过期；严格刷新由 /auth/me 兜底 */
export function isTokenExpired(token: AuthToken | null, skewSec = 10): boolean {
  if (!token?.access_token || !token.expires_in) return true;
  const expiresAt = token.saved_at + token.expires_in * 1000;
  return Date.now() > expiresAt - skewSec * 1000;
}