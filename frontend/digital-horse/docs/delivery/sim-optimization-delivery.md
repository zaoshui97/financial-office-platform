# 仿真优化交付文档 — 睿枢 Apexis

> **版本**：v1.1（2026-09-21）
> **范围**：全链路仿真优化 + 钉钉集成 + 事件总线联动
> **构建状态**：`✅ npm run build` 通过（1.80s，0 error，0 warning）

---

## 1. 改动摘要

本次改动对 `digital-horse` 前端做了一次"全链路仿真"升级，让所有可展示页面在**没有真实后端**的情况下也能像生产一样运转——模块间数据互相连通，操作可在多个页面产生联动效果，并接入钉钉登录 / 钉钉消息推送作为外部集成代表案例。

**核心新增**：

| 类型 | 数量 | 说明 |
|---|---|---|
| 新增服务文件 | 6 | `eventBus.ts` `dingtalk/index.ts` `crossStoreBridge.ts` `api.ts` |
| 新增 Store | 1 | `dispatchLogStore.ts` |
| 新增组件 | 3 | `DingtalkQrLogin` `RoleSwitchModal` |
| 新增页面组件 | 0 | 复用现有页面（逻辑增强） |
| 修改文件 | 12 | Login / Dashboard / Contacts / IndustryNews / postMeetingService / sandboxApiContract / approvalDraftStore / AdminPushChannelSettings / AppLayout / ProfileDrawer / notificationDispatchService / main.tsx |
| 新增 i18n key | 10 | `dingtalk.*` 全部补全（zh-CN + en-US） |
| Build | ✅ | `built in 1.80s`，0 error |

---

## 2. 新增文件详解

### 2.1 `src/services/eventBus.ts`

**用途**：全 App 事件总线，跨模块解耦联动。

```ts
// 触发
eventBus.emit('meeting.workitem.created', { id, meetingId, title, assignee, priority });

// 监听
useEffect(() => {
  const off = eventBus.on('sandbox.blocked', (payload) => {
    useNotificationStore.getState().addNotification({ ... });
  });
  return off;
}, []);
```

**已注册事件**（15 个）：

| 事件名 | 触发时机 | 主要订阅者 |
|---|---|---|
| `meeting.workitem.created` | 会议派单后 | todoStore（+1 待办）、通知中心 |
| `approval.changed` | 审批状态变更 | 通知中心 |
| `sandbox.blocked` | 合规阻断触发 | 通知中心（urgent）、Dashboard 风险卡 |
| `news.risk.flagged` | 行业资讯风险标注 | 通知中心（risk） |
| `user.loggedIn` | 任意方式登录 | bridge（调试日志） |
| `user.roleChanged` | 角色切换 | bridge（清缓存等） |
| `dingtalk.connected` | 钉钉 OAuth 成功 | 通知中心（system）、dispatchLog |
| `dingtalk.disconnected` | 钉钉断开 | dispatchLog |
| `contacts.dingtalkSynced` | 钉钉通讯录同步 | 通知中心（system） |
| `notification.pushed` | 任意推送发送 | dispatchLogStore（自动写入推送日志） |
| `meeting.created / .updated / .deleted` | 会议 CRUD | 预留 |
| `knowledge.uploaded / .searched` | 知识库操作 | 预留 |
| `report.generated` | 报告生成 | 预留 |

**调试**：`window.__eventBus.recent(30)` 可在浏览器 console 查看最近事件流。

---

### 2.2 `src/services/dingtalk/index.ts`

**用途**：钉钉集成仿真（OAuth + 工作通知 + 通讯录）。

**导出函数**：

```ts
// 1. OAuth 扫码登录（仿真：2s 后自动回调）
loginWithQrCode({ simulateScan: true }): Promise<DingtalkUserInfo>

// 2. 工作通知推送（带自动重试 1 次）
sendWorkNotice({ userIds, title, content, link?, priority? }): Promise<DingtalkWorkNoticeResult>

// 3. 通讯录同步（返回 50 条 mock 员工 + 9 个部门）
fetchDingtalkContacts(force?): Promise<{ departments, employees, totalCount }>

// 4. 断开钉钉
disconnectDingtalk(): void

// 5. 连接状态存取
getDingtalkConnection() / saveDingtalkConnection(conn)
```

**真实对接时**：只需把各函数体替换为 `dd.login()` / `dd.biz.chat.send()` / `GET /cgi/contact/list` 等钉钉开放平台 API。

---

### 2.3 `src/store/dispatchLogStore.ts`

**用途**：可视化推送历史（钉钉 / 企微 / 邮件 / 系统）。

