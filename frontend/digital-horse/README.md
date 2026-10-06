# 数字马力 - Digital Horse

一个基于 React + TypeScript + Vite 构建的金融企业内部办公平台，使用 Ant Design 作为 UI 组件库。

## 定位

本产品是面向**金融企业内部办公**的场景化平台：

- **不**面向通用个人用户，**不**把通用聊天 / 社交沟通作为核心卖点
- 聊天仅用于企业内部简单辅助沟通（通讯录 / 一对一文本消息）
- 通用能力（快捷键 / 国际化 / 主题切换）代码保留，但不作为业务核心链路

**核心业务链路**：会议协同 → 自动派单 → 智能审批 → 合规沙箱 → 工单闭环

## 技术栈

- **前端框架**: React 18
- **类型系统**: TypeScript
- **构建工具**: Vite
- **UI 组件库**: Ant Design 6
- **路由**: React Router DOM 7
- **状态管理**: Zustand
- **HTTP 客户端**: Axios
- **国际化**: i18next + react-i18next

## 项目结构

```
digital-horse/
├── src/
│   ├── api/                # API 请求封装
│   │   ├── request.ts      # axios 实例和拦截器
│   │   ├── modules.ts      # API 接口模块
│   │   └── index.ts        # 统一导出
│   ├── components/         # 公共组件
│   │   ├── Layout/         # 布局（AppLayout / Sidebar / Header）
│   │   ├── Meeting/        # 会议相关（PostMeeting 等）
│   │   └── Sandbox/        # 合规沙箱
│   ├── i18n/               # 国际化配置 + 语言包
│   ├── mock/               # 演示模式 + bootstrap 兜底（已收敛）
│   │   ├── employees.ts    # 通讯录 bootstrap 数据
│   │   ├── todos.ts        # 待办 bootstrap 数据
│   │   ├── meetingDemo.ts  # 会议演示种子数据
│   │   └── sandboxDemo.ts  # 沙箱演示场景数据
│   ├── pages/              # 页面组件
│   │   ├── Approval/       # 智能审批
│   │   ├── Meeting/        # 会议中心
│   │   ├── Report/         # 研报生成（含沙箱检测）
│   │   ├── Sandbox/        # 合规沙箱独立页
│   │   ├── Knowledge/      # 知识库（已接入 knowledgeApi）
│   │   ├── Settings/       # 系统设置
│   │   │   ├── index.tsx
│   │   │   ├── ExternalPushSettings.tsx
│   │   │   └── AdminPushChannelSettings.tsx  # 管理员推送渠道配置
│   │   ├── Contacts/       # 通讯录（系统辅助工具）
│   │   └── ...
│   ├── services/           # 业务编排与契约
│   │   ├── postMeetingService.ts            # 会议 → 派单 → 工单
│   │   ├── sandbox/                          # 合规沙箱
│   │   ├── meetingApiContract.ts             # 会后接口契约
│   │   └── notificationDispatchService.ts    # 外部推送调度
│   ├── store/              # 状态管理
│   │   ├── approvalDraftStore.ts      # 沙箱 → 审批草稿
│   │   ├── meetingWorkItemStore.ts    # 会议派单工单
│   │   ├── pushChannelConfigStore.ts  # 按业务事件的推送配置
│   │   ├── contactsStore.ts           # 通讯录（辅助工具）
│   │   └── todoStore.ts
│   └── ...
└── ...
```

## Mock 数据清理（最近一次重构）

`src/mock/` 目录已收敛，仅保留**演示模式与 bootstrap 兜底**：

