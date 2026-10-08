# Dev Log（每日自动记录）

> 全栈开发记录，融合 `docs/` 与 `frontend/digital-horse/docs/delivery/` 两份 dev-log，按项目甘特图 5 阶段粗排。
> **项目工期**：2026-06-28 → 2026-10-10（105 天）。
> **5 个阶段**：项目启动与需求 / 技术预研与原型设计 / 系统开发与集成 / 测试优化与迭代 / 上线准备与总结。
> **团队**：小爱 / 小忍 / 小柒 / 小汉 / 小陆。
> 手动编辑请保留区段标记 `<!-- AUTO:ENTRY-START -->` / `<!-- AUTO:ENTRY-END -->`。

---

## 模块索引

| 模块 | 路径 | 职责 | 状态 |
|------|------|------|------|
| Auth | `app/features/auth/` | 注册/登录/JWT/当前用户 | ✅ v1 |
| RAG | `app/features/rag/` | 知识库/文档/解析/切分/索引代际/检索选择 | ✅ v1 |
| Chat | `app/features/chat/` | 普通聊天/RAG 聊天/引用绑定/拒答 | ✅ v1 |
| AI Gateway | `app/ai/` | 模型网关/路由/Embedding/诊断 | ✅ v1 |
| Compliance | `app/features/compliance/` + `app/sandbox/` | 沙箱/PII 脱敏/审计/规则/LLM Judge/Kill Switch | ✅ v1 |
| Blackboard | `app/features/blackboard/` | 4 Agent 共享黑板/Session/Event | ✅ v1 |
| Meeting | `app/features/meeting/` | 会议域 + Agent 编排 + 事件总线 + WebSocket | ✅ v1 |
| Agent | `app/features/agent/` | Meeting Agent 数据模型 + BlackboardService | ✅ v1 |
| Approval | `app/features/approval/` | 审批工单 + 操作流水 | ✅ v1 |
| Dashboard | `app/features/dashboard/` | 工作台聚合 stats | ✅ v1 |
| IM | `app/features/im/` | 即时通讯 | ✅ v1 |
| Notification | `app/features/notification/` | 通知中心 | ✅ v1 |
| Organization / Office / Decision | `app/features/{organization,office,decision}/` | 多租户 / 模板生成 / 防篡改决策 | ✅ v1 |
| 部署 | `Dockerfile` + `docker-compose.deploy.yml` | 独立部署栈 + 资源隔离 | ✅ v1 |
| 前端 i18n | `src/i18n/` + `scripts/check-i18n.js` | 中英双语 + 启动期校验 | ✅ v1 |
| 前端 4 Agent 会议 | `src/services/multiAgent*.ts` + `src/components/Meeting/Agent*` | 4 Agent 协作 + 共享黑板 | ✅ v1 |
| 前端会后业务 | `src/services/postMeetingService.ts` + `src/components/Meeting/PostMeeting/` | 自动派单 + PDF 报告导出 | ✅ v1 |
| 前端工作台 | `src/pages/Dashboard/` | 入口矩阵 + Top3 + 一屏概览 | ✅ v1 |
| 行业资讯 | `src/pages/IndustryNews/` | 详情 Drawer + 发起合规审查 | ✅ v1 |
| 外部推送 | `src/services/notificationDispatchService.ts` | 钉钉/企微/邮件 mock | ✅ v1 |
| 工程化 | `.husky/pre-commit` + `scripts/{auto-log,check-i18n,rewrite-iszh}.cjs` | commit 自动日志 + i18n 校验 | ✅ v1 |

---

<!-- AUTO:ENTRY-START -->

## 阶段一：项目启动与需求（2026-06-28 → 2026-07-16）

> **甘特图条目**：1~8（团队组建 / 行业调研 / 未来说明书 / 核心功能确定 / 技术方案 / 子体系方案 / Gitee 仓库 / 开发环境配置）
> **团队**：小爱（产品）/ 小忍 / 小柒（技术）/ 小汉 / 小陆（开发负责人）
> **本阶段交付**：项目方向锁定 + 技术方案成型 + 仓库初始化

### 1.1 团队组建与分工确立（6.28 — 6.30）  @小爱

- 5 人团队（产品 1 / 后端 2 / 前端 2）正式成立
- 分工：小爱（产品）/ 小忍（后端-合规 + 黑板）/ 小柒（后端-RAG + AI）/ 小汉（前端-基建 + 会议）/ 小陆（前端-业务 + 演示）
- 立项决策：项目代号"睿枢"（金融智能办公中枢）

### 1.2 行业调研与痛点搜集（6.28 — 7.3）  @全体

- 调研对象：5 类金融机构（银行 / 券商 / 基金 / 保险 / 信托）的智能办公现状
- 主要痛点：
  - 合规风险隐藏在日常文档（合同 / 邮件 / 纪要）
  - 会议多但决策难追溯
  - 跨部门信息孤岛（IM / 邮件 / 工单分散）
  - 监管情报响应滞后
- 形成《行业调研报告》作为需求输入

### 1.3 梳理输出「未来说明书」（6.28 — 7.3）  @小爱

- 文档：`docs/users/yuanwei-shuomingshu.md`（用户未来说明书）
- 三类目标用户画像：
  - 金融业务人员（高频用文档 + 会议）
  - 合规专员（高频用沙箱 + 审计）
  - IT/管理员（高频用权限 + 系统配置）
- 用例 38 条，覆盖 5 大模块

### 1.4 确定系统核心功能（7.6 — 7.7）  @小爱 / 小忍 / 小陆

- 5 大模块定稿：
  1. **金融办公域** — 文档 / 邮件 / 模板生成
  2. **AI 智能中心** — 问答 / 多 Agent 协作 / 知识库
  3. **会议与决策** — 会议纪要 / 黑板协作 / 决策智能
  4. **合规与审计** — 沙箱 / PII 脱敏 / Kill Switch
  5. **组织与权限** — 多租户隔离 / RBAC

### 1.5 技术方案讨论（7.9）  @小柒

- 后端栈：FastAPI + SQLAlchemy 2 + Alembic + MySQL 8 + Qdrant
- 前端栈：React 18 + Vite + antd 5 + Zustand + i18next
- AI 栈：百炼 Embedding + Qwen/DeepSeek/Doubao 多 Provider
- 部署栈：Docker Compose（隔离部署栈 vs 开发栈）

### 1.6 子体系方案设计（7.10 — 7.12）  @小爱 / 小忍 / 小陆

- **合规沙箱子体系**（小忍）：4 层防御（Kill Switch / 风险词 / PII / LLM Judge）
- **RAG 子体系**（小柒）：3 阶段（解析持久化 → 索引代际 → 检索调优）
- **多 Agent 会议子体系**（小汉）：Blackboard 模式 + 打字机流式输出
- 方案评审通过 → 进入预研阶段

### 1.7 初始化 Gitee 代码库（7.13）  @小柒

- 仓库 `Apexis/financial-office-platform` 创建
- 目录约定：
  - `app/` — 后端（FastAPI + features/）
  - `frontend/digital-horse/` — 前端（独立 Git 仓库）
  - `docs/` — 后端文档 + `docs/delivery/` 上交材料
  - `evals/` — RAG 评测
  - `tools/` + `scripts/` — 运维 / 演示 / 评测脚本

### 1.8 配置文件与开发环境（7.14 — 7.16）  @小柒 / 小汉

- 后端 `.env.example`：DATABASE / QDRANT / AI_PROVIDERS / SANDBOX_* 全字段
- 前端 `.env.example`：API_BASE_URL / VITE_WS_URL
- `pyproject.toml` + `requirements*.txt`：锁 Python 3.12 + FastAPI + SQLAlchemy 2
- 前端 `package.json`：Vite 5 + React 18 + antd 5 + Zustand + i18next
- `.gitignore` + `.dockerignore`：忽略 `__pycache__` / `node_modules` / `.env` / `*.bak.*`

---

## 阶段二：技术预研与原型设计（2026-07-17 → 2026-08-13）

> **甘特图条目**：9~21（13 张型表）
> **本阶段交付**：数据库 schema 雏形 + 后端基线代码 + 前端路由 + i18n 启动期校验 + 上交材料归档体系
> **关键决策**：项目从 7-17 开始进入正式开发，所有迁移文件日期从此日计起

### 2.1 数据库迁移 001~004 — 用户 / 知识库 / 文档 / 聊天（7-17 → 7-22）  @小柒

- **触及文件**: 4 个新迁移 + `app/features/auth/` + `app/features/rag/` + `app/features/chat/` 初始代码
- **提交状态**: 无独立 Git 提交（基线 `b70c6df` 之前未纳入版本控制），日期为迁移文件 `Create Date`

#### 1. 用户与认证基础（迁移 `20260716_001`）

- `alembic/versions/20260716_001_create_users.py`（新）— `users` 表：username / email / full_name / password_hash / is_active / is_superuser；username / email 唯一索引
- 后续 `app/features/auth/` 模块、JWT 流程均依赖此表

#### 2. 知识库 + 文档初始结构（迁移 `20260717_002`）

- `alembic/versions/20260717_002_create_rag_tables.py`（新）：
  - `knowledge_bases` / `knowledge_documents` + 初版 `document_chunks`
  - 用户 / 知识库 / 文档外键 + 常用索引
- 后续在 003 迁移删除初版切片表

#### 3. 解析结果先行持久化（迁移 `20260721_003`）

- `alembic/versions/20260721_003_simplify_rag_document_parsing.py`（新）：
  - 删除初版切片表
  - 文档表加 `parsed_text` / `page_count` / `parsed_char_count`；移除 `chunk_count`
- 配套：`app/integrations/document_parser.py` / `app/features/rag/service.py`

#### 4. 聊天会话与消息持久化（迁移 `20260722_004`）

- `alembic/versions/20260722_004_create_chat_tables.py`（新）：
  - `chat_conversations` / `chat_messages`
  - 消息存 role / mode / content / JSON `citations`
- 配套：`app/features/chat/{models,schemas,service,router}.py`

#### 5. 关键数字

```
迁移版本: 4（001~004）
新增表: 6（users / knowledge_bases / knowledge_documents / document_chunks→删除 / chat_conversations / chat_messages）
最终 ORM 表: 5（初版 document_chunks 已被 003 迁移替代）
```

#### 6. 验证与边界

- ⚠ 002 迁移的初版切片结构要求立即存在 Qdrant Point ID，不适合"先解析后索引"演进，已在 003 移除
- ⚠ 当时 `citations` 单一概念，评测后（阶段四）拆为 `retrieved_contexts` / `used_citations`
- ✅ 当前 ORM 字段与原始 002 迁移不一致，应以**完整迁移链 + 现 ORM 为准**

### 2.2 RAG 迁移 005~006 — 持久化 chunk + 索引状态（8.1）  @小柒

- **触及文件**: 2 个新迁移 + `app/features/rag/{chunker,models,service}.py` + 关联测试

#### 1. 文档片段持久化（迁移 `20260914_005`）

- `alembic/versions/20260914_005_create_document_chunks.py`（新）：
  - `document_chunks` 表：owner_id / knowledge_base_id / document_id / chunk_index / content / page_number / metadata / content_sha256 / embedding_id(可空)
  - 重建结构（替代被 003 迁移删除的初版切片表）

#### 2. 文档索引状态（迁移 `20260914_006`）

- `alembic/versions/20260914_006_add_document_index_status.py`（新）：
  - 文档加 `index_status` / `index_error` / `indexed_at` / `index_collection`
  - 默认 `pending`，区别"解析成功"和"可检索"

#### 3. 切分器

- `app/features/rag/chunker.py` — 长度 1000 / 重叠 150

#### 4. 验收

- ✅ 备份本地库后升级到 006，核验字段
- ✅ TXT 上传 → 解析 → chunk 入库 → 归属与哈希验证

### 2.3 RAG 迁移 007 — 索引代际 + 原子构建/发布（8.5）  @小柒

- **触及文件**: 1 个新迁移 + `app/features/rag/{index_build,index_publish,indexing}.py` + `app/features/chat/rag_retriever.py` + `app/integrations/qdrant_client.py` + 版本化索引测试

#### 1. 索引代际（迁移 `20260917_007`）

- `alembic/versions/20260917_007_add_index_generations.py`（新）：
  - 文档加 `active_generation` / `building_generation`
  - 区分"活动版本" vs "构建中版本"

#### 2. 版本化 Point ID

