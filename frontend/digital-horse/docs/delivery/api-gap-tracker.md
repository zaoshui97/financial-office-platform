# API 接口缺口追踪

> 对照 `docs/api-contract-v1.md` 第 8 章"当前未提供的接口"。
> **每实现一个接口必须在下面追加一行**，格式如下：
> ```
> [YYYY-MM-DD] <HTTP METHOD PATH> - 责任人<git config user.name> - PR #<num> - 备注
> ```

## 接口补齐记录（按时间倒序）

- [2026-09-19] `GET /api/v1/notifications` - @fjlyh - 当前 commit - 通知中心拉取（**新增**，之前 store 全 mock，无对应接口契约）
- [2026-09-19] `POST /api/v1/notifications/:id/read` - @fjlyh - 当前 commit - 通知标记已读（**新增**）
- [2026-09-19] `PATCH /api/v1/notifications/:id/todo-link` - @fjlyh - 当前 commit - 通知关联待办跳转（**新增**，补"通知 → 业务单据"业务闭环）
- [2026-09-19] `GET /api/v1/workitems/metrics` - @fjlyh - 当前 commit - 工单度量聚合（**新增**，对应 `WorkItemMetricsPanel` 新组件）
- [2026-09-19] `POST /api/v1/sandbox/batch-scan` - @fjlyh - 当前 commit - 批量合规扫描（**新增**，对应 `BatchComplianceScanPanel` 新组件）
- [2026-09-19] `GET /api/v1/sandbox/receipts/:id` - @fjlyh - 当前 commit - 合规回执详情（**新增**，对应 `ComplianceReceiptCard` 新组件 + `services/sandbox/complianceReceipt.ts` 契约）
- [2026-09-19] `POST /api/v1/access-audit/log` - @fjlyh - 当前 commit - 访问审计日志上报（**新增**，对应 `accessAuditStore` 新增 store）
- [2026-09-19] `POST /api/v1/push/channels/test` - @fjlyh - 当前 commit - 推送渠道测试发送（**新增**，对应 `AdminPushChannelSettings` 新页面）
- [2026-09-19] AI 板块（`/chat` `/qa` `/agent` `/memory` + `/agent-hub`）全部下线 - @fjlyh - 当前 commit - **接口缺口移除**：原 QA 流式接口 `/api/v1/chat` P0 已**降级为 P3**（页面下线，不再演示）
- [2026-10-02] AI 智能中心独立页面恢复（Phase 1） - @fjlyh - 当前 commit - **`/api/v1/chat` 优先级从 P3 升回 P2**（`pages/QA.tsx` 重新挂载，mock 响应可见）；**`/api/v1/qa/upload` `/api/v1/qa/documents` `/api/v1/qa/sessions` 接口优先级从 P3 升回 P1**（文档上传 + 多会话是核心演示功能）
- [2026-09-19] mock 数据清理（`src/mock/data.ts` / `data/knowledge.ts` / `index.ts`） - @fjlyh - 当前 commit - **3 个 mock 文件删除**，统一由 `mock/meetingDemo.ts` 接管
- [2026-09-19] 权限体系结构化升级（`types/permission.ts` / `usePermission.ts` / `<Can>` 组件） - @fjlyh - 当前 commit - 前端契约已就绪，后端按 `Role` / `Permission` 枚举实现 RBAC 即可
- [2026-09-14] `POST /api/v1/meetings/:id/actions/dispatch` - @fjlyh - root-commit - 会后自动派单（4 Agent 识别待办 → 调此接口 → 生成工单）
- [2026-09-14] `GET /api/v1/meetings/:id/report` - @fjlyh - root-commit - 会后结构化报告（决策/待办/风险/事实/议题 5 段）
- [2026-09-14] `GET /api/v1/meetings/:id/actions` - @fjlyh - root-commit - 列出会后派生的全部工单
- [2026-09-14] `PATCH /api/v1/actions/:id/close` - @fjlyh - root-commit - 关闭工单
- [2026-09-14] `POST /api/v1/reports/upload` - @fjlyh - root-commit - PDF 上传到 OSS（前端导出 PDF 后可选归档）
- [2026-09-14] 亮点 1 端到端闭环（亮点 1 升级：4 Agent 协作 + 会前预演 + 会中实时 + 会后自动派单 + PDF/MD 导出） - @fjlyh - root-commit - 前端已 mock，后端按 meetingApiContract.ts 字段实现即可


