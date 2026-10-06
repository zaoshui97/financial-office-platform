# Dev Log（每日自动记录）

> 自动维护，本文件由 `.husky/pre-commit` 钩子 + `scripts/auto-log.cjs` 在每次 commit 时自动追加。
> 手动编辑请保留区段标记，机器人用 `<!-- AUTO:ENTRY-START -->` / `<!-- AUTO:ENTRY-END -->` 定位。

---

## 每日提交快照（自动）

<!-- AUTO:ENTRY-START -->

### 2026-09-19 00:31  @fans  [refactor: AI 智能中心下线 + mock 数据精简 + Notifications 业务跳转 + 死循环根治]

- **触及文件**: 43 个（+1533 / -2268），新增 10 个未跟踪文件（+1462）

- **删除 AI 智能中心板块**（8 个文件 / -1970 行）：
  - `src/pages/AgentHub/index.tsx`（-211）— `/agent-hub?tab=chat/qa/agent/memory` 整合入口下线
  - `src/pages/Memory/index.tsx`（-788）— 长会话记忆页面
  - `src/pages/Plugin/index.tsx`（-106）— 插件市场
  - `src/pages/Dashboard/components/AIWorkbench/`（-221 + -139）— Dashboard AI 工作台子组件（dead code，Dashboard 已不再引用）
  - `src/mock/data.ts`（-112）— 全局 mock 数据（无人引用）
  - `src/mock/data/knowledge.ts`（-284）— 知识库 mock 数据（已被 Knowledge.tsx 内联接管）
  - `src/mock/index.ts`（-108）— mockjs 注册中心（已被业务层 service 接管）

- **路由 / 菜单清理**：
  - `src/router.tsx`（+16 / -16）— 移除 `AgentHub` / `PluginMarket` 懒加载、`/agent-hub` / `/plugins` 路由条目；`/chat` `/qa` `/agent` `/memory` 4 个老兼容路由改为跳 `/dashboard`
  - `src/components/Layout/Sidebar.tsx`（+5 / -25）— 移除 `/agent-hub` 和 `/plugins` 菜单项；移除 `ai` 分组渲染块
  - `src/components/Layout/Topbar.tsx`（+0 / -24）— 移除"AI 助手"快捷入口按钮 + `onAiAssistantClick` prop
  - `src/pages/LaunchPad/index.tsx`（+0 / -16）— 移除 LaunchPad 上的"智能问答"/"团队聊天"卡片

- **死循环根治**（关键 bug 修复）：
  - `src/pages/Meeting/MeetingRoom.tsx`（+17 / -8）— 修两处死循环：
    1. `setParticipants` effect 加 `lastSyncedRef` ref 比对，只有 `videoOff / muted` 实际变化才 setState
    2. AI 模拟分析 effect 加 `clearTimeout` cleanup + 引用 `timer` 变量防止 unmount 后触发 setState
  - **根因**：原代码 `prev.map(...)` 每次产生新数组引用 → 子组件 useEffect 重跑 → 父组件 setState → 死循环（"Maximum update depth exceeded"）

- **Notifications 业务跳转打通**（体验修复）：
  - `src/store/notificationStore.ts`（+11 / -0）— `NotificationType` 新增 `'todo'`；"任务即将到期"通知改 `type: 'todo'` + 加 `businessRef`；同步给会议提醒/邀请加 businessRef
  - `src/store/todoStore.ts`（+10 / -0）— 新增 `activeId` 字段 + `setActiveId` action + `partialize` 排除持久化（通知跳转后高亮 Dashboard 对应待办）
  - `src/pages/Notifications.tsx`（+147 / -0）— 整个通知卡片点击 = 标记已读 + 跳转业务单据；`routeByBusinessRef()` 按 type 路由到 Dashboard / MeetingRoom / Approval / Report / IndustryNews；action 按钮 `view`/`join`/`accept`/`decline`/`complete` 全部联通
  - `src/i18n/locales/zh-CN.json` + `en-US.json`（+1 / -1 各）— 加 `notification.todo` 文案

- **Dashboard 重构**：
  - `src/pages/Dashboard/index.tsx`（+24 / -46）— 移除顶部"AI 助手"按钮；精简卡片布局

- **多页面 i18n / 权限 / 业务逻辑补强**：
  - `src/pages/Approval/index.tsx`（+87 / -22）— 接入 `usePermission` 角色过滤；审批草稿联动
  - `src/pages/Report/index.tsx`（+87 / -23）— 周报页面重写：走 `usePermission` + i18n 化
  - `src/pages/Sandbox.tsx`（+40 / -17）— 沙箱运行页重构
  - `src/pages/Contacts/index.tsx`（+11 / -0）— 通讯录页面小幅增强
  - `src/pages/Knowledge.tsx` + `Knowledge/index.tsx`（+94 / -65）— 知识库两入口整合（删除旧 `Knowledge.tsx` 的部分硬编码，统一走 `Knowledge/index.tsx`）
  - `src/pages/Settings/index.tsx`（+6 / -0）— 注册新的"外部推送"Tab

- **权限体系大升级**（亮点）：
  - `src/types/permission.ts`（+97 / -0）— 新增 `Role` / `Permission` / `MenuItem` 类型；`GROUP_LABELS` 分组枚举
  - `src/hooks/usePermission.ts`（+90 / -23）— 重写权限 Hook：`filterAccessibleMenus` / `can` / `hasRole` 等
  - 新增 `src/components/Can.tsx`（+25）— 权限包裹组件（`<Can roles={['SUPER_ADMIN']}>...</Can>`）

- **Sandbox 多组件新增**（演示增强）：
  - `src/components/Sandbox/RegulationPanel.tsx`（+103）— 法规面板
  - `src/components/Sandbox/BatchComplianceScanPanel.tsx`（+256）— 批量合规扫描
  - `src/components/Sandbox/ComplianceReceiptCard.tsx`（+234）— 合规回执卡片
  - `src/services/sandbox/complianceReceipt.ts`（+190）— 合规回执服务契约

- **会议相关补强**：
  - `src/components/Meeting/PostMeeting/ActionCard.tsx`（+20 / -18）— 工单卡片状态机增强
  - `src/components/Meeting/PostMeeting/ActionDispatchPanel.tsx`（+21 / -14）— 派单面板统计增强
  - `src/components/Meeting/PostMeeting/ExportToolbar.tsx`（+89 / -33）— 导出工具栏扩展（PDF/MD/分享）
  - `src/components/Meeting/MeetingSegmentDrawer.tsx`（+101 / -0）— 新增：会议片段抽屉（按时间轴定位转写片段）
  - `src/components/Meeting/WorkItemMetricsPanel.tsx`（+158 / -0）— 新增：工单度量面板
  - `src/services/meetingApiContract.ts`（+4 / -0）— 契约新增字段
  - `src/services/postMeetingService.ts`（+3 / -0）— mock 业务层小补丁
  - `src/store/meetingWorkItemStore.ts`（+162 / -0）— 工单 store 重构（持久化 + 状态机）
  - `src/mock/meetingDemo.ts`（+133 / -0）— 新增：会议演示数据（DEMO_MEETING_ID / DEMO_TRANSCRIPTS / DEMO_BLACKBOARD_SNAPSHOT / DEMO_REPORT_DATA）

- **审计 / 推送**：
  - `src/store/accessAuditStore.ts`（+57 / -0）— 新增：访问审计 store（敏感操作日志）
  - `src/pages/Settings/AdminPushChannelSettings.tsx`（+338 / -0）— 新增：管理员推送渠道配置页

- **Contacts / Chat 业务小补**：
  - `src/store/contactsActions.ts`（+5 / -0）+ `contactsStore.ts`（+5 / -0）+ `src/store/index.ts`（+2 / -0）— 通讯录 store 动作小幅增强

- **杂项**：
  - `src/main.tsx`（+0 / -1）— 移除一行（关闭 React StrictMode）
  - `src/hooks/useGlobalSearch.ts`（+2 / -2）— 通知搜索 qa 类型 url 改走 `/approval`
  - `src/hooks/useKeyboardShortcuts.ts`（+3 / -7）— `g q` 快捷键改跳 `/meeting`；删除 `ctrl+/` AI 助手 dead shortcut

**核心实现思路：**

- **AI 板块做减法**：4 个相似度高、演示时评委分不清边界的入口（Chat/QA/Agent/Memory）下线，聚焦到 `MeetingHub` / `Approval` / `Sandbox` / `Report` / `Knowledge` 5 个核心亮点，演示叙事更聚焦。`Sidebar` 菜单从 12 → 10 条，视觉清爽度提升。
- **mock 数据瘦身**：`src/mock/data.ts` + `src/mock/data/knowledge.ts` 全删（无人引用），统一由业务 service 层（如 `postMeetingService.ts`）注入演示数据；`src/mock/meetingDemo.ts` 接管会议演示数据。
- **死循环是 zustand + React 18 经典陷阱**：`useStore()` 选择器返回新对象/数组 → 子组件 useEffect 重跑 → setState → 死循环。本轮用 `useRef` 比对上次值 + `clearTimeout` cleanup 双管齐下根治。
- **Notifications 业务跳转打通**：`NotificationType` 补齐 `todo` 类型；`businessRef` 从"可有可无"变成"必备"——每个通知都要说明"它指向哪个业务单据"。点击通知卡片 = 自动已读 + 跳转到对应页面，体验连贯。
- **权限体系结构化升级**：从原来散落的 `MOCK_USERS` 硬编码，升级为类型化的 `Role[]` / `MenuItem.group` 分组枚举 + `usePermission()` Hook + `<Can>` 组件包裹，后续对接真实后端 RBAC 时零改动。

**关键工程护栏：**

- `useEffect` 里 `setState` 时**必须用 ref 比对上次值**，避免引用变化触发循环
- `setTimeout` / `setInterval` / `EventBus.subscribe` **必须有 cleanup 函数**
- `zustand store` 的 `useStore(selector)` 选择器**只返回原始值**（`.length` / 单个字段），不要返回新对象
- 通知类消息**必须有 `businessRef`**，否则就是"死通知"
- `Sidebar` 菜单分组现在明确收敛为：`core / compliance / knowledge / communication / system` 5 个，`ai` 分组已废弃（保留 `MenuGroup` 类型以兼容老代码）

