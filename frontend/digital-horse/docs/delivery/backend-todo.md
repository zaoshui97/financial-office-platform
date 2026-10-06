# 后端实现清单（接口契约 + 缺口分析）

> 适用对象：后端开发同学、架构师、项目经理
> 图例：
> -  已实现（真实后端）
> - ️ 部分 Mock（部分走真实接口）
> -  未实现（纯前端 mock，需后端补）
> -  前端契约已就绪（TS 类型 + 调用注释已写好，后端按契约实现即可）

---

## 〇、环境变量配置（`digital-horse/.env*`）

| 文件 | 变量 | 值 |
| --- | --- | --- |
| `.env.development` | `VITE_API_BASE_URL` | `http://localhost:3000` |
| `.env.development` | `VITE_USE_MOCK` | `true` |
| `.env.production` | `VITE_API_BASE_URL` | `https://api.example.com` |
| `.env.production` | `VITE_USE_MOCK` | `false` |
| `.env` | `VITE_API_BASE_URL` | `/api` |

> ️ 前端 axios 的 `baseURL` 走 `VITE_API_BASE_URL`，默认 `/api`。`mockjs` 仅在 `VITE_USE_MOCK === 'true'` 时生效。但目前 `src/mock/index.ts` 注册的 mockjs 路由与 `src/api/modules.ts` 真实 axios 调用路径不一一对应 — 详见后文 ️ 缺口。

---

## 一、`src/api/` 目录 · API 调用清单

### 1. `src/api/request.ts` / `src/utils/request.ts`（Axios 实例双份）

- **Axios 实例配置**  已就绪
- 路径：`baseURL = import.meta.env.VITE_API_BASE_URL || '/api'`，超时 15s
- 拦截器：请求拦截器自动注入 `Authorization: Bearer <token>`；响应拦截器处理 `code !== 200`、HTTP 401/403/404/500
- ️ 注意：`src/api/request.ts` 与 `src/utils/request.ts` 是**两份重复实现**，建议合并

### 2. `src/api/modules.ts` · REST API 定义

> ️ 这些函数已封装 axios 调用，但**目前没有任何业务页面真正调用它们**（已 grep 确认）。属于"已声明、未连通"的接口。

| 接口 | 方法 | 路径 | 入参 | 返回 | 状态 |
| --- | --- | --- | --- | --- | --- |
| 用户登录 | POST | `/user/login` | `{ username, password }` | `ApiResponse` |  未连通 |
| 用户登出 | POST | `/user/logout` | — | `ApiResponse` |  未连通 |
| 获取用户信息 | GET | `/user/info` | — | `ApiResponse` |  未连通 |
| 更新用户信息 | PUT | `/user/info` | `{ ... }` | `ApiResponse` |  未连通 |
| 知识库列表 | GET | `/knowledge/list` | `PageParams` | `ApiResponse<PageResult>` |  未连通 |
| 知识库详情 | GET | `/knowledge/{id}` | `id` | `ApiResponse` |  未连通 |
| 知识库新增 | POST | `/knowledge` | `{ ... }` | `ApiResponse` |  未连通 |
| 知识库更新 | PUT | `/knowledge/{id}` | `{ ... }` | `ApiResponse` |  未连通 |
| 知识库删除 | DELETE | `/knowledge/{id}` | `id` | `ApiResponse` |  未连通 |
| 会议列表 | GET | `/meeting/list` | `PageParams` | `ApiResponse<PageResult>` |  未连通 |
| 会议详情 | GET | `/meeting/{id}` | `id` | `ApiResponse` |  未连通 |
| 创建会议 | POST | `/meeting` | `{ ... }` | `ApiResponse` |  未连通 |
| 更新会议 | PUT | `/meeting/{id}` | `{ ... }` | `ApiResponse` |  未连通 |
| 取消会议 | POST | `/meeting/{id}/cancel` | `id` | `ApiResponse` |  未连通 |
| 文档列表 | GET | `/document/list` | `PageParams` | `ApiResponse<PageResult>` |  未连通 |
| 文档详情 | GET | `/document/{id}` | `id` | `ApiResponse` |  未连通 |
| 文档上传 | POST | `/document/upload` | `FormData` | `ApiResponse` |  未连通 |
| 文档删除 | DELETE | `/document/{id}` | `id` | `ApiResponse` |  未连通 |
| 行业洞察列表 | GET | `/insight/list` | `PageParams` | `ApiResponse<PageResult>` |  未连通 |
| 行业洞察详情 | GET | `/insight/{id}` | `id` | `ApiResponse` |  未连通 |

