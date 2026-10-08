# 产品原型说明文档

> 适用范围：financial-office-platform v1.0（数字孪生办公平台）
> 文档版本：v1.0（2026-10-08）
> 维护：<TODO: 填负责人姓名> ｜ 评审：<TODO: 填评审人姓名>
> 状态：🚧 编写中，章节前的 [ ] = 待完成，[x] = 已完成

---

## 0. 文档说明

- 读者对象：评委 / 队员 / 自己回顾
- 阅读时长：≈ 25 分钟
- 配套资源：
  - 原型源文件：<TODO: Figma 链接 或 本地 dist 包路径>
  - 后端接口契约：`docs/api-contract-v1.md`
  - 路由表：`docs/delivery/ROUTE-MATRIX.md`
  - 截图存放目录：`docs/delivery/assets/prototype-spec/`

> 【图 0-1：文档导览图】<TODO: 思维导图，列出 6 大模块 + 入口路径，点击可跳转章节。工具：xmind / draw.io / mermaid（推荐 mermaid 嵌入）>
> 文件路径：`docs/delivery/assets/prototype-spec/00-navigation.png`

---

## 1. 产品概览

### 1.1 一句话定位
<TODO: 一句话写清楚产品是啥。例：「一个面向金融办公场景的 AI 数字员工协同平台，覆盖会前预演、会中协作、会后闭环全流程。」>

### 1.2 核心价值
- **价值 1**：<TODO>
- **价值 2**：<TODO>
- **价值 3**：<TODO>

### 1.3 目标用户
<TODO: 填表，参考下面模板>

| 角色 | 占比 | 核心诉求 | 对应模块 |
|---|---|---|---|
| 项目经理 | 30% | 派单 / 跟踪 / 决策 | 审批、会议 |
| 业务骨干 | 50% | 接收任务 / 提效 | 工单、Agent |
| 风控合规 | 10% | 审查 / 留痕 | 合规审查、审计 |
| 管理员 | 10% | 账号 / 权限 | 用户管理 |

> 【图 1-1：用户旅程图（User Journey Map）】<TODO: 泳道图，从「打开浏览器」到「完成会后闭环」共 8 个触点，标注每个触点的情绪曲线（高兴/普通/痛点）。工具：figma / excalidraw>
> 文件路径：`docs/delivery/assets/prototype-spec/01-user-journey.png`

### 1.4 信息架构（IA）
> 【图 1-2：信息架构图（树状）】<TODO: 自顶向下 3 层。L1 顶层导航（6 个 Tab）、L2 一级模块、L3 二级页面。工具：xmind / mindnode>
> 文件路径：`docs/delivery/assets/prototype-spec/01-information-architecture.png`

---

## 2. 设计语言

### 2.1 视觉规范
<TODO: 填表>

| 项 | 规范 | 备注 |
|---|---|---|
| 主色 | `#0F2B5B`（藏青，金融感） | 用于顶部栏 / 主按钮 |
| 强调色 | `#C9A459`（暗金） | 用于高级操作 / 收费功能 |
| 成功 | `#22A775` | AI 生成完成 |
| 警告 | `#FAAD14` | 即将超时 |
| 危险 | `#FF4D4F` | 失败 / 删除 |
| 字体 | PingFang SC / Microsoft YaHei | 14px / 16px / 20px / 24px / 32px |
| 间距 | 4 / 8 / 12 / 16 / 20 / 24 / 32 | 8 的倍数为主 |

> 【图 2-1：Design Token 表】<TODO: 截图 Antd Theme 配置或 Figma Design Token 面板>
> 文件路径：`docs/delivery/assets/prototype-spec/02-design-tokens.png`

### 2.2 组件风格
- 按钮：<TODO> 直角圆角 4px，主操作用实心，次操作用 ghost
- 卡片：<TODO> 白底 1px #F0F0F0 边框，hover 时阴影
- 表格：<TODO> 斑马纹 + 悬浮高亮，操作列右对齐

> 【图 2-2：UI Kit 组件库大图】<TODO: 一张长图，把按钮/输入框/卡片/Tag/Modal/Empty 等 12 个核心组件全部展示>
> 文件路径：`docs/delivery/assets/prototype-spec/02-ui-kit.png`

### 2.3 交互原则
- 关键操作必有二次确认（删除、关闭会议、撤销审批）
- 所有异步操作有 Loading + 结果反馈
- 表单错误就近提示，不弹 Modal
- 列表数据 > 50 条时分页（每页 20）

---

## 3. 全局框架（所有页面通用）

### 3.1 整体布局
> 【图 3-1：全局布局结构图】<TODO: 标注 4 个区域尺寸。① 左侧 Sidebar 220px（可折叠到 60px）② 顶部 Header 高 56px ③ 主内容区自适应 ④ 右侧 Drawer 宽 480px>
> 文件路径：`docs/delivery/assets/prototype-spec/03-layout.png`