- `app/features/rag/index_build.py` — UUID5 派生确定性 Point ID（同一 chunk 重算永远同 ID）
- 配套 `app/integrations/qdrant_client.py` + `tests/test_rag_point_ids.py`

#### 3. 原子构建 / 原子发布

- `app/features/rag/index_build.py` — 构建资格原子获取 + 失败条件收尾
- `app/features/rag/index_publish.py` — 发布事务（Qdrant 写入 + MySQL `active_generation` 切换同事务）
- Qdrant Payload 保存 `generation` / `content` / `sha256` / `page_number`

#### 4. 检索有效性校验

- `app/features/chat/rag_retriever.py` — 检索只接受：
  - `active_generation` 一致
  - 身份匹配（owner / kb / doc）
  - Point ID 与 `content_sha256` 校验通过
- 配套 `tests/test_active_index_filter.py` + `test_active_index_retrieval.py` + `test_versioned_indexing.py`

#### 5. 关键决策

| 决策 | 理由 |
|---|---|
| UUID5 派生 Point ID | 同 chunk 重算稳定，避免重复 |
| 构建 / 发布拆事务 | Qdrant 部分写入后不污染 active |
| 失败不删旧向量 | 旧索引仍可读，不雪崩 |
| 检索三层校验 | 防止旧向量 + 新正文错配 |

#### 6. 验收

- ✅ 隔离数据库 + Mock 专项测试覆盖构建 / 发布 / 失败 / 检索可见性
- ✅ 真实文档索引与问答链路成功
- ⚠ SQLite ≠ MySQL 并发压力验收
- ⚠ 旧版本向量清理 + 崩溃自动解锁仍是边界

### 2.4 真实集成联调 — Embedding + OCR + Qdrant（8.6 → 8.13）  @小柒

- **触及文件**: `app/ai/embeddings/` + `app/ai/exceptions.py` + `app/integrations/qdrant_client.py` + `document_parser.py` + `ocr.py` + 上传文件名处理 + 测试 + `.env.example`

#### 1. 真实百炼 Embedding

- `app/ai/embeddings/{base,schemas,bailian,service}.py`：
  - 百炼错误结构化（错误码 + trace_id）
  - 安全网络诊断 + 可配置 `trust_env`
  - 输出 1024 维向量

#### 2. Qdrant 真实集成

- `app/integrations/qdrant_client.py`：
  - Collection 维度 / 距离校验
  - upsert 完成状态返回
  - 服务不可达返回明确 502

#### 3. 扫描 PDF OCR

- `app/integrations/ocr.py` + `document_parser.py`：
  - PyMuPDF 逐页判断原生文本是否足够
  - 不足页面 → Tesseract OCR 回退（`chi_sim+eng`）
  - 页级超时 + 并发限制
  - 混合 PDF 按"实际需 OCR 页数"计限额（不再按总页数拒绝）
- 配套 `tests/test_ocr.py`

#### 4. 上传文件名处理

- `app/integrations/file_storage.py` — RFC 2047 + `filename*` 中文文件名支持
- 配套 `tests/test_upload_filenames.py`

#### 5. 关键决策

| 决策 | 理由 |
|---|---|
| 错误结构化（错误码 + trace_id） | 便于排障百炼连接 / 代理问题 |
| 混合 PDF 按需 OCR 页数计费 | 31 页混合 PDF 不再被总页数 30 误拒 |
| 中文文件名 RFC 2047 兼容 | 修复中文被误判为无后缀 bug |

#### 6. 踩坑记录

- 百炼连接 / 代理问题（HTTP 400 诊断信息不足 → 加结构化错误码）
- Qdrant 未启动或 502 → 启动期 healthcheck 修复见阶段五
- 扫描 PDF 无文本层 → PyMuPDF + Tesseract 双轨
- 31 页混合 PDF 误按总页数拒 → 按需 OCR 改写

### 2.5 前端：i18n 启动期校验 + 上交材料归档体系（8.6 → 8.13）  @小汉 / @小陆

- **触及文件**: 19 个（+3929 / -0）

#### 1. 上交材料归档体系

- `docs/delivery/` 目录（含 `dev-log.md` / `team.md` / `api-gap-tracker.md` / `scenario-analysis.md` / `metrics.md` / `README.md` 6 个文件）
- `scripts/auto-log.cjs`（226 行）— commit 时自动抓 staged 文件 + diff 行数 + 按类别分组 + 抽取函数/API/i18n key + 自动关联材料条目，写入 dev-log.md AUTO 区段
- `scripts/scan-qmark.cjs`（23 行）— 占位文本扫描工具
- 修改：`.husky/pre-commit`（在 i18n 检查之前先跑 auto-log）

#### 2. 设计目标

- 让"上交材料"中第 8 项"开发记录 / 团队分工 / 补充材料"完全自动生成，不再依赖手动整理
- 责任人通过 `git config user.name` 自动识别，team.md 提供 Git Config Name → 真实姓名映射
- 每个 commit 自动得到一条 entry，包含：日期、责任人、触及文件清单、+/- 行数、按类别分组、自动抽取的 API 路径 / i18n key / 导出函数 / 接口签名、自动关联到的材料条目
- 手动补的部分仅剩"决策理由 / 踩坑总结"，模板已在 dev-log.md 给出

#### 3. i18n 第二轮根治（切不到英文 + 中英混杂）

**改动概览**
- 修改：`src/components/Layout/Header.tsx`（3 处 `isZh ? 'X' : 'Y'` 改走 `t()`，`handleLanguageChange('en')` 改为 `'en-US'` —— **这就是切不到英文的根因**）
- 修改：`src/components/Layout/SimpleLayout.tsx`（同样 'en' → 'en-US'，5 处 iszh 三元 → `t()`）
- 重写：`src/components/Layout/ProfileDrawer.tsx`（全文 30+ 处 `isZh ? '中文' : 'English'` 改走 `t()`，并加入 `useTranslation` hook 让组件订阅语言变化）
- 重写：`src/components/Layout/Topbar.tsx`（删除所有 `|| '中文 fallback'`，所有硬编码英文占位改走 `t()`）
- 重写：`src/pages/Dashboard/index.tsx`（整页 40+ 处硬编码英文（`Good morning`/`AI Assistant`/`Schedule Meeting`/`Today's Meetings`/`Smart Q&A`/`Smart Approval`/`Report Generation`/`Industry News`/`Mark as done` 等）全部改走 `t()`）
- 重写：`src/pages/Login/index.tsx`（修复源码 bug：`isZh ? 登录成功` —— `登录成功` 没引号被当成变量；现改走 `t('login.success')`）
- 重写：`src/pages/Meeting/MeetingDetail.tsx`（mockZhTranscript / mockZhSummary 模板字符串中的 `??` 占位全部替换为正常中文，`'TBD'` 替换为真实待办描述）
- 新增：`scripts/rewrite-iszh.cjs`（自动扫描 src/**/*.tsx 中 `isZh ? '中文' : 'English'` 模式，自动提取为 `auto.N` key 加入两个 JSON，自动替换源码为 `t('auto.N')`，107 处自动改写）
- 增强：`scripts/check-i18n.js` 新增 JSON 占位扫描（防止 `auto.N` key 误带占位文本）
- 补全：67 个命名 key（`login.success` / `settings.switchRole` / `profile.*` / `dashboard.*` 等）
- 清理：`*.bak.rewrite` 临时备份（9 个）、`*.gbk.bak` 历史备份（6 个）

**现象**
- 用户截图显示：Dashboard 页面 `Good evening` + `admin` + `Online` 全英文，但其它位置（如 `下午好` 来自 Dashboard 部分 AIWorkbench）显示中文
- 头部 Header / Topbar `Good evening` `September 10, 2026` 永远英文，切语言不响应
- "切换语言" 按钮形同虚设，点击后**仍然显示英文**（核心 bug：传了 `'en'` 不是 `'en-US'`，导致 i18n 找不到对应语言回落到 `'zh-CN'`）
- 部分页面（如 Knowledge Base）菜单中文、右侧内容英文，**语言状态不一致**

**根因（7 个并存问题）**
1. **`'en'` vs `'en-US'` 类型不匹配（切不到英文的元凶）**：Header.tsx L29 / SimpleLayout.tsx L39 / L85 调用 `changeLanguage('en')`，但 `i18n/index.ts` 只声明了 `SUPPORTED_LANGUAGES = ['zh-CN', 'en-US']`；`'en'` 不在白名单被 console.error 拒绝 + 没 fallback，i18n 仍然停留在 `zh-CN` —— 但其它 React 组件**根本没订阅 hook**，所以看到的是上一语言残留
2. **组件未订阅 hook**：ProfileDrawer / Sidebar / Topbar 部分代码虽然 import 了 i18n 但没调 `useTranslation()`，不会响应 `changeLanguage` 触发 React 重渲染
3. **`isZh ? 'A' : 'B'` 三元散落 9 个文件 100+ 处**（ChatDrawer / MeetingRoom / Contacts / Profile / MeetingList 等），**根本不会响应语言切换**
4. **Dashboard 整页硬编码英文**：从 `getGreeting() { return 'Good morning' }` 到 `Today's Meetings` `Smart Q&A` `Smart Approval` 等所有文本都没走 `t()`，切语言永远英文
5. **源码 bug**：`isZh ? 登录成功 : 'Login Success'` —— `登录成功` 没加引号被当成变量，运行时直接报错
6. **MeetingDetail mock 数据中 `??` 占位、TBD 占位**：transcript/summary 整段中文模板字符串被破坏，4 个提示语（"上传中"/"AI 正在识别"/"转写中"/"AI 正在整理"）也是 `??` 占位
7. **i18n runtime 不严**：原 `check-i18n.js` 不扫 JSON 内部的占位，导致 `auto.N` key 可能带 `TBD`/`??`/`'??????'`

**修复**
1. 全量替换 `changeLanguage('en')` → `changeLanguage('en-US')`，加 TypeScript 类型约束 `'zh-CN' | 'en-US'`
2. 给 ProfileDrawer / Sidebar / Header / SimpleLayout 全部加 `const { t } = useTranslation()`
3. 写 `scripts/rewrite-iszh.cjs`：正则匹配 `isZh ? '中文' : 'English'`，自动提取 pair 为 `auto.N` key，加入 zh-CN.json / en-US.json，替换源码为 `t('auto.N')`，共 107 处
4. Dashboard 全文重写为 `t()` 形式 + useTranslation hook
5. 修 Login.tsx 源码 bug（无引号变量）
6. 写 Node 脚本把 MeetingDetail 模板字符串中的 `??` 占位 → 真实中文，TBD → 真实待办描述
7. 升级 `check-i18n.js` 增加 JSON 占位扫描，防止 auto key 误带占位

**工程护栏（已落地）**
- `scripts/rewrite-iszh.cjs` 可重复运行，每次新增 `isZh ?` 三元会再次自动改写
- `scripts/check-i18n.js` 5 项校验：JSON BOM / key 对齐 / 源码占位 / JSON 占位 / 同语种 bug
- `npm run i18n:check` 挂在 pre-commit hook

**校验结果（本次修复后）**
- zh-CN 与 en-US key 结构完全对齐：**719 个 key**
- 源码中无占位问号 / TBD / ?? 字面量
- JSON 中无占位文本残留
- 无 isZh 三元两边同语种硬编码 bug

**关联上交材料**
- 材料 2（系统设计 - i18n 架构升级）
- 材料 3（使用说明书 - 多语言支持）

#### 4. i18n 第三轮根治（占位问号 + BOM + Login/MeetingDetail 整段还原）

**改动概览**
- 新增/修改：`src/i18n/index.ts`（启动期静态校验 + 严格类型 + `appText()` helper）
- 新增：`scripts/check-i18n.js`（4 项静态校验：JSON 结构对齐 / BOM / 占位文本 / `isZh` 同语种 bug）
- 新增：`scripts/fix-placeholders.cjs` + `scripts/fix-meeting-detail.cjs`（一次性清理脚本）
- 修改：`src/i18n/locales/zh-CN.json`、`src/i18n/locales/en-US.json`（去除 BOM + 新增 login.* 键）
- 修改：`src/pages/Login/index.tsx`（3 处 `'????'` → `'登录成功'` / `'演示部门'`，feature tags 改走 `t()`）
- 修改：`src/pages/Meeting/MeetingDetail.tsx`（21 处 `'???' / '?? / '??` 占位字面量 → 真实中文）
- 修改：`.husky/pre-commit`（老 i18n 检查 → auto-log → i18n:check 双钩子）
- 新增：`package.json` script `i18n:fix:placeholders`
- 新增：`docs/i18n-guidelines.md`（6 条硬性规则）