### 3. `src/api/ai.ts` · DeepSeek 直连

| 函数 | 路径 | 状态 |
| --- | --- | --- |
| `callDeepSeek` | `https://api.deepseek.com/chat/completions` (POST) |  已实现 |
| `aiChatResponse` | 封装 `callDeepSeek` |  已实现 |
| `generateMeetingSummary` | 同上 |  已实现 |
| `generateDocument` | 同上 |  已实现 |
| `checkCompliance`（AI 路径） | 同上 |  已实现 |
| `generateDashboardInsights` | 同上 |  已实现 |
| `generateAIWorkbenchSummary`（在 AIWorkbench 中） | 同上 |  **已下线**（AIWorkbench 组件删除，Dashboard 不再调用）|
| `getApiKey / setApiKey / hasApiKey` | localStorage |  已实现 |

>  **当前 commit 变更**：AIWorkbench 组件从 Dashboard 中移除，`generateAIWorkbenchSummary` 不再被任何业务代码调用。DeepSeek API 仍保留作为合规检查 / 报告生成的 AI 路径。

---

## 二、`src/services/` 目录 · 业务 Service 层（含契约定义）

> 全部为**前端 mock 实现**，代码注释已明确"真实对接时把 `await delay(...)` 换为 `axios.post(...)`"。

### 1. `src/services/meetingApiContract.ts`（前后端契约）

| 接口 | 方法 | 路径 | 用途 | 状态 | 前端契约 |
| --- | --- | --- | --- | --- | --- |
| 派单 | POST | `/api/v1/meetings/:id/actions/dispatch` | 把 Blackboard 派单成工单（带 idempotencyKey） |  未实现 | `MeetingDispatchRequest/Response` |
| 获取报告 | GET | `/api/v1/meetings/:id/report` | 会后结构化报告 |  未实现 | `MeetingReportResponse` |
| 列出会后工单 | GET | `/api/v1/meetings/:id/actions` | 列出工单 |  未实现 | `ActionListResponse` |
| 关闭工单 | PATCH | `/api/v1/actions/:id/close` | 标记 done |  未实现 | `CloseActionRequest` |

### 2. `src/services/postMeetingService.ts`（会后业务 mock）

| 函数 | 对应接口 | 状态 |
| --- | --- | --- |
| `dispatchActions(req)` | `POST /api/v1/meetings/:id/actions/dispatch` |  未实现（mock 含 5% 失败率） |
| `generateReport(meetingId)` | `GET /api/v1/meetings/:id/report` |  未实现（演示模式注入 `DEMO_REPORT_DATA`） |
| `listMeetingActions(meetingId)` | `GET /api/v1/meetings/:id/actions` |  未实现（前端 `Map<meetingId, MockWorkItem[]>`） |
| `closeOutAction(workItemId, req)` | `PATCH /api/v1/actions/:id/close` |  未实现 |
| `closeMeeting(meetingId, bb)` | 组合调用派单 |  未实现 |
| `downloadMarkdown(report)` | 纯前端 |  已实现 |

### 3. `src/services/weeklyReportService.ts`（周报生成）

| 函数 | 路径（注释中） | 状态 |
| --- | --- | --- |
| `generateWeeklyReport(opts)` | `POST /api/v1/reports/generate-weekly` |  未实现（前端 `runSandboxCheck` + `setTimeout`） |
| `submitWeeklyReport(report)` | — |  未实现 |
| `pushNotification({ channel })` | `POST /api/v1/notifications/send` |  未实现（mock 5% 失败率） |
| `getMockReportHistory()` | — |  未实现（纯前端 hardcoded） |

