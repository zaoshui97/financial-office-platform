# 项目功能清单（PPT / 文档 / 视频素材）

> 适用对象：PPT 制作者、文档撰写同学、视频脚本同学
> 项目代号：digital-horse（数字马力 · 金融办公智能体平台）
> 视角：用户视角，按"模块 → 功能点 → 价值"组织

---

## 一、工作台 / Dashboard（首页）

| 功能点 | 价值说明 |
| --- | --- |
| 时段问候 + 实时时钟 | 12 / 18 点自动切换早安 / 午安 / 晚安，营造"专属金融助手"氛围 |
| **主入口矩阵（2026-09-24 重构）** | 4 个核心模块（会议 / 待办 / 审批 / 沙箱）一屏可点，悬停上浮 + 边框高亮，**主页面不做长内容** |
| **最近通知（2026-09-24 新增）** | 首页横排最近 3 条通知，每条带类型色点 + Tag + 时间，点击直达 `/notifications`（参考右图"通知消息一目了然"） |
| **我的待办 Top3（2026-09-24 重构）** | 移除 3-Tab 切换器，改为"优先级排序的前 3 条 + 3 个状态 Tag + 全部 →"，顶部一行完成率概览；详细任务下沉到 `/meeting?tab=list` |
| **效率趋势迷你卡（2026-09-24 重构）** | 7 日 AreaChart（260px 高）→ 120px 高的折线 + 3 个核心 KPI；详细数据下沉到子页面 |
| **今日会议（2026-09-24 重构）** | 由 4 条 + 5 行精简为前 3 条精简版 + "全部 →"入口 |
| 通知跳转高亮（2026-09-19 新增）| 通知中心点击"查看任务" → 跳到 Dashboard `?highlightTodo=xxx` 高亮对应待办，体验连贯 |
| **删除：会议工单度量面板（2026-09-24 下沉）** | 聚合统计移至 `/approval` 页面，主页面不再承载 |
| **删除：近期会议工单 6 卡（2026-09-24 下沉）** | 工单明细移至 `/approval`，主页只保留"主入口" |

---

## 二、AI 智能中心（**2026-09-19 下线 → 2026-10-02 部分恢复**）

> **历史决策（2026-09-19）**：AI 板块 4 个相似度高、演示时评委分不清边界的入口（Chat / QA / Agent / Memory）全部下线，聚焦 5 个核心亮点。`Sidebar` 菜单从 12 → 10 条。
>
> 涉及文件：`src/pages/AgentHub/` / `src/pages/Memory/` / `src/pages/Plugin/` / `src/pages/Dashboard/components/AIWorkbench/` 全部删除（-1970 行）。`Sidebar` 移除 `/agent-hub` 和 `/plugins` 菜单项。

> **Phase 1 修正（2026-10-02）**：14 天后回访发现两个挂死入口（Dashboard "行业洞察 / AI 智能中心" 卡片），且用户反馈"找不到单独智能体问答页面"。**部分恢复**——只恢复 3 个真实业务页面（QA / Agent / Chat），**不复活 AgentHub 整合容器**（精简路线依然成立）。详见 `DECISIONS.md` §AI-2026-10-02-01。

### 当前生效页面

| 功能点 | 价值说明 | 入口 |
| --- | --- | --- |
| **智能问答（QA · Phase 1 恢复）** | 多会话管理 + 文件附件拖拽上传（PDF/DOCX/XLSX/PPTX/TXT/MD/CSV/PNG/JPG）+ Markdown 渲染 + 代码高亮 + 引用文档标签 | `/qa`（Sidebar AI能力 / Dashboard "AI 智能中心" 卡片） |
| **多 Agent 调度中心（Agent · Phase 1 恢复）** | 5 个 Agent 卡（会议 / 文档 / 法规 / 问答 / 数据）+ 任务列表（运行中 / 已完成 / 失败 / 空闲）+ Steps 执行进度 + 查看执行日志 + 重跑 | `/agent`（Sidebar AI能力） |
| **RAG 通用对话（Chat · Phase 1 恢复）** | 通用对话 + 重新生成 / 点赞 / 点踩 / 复制 + 快捷建议 | `/chat`（直接访问） |
| ~~记忆管理（Memory）~~ | ~~已并入问答，访问 `/memory` 自动跳 `/qa`~~ | ↪️ 重定向 |

---

## 三、会议协同管理（MeetingHub 整合 + 子页面重定向）