| 文件 | 用途 | 处置 |
|---|---|---|
| `mock/index.ts` | mockjs 路由注册（`/api/user/info` 等） | **删除** — 所有路由未被业务调用 |
| `mock/data.ts` | mockjs 路由使用的 mock 数据 | **删除** — 仅被 `mock/index.ts` 引用 |
| `mock/data/knowledge.ts` | 知识库硬编码 20 篇文档 | **删除** — 业务页改为 `knowledgeApi.getList()` |
| `mock/data/` 目录 | 空目录 | **删除** |
| `mock/meetingDemo.ts` | 会议演示种子数据 | **保留** — `useDemoMode()` 演示模式专用 |
| `mock/sandboxDemo.ts` | 沙箱演示场景（4 个） | **保留** — SandboxRunner / Sandbox 页演示模式专用 |
| `mock/employees.ts` | 通讯录 bootstrap 数据 | **保留** — store 启动降级；接口就绪后移除 bootstrap |
| `mock/todos.ts` | 待办 bootstrap 数据 | **保留** — store 启动降级 |

**业务页面**：原来直接 `import` mock 硬编码数据的页面（如 Knowledge）已改为调用 `knowledgeApi`，后端未就绪前展示**空态 + 错误提示**，不再"用假数据假装可用"。

## 业务联动

### 1. 研报违规 → 沙箱改写

- **触发点**：会议报告导出（`PostMeetingReport` → `ExportToolbar`）+ 研报生成导出（`pages/Report/index.tsx`）
- **流程**：导出时调 `checkCompliance()`，命中**阻断级违规**时弹窗拦截，并提供"**跳转沙箱改写**"按钮
- **跳转后**：报告全文（Markdown 形式）作为 `initialText` 通过 router state 传给 `/sandbox`，沙箱页顶部显示"报告改写模式"提示条
- **改写后**：用户可在沙箱页直接修改 → 重新检测 → 返回原页面继续导出

### 2. 会议生成待办 → 工单 / 审批 一键跳转

- **触发点**：`PostMeetingReport` → `ActionDispatchPanel` / `ActionCard`
- **流程**：
  1. 会议结束 `closeMeeting()` → 自动派单 + 写入 `useMeetingWorkItemStore`
  2. `ActionDispatchPanel` 顶部"**一键跳转审批**"按钮 / `ActionCard` 内每条工单"**一键跳转审批**"按钮
  3. 跳转到 `/approval`，通过 router state 把 `workItemId / meetingId / meetingTitle` 透传
  4. `Approval` 页顶部出现"会议派单工单"卡片，支持通过 / 驳回，回写到 `meetingWorkItemStore`

### 3. 管理员推送渠道配置

- **入口**：系统设置 → **管理员推送** Tab
- **模块**：`src/pages/Settings/AdminPushChannelSettings.tsx`
- **与"外部推送"的差异**：
  - **外部推送**（ExternalPushSettings）：按业务事件配置（哪些事件推到哪些人）
  - **管理员推送**（AdminPushChannelSettings）：管理员配置渠道本身的能力（凭据、限速、全局默认接收人）
- **权限**：仅 `SUPER_ADMIN` 可编辑；`DEPT_ADMIN` 只读
- **渠道**：钉钉机器人 / 企业微信 / 邮件 SMTP / 短信网关（预留）
- **持久化**：localStorage（key: `admin-push-channel-config`）

### 4. 通讯录与一对一聊天（系统辅助工具）

- **定位**：员工查找入口 + 内部简单沟通，**不**作为核心业务流程
- **侧边栏分组**：从 `ai` 组迁至 `communication` 组（"协作沟通"），弱化展示
- **代码保留**：完整保留发送文本消息能力；不强化语音 / 已读回执 / 表情包等完整 IM 交互
- **真实场景**：企业内部沟通仍走钉钉 / 企微，本系统通过"外部推送"配置对接

---

## 深化功能（基于老师意见）

> 设计文档：[`docs/design/`](./docs/design/) 目录

### A. 4 级 RBAC 权限模型 + 越权审计

- **菜单级**：Sidebar `menuConfig.roles` + `usePermission.filterAccessibleMenus`
- **路由级**：`<ProtectedRoute allowedRoles>` 包裹路由
- **按钮级**：`<Can resource="workitem" action="approve">` + `usePermission.can()`
- **数据级**：`DataScope` (ALL/DEPT/DEPT_ONLY/SELF/CUSTOM) + `usePermission.filterByDept()`
- **越权审计**：每次 `can()` 拒绝 → `useAccessAuditStore.record()`，最多 500 条
- **角色权限矩阵**：见 `src/types/permission.ts` 中 `ROLE_PERMISSIONS`
- **落地**：`<Approval>` 页的工单"通过/驳回"按钮已用 `<Can>` 包裹

