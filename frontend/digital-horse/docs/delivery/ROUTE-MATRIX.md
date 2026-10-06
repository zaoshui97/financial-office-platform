# 路由状态矩阵（Route Matrix）

> 单一事实来源：每条路由的状态、权限、归属页面、挂载点。
> 最后更新：2026-10-02（Phase 1 修复后）

## 一、当前生效路由表

| 路由 | 状态 | 权限 | 归属页面 | 文件 | 备注 |
|---|---|---|---|---|---|
| `/login` | ✅ 生效 | 公开 | Login | `src/pages/Login/index.tsx` |  |
| `/dashboard` | ✅ 生效 | `*` | Dashboard | `src/pages/Dashboard/index.tsx` | 工作台首页 |
| `/meeting` | ✅ 生效 | `*` | MeetingHub | `src/pages/Meeting/MeetingHub.tsx` | 统一入口（`?tab=list/room/rehearsal/detail/report`） |
| `/meeting/:id/report` | ↪️ 重定向 | `*` | → `/meeting?tab=report&id=xxx` | `MeetingReportRedirect` | 旧路由兼容 |
| `/meeting/:id` | ↪️ 重定向 | `*` | → `/meeting?tab=detail&id=xxx` | `MeetingDetailRedirect` | 旧路由兼容 |
| `/meeting-room/:id` | ↪️ 重定向 | `*` | → `/meeting?tab=room&id=xxx` | `MeetingRoomRedirect` | 旧路由兼容 |
| `/meeting-rehearsal/:id` | ↪️ 重定向 | `*` | → `/meeting?tab=rehearsal&id=xxx` | `MeetingRehearsalRedirect` | 旧路由兼容 |
| `/knowledge` | ✅ 生效 | `*` | Knowledge | `src/pages/Knowledge/index.tsx` | 旧 `Knowledge.tsx` 已合并 |
| `/industry-news` | ✅ 生效 | `*` | IndustryNews | `src/pages/IndustryNews/index.tsx` | 行业洞察（每日要闻 / 政策动态 / 风险研判） |
| **`/qa`** | ✅ **生效**（Phase 1 恢复） | `*` | **QA** | **`src/pages/QA.tsx`** | **智能问答（文档 + 自由提问 + 历史会话）** |
| **`/agent`** | ✅ **生效**（Phase 1 恢复） | `*` | **AgentCenter** | **`src/pages/Agent/index.tsx`** | **多 Agent 调度中心** |
| **`/chat`** | ✅ **生效**（Phase 1 恢复） | `*` | **Chat** | **`src/pages/Chat.tsx`** | **RAG 通用对话** |
| **`/memory`** | ↪️ **重定向**（Phase 1） | `*` | **→ `/qa`** | redirect | **记忆管理并入问答** |
| `/notifications` | ✅ 生效 | `*` | Notifications | `src/pages/Notifications.tsx` |  |
| `/profile` | ✅ 生效 | `*` | Profile | `src/pages/Profile.tsx` | SimpleLayout |
| `/security` | ✅ 生效 | `SUPER_ADMIN` | SecurityCenter | `src/pages/Security/index.tsx` |  |
| `/settings` | ✅ 生效 | `SUPER_ADMIN` | SystemSettings | `src/pages/Settings/index.tsx` |  |
| `/approval` | ✅ 生效 | `*` | Approval | `src/pages/Approval/index.tsx` |  |
| `/sandbox` | ✅ 生效 | `*` | Sandbox | `src/pages/Sandbox.tsx` |  |
| `/report` | ✅ 生效 | `*` | Report | `src/pages/Report/index.tsx` |  |
| `/contacts` | ✅ 生效 | `*` | Contacts | `src/pages/Contacts/index.tsx` |  |
| `/logs` | ↪️ 重定向 | `*` | → `/sandbox` | redirect | 旧路由兼容 |
| `/report-weekly` | ↪️ 重定向 | `*` | → `/report` | redirect | 旧路由兼容 |
| `*`（兜底） | ↪️ 重定向 | `*` | → `/dashboard` | redirect | 404 兜底 |
| `/`（根） | ↪️ 重定向 | `*` | → `/dashboard` | redirect | 默认入口 |