| 功能点 | 价值说明 |
| --- | --- |
| MeetingHub 列表 + Tab 切换 | 统一入口承接 `/meeting?tab=list/room/rehearsal/detail/report`，旧路由自动重定向 |
| 会议列表（MeetingList） | 已结束会议支持"查看报告"，未开始支持"会前预演"；卡片式 UI · **v2**: Table `scroll.x=960` + 左右双 fixed 列 + 列宽收紧（title 220 / 起止时间 160 / 参会人 140 / 状态 96 / 操作 220）+ 操作列按状态精简 + size=small + wrap + 删除按钮常驻，参会人头像 Tooltip 显全名 |
| 会议详情（MeetingDetail） | 会议元信息、参会人、纪要、待办汇总展示 |
| 会前预演（MeetingRehearsal） | 4 Agent 模拟开会准备，输出"就绪度"圆环，让用户在开会前看到 AI 拟定的议题 |
| 会议中（MeetingRoom） | 4 Agent 实时并行分析（fanoutChunk）+ 共享 Blackboard + 本地摄像头接入 · **2026-09-19 修复**：两处死循环（`setParticipants` + AI 模拟分析 timer），`Maximum update depth exceeded` 已根除 |
| 会后报告（PostMeetingReport / PostMeetingDrawer） | 5 段结构化报告（摘要 / 决策 / 待办 / 风险 / 议题）+ 自动派单 + PDF / Markdown 导出 |
| **会议片段抽屉（MeetingSegmentDrawer · 2026-09-19 新增）** | 按时间轴定位转写片段，点击跳转具体发言位置（演示增强）|
| **工单度量面板（WorkItemMetricsPanel · 2026-09-19 新增）** | 工单统计聚合：完成率 / 平均处理时长 / 按优先级分布 / 按部门分布（演示增强）|
| TaskPipeline（任务流水线） | "纪要 → 拆解 → 分配 → 跟踪 → 推送 → 完成"6 步可视化，支持一键推钉钉 / 邮件 |

---

## 四、智能审批助手（Approval）

> 亮点 4。Sandbox 合规检测 → AI 预审 → 审批通过全链路，数据不过第三方。

| 功能点 | 价值说明 |
| --- | --- |
| **Sandbox → Approval 联动** | 在沙箱做完合规检测 → 一键"提交审批"，自动将 `SandboxResult`（评分/命中规则/改写建议）注入审批草稿，审批人直接看到 AI 预审结论 |
| **AI 预审结论嵌入卡片** | 每张审批卡片内嵌"AI 预审"标签，显示风险等级（优秀/良好/一般/较差/不合格）+ 命中规则数 + Top 风险提示，审批人 3 秒判断要不要点开 |
| **7 类审批场景 + 图标区分** | 报销 / 合同 / 用印 / 发文 / 出差 / 采购 / 预算，图标 + 类型 Tag 一眼区分；各场景独立颜色编码 |
| **4 大统计卡 + 超时告警** | 待审批 / 已通过 / 已驳回 / 进行中 + 超时徽标（橙色）；标签筛选快速定位；超时自动变红 |
| **审批时间线** | 每张审批详情展示完整审批链（提交/预审/逐级审批/结果）+ 驳回理由；可追溯 |
| **通过 / 驳回 / 催办 / 详情** | 4 类审批动作；驳回时强制填写理由；催办触发通知推送；详情页含 AI 预审完整报告 |

---

## 五、合规沙箱（Sandbox · 核心亮点）

| 功能点 | 价值说明 |
| --- | --- |
| 9 大类 47 条合规规则 | 敏感词 / 投资收益承诺 / 数据隐私 / 反洗钱 / 反不正当竞争 / 客户适当性 / 利益冲突 / 关联交易 / 信息披露违规 |
| 30+ 条真实法规引用 | 网安法 / 广告法 / 资管新规 / 基金法 / 个保法 / 适当性办法 / 反洗钱法 等真实条款 + 处罚标准 |
| 5 分制评分 + 评分圆环 | ScoreRing 渐变色 + 5 星评级 + 中文标签（优秀 / 良好 / 一般 / 较差 / 不合格） · **v2**: 小尺寸自适应（score 字号 0.3→0.28、`lineHeight: 1`、`gap: 2`、`size ≥ 140` 才显示星级）+ 容器 `overflow: hidden` 兜底 |
| 命中文本高亮 | 4 级严重度（block / high / medium / low）→ 4 种高亮色，悬停显示规则类别 + 法规 |
| 改写建议（rewritten） | 命中规则后自动拼接修复建议，给出可粘贴的合规版本 |
| 运行历史 + 审计 CSV | 200 条记录上限、SHA-256 输入哈希脱敏、一键导出 `sandbox-audit-YYYY-MM-DD.csv` |
| Sandbox → Approval 联动 | `useApprovalDraftStore` 把结果存为草稿，跳转审批页预填 |
| **法规面板（RegulationPanel · 2026-09-19 新增）** | 按 9 大类组织法规清单，每条法规显示完整条款 + 处罚标准，方便用户快速对照 |
| **批量合规扫描（BatchComplianceScanPanel · 2026-09-19 新增）** | 一次粘贴多段文本，批量过合规检测，结果聚合成表格输出（演示"批量审核"场景） |
| **合规回执卡片（ComplianceReceiptCard · 2026-09-19 新增）** | 每次扫描生成可分享 / 可归档的合规回执卡片（含评分 + 命中规则 + 时间戳 + 哈希），对接审批 / 知识库 |
| 演示模式 | 内置 `DEMO_SANDBOX_TEXTS` 随机抽样，"5% 模拟失败率"让失败处理逻辑真实可见 |