- 容量：最近 200 条（FIFO）
- 持久化：`localStorage` key = `dispatch-log-storage`
- **自动订阅**：启动时 `bindDispatchLogToEventBus()` 自动把 `notification.pushed` 事件写入日志

---

### 2.4 `src/services/crossStoreBridge.ts`

**用途**：集中注册"事件 → Store 副作用"映射。

```ts
bindCrossStoreBridge();

// 内部自动订阅：
// - meeting.workitem.created → todoStore +1，通知中心 +1
// - approval.changed → 通知中心
// - sandbox.blocked → 通知中心（urgent）
// - news.risk.flagged → 通知中心（risk）
// - dingtalk.connected → 通知中心（system）
// - contacts.dingtalkSynced → 通知中心（system）
```

---

### 2.5 `src/services/api.ts`

**用途**：统一仿真 API 入口（未来替换为真实 axios 调用）。

| 方法 | 说明 |
|---|---|
| `api.knowledge.list({ page, pageSize, keyword?, category? })` | 知识库文档列表 |
| `api.knowledge.upload({ title, category, fileType?, size? })` | 上传文档（自动触发事件） |
| `api.knowledge.search(keyword)` | 全文搜索（自动触发事件） |
| `api.approval.list()` | 审批单列表 |
| `api.approval.submit(id, decision, note?)` | 审批提交（触发 `approval.changed` 事件） |
| `api.approval.create(input)` | 新建审批（触发 `approval.draft.created` 事件） |
| `api.report.list()` | 报告列表 |
| `api.report.generate({ title, type })` | 生成报告（触发 `report.generated` 事件） |

**仿真特性**：80-280ms 延迟，3% 随机失败，失败重试 1 次。

---

### 2.6 `src/components/DingtalkQrLogin/index.tsx`

**用途**：登录页"钉钉扫码登录"Modal。

- 弹出后自动触发 `loginWithQrCode()`（仿真 2s 回调）
- 成功：写入 `userStore` + `localStorage` + 触发 `dingtalk.connected` 事件
- 自动关闭 Modal 并跳转 `/dashboard`

---

### 2.7 `src/components/RoleSwitchModal/index.tsx`

**用途**：角色切换 Modal。

- 入口：`RoleSwitchModal.show({ currentRole, onSwitch })`
- 效果：调用 `setRole(newRole)` + 触发 `eventBus.user.roleChanged`
- 订阅者（`crossStoreBridge`）：通知中心清空（可选）、菜单重新过滤

---

## 3. 改动文件详解

### 3.1 `src/main.tsx`
- 启动时调用 `bindDispatchLogToEventBus()` + `bindCrossStoreBridge()`
- 仿真全局初始化

### 3.2 `src/pages/Login/index.tsx`
- 登录表单下方新增"钉钉扫码登录"蓝色渐变按钮
- 按钮触发 `<DingtalkQrLogin open={dtQrOpen} />` Modal
- 新增中文板块入口卡片（工作台 / 行业资讯），点击跳转对应路由

### 3.3 `src/pages/Dashboard/index.tsx`
- 顶部新增"实时联动状态条"：
  - 推送日志计数
  - 事件总线状态（活跃 / 待命中）
  - 联动动画：跨模块操作触发时右上角弹出 `↻ [操作类型] 卡片已更新`
- 监听 6 个关键事件

### 3.4 `src/pages/Contacts/index.tsx`
- 新增"同步钉钉通讯录"按钮
- 连接后显示蓝色"已对接钉钉" Tag
- 同步成功显示详细信息卡（部门数 / 员工数 / 上次同步时间）
- 调用 `fetchDingtalkContacts(force=true)` 并触发 `contacts.dingtalkSynced` 事件

### 3.5 `src/services/postMeetingService.ts`
- 工单批量创建后：`eventBus.emit('meeting.workitem.created', ...)` 触发联动

### 3.6 `src/services/sandbox/sandboxApiContract.ts`
- 阻断级违规触发后：`eventBus.emit('sandbox.blocked', ...)` 触发联动

### 3.7 `src/pages/IndustryNews/index.tsx`
- 发起合规审查后：`eventBus.emit('news.risk.flagged', ...)` 触发联动

### 3.8 `src/store/approvalDraftStore.ts`
- 审批状态变更后：`eventBus.emit('approval.changed', ...)` 触发联动

### 3.9 `src/services/notificationDispatchService.ts`
- 每次推送后自动写入 `dispatchLogStore` + 触发 `notification.pushed` 事件

### 3.10 `src/pages/Settings/AdminPushChannelSettings.tsx`
- 新增"推送历史日志"表格（最近 50 条，支持按渠道筛选）
- 显示：时间 / 渠道 / 状态 / 标题 / 事件类型