### 4. `src/services/sandbox/sandboxApiContract.ts`（沙箱契约）

| 函数 | 路径（注释中） | 状态 |
| --- | --- | --- |
| `checkCompliance(req)` | `POST /api/v1/sandbox/check` |  未实现（前端 `runSandboxCheck` 同步引擎 + 600-1000ms 延迟） |
| `getSandboxLogs()` | `GET /api/v1/sandbox/logs` |  未实现（前端 `sandboxLogStore` 单例内存） |
| `exportSandboxLogCsv()` | — |  已实现（前端 Blob 下载） |

### 5. `src/services/sandbox/sandboxEngine.ts`（本地规则引擎）

| 函数 | 状态 |
| --- | --- |
| `runSandboxCheck(text)` |  已实现（纯函数，47 条规则 × 9 大类） |
| 内含 5% 模拟失败率 | ️ 真实场景应移除 |

### 6. `src/services/sandbox/sandboxLog.ts`（沙箱日志内存 store）

| 函数 | 状态 |
| --- | --- |
| `sandboxLogStore.record/list/clear` |  未实现（单例内存 Map，重启清空） |
| `hashInput(text)` |  已实现（SHA-256 via `crypto.subtle`） |
| `previewInput(text)` |  已实现 |

### 7. `src/services/multiAgentOrchestrator.ts` + `multiAgentBus.ts`

| 项 | 状态 |
| --- | --- |
| `agentBus.subscribe/dispatch/subscribeAll` |  未实现（前端 EventBus 单例） |
| `blackboardStore` 共享黑板 |  未实现（前端单例 Map） |
| `agentRunStore` 单 Agent 运行状态 |  未实现 |
| `fanoutChunk(speaker, content)` |  未实现（前端 setTimeout 模拟并行） |
| `runClosingSummary()` |  未实现 |
| `resetMeeting(meetingId)` |  已实现（前端重置） |

### 8. `src/services/pdfExportService.ts`

| 函数 | 状态 |
| --- | --- |
| `exportMeetingPDF(report)` |  已实现（jsPDF + Helvetica，中文支持差） |
| `buildMeetingPDFBlob(report)` |  已实现 |

---

## 三、`src/mock/` 目录 · Mock 数据全景

| 文件 | 内容 | 调用方 | 状态 |
| --- | --- | --- | --- |
| ~~`src/mock/index.ts`~~ | ~~mockjs 注册：`/api/user/info`、`/api/statistics`、`/api/documents`、`/api/meetings`、`/api/knowledge`、`/api/insights`、`/api/tasks`、`/api/chat`~~ | — |  **已删除**（当前 commit）· mockjs 注册路由无业务代码触发，建议清理 → 已清理 |
| ~~`src/mock/data.ts`~~ | ~~`mockUser / mockStatistics / mockDocuments / mockMeetings / mockKnowledgeList / mockInsights / mockTasks`~~ | — |  **已删除**（当前 commit）· 各页已转用 service 层 mock，无人引用 |
| ~~`src/mock/data/knowledge.ts`~~ | ~~`mockKnowledge`（20 篇金融制度文档）~~ | — |  **已删除**（当前 commit）· Knowledge 页改用内联 mock |
| `src/mock/employees.ts` | `MOCK_EMPLOYEES`（12+ 员工档案） | Contacts 页 |  需后端实现 |
| `src/mock/sandboxDemo.ts` | `DEMO_SANDBOX_TEXTS`（演示用合规文本） | Sandbox |  需后端实现 |
| `src/mock/meetingDemo.ts` | `DEMO_MEETING_ID / DEMO_TRANSCRIPTS / DEMO_BLACKBOARD_SNAPSHOT / DEMO_REPORT_DATA` | MeetingHub（演示模式） |  需后端实现 |
| `types/api.ts` 中 `__MOCK_DATA__` | 5 条会议 + 10 条问答 + 10 条文档 + 10 条新闻 + 1 个当前用户 | 部分页内联引用 |  需后端实现 |
| `types/permission.ts` 中 `MOCK_USERS` | 3 个角色（张三 / 李四 / 王五） | `usePermission` Hook |  需后端实现 · **当前 commit 升级**：类型化 `Role` / `Permission` / `MenuItem.group` 后端按枚举实现 RBAC |