---

## 六、智能研报写作（Report）

| 功能点 | 价值说明 |
| --- | --- |
| 5 类报告模板 | 行业分析 / 市场周月报 / 投资分析框架 / 合规审查 / 会议纪要整理 |
| 4 步引导式生成 | 选模板 → 填参数 → AI 生成（步骤可视化 + 进度条）→ 查看结果 |
| 阅读 / 编辑双视图 | 编辑视图支持二次修改，阅读视图沉浸式排版 |
| 导出 Word / PDF / 复制 | 4 种导出动作（打印 / Word / PDF / 复制） |
| 关联合规检查 | 周报内容自动过 `runSandboxCheck`，阻断级违规不允许提交 |

---

## 七、企业知识库（Knowledge）

| 功能点 | 价值说明 |
| --- | --- |
| 文档分类（policy / project / faq / template / report / minutes） | 6 类文档按角色管理 |
| 知识图谱可视化（KnowledgeGraph） | 自研 SVG 力导向布局，支持放大 / 缩小 / 重置 / 类别筛选 |
| 文档上传 + 检索 | antd Upload.Dragger 拖拽上传，按标题 / 类别筛选 |
| 文档生成器（公文模板） | 通知 / 邮件 / 周报三类模板，结合 AI 自动生成 |
| 收藏 / 预览 / 下载 / 删除 | 完整 CRUD + 收藏状态持久化 |

---

## 八、行业资讯（IndustryNews）

| 功能点 | 价值说明 |
| --- | --- |
| 资讯流（卡片 / 列表切换） | 政策 / 监管 / 行业 / 报告 / 数字货币 / 技术 / 安全 7 类标签 |
| 收藏 + 筛选 | 按"只看收藏"过滤，单条收藏 |
| **资讯详情 Drawer（2026-09-24 新增）** | 热门头条 / 列表项 / 眼睛图标三处点击统一打开 720px Drawer：标题 + 元信息 + AI 摘要 + 关键信息 Descriptions + 段落化正文 + 处理记录 Timeline + 粘性底栏（复制全文 / 发起审查 / 关闭），打开即标记已读 |
| **一键发起合规审查（2026-09-24 打通）** | 高/中影响度资讯右上角 + 底栏双重入口 → 调用 `handleLaunchComplianceReview` 自动生成待办 + 风险通知 + 钉钉/企微/邮件外部推送，让"监管资讯 → 合规审查"形成可演示闭环 |
| **MOCK 资讯正文（2026-09-24 补全）** | 7 条资讯由空串 → 每条 3-5 段真实业务内容（修订背景 / 主要条款 / 行业影响 / 合规应对建议 / 量化数据），详情 Drawer 才能展示真实可读的正文 |

---

## 九、通讯录 / 即时聊天（Contacts）

| 功能点 | 价值说明 |
| --- | --- |
| 员工档案（12+ mock） | 角色 / 部门 / 职位 / 在线状态，按部门分组 |
| 一对一私聊（ChatDrawer） | 气泡式消息 + 时间戳 + 已读未读 + 引用消息 |
| 角色权限（USER / DEPT_ADMIN / SUPER_ADMIN） | `MOCK_USERS` 三角色体系，菜单按角色过滤 |
| Zustand + persist | `contacts-storage` 持久化到 localStorage |

---

## 十、系统设置 / 权限安全 / 通知