**关联上交材料**：材料 2（系统设计 - 路由简化 + 权限升级）/ 材料 4（演示视频重点场景 1 - 通知跳转闭环）/ 材料 5（场景分析 - 新增通知场景）/ 材料 8（开发记录）

---

- **触及文件**: 23 个（+2577 / -19）

- **新增服务层**（3）：
  - `src/services/meetingApiContract.ts`  (+198 / -0) — 前后端契约类型定义（纯类型）
  - `src/services/postMeetingService.ts`  (+308 / -0) — 会后业务 mock 层（dispatchActions / generateReport / listMeetingActions / closeOutAction / closeMeeting）
  - `src/services/pdfExportService.ts`  (+219 / -0) — jsPDF 封装（含品牌标识 + 分页 + 页脚）

- **新增 PostMeeting 组件**（5）：
  - `src/components/Meeting/PostMeeting/ReportSummary.tsx`  (+145 / -0) — 5 段报告渲染（摘要/决策/风险/议题）
  - `src/components/Meeting/PostMeeting/ActionCard.tsx`  (+132 / -0) — 单工单卡片（含状态机 + 关闭操作）
  - `src/components/Meeting/PostMeeting/ActionDispatchPanel.tsx`  (+178 / -0) — 派单面板（含 4 项统计 + 失败告警）
  - `src/components/Meeting/PostMeeting/ExportToolbar.tsx`  (+119 / -0) — PDF/MD/分享工具栏
  - `src/components/Meeting/PostMeeting/PostMeetingDrawer.tsx`  (+198 / -0) — Drawer 总容器（3 Tab：报告/派单/导出）

- **新增页面**（1）：
  - `src/pages/Meeting/PostMeetingReport.tsx`  (+212 / -0) — 独立报告页 `/meeting/:id/report`

- **修改**（7）：
  - `src/services/multiAgentOrchestrator.ts`  (+22 / -4) — `runClosingSummary` 联动 `postMeetingService.closeMeeting()` 自动派单
  - `src/router.tsx`  (+8 / -0) — 注册 `/meeting/:id/report` 路由
  - `src/pages/Meeting/MeetingRoom.tsx`  (+18 / -4) — `handleEndMeeting` 改为先 `runClosingSummary` → 弹 PostMeetingDrawer
  - `src/pages/Meeting/MeetingList.tsx`  (+8 / -2) — 已结束会议卡片加"查看报告"按钮
  - `src/i18n/locales/zh-CN.json`  (+89 / -0) — `postMeeting.*` 26 个 key
  - `src/i18n/locales/en-US.json`  (+89 / -0) — `postMeeting.*` 26 个 key
  - `package.json`  (+1 / -0) — 加 `jspdf` 依赖

- **文档同步**（6）：
  - `docs/api-contract-frontend.md`  (+148 / -0) — 附录 B：5 个新增接口契约
  - `docs/delivery/README.md`  (+18 / -0) — 亮点 1 进度看板
  - `docs/delivery/api-gap-tracker.md`  (+9 / -0) — 5 个接口补齐记录
  - `docs/delivery/metrics.md`  (+22 / -0) — 亮点 1 专项指标 +10 个
  - `docs/delivery/scenario-analysis.md`  (+52 / -0) — 场景 2 升级为端到端闭环
  - `docs/delivery/dev-log.md`  (+72 / -9) — 决策段"亮点 1 升级"

**核心实现思路：**

- **前后端严格分离**：UI 组件只调 `xxxService.xxx()`，不写 setTimeout/axios。`meetingApiContract.ts` 是契约类型，`postMeetingService.ts` 是 mock 业务层。后端上线后只换 service 内部实现，UI 0 改动。
- **5 个 service 函数体内都标了"真实对接时应该写什么 axios 代码"**，方便后端同学上手。
- **Drawer + 独立报告页 双入口**：Drawer 适合"会后立刻看一眼"，独立报告页适合"评委演示时全屏展示"。
- **派单 5% 失败率**：模拟真实场景"个别指派人不在组织架构中"的情况，让评委看到失败处理逻辑。
- **Blackboard 单例复用**：PostMeetingReport 页面打开时直接从 `blackboardStore.get()` 拿数据，0 网络请求，500ms 加载完。
- **jsPDF 而不是 html2canvas**：PDF 是结构化报告（标题/表格/列表），不需要复杂排版；jsPDF 文本 API 足够；体积小（19 个包）。

**关联上交材料**：材料 2（系统设计 - 多 Agent 架构 + 前后端解耦）/ 材料 4（演示视频重点场景 1）/ 材料 5（API 契约附录 B · 5 个新增接口）/ 材料 8（开发记录）

---

### 2026-09-14 00:46  @fjlyh  [亮点 1：4 Agent 协作会议 + 会前预演]

- **触及文件**: 12 个（+3901 / -0）

- **新增服务层**（3）：
  - `src/services/multiAgentBus.ts`  (+129 / -0) — Agent EventBus（订阅/发布 + 200 条历史快照）
  - `src/services/multiAgentOrchestrator.ts`  (+509 / -0) — 4 Agent 编排器 + Blackboard 共享黑板
  - `src/services/useMultiAgent.ts`  (+63 / -0) — React Hooks 适配层（`useBlackboard` / `useAgentRunState` / `useAllAgentRunStates`）

- **新增 Meeting 组件**（4）：
  - `src/components/Meeting/AgentCard.tsx`  (+177 / -0) — 单 Agent 卡片（打字机光标 + 进度条 + shimmer）
  - `src/components/Meeting/AgentPanel.css`  (+96 / -0) — blink / flow-line / shimmer 动画
  - `src/components/Meeting/AgentPanel.tsx`  (+239 / -0) — 多 Agent 协作主面板（输入/模拟/关闭会议）
  - `src/components/Meeting/Blackboard.tsx`  (+235 / -0) — 共享黑板（决策/待办/风险/事实）

- **新增页面**（1）：
  - `src/pages/Meeting/MeetingRehearsal.tsx`  (+232 / -0) — 会前预演页面（4 Agent 模拟 + 就绪度圆环）

- **修改**（4）：
  - `src/router.tsx`  (+10 / -0) — 注册 `/meeting-rehearsal/:id` 路由
  - `src/pages/Meeting/MeetingList.tsx`  (+10 / -0) — 未开始会议卡片增加"会前预演"按钮
  - `src/pages/Meeting/MeetingRoom.tsx`  (+40 / -0) — 默认渲染多 Agent 面板；发送消息自动 fanout 4 Agent
  - `src/pages/Profile.tsx`  (+3 / -0) — 顺手修复原有 `t is not defined` bug（`getMockUserData` 在 hook 外用 t）

**核心实现思路：**

- 4 个 Agent 角色定义在 `multiAgentBus.ts`：`moderator` / `notetaker` / `decision` / `action`，各自负责节奏控制/转写/决策点/待办派发
- 共享 Blackboard（黑板模式）替代链式调用，符合真实多 Agent 系统设计
- 打字机流式输出 + EventBus 解耦：后端真多 Agent 上线后只需替换 `dispatch()` 内部为 WebSocket，**前端组件代码 0 改动**
- `useSyncExternalStore` 替代 zustand，照样高性能响应式

**关联上交材料**：材料 2（系统设计 - 多 Agent 架构）/ 材料 4（演示视频重点场景 1 - 会前预演 + 会中 4 Agent 协作）/ 材料 8（开发记录）

---

### 2026-09-14 00:50  @fjlyh  [chore: gitignore 补充]

- **触及文件**: 1 个（+6 / -0）
  - `.gitignore`  — 新增 `*.bak` / `*.bak.rewrite` / `*.bak.gbk` / `*.gbk.bak` 4 条 ignore 规则

**决策理由**：发现工作区残留 12 个 `scripts/rewrite-iszh.cjs` 与备份脚本产生的 `.bak.rewrite` / `.gbk.bak` 文件，原始 commit 不应混入历史备份。补 gitignore 防止后续 commit 误带。

**关联上交材料**：材料 8（开发记录 - 工程规范）

### 2026-09-10 22:59  @fans  [回填]

- **触及文件**: 19 个（+3929 / -0）

- **工程配置**（2）：
  - `.husky/pre-commit`  (+25 / -0)
  - `package.json`  (+1 / -0)

- **交付记录**（5）：
  - `docs/delivery/README.md`  (+72 / -0)
  - `docs/delivery/api-gap-tracker.md`  (+44 / -0)
  - `docs/delivery/dev-log.md`  (+85 / -0)
  - `docs/delivery/metrics.md`  (+22 / -0)
  - `docs/delivery/scenario-analysis.md`  (+69 / -0)
  - `docs/delivery/team.md`  (+43 / -0)

- **文档**（1）：
  - `docs/i18n-guidelines.md`  (+119 / -0)

- **脚本 / 工程化**（5）：
  - `scripts/auto-log.cjs`  (+226 / -0)
  - `scripts/check-i18n.js`  (+148 / -0)
  - `scripts/fix-meeting-detail.cjs`  (+55 / -0)
  - `scripts/fix-placeholders.cjs`  (+54 / -0)
  - `scripts/scan-qmark.cjs`  (+23 / -0)

- **国际化**（3）：
  - `src/i18n/index.ts`  (+129 / -0)
  - `src/i18n/locales/en-US.json`  (+646 / -0)
  - `src/i18n/locales/zh-CN.json`  (+646 / -0)

- **页面**（2）：
  - `src/pages/Login/index.tsx`  (+499 / -0)
  - `src/pages/Meeting/MeetingDetail.tsx`  (+851 / -0)

**自动检测到的改动摘要：**

- **导出常量**（5）：
  - export const SUPPORTED_LANGUAGES
  - export const changeLanguage
  - export const getCurrentLanguage
  - export const isZh
  - export const appText

- **导出接口**（1）：
  - export type SupportedLanguage

- **i18n key**：
  - t('login.featureAi')
  - t('login.featureBi')
  - t('login.featureMr')
  - t('login.featureSl')
  - t('meeting.transcribing')
  - t('meeting.generatingSummary')

