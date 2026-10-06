# 重大决策记录（Decision Log）

> 涉及「下线 / 恢复 / 重构」类变更必须在此留档。每条决策包含：编号、日期、上下文、备选项、最终决定、影响范围、回滚方案。

---

## AI-2026-09-17-01：AI 板块 4 合 1（AgentHub 统一入口）

**日期**：2026-09-17
**提交**：commit `e4cd3d8`

### 上下文
- 侧边栏 19 条菜单，AI 类入口占 4 格（Chat / QA / Agent / Memory），评委第一眼找不到 AI 能力
- 用户反馈"AI 智能助手 / 知识问答 / 多 Agent 调度" 3 个名字相似度高，分不清边界
- 4 个独立路由，深链无法定位到具体子能力

### 备选项
- **A**：保留 4 个独立入口（不做改动）
- **B**：4 合 1 整合为 `/agent-hub?tab=xxx`（采用）
- **C**：砍到 2 个（保留 Chat + Agent，QA/Memory 合并到 Chat）

### 最终决定
**采用 B**：AgentHub 统一容器 + `useSearchParams` 双向同步 `?tab=xxx`。

### 影响范围
- `src/router.tsx`：新增 `/agent-hub` 容器；旧路由全部 redirect
- `src/pages/AgentHub/index.tsx`：新建 211 行容器组件
- `src/components/Layout/Sidebar.tsx`：移除 4 个独立 AI 菜单，新增 1 个"AI 智能中心"
- 菜单总数 19 → 12

### 回滚方案
保留旧路由 redirect 不变即可（已实现零硬中断），如需回滚 4 个独立页面，只需恢复 4 个独立路由挂载。

---

## AI-2026-09-19-01：AI 智能中心整体下线

**日期**：2026-09-19
**提交**：commit `00:31  @fans  [refactor: AI 智能中心下线 + mock 数据精简 + Notifications 业务跳转 + 死循环根治]`

### 上下文
- AgentHub 整合后演示仍不够聚焦，4 个 Tab 切换演示成本高
- 决定聚焦 5 个核心亮点：会议协同 / 智能审批 / 合规沙箱 / 行业洞察 / 智能研报
- 删 -1970 行代码，主页面不再承载 AI 长内容

### 备选项
- **A**：保留 AgentHub 但减少 Tab（4 → 2）
- **B**：完全下线（采用）
- **C**：保留独立页面不动，删除 AgentHub 整合容器

### 最终决定
**采用 B**：删除 `AgentHub` / `Memory` / `Plugin` 3 个页面 + `AIWorkbench` dead code + 全局 mock 数据。旧路由 `/chat /qa /agent /memory` 全部 redirect 到 `/dashboard`。

### 影响范围
| 文件 | 操作 |
|---|---|
| `src/pages/AgentHub/index.tsx` | 删除（-211） |
| `src/pages/Memory/index.tsx` | 删除（-788） |
| `src/pages/Plugin/index.tsx` | 删除（-106） |
| `src/pages/Dashboard/components/AIWorkbench/` | 删除（-360） |
| `src/mock/data.ts` / `src/mock/index.ts` / `src/mock/data/knowledge.ts` | 删除 |
| `src/router.tsx` | 移除 AgentHub 懒加载；4 个旧路由 redirect 到 `/dashboard` |
| `src/components/Layout/Sidebar.tsx` | 移除 `/agent-hub` 和 `/plugins` 菜单项；移除 `ai` 分组渲染 |
| `src/components/Layout/Topbar.tsx` | 移除"AI 助手"快捷入口按钮 |
| `src/pages/LaunchPad/index.tsx` | 移除"智能问答"/"团队聊天"卡片 |

### 回滚方案
从 git 历史恢复（commit `e4cd3d8` 之前）。但本次同时清理了大量 mock 和 dead code，**完全回滚成本较高**，建议只回滚路由挂载和 Sidebar 入口。

---

