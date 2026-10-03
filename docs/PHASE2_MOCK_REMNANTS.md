# Phase 2 仍依赖 Mock 的页面 / 模块清单

> Phase 1 已把**登录 / 鉴权 / 路由守卫**切到真实后端（`/api/v1/auth/*`）。
> 下面的模块仍 100% 走本地 mock 或前端内嵌数据；Phase 2 才轮到它们。

## 一、仍 100% Mock 的业务页面

| 页面 / 模块 | Mock 来源 | 说明 |
|---|---|---|
| `pages/Dashboard/index.tsx` | `mock/meetingDemo`、`mock/announcementDemo` + 内联数据 | 工作台指标、待办、推荐会议都是 hardcoded；`useDemoMode` 链路完整本地化 |
| `pages/Meeting/*`（含 `MeetingHub` / `Meeting.tsx` / `PostMeetingReport.tsx`） | `mock/meetingDemo` + `services/postMeetingService.ts` | 会议列表、会议纪要、行动项、转写全部 mock |
| `pages/Knowledge/index.tsx` 与 `pages/Knowledge.tsx` | `mock/policyDocuments.ts` + 内联 | 知识库列表、文档搜索、文档详情 |
| `pages/IndustryNews/index.tsx` | 内联 mock 数组 | 行业新闻列表 / 详情 |
| `pages/Report/index.tsx` | `mock/meetingDemo` + `services/weeklyReportService.ts` | 周报 / 会议报告生成全是本地数据 |
| `pages/Sandbox.tsx` 与 `components/Sandbox/SandboxRunner.tsx` | `mock/sandboxDemo.ts`、`services/sandbox/sandboxApiContract.ts` | 合规沙箱调用结果用本地 mock 模拟 |
| `pages/Approval/index.tsx` | `services/approvalSubmitService.ts` | 审批草稿、提交、轨迹都是前端 store |
| `pages/Contacts/index.tsx` + `store/contactsStore.ts` / `contactsActions.ts` | `mock/employees.ts` | 通讯录搜索 / 详情 / 收藏 |
| `pages/Notifications.tsx` / `notificationStore.ts` | 内联 mock | 通知 / 公告 |
| `pages/QA.tsx`、`pages/Chat.tsx`、`pages/Agent/**` | `services/multiAgentOrchestrator.ts` + `eventBus` | 多 Agent 编排、问答上下文全是前端 |
| `pages/Insights/**`、`pages/Radar/**`、`pages/LaunchPad/**`、`pages/Logs/**` | 内联 mock | 雷达 / 投顾 / 启动台 / 日志页 |
| `pages/Profile.tsx`、`pages/Security/**`、`pages/Settings/**` | `store/accessAuditStore.ts` + 内联 | 个人中心 / 权限 / 设置全是本地审计 |

## 二、Mock 数据源总览

| 文件 | 内容 |
|---|---|
| `src/mock/employees.ts` | 通讯录候选人（约百人） |
| `src/mock/meetingDemo.ts` | 演示会议转写、Blackboard 快照、报告数据 |
| `src/mock/policyDocuments.ts` | 制度文档 + 知识库示例 |
| `src/mock/sandboxDemo.ts` | 合规沙箱命中样例 |
| `src/mock/announcementDemo.ts` | 公告样例 |
| `src/mock/todos.ts` | 待办样例 |

## 三、前端遗留的"看起来是 API"但其实是假的

- `src/api/modules.ts` 里的 `userApi / knowledgeApi / meetingApi / documentApi / insightApi` —— 仍是 mock 风格（`/user/info`、`/knowledge/list` 等路径对不上后端）。Phase 1 没人 import，**但如果 Phase 2 直接在业务页里用上，会立刻接错后端**。建议在 Phase 2 重写为 `auth/knowledge/meeting/...` 的真实 API 模块。
- `src/api/ai.ts` 直接打 DeepSeek 公共 API —— ⚠️ **生产严禁**，已加文件头警示。Phase 2 改造：
  1) 新增后端 `app/features/ai/router.py`，路由 `/api/v1/ai/chat`、`/api/v1/ai/summary` 等
  2) Key 从 `.env` 注入后端
  3) 前端改为 `http.post('/ai/...')`

## 四、Phase 2 推荐顺序

1. **Knowledge** —— 后端已有 `knowledge_bases / knowledge_documents / document_chunks` 表，缺 API；先补 list / detail / 上传 / 解析状态查询。
2. **Meeting** —— 后端无相关表，需要新建 schema；先 list + 详情 + 转写 list。
3. **Approval / Workitem** —— 后端无表，需要新建。
4. **Contacts** —— 后端无表，需要新建。
5. **Sandbox / QA / Chat / Report** —— 业务复杂，建议先沉淀到 RAG + AI 路由。
6. **Notifications** —— 可考虑 WebSocket / SSE，Phase 2 中后期再做。

## 五、Phase 1 已落地（真实 API）

- `POST /api/v1/auth/login`（OAuth2PasswordRequestForm）
- `POST /api/v1/auth/register`（JSON）
- `GET  /api/v1/auth/me`（Bearer JWT）
- `GET  /api/v1/system/health/live`
- `GET  /api/v1/system/health/ready`
- `scripts/create_user.py` 创建用户（admin / superuser）

后端已启用的表（迁移到位即可用）：
- `users`
- `knowledge_bases` / `knowledge_documents` / `document_chunks`
- `chat_conversations` / `chat_messages`
- `index_generations`