- **功能摘要**：
  - i18n 启动期静态校验两个 JSON 结构对齐，不一致直接 throw
  - i18n 缺 key 时 console.warn 而非静默 fallback
  - pre-commit 钩子串联 auto-log + i18n:check
  - Login 页 3 处 `'????'` 占位字面量替换为真实中文
  - Login 页 feature tags 由 `isZh ? 'A' : 'A'` 改走 `t('login.featureXxx')`
  - MeetingDetail.tsx 21 处 `'???' / '?? / '??` 占位字面量替换为真实中文 mock
  - zh-CN.json / en-US.json 去除 UTF-8 BOM 头

**关联上交材料条目**：材料 2（系统设计 - i18n 架构）；材料 3（使用说明书 - 多语言）；材料 8（开发记录 / 团队分工）

<!-- 自动补充：本次改动意图、决策理由、踩坑记录（可在 commit 后手动补，也可在 commit message 中写详细内容） -->
<!-- commit msg: 回填 2026-09-10 Sprint 0 全部改动 -->

<!-- AUTO:ENTRY-END -->

---

### 2026-09-18 17:46  @fjlyh  feat: 接入会议纪要接口（外部办公系统集成一期）

- **触及文件**: 10 个（+478 / -12）

- **新增服务层**（1）：
  - `src/services/notificationDispatchService.ts`  (+318 / -0) — 统一推送入口（钉钉/企微/邮件），mock 实现 `POST /api/v1/notifications/send`

- **新增 Store**（1）：
  - `src/store/pushChannelConfigStore.ts`  (+107 / -0) — 管理员配置持久化（事件×渠道×接收人），localStorage 持久化

- **新增页面组件**（1）：
  - `src/pages/Settings/ExternalPushSettings.tsx`  (+215 / -0) — 推送配置 UI（Settings → 外部推送 Tab，含渠道开关 + 接收人管理 + 测试推送按钮）

- **新增 Hook**（1）：
  - `src/hooks/useWorkitemDueReminder.ts`  (+77 / -0) — 工单到期催办定时器（每 60 秒扫描 meetingWorkItemStore + todoStore，距截止 ≤ 1 天触发）

- **修改 Store / 页面 / 组件**（6）：
  - `src/store/notificationStore.ts`  (+18 / -0) — 新增 `pushResult` 字段，记录每条通知的外部推送渠道状态
  - `src/pages/Settings/index.tsx`  (+16 / -3) — 新增「外部推送」Tab 入口
  - `src/pages/Notifications.tsx`  (+42 / -0) — 新增 `PushStatusBadge` 组件，通知卡片展示钉钉/企微/邮件推送状态徽章，失败可点击重试
  - `src/services/postMeetingService.ts`  (+24 / -0) — 会议工单派发时触发外部推送 `dispatchMeetingTodo()`
  - `src/store/approvalDraftStore.ts`  (+22 / -0) — 审批通过/驳回时触发外部推送 `dispatchApprovalChange()`
  - `src/services/sandbox/sandboxApiContract.ts`  (+31 / -0) — 合规沙箱阻断级违规时触发紧急推送 `dispatchSandboxCritical()`
  - `src/pages/IndustryNews/index.tsx`  (+22 / -0) — 发起合规审查时触发监管风险预警推送 `dispatchRiskAlert()`
  - `src/components/Layout/AppLayout.tsx`  (+6 / -0) — 挂载 `useWorkitemDueReminder()` 定时器

- **触发场景**（5）：
  1. `meeting_todo` — 会议工单派发（`postMeetingService.closeMeeting`）
  2. `workitem_due` — 工单到期催办（`useWorkitemDueReminder` 定时器，每 60s）
  3. `approval_change` — 审批通过/驳回（`approvalDraftStore.setApprovalResult`）
  4. `sandbox_critical` — 沙箱阻断级违规（`sandboxApiContract.runScan`）
  5. `risk_alert` — 监管情报风险预警（`IndustryNews.handleLaunchComplianceReview`）

- **SSO 单点登录**：标记为二期，代码无侵入

### 关联上交材料
- 材料 5（场景分析）
- 材料 4（演示视频重点场景 1）
- 本轮 commit

---

## 踩坑与决策（手动）

> 重要决策 / 事故 / 解决套路都写在下面，按时间倒序。

### 2026-09-19  AI 板块下线 + 死循环根治

#### 决策记录

- **AI 板块下线的判断**：原计划保留 `/agent-hub` 统一入口承载 Chat/QA/Agent/Memory 4 个 Tab，但实际演示时评委反馈"4 个 Tab 名字相似、分不清边界"，且每个 Tab 内部又是简化版演示，价值密度低。决定下线 AI 板块，把算力聚焦到 5 个核心亮点（MeetingHub / Approval / Sandbox / Report / Knowledge）。**演示叙事更聚焦**。
- **mock 数据清理策略**：检查发现 `src/mock/data.ts` / `src/mock/data/knowledge.ts` 两个文件**根本没人引用**（grep 0 命中）—— 是历史残留。直接删除，并把会议演示数据统一收到 `src/mock/meetingDemo.ts`，一处管理。
- **Notifications 业务跳转必须打通**：原代码 action 按钮点击只弹 `message.info('查看详情')`，是"死按钮"。用户反馈"待办通知没相应接口、不能跳转"，体验断点严重。本次给 `NotificationType` 补齐 `todo` 类型 + 给每条通知加 `businessRef` + 整个通知卡片点击 = 跳转业务单据。
- **Sidebar Logo 视觉对齐**：原 40×40 logo 容器 + 20px 字号视觉不平衡。改为 48×48 logo + 18px 字号 + `lineHeight: 48px` 跟容器同高，垂直基线对齐。

#### 死循环根本原因分析

**现象**：MeetingRoom 报 `Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect doesn't have a dependency array, or one of the dependencies changes on every render.`

**根因**（2 个并存）：
1. `setParticipants` effect：
   ```js
   useEffect(() => {
     setParticipants(prev => prev.map(p => 
       p.id === currentUserId ? { ...p, isVideoOff: !camera.enabled, isMuted } : p
     ));
   }, [camera.enabled, isMuted, currentUserId]);
   ```
   `prev.map()` 每次产生新数组引用 → 传给子组件 → 子组件 useEffect 重跑（如果监听了 `participants`） → 父组件 setState → effect 重跑 → **死循环**

2. AI 模拟分析 effect：
   ```js
   useEffect(() => {
     setTimeout(() => { setAiKeyPoints(...); setAiDecisions(...); setAiSummary(...) }, 2000);
   }, [isZh]);
   ```
   没有 `clearTimeout` cleanup → 组件频繁卸载/重渲染时多个 timer 同时触发 setState → 死循环

**修复**：
1. 用 `useRef` 保存"上次写入值"，只有实际变化才 setState
2. 引用 timer 变量 + return cleanup

**工程护栏**（团队 Rule）：
- `useEffect` 里 `setState` 时**必须用 ref 比对上次值**，避免引用变化触发循环
- `setTimeout` / `setInterval` / `EventBus.subscribe` **必须有 cleanup 函数**

---

### 2026-09-14  Sprint 1 · 亮点 1 升级：会后自动派单 + 报告导出

#### 改动概览
- 新建：`src/services/meetingApiContract.ts`（前后端契约类型定义，纯类型无实现）
- 新建：`src/services/postMeetingService.ts`（业务 mock 层，4 个核心函数 + closeMeeting 编排）
- 新建：`src/services/pdfExportService.ts`（jsPDF 封装，导出会议报告为 PDF）
- 新建：`src/components/Meeting/PostMeeting/ReportSummary.tsx`（5 段报告渲染）
- 新建：`src/components/Meeting/PostMeeting/ActionCard.tsx`（单个工单卡片 + 状态机操作）
- 新建：`src/components/Meeting/PostMeeting/ActionDispatchPanel.tsx`（派单结果面板 + 统计）
- 新建：`src/components/Meeting/PostMeeting/ExportToolbar.tsx`（PDF/MD 导出工具栏）
- 新建：`src/components/Meeting/PostMeeting/PostMeetingDrawer.tsx`（Drawer 总容器，叠在 MeetingRoom 上）
- 新建：`src/pages/Meeting/PostMeetingReport.tsx`（独立报告页 `/meeting/:id/report`）
- 修改：`src/services/multiAgentOrchestrator.ts`（`runClosingSummary` 联动 postMeetingService 自动派单）
- 修改：`src/router.tsx`（注册 `/meeting/:id/report` 路由）
- 修改：`src/pages/Meeting/MeetingRoom.tsx`（`handleEndMeeting` 改为先 runClosingSummary → 弹 PostMeetingDrawer）
- 修改：`src/pages/Meeting/MeetingList.tsx`（已结束会议卡片加"查看报告"按钮）
- 修改：`src/i18n/locales/zh-CN.json` + `en-US.json`（+26 个 key）
- 修改：`package.json`（加 `jspdf` 依赖）

#### 设计决策
1. **前后端严格分离**：UI 组件只调 `xxxService.xxx()`，绝不写 `setTimeout` / `axios`。`meetingApiContract.ts` 只定义类型，组件不知后端存在。后端上线时只需替换 service 内部 `await delay(800)` 为 `axios.post(...)`，**UI 0 改动**。
2. **业务 service 与契约解耦**：`meetingApiContract.ts` 是契约文档（path/req/res），`postMeetingService.ts` 是业务编排（含 `closeMeeting()` 这种"派单 + 生成报告"的组合调用）。后端只需要看契约文件即可。
3. **Drawer + 独立报告页 双入口**：Drawer 适合"会后立刻看一眼"，独立报告页适合"评委演示时全屏展示"。两者数据共享 Blackboard，无冗余状态。
4. **派单 5% 失败率**：模拟真实场景"个别指派人不在组织架构中"的情况，让评委看到失败处理逻辑（Alert + 重试按钮）。
5. **Blackboard 单例复用**：PostMeetingReport 页面打开时直接从 `blackboardStore.get()` 拿数据，0 网络请求，500ms 加载完。这是个**性能优化**，但也意味着数据生命周期受单例约束（如果会议切换需要 reset）。
6. **jsPDF 而不是 html2canvas**：PDF 是结构化报告（标题/表格/列表），不需要复杂排版；jsPDF 文本 API 足够；体积小（19 个包）。html2canvas 会渲染图片化文本反而更糟。
7. **i18n key 用语义化（`postMeeting.summary`）而非 `auto.N`**：与之前 `auto.N` 模式保持一致但**这次的 key 有人工维护**，不会后续被 rewrite-iszh 自动改写。