## AI-2026-10-02-01：AI 智能中心独立入口恢复（Phase 1）

**日期**：2026-10-02
**提交**：本次修复（未 commit）

### 上下文
- `/dashboard` "更多入口" 两个核心卡片点击无反应（用户截图）：
  - **行业洞察** → `path: '/insights'` 错误路径
  - **AI 智能中心** → `path: '/agent-hub'` 已被删除，等于死链
- 用户反馈"找不到单独的智能体问答页面"：`pages/QA.tsx` 文件存在但路由被屏蔽，等于功能缺失
- 距 2026-09-19 下线已 14 天，演示路线已稳定，**风险可控**

### 备选项
- **A**：完全复活 AgentHub 整合容器（4 Tab）
- **B**：保留独立 3 个页面（QA / Agent / Chat），`/memory` 重定向到 `/qa`（采用）
- **C**：仅恢复 Dashboard 入口卡片 + 让其跳 `/dashboard`（占位不做）

### 最终决定
**采用 B**：保留 2026-09-19 的精简路线（删除整合容器、删除 mock、删除 dead code），但恢复 3 个独立页面挂载，让用户能直接访问每个 AI 能力。

### 理由
1. **2026-09-19 的精简依然成立**——4 个相似入口确实分不清边界，整合容器删得对
2. **完全下线太过激进**——QA / Agent 是真实业务能力（文档问答 / 多 Agent 任务管理），不是占位功能
3. **挂载真实页面 vs 占位入口**——选前者，符合"宁可少而精，不要多而废"原则
4. **/memory 并入 /qa**——记忆管理视为问答的子能力（多会话历史），不需要独立路由

### 影响范围
| 文件 | 操作 |
|---|---|
| `src/router.tsx` | 移除 3 个 redirect；新增 3 个真实挂载；`/memory` 改为跳 `/qa` |
| `src/components/Layout/Sidebar.tsx` | 菜单配置新增 2 项（QA + Agent）；恢复 `ai` 分组渲染 |
| `src/pages/Dashboard/components/DashboardCharts/index.tsx` | 修路径 bug |
| `src/pages/QA.tsx` / `src/pages/Agent/index.tsx` / `src/pages/Chat.tsx` | **不改动**（文件实现完整） |

### 不影响范围
- ✅ Dashboard "会议协同 / 我的待办 / 智能审批 / 合规沙箱 / 行业洞察 / 智能研报 / 通讯录" 7 个核心入口仍有效
- ✅ Sidebar 核心 / 合规 / 知识管理 / 系统管理 4 个分组仍生效
- ✅ 2026-09-19 的 mock 数据精简、Notifications 跳转、死循环根治等修复全部保留

### 回滚方案
如未来需要再次下线，只需把 `routePermissions` 中 `/qa /agent /chat` 移除 + 恢复 redirect 到 `/dashboard`，无需再删文件（已保留完整实现）。

### 与旧决策的关系
- **不冲突 AI-2026-09-17-01**（AgentHub 整合容器）：本次**不复活容器**，保留独立页面
- **修正 AI-2026-09-19-01**（完全下线）：本次**部分恢复**——只恢复真实业务页面，不复活 mock 容器和废弃的 Plugin

---

## 待定决策（Backlog）

### BD-2026-XX-XX-01：QA 页面 mock 切换到真实 LLM
- **触发条件**：演示需要真实对话能力时
- **备选项**：DeepSeek / 通义千问 / OpenAI
- **待评估**：成本、响应速度、中文金融领域能力
- **关联文件**：`src/pages/QA.tsx` `generateMockResponse()` 函数

### BD-2026-XX-XX-02：QA 文档解析接入
- **触发条件**：用户上传 PDF 后需要真正"读"内容
- **备选项**：PDF.js + mammoth.js / 阿里云文档智能 / 自建 RAG 服务
- **关联文件**：`src/pages/QA.tsx` 文件上传逻辑