### B. 工单 6 态生命周期 + 闭环指标 + 会议片段回溯

- **6 态**：`assigned → pending → in_progress → reviewing → approved / rejected`
- **指标看板**：Dashboard 顶部 `<WorkItemMetricsPanel />` 展示总工单数 / 平均闭环时长 / 滞留工单数 / 异常派单率 / 部门分布
- **会议片段回溯**：点击工单卡片 → `<MeetingSegmentDrawer />` 显示触发生成该工单的会议原文片段
- **演示数据**：`src/mock/meetingDemo.ts` 中 `DEMO_WORKITEMS` 7 条覆盖全部 6 态
- **store 升级**：`useMeetingWorkItemStore` version 2（持久化版本号 bump）

### C. 合规沙箱深化：合规回执 + 批量回扫 + 法规可视化

- **合规回执**：每次检测生成带防伪码（SHA-256）的电子回执，含操作人 / 输入哈希 / 命中规则 / 关联法规
  - 落地：`<SandboxRunner>` 检测结果旁"导出合规回执"按钮 → `<ComplianceReceiptCard>` 弹窗
  - 支持：复制 Markdown / 打印 / 下载 JSON
- **批量回扫**：`<BatchComplianceScanPanel>` 嵌入 `/sandbox` 页底部，演示模式遍历 `meetingWorkItems`，输出表格 + 摘要 + CSV 导出
- **法规可视化**：`<RegulationPanel>` 替代原 antd Table，点击展开真实法规条款 + 处罚标准
- **法规库**：`src/services/sandbox/regulationRef.ts` 内置 **30+ 条真实法规**（网络安全法 / 广告法 / 基金法 / 信披办法 / 个保法 / 反洗钱法 / 刑法 163 等）

---

## 通用能力（保留，不作为业务核心）

- **快捷键**：`Ctrl+K` 全局搜索，`Ctrl+B` 切换侧边栏，`?` 显示帮助，`G+字母` 跳转核心页面（Dashboard / Meeting / Knowledge / QA / Approval）
- **国际化**：中文（zh-CN）和英文（en）切换，语言设置持久化
- **主题**：Ant Design ConfigProvider 主题 token，金融高端商务风（主色 `#0F2B5B`）

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 预览生产构建

```bash
npm run preview
```

## 配置

### 环境变量

在 `.env` 文件中配置 API 基础地址：

```
VITE_API_BASE_URL=/api
```

## 开发指南

### 添加新页面

1. 在 `src/pages/` 目录下创建新页面组件
2. 在 `src/router.tsx` 中添加路由配置
3. 在 `src/i18n/locales/` 中添加翻译文本

### 添加 API 接口

在 `src/api/modules.ts` 中添加新的 API 模块：

```typescript
export const newApi = {
  getList: (params?: PageParams) => http.get<ApiResponse<PageResult>>('/new/list', { params }),
  // ...
};
```

### 状态管理

使用 Zustand 创建 store：

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface MyStore {
  data: any;
  setData: (data: any) => void;
}

export const useMyStore = create<MyStore>()(
  persist(
    (set) => ({
      data: null,
      setData: (data) => set({ data }),
    }),
    { name: 'my-storage' }
  )
);
```

## License

MIT

---

## 设计文档索引

详细设计见 [`docs/design/`](./docs/design/)：

- [`rbac.md`](./docs/design/rbac.md) —— 4 级 RBAC + 数据权限 + 越权审计
- [`workorder-loop.md`](./docs/design/workorder-loop.md) —— 工单 6 态生命周期 + 闭环指标 + 会议片段回溯
- [`compliance-sandbox.md`](./docs/design/compliance-sandbox.md) —— 合规沙箱分级 / 法规 / 回执 / 批量回扫