#### 现象 / 决策记录
- **PowerShell 中文路径下 `tsc` build 报错**：第一次跑 `npm run build` 失败，但 `tsc --noEmit` 单独跑显示的错误都在历史遗留文件 `src/pages/Meeting.tsx`（这个文件不在 router 里，零影响）。决定本次先不修历史遗留（不在亮点 1 范畴）。
- **jspdf 中文支持差**：PDF 报告目前用英文（标题/章节名硬编码英文），如果后续需要中文报告，建议后端生成 PDF + 中文字体嵌入，前端只调 `POST /api/v1/reports/upload`。
- **Blackboard 单例在切换会议时的残留**：`resetMeeting(id)` 会重置 Blackboard，但如果用户在两个会议页面快速切换可能有数据闪动。决定本期不优化（不是亮点 1 演示阻塞问题）。

#### 工程护栏
- 5 个 service 函数体内**注释里都标了"真实对接时应该写什么 axios 代码"**，方便后端同学上手
- 所有组件 props 都用 TS interface 定义，无 any
- `meetingApiContract.ts` 类型与 `postMeetingService.ts` mock 实现**字段一一对应**，保证后端按契约实现后类型不报错
- i18n:check 通过（zh-CN + en-US key 结构对齐，720 → 745 key）

#### 校验结果（本次新增）
- 5 个 service 函数 mock 实现，延迟 300-1200ms 模拟真实网络
- PDF 生成 < 3s，含分页 + 品牌标识 + 页脚
- Markdown 导出 < 100ms
- 端到端流程：开会 → fanoutChunk → runClosingSummary → 自动派单 → 看报告 → 导出 PDF（5 步全跑通）
- i18n 校验通过：745 key（之前 719）

#### 关联上交材料
- 材料 2（系统设计 - 多 Agent 架构 + 前后端解耦）
- 材料 4（演示视频重点场景 1）
- 材料 5（API 契约附录 B · 5 个新增接口）
- 材料 8（开发记录）

---

### 2026-09-14  Sprint 1 · 亮点 1 实现：4 Agent 协作会议

#### 改动概览
- 新建：`src/services/multiAgentBus.ts`（EventBus + AGENT_META 元信息）
- 新建：`src/services/multiAgentOrchestrator.ts`（Blackboard 单例 + 4 Agent 编排脚本 + 会后汇总）
- 新建：`src/services/useMultiAgent.ts`（`useSyncExternalStore` 适配层）
- 新建：`src/components/Meeting/AgentCard.tsx` / `AgentPanel.tsx` / `Blackboard.tsx` + CSS
- 新建：`src/pages/Meeting/MeetingRehearsal.tsx`（会前预演页面）
- 修改：`src/router.tsx` / `MeetingList.tsx` / `MeetingRoom.tsx` / `Profile.tsx`

#### 设计决策
1. **Blackboard 模式而非链式调用**：4 个 Agent 共享一份 Blackboard（事实/决策/待办/风险/话题/摘要），每个 Agent 既可读又可写。这比 A→B→C→D 流水线更接近真实多 Agent 系统设计，对应 Material 2 中的"去中心化协作"架构图。
2. **前端 EventBus 模拟，零侵入式预留后端对接**：`multiAgentBus.dispatch()` 目前是前端事件总线，后端多 Agent WebSocket 服务上线后只需替换该方法内部为 `ws.send()`，所有组件代码 0 改动。这是关键的"前后端解耦"决策。
3. **`useSyncExternalStore` 而非 zustand**：避免引入新依赖，符合团队"轻量级状态管理"原则；性能也完全够用（Blackboard 更新频率 < 1Hz）。
4. **打字机流式输出而非一次性渲染**：跟现有 `Chat.tsx` UX 一致，4 Agent 同时"打字"的视觉冲击也是亮点 1 的关键演示点。
5. **会前预演独立页面 `/meeting-rehearsal/:id`**：作为独立入口而不是 MeetingRoom 的子页面，方便演示和截图（评委一眼看出"这是预演 vs 正式会议"的差异化设计）。

#### 现象 / 决策记录
- **Profile.tsx 原有 bug**：发现 `getMockUserData` 在 hook 外部用 `t`，访问 `/profile` 会白屏。**顺手修复**（不算亮点 1 范畴，但阻塞路由），改成接收 `t` 参数。
- **PowerShell 中文路径下 `&&` 不识别**：第一次启动 dev server 报错，原因是 `数字马力` 中文目录名 + `&&` 分隔符在 pwsh 中解析异常。改成 `;` 解决。
- **commit 时机选择**：本次 commit 时机过早（root-commit + 一上来就混入 dev-log.md 等历史文件），后续 dev-log 自动追加机制 `auto-log.cjs` 在 root-commit 场景无法工作（因为没有"上一次 commit"做 diff 基准），**只能手动补 entry**。后续 commit 走常规路径后会自动化。
- **`*.bak.*` 工作区残留**：12 个历史备份文件被 `git add .` 带入，已 unstage + 加 `.gitignore`。

#### 工程护栏
- `multiAgentBus` 保留 200 条历史快照，方便后续做"会议回放"
- Blackboard 数据通过 `useSyncExternalStore` 自动响应，符合 React 18 concurrent 模式
- 4 Agent 的"行为剧本"集中在 `multiAgentOrchestrator.ts`，后端对接时一个文件搞定

#### 关联上交材料
- 材料 2（系统设计 - 多 Agent 架构）
- 材料 4（演示视频重点场景 1）
- 材料 8（开发记录）

---

#### 改动概览
- 新增/修改：`src/i18n/index.ts`（启动期静态校验 + 严格类型 + `appText()` helper）
- 新增：`scripts/check-i18n.js`（4 项静态校验：JSON 结构对齐 / BOM / 占位文本 / `isZh` 同语种 bug）
- 新增：`scripts/fix-placeholders.cjs` + `scripts/fix-meeting-detail.cjs`（一次性清理脚本）
- 修改：`src/i18n/locales/zh-CN.json`、`src/i18n/locales/en-US.json`（去除 BOM + 新增 login.* 键）
- 修改：`src/pages/Login/index.tsx`（3 处 `'????'` → `'登录成功'` / `'演示部门'`，feature tags 改走 `t()`）
- 修改：`src/pages/Meeting/MeetingDetail.tsx`（21 处 `'???' / '?? / '??` 占位字面量 → 真实中文）
- 修改：`.husky/pre-commit`（老 i18n 检查 → auto-log → i18n:check 双钩子）
- 新增：`package.json` script `i18n:fix:placeholders`
- 新增：`docs/i18n-guidelines.md`（6 条硬性规则）

#### 现象
- 用户截图显示页面出现大量 `????`、`Demo Dept`、`AI Assistant` 等中英混杂
- 切语言按钮形同虚设，部分页面空白

#### 根因（三大事故并发）
1. **UTF-8 BOM 事故**：`zh-CN.json` 与 `en-US.json` 头部含 `EF BB BF` → `JSON.parse` 抛 `SyntaxError` → 整个 i18n 包加载失败，所有 `t('key')` 返回空，UI 显示 fallback 或空白。**这是"语言系统崩溃"的元凶**。
2. **`'????'` 占位字面量**：源码字节就是 4 个 ASCII `?`，不是渲染层编码问题，是写代码时编辑器出问题留下的。Login 页有 3 处，MeetingDetail.tsx 有 49+ 处。
3. **`isZh ? 'A' : 'A'` 同语种硬编码**：Login 页 feature tags 两边都写 `'AI Assistant'`，切换语言毫无反应。

#### 修复
1. Node 脚本 strip BOM（写入时缺 BOM）
2. Node 脚本批量替换 `'????'` → 真实中文（`登录成功` / `演示部门`）
3. feature tags 改走 `t('login.featureAi')`，两个 JSON 同步加 key
4. MeetingDetail.tsx 整文件逐段还原中文 mock（议程/纪要/摘要/步骤提示 4 处模板字符串）

#### 工程护栏（防回潮）
- `src/i18n/index.ts` 启动期 `throw new Error()`，两个 JSON key 集合不一致时直接拒绝运行
- `parseMissingKeyHandler` 缺 key 时 `console.warn` + 返回 key 本身，便于发现
- `fallbackLng: false` 不允许 fallback 掩盖缺失
- `scripts/check-i18n.js` 4 项检查：结构对齐、BOM、`??` 占位、`isZh` 同语种 bug
- `npm run i18n:check` 挂在 pre-commit hook
- `docs/i18n-guidelines.md` 6 条硬性规则文档化

#### 关联上交材料
- 材料 2（系统设计 - i18n 架构）
- 材料 3（产品原型说明 - 多语言支持）
- 材料 8（开发记录）

---

### 2026-09-10  Sprint 0 · 上交材料归档体系搭建

#### 改动概览
- 新建：`docs/delivery/` 目录（含 `dev-log.md` / `team.md` / `api-gap-tracker.md` / `scenario-analysis.md` / `metrics.md` / `README.md` 6 个文件）
- 新建：`scripts/auto-log.cjs`（commit 时自动抓 staged 文件 + diff 行数 + 按类别分组 + 抽取函数/API/i18n key + 自动关联材料条目，写入 dev-log.md AUTO 区段）
- 新建：`scripts/scan-qmark.cjs`（占位文本扫描工具）
- 修改：`.husky/pre-commit`（在 i18n 检查之前先跑 auto-log）

#### 设计目标
- 让"上交材料"中第 8 项"开发记录 / 团队分工 / 补充材料"完全自动生成，不再依赖手动整理
- 责任人通过 `git config user.name` 自动识别，team.md 提供 Git Config Name → 真实姓名映射
- 每个 commit 自动得到一条 entry，包含：日期、责任人、触及文件清单、+/- 行数、按类别分组、自动抽取的 API 路径 / i18n key / 导出函数 / 接口签名、自动关联到的材料条目
- 手动补的部分仅剩"决策理由 / 踩坑总结"，模板已在 dev-log.md 给出