### 3.2 顶部导航
> 【图 3-2：顶部导航高亮截图】<TODO: 真机页面，红框标注 4 个区域：Logo / 面包屑 / 全局搜索 / 用户头像>
> 文件路径：`docs/delivery/assets/prototype-spec/03-header.png`

### 3.3 侧边栏
> 【图 3-3：侧边栏展开 + 折叠两种状态】<TODO: 两张并排截图，标注哪些是一级菜单哪些是分组（AI能力/工作流/数据/系统）>
> 文件路径：`docs/delivery/assets/prototype-spec/03-sidebar.png`

### 3.4 响应式
<TODO: 列出三档断点策略>

- ≥ 1280px：完整 4 区
- 1024-1279px：抽屉改模态
- < 1024px：移动端样式（部分功能禁用）

> 【图 3-4：三档断点对比】<TODO: 同一页面在 1440 / 1024 / 768 三个宽度下的截图>
> 文件路径：`docs/delivery/assets/prototype-spec/03-responsive.png`

---

## 4. 模块一：会议中心

### 4.1 模块概览
- 入口：`/meeting`
- 核心流程：会议列表 → 详情 → 实时会议室 → 彩排 → 报告
- 关键创新：<TODO: 3 条核心创新点>
  - 会前 4 Agent 模拟
  - 会中实时 4 Agent 协作
  - 会后自动派单

### 4.2 会议列表页
> 【图 4-1：会议列表页整页截图】<TODO: 含真实数据（至少 3 张卡片），红框标注：① 状态 Tag ② 主题 ③ 议题 ④ 当前阶段>
> 文件路径：`docs/delivery/assets/prototype-spec/04-meeting-list.png`

功能点：
- [x] 按状态筛选（准备中/进行中/已关闭）
- [x] 用邀请码加入（顶栏按钮）
- [x] 新建会议（右上角）
- [x] 卡片点击进详情

### 4.3 会议详情页
> 【图 4-2：会议详情页-已结束状态截图】<TODO: 含时间线、纪要 Tab、行动项 Tab。**重点红框标出"邀请码 banner 只在 preparing/active 时显示"**>
> 文件路径：`docs/delivery/assets/prototype-spec/04-meeting-detail-ended.png`

四个 Tab：
- 会议纪要（Markdown 渲染）
- 行动项（卡片 + 状态机）
- 参会人（头像组 + 角色）
- 生命周期（Steps 进度条）

> 【图 4-3：会议详情页-进行中状态截图】<TODO: 与图 4-2 对比，重点显示邀请码 banner 出现>
> 文件路径：`docs/delivery/assets/prototype-spec/04-meeting-detail-active.png`

> 【图 4-4：邀请码生成弹窗截图】<TODO: 截图里能看到 6 位大写字母 + 有效期 + 复制按钮>
> 文件路径：`docs/delivery/assets/prototype-spec/04-invite-modal.png`

### 4.4 实时会议室
> 【图 4-5：会议室 4 Agent 布局截图】<TODO: 四宫格布局，标注每个 Agent 的角色（主持人/秘书/记录员/计时员）>
> 文件路径：`docs/delivery/assets/prototype-spec/04-meeting-room.png`

### 4.5 彩排模式
> 【图 4-6：彩排页 vs 实时页对比图】<TODO: 左右两栏对照，列出 5 个差异点（无麦/假数据/沙盒/可暂停/可重放）>
> 文件路径：`docs/delivery/assets/prototype-spec/04-rehearsal-vs-live.png`

### 4.6 会议报告
> 【图 4-7：报告导出 PDF 截图 + Markdown 截图】<TODO: 双图对照，PDF 强调排版、Markdown 强调可编辑>
> 文件路径：`docs/delivery/assets/prototype-spec/04-report-export.png`

---

## 5. 模块二：审批中心

### 5.1 模块概览
- 入口：`/approval`
- 核心创新：<TODO> 会议行动项 → 审批单 闭环

### 5.2 工单看板
> 【图 5-1：审批看板（4 列：待审/进行中/已完成/已驳回）】<TODO: 截图实际数据，红框标注卡片上 5 个信息：标题/优先级/指派人/截止日/AI 评分>
> 文件路径：`docs/delivery/assets/prototype-spec/05-approval-kanban.png`

### 5.3 工单详情
> 【图 5-2：工单详情右侧抽屉截图】<TODO: 标注 6 个区域：基本信息/附件/AI 审查/流转记录/评论区/操作按钮>
> 文件路径：`docs/delivery/assets/prototype-spec/05-approval-drawer.png`

### 5.4 AI 审查卡
> 【图 5-3：AI 审查结果卡截图】<TODO: 红框标出"风险等级 颜色映射"——绿/黄/红>
> 文件路径：`docs/delivery/assets/prototype-spec/05-ai-review.png`

