/**
 * 路由守卫组件
 *
 * Phase 1 增强：
 * 1) 未登录（!isAuthenticated 或 token 缺失）跳 /login?from=<current>
 * 2) 真实模式下，刷新页面或路由切换时尝试用 /auth/me 探活一次，
 *    失败则视为已过期并跳登录
 * 3) 已登录但角色不匹配时，仍走原 403 页面
 */

import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Result, Button } from 'antd';
import { useUserStore, isTokenExpired } from '@/store/userStore';
import { authApi } from '@/api/auth';
import { usePermission } from '@/hooks/usePermission';
import type { Role } from '@/types/permission';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: Role[];
  redirectPath?: string;
}

const USE_MOCK: boolean = import.meta.env.VITE_USE_MOCK === 'true';

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  redirectPath = '/dashboard',
}) => {
  const location = useLocation();
  const { hasRole } = usePermission();
  const { user, token, isAuthenticated, clearAuth } = useUserStore();
  const probedRef = useRef(false);

  // 真实模式下做一次 /auth/me 探活（避免每次路由都打后端）
  useEffect(() => {
    if (USE_MOCK) return;
    if (probedRef.current) return;
    if (!token?.access_token) return;
    probedRef.current = true;

    // token 已过期就直接清掉
    if (isTokenExpired(token)) {
      clearAuth();
      return;
    }

    authApi
      .me()
      .then(({ data }) => {
        // 把后端最新 user 信息同步回 store，避免角色不刷新
        useUserStore.getState().setUser({
          id: String(data.id),
          username: data.username,
          name: data.full_name || data.username,
          email: data.email,
          role: data.is_superuser ? 'SUPER_ADMIN' : 'USER',
          department: '',
        });
      })
      .catch(() => {
        // 401 / 网络错误都由拦截器处理；这里只清理 store
        clearAuth();
      });
  }, [token, clearAuth]);

  // 未登录 → 跳 /login
  if (!isAuthenticated || !token?.access_token) {
    const from = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?from=${from}`} replace />;
  }

  // 真实模式下没有 user 也不要硬卡（探活还在飞），展示空即可
  if (!USE_MOCK && !user) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>正在校验登录态…</div>;
  }

  // 角色权限
  const hasPermission = allowedRoles.includes('*' as Role) || hasRole(allowedRoles);
  if (!hasPermission) {
    return (
      <Result
        status="403"
        title="403"
        subTitle="抱歉，您没有权限访问此页面"
        extra={
          <Button type="primary" onClick={() => window.history.back()}>
            返回上一页
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;