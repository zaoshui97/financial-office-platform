/**
 * 权限控制 Hook（深化版）
 *
 * 4 级权限模型：
 *   1. 菜单级 —— 通过 `MenuItem.roles` 控制侧边栏可见性
 *   2. 路由级 —— `<ProtectedRoute allowedRoles>` 控制整页可访问性
 *   3. 按钮/接口级 —— `can('workitem:approve')` 控制 UI 按钮 & API 调用前置校验
 *   4. 数据级 —— `DataScope` + `filterByDept` 按部门隔离数据
 *
 * 同时支持越权访问审计：调用 `denied()` 自动写入 `useAccessAuditStore`。
 */

import { useMemo, useCallback } from 'react';
import { useUserStore } from '@/store';
import type {
  Role,
  MenuItem,
  Resource,
  Action,
  Permission,
  DataScope,
} from '@/types/permission';
import { ROLE_DATA_SCOPE, ROLE_PERMISSIONS } from '@/types/permission';
import { useAccessAuditStore } from '@/store/accessAuditStore';

/** 权限检查 Hook */
export const usePermission = () => {
  const { user } = useUserStore();
  const auditDenied = useAccessAuditStore((s) => s.record);

  const currentRole: Role = user?.role || 'USER';
  const currentDept = user?.department || '';
  const dataScope: DataScope = ROLE_DATA_SCOPE[currentRole];
  const permissions = ROLE_PERMISSIONS[currentRole];

  /** 检查是否拥有指定角色 */
  const hasRole = useCallback((roles: Role[]): boolean => {
    if (roles.includes('*' as Role)) return true;
    return roles.includes(currentRole);
  }, [currentRole]);

  /** 检查是否拥有 resource:action 权限码 */
  const can = useCallback(
    (resource: Resource, action: Action): boolean => {
      const code: Permission = `${resource}:${action}`;
      const ok = permissions.includes(code);
      if (!ok) {
        auditDenied({
          user: user?.username || 'anonymous',
          userName: user?.name,
          department: user?.department,
          role: currentRole,
          resource,
          action,
          path: typeof window !== 'undefined' ? window.location.pathname : '',
          reason: 'permission_denied',
        });
      }
      return ok;
    },
    [permissions, auditDenied, user, currentRole]
  );

  /** 检查是否是管理员（部门管理员或超级管理员） */
  const isAdmin = useMemo(
    () => currentRole === 'DEPT_ADMIN' || currentRole === 'SUPER_ADMIN',
    [currentRole]
  );

  /** 检查是否是超级管理员 */
  const isSuperAdmin = useMemo(() => currentRole === 'SUPER_ADMIN', [currentRole]);

  /** 检查是否有权限访问指定菜单 */
  const canAccessMenu = useCallback((menuRoles: Role[]): boolean => hasRole(menuRoles), [hasRole]);

  /** 过滤用户可访问的菜单 */
  const filterAccessibleMenus = useCallback(
    (menus: MenuItem[]): MenuItem[] => menus.filter((m) => canAccessMenu(m.roles)),
    [canAccessMenu]
  );

  /**
   * 按部门数据范围过滤列表
   * @param items 数据列表
   * @param getDept 提取每条数据的部门字段
   */
  const filterByDept = useCallback(
    <T>(items: T[], getDept: (item: T) => string | undefined): T[] => {
      if (dataScope === 'ALL') return items;
      if (dataScope === 'SELF') {
        // SELF 仅本人 —— 需要列表里有 owner/assignee 字段。简化实现：若包含当前用户名则保留
        return items.filter((it) => {
          const d = getDept(it) || '';
          return d === currentDept || d === user?.username;
        });
      }
      if (dataScope === 'DEPT_ONLY') {
        return items.filter((it) => getDept(it) === currentDept);
      }
      if (dataScope === 'DEPT') {
        // DEPT：本部门 + 子部门（demo 简化：含部门名或 'sub_' 前缀则视为子部门）
        return items.filter((it) => {
          const d = getDept(it) || '';
          return d === currentDept || d.startsWith(`${currentDept}/`) || d.startsWith('sub_');
        });
      }
      return items;
    },
    [dataScope, currentDept, user]
  );

  return {
    currentRole,
    currentDept,
    dataScope,
    permissions,
    hasRole,
    can,
    isAdmin,
    isSuperAdmin,
    canAccessMenu,
    filterAccessibleMenus,
    filterByDept,
  };
};

export default usePermission;