### 5.5 闭环演示
> 【图 5-4：会议行动项 → 审批单 三步跳转动图】<TODO: 录制 GIF，演示：会议详情点"派发" → 创建工单 → 跳到审批页 → 显示新工单>
> 文件路径：`docs/delivery/assets/prototype-spec/05-closed-loop.gif`

---

## 6. 模块三：AI 智能中心

### 6.1 模块概览
- 三个子入口：智能问答 `/qa`、Agent 调度 `/agent`、对话 `/chat`
- 共同底座：<TODO> LLM 路由 + 工具注册 + 上下文管理

### 6.2 智能问答
> 【图 6-1：问答页冷启动空状态 + 提问后状态】<TODO: 两张截图，标注 3 个能力：① 单轮问答 ② 多轮上下文 ③ 引用附件>
> 文件路径：`docs/delivery/assets/prototype-spec/06-qa.png`

### 6.3 Agent 调度
> 【图 6-2：Agent 列表 + 单个 Agent 详情】<TODO: 左侧列表右侧详情，标注 Agent 的 5 项元数据：名称/描述/工具/示例/调用次数>
> 文件路径：`docs/delivery/assets/prototype-spec/06-agent.png`

### 6.4 多 Agent 对话
> 【图 6-3：群聊 4 Agent 协作截图】<TODO: 截图里看到不同角色的 Agent 头像轮流发言>
> 文件路径：`docs/delivery/assets/prototype-spec/06-multi-agent.png`

---

## 7. 模块四：知识库

### 7.1 模块概览
- 入口：`/knowledge`
- 功能：<TODO> 文档检索 / 上传 / 标签 / 全文搜索

> 【图 7-1：知识库列表 + 详情页】<TODO: 左侧目录树 + 右侧 Markdown 渲染>
> 文件路径：`docs/delivery/assets/prototype-spec/07-knowledge.png`

> 【图 7-2：上传流程 4 步截图】<TODO: 选文件 → 解析进度 → 标签确认 → 索引完成>
> 文件路径：`docs/delivery/assets/prototype-spec/07-upload.png`

---

## 8. 模块五：合规审查

### 8.1 模块概览
- 入口：`/compliance`
- 流程：<TODO> 提交材料 → 自动审查 → 人工复核 → 出报告

> 【图 8-1：合规审查提交表单】<TODO: 标注必填项 + 智能提示>
> 文件路径：`docs/delivery/assets/prototype-spec/08-compliance-form.png`

> 【图 8-2：审查报告页（红黄绿三色）】
> 文件路径：`docs/delivery/assets/prototype-spec/08-compliance-report.png`

---

## 9. 模块六：系统管理

### 9.1 用户管理
> 【图 9-1：用户列表 + 角色编辑抽屉】
> 文件路径：`docs/delivery/assets/prototype-spec/09-users.png`

### 9.2 审计日志
> 【图 9-2：审计日志时间线 + 详情】
> 文件路径：`docs/delivery/assets/prototype-spec/09-audit.png`

### 9.3 通知中心
> 【图 9-3：通知列表 + 已读/未读切换】
> 文件路径：`docs/delivery/assets/prototype-spec/09-notifications.png`

---

## 10. 模块间联动（重要！）

> 【图 10-1：六大模块联动关系图（核心）】<TODO: 用箭头标注 4 条主链路：① 会议 → 行动项 → 审批 → 工单关闭 ② 资讯 → 合规审查 → 留档 ③ 知识库 → Agent RAG → 问答 ④ 用户 → 角色 → 权限 → 审计>
> 文件路径：`docs/delivery/assets/prototype-spec/10-modules-relation.png`

> 【图 10-2：典型用户路径泳道图】<TODO: 以"项目经理发起 Q3 评审"为故事，画 6 步路径（创建会议→邀请→开会→生成纪要→派单→关闭）>
> 文件路径：`docs/delivery/assets/prototype-spec/10-user-path.png`

---

## 11. 异常状态（容易被忽略但很加分）

> 【图 11-1：8 种异常状态合集图】<TODO: 必须包含：空数据 / 网络错误 / 权限不足 / 加载中 / 提交中 / 失败重试 / 服务降级 / 强制下线>
> 文件路径：`docs/delivery/assets/prototype-spec/11-exceptions.png`

---

## 12. 原型变更记录

| 版本 | 日期 | 变更 | 作者 |
|---|---|---|---|
| v0.1 | <TODO> | 初稿 | <TODO> |
| v0.5 | <TODO> | 增加 AI 中心 | <TODO> |
| v1.0 | 2026-10-08 | 增加闭环图 | <TODO> |

---

## 附录 A：术语表

| 术语 | 解释 |
|---|---|
| Agent | <TODO> |
| 工单 | <TODO> |
| 闭环 | <TODO> |
| 彩排 | <TODO> |

## 附录 B：参考资源
- 阿里巴巴 Ant Design 设计规范
- 字节跳动 Arco Design 组件库
- <TODO: 补充>