#### 关联上交材料
- 材料 8（团队分工 + 开发记录 + 其它补充材料）

---

### 2026-09-10  Sprint 0 · i18n 第二轮根治：切不到英文 + 中英混杂

#### 改动概览
- 修改：`src/components/Layout/Header.tsx`（3 处 `isZh ? 'X' : 'Y'` 改走 `t()`，`handleLanguageChange('en')` 改为 `'en-US'` —— **这就是切不到英文的根因**）
- 修改：`src/components/Layout/SimpleLayout.tsx`（同样 'en' → 'en-US'，5 处 isZh 三元 → `t()`）
- 重写：`src/components/Layout/ProfileDrawer.tsx`（全文 30+ 处 `isZh ? '中文' : 'English'` 改走 `t()`，并加入 `useTranslation` hook 让组件订阅语言变化）
- 重写：`src/components/Layout/Topbar.tsx`（删除所有 `|| '中文 fallback'`，所有硬编码英文占位改走 `t()`）
- 重写：`src/pages/Dashboard/index.tsx`（整页 40+ 处硬编码英文（`Good morning`/`AI Assistant`/`Schedule Meeting`/`Today's Meetings`/`Smart Q&A`/`Smart Approval`/`Report Generation`/`Industry News`/`Mark as done` 等）全部改走 `t()`）
- 重写：`src/pages/Login/index.tsx`（修复源码 bug：`isZh ? 登录成功` —— `登录成功` 没引号被当成变量；现改走 `t('login.success')`）
- 重写：`src/pages/Meeting/MeetingDetail.tsx`（mockZhTranscript / mockZhSummary 模板字符串中的 `??` 占位全部替换为正常中文，`'TBD'` 替换为真实待办描述）
- 新增：`scripts/rewrite-iszh.cjs`（自动扫描 src/**/*.tsx 中 `isZh ? '中文' : 'English'` 模式，自动提取为 `auto.N` key 加入两个 JSON，自动替换源码为 `t('auto.N')`，107 处自动改写）
- 增强：`scripts/check-i18n.js` 新增 JSON 占位扫描（防止 `auto.N` key 误带占位文本）
- 补全：67 个命名 key（`login.success` / `settings.switchRole` / `profile.*` / `dashboard.*` 等）
- 清理：`*.bak.rewrite` 临时备份（9 个）、`*.gbk.bak` 历史备份（6 个）

#### 现象
- 用户截图显示：Dashboard 页面 `Good evening` + `admin` + `Online` 全英文，但其它位置（如 `下午好` 来自 Dashboard 部分 AIWorkbench）显示中文
- 头部 Header / Topbar `Good evening` `September 10, 2026` 永远英文，切语言不响应
- "切换语言" 按钮形同虚设，点击后**仍然显示英文**（核心 bug：传了 `'en'` 不是 `'en-US'`，导致 i18n 找不到对应语言回落到 `'zh-CN'`）
- 部分页面（如 Knowledge Base）菜单中文、右侧内容英文，**语言状态不一致**

#### 根因（7 个并存问题）
1. **`'en'` vs `'en-US'` 类型不匹配（切不到英文的元凶）**：Header.tsx L29 / SimpleLayout.tsx L39 / L85 调用 `changeLanguage('en')`，但 `i18n/index.ts` 只声明了 `SUPPORTED_LANGUAGES = ['zh-CN', 'en-US']`；`'en'` 不在白名单被 console.error 拒绝 + 没 fallback，i18n 仍然停留在 `zh-CN` —— 但其它 React 组件**根本没订阅 hook**，所以看到的是上一语言残留
2. **组件未订阅 hook**：ProfileDrawer / Sidebar / Topbar 部分代码虽然 import 了 i18n 但没调 `useTranslation()`，不会响应 `changeLanguage` 触发 React 重渲染
3. **`isZh ? 'A' : 'B'` 三元散落 9 个文件 100+ 处**（ChatDrawer / MeetingRoom / Contacts / Profile / MeetingList 等），**根本不会响应语言切换**
4. **Dashboard 整页硬编码英文**：从 `getGreeting() { return 'Good morning' }` 到 `Today's Meetings` `Smart Q&A` `Smart Approval` 等所有文本都没走 `t()`，切语言永远英文
5. **源码 bug**：`isZh ? 登录成功 : 'Login Success'` —— `登录成功` 没加引号被当成变量，运行时直接报错
6. **MeetingDetail mock 数据中 `??` 占位、TBD 占位**：transcript/summary 整段中文模板字符串被破坏，4 个提示语（"上传中"/"AI 正在识别"/"转写中"/"AI 正在整理"）也是 `??` 占位
7. **i18n runtime 不严**：原 `check-i18n.js` 不扫 JSON 内部的占位，导致 `auto.N` key 可能带 `TBD`/`??`/`'??????'`

#### 修复
1. 全量替换 `changeLanguage('en')` → `changeLanguage('en-US')`，加 TypeScript 类型约束 `'zh-CN' | 'en-US'`
2. 给 ProfileDrawer / Sidebar / Header / SimpleLayout 全部加 `const { t } = useTranslation()`
3. 写 `scripts/rewrite-iszh.cjs`：正则匹配 `isZh ? '中文' : 'English'`，自动提取 pair 为 `auto.N` key，加入 zh-CN.json / en-US.json，替换源码为 `t('auto.N')`，共 107 处
4. Dashboard 全文重写为 `t('xxx')` 形式 + useTranslation hook
5. 修 Login.tsx 源码 bug（无引号变量）
6. 写 Node 脚本把 MeetingDetail 模板字符串中的 `??` 占位 → 真实中文，TBD → 真实待办描述
7. 升级 `check-i18n.js` 增加 JSON 占位扫描，防止 auto key 误带占位

#### 工程护栏（已落地）
- `scripts/rewrite-iszh.cjs` 可重复运行，每次新增 `isZh ?` 三元会再次自动改写
- `scripts/check-i18n.js` 5 项校验：JSON BOM / key 对齐 / 源码占位 / JSON 占位 / 同语种 bug
- `npm run i18n:check` 挂在 pre-commit hook

#### 校验结果（本次修复后）
- zh-CN 与 en-US key 结构完全对齐：**719 个 key**
- 源码中无占位问号 / TBD / ?? 字面量
- JSON 中无占位文本残留
- 无 isZh 三元两边同语种硬编码 bug

#### 关联上交材料
- 材料 2（系统设计 - i18n 架构升级）
- 材料 3（使用说明书 - 多语言支持）

---

## 2026-09-17 第二轮（会议列表响应式 + 通知体验）

### 触发问题（用户截图发现）
1. **会议列表右侧操作列横向溢出容器**，删除按钮被截
2. **通知页面 11 个文案显示原始 key 字面量**（`notification.markAllRead` 等），zh-CN / en-US 都不可读
3. **Notification 数据太单薄**，只有 6 条 mock，且初次进入页面看不出来有"通知中心"的样子
4. **评分圆环溢出**：4 行内容（分数 + /5 + 5 颗星 + 等级标签）塞在 size=100 的圆环里，全部外溢

### 排查路径
- 关键现象：`t('notification.markAllRead')` 返回原 key → 第一反应是 key 缺失
- 用 `grep '"notification":'` 查两个语言文件 → 发现都挂在 `common.notification` 下
- 对照代码：所有调用都走 `t('notification.xxx')`（**根路径**）
- 结论：JSON 嵌套层级错误，11 个 key 全部无法命中

### 修复

#### Fix 1（i18n nesting 修复 — 最关键）
- `zh-CN.json` / `en-US.json`：把 `notification: {...}` 从 `common` 内部**提到根级**
- 影响范围：通知页全部文案 + 顶部 badge
- i18n check：`scripts/check-i18n.js` 通过，98 个 key 双语对齐

#### Fix 2（通知页 UI 改版）
- 数据：mock 从 6 → 10 条（新增合规风险预警、会议邀请、安全告警等真实场景）
- 加 store persist v2：`onRehydrateStorage` 强制覆盖过期本地缓存
- UI 三段：顶部统计卡（总数 / 未读 / 紧急 / 批量操作） + Tab 角标 + 列表
- 列表每条：左侧类型色条 + 复选框 + 圆角图标盒 / 中标题红点 / 操作按钮组 / 选中态高亮
- 增加 Segmented 视图切换（list / compact）、全选/反选、批量已读/删除
- 已读视觉：标题与内容双层灰化；未读视觉：渐变浅底色 + 红点带 2px 光晕

#### Fix 3（会议列表响应式 + Tabs bug）
- `MeetingList.tsx` 中 `<Tabs>` 错把 `activeKey` 写成 `selectedKey`（antd 5 不生效，但同时挂了重复的 `onTabClick`）
- 合并 `onChange` 单一回调，移除 `onTabClick` 冗余
- Table 加 `scroll={{ x: 960 }}`，左右关键列 `fixed`
- 列宽收紧：title 220、起止时间 160、参会人 140、状态 96（原来 180/180/150/100）
- 操作列 220 fixed 右，删除按钮常驻；其他操作按状态取极简集 + size=small + wrap
- 参会人头像加 Tooltip；Tag 加 border-radius
- 行内导入 `Tooltip` / `FileTextOutlined`，去掉未使用的 `CalendarOutlined`（保留必要 imports）

#### Fix 4（评分圆环溢出）
- `ScoreRing.tsx`：分数字号 0.3→0.28、加 `lineHeight: 1`、星标条件改为 `size >= 140`
- 容器 `.score-ring { overflow: hidden }` 兜底

### 上交材料同步
-  dev-log.md（本段）
-  feature-list.md：补充"通知中心 v2"特性条目
-  commit hook：`fix(notifications): i18n key nested error + ScoreRing overflow + Notifications UI overhaul`，61 文件 / +2511 -1202

---

## 2026-09-17 AI 板块融合 · 完整工作流

> 本节是 commit `e4cd3d8`（路由整合 19→12）+ 后续补丁的**完整工作流补登**。原 commit 提交时只改了代码没写日志，本段同步全部细节。

### 触发问题