## 二、已废弃路由（不再重定向，访问会落 `/dashboard` 兜底）

| 旧路由 | 原归属 | 废弃原因 | 废弃时间 |
|---|---|---|---|
| `/agent-hub` | AgentHub 整合容器 | 精简为独立页面（QA / Agent / Chat） | 2026-09-19 |
| `/plugins` | Plugin 插件市场 | 演示聚焦核心 5 板块 | 2026-09-19 |
| `/chat`（旧独立） | 通用对话 | 与 QA 合并 → `/qa` | 2026-09-19 → **Phase 1 重新挂载独立 `/chat`** |
| `/qa`（旧独立） | 智能问答 | 同上 → **Phase 1 重新挂载** | 同上 |
| `/agent`（旧独立） | 多 Agent | 同上 → **Phase 1 重新挂载** | 同上 |
| `/memory`（旧独立） | 长会话记忆 | 并入问答 → `/qa` | 2026-09-19 |

## 三、Phase 1（2026-10-02）变更明细

### 3.1 移除的 redirect（恢复为真实挂载）

```diff
- { path: '/chat',   element: <Navigate to="/dashboard" replace /> }
- { path: '/qa',     element: <Navigate to="/dashboard" replace /> }
- { path: '/agent',  element: <Navigate to="/dashboard" replace /> }
- { path: '/memory', element: <Navigate to="/dashboard" replace /> }
+ { path: '/memory', element: <Navigate to="/qa" replace /> }
```

并在 `/` 的 children 中新增：
```tsx
{ path: 'qa',    element: <ProtectedRoute allowedRoles={routePermissions['/qa']}><QA /></ProtectedRoute> },
{ path: 'agent', element: <ProtectedRoute allowedRoles={routePermissions['/agent']}><AgentCenter /></ProtectedRoute> },
{ path: 'chat',  element: <ProtectedRoute allowedRoles={routePermissions['/chat']}><Chat /></ProtectedRoute> },
```

### 3.2 权限表新增条目

```diff
const routePermissions: Record<string, string[]> = {
  '/dashboard': ['*'],
  '/meeting': ['*'],
  '/qa': ['*'],
+ '/agent': ['*'],
+ '/chat': ['*'],
  '/knowledge': ['*'],
  '/industry-news': ['*'],
  ...
};
```

### 3.3 Sidebar 菜单配置新增

```diff
const menuConfig: MenuItem[] = [
  ...
+ // AI 智能中心 - 问答 + 多 Agent（2026-Q4 恢复）
+ { key: '/qa',    path: '/qa',    labelKey: 'nav.qa',       icon: 'qa',       group: 'ai', roles: ['*'] },
+ { key: '/agent', path: '/agent', labelKey: 'nav.agentHub', icon: 'agentHub', group: 'ai', roles: ['*'] },
];
```

### 3.4 Sidebar 渲染块恢复

```diff
- // AI能力分组已移除（AI 智能中心板块下线）
+ // AI 智能中心分组（问答 + 多 Agent）
+ if (groupedMenus.ai.length > 0) {
+   if (items.length > 0) items.push({ type: 'divider' });
+   groupedMenus.ai.forEach(menu => items.push({...}));
+ }
```

### 3.5 DashboardCharts 路径 bug 修复

```diff
- { key: 'industry', label: '行业洞察',   ..., path: '/insights' },   // ❌
- { key: 'agentHub', label: 'AI 智能中心', ..., path: '/agent-hub' },  // ❌
+ { key: 'industry', label: '行业洞察',   ..., path: '/industry-news' }, // ✓
+ { key: 'agentHub', label: 'AI 智能中心', ..., path: '/qa' },           // ✓
```

## 四、状态图例

- ✅ 生效：路由可用，挂载对应页面
- ↪️ 重定向：路由可用，自动跳转其他路由
- ⛔ 已废弃：路由不可用（被兜底规则收编到 `/dashboard`）
- 🆕 本次新增：本 Phase 新挂载