>  **当前 commit 变更**：mock 数据清理是结构性优化——`src/mock/index.ts` + `src/mock/data.ts` + `src/mock/data/knowledge.ts` 共 3 个文件（-504 行）已删除，业务数据改由 service 层统一管理（如 `postMeetingService.ts` mock 业务编排 + `meetingDemo.ts` 演示数据）。**所有 mock 数据未来都由后端接口接管**。

---

## 四、真实 axios / fetch 调用一览（grep 结果）

| 文件 | 行号 | 调用 | 状态 |
| --- | --- | --- | --- |
| `src/api/ai.ts` | 38 | `axios.post('https://api.deepseek.com/chat/completions', ...)` |  真实（公网 DeepSeek） |
| `src/api/modules.ts` | 27-63 | 19 个 `http.{get/post/put/delete}` 调用封装 | ️ 已封装，未被任何业务组件调用 |
| `src/utils/request.ts` / `src/api/request.ts` | — | axios 实例创建 + 拦截器 |  已就绪 |
| `src/services/postMeetingService.ts` | 56 / 139 / 190 / 217 | 4 处 `axios.post/get/patch` **注释** |  未实现 |
| `src/services/sandbox/sandboxApiContract.ts` | 21 | 1 处 `axios.post` **注释** |  未实现 |
| `src/services/weeklyReportService.ts` | 173 / 272 | 2 处 `axios.post` **注释** |  未实现 |

>  **结论**：当前项目内**真正执行的 axios 业务调用只有 1 处**（DeepSeek），其余均为封装层 + 注释占位。`VITE_USE_MOCK=true` 启动后 mockjs 注册的路由也无业务代码触发。

---

## 五、缺口分析总结（按优先级）

###  P0 · 必须后端实现的接口（前端已有完整契约）

1. **会议会后派单** `POST /api/v1/meetings/:id/actions/dispatch`
   - 前端契约：`meetingApiContract.ts` 已定义完整 TS 类型
   - 字段：`idempotencyKey, meetingId, actions[], notify?`
   - 业务价值：会议闭环核心

2. **会议报告** `GET /api/v1/meetings/:id/report`
   - 前端契约：`meetingApiContract.ts`
   - 字段：`summary, sections.decisions[], sections.actions[], sections.risks[], sections.facts[], sections.topics[]`

3. **工单管理** `GET /api/v1/meetings/:id/actions`、`PATCH /api/v1/actions/:id/close`

4. **合规沙箱检测** `POST /api/v1/sandbox/check`
   - 前端契约：`sandboxApiContract.ts`
   - 字段：`text, source`
   - 真实对接时可继续用本地引擎（响应快），或对接大模型做深度语义分析

5. **沙箱日志** `GET /api/v1/sandbox/logs`
   - 审计需求，前端内存 store 无法跨会话保留

6. **多 Agent 协作总线**（WebSocket）
   - 前端契约：`multiAgentBus.ts` 注释明确
   - 字段：`agent:started/thinking/token/completed/failed、blackboard:updated、meeting:state、transcript:chunk`
   - 业务价值：4 Agent 实时协作核心

7. **周报生成** `POST /api/v1/reports/generate-weekly`

8. **通知推送** `POST /api/v1/notifications/send`
   - 渠道：dingtalk / email / wechat / system

###  P1 · 已有封装但未连通业务

9. **用户 / 认证** `/user/login`、`/user/info`、`/user/logout`
   - 前端封装：`userApi`，但 `useUserStore` 直接用 localStorage mock
   - 字段：username, password, avatar, role

10. **知识库 CRUD** `/knowledge/list`、`/knowledge/{id}`、`/knowledge` (POST/PUT/DELETE)
    - 前端封装：`knowledgeApi`，Knowledge 页直接读 `mockKnowledge`

11. **会议 CRUD** `/meeting/list`、`/meeting/{id}`、`/meeting` (POST/PUT/cancel)