### 3.11 `src/components/Layout/AppLayout.tsx`
- 挂载 `<RoleSwitchModal />` 全局组件

### 3.12 `src/components/Layout/ProfileDrawer.tsx`
- 头像下方菜单新增角色切换功能（调用 `RoleSwitchModal.show()`）
- 切换成功触发 `eventBus.user.roleChanged` + `setRole()`

---

## 4. i18n 补全

新增 `dingtalk.*` 命名空间（zh-CN + en-US）：

```json
{
  "dingtalk": {
    "login": {
      "title": "钉钉扫码登录",
      "scanTip": "扫码登录",
      "waiting": "正在等待扫码… ({{seconds}}s)",
      "scanned": "已扫码，正在确认…",
      "confirming": "正在确认身份…",
      "success": "钉钉登录成功！{{name}}",
      "retry": "重试",
      "faq": "扫码遇到问题？请确保钉钉已登录企业账号"
    },
    "connected": "钉钉已连接",
    "syncSuccess": "钉钉通讯录同步成功"
  }
}
```

---

## 5. 端到端仿真路径（验收用例）

### 路径 1：钉钉登录 → 通讯录同步
1. 登录页点击"钉钉扫码登录" → 2s 后自动回调 → 用户信息写入 userStore
2. 跳转 Dashboard → 通知中心新增"钉钉已连接"系统通知
3. 侧边栏点击"通讯录" → 点击"同步钉钉通讯录" → 同步成功提示
4. 通知中心新增"钉钉通讯录已同步"系统通知

### 路径 2：会议派单 → 跨模块联动
1. 会议页面 → 结束会议 → 自动派单
2. `postMeetingService` → `eventBus.emit('meeting.workitem.created', ...)`
3. todoStore +1 条待办；通知中心 +1 条系统通知；Dashboard 实时联动指示器弹出

### 路径 3：合规审查 → 风险预警 → Dashboard
1. 行业资讯 → 某条高影响度资讯 → 点击"发起合规审查"
2. `handleLaunchComplianceReview` → `eventBus.emit('news.risk.flagged', ...)`
3. 通知中心 +1 条 risk 类型通知；Dashboard "监管情报风险"卡片 +1；推送日志写入 dispatchLog

### 路径 4：审批 → 状态变更 → 通知
1. 审批页面 → 对某条审批点击"通过"或"驳回"
2. `approvalDraftStore.setApprovalResult()` → `eventBus.emit('approval.changed', ...)`
3. 通知中心 +1 条系统通知；推送日志写入 dispatchLog（钉钉渠道）；Dashboard 实时联动指示器弹出

### 路径 5：角色切换 → 菜单实时更新
1. 点击头像 → 个人中心抽屉 → 底部菜单"切换角色"
2. 弹出 `RoleSwitchModal` → 选择"超级管理员" → 确认
3. `setRole('SUPER_ADMIN')` + `eventBus.emit('user.roleChanged', ...)`
4. Sidebar 立即刷新菜单：原本隐藏的系统管理菜单出现；设置页面功能全开

### 路径 6：钉钉推送日志可视化
1. 超级管理员 → 系统设置 → 推送渠道配置
2. 页面底部"推送历史日志"表格：显示所有推送记录
3. 按渠道 / 时间 / 状态筛选

---

## 6. 架构图（新增部分）

```
┌─────────────────────────────────────────────────────────────────────┐
│                           eventBus (全局事件总线)                     │
│  15 个事件：meeting.* / approval.* / sandbox.* / news.* / dingtalk.* │
└────────────────────┬──────────────────────────────────────────────┘
                     │ emit()
        ┌────────────┴──────────────┐
        ▼                           ▼
crossStoreBridge              dispatchLogStore
(事件→Store副作用)           (推送历史持久化)
        │                           │
        ▼                           ▼
   ┌────┴──────────┐          Dashboard 推送日志卡
   │ todoStore     │
   │ notification  │
   │   Store       │          AdminPushChannelSettings
   └───────────────┘          推送历史表格
```

```
┌─────────────────────────────────────────────────────┐
│ 钉钉集成 (services/dingtalk/index.ts)             │
│  ┌────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │OAuth 扫码  │  │工作通知推送  │  │通讯录同步  │ │
│  │2s mock回调 │  │sendWorkNotice│  │fetchContacts│ │
│  └────────────┘  └──────────────┘  └───────────┘ │
│       │                │                 │       │
│       ▼                ▼                 ▼       │
│  userStore       notificationDispatch    contacts │
│  eventBus            Service            Store    │
└─────────────────────────────────────────────────────┘
```

---

## 7. 真实对接指南