**现象**
- 用户截图显示页面出现大量 `????`、`Demo Dept`、`AI Assistant` 等中英混杂
- 切语言按钮形同虚设，部分页面空白

**根因（三大事故并发）**
1. **UTF-8 BOM 事故**：`zh-CN.json` 与 `en-US.json` 头部含 `EF BB BF` → `JSON.parse` 抛 `SyntaxError` → 整个 i18n 包加载失败，所有 `t('key')` 返回空，UI 显示 fallback 或空白。**这是"语言系统崩溃"的元凶**。
2. **`'????'` 占位字面量**：源码字节就是 4 个 ASCII `?`，不是渲染层编码问题，是写代码时编辑器出问题留下的。Login 页有 3 处，MeetingDetail.tsx 有 49+ 处。
3. **`isZh ? 'A' : 'A'` 同语种硬编码**：Login 页 feature tags 两边都写 `'AI Assistant'`，切换语言毫无反应。

**修复**
1. Node 脚本 strip BOM（写入时缺 BOM）
2. Node 脚本批量替换 `'????'` → 真实中文（`登录成功` / `演示部门`）
3. feature tags 改走 `t('login.featureAi')`，两个 JSON 同步加 key
4. MeetingDetail.tsx 整文件逐段还原中文 mock（议程/纪要/摘要/步骤提示 4 处模板字符串）

**工程护栏（防回潮）**
- `src/i18n/index.ts` 启动期 `throw new Error()`，两个 JSON key 集合不一致时直接拒绝运行
- `parseMissingKeyHandler` 缺 key 时 `console.warn` + 返回 key 本身，便于发现
- `fallbackLng: false` 不允许 fallback 掩盖缺失
- `scripts/check-i18n.js` 4 项检查：结构对齐、BOM、`??` 占位、`isZh` 同语种 bug
- `npm run i18n:check` 挂在 pre-commit hook
- `docs/i18n-guidelines.md` 6 条硬性规则文档化

**关联上交材料**
- 材料 2（系统设计 - i18n 架构）
- 材料 3（产品原型说明 - 多语言支持）
- 材料 8（开发记录）

#### 5. 工程化输出（`scripts/`）

- `scripts/auto-log.cjs`（226）— commit 时自动抓 staged 文件 + diff 行数 + 按类别分组 + 抽取函数/API/i18n key
- `scripts/check-i18n.js`（148）— 5 项校验
- `scripts/fix-meeting-detail.cjs`（55）— 一次性清理 MeetingDetail 占位
- `scripts/fix-placeholders.cjs`（54）— 一次性清理 `????` 占位
- `scripts/scan-qmark.cjs`（23）— 占位文本扫描
- `scripts/rewrite-iszh.cjs` — `isZh ? '中文' : 'English'` 自动改写

#### 6. 自动检测到的改动摘要

- **导出常量**（5）：`SUPPORTED_LANGUAGES` / `changeLanguage` / `getCurrentLanguage` / `isZh` / `appText`
- **导出接口**（1）：`SupportedLanguage`
- **i18n key**：`login.featureAi/Bi/Mr/Sl` + `meeting.transcribing` + `meeting.generatingSummary` 等

#### 7. 关联上交材料

- 材料 2（系统设计 - i18n 架构）；材料 3（使用说明书 - 多语言）；材料 8（开发记录 / 团队分工）

---

## 阶段三：系统开发与集成（2026-08-14 → 2026-09-10）

> **甘特图条目**：22~36（15 张型表）
> **本阶段交付**：前端路由 + 4 Agent 会议 + 会后业务 + 检索调优 + RAG 基线 + Docker 部署栈
> **关键产出**：亮点 1（4 Agent 协作会议）完整实现 + 检索系统上线

### 3.1 前端路由整合 — AI 板块融合 / Sidebar 收敛（8.20）  @小陆

> **本次合并**：前端 09-17 AI 板块融合与 09-19 整合下线的最终态来回出现，留下「最终态」与「问题修复」两类。

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

#### 5. AI 板块 i18n 改造详情

| 命名空间 | 增补 key 数 | 关键内容 |
| --- | --- | --- |
| `agent.*` | +27 | `statusOnline/Busy/Offline`、`pause/retry`、`deleteConfirmContent` 模板插值、`agentMeeting/Doc/Reg/Qa/Data` Agent 名称、`taskMinutes/Compliance/Regulation/Report/Schedule` 任务名 |
| `qa.*` | +33 | `complianceResponseTitle/Framework/RiskControl/Monitoring`、`meetingMinutesSteps/Setup/Processing/Output`、`aiAssistantTitle/Desc/Greeting`、`quickActions/suggestedQuestions`、`draggerText/Hint`、`uploadModalTitle/Confirm`、`filesAdded/fileAdded` 模板插值 |
| `memory.*` | +47 | `archived/archivedCount`、`batchPin/Archive/Export` Tip + Title + Confirm + Ok、`compressLogLine1-5/auditLogLine1-5` 模板插值（解决了占位字符串无法传参的历史问题）、`adminOnly/allDeptSessions/deptTech/Compliance/Market`、`csvHeader`、`complianceAuditWarning` |
| `agentHub.*` | +11 | `title/mergedBadge/loading`、`tabChat/Qa/Agent/Memory` + 各自 `Desc`、`mergeTipsTitle/Desc` |

总计 +118 个 i18n key 同步双语。

#### 6. 源码改造要点

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

#### 7. 验证

```bash
node scripts/check-i18n.js
#  zh-CN 与 en-US key 结构完全对齐：1018 个 key
#  源码中无占位问号 / TBD / ?? 字面量
#  JSON 中无占位文本残留
#  无 isZh 三元两边同语种硬编码 bug

npx tsc --noEmit -p tsconfig.json
# 通过（除 tsconfig baseUrl deprecation warning，与本次改动无关）
```

#### 8. 关联上交材料

- 材料 2（系统设计 - 路由整合）
- 材料 3（使用说明书 - AI 智能中心）
- commit `e4cd3d8 重构：路由整合 19→12，去重消除冗余入口`（原 commit，无日志）
- 本轮 commit（待提交）

### 3.2 通知中心 i18n nesting 修复 + 会议列表响应式 + UI 改版（8.22）  @小陆

- **触及文件**: 10+ 个（+2500 / -1200）

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

#### 上交材料同步

-  dev-log.md（本段）
-  feature-list.md：补充"通知中心 v2"特性条目
-  commit hook：`fix(notifications): i18n key nested error + ScoreRing overflow + Notifications UI overhaul`，61 文件 / +2511 -1202

### 3.3 亮点 1：4 Agent 协作会议 + 会前预演（8.25）  @小汉

- **触及文件**: 12 个（+3901 / -0）

#### 1. 新增服务层（3）

- `src/services/multiAgentBus.ts`（129）— Agent EventBus（订阅/发布 + 200 条历史快照）
- `src/services/multiAgentOrchestrator.ts`（509）— 4 Agent 编排器 + Blackboard 共享黑板
- `src/services/useMultiAgent.ts`（63）— React Hooks 适配层（`useBlackboard` / `useAgentRunState` / `useAllAgentRunStates`）

#### 2. 新增 Meeting 组件（4）

- `src/components/Meeting/AgentCard.tsx`（177）— 单 Agent 卡片（打字机光标 + 进度条 + shimmer）
- `src/components/Meeting/AgentPanel.css`（96）— blink / flow-line / shimmer 动画
- `src/components/Meeting/AgentPanel.tsx`（239）— 多 Agent 协作主面板（输入/模拟/关闭会议）
- `src/components/Meeting/Blackboard.tsx`（235）— 共享黑板（决策/待办/风险/事实）

#### 3. 新增页面（1）

- `src/pages/Meeting/MeetingRehearsal.tsx`（232）— 会前预演页面（4 Agent 模拟 + 就绪度圆环）

#### 4. 修改（4）

- `src/router.tsx`（+10 / -0）— 注册 `/meeting-rehearsal/:id` 路由
- `src/pages/Meeting/MeetingList.tsx`（+10 / -0）— 未开始会议卡片增加"会前预演"按钮
- `src/pages/Meeting/MeetingRoom.tsx`（+40 / -0）— 默认渲染多 Agent 面板；发送消息自动 fanout 4 Agent
- `src/pages/Profile.tsx`（+3 / -0）— 顺手修复原有 `t is not defined` bug（`getMockUserData` 在 hook 外用 t）

#### 5. 核心实现思路

- 4 个 Agent 角色定义在 `multiAgentBus.ts`：`moderator` / `notetaker` / `decision` / `action`，各自负责节奏控制/转写/决策点/待办派发
- 共享 Blackboard（黑板模式）替代链式调用，符合真实多 Agent 系统设计
- 打字机流式输出 + EventBus 解耦：后端真多 Agent 上线后只需替换 `dispatch()` 内部为 WebSocket，**前端组件代码 0 改动**
- `useSyncExternalStore` 替代 zustand，照样高性能响应式

#### 6. 设计决策

1. **Blackboard 模式而非链式调用**：4 个 Agent 共享一份 Blackboard（事实/决策/待办/风险/话题/摘要），每个 Agent 既可读又可写。这比 A→B→C→D 流水线更接近真实多 Agent 系统设计，对应 Material 2 中的"去中心化协作"架构图。
2. **前端 EventBus 模拟，零侵入式预留后端对接**：`multiAgentBus.dispatch()` 目前是前端事件总线，后端多 Agent WebSocket 服务上线后只需替换该方法内部为 `ws.send()`，所有组件代码 0 改动。这是关键的"前后端解耦"决策。
3. **`useSyncExternalStore` 而非 zustand**：避免引入新依赖，符合团队"轻量级状态管理"原则；性能也完全够用（Blackboard 更新频率 < 1Hz）。
4. **打字机流式输出而非一次性渲染**：跟现有 `Chat.tsx` UX 一致，4 Agent 同时"打字"的视觉冲击也是亮点 1 的关键演示点。
5. **会前预演独立页面 `/meeting-rehearsal/:id`**：作为独立入口而不是 MeetingRoom 的子页面，方便演示和截图（评委一眼看出"这是预演 vs 正式会议"的差异化设计）。

#### 7. 现象 / 决策记录

- **Profile.tsx 原有 bug**：发现 `getMockUserData` 在 hook 外部用 `t`，访问 `/profile` 会白屏。**顺手修复**（不算亮点 1 范畴，但阻塞路由），改成接收 `t` 参数。
- **PowerShell 中文路径下 `&&` 不识别**：第一次启动 dev server 报错，原因是 `数字马力` 中文目录名 + `&&` 分隔符在 pwsh 中解析异常。改成 `;` 解决。
- **`*.bak.*` 工作区残留**：12 个历史备份文件被 `git add .` 带入，已 unstage + 加 `.gitignore`。

#### 8. 工程护栏

- `multiAgentBus` 保留 200 条历史快照，方便后续做"会议回放"
- Blackboard 数据通过 `useSyncExternalStore` 自动响应，符合 React 18 concurrent 模式
- 4 Agent 的"行为剧本"集中在 `multiAgentOrchestrator.ts`，后端对接时一个文件搞定

#### 9. 关联上交材料

- 材料 2（系统设计 - 多 Agent 架构）
- 材料 4（演示视频重点场景 1 - 会前预演 + 会中 4 Agent 协作）
- 材料 8（开发记录）

### 3.4 亮点 1 升级：会后自动派单 + 报告导出（8.27）  @小汉

- **触及文件**: 23 个（+2577 / -19）

#### 1. 新增服务层（3）

- `src/services/meetingApiContract.ts`（198）— 前后端契约类型定义（纯类型）
- `src/services/postMeetingService.ts`（308）— 会后业务 mock 层（dispatchActions / generateReport / listMeetingActions / closeOutAction / closeMeeting）
- `src/services/pdfExportService.ts`（219）— jsPDF 封装（含品牌标识 + 分页 + 页脚）

#### 2. 新增 PostMeeting 组件（5）

- `src/components/Meeting/PostMeeting/ReportSummary.tsx`（145）— 5 段报告渲染（摘要/决策/风险/议题）
- `src/components/Meeting/PostMeeting/ActionCard.tsx`（132）— 单工单卡片（含状态机 + 关闭操作）
- `src/components/Meeting/PostMeeting/ActionDispatchPanel.tsx`（178）— 派单面板（含 4 项统计 + 失败告警）
- `src/components/Meeting/PostMeeting/ExportToolbar.tsx`（119）— PDF/MD 导出工具栏
- `src/components/Meeting/PostMeeting/PostMeetingDrawer.tsx`（198）— Drawer 总容器（3 Tab：报告/派单/导出）

