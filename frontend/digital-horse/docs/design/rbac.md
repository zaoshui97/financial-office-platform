# 权限深化设计文档（4 级 RBAC + 数据权限 + 越权审计）

> 修订时间：2026-09-18
> 适用版本：v1.1+

---

## 一、设计目标

1. **多层防御**：菜单 / 路由 / 按钮 / 数据 四层权限检查，避免"单点绕过"
2. **金融合规**：所有权限拒绝事件必须留痕可审计
3. **数据隔离**：用户只能看到自己部门 / 自己的数据，不能跨部门"窥屏"
4. **可扩展**：权限模型为后续接入后端 ABAC（属性级权限）预留接口

---

## 二、权限模型分层

| 层 | 检查位置 | 实现方式 | 拦截什么 |
|---|---|---|---|
| 1. 菜单级 | 侧边栏 Sidebar | `MenuItem.roles` + `usePermission.filterAccessibleMenus` | 隐藏用户无权限的菜单项 |
| 2. 路由级 | `<ProtectedRoute>` 包裹路由 | `allowedRoles` + `usePermission.hasRole` | 直接 URL 访问时显示 403 |
| 3. 按钮 / 接口级 | UI 组件 + axios 拦截器 | `<Can resource="workitem" action="approve">` + `usePermission.can()` | 隐藏危险按钮；调用 API 前前置校验 |
| 4. 数据级 | 列表渲染 + 后端查询 | `usePermission.filterByDept()` + 后端 row-level security | 按 `DataScope` 过滤可见数据 |

---

## 三、角色 / 数据范围 / 权限码

### 3.1 角色（Role）

```ts
type Role = 'USER' | 'DEPT_ADMIN' | 'SUPER_ADMIN';
```

### 3.2 数据范围（DataScope）

| Scope | 含义 | 适用角色 |
|---|---|---|
| ALL | 全部数据 | SUPER_ADMIN |
| DEPT | 本部门 + 子部门 | DEPT_ADMIN |
| DEPT_ONLY | 仅本部门 | （预留） |
| SELF | 仅本人数据 | USER |
| CUSTOM | 自定义部门列表 | （预留，按需配置） |

### 3.3 权限码（Permission）

格式：`resource:action`，例如：

- `workitem:approve` —— 工单审批
- `workitem:dispatch` —— 工单派发
- `sandbox:export` —— 沙箱日志导出
- `push:config` —— 推送渠道配置

完整资源 / 操作枚举见 `src/types/permission.ts`。

### 3.4 角色默认权限矩阵

| 角色 | 数据范围 | 关键权限码 |
|---|---|---|
| SUPER_ADMIN | ALL | 全部 |
| DEPT_ADMIN | DEPT | workitem:approve, workitem:dispatch, approval:approve, push:config, audit:read |
| USER | SELF | workitem:read, approval:create, meeting:read, report:read, sandbox:read |

---

## 四、关键代码位置

| 文件 | 角色 |
|---|---|
| `src/types/permission.ts` | 类型 / 角色 / 数据范围 / 权限码 / 角色默认权限表 |
| `src/hooks/usePermission.ts` | `hasRole / can / filterByDept / filterAccessibleMenus` |
| `src/components/ProtectedRoute.tsx` | 路由级权限守卫 |
| `src/components/Can.tsx` | 按钮级权限封装 |
| `src/store/accessAuditStore.ts` | 越权访问审计 store |
| `src/components/Layout/Sidebar.tsx` | 菜单级过滤 |
| `src/pages/Approval/index.tsx` | 落地示例：`<Can resource="workitem" action="approve">` |

---

## 五、越权审计（AccessAudit）

每次 `usePermission.can()` 调用失败都会写入审计：

```ts
useAccessAuditStore.record({
  user: 'wangwu',        // 当前用户名
  resource: 'workitem',
  action: 'approve',
  path: '/approval',
  reason: 'permission_denied',
});
```

审计字段：

| 字段 | 说明 |
|---|---|
| `user` / `userName` / `department` / `role` | 行为人四元组 |
| `resource` / `action` | 触发的权限码 |
| `path` | 触发时的页面路径 |
| `reason` | `permission_denied` / `route_forbidden` / `api_blocked` / `data_scope_violation` |
| `timestamp` | 时间戳 ms |

最多保留 500 条；真实对接后端 `POST /api/audit/access-denied`，并对接 SIEM 系统。

---

## 六、后端对接规划

- 前端只发 `Permission` 权限码
- 后端按 RBAC + ABAC 做最终校验，前端校验**只是体验优化**（隐藏按钮）
- 关键 API（工单审批、推送配置、批量导出）后端必须二次校验
- 行级权限：`WHERE assignee_dept = ?` 由后端 SQL 强制隔离

---

## 七、UI 落地示例

### 7.1 按钮级权限

```tsx
<Can resource="workitem" action="approve">
  <Button type="primary" onClick={onApprove}>通过</Button>
</Can>
```

### 7.2 数据级过滤

```tsx
const { filterByDept } = usePermission();
const visibleWorkItems = filterByDept(workItems, w => w.assigneeDept);
```

### 7.3 菜单级（已存在于 Sidebar.tsx）

```tsx
filterAccessibleMenus(menuConfig).map(menu => <MenuItem ... />)
```

---

## 八、测试场景

| 场景 | 预期 |
|---|---|
| USER 角色直接访问 `/admin/settings` | 路由级 403 |
| USER 角色看到工单"通过"按钮 | 按钮被隐藏 |
| USER 角色手动调 `can('workitem', 'approve')` | 返回 false，审计记录 +1 |
| DEPT_ADMIN 登录 | 只看到本部门工单 |
| SUPER_ADMIN 登录 | 看到全部工单 + 审计日志页 |