### 7.1 钉钉 OAuth（`services/dingtalk/index.ts`）
```ts
// 替换前（仿真）
const user = await loginWithQrCode({ simulateScan: true });

// 替换后（真实）
import dd from 'dingtalk-jsapi';
dd.runtime.login({ redirectUri: '...' }).then(({ code }) => {
  // 调用后端 /api/auth/dingtalk/callback，拿到 unionId 等
});
```

### 7.2 钉钉工作通知（`services/dingtalk/index.ts`）
```ts
// 替换前（仿真）
await sendWorkNotice({ userIds: [...], title, content });

// 替换后（真实）
await axios.post('https://oapi.dingtalk.com/topapi/message/send_to_conversation',
  { agent_id: AGENT_ID, userid_list: userIds.join(','), msg_content: { msgtype: 'markdown', markdown: { title, text: content } } },
  { headers: { access_token: ACCESS_TOKEN } }
);
```

### 7.3 API 层（`services/api.ts`）
```ts
// 替换前（仿真）
await api.knowledge.upload({ title, category });

// 替换后（真实）
const { data } = await axios.post('/api/v1/knowledge/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
```

---

## 8. 文件清单（完整）

### 新增文件（11 个）
| 文件路径 | 说明 |
|---|---|
| `src/services/eventBus.ts` | 全局事件总线 |
| `src/services/dingtalk/index.ts` | 钉钉集成（OAuth / 消息 / 通讯录） |
| `src/services/crossStoreBridge.ts` | 事件 → Store 副作用桥接 |
| `src/services/api.ts` | 统一仿真 API 入口 |
| `src/store/dispatchLogStore.ts` | 推送日志 Store |
| `src/components/DingtalkQrLogin/index.tsx` | 钉钉扫码登录 Modal |
| `src/components/RoleSwitchModal/index.tsx` | 角色切换 Modal |

### 修改文件（13 个）
| 文件路径 | 主要改动 |
|---|---|
| `src/main.tsx` | 启动时初始化事件总线绑定 |
| `src/pages/Login/index.tsx` | 钉钉扫码按钮 + 中文板块入口卡片 |
| `src/pages/Dashboard/index.tsx` | 实时联动状态条 |
| `src/pages/Contacts/index.tsx` | 钉钉同步按钮 + 状态卡片 |
| `src/pages/IndustryNews/index.tsx` | 触发 `news.risk.flagged` 事件 |
| `src/pages/Settings/AdminPushChannelSettings.tsx` | 推送历史日志表格 |
| `src/services/postMeetingService.ts` | 触发 `meeting.workitem.created` 事件 |
| `src/services/sandbox/sandboxApiContract.ts` | 触发 `sandbox.blocked` 事件 |
| `src/services/notificationDispatchService.ts` | 自动写 dispatchLog + 触发 `notification.pushed` |
| `src/store/approvalDraftStore.ts` | 触发 `approval.changed` 事件 |
| `src/components/Layout/AppLayout.tsx` | 挂载 RoleSwitchModal |
| `src/components/Layout/ProfileDrawer.tsx` | 角色切换入口 + eventBus |
| `src/components/Layout/Logo.tsx` | logo2.0.png 白底圆角容器 |

### i18n 新增
- `src/i18n/locales/zh-CN.json`：`dingtalk.*` 命名空间（10 个 key）
- `src/i18n/locales/en-US.json`：`dingtalk.*` 命名空间（10 个 key）

---

## 9. 已知限制

1. **真实对接缺口**：钉钉 OAuth / 工作通知 / 通讯录 API 均为仿真，需要企业真实钉钉应用信息（CorpID / AppKey / AppSecret / AgentID）替换
2. **数据权限**：`usePermission` 已按角色过滤菜单，但各 store 内数据（如知识库文档列表）未按 `dataScope` 过滤，仅在前端模拟
3. **localStorage 容量**：推送日志 + 各 store 合计约 2-5MB，浏览器 localStorage 限制 5-10MB，建议定期自动 trim
4. **会议工单**：来自 `postMeetingService`，数据存储在 `meetingWorkItemStore`，不跨 Tab 同步
5. **AI 智能中心**：已在之前版本下线（dev-log 2026-09 记录），侧边栏 `nav.agentHub` i18n key 残留，可选择性删除

---

## 10. Build 与运行

```bash
cd digital-horse
npm run dev        # 开发模式（热更新）
npm run build      # 生产构建（✅ 已验证通过）
npm run i18n:check # i18n key 校验（JSON 结构对齐 / 占位检查）
```

---

**文档维护**：每次接入真实后端 API 时，在对应 `services/` 文件中保留"真实对接"注释，删除仿真实现，以便后续追溯。