#### 3. 新增页面（1）

- `src/pages/Meeting/PostMeetingReport.tsx`（212）— 独立报告页 `/meeting/:id/report`

#### 4. 修改（7）

- `src/services/multiAgentOrchestrator.ts`（+22 / -4）— `runClosingSummary` 联动 `postMeetingService.closeMeeting()` 自动派单
- `src/router.tsx`（+8 / -0）— 注册 `/meeting/:id/report` 路由
- `src/pages/Meeting/MeetingRoom.tsx`（+18 / -4）— `handleEndMeeting` 改为先 `runClosingSummary` → 弹 PostMeetingDrawer
- `src/pages/Meeting/MeetingList.tsx`（+8 / -2）— 已结束会议卡片加"查看报告"按钮
- `src/i18n/locales/zh-CN.json`（+89 / -0）— `postMeeting.*` 26 个 key
- `src/i18n/locales/en-US.json`（+89 / -0）— `postMeeting.*` 26 个 key
- `package.json`（+1 / -0）— 加 `jspdf` 依赖

#### 5. 文档同步（6）

- `docs/api-contract-frontend.md`（+148）— 附录 B：5 个新增接口契约
- `docs/delivery/README.md`（+18）— 亮点 1 进度看板
- `docs/delivery/api-gap-tracker.md`（+9）— 5 个接口补齐记录
- `docs/delivery/metrics.md`（+22）— 亮点 1 专项指标 +10 个
- `docs/delivery/scenario-analysis.md`（+52）— 场景 2 升级为端到端闭环
- `docs/delivery/dev-log.md`（+72）— 决策段"亮点 1 升级"

#### 6. 核心实现思路

- **前后端严格分离**：UI 组件只调 `xxxService.xxx()`，不写 setTimeout/axios。`meetingApiContract.ts` 是契约类型，`postMeetingService.ts` 是 mock 业务层。后端上线后只换 service 内部实现，UI 0 改动。
- **5 个 service 函数体内都标了"真实对接时应该写什么 axios 代码"**，方便后端同学上手。
- **Drawer + 独立报告页 双入口**：Drawer 适合"会后立刻看一眼"，独立报告页适合"评委演示时全屏展示"。
- **派单 5% 失败率**：模拟真实场景"个别指派人不在组织架构中"的情况，让评委看到失败处理逻辑。
- **Blackboard 单例复用**：PostMeetingReport 页面打开时直接从 `blackboardStore.get()` 拿数据，0 网络请求，500ms 加载完。
- **jsPDF 而不是 html2canvas**：PDF 是结构化报告（标题/表格/列表），不需要复杂排版；jsPDF 文本 API 足够；体积小（19 个包）。

#### 7. 设计决策

1. **前后端严格分离**：UI 组件只调 `xxxService.xxx()`，绝不写 `setTimeout` / `axios`。`meetingApiContract.ts` 只定义类型，组件不知后端存在。后端上线时只需替换 service 内部 `await delay(800)` 为 `axios.post(...)`，**UI 0 改动**。
2. **业务 service 与契约解耦**：`meetingApiContract.ts` 是契约文档（path/req/res），`postMeetingService.ts` 是业务编排（含 `closeMeeting()` 这种"派单 + 生成报告"的组合调用）。后端只需要看契约文件即可。
3. **Drawer + 独立报告页 双入口**：Drawer 适合"会后立刻看一眼"，独立报告页适合"评委演示时全屏展示"。两者数据共享 Blackboard，无冗余状态。
4. **派单 5% 失败率**：模拟真实场景"个别指派人不在组织架构中"的情况，让评委看到失败处理逻辑（Alert + 重试按钮）。
5. **Blackboard 单例复用**：PostMeetingReport 页面打开时直接从 `blackboardStore.get()` 拿数据，0 网络请求，500ms 加载完。这是个**性能优化**，但也意味着数据生命周期受单例约束（如果会议切换需要 reset）。
7. **i18n key 用语义化（`postMeeting.summary`）而非 `auto.N`**：与之前 `auto.N` 模式保持一致但**这次的 key 有人工维护**，不会后续被 rewrite-iszh 自动改写。

#### 8. 现象 / 决策记录

- **PowerShell 中文路径下 `tsc` build 报错**：第一次跑 `npm run build` 失败，但 `tsc --noEmit` 单独跑显示的错误都在历史遗留文件 `src/pages/Meeting.tsx`（这个文件不在 router 里，零影响）。决定本次先不修历史遗留（不在亮点 1 范畴）。
- **jspdf 中文支持差**：PDF 报告目前用英文（标题/章节名硬编码英文），如果后续需要中文报告，建议后端生成 PDF + 中文字体嵌入，前端只调 `POST /api/v1/reports/upload`。
- **Blackboard 单例在切换会议时的残留**：`resetMeeting(id)` 会重置 Blackboard，但如果用户在两个会议页面快速切换可能有数据闪动。决定本期不优化（不是亮点 1 演示阻塞问题）。

#### 9. 工程护栏

- 5 个 service 函数体内**注释里都标了"真实对接时应该写什么 axios 代码"**，方便后端同学上手
- 所有组件 props 都用 TS interface 定义，无 any
- `meetingApiContract.ts` 类型与 `postMeetingService.ts` mock 实现**字段一一对应**，保证后端按契约实现后类型不报错
- i18n:check 通过（zh-CN + en-US key 结构对齐，720 → 745 key）

#### 10. 校验结果

- 5 个 service 函数 mock 实现，延迟 300-1200ms 模拟真实网络
- PDF 生成 < 3s，含分页 + 品牌标识 + 页脚
- Markdown 导出 < 100ms
- 端到端流程：开会 → fanoutChunk → runClosingSummary → 自动派单 → 看报告 → 导出 PDF（5 步全跑通）
- i18n 校验通过：745 key（之前 719）

#### 11. 关联上交材料

- 材料 2（系统设计 - 多 Agent 架构 + 前后端解耦）
- 材料 4（演示视频重点场景 1）
- 材料 5（API 契约附录 B · 5 个新增接口）
- 材料 8（开发记录）

### 3.5 接入会议纪要接口 — 外部办公系统集成一期（9.1）  @小陆

- **触及文件**: 10 个（+478 / -12）

#### 1. 新增服务层（1）

- `src/services/notificationDispatchService.ts`（318）— 统一推送入口（钉钉/企微/邮件），mock 实现 `POST /api/v1/notifications/send`

#### 2. 新增 Store（1）

- `src/store/pushChannelConfigStore.ts`（107）— 管理员配置持久化（事件×渠道×接收人），localStorage 持久化

#### 3. 新增页面组件（1）

- `src/pages/Settings/ExternalPushSettings.tsx`（215）— 推送配置 UI（Settings → 外部推送 Tab，含渠道开关 + 接收人管理 + 测试推送按钮）

#### 4. 新增 Hook（1）

- `src/hooks/useWorkitemDueReminder.ts`（77）— 工单到期催办定时器（每 60 秒扫描 meetingWorkItemStore + todoStore，距截止 ≤ 1 天触发）

#### 5. 修改 Store / 页面 / 组件（6）

- `src/store/notificationStore.ts`（+18）— 新增 `pushResult` 字段，记录每条通知的外部推送渠道状态
- `src/pages/Settings/index.tsx`（+16 / -3）— 新增「外部推送」Tab 入口
- `src/pages/Notifications.tsx`（+42）— 新增 `PushStatusBadge` 组件，通知卡片展示钉钉/企微/邮件推送状态徽章，失败可点击重试
- `src/services/postMeetingService.ts`（+24）— 会议工单派发时触发外部推送 `dispatchMeetingTodo()`
- `src/store/approvalDraftStore.ts`（+22）— 审批通过/驳回时触发外部推送 `dispatchApprovalChange()`
- `src/services/sandbox/sandboxApiContract.ts`（+31）— 合规沙箱阻断级违规时触发紧急推送 `dispatchSandboxCritical()`
- `src/pages/IndustryNews/index.tsx`（+22）— 发起合规审查时触发监管风险预警推送 `dispatchRiskAlert()`
- `src/components/Layout/AppLayout.tsx`（+6）— 挂载 `useWorkitemDueReminder()` 定时器

#### 6. 触发场景（5）

1. `meeting_todo` — 会议工单派发（`postMeetingService.closeMeeting`）
2. `workitem_due` — 工单到期催办（`useWorkitemDueReminder` 定时器，每 60s）
3. `approval_change` — 审批通过/驳回（`approvalDraftStore.setApprovalResult`）
4. `sandbox_critical` — 沙箱阻断级违规（`sandboxApiContract.runScan`）
5. `risk_alert` — 监管情报风险预警（`IndustryNews.handleLaunchComplianceReview`）

#### 7. SSO 单点登录

标记为二期，代码无侵入

#### 8. 关联上交材料

- 材料 5（场景分析）
- 材料 4（演示视频重点场景 1）

### 3.6 RAG 检索调优（9.5 — 9.10）  @小柒

#### 1. 固定 Smoke 与 Top-20 检索诊断（9.5）

- `evals/rag_baseline_cases.json` — 5 题固定样本
- `evals/results/baseline_smoke_run2.*` + `retrieval_rank_diagnostic.*`
- **问题定位**：
  - `single-08` 核心 chunk 84 排第 6，被 Top-4 截断
  - `cross-02` 文档 9 首次排第 18，Top-4 被文档 11 占满
  - 一题发生模型回退（Qwen → DeepSeek）拉长 P95

#### 2. 标题约束 + 受控法律简称 + Top-6 方案（9.7）

- `app/features/rag/retrieval_selector.py` + `app/features/chat/rag_retriever.py`：
  - `《标题》` 提取 + NFKC 规范化
  - 唯一精确匹配 + 受控 `中华人民共和国` 前缀简称
  - 多标题"全有或全无"解析 + 确定性轮询
  - 候选池从 Top-4 扩到 Top-6（最终上下文）
- 配套 `tests/test_rag_retrieval_selector.py` + `evals/results/cross_02_*` + `single_08_selection_analysis.*`

#### 3. Top-6 + 0.45 阈值 + 引用语义拆分（9.10）

- `app/core/config.py` + `.env.example` — 默认 `RAG_VECTOR_TOP_K=20` / `TOP_N=6` / `SCORE_THRESHOLD=0.45`
- `app/features/chat/rag_retriever.py` — 安全校验后、标题选择前应用 0.45 阈值；空上下文**直接固定拒答**，不调聊天模型
- `app/features/chat/citation_binding.py` — 新增 `retrieved_contexts`（实际入 prompt 全部材料）+ `used_citations`（答案有效引用子集），保留 `citations` 兼容语义
- 配套 `evals/results/retrieval_threshold_calibration.*` + `refusal_01_after_threshold_run2.*` + `baseline_smoke_after_retrieval_fixes.*` + `citation_binding_analysis.*`

#### 4. 关键数字（修复前 → 修复后）

| 指标 | 修复前 | 修复后 |
|---|---:|---:|
| 文档召回 micro | 83.33% | 100.00% |
| 支持片段召回 | 70.00% | 80.00% |
| 忠实度 | 71.74% | 82.61% |
| 拒答正确率 | 100.00% | 100.00% |
| 引用页码准确率 | 50.00% | 37.50% |

#### 5. 响应语义（拆分后）

| 字段 | 含义 | 前端用途 |
|---|---|---|
| `retrieved_contexts` | 实际送入 prompt 的全部材料 | 展示检索来源 |
| `used_citations` | 答案用有效编号明确引用的子集 | 展示答案引用 |
| `citations` | 与 `retrieved_contexts` 一致（兼容字段） | 兼容已有调用 |

#### 6. 关键决策

| 决策 | 理由 |
|---|---|
| Top-6 而非 Top-4 | 单文档第 6 名常含互补证据（single-08 验证） |
| 0.45 分数阈值 | 18 题校准确定（不是单题决定） |
| 空上下文不调模型 | 避免无依据时仍生成长答案 |
| 引用编号去重 + 按首现绑定 | 答案"第 N 条"与材料顺序稳定对应 |

#### 7. 验收与边界

