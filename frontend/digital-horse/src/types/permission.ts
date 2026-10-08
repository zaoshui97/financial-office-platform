/**
 * 权限系统类型定义
 * 定义角色、菜单配置和权限相关类型
 */

export type Role = 'USER' | 'DEPT_ADMIN' | 'SUPER_ADMIN' | 'AUDITOR';

/** 菜单分组 */
export type MenuGroup = 'core' | 'compliance' | 'knowledge' | 'ai' | 'system' | 'communication';

/** 菜单项配置 */
export interface MenuItem {
  key: string;
  path: string;
  labelKey: string;
  icon: string;
  group: MenuGroup;
  roles: Role[];
  children?: MenuItem[];
}

/** 路由权限配置 */
export interface RoutePermission {
  path: string;
  allowedRoles: Role[];
  redirect?: string;
}

/** 权限检查结果 */
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

/** Mock 用户数据 */
export const MOCK_USERS: Record<string, { name: string; role: Role; department: string }> = {
  'zhangsan': { name: '张三', role: 'SUPER_ADMIN', department: '技术部' },
  'lisi': { name: '李四', role: 'DEPT_ADMIN', department: '合规部' },
  'wangwu': { name: '王五', role: 'USER', department: '市场部' },
};

/** 角色显示名称 */
export const ROLE_LABELS: Record<Role, string> = {
  'SUPER_ADMIN': '超级管理员',
  'DEPT_ADMIN': '部门管理员',
  'USER': '普通员工',
  'AUDITOR': '审计员',
};

/** 菜单分组显示名称 */
export const GROUP_LABELS: Record<MenuGroup, string> = {
  'core': '核心办公',
  'compliance': '合规中心',
  'knowledge': '知识管理',
  'ai': 'AI能力',
  'system': '系统管理',
  'communication': '协作沟通',
};

// ============================================================
// 数据权限范围（行级 / 部门级隔离）
// ============================================================

/**
 * 数据权限范围（DataScope）：
 *  - ALL         —— 全部数据（仅 SUPER_ADMIN）
 *  - DEPT        —— 本部门 + 子部门数据
 *  - DEPT_ONLY   —— 仅本部门数据
 *  - SELF        —— 仅本人数据
 *  - CUSTOM      —— 自定义部门列表（dataScopeDepts 指定）
 */
export type DataScope = 'ALL' | 'DEPT' | 'DEPT_ONLY' | 'SELF' | 'CUSTOM';

export const DATA_SCOPE_LABELS: Record<DataScope, string> = {
  ALL: '全部',
  DEPT: '本部门及子部门',
  DEPT_ONLY: '本部门',
  SELF: '本人',
  CUSTOM: '自定义部门',
};

// ============================================================
// 按钮 / 接口粒度的权限码（resource:action）
// ============================================================

/** 资源 */
export type Resource =
  | 'workitem'      // 工单
  | 'approval'      // 审批
  | 'meeting'       // 会议
  | 'report'        // 研报
  | 'sandbox'       // 合规沙箱
  | 'knowledge'     // 知识库
  | 'push'          // 推送渠道
  | 'user'          // 用户
  | 'audit';        // 审计日志

/** 操作 */
export type Action =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'      // 工单/审批专用
  | 'reject'       // 工单/审批专用
  | 'dispatch'     // 派单专用
  | 'export'       // 导出/批量操作
  | 'config';      // 配置/管理

/** 权限码：例如 'workitem:approve' */
export type Permission = `${Resource}:${Action}`;

/** 角色默认数据范围 */
export const ROLE_DATA_SCOPE: Record<Role, DataScope> = {
  SUPER_ADMIN: 'ALL',
  DEPT_ADMIN: 'DEPT',
  USER: 'SELF',
};

/** 角色默认权限码表 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    'workitem:read', 'workitem:create', 'workitem:update', 'workitem:delete',
    'workitem:approve', 'workitem:reject', 'workitem:dispatch', 'workitem:export',
    'approval:read', 'approval:create', 'approval:update', 'approval:approve', 'approval:reject',
    'meeting:read', 'meeting:create', 'meeting:update', 'meeting:export',
    'report:read', 'report:create', 'report:update', 'report:export',
    'sandbox:read', 'sandbox:export',
    'knowledge:read', 'knowledge:create', 'knowledge:update',
    'push:read', 'push:config',
    'user:read', 'user:create', 'user:update',
    'audit:read',
  ],
  DEPT_ADMIN: [
    'workitem:read', 'workitem:create', 'workitem:update', 'workitem:approve',
    'workitem:reject', 'workitem:dispatch', 'workitem:export',
    'approval:read', 'approval:approve', 'approval:reject',
    'meeting:read', 'meeting:create', 'meeting:update',
    'report:read', 'report:create', 'report:update', 'report:export',
    'sandbox:read',
    'knowledge:read', 'knowledge:create',
    'push:read', 'push:config',
    'user:read',
    'audit:read',
  ],
  USER: [
    'workitem:read', 'workitem:update',
    'approval:read', 'approval:create',
    'meeting:read',
    'report:read', 'report:create',
    'sandbox:read',
    'knowledge:read',
  ],
};