| 功能点 | 价值说明 |
| --- | --- |
| 个人中心（Profile） | 头像 / 部门 / 角色展示 + 主题切换（浅色 / 深色） |
| 系统设置（Settings · SUPER_ADMIN） | API Key 配置（DeepSeek）、语言切换（zh-CN / en-US） |
| 权限安全中心（Security · SUPER_ADMIN） | 角色管理 / 菜单权限配置 |
| **权限体系结构化（2026-09-19 升级）** | `Role` / `Permission` / `MenuItem.group` 类型化；`usePermission()` Hook（`filterAccessibleMenus` / `can` / `hasRole`）；`<Can>` 组件包裹（`<Can roles={['SUPER_ADMIN']}>...</Can>`） |
| 消息通知（Notifications · **v3**） | **顶部 4 卡统计**（总数 / 未读 / 紧急未读 / 批量操作）+ **Tab 计数**（类型 + 括号数字）+ **每条**: 类型色条 + 圆角图标盒 + 标题红点光晕 + 类型 Tag + 相对时间 + 内容 + 状态化操作 + **批量**: 全选/反选/批量已读/批量删除 + **视图切换**: 列表 / 紧凑单行 + **业务跳转（v3 新增）**：每条通知 `businessRef` → 点击通知卡片或 action 按钮自动标记已读 + 跳转到对应业务单据（todo / meeting / approval / report / news）+ **新通知类型 `todo`**（v3 新增）+ 持久化 v2 + 强制覆盖 localStorage |
| ~~插件能力市场（PluginMarket · DEPT_ADMIN+）~~ |  **2026-09-19 已下线**（AI 板块移除） |
| **外部推送管理（AdminPushChannelSettings · 2026-09-19 新增 · SUPER_ADMIN）** | 钉钉 / 企微 / 邮件推送渠道配置 + 接收人管理 + 测试发送按钮（管理员配置页） |
| **访问审计（accessAuditStore · 2026-09-19 新增）** | 敏感操作日志（访问敏感页面 / 修改配置 / 导出数据等），自动上报后端审计接口 |

---

## 十一、关键技术亮点

| 维度 | 实现亮点 |
| --- | --- |
| AI 集成 | DeepSeek API + 5 个封装函数（**2026-09-19 移除 `generateAIWorkbenchSummary`**）：合规检查 / 报告生成 / 工作台摘要 / 通用对话；用户自带 API Key，本地存储 |
| ~~实时协作（占位）~~ |  **2026-09-19 下线**（AI 板块移除）|
| 语音 / 视频 | `useLocalCamera` Hook 调用 `navigator.mediaDevices.getUserMedia`，封装 enable / disable / 错误处理 |
| 合规检测引擎 | 47 条规则 × 9 大类 × 30+ 部法规，纯函数引擎 `runSandboxCheck`，可被 Approval / Report / QA 复用 |
| 图表 / 可视化 | Recharts（AreaChart / LineChart / ReferenceLine）+ antd Charts + 自研 SVG 图谱 + 评分圆环 |
| 国际化（i18n） | i18next + react-i18next，启动期静态校验 zh-CN / en-US 结构对齐（key 不一致直接 console.error） |
| 状态管理 | Zustand（**2026-09-19 增 1 个**：10 → 11 个 store：user / contacts / notification / app / approvalDraft + accessAudit / 多 Agent 内置 store）|
| 路由 | React Router 7 + `createBrowserRouter` + 懒加载 + 旧路由自动重定向 · **2026-09-19**：移除 `/agent-hub` `/plugins`；4 个老兼容路由（`/chat /qa /agent /memory`）改跳 `/dashboard` |
| 权限系统（2026-09-19 升级） | `Role` / `Permission` / `MenuItem.group` 类型化；`usePermission` Hook + `<Can>` 组件包裹 |
| 快捷键 | Ctrl+K 全局搜索 / Ctrl+B 侧边栏 / `G+D/M/K` Vim 风格跳转 / `?` 帮助 · **2026-09-19**：`g q` 改跳 `/meeting`；移除 `ctrl+/` AI 助手 dead shortcut |
| Sidebar Logo（2026-09-19 调整） | logo 容器 40×40 → **48×48**；「睿枢」字号 20 → **18** + `lineHeight: 48px` 跟容器同高，垂直基线对齐 |
| 文档导出 | jsPDF（结构化 PDF）+ Markdown（`downloadMarkdown`）+ 复制到剪贴板 |
| 响应式设计 | 桌面端为主，部分组件支持 Row / Col 自适应 |
| Mock 策略（2026-09-19 清理） | 删除 `src/mock/index.ts` / `data.ts` / `data/knowledge.ts` 3 个 mock 文件（-504 行）；保留 `meetingDemo.ts` / `employees.ts` / `sandboxDemo.ts` 演示场景真实需要的数据。前端 mock 层（`services/*`）和真实接口契约分离 |

---

## PPT 推荐叙事节奏

1. **开场（30s）**：金融办公痛点 + "AI + 合规"双轮驱动
2. **Demo 章节**：
   - ① 工作台（效率可视化 + 通知跳转高亮）
   - ② **亮点 1：会议协同**（4 Agent 实时 + 会后报告 + 工单度量面板 + 会议片段抽屉）
   - ③ 亮点 2：合规沙箱（重头戏：47 规则 + 法规引用 + 高亮改写 + **批量扫描** + **合规回执**）
   - ④ **亮点 4：智能审批**（Sandbox → Approval 联动 + AI 预审）
   - ⑤ 研报 / 知识库（AI 自动生成）
3. **技术亮点章节**：AI 集成、合规引擎、可视化、国际化、快捷键、**权限系统结构化升级**、**Sidebar Logo 视觉对齐**
4. **结尾（30s）**：上线计划 + 后续规划