- ✅ 18 题只检索校准，18 次 Embedding / 18 次 Qdrant / 0 次聊天模型
- ✅ 5 题 Smoke 全部通过；引用页码下降如实记录
- ⚠ 跨文档仍遗漏部分支持 chunk（cross-02 仍未 100%）
- ⚠ Qwen 超时回退 DeepSeek 拉高 P95（约 83.6 秒）

### 3.7 RAG 基线入库 + 独立 Docker 部署栈（9.8）  @小柒  — commit `b70c6df` + `081dac8`

- **触及文件**: `b70c6df` 140 个 / +32344 行（含评测 JSON + 文档 + 测试）；`081dac8` 8 个 / +402 行
- **提交状态**: 提交日期有 Git 对象为证

#### A. RAG 基线（commit `b70c6df`）

- `feat: establish financial office RAG platform baseline`
- 14 大类共 140 文件入库：
  1. `app/main.py` + `bootstrap.py` — 应用入口
  2. `app/api/router.py` — `/api/v1` 统一前缀 + 业务路由
  3. `app/core/{config,database,security,exceptions,middleware,logging,swagger}.py` — 配置 / 连接 / 认证基础 / 异常 / 中间件 / 日志 / Swagger
  4. `app/features/system/router.py` — `/system/health/{live,ready}` 健康检查
  5. `app/features/auth/{models,schemas,service,router,dependencies}.py` + `tests/test_auth.py` — 注册 / 登录 / JWT / 当前用户
  6. `app/features/rag/{models,schemas,service,router,chunker}.py` + 4 测试 — 知识库 / 文档 / 解析 / 切分
  7. `app/features/chat/{models,schemas,service,router,rag_retriever,citation_binding}.py` + 5 测试 — 普通聊天 / RAG 聊天 / 引用绑定
  8. `app/ai/{llm_gateway,model_router,diagnostics,usage,schemas,exceptions}.py` + `app/ai/embeddings/` + `app/ai/providers/` — 模型网关 / 路由 / Embedding
  9. `app/integrations/{file_storage,document_parser,ocr,qdrant_client}.py` — 原件 / 解析 / OCR / Qdrant 适配
  10. `app/features/rag/{indexing,index_build,index_publish}.py` + `app/features/rag/retrieval_selector.py` — 索引管理 / 检索选择
  11. `alembic/versions/` 下 7 个迁移（001~007）— 覆盖用户 / 知识库 / 文档 / 聊天 / chunk / 索引状态 / 代际
  12. `alembic/env.py` + `alembic.ini` — 迁移运行时配置（移除了硬编码 DB URL）
  13. `docs/{api-contract-v1,repository-readiness,database-design}.md` + `evals/{README,rag_baseline_cases.json}` + `evals/results/` — 契约 / 准备度 / 评测样本与报告
  14. `requirements.txt` + `requirements-dev.txt` + `pyproject.toml` + `.gitignore` + `.dockerignore` + `.env.example` — 依赖 / 检查配置 / 忽略规则 / 环境示例

#### B. 独立 Docker 部署栈（commit `081dac8`）

- `Dockerfile`（新）— Python 3.12 + 非 root + Tesseract chi_sim+eng + 监听 8000
- `docker-compose.deploy.yml`（新）— 项目名 `financial-office-deploy`（后改） + 内部网络 + MySQL 8.0.43 + Qdrant v1.19.1 + 三个独立卷
- `.env.deploy.example`（新）— 部署专用环境变量模板
- `scripts/docker-entrypoint.sh`（新）— 等待 MySQL → alembic upgrade head → 启动 Uvicorn
- `docs/docker-deployment.md`（新）— 部署教程
- `.gitattributes`（新）— 行尾 / 编码策略
- 修改：`.gitignore` + `.dockerignore`

#### C. 关键决策

| 决策 | 理由 |
|---|---|
| 提交合并 140 文件 | 之前无 Git，阶段成果一次归档 |
| DB URL 改为从 Settings 读取 | 移除 `alembic.ini` 硬编码 |
| 部署与开发隔离 | 避免容器覆盖开发 Qdrant 95 Points |
| 容器不映射宿主端口 | 全部走内部网络 |
| alembic 入口集成在 entrypoint | 启动即迁移，运维心智低 |

#### D. 踩坑记录

- 首次暂存检查发现 Markdown 尾随空格 + 多余空行（`api-contract-v1.md` 3-5 行 / `repository-readiness.md` 3 行 / `retrieval_rank_diagnostic.md` 末尾）→ 修复后重检
- 部署阶段当日只完成静态结构，**不能写成容器已运行**
- 首次推送前发现沙箱账户与当前 Windows 用户不同（`dubious ownership`）→ 信任例外后恢复

#### E. 验收与边界

- ✅ 提交前离线 438 测试通过 / Ruff 通过 / 敏感扫描无阻塞 / 知识库清点 10 个有效文档
- ✅ Compose 静态解析通过 / 脚本语法通过
- ⚠ 部署当日**仅静态检查**，未实际启容器
- ⚠ 历史成功截图不能代替新版本验证

### 3.8 部署栈资源隔离 + 兼容 AI + Qdrant 健康检查（9.10）  @小柒  — commit `eabd119` + `d5d4bdb` + `dc74c56`

- **触及文件**: 3 提交共 7 个 / +38 / -20

#### 1. 资源隔离（commit `eabd119` — `build: isolate deployment compose resources`）

- `docker-compose.deploy.yml`（+12 / -8）— 项目名改 `financial-office-deploy`，内部网络 / 三个卷采用独立部署名（不与开发环境重名）
- `.env.deploy.example`（+4 / -0）— 三项模型重试示例值设 0
- `docs/docker-deployment.md`（+8 / -6）— 同步说明资源隔离 + 部署配置

#### 2. 兼容 AI 配置可选（commit `d5d4bdb` — `chore: allow legacy AI config empty`）

- `.env.deploy.example`（+2 / -1）— 旧 `openai_compatible` AI API Key / Model 可留空
- `docker-compose.deploy.yml`（+4 / -3）— 对应环境变量由 required 改 optional

#### 3. Qdrant 健康检查修复（commit `dc74c56` — `fix: qdrant healthcheck via /dev/tcp`）

- `docker-compose.deploy.yml`（+6 / -1）— Qdrant healthcheck 改 Bash `/dev/tcp/127.0.0.1/6333`（镜像内无 curl / wget）
- `docs/docker-deployment.md`（+2 / -1）— 说明检查不依赖 curl

#### 4. 关键决策

| 决策 | 理由 |
|---|---|
| 部署资源独立命名 | 不覆盖开发 Qdrant / MySQL / 上传卷 |
| 旧兼容 AI 允许为空 | 旧占位符不应阻塞新专用模型密钥（Qwen / DeepSeek） |
| Qdrant healthcheck 用 /dev/tcp | 镜像无 curl；/dev/tcp 端口探测足够（业务健康仍需真实请求验证） |

#### 5. 踩坑记录

- Qdrant 报 `/bin/sh: curl: not found`（健康检查失败 → API 卡在 created）→ /dev/tcp 修复
- 旧 `AI_API_KEY` 空时 Compose 启动强校验 → 改 optional
- 健康检查通过 ≠ 业务接口可用 → 文档明确区分

#### 6. 验收与边界

- ✅ 三次提交均通过静态检查
- ⚠ "三个服务 healthy"截图来自**后续启动**，**不是该静态提交本身的证明**
- ⚠ 业务链路（聊天 / RAG）需在真实部署环境单独验收

---

## 阶段四：测试优化与迭代（2026-09-11 → 2026-09-20）

> **甘特图条目**：37~41（5 张型表）
> **本阶段交付**：合规沙箱 LLM 模式 0.3 + 4 Agent 黑板 1.1 + 行业资讯详情 + Dashboard 重构 + 会议元数据 + 死循环修复

### 4.1 合规沙箱 0.3 落地（9.12）  @小忍

#### 目标

按"睿枢金融办公智能体平台"合规要求，新增 `compliance_sandbox` 作为 `ChatMode` 第四种回答模式，对应受限网络 + 白名单 + PII 脱敏 + 全量审计 + 紧急熔断 + 静默降级三档策略。

#### 新增文件

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

#### 修改文件

- `app/core/config.py`：新增 8 个 `SANDBOX_*` 配置 + 2 个字段校验器
- `app/features/chat/schemas.py`：`ChatMode` 新增 `COMPLIANCE_SANDBOX = "compliance_sandbox"`
- `app/api/router.py`：注册 `compliance_router`

#### 设计要点（按需求逐条落实）

| 需求 | 实现 |
|---|---|
| 1. 审计字段：prompt_hash + prompt_preview(脱敏前 500 字) + answer_hash + answer_preview | `audit.py` 计算 SHA-256 + 截 500 字 + 复用 `sanitizer.sanitize_preview` |
| 2. PII 脱敏：身份证 / 银行卡 / 手机号 / 邮箱 → *** | `sanitizer.DEFAULT_PATTERNS` 4 个正则（顺序：id_card → mobile → bank_card → email，避免误命中） |
| 3. base_url 必须命中内网段（10/192/172.16-31/127 + *.hengsheng.com），默认不预填 Provider | `network.is_internal_base_url()` + `provider_allowed()`；默认 `SANDBOX_PROVIDER_WHITELIST=[]` |
| 4. 3 档降级：strict(拒绝) / fallback(静默降级+记日志) / off(关闭) | `SANDBOX_DEGRADATION_POLICY`；service 在 4 个分支上判断降级 |
| 5. 强制 temperature=0 + max_tokens≤2000 + 禁自定义 system prompt | `SANDBOX_TEMPERATURE` / `SANDBOX_MAX_TOKENS` 默认值；service 用 `dataclasses.replace` 覆写 profile；`Guard.reject_custom_system_prompt` 422 拒绝 |

#### Settings 新增字段（8 个）

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

#### API

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

#### 测试结果

```
tests/test_compliance_sanitizer.py ........  9 passed
tests/test_compliance_network.py   .......... 10 passed
tests/test_compliance_guard.py     ...... 6 passed
============================== 25 passed in 0.11s ==============================
```

#### 部署前必做（运维）

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

#### 下一步

进入 `1.1 4 Agent 共享黑板（Blackboard）`：为后续智能审批 / 工作台 Dashboard 提供 4 个 Agent 协同的状态共享层。

### 4.2 4 Agent 共享黑板 1.1 落地（9.14）  @小忍

#### 目标

为后续智能审批 / 会议精简版 / 工作台 Dashboard 提供 4 个经典 Agent（researcher / planner / executor / reviewer）共享状态层；前端通过 `?since_id=` 轮询增量事件。

#### 新增文件

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

#### 修改文件

- `app/api/router.py`：注册 `blackboard_router`

#### 设计要点（按决策逐条落实）

| 决策 | 实现 |
|---|---|
| 4 Agent：researcher/planner/executor/reviewer | `models.AgentRole` StrEnum |
| 存储：MySQL + JSON | `blackboard_events.payload` 用 SQLAlchemy `JSON` 类型 |
| 推送：前端轮询 GET /events?since_id= | `list_events(since_id, limit)` 返回 `next_since_id` |
| Session 生命周期：手动开/手动关 | `POST /sessions` 开 + `POST /sessions/{id}/close` 关；关闭后写事件 409 |
| 可见性：仅本人 | 所有 service 方法都校验 `owner_id`，B 写 A 的 session_id 返回 404 |
| Payload ≤ 64 KB | `BlackboardEventCreate.payload` field_validator 序列化字节数 |
| 汇总字段：基础（各角色最新事件 + 状态 + 错误数） | `RoleSummary` 4 个 + `total_events/total_errors` |

#### API

```
POST   /api/v1/blackboard/sessions             # 开 session
GET    /api/v1/blackboard/sessions             # 列当前用户 OPEN 的
POST   /api/v1/blackboard/sessions/{id}/close  # 关
POST   /api/v1/blackboard/events               # 写事件（Agent 调用）
GET    /api/v1/blackboard/events?session_id=&since_id=&limit=  # 轮询
GET    /api/v1/blackboard/sessions/{id}/summary  # 4 角色汇总
```

#### 测试结果

```
tests/test_blackboard_event.py        ....    4 passed
tests/test_blackboard_router_auth.py  ......  6 passed
tests/test_blackboard_e2e.py          ..      2 passed  # 含跨用户隔离
============================== 44 passed in 0.73s ==============================
```

（含 0.3 沙箱 32 + 黑板 12 = 共 44 用例）

#### 部署前必做

```bash
mysql -uroot -p financial_office < db/migrations/versions/0002_blackboard_events.sql
```

#### 下一步