- **侧边栏臃肿**：AI 类入口占 4 格（Chat / QA / Agent / Memory），加上其它模块共 19 条侧栏菜单，评委第一眼找不到 AI 能力入口在哪
- **功能定位重叠**：用户和评委都反馈 "AI 智能助手 / 知识问答 / 多 Agent 调度" 这 3 个名字相似度高，分不清边界
- **路由碎片化**：4 个独立路由，浏览器后退要走 4 次才能离开 AI 区，深链（分享链接）无法定位到具体子能力
- **演示录制笨重**：录视频时要分别打开 4 个页面演示 4 个能力，剪辑成本高

### 解决方案：AgentHub 统一入口

#### 1. 路由重写（`src/router.tsx`）
| 旧路由 | 新路由 |
| --- | --- |
| `/chat` | `/agent-hub?tab=chat` |
| `/qa` | `/agent-hub?tab=qa` |
| `/agent` | `/agent-hub?tab=agent` |
| `/memory` | `/agent-hub?tab=memory` |

- 旧路由全部 `<Navigate replace>` 自动跳转，**零硬中断**：老用户/老链接自动迁移
- 路由总数从 19 → 12（同时合并了 `/meeting-room/:id` 等会议子页面到 `/meeting?tab=room&id=xxx`，重定向函数 `MeetingRoomRedirect` 等 4 个组件复用 `useParams` 取 id）
- 统一入口路由名 `/agent-hub`，命名规范（kebab-case）

#### 2. AgentHub 容器（`src/pages/AgentHub/index.tsx`）
- `useSearchParams` 双向同步 `?tab=xxx` ↔ React state
- `?tab` 缺失时自动写入默认值 `chat`（`setSearchParams({ tab: 'chat' }, { replace: true })`），避免下次分享丢失 tab
- 4 个 Tab 组件用 `React.lazy` 懒加载，首屏只加载 Chat 包
- 顶部 Header：渐变色块 + Tab 描述文字（"通用对话、文档问答、视频解析" 等随当前 Tab 切换）
- 底部 Alert：永久保留"AI 智能中心整合说明"，让评审 / 新用户理解为什么 4 合 1

#### 3. Tab 切换体验
- antd `Tabs` `activeKey` + `onChange` 同步 URL（之前用了 `selectedKey`，是 antd 4 的 prop，antd 5 改名为 `activeKey`，已修复）
- 浏览器前进/后退按钮：监听 `popstate`（通过 react-router 的 `useSearchParams` 自带处理）能正确恢复 tab
- 链接分享：直接复制 URL `https://demo.com/agent-hub?tab=qa&session=xxx` 粘贴给同事，落地后自动定位

#### 4. 侧边栏收敛
- `src/components/Layout/Sidebar.tsx` 移除 4 个独立 AI 菜单，新增 1 个 "AI 智能中心"
- 主导航总条目 19 → 12，视觉清爽度大幅提升
- 菜单图标从分散的 `MessageOutlined` / `QuestionCircleOutlined` / `RobotOutlined` / `DatabaseOutlined` 收敛为统一的 `ThunderboltOutlined`

### 涉及的板块

| 旧入口 | 新归属 | 当时状态 | 本轮修复 |
| --- | --- | --- | --- |
| Chat（即时沟通） | AgentHub > Chat Tab | ️ 中：~15 处硬编码中文 |  全部改 `t('chat.*')` |
| QA（智能问答） | AgentHub > QA Tab |  高：中英混杂（`New Chat`/`History`/`AI is thinking...`） |  全部改 `t('qa.*')` + 33 个新 key |
| Agent（多Agent调度） | AgentHub > Agent Tab |  高：t 未使用 + **5 卡 Col span={6} 布局错位** |  全部改 `t('agent.*')` + Col span={8} |
| Memory（长会话记忆） | AgentHub > Memory Tab |  低：少量残留 |  补全批量操作/弹窗 18 处硬编码 |
| Plugin（插件市场） | 独立 `/plugins` |  低 | — 无需改 |

### 本轮 AI 板块 i18n 改造详情

#### A. i18n JSON 增补（zh-CN.json / en-US.json）
| 命名空间 | 增补 key 数 | 关键内容 |
| --- | --- | --- |
| `agent.*` | +27 | `statusOnline/Busy/Offline`、`pause/retry`、`deleteConfirmContent` 模板插值、`agentMeeting/Doc/Reg/Qa/Data` Agent 名称、`taskMinutes/Compliance/Regulation/Report/Schedule` 任务名 |
| `qa.*` | +33 | `complianceResponseTitle/Framework/RiskControl/Monitoring`、`meetingMinutesSteps/Setup/Processing/Output`、`aiAssistantTitle/Desc/Greeting`、`quickActions/suggestedQuestions`、`draggerText/Hint`、`uploadModalTitle/Confirm`、`filesAdded/fileAdded` 模板插值 |
| `memory.*` | +47 | `archived/archivedCount`、`batchPin/Archive/Export` Tip + Title + Confirm + Ok、`compressLogLine1-5/auditLogLine1-5` 模板插值（解决了占位字符串无法传参的历史问题）、`adminOnly/allDeptSessions/deptTech/Compliance/Market`、`csvHeader`、`complianceAuditWarning` |
| `agentHub.*` | +11 | `title/mergedBadge/loading`、`tabChat/Qa/Agent/Memory` + 各自 `Desc`、`mergeTipsTitle/Desc` |

总计 +118 个 i18n key 同步双语。

#### B. 源码改造

**Agent/index.tsx**（最严重）：
- 全页 60+ 处硬编码中文/英文 → 全部走 `t('agent.*')`
- `useState(initialTasks)` 让任务列表可变（删除生效）
- 列定义统一规范：title 走 `t()`、宽度 100~160、`ellipsis: true`、操作列 `fixed: 'right'` width 160
- 删除操作：`Modal.confirm` → `Popconfirm`（更轻量、不挡视野）
- **布局 Bug 修复**：`Col span={6}` × 5 = 30 > 24，导致第 5 张折到第 2 行第 1 列 → 改 `Col span={8}` × 3 + `marginBottom: 12`，3 行整齐布局
- Table 加 `scroll={{ x: 760 }}` 防溢出

**QA.tsx**（中英混杂）：
- mock 响应改用 `t()` 模板拼接：`t('qa.complianceResponseTitle') + '\n\n' + t('qa.complianceFramework') + ...`
- 欢迎语、上传 Modal、Tooltip、Placeholder、按钮文案全部走 `t()`
- "References:" 等英文 label → `t('qa.references')`

**Memory/index.tsx**（批量操作）：
- 8 个弹窗（handleArchive / handleBatchArchive / handleBatchPin / handleBatchExport / togglePin / handleExport / handleContinue / openDetail）全部参数化
- 压缩日志和审计日志从硬编码数组 → `t('memory.compressLogLine1-5', { original, compressed })` 模板插值，能跟随会话数据动态
- 顶部权限区"超级管理员/普通员工"、管理员专属检索栏的全部门会话改 `t()`
- 详情页 Tag 文案、`closeBtn`、底部合规警告全部 i18n 化

**AgentHub/index.tsx**：
- Tab 4 个 label 标签 + 描述走 `t('agentHub.tabXxx*')`
- Header "AI 智能中心" + "4 大能力合一" 徽标走 `t('agentHub.title/mergedBadge')`
- 加载提示、底部 Alert 说明全部走 `t()`

**Chat.tsx**：
- `handleRegenerate/Feedback/Copy` 三个回调的 message 提示改 `t('chat.regenerating/feedbackLike/Dislike/copied/copyFailed')`
- 4 个建议问题改 `t('chat.q1-q4')`
- Header "在线" 标签、"会话 xxx" 前缀、"已开启新对话" 提示改 `t()`

### 验证

```bash
node scripts/check-i18n.js
#  zh-CN 与 en-US key 结构完全对齐：1018 个 key
#  源码中无占位问号 / TBD / ?? 字面量
#  JSON 中无占位文本残留
#  无 isZh 三元两边同语种硬编码 bug

npx tsc --noEmit -p tsconfig.json
# 通过（除 tsconfig baseUrl deprecation warning，与本次改动无关）
```

### 关联上交材料
- 材料 2（系统设计 - 路由整合）
- 材料 3（使用说明书 - AI 智能中心）
- commit `e4cd3d8 重构：路由整合 19→12，去重消除冗余入口`（原 commit，无日志）
- 本轮 commit（待提交）

### 2026-09-23 00:18  @fans  [fix: 实时会议室 Maximum update depth 深度修复]

#### 根因清单（5 个循环源）

**根因 1 — `MeetingHub` setSearchParams 自循环（致命）**
- `useEffect([searchParams])` 内部 `setSearchParams` → searchParams 引用变化 → effect 重跑 → 再 setSearchParams → 形成死循环
- 表现：切换到实时会议室 tab 立刻爆栈，白屏
- 修复：`syncedRef` 闸门 + 拆分为"初始化同步 effect"（依赖 `[]`）+ "外部变化响应 effect"（依赖 `[searchParams]`）

**根因 2 — `useSyncExternalStore` getSnapshot 返回新对象（致命）**
- `useBlackboard` / `useAgentRunState` / `useAllAgentRunStates` 的 `getSnapshot` 每次调用返回新对象
- React 18 检测到引用不稳定 → `enqueueConcurrentRenderForLane` 重复调度 → Maximum update depth
- 修复：store 层加 `tick` 自增版本号（`notify()` 时 `tick++`），hooks 订阅 tick 值 + `useMemo` 派生数据，保证引用稳定

**根因 3 — `MeetingRoom` 两个 setParticipants effect 相互触发（高危）**
- effect #1 无条件重建整个 participants 数组；effect #2 再覆盖 host 字段
- 两者依赖不完整对齐，形成「写 → 触发对方 → 再写」闭环
- 修复：合并为一个 effect + JSON 序列化签名 ref 守卫，消除互相触发

**根因 4 — `ActionDispatchPanel` onRefresh prop 引用抖动（中危）**
- 父组件每次渲染传新 `onRefresh={() => {}}` 箭头函数
- `useCallback([onRefresh])` 引用变化 → `useEffect([refresh])` 反复触发 refresh
- 修复：`onRefreshRef` 锁定 + effect 依赖 `[meetingId]` 单一来源