---

## 当前缺口（按优先级）

### P0（核心场景演示必需）

| 接口 | 文档章节 | 当前状态 | 负责人 | 截止 |
|---|---|---|---|---|
| 会议管理 CRUD | §8.1 | 仅有 mock | - | - |
| 会议录音上传 | §8.2 | mock | - | - |
| **通知列表 + 跳转联动** | §8.14 | mock（当前 commit 新增）| - | - |
| 文档生成 (POST /api/v1/document/generate) | §8.5 | mock | - | - |
| 会议报告 (GET /api/v1/meetings/:id/report) | §8.3 | mock（前端契约就绪）| - | - |

### P1（演示加分）

| 接口 | 文档章节 | 当前状态 | 负责人 |
|---|---|---|---|
| 聊天会话列表 | §8.6 | **已下线**（AI 板块移除）| - |
| 消息历史 | §8.7 | **已下线**（AI 板块移除）| - |
| 知识库 CRUD | §8.8 | 部分 | - |
| 文档删除 | §8.9 | 缺失 | - |
| 文档分类树 | §8.10 | 缺失 | - |
| **工单度量聚合** | §8.15 | mock（`WorkItemMetricsPanel` 新组件）| - |
| **批量合规扫描** | §8.16 | mock（`BatchComplianceScanPanel` 新组件）| - |
| **合规回执详情** | §8.17 | mock（`ComplianceReceiptCard` 新组件）| - |

### P2（可选）

| 接口 | 文档章节 | 当前状态 |
|---|---|---|
| 用户注销 / 刷新令牌 | §8.11 | 缺失 |
| 行业新闻搜索 | §8.12 | 缺失 |
| **访问审计上报** | §8.18 | mock（`accessAuditStore` 新增）|
| **推送渠道管理** | §8.19 | mock（`AdminPushChannelSettings` 新页面）|

### P3（已废弃 · 当前 commit 下线）

| 接口 | 原状态 | 处置 |
|---|---|---|
| `/api/v1/chat` 流式问答 | 原 P0 |  **页面下线**，接口从 P0 降级到 P3 |
| `GET /api/v1/agents` 多 Agent 列表 | 缺失 |  **页面下线**，暂不实现 |
| `POST /api/v1/agents/dispatch` Agent 调度 | 缺失 |  **页面下线**，暂不实现 |
| `GET /api/v1/memory/sessions` 长会话记忆 | 缺失 |  **页面下线**，暂不实现 |

### 当前 commit 改动摘要（接口维度）

#### 删除 / 下线
- AI 板块 4 个接口降级 → P3 暂不实现
- `src/mock/data.ts` 等 3 个 mock 文件删除 → 真实对接时由 service 层管理

#### 新增契约（前端已写好，后端按契约实现）
- 通知类 3 个：`GET /api/v1/notifications`、`POST /api/v1/notifications/:id/read`、`PATCH /api/v1/notifications/:id/todo-link`
- 工单类 1 个：`GET /api/v1/workitems/metrics`
- 沙箱类 2 个：`POST /api/v1/sandbox/batch-scan`、`GET /api/v1/sandbox/receipts/:id`
- 审计类 1 个：`POST /api/v1/access-audit/log`
- 推送类 1 个：`POST /api/v1/push/channels/test`

#### 升级 / 增强
- 权限体系类型化（`Role` / `Permission` / `MenuItem.group`）→ 后端按 `usePermission.ts` Hook 返回结构实现 RBAC
- `meetingApiContract.ts` 新增字段（具体字段见 `meetingApiContract.ts` 注释）
- `postMeetingService.ts` mock 实现 +3 行（业务编排增强）
- `meetingWorkItemStore.ts` 重构（持久化 + 状态机）→ 真实对接时把内部 mock 替换为调 `GET /api/v1/meetings/:id/actions` 即可