12. **文档管理** `/document/list`、`/document/{id}`、`/document/upload` (FormData)、`/document/{id}` (DELETE)

13. **行业洞察** `/insight/list`、`/insight/{id}`

14. **mockjs 注册的 7 个旧路径**（`/api/user/info`、`/api/statistics` 等）— 无业务代码触发，建议删除或迁移

###  P2 · 已有完整前端实现

15. **PDF 导出**（前端 jsPDF）— 真实后端可用 Puppeteer + 中文字体替换

16. **本地合规引擎**（47 条规则）— 真实后端可保留作为"快速模式"，对接大模型做"深度模式"

17. **本地摄像头**（`getUserMedia`）— 浏览器原生，无需后端

18. **i18n**（zh-CN / en-US）— 前端独立

19. **通知 store**（zustand + persist）— 前端独立

20. **通讯录 + 聊天**（zustand + persist）— 前端独立，真实对接 IM 系统

---

## 六、前端契约文件索引（后端按此实现即可）

> 后端同学可直接对照以下文件的 TS 类型 + 注释中的 curl/axios 示例实现接口：

| 契约文件 | 对应接口 |
| --- | --- |
| `src/services/meetingApiContract.ts` | 会议会后派单 / 报告 / 工单 |
| `src/services/sandbox/sandboxApiContract.ts` | 合规沙箱检测 / 日志 |
| `src/services/weeklyReportService.ts` | 周报生成 / 通知推送 |
| `src/api/modules.ts` | 用户 / 知识库 / 会议 / 文档 / 行业洞察 CRUD |
| `src/services/multiAgentOrchestrator.ts` + `multiAgentBus.ts` | 多 Agent 协作总线（WebSocket） |

---

## 七、待确认事项（架构层）

| 项 | 备注 |
| --- | --- |
| 后端基础框架选型（Spring Boot / NestJS / Go / Python FastAPI） | 未在代码中发现 |
| 数据库选型（MySQL / PostgreSQL / MongoDB） | 未在代码中发现 |
| 鉴权方案（JWT / OAuth 2.0 / SSO） | 前端 `Authorization: Bearer <token>` 表明倾向 JWT，但无登录接口对接 |
| Web 网关 / Nginx 配置 | 无 |
| 真实环境变量（生产 / 预发） | `.env.production` 用占位 `https://api.example.com` |

---

## 八、建议的接入步骤

1. **第一阶段（打通 P0 接口）**
   - 实现 `meetingApiContract.ts` 中 4 个接口 → 替换 `postMeetingService.ts` 注释
   - 实现 `sandboxApiContract.ts` 中 2 个接口（保留本地引擎作为快速模式）→ 替换 sandboxApiContract 注释
   - 实现 `weeklyReportService.ts` 中 2 个接口
   - WebSocket 多 Agent 总线协议对接 `multiAgentBus.ts`

2. **第二阶段（打通 P1 接口）**
   - 实现 `src/api/modules.ts` 19 个 CRUD 接口
   - 把 `useUserStore / useKnowledge / useMeeting` 等 zustand store 的 mock 数据改为调真实接口
   - 清理 `src/mock/index.ts` 的 mockjs 注册

3. **第三阶段（优化）**
   - PDF 导出改为后端 Puppeteer + 中文字体
   - 合规检测新增"深度模式"（对接大模型语义分析）
   - 上传文件转对象存储（OSS / MinIO）

---

## 九、本次 commit 增量（2026-09-19）

> 本节专门记录 `feat: 接入会议纪要接口` 这轮 commit 中**新增/下线/升级**的内容，便于后端同学快速对齐变更。

### 1. AI 板块下线（5 个页面删除）

| 原页面 | 路由 | 处置 |
| --- | --- | --- |
| `pages/AgentHub/index.tsx` | `/agent-hub?tab=xxx` | ️ 删除 |
| `pages/Memory/index.tsx` | `/memory` | ️ 删除 |
| `pages/Plugin/index.tsx` | `/plugins` | ️ 删除 |
| `pages/Dashboard/components/AIWorkbench/*` | Dashboard 子组件 | ️ 删除（dead code）|