进入 `2.1 工作台 Dashboard`：前端 Vue 3 调用 blackboard summary + compliance 审计做首屏；先评估是否需要后端聚合接口，再决定起步形态。

### 4.3 行业资讯详情 Drawer + 一键发起合规审查（9.15）  @小陆

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

### 4.4 实时会议室死循环修复 + 鉴权加固（9.17）  @小陆

#### 死循环修复

**触及文件**: 6 个（+83 / -62）

修 `MeetingRoom` / `useMultiAgent` 的死循环（`Maximum update depth`）：
- `BlackboardStore` / `AgentRunStateStore` 各加 `tick++` + `getTick()`，`useSyncExternalStore` 订阅 tick 值
- `useBlackboard` / `useAgentRunState` 改 `useMemo` 派生数据，保证引用稳定
- `MeetingRoom` `setParticipants` effect 合并 + JSON 签名守卫 + `speakerIndexRef` 跨渲染保留
- `ActionDispatchPanel` `onRefreshRef` 锁定

#### 鉴权加固

- `app/core/exceptions.py`
    - 统一 HTTPException → `{code, detail, status}` JSON
    - 401 → unauthorized / 404 → not_found / 422 → validation_error / 500 → internal_error
    - 沙箱异常也加 code 字段
- `app/features/meeting/ws.py`
    - `_authenticate` 返回 (user_id, token, expiry)
    - 新增 `_token_watchdog_loop`：每 60s 检查，过期前 30s 推 `token_expiring`，已过期推 `token_expired` + close(code=1008)
- 前端 `meetingWs.ts`
    - `onAuthFailure(reason)` 回调
    - 收到 token_expired 或 close(code=1008|4401) → authFailed=true 不再重连

10 场景集成测试全通过。

### 4.5 Dashboard 首页「一目了然」化重构（9.18）  @小陆

#### 为什么改（手动）

Dashboard 之前堆了 **9 个区块**（问候 + 4 风险卡 + 3-Tab 待办 + 7日 AreaChart + 4 KPI + 工单度量面板 + 6 张会议工单 + 今日会议 + 会议工单闭环），滚动条要拉 3 屏，**违反"主页面只做概览"的设计原则**。参考右图"智慧团建"首页（功能矩阵 + 简短通知 + 1 个组织卡片），目标：**主页面 1 屏内全部看完，长内容全部下沉到子页面**。

#### 触及文件

| 文件 | 改动 |
|---|---|---|
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

---

## 阶段五：上线准备与总结（2026-09-21 → 2026-10-10）

> **甘特图条目**：42~48（7 张型表）
> **本阶段交付**：合规沙箱 4 层防御 + 会议 Agent 体系 + v1.2 4 新域 + v1.1 答辩包装 + 真实 LLM 链路
> **关键产出**：43 张表 + 62 端点 + pytest 28 用例全绿 + 答辩演示脚本

### 5.1 合规沙箱 4 层防御 + LLM Judge + 风险分类（9.22）  @小忍

**目标**：把合规沙箱从「30 个硬匹配词」升级到「4 层防御 + 语义判断 + 风险分类」，让准确度从 50% 提升到 90%+，满足前端项目的合规需求。

#### 1. 4 层防御架构

| 层 | 名称 | 实现 | 拦截依据 |
|----|------|------------|----------|
| L1 | Kill Switch | `guard.check_kill_switch` | 紧急熔断开关 |
| L2 | 风险词硬匹配 | `guard.check_risk_keywords` | 205 个金融行业词 + 9 类分类 |
| L3 | PII 脱敏 | `sanitizer.py`（未变）| 正则：手机/身份证/银行卡/邮箱 |
| L4 | LLM Judge 语义判断 | `guard.llm_judge_check` | JSON 分类 + 置信度阈值 |

#### 2. 关键改动

**① `app/features/compliance/keywords.py`（新建）**
- 9 大类别 × 平均 23 个词 = **205 个风险词**
- 类别：money_laundering / insider_trading / tax_evasion / bribery /
  privacy_leak / illegal_commitment / conflict_of_interest /
  illegal_finance / regulatory_evasion
- 提供 `get_all_risk_keywords()` 兼容旧 `SANDBOX_RISK_KEYWORDS` 字符串配置

**② `app/features/compliance/guard.py` — 4 层防御**

```python
@dataclass(frozen=True)
class GuardDecision:
    allowed: bool
    blocked_reason: str | None
    risk_hits: list[str]
    risk_category: str | None   # ← 新增：9 类分类
    confidence: float           # ← 新增：0-1
    judge_source: str           # ← 新增：rule / llm_judge
```

```python
# LLM Judge prompt：让 LLM 当合规律师
```

**③ `app/features/compliance/{schemas,service,audit}.py` — 透传分类**
- `SandboxChatResponse` 加 `risk_category`, `confidence`, `judge_source`
- `AuditPayload` 加同样字段
- service.py 写审计时同步记录
- 拦截时 422 detail 也带分类

**④ `alembic/versions/20261003_add_audit_risk_category.py`（新建）**

```sql
ALTER TABLE compliance_audit_logs
  ADD COLUMN risk_category VARCHAR(32),
  ADD COLUMN confidence FLOAT,
  ADD COLUMN judge_source VARCHAR(16);
CREATE INDEX idx_compliance_audit_category ON compliance_audit_logs(risk_category);
```

**⑤ `app/core/config.py` — 新配置**

```python
SANDBOX_LLM_JUDGE_ENABLED: bool = True
SANDBOX_LLM_JUDGE_CONFIDENCE_THRESHOLD: float = 0.7
SANDBOX_LLM_JUDGE_PROVIDER: str = ""
SANDBOX_LLM_JUDGE_TIMEOUT_MS: int = 15000
```

**⑥ `.env` — 降级策略**

```env
SANDBOX_DEGRADATION_POLICY=fallback  # 沙箱 Provider 不可用时降级到普通 LLM
```

#### 3. 测试结果

测试脚本：`scripts/test_sandbox_accuracy.py`（34 个用例）

| 维度 | 通过率 | 备注 |
|------|--------|------|
| 硬匹配拦截（18 例）| **100%** | 18/18 全部命中正确分类 |
| 风险分类（9 类）| **7 类 100%** | 仅 regulatory_evasion / general 有偏差 |
| LLM Judge 抓语义违规 | 50%（3/6）| 3 个 timeout 是 LLM 慢 |
| PII 脱敏 | **超时挂掉** | 待 Provider 配置稳定后再跑 |

**整体通过率：24/34 = 70.6%**

#### 4. 已知问题与下一步

1. **LLM Judge timeout**：deepseek-reasoner 太慢（9-15s/次），需改 `deepseek-chat`
2. **Provider 503**：dev 环境 base_url 不是内网后缀，需用 `fallback` 策略
3. **合规知识误拦**：「反洗钱是什么」会被拦 → 已加 LLM 复核机制（见 guard.py）
4. **多轮上下文审计**：未做，列入 P1 backlog

#### 5. 前端可消费的新字段

```typescript
// SandboxChatResponse 新增
{
  risk_category: 'money_laundering' | 'insider_trading' | ...,
  confidence: 0.92,
  judge_source: 'rule' | 'llm_judge'
}
```

前端可基于 `risk_category` 展示不同图标 / 文案 / 处置流程。

### 5.2 合规沙箱 LLM Judge / Rule Engine / Kill Switch / 异常 / 中间件（9.24 — 9.25）  @小忍

#### 5.2.1 LLM Judge（282 行，新文件）

- `app/sandbox/llm_judge.py`（282）：
  - `LLMJudge.assess(text, rules, task="risk_assessment") -> dict`
  - 返回 `{risk_level, matched_rules, matched_intents, reasoning}`
  - `_extract_json_payload()` 容错解析 3 段：
    1. 直接 `json.loads` 整段
    2. 抓 ` ```json ... ``` ` Markdown 围栏
    3. 抓首个 `{...}` 块（懒匹配跨行）
  - 失败降级：LLM 异常或解析失败时返回 `risk_level="unknown"`，**不抛异常**
  - `_to_result()` 字段规范化：大写 level → 小写；列表元素类型清洗；`reasoning` 截断到 300 字
  - `gateway` 参数支持 Protocol 注入（duck-typing，便于单测 mock）
  - 系统提示词：金融合规严谨、不虚构企业制度、规则匹配要求返 `rule.id`

#### 5.2.2 模块入口

- `app/sandbox/__init__.py`（+11）— 导出 `LLMJudge` / `JudgeResult`

#### 5.2.3 关键决策

| 决策 | 理由 |
|------|------|
| `task="risk_assessment"` 参数化 | 与 `.env` 的 `AI_TASK_ROUTES_JSON.risk_assessment` 路由配合；测试可覆盖 |
| 3 段 JSON 容错 | 国产 LLM 经常带 Markdown 围栏或夹杂中文 |
| 失败返回 `unknown` 不抛 | 让上层 `SandboxGuard` 决定降级策略 |
| `reasoning` 截断 300 字 | 防止 LLM 长输出撑爆审计字段 |
| `gateway: Protocol` 抽象 | 业务层解耦，单测可注入 mock（无需真实 LLM） |

#### 5.2.4 Rule Engine（207 行，新文件）

- `app/sandbox/rule_engine.py`（207）：
  - `Rule` dataclass（frozen，`id` / `pattern` / `severity` / `description`）
  - `RuleResult` dataclass（`risk_level` / `matched_rules` / `matched_intents` / `details`）
  - `RuleEngine.match(text)`：**字符串子串 + 正则双模匹配**，大小写不敏感
  - `SettingsRuleProvider` — 从 `settings.SANDBOX_RISK_KEYWORDS` 派生 `kw-NNN` 规则
  - `RuleProvider` Protocol — 可注入 DB / 远程配置

#### 5.2.5 service.py（304 行，新文件）

- `app/sandbox/service.py`（304）：
  - `check_text(text, mode, biz_type, biz_id, user_id, db, rule_engine, llm_judge)`
  - **3 种 mode**：`rule_only` / `llm_only` / `combined`
  - **触发条件**：`combined` 且 rule 命中 `medium` / `high` → 才调 LLM（节省 token）
  - **合并策略**：`max(rule_severity, llm_severity)`；意图去重保序
  - **审计 fail-open**：写入失败 `logger.error` 后返回 `audit_id=None`，不抛异常
  - `scenario` 字段记录 `mode` / `biz_type` / `biz_id` / `rule_risk_level` / `llm_risk_level` / `llm_reasoning`

#### 5.2.6 模型加 `scenario` 字段

- `app/features/compliance/models.py`（+7）— `ComplianceAuditLog.scenario: JSON`
- `app/features/compliance/audit.py`（+2）— `AuditPayload.scenario` 透传

#### 5.2.7 迁移文件

- `alembic/versions/20260918_add_compliance_audit_logs_scenario.py`（+34）— `op.add_column scenario JSON`

#### 5.2.8 关键决策

| 决策 | 理由 |
|------|------|
| 沿用 `mode="compliance_sandbox"`，新增 `scenario` JSON | 不破坏现有 mode 语义；scenario 容纳所有 check 上下文 |
| `combined` 只在 rule 命中 medium/high 时调 LLM | low 风险不上 LLM，省 token + 降延迟 |
| 合并取**高**严重度 | 保守策略，宁误报不漏报（金融合规） |
| 意图去重保序 | 规则意图在前，LLM 意图在后，便于审计追溯 |
| 审计 fail-open | 审计故障不阻塞业务（合规底线 vs 业务可用性权衡） |

#### 5.2.9 Kill Switch 单例（145 行，新文件）

- `app/sandbox/kill_switch.py`（+145）— `KillSwitch` 进程单例（双重检查锁）：
  - **三种触发方式**（任一即熔断）：
    1. 环境变量 `SANDBOX_KILL_SWITCH=true`（最高优先级，重启生效）
    2. 文件标记 `.sandbox_killed`（运维 1 秒生效，进程重启仍存在）
    3. API `kill_switch.activate(reason)`（远程操作，写文件持久化）
  - **5 秒缓存 TTL** — 避免每次调用都读文件 / 查环境变量
  - **fail-safe** — 任何检查异常默认不熔断（不阻塞业务）
  - `activate()` 同时写文件，进程重启后仍生效
  - 模块级 `kill_switch` 单例直接 `from app.sandbox.kill_switch import kill_switch`

#### 5.2.10 沙箱领域异常（99 行，新文件）