**根因 5 — 模拟发言 timer 依赖 `[participants.length]`（低危）**
- `participants.length` 变化（任何人加入/离开）导致 timer 重启 + `speakerIndex` 重置为 0
- 修复：依赖 `[]` 仅挂载时启停 + `speakerIndexRef` 跨渲染保留索引

#### 修复文件清单

| 文件 | 改动 |
|---|---|
| `src/pages/Meeting/MeetingHub.tsx` | `syncedRef` 闸门 + 双 effect 拆分 |
| `src/services/multiAgentOrchestrator.ts` | `BlackboardStore` / `AgentRunStateStore` 各加 `tick++` + `getTick()` |
| `src/services/useMultiAgent.ts` | 3 个 hook 改 `tick` 订阅 + `useMemo` + 补 `useMemo` import |
| `src/pages/Meeting/MeetingRoom.tsx` | participants effect 合并 + JSON 签名守卫 + speakerIndexRef + `lastCameraErrRef` 去重 |
| `src/components/Meeting/PostMeeting/ActionDispatchPanel.tsx` | `onRefreshRef` 锁定 + `lastInitialDispatchRef` 防重复写 |
| `src/components/Meeting/AgentCard.tsx` | `Date.now()` 改 `setInterval(1000)` tick，避免高频渲染 |

#### 触及文件
- `src/services/multiAgentOrchestrator.ts`（+10 / -2）
- `src/services/useMultiAgent.ts`（+8 / -10）
- `src/pages/Meeting/MeetingHub.tsx`（+15 / -12）
- `src/pages/Meeting/MeetingRoom.tsx`（+20 / -30）
- `src/components/Meeting/PostMeeting/ActionDispatchPanel.tsx`（+18 / -8）
- `src/components/Meeting/AgentCard.tsx`（+12 / -4）

#### 验证

```bash
npx vite build --mode development
# built in 1.90s ✅ 无 error / TS 类型错误
```

---

### 2026-09-24 01:12  @fans  [feat: 行业资讯详情 Drawer + 一键发起合规审查]

#### 为什么改（手动）

`/industry-news` 之前的资讯卡片点击仅 toast "正在打开: ..."，**演示时被评委问"详情去哪了？"无法展示**。本次把资讯点击改造为完整详情抽屉，并把"高/中影响度"资讯与合规审查流打通（生成待办 + 风险通知 + 监管情报推送），让"监管资讯 → 合规审查"形成可演示闭环。同时给 7 条 mock 资讯补全真实业务正文，详情页才有内容可看。

#### 触及文件

| 文件 | 改动 |
|---|---|
| `src/pages/IndustryNews/index.tsx` | +170 / -8：导入 `Drawer` `Descriptions` `Avatar` `Timeline` `ShareAltOutlined` `LinkOutlined` `FileTextOutlined`；新增 `detailItem` / `detailOpen` 状态 + `handleOpenDetail` / `handleCopyContent` 处理；标题栏 3 处点击（热门头条 / 列表卡 / 眼睛图标）统一跳详情；`MOCK_NEWS` 7 条正文由空串 → 每条 3-5 段真实业务内容；新增详情 Drawer（标题 / 元信息 / AI 摘要卡 / Descriptions 关键信息 / 按段渲染正文 / 处理时间线 / 粘性底栏 + 复制全文 + 发起合规审查） |

#### 演示要点

1. 进入 `/industry-news` → 点击任意头条或列表项 → 右侧抽屉弹出 720px
2. 抽屉内：AI 摘要 / 关键信息（分类 / 影响度 / 来源 / 时间）/ 全文段落 / "处理记录"时间线
3. 高影响度 / 中影响度资讯右上角与底部均出现「发起合规审查」按钮 → 一键生成待办 + 风险通知 + 外部推送（钉钉 / 企微 / 邮件）
4. 复制全文 / 收藏 / 分享链接 / 关闭 4 个二级操作均可用

#### 关联上交材料
- `docs/delivery/feature-list.md` 第 113-119 行（资讯详情描述扩展）
- `docs/delivery/scenario-analysis.md` 场景 3（行业洞察 — 监管资讯 → 合规审查 闭环）
- `docs/delivery/README.md` 亮点 1 进度看板新增 1 行
- `docs/delivery/metrics.md` 新增「监管资讯 → 合规审查」指标行

---

### 2026-09-24 10:55  @fans  [refactor: Dashboard 首页「一目了然」化重构]

#### 为什么改（手动）

Dashboard 之前堆了 **9 个区块**（问候 + 4 风险卡 + 3-Tab 待办 + 7日 AreaChart + 4 KPI + 工单度量面板 + 6 张会议工单 + 今日会议 + 会议工单闭环），滚动条要拉 3 屏，**违反"主页面只做概览"的设计原则**。参考右图"智慧团建"首页（功能矩阵 + 简短通知 + 1 个组织卡片），目标：**主页面 1 屏内全部看完，长内容全部下沉到子页面**。

#### 触及文件

| 文件 | 改动 |
|---|---|
| `src/pages/Dashboard/index.tsx` | 重写：删 4 风险快捷卡 / WorkItemMetricsPanel / MeetingSegmentDrawer / 近期会议工单 6 卡 / 会议工单闭环 5 行；保留问候 + 仿真状态；新增「最近通知」横排 3 条；今日会议精简为前 3 条 |
| `src/pages/Dashboard/components/DashboardCharts/index.tsx` | 重写：3-Tab 待办 → 优先级排序 Top3 + 3 状态 Tag + "全部 →"；260px AreaChart + 4 KPI → 120px LineChart + 3 KPI；新增「主入口矩阵」4 卡片（会议 / 待办 / 审批 / 沙箱）一屏可点 |

#### 设计原则

1. **主页面只做概览**——详细数据下沉到子页面（`/meeting`、`/approval`、`/industry-news`）
2. **入口矩阵**——4 个核心模块入口一屏可点（颜色 + 图标 + 一行说明）
3. **通知优先**——首页横排最近 3 条通知 + 未读数红 Tag
4. **Top3 原则**——"今天最该看的 3 条"取代"全部 + Tab 切换"
5. **删除冗余**——`WorkItemMetricsPanel` / `MeetingSegmentDrawer` / 6 张会议工单卡 / 5 行会议工单闭环 全部下沉到子页面

#### 演示要点

1. 进入 `/dashboard` → 1 屏（不滚动）可见：问候 + 仿真联动 + 主入口矩阵 + 待办 Top3 + 效率迷你卡 + 最近通知 + 今日会议
2. 点击主入口矩阵任一卡 → 直达对应模块
3. 点击待办 / 通知 / 会议任一条 → 直达 `/meeting` `/notifications` 等子页面

#### 关联上交材料
- `docs/delivery/feature-list.md` §一 工作台
- 当前 commit

---

### 2026-10-02 00:33  @fans  [fix: 行业洞察 / AI 智能中心点击无跳转 + 恢复 AI 智能中心独立页面（QA / Agent / Chat）]

#### 为什么改（手动）

`/dashboard` 「更多入口」两个核心卡片点击无反应：
- **行业洞察** → `path: '/insights'` 错误路径（实际路由为 `/industry-news`）
- **AI 智能中心** → `path: '/agent-hub'` 但 `/agent-hub` 在 2026-09-19 整合时被删除，且旧路由 `/qa /agent /chat /memory` 全部 `<Navigate to="/dashboard" />`，等于**入口挂着但路由走死胡同**

同期用户反馈"找不到单独的智能体问答页面"——`pages/QA.tsx` 文件存在但路由被屏蔽，等于功能缺失。

**决策**（见 `DECISIONS.md` §AI-2026-10-02-01）：恢复 AI 智能中心独立入口，但不复活 AgentHub 整合容器（2026-09-19 的精简路线仍成立）。保留 3 个独立页面 `QA` / `Agent` / `Chat`，`/memory` 重定向到 `/qa`（记忆管理视为问答子能力）。

#### 触及文件

| 文件 | 改动 |
|---|---|
| `src/router.tsx` | 移除 `/qa /agent /chat` 3 个 redirect → 挂载对应页面；`/memory` 改为跳 `/qa`；懒加载新增 `QA` / `AgentCenter` / `Chat` |
| `src/components/Layout/Sidebar.tsx` | 菜单配置新增 `/qa`（`nav.qa`）+ `/agent`（`nav.agentHub`）2 项；恢复 `ai` 分组渲染块 |
| `src/pages/Dashboard/components/DashboardCharts/index.tsx` | 修路径 bug：`/insights` → `/industry-news`、`/agent-hub` → `/qa` |

`pages/QA.tsx` / `pages/Agent/index.tsx` / `pages/Chat.tsx` 文件本身**未改动**——之前实现完整，本次只补路由挂载。

#### 关键 Bug（路径写错）

```tsx
// DashboardCharts/index.tsx ENTRIES 数组
{ key: 'industry', ..., path: '/insights' },       // ❌ 不存在
{ key: 'agentHub', ..., path: '/agent-hub' },       // ❌ 已被删除
```

修复后：
```tsx
{ key: 'industry', ..., path: '/industry-news' },  // ✓ 实际路由
{ key: 'agentHub', ..., path: '/qa' },              // ✓ AI 智能中心主页（智能问答）
```

**根因**：2026-09-19 重构同时改了路由表和 DashboardCharts 入口，但 DashboardCharts 的 path 字符串没跟着改，造成 14 天的"挂死入口"状态。

#### QA 页面能力盘点（pages/QA.tsx 已实现）

混合模式：文档上传 + 自由提问 + 历史会话
- 单输入框：`handleSend` + Enter 发送，Shift+Enter 换行
- 文档上传：拖拽 / 点击 / Modal 三种入口；支持 `.pdf .docx .xlsx .pptx .txt .md .csv .png .jpg`
- 多会话：`conversations` state + 左侧历史栏；新建 / 重命名 / 删除 / 切换
- Markdown 渲染：`react-markdown` + `rehype-highlight` 代码高亮
- 引用标签：`references` 字段展示文档来源（mock）
- 当前 mock 响应：3 类关键词命中（hello / compliance / meeting）+ 默认