**对应接口影响**：
- `POST /api/v1/chat` 流式问答：原 P0 → 现 **P3 暂不实现**
- `GET /api/v1/agents` 多 Agent 列表：原缺失 → 现 **无需实现**
- `POST /api/v1/agents/dispatch` Agent 调度：原缺失 → 现 **无需实现**
- `GET /api/v1/memory/sessions` 长会话记忆：原缺失 → 现 **无需实现**

### 2. mock 数据清理（3 个文件删除）

-  `src/mock/index.ts` — mockjs 注册中心（-108 行）· 无业务代码触发
-  `src/mock/data.ts` — 全局 mock（-112 行）· 各页已不用
-  `src/mock/data/knowledge.ts` — 知识库 mock（-284 行）· Knowledge.tsx 已内联接管

**保留**：`src/mock/meetingDemo.ts` / `src/mock/employees.ts` / `src/mock/sandboxDemo.ts`（演示场景真实需要）。

### 3. 新增 Service / 组件（前端契约就绪，待后端实现）

| 前端契约位置 | 接口路径 | 用途 |
| --- | --- | --- |
| `src/components/Notifications.tsx` → `useNotificationStore` | `GET /api/v1/notifications` | 通知列表 |
| `useNotificationStore.markAsRead` | `POST /api/v1/notifications/:id/read` | 通知标记已读 |
| `useNotificationStore` (todo-link 业务跳转) | `PATCH /api/v1/notifications/:id/todo-link` | 通知关联待办跳转 |
| `src/components/Meeting/WorkItemMetricsPanel.tsx` | `GET /api/v1/workitems/metrics` | 工单度量聚合 |
| `src/components/Sandbox/BatchComplianceScanPanel.tsx` | `POST /api/v1/sandbox/batch-scan` | 批量合规扫描 |
| `src/services/sandbox/complianceReceipt.ts` | `GET /api/v1/sandbox/receipts/:id` | 合规回执详情 |
| `src/store/accessAuditStore.ts` | `POST /api/v1/access-audit/log` | 访问审计日志上报 |
| `src/pages/Settings/AdminPushChannelSettings.tsx` | `POST /api/v1/push/channels/test` | 推送渠道测试发送 |

### 4. 权限体系结构化升级

| 文件 | 变更 |
| --- | --- |
| `src/types/permission.ts` (+97 行) | 新增 `Role` / `Permission` / `MenuItem.group` 类型；`GROUP_LABELS` 分组枚举 |
| `src/hooks/usePermission.ts` (+90 / -23) | 重写权限 Hook：`filterAccessibleMenus` / `can` / `hasRole` 等 |
| `src/components/Can.tsx` (+25 行 · 新增) | 权限包裹组件（`<Can roles={['SUPER_ADMIN']}>...</Can>`） |

**对接建议**：后端 RBAC 返回结构对齐 `usePermission` Hook 的输入格式，前端 0 改动：
```ts
{
  user: { id, name, role: 'SUPER_ADMIN' | 'DEPT_ADMIN' | 'USER' },
  menus: MenuItem[],  // 按 group: 'core' | 'compliance' | 'knowledge' | 'communication' | 'system'
  permissions: string[],  // 细粒度权限码
}
```

### 5. 其他业务增量

- `meetingWorkItemStore.ts` (+162 行)：工单 store 重构（持久化 + 状态机）
- `meetingApiContract.ts` (+4)：契约新增字段（具体字段见文件注释）
- `postMeetingService.ts` (+3)：mock 业务编排小补丁
- 通知 `NotificationType` 新增 `'todo'`；每条通知补 `businessRef`（跳转业务单据必须）

### 6. 死循环修复（前端 Bug 修复）

MeetingRoom `Maximum update depth exceeded` 已修复，影响接口契约无变化，但**前端状态管理更稳**，建议后端实现时复用 zustand + `useRef` 比对上次值的模式。

---

> 调研方法：直接 grep / read 源码，未运行项目，未改动任何代码。
> 报告生成时间：2026-09-16（最近更新：2026-09-19）