- `app/sandbox/exceptions.py`（+99）— 4 个异常类：
  - `SandboxError`（基类，含 `error_code` / `details`）
  - `SandboxUnavailable`（HTTP 503，含 `audit_id` / `kill_switch_reason`）
  - `SandboxConfigError`（HTTP 500，Provider 配置错误）
  - `SandboxLLMError`（HTTP 502，Provider 调用失败）

#### 5.2.11 service.py 加前置守卫

- `app/sandbox/service.py`（+88 / -17）— `check_text()` 入口处加 kill_switch 检查：
  - 守卫激活 → 抛 `SandboxUnavailable(error_code="SANDBOX_KILLED")`
  - 守卫触发时**也写审计**（`scenario.event_type=kill_switch_triggered`），留痕
  - `kill_switch` 参数支持 Protocol 注入（单测可 mock）
  - 新增 `_write_audit_kill_switch()` 私有方法

#### 5.2.12 全局异常处理器

- `app/core/exceptions.py`（+27 / -1）— 新增 `sandbox_unavailable_handler`：
  - 返回 HTTP 503 + `{error_code, message, fallback, audit_id, kill_switch_reason, timestamp}`
  - 在 `register_exception_handlers()` 中注册

#### 5.2.13 HTTP 层中间件

- `app/core/middleware.py`（+52 / -0）— 新增 `SandboxKillSwitchMiddleware`：
  - 拦截 `/api/v1/compliance/sandbox/*` 路径
  - 在 `setup_middleware()` 最前注册（最早拦截）
  - 与 service 层守卫形成**双层防护**（中间件最快 / service 最兜底）

#### 5.2.14 Kill Switch API 拆分

- `app/features/compliance/router.py`（+34 / -23）：
  - `GET /kill-switch` — 读 `kill_switch.is_active()` / `reason`（不再依赖 `settings`）
  - `POST /kill-switch` — 激活（替代旧的 `toggle`，只接受 enabled=true）
  - `POST /kill-switch/resume` — 关闭（删除标记文件）

#### 5.2.16 运维手册（263 行，新文件）

- `docs/沙箱应急操作.md`（+263）：
  - 3 种熔断方式 + 对应恢复命令
  - 状态查询 API、SQL 审计查询、告警接入建议
  - 三种触发优先级 + 故障排查

#### 5.2.17 关键决策

| 决策 | 理由 |
|------|------|
| 三层防御（middleware → service → audit） | 中间件最快拦截；service 业务层最后兜底；audit 留痕 |
| `.sandbox_killed` 标记文件持久化 | API 触发也写文件，进程重启不丢失熔断状态 |
| `SandboxUnavailable` 含 `audit_id` | 客户端拿到 503 也能定位到具体审计行 |
| 5 秒缓存 | 高频调用不重复读盘；紧急恢复可在 5 秒内生效 |
| `kill_switch` 接收 Protocol | 单元测试可 mock `KillSwitchLike`，不污染全局单例 |

#### 5.2.18 部署验证（迁移 + kill_switch 端到端）

**本地环境问题**：4 个串联障碍

| 障碍 | 报错 | 根因 |
|---|---|---|
| ① `alembic` 命令找不到 | `'alembic' is not recognized` | 虚拟环境未激活；改用 `python -m alembic` |
| ② Access denied | `(1045, "Access denied for user 'root'@'localhost'")` | `.env` 中 `DATABASE_PASSWORD=` 留空 |
| ③ Unknown database | `(1049, "Unknown database 'financial_office'")` | 数据库本身尚未 `CREATE` |
| ④ Table doesn't exist | `(1146, "Table 'compliance_audit_logs' doesn't exist")` | **历史 bug**：`compliance_audit_logs` 表无对应创建迁移 |

**修复动作**
1. 补 `.env` 里的 MySQL 密码（DATABASE_PASSWORD）
2. Workbench 手动建库：`CREATE DATABASE financial_office CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
3. Workbench 手动建表 `compliance_audit_logs`（含 `user_id` / `text_sha256` / `matched_rules` JSON / `risk_level` 等列 + 3 个索引）
4. `alembic upgrade head` → 输出 `Running upgrade 20260917_007 -> 20260918, add compliance_audit_logs.scenario`

**kill_switch 端到端验证**

```powershell
# 3.1 默认状态
python -c "from app.sandbox.kill_switch import kill_switch; print(kill_switch.is_active())"
# → False ✅

# 3.2 文件触发熔断
"reason=test" | Out-File -Encoding utf8 .sandbox_killed
python -c "from app.sandbox.kill_switch import kill_switch; print(kill_switch.is_active())"
# → True ✅

# 3.3 解除熔断
Remove-Item .sandbox_killed
# 无报错 ✅
```

#### 5.2.19 累计产出（9.22 — 9.25）

```
3 个提交: 72bdf70 / 338f956 / 36ae8ef
18 个文件 / +1633 行 / -37 行
2 次部署排障 + 1 次路由修复
```

#### 5.2.20 待办（已建基线）

- [x] 用户本地执行 `alembic upgrade head` 应用 `scenario` 字段迁移（2026-10-03 完成）
- [ ] 接入监控告警（参考 `docs/沙箱应急操作.md` 第 6 节）
- [ ] Kill Switch API 接入钉钉 / PagerDuty 自动化
- [ ] 单测覆盖 `SandboxKillSwitchMiddleware` 端到端路径
- [ ] 编写 pytest 套件（当前用 `scripts/_test_*.py` 临时验证）

### 5.3 会议 Agent 体系（9.26 — 9.30）  @小忍

#### 1. 会议 Agent 数据模型

- `meeting_sessions` / `meeting_blackboard` / `agent_executions` 3 张表
- 角色枚举：moderator / noter / decision / dispatcher
- 状态机：preparing → active → closed
- `meeting_blackboard.version` 乐观锁
- 踩坑：MySQL `VARCHAR(65535)` 报错 → 改 `Text`；DDL 部分提交 → 手工 `scripts/fix_meeting_tables.sql` 补建

#### 2. BlackboardService（200 行）

- `write(session_id, agent_role, state)` 乐观锁写入，返回新 version。冲突自动重试 3 次
- 进程内 dict 缓存 + 写后同步通知订阅者
- 回调抛错隔离（WebSocket 挂了不影响其他订阅者）
- state 大小 > 64KB 拒绝

数据流：
```
[Agent 调用] → BlackboardService.write()
        ↓
[1.读 DB → 2.UPDATE WHERE version=? → 3.冲突重试 3 次]
        ↓ 成功
[4.更新进程内 dict 缓存]
        ↓
[5.同步通知所有订阅者]
        ↓