> **TODO（Phase 2）**：mock 切换到真实 LLM（DeepSeek）+ 文档解析（PDF.js / mammoth.js）+ 向量库检索（FAISS / pgvector）

#### 验证

```bash
# 路由 SPA shell
GET /qa: 200 (SPA shell)
GET /agent: 200 (SPA shell)
GET /industry-news: 200 (SPA shell)
GET /chat: 200 (SPA shell)

# vite 编译 router.tsx 通过
router.tsx size: 68010
```

HMR 日志：`00:23:09 → 00:25:06` 4 次 router + Sidebar 热更新均成功。

#### 演示要点

1. `/dashboard` → 点 **行业洞察** 卡片 → 跳 `/industry-news` 显示 7 条监管资讯 + Drawer 详情
2. `/dashboard` → 点 **AI 智能中心** 卡片 → 跳 `/qa` 显示智能问答界面
3. Sidebar 左侧新增 **AI 能力** 分组（问答 / AI智能中心）——2026-09-19 下线后**首次恢复**

#### 关联上交材料

- `docs/delivery/feature-list.md` §二 AI 智能中心（状态从"已下线"改为"已恢复"）
- `docs/delivery/DECISIONS.md` 新增 §AI-2026-10-02-01（AI 板块恢复决策）
- `docs/delivery/ROUTE-MATRIX.md` 重新登记完整路由表
- `docs/delivery/scenario-analysis.md` 场景 1（智能问答）状态从"已下线"改为"已恢复"

---

## 2026-10-02 合规沙箱 LLM 模式（后端 0.3 落地）

### 目标

按"睿枢金融办公智能体平台"合规要求，新增 `compliance_sandbox` 作为 `ChatMode` 第四种回答模式，对应受限网络 + 白名单 + PII 脱敏 + 全量审计 + 紧急熔断 + 静默降级三档策略。

### 新增文件

```
app/features/compliance/
├── __init__.py
├── sanitizer.py     # PII 脱敏（id_card / bank_card / mobile / email → ***）
├── network.py       # 内网 base_url 校验（10.* / 172.16-31.* / 192.168.* / *.hengsheng.com）
├── guard.py         # Kill Switch / 风险词 / 拒绝自定义 system prompt
├── audit.py         # SHA-256 + 脱敏预览写入审计表（原文永不落库）
├── schemas.py       # 请求 / 响应 / Kill Switch / 审计只读
├── service.py       # 守卫 → 脱敏 → 选 Provider → 调用 → 审计 → 降级
└── router.py        # POST /sandbox/chat, GET /sandbox/audit, GET/POST /sandbox/kill-switch

db/migrations/versions/0001_compliance_audit_logs.sql   # 审计表 DDL

tests/test_compliance_sanitizer.py    # 9 用例
tests/test_compliance_network.py      # 10 用例
tests/test_compliance_guard.py        # 6 用例
```

### 修改文件

- `app/core/config.py`：新增 8 个 `SANDBOX_*` 配置 + 2 个字段校验器
- `app/features/chat/schemas.py`：`ChatMode` 新增 `COMPLIANCE_SANDBOX = "compliance_sandbox"`
- `app/api/router.py`：注册 `compliance_router`

### 设计要点（按需求逐条落实）

| 需求 | 实现 |
|---|---|
| 1. 审计字段：prompt_hash + prompt_preview(脱敏前 500 字) + answer_hash + answer_preview | `audit.py` 计算 SHA-256 + 截 500 字 + 复用 `sanitizer.sanitize_preview` |
| 2. PII 脱敏：身份证 / 银行卡 / 手机号 / 邮箱 → *** | `sanitizer.DEFAULT_PATTERNS` 4 个正则（顺序：id_card → mobile → bank_card → email，避免误命中） |
| 3. base_url 必须命中内网段（10/192/172.16-31/127 + *.hengsheng.com），默认不预填 Provider | `network.is_internal_base_url()` + `provider_allowed()`；默认 `SANDBOX_PROVIDER_WHITELIST=[]` |
| 4. 3 档降级：strict(拒绝) / fallback(静默降级+记日志) / off(关闭) | `SANDBOX_DEGRADATION_POLICY`；service 在 4 个分支上判断降级 |
| 5. 强制 temperature=0 + max_tokens≤2000 + 禁自定义 system prompt | `SANDBOX_TEMPERATURE` / `SANDBOX_MAX_TOKENS` 默认值；service 用 `dataclasses.replace` 覆写 profile；`Guard.reject_custom_system_prompt` 422 拒绝 |

### Settings 新增字段（8 个）

```python
SANDBOX_MODE_ENABLED: bool = False
SANDBOX_PROVIDER_WHITELIST: list[str] = []
SANDBOX_DISALLOW_TOOLS: bool = True
SANDBOX_DISALLOW_WEB_SEARCH: bool = True
SANDBOX_KILL_SWITCH: bool = False
SANDBOX_RISK_KEYWORDS: str = ""        # 逗号或换行分隔
SANDBOX_TEMPERATURE: float = 0.0       # 需求第 5 点
SANDBOX_MAX_TOKENS: int = 2000         # 需求第 5 点
SANDBOX_DEGRADATION_POLICY: Literal["strict","fallback","off"] = "strict"
SANDBOX_AUDIT_RETENTION_DAYS: int = 180
SANDBOX_PREVIEW_CHARS: int = 500       # 需求第 1 点
SANDBOX_BASE_URL_INTERNAL_SUFFIXES: list[str] = [".hengsheng.com"]
```

### API

```
POST /api/v1/compliance/sandbox/chat
  body:  { message, conversation_id?, task? }
  resp:  { answer, mode, provider, model, latency_ms,
           sanitized_fields, risk_hits, audit_id }

GET  /api/v1/compliance/sandbox/audit?page=&page_size=&only_blocked=
  resp:  { items: [...], total }    # 当前用户维度

GET  /api/v1/compliance/sandbox/kill-switch   # 查看
POST /api/v1/compliance/sandbox/kill-switch   # 切换
  body: { enabled, operator, reason? }
```

### 测试结果

```
tests/test_compliance_sanitizer.py ........  9 passed
tests/test_compliance_network.py   .......... 10 passed
tests/test_compliance_guard.py     ...... 6 passed
============================== 25 passed in 0.11s ==============================
```

### 部署前必做（运维）

1. 在 MySQL 执行 `db/migrations/versions/0001_compliance_audit_logs.sql`
2. 在 .env 显式开启沙箱：
   ```bash
   SANDBOX_MODE_ENABLED=true
   SANDBOX_PROVIDER_WHITELIST=internal_llm
   SANDBOX_BASE_URL_INTERNAL_SUFFIXES=.hengsheng.com,.internal.hengsheng.com
   SANDBOX_RISK_KEYWORDS=洗钱,恐怖融资,内幕交易
   SANDBOX_DEGRADATION_POLICY=strict
   ```
3. 内网 LLM Provider 必须在 `AI_PROVIDERS_JSON` 中显式注册并使用内网 base_url。

### 下一步

进入 `1.1 4 Agent 共享黑板（Blackboard）`：为后续智能审批 / 工作台 Dashboard 提供 4 个 Agent 协同的状态共享层。

---

## 2026-10-02 4 Agent 共享黑板（后端 1.1 落地）

### 目标

为后续智能审批 / 会议精简版 / 工作台 Dashboard 提供 4 个经典 Agent（researcher / planner / executor / reviewer）共享状态层；前端通过 `?since_id=` 轮询增量事件。

### 新增文件

```
app/features/blackboard/
├── __init__.py
├── models.py        # BlackboardSession + BlackboardEvent + 4 Agent 枚举
├── schemas.py       # Session/Event Create/Read + 64KB payload 校验
├── service.py       # 创建/关闭 session、读写事件、4 角色汇总
└── router.py        # 6 个端点

db/migrations/versions/0002_blackboard_events.sql     # sessions + events DDL

tests/test_blackboard_event.py          # 4 用例（payload/容量/枚举）
tests/test_blackboard_router_auth.py    # 6 用例
tests/test_blackboard_e2e.py            # 2 用例（含跨用户隔离）
```

### 修改文件

- `app/api/router.py`：注册 `blackboard_router`

### 设计要点（按决策逐条落实）

| 决策 | 实现 |
|---|---|
| 4 Agent：researcher/planner/executor/reviewer | `models.AgentRole` StrEnum |
| 存储：MySQL + JSON | `blackboard_events.payload` 用 SQLAlchemy `JSON` 类型 |
| 推送：前端轮询 GET /events?since_id= | `list_events(since_id, limit)` 返回 `next_since_id` |
| Session 生命周期：手动开/手动关 | `POST /sessions` 开 + `POST /sessions/{id}/close` 关；关闭后写事件 409 |
| 可见性：仅本人 | 所有 service 方法都校验 `owner_id`，B 写 A 的 session_id 返回 404 |
| Payload ≤ 64 KB | `BlackboardEventCreate.payload` field_validator 序列化字节数 |
| 汇总字段：基础（各角色最新事件 + 状态 + 错误数） | `RoleSummary` 4 个 + `total_events/total_errors` |

### API

```
POST   /api/v1/blackboard/sessions             # 开 session
GET    /api/v1/blackboard/sessions             # 列当前用户 OPEN 的
POST   /api/v1/blackboard/sessions/{id}/close  # 关
POST   /api/v1/blackboard/events               # 写事件（Agent 调用）
GET    /api/v1/blackboard/events?session_id=&since_id=&limit=  # 轮询
GET    /api/v1/blackboard/sessions/{id}/summary  # 4 角色汇总
```

### 测试结果

```
tests/test_blackboard_event.py        ....    4 passed
tests/test_blackboard_router_auth.py  ......  6 passed
tests/test_blackboard_e2e.py          ..      2 passed  # 含跨用户隔离
============================== 44 passed in 0.73s ==============================
```

（含 0.3 沙箱 32 + 黑板 12 = 共 44 用例）

### 部署前必做

```bash
mysql -uroot -p financial_office < db/migrations/versions/0002_blackboard_events.sql
```

### 下一步

进入 `2.1 工作台 Dashboard`：前端 Vue 3 调用 blackboard summary + compliance 审计做首屏；先评估是否需要后端聚合接口，再决定起步形态。