[callback 里调用 ws.broadcast() → WebSocket 推前端]
```

#### 3. 会议元数据入表

- `MeetingSession` 加 `topic / agenda / current_phase` 3 字段
- `MeetingPhase` 枚举：open / discussing / closing / closed
- `_to_read` 直接读表，不再从 moderator 黑板拼
- `_sync_phase_from_state` 在 Agent 写完时同步合法 phase 回表
- alembic 迁移：`20261003_001_add_meeting_metadata.py`
- 8 场景集成测试全通过（含旧数据 NULL 兼容）

#### 4. 黑板事件回放

- 新表 `meeting_blackboard_events`（区分老 `blackboard_events`，避开 MetaData 冲突）
- 字段：session_id / agent_role / version / state / created_at
- `BlackboardService.write` 成功后 1 次 INSERT 落事件（同事务）
- 新增 `GET /api/v1/meetings/{id}/blackboard/events?since_event_id=N&limit=200`
- 踩到 2 坑：
  - MySQL 5.7 不支持 DATETIME DEFAULT CURRENT_TIMESTAMP(6) → 改 `now()`
  - per-agent version 与全表 id 混用歧义 → 改用全局 `since_event_id`
- 8 场景集成测试全通过

#### 5. 事件总线 + 默认触发链

- 新文件 `app/features/meeting/event_bus.py`
- `BlackboardService.subscribe_global(callback)` 全局订阅（不绑 session）
- `BlackboardService.write` 自动注入 `event_type = "{role}_updated"`
- 默认链：`moderator_updated → noter → decision → dispatcher`
- 启动时机：`ws.py get_blackboard_service()` 首次创建时懒装（幂等）
- 错误隔离：双重 try/except（_notify + chain 内部）
- 5 场景集成测试全通过

#### 6. AI 模型路由

- `AITask.SINK = "sink"` + `_builtin_routes()` 兜底 `["qwen3_max", "deepseek_v3"]`
- `.env` 配 `qwen3_max`（qwen3.8-flash）+ `deepseek_v3`（ep-m-...）
- 真实链路延迟（2026-09-30）：deepseek 3709ms / doubao 2257ms / qwen 1629ms
- 5 场景集成测试全通过，链路全通

#### 7. 鉴权加固

- `app/core/exceptions.py`
    - 统一 HTTPException → `{code, detail, status}` JSON
    - 401 → unauthorized / 404 → not_found / 422 → validation_error / 500 → internal_error
    - 沙箱异常也加 code 字段
- `app/features/meeting/ws.py`
    - `_authenticate` 返回 (user_id, token, expiry)
    - 新增 `_token_watchdog_loop`：每 60s 检查，过期前 30s 推 `token_expiring`，已过期推 `token_expired` + close(code=1008)
- 前端 `meetingWs.ts`
    - `onAuthFailure(reason)` 回调
    - 收到 token_expired 或 close(code=1008|4401) → authFailed=true 不再重连

10 场景集成测试全通过。

#### 8. 压测基线

环境：LLM mock 延迟 50ms × 4 agent，MySQL + BlackboardService 缓存，TestClient 单线程 30 次

| 指标 | 数值 |
|---|---|
| 理论下限 | 200 ms (4 × LLM 延迟) |
| mean | 234 ms |
| p50 | 228 ms |
| p95 | 260 ms |
| p99 | 363 ms |
| max | 363 ms |
| stdev | 25 ms |

业务开销 = mean - 理论下限 = 34 ms (+17%)
4 次 BlackboardService.write + 4 次 MySQL UPDATE + 4 次 INSERT 事件 + 订阅派发 + HTTP 序列化

并发压测未跑：TestClient thread-safety 受限 + 同 connection 冲突，需 uvicorn + 连接池扩容。

#### 9. SandboxAuditLog + Alembic 迁移（9.27）

新增精简版审计表 `sandbox_audit_log`，仅记录"风险检查事件"本身，与已有 `compliance_audit_logs`（LLM 调用完整链路审计）并存。

| 模型字段 | 数据库列 | 类型 | 说明 |
|---|---|---|---|
| `id` | `id` | BIGINT PK | TimestampMixin |
| `created_at` / `updated_at` | `created_at` / `updated_at` | DATETIME | TimestampMixin |
| `user_id` | `user_id` | BIGINT | 调用用户 ID（不建外键） |
| `biz_type` | `biz_type` | VARCHAR(32) | chat/document/approval |
| `biz_id` | `biz_id` | VARCHAR(64) | 业务对象 ID |
| `text_hash` | `text_hash` | VARCHAR(64) | SHA-256（原文永不落库） |
| `risk_level` | `risk_level` | VARCHAR(16) | low/medium/high |
| `matched_rules` | `matched_rules` | JSON | 命中规则详情 |
| `llm_reasoning` | `llm_reasoning` | VARCHAR(2048) NULL | LLM 判定理由 |
| `suggestions` | `suggestions` | VARCHAR(1024) NULL | 处置建议 |

索引

| 索引名 | 列 | 用途 |
|---|---|---|
| `idx_sandbox_audit_user_created` | (user_id, created_at) | 按用户查历史 |
| `idx_sandbox_audit_biz` | (biz_type, biz_id) | 按业务对象查 |
| `idx_sandbox_audit_risk` | (risk_level) | 按风险等级筛选 |

变更文件
- 🆕 `app/sandbox/audit.py` — `SandboxAuditLog` 模型（96 行）
- 🆕 `alembic/versions/20260919_add_sandbox_audit_log.py` — upgrade + downgrade（67 行）
- ✏️ `app/sandbox/__init__.py` — 导出 `SandboxAuditLog`，更新模块顶部文档

迁移链路：`20260917_007 → 20260918 → 20260919 (head)`

与已有审计表的差异

| 维度 | `compliance_audit_logs` | `sandbox_audit_log`（新增） |
|---|---|---|
| 定位 | LLM 调用完整链路 | 风险检查事件（精简） |
| 字段数 | 16 个（含 prompt_preview/answer_preview） | 9 个（核心字段） |
| 原文存储 | 仅脱敏预览 | 仅哈希 |
| 外键 | user_id 有外键 | 无外键 |

### 5.4 v1.2：4 个新业务域 + 5 张新表 + 演示工具集（10.2）  @小柒 / @小陆

- **触及文件**: 24 个（+725 / -38），新增 25 个

#### 1. 4 个新域（前端联调基座）

- **审批域**（`app/features/approval/`）：
  - `models.py`（+154）— `Approval` / `ApprovalAction` 两表 SQLAlchemy 模型（已与 `migrations/2026_10_06_new_features.sql` 同步）
  - `schemas.py`（+80）— `ApprovalCreate` / `ApprovalOut` / `ApprovalActionCreate` 等 Pydantic 契约
  - `service.py`（+260）— 业务层：建审批 / 流转移交 / 拒绝动作审批 / 列表查询（含状态机）
  - `router.py`（+88）— 5 个端点：POST `/approvals`（创建）、GET `/approvals`（列表）、GET `/approvals/{id}`（详情）、POST `/approvals/{id}/approve`、`POST /approvals/{id}/reject`
- **工作台总览**（`app/features/dashboard/`）：
  - `models.py`（+148）— `MaintenanceRecord` 模型
  - `schemas.py`（+78）— `DashboardStats` 契约（今日工单 / 待审批 / 通知计数）
  - `service.py`（+260）— 聚合 4 个域的 stats + topN
  - `router.py`（+58）— 1 个端点：`GET /dashboard/stats`
- **即时通讯**（`app/features/im/`）：
  - `models.py`（+92）— `ImDirectMessage` 模型
  - `schemas.py`（+58）— `ImMessageCreate` / `ImMessageOut` 契约
  - `service.py`（+220）— 发送 / 历史查询（含读未读标记）
  - `router.py`（+48）— 2 个端点：`POST /im/messages`、`GET /im/messages`
- **通知中心**（`app/features/notification/`）：
  - `models.py`（+98）— `NotificationRecord` 模型
  - `schemas.py`（+68）— `NotificationOut` 契约
  - `service.py`（+220）— 列表 / 标记已读 / 发送
  - `router.py`（+50）— 2 个端点：`GET /notifications`、`POST /notifications/send`

#### 2. 5 张新表（建库脚本 + 幂等迁移）

- `migrations/2026_10_06_new_features.sql`（+148）— 一脚本建 5 张表：
  - `approvals`（含 state/created_by/approved_by/timestamp 索引）
  - `approval_actions`（含 `approval_id FK` + 操作类型枚举）
  - `meeting_actions`（与会后工单对齐，已规划）
  - `notification_records`（含 user_id / type / read_at）
  - `im_direct_messages`（含 sender_id / receiver_id / created_at）
- `scripts/run_migration.py`（+74）— 一键迁移：
  - 读 `.env` 里的 DB 配置（pymysql 直连，绕开 alembic）
  - 按 `;` 切 statement，单条执行，已存在就跳过（`1060` 错误吞）
  - **幂等**：可重复跑
  - **已在本机 MySQL 跑通**：5 张表全部 CREATE 成功 ✅

#### 3. 路由注册 + 配置打通

- `app/api/router.py`（+11）— 引入 4 个新 router，挂到 `/api/v1/{approval,dashboard,im,notification}`
- `app/core/config.py`（+14）— 加 `MAINTENANCE_MODE` / `DASHBOARD_REFRESH_INTERVAL` 两个开关
- `app/models/__init__.py`（+8 / -2）— 引入 4 个新模型（`Approval` / `ApprovalAction` / `ImDirectMessage` / `NotificationRecord`）
- `alembic/env.py`（+4）— 新增 4 行 import，让 alembic autogenerate 能识别新模型

#### 4. 会议域扩展（既有 v1.1 基础上）

- `app/features/meeting/__init__.py`（+8）— 导出新公共 API（`submit_report` / `dispatch_action`）
- `app/features/meeting/schemas.py`（+93）— 新增 `ReportSubmit` / `ActionDispatch` / `ActionApproval` 3 套契约
- `app/features/meeting/service.py`（+214）— 3 个新服务函数：会议报告提交 / 工单派发 / 工单审批
- `app/features/meeting/router.py`（+56）— 3 个新端点：`POST /meetings/{id}/report` / `dispatch` / `action-approval`
- `app/features/meeting/event_bus.py`（+147 / -25）— 事件总线扩展：支持动作审批事件链
- `app/features/agent/models.py`（+67）— `AgentExecution` 模型加 `action_payload` 字段（适配派发场景）

#### 5. 演示工具集（`tools/`）

- `tools/verify_all.py`（+220）— 一键体检：DB 连通 / 用户存在 / RAG 索引 / 5 张表是否存在 / `pytest` 全绿
- `tools/seed_demo_data.py`（+180）— 演示种子：3 个用户 / 5 张新表各 5 行 / IM + 通知若干
- `tools/_check_db.py` / `_check_rag.py` / `_list_users.py` / `_reset_pwd.py` — 4 个 `_` 前缀的内部排查工具

#### 6. 部署 / 环境文件

- `.env.example`（+4 / -2）— 加 `MAINTENANCE_MODE=false` 与 `DASHBOARD_REFRESH_INTERVAL=30`
- `Dockerfile`（+4 / -3）— 加 `tools/` 目录 COPY（演示时容器内置种子）

#### 7. 关键数字

```
新增域: 4（approval / dashboard / im / notification）
新增端点: 11（审批 5 + 工作台 1 + IM 2 + 通知 2 + 会议 3）
新增表: 5（approvals / approval_actions / meeting_actions / notification_records / im_direct_messages）
新增工具: 7（1 主脚本 + 1 种子 + 1 一键体检 + 4 内部排查）
迁移脚本: 1（run_migration.py，幂等）
本机验证: 5 张表已 CREATE 成功
```

#### 8. 待办（未提交）

- ⚠ `tests/test_new_features.py` **未写**（计划写 11 个新端点的 pytest，但还没动笔，下次 session 补）
- ⚠ `requirements.txt` 是否需要加 `pymysql` 单独声明待 `pip freeze` 验证
- ⚠ `.env` 的 `MAINTENANCE_MODE` 字段暂未生效（`config.py` 加了字段但 service 未消费）

### 5.5 v1.1：答辩包装 — 43 张表全部 API 化 + pytest 28 用例全绿（10.5）  @小柒

- **触及文件**: 17 个（+2200 / -180），新增 7 个

#### 1. 数据库设计落地：43 张表 + 14 个新域端点

- 修 3 处导入链：`app/models/__init__.py`、`alembic/env.py`、`app/api/router.py`
- 合并 3 个 `domain_models.py` 到 `models.py`，删除冗余文件
- 修 alembic 分支冲突（003 down_revision 002 合并双 head）
- stamp + 手工补建 `user_sessions` 表（VARCHAR(19) 兼容 MySQL 5.7）
- **alembic current = 20261003_008（head）** ✅

#### 2. 三大新域 API 化

- **机构域（多租户隔离，亮点包装）**：
  - `app/features/organization/{schemas,service,router,__init__}.py` 新增
  - 9 个端点：POST/GET /organizations、GET /{org_id}、POST/GET /departments、POST/GET /business-domains、POST/GET /customer-types
- **智能办公域**：
  - `app/features/office/{schemas,service,router,__init__}.py` 新增
  - 5 个端点：POST/GET /office/templates、GET /templates/{id}、POST/GET /office/generated-contents
- **决策智能域（亮点三核心）**：
  - `app/features/decision/{schemas,service,router,__init__}.py` 新增
  - 9 个端点：POST/GET /decision/{regulations,news,business-impact,decision-playbacks}、POST /decision-playbacks/{id}/verify
  - **亮点三防篡改**：SHA-256 链式哈希 + 篡改检测（is_intact / is_tampered 自动置位）

#### 3. pytest 测试套件（28 个用例全绿）

- `tests/test_organization.py`（9 用例）
- `tests/test_office.py`（7 用例）
- `tests/test_decision.py`（10 用例，含亮点三防篡改端到端）
- `tests/conftest.py` 增补 8 个 feature model import（让 SQLite 建库识别全表）
- 5 个 LONGTEXT 字段改为 `Text().with_variant(LONGTEXT, "mysql")`（兼容 SQLite 测试 + MySQL 生产）
- **运行结果**：`28 passed, 1 warning in 1.66s` ✅

#### 4. 答辩包装资产生成器（`tools/generate_assets.py`）

- `docs/assets/architecture.png` — 43 张表按 10 个域分组的架构图（matplotlib + Microsoft YaHei 中文字体）
- `docs/assets/openapi.json` — 完整 OpenAPI 3.0 Schema 导出（评委可离线浏览）
- `docs/assets/api-endpoints.md` — 62 个 API 端点按 11 个域分类的 Markdown 清单

#### 5. 文档升级

- `docs/database-design.md` 升 v1.1，顶部加"实施状态表"——把"设计 vs 实现"差异透明化
- `docs/three-highlights-tech.md` 升 v2.1，顶部加"实现指针表"——**"你说亮点，我告诉代码在哪"**
- 路由顺序 bug：`GET /organizations/{org_id}` 误吞 `GET /business-domains`，重写 router 把字面量路径放前

#### 6. 答辩演示脚本

- `tools/demo_presentation.py` —— 一键演示：亮点一（多租户隔离）+ 亮点三（防篡改篡改前后对比）+ 智能办公
- 输出可截图：原始 verify is_intact=True → 模拟黑客篡改 outcome → 重新 verify is_intact=False，is_tampered 自动置位

#### 7. 关键数字

```
总表数: 43
API 端点: 62
新增端点: 14
pytest 用例: 28/28 全绿
亮点三防篡改: 端到端跑通
alembic_version: 20261003_008
```

### 5.6 修复：行业洞察 / AI 智能中心点击无跳转（10.6）  @小陆

> **本次合并**：原 10-02 00:33「恢复 AI 智能中心独立页面」最终态，保留。

#### 为什么改（手动）

`/dashboard` 「更多入口」两个核心卡片点击无反应：
- **行业洞察** → `path: '/insights'` 错误路径（实际路由为 `/industry-news`）
- **AI 智能中心** → `path: '/agent-hub'` 但 `/agent-hub` 在 2026-09-19 整合时被删除，且旧路由 `/qa /agent /chat /memory` 全部 `<Navigate to="/dashboard" />`，等于**入口挂着但路由走死胡同**

同期用户反馈"找不到单独的智能体问答页面"——`pages/QA.tsx` 文件存在但路由被屏蔽，等于功能缺失。

**决策**：恢复 AI 智能中心独立入口，但不复活 AgentHub 整合容器。保留 3 个独立页面 `QA` / `Agent` / `Chat`，`/memory` 重定向到 `/qa`（记忆管理视为问答子能力）。

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

## 累计产出（按甘特图 5 阶段汇总）

| 阶段 | 期间 | 团队 | 主要交付物 |
|------|------|------|-----------|
| 阶段一 | 6.28 — 7.16 | 全体 | 项目立项 / 需求 / 调研 / 技术方案 / Gitee 仓库 / 开发环境 |
| 阶段二 | 7.17 — 8.13 | 小柒 / 小汉 / 小陆 | 迁移 001~007 + 真实 Embedding/Qdrant/OCR 集成 + 前端 i18n/上交材料归档 |
| 阶段三 | 8.14 — 9.10 | 小柒 / 小陆 / 小汉 | 前端路由整合 + 亮点 1（4 Agent 协作会议 + 会后业务）+ 检索调优 + RAG 基线 + Docker 部署栈 |
| 阶段四 | 9.11 — 9.20 | 小忍 / 小陆 | 合规沙箱 0.3 + 4 Agent 黑板 1.1 + 行业资讯详情 + Dashboard 重构 + 死循环修复 |
| 阶段五 | 9.21 — 10.10 | 全体 | 合规沙箱 4 层防御 + 会议 Agent + v1.2 4 新域 + v1.1 答辩包装 + 真实 LLM 链路 |

**总计（关键数字）**：
- 后端：43 张表 / 62 端点 / pytest 28 用例全绿
- 前端：4 大亮点 + 19 模块 + 1000+ i18n key
- 部署：Docker 隔离栈 / 资源隔离 / Qdrant healthcheck
- 合规：4 层防御 + Kill Switch + 25 测试通过
- 黑板：4 Agent + 12 测试通过
- 真实 LLM 链路：deepseek 3709ms / doubao 2257ms / qwen 1629ms

<!-- AUTO:ENTRY-END -->