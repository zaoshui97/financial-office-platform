# Dev Log（每日自动记录）

> 后端改动日志。仿照 `frontend/digital-horse/docs/delivery/dev-log.md` 的风格，
> 记录 sandbox / compliance / AI 等模块的迭代轨迹与决策依据。
>
> 手动编辑请保留区段标记 `<!-- AUTO:ENTRY-START -->` / `<!-- AUTO:ENTRY-END -->`，
> 便于后续接入 husky pre-commit 自动追加。

---

## 模块索引

| 模块 | 路径 | 职责 | 状态 |
|------|------|------|------|
| LLM Judge | `app/sandbox/llm_judge.py` | 调用 LLM Gateway 做语义风险判定 | ✅ v1 |
| Rule Engine | `app/sandbox/rule_engine.py` | 关键词 / 正则的快速风险匹配 | ✅ v1 |
| Service | `app/sandbox/service.py` | `check_text` 统一入口（规则 + LLM + 审计） | ✅ v1 |
| Kill Switch | `app/sandbox/kill_switch.py` | 沙箱熔断器（env / file / api 三触发） | ✅ v1 |
| Exceptions | `app/sandbox/exceptions.py` | 沙箱领域异常（`SandboxUnavailable` 等） | ✅ v1 |
| Audit | `app/features/compliance/audit.py` | 合规审计入库（SHA-256 摘要 + 场景元数据） | ✅ v1 |
| Sandbox Middleware | `app/core/middleware.py` | Kill-Switch HTTP 层最快拦截 | ✅ v1 |
| Ops Manual | `docs/沙箱应急操作.md` | 运维应急操作手册 | ✅ v1 |
| **行业资讯设计** | `docs/industry-news-design.md` | 一期规划 + 二期演进路径 | ✅ 设计完成 |
| **三大亮点技术** | `docs/three-highlights-tech.md` | 亮点技术内容清单（答辩用） | ✅ 设计完成 |

---

## 每日提交快照

<!-- AUTO:ENTRY-START -->

### 2026-10-05 16:15  @assistant  [docs(presentation): v1.1 答辩包装 - 43 张表全部 API 化 + pytest 28 用例全绿 + 架构图/OpenAPI 导出]

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

---



### 2026-10-06 18:30  @assistant  [feat(v1.2): 新增 4 个新域 — 审批 / 工作台总览 / 即时通讯 / 通知中心 + 5 张新表 + 演示工具集]

- **触及文件**: 24 个（+725 / -38），新增 25 个未跟踪文件（4 个新域模块 + 1 SQL + 1 迁移脚本 + 6 工具 + 13 个 `__pycache__` 已忽略）

#### 1. 4 个新业务域（前端联调基座）

- **审批域**（`app/features/approval/`）：
  - `models.py`（+154）— `Approval` / `ApprovalAction` 两表 SQLAlchemy 模型（已与 `migrations/2026_10_06_new_features.sql` 同步）
  - `schemas.py`（+80）— `ApprovalCreate` / `ApprovalOut` / `ApprovalActionCreate` 等 Pydantic 契约
  - `service.py`（+260）— 业务层：建审批 / 流转移交 / 拒绝动作审批 / 列表查询（含状态机）
  - `router.py`（+88）— 5 个端点：POST `/approvals`（创建）、GET `/approvals`（列表）、GET `/approvals/{id}`（详情）、POST `/approvals/{id}/approve`、`POST /approvals/{id}/reject`
- **工作台总览**（`app/features/dashboard/`）：
  - `models.py`（+148）— `MaintenanceRecord` 模型（虽然只 Mock）
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

- `migrations/2026_10_06_new_features.sql`（+148，新文件）— 一脚本建 5 张表：
  - `approvals`（含 state/created_by/approved_by/timestamp 索引）
  - `approval_actions`（含 `approval_id FK` + 操作类型枚举）
  - `meeting_actions`（与会后工单对齐，已规划）
  - `notification_records`（含 user_id / type / read_at）
  - `im_direct_messages`（含 sender_id / receiver_id / created_at）
- `scripts/run_migration.py`（+74，新文件）— 一键迁移：
  - 读 `.env` 里的 DB 配置（pymysql 直连，绕开 alembic）
  - 按 `;` 切 statement，单条执行，已存在就跳过（`1060` 错误吞）
  - **幂等**：可重复跑
  - **已在本机 MySQL 跑通**：5 张表全部 CREATE 成功 ✅

#### 3. 路由注册 + 配置打通

- `app/api/router.py`（+11 / -0）— 引入 4 个新 router，挂到 `/api/v1/{approval,dashboard,im,notification}`
- `app/core/config.py`（+14 / -0）— 加 `MAINTENANCE_MODE` / `DASHBOARD_REFRESH_INTERVAL` 两个开关
- `app/models/__init__.py`（+8 / -2）— 引入 4 个新模型（`Approval` / `ApprovalAction` / `ImDirectMessage` / `NotificationRecord`）
- `alembic/env.py`（+4 / -0）— 新增 4 行 import，让 alembic autogenerate 能识别新模型

#### 4. 会议域扩展（既有 v1.1 基础上）

- `app/features/meeting/__init__.py`（+8 / -0）— 导出新公共 API（`submit_report` / `dispatch_action`）
- `app/features/meeting/schemas.py`（+93 / -0）— 新增 `ReportSubmit` / `ActionDispatch` / `ActionApproval` 3 套契约
- `app/features/meeting/service.py`（+214 / -0）— 3 个新服务函数：会议报告提交 / 工单派发 / 工单审批
- `app/features/meeting/router.py`（+56 / -0）— 3 个新端点：`POST /meetings/{id}/report` / `dispatch` / `action-approval`
- `app/features/meeting/event_bus.py`（+147 / -25）— 事件总线扩展：支持动作审批事件链
- `app/features/agent/models.py`（+67 / -0）— `AgentExecution` 模型加 `action_payload` 字段（适配派发场景）

#### 5. 演示工具集（`tools/`）

- `tools/verify_all.py`（+220）— 一键体检：DB 连通 / 用户存在 / RAG 索引 / 5 张表是否存在 / `pytest` 全绿
- `tools/seed_demo_data.py`（+180）— 演示种子：3 个用户 / 5 张新表各 5 行 / IM + 通知若干
- `tools/_check_db.py` / `_check_rag.py` / `_list_users.py` / `_reset_pwd.py` — 4 个 `_` 前缀的内部排查工具（开发自查用）

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



### 2026-10-03 00:11  @fans  [feat(sandbox): add KillSwitch + exceptions + middleware + operational docs] — commit `36ae8ef`

- **触及文件**: 8 个（+768 / -30），新增 3 个

#### 1. Kill Switch 单例（145 行，新文件）

- `app/sandbox/kill_switch.py`（+145）— `KillSwitch` 进程单例（双重检查锁）：
  - **三种触发方式**（任一即熔断）：
    1. 环境变量 `SANDBOX_KILL_SWITCH=true`（最高优先级，重启生效）
    2. 文件标记 `.sandbox_killed`（运维 1 秒生效，进程重启仍存在）
    3. API `kill_switch.activate(reason)`（远程操作，写文件持久化）
  - **5 秒缓存 TTL** — 避免每次调用都读文件 / 查环境变量
  - **fail-safe** — 任何检查异常默认不熔断（不阻塞业务）
  - `activate()` 同时写文件，进程重启后仍生效
  - 模块级 `kill_switch` 单例直接 `from app.sandbox.kill_switch import kill_switch`

#### 2. 沙箱领域异常（99 行，新文件）

- `app/sandbox/exceptions.py`（+99）— 4 个异常类：
  - `SandboxError`（基类，含 `error_code` / `details`）
  - `SandboxUnavailable`（HTTP 503，含 `audit_id` / `kill_switch_reason`）
  - `SandboxConfigError`（HTTP 500，Provider 配置错误）
  - `SandboxLLMError`（HTTP 502，Provider 调用失败）

#### 3. service.py 加前置守卫

- `app/sandbox/service.py`（+88 / -17）— `check_text()` 入口处加 kill_switch 检查：
  - 守卫激活 → 抛 `SandboxUnavailable(error_code="SANDBOX_KILLED")`
  - 守卫触发时**也写审计**（`scenario.event_type=kill_switch_triggered`），留痕
  - `kill_switch` 参数支持 Protocol 注入（单测可 mock）
  - 新增 `_write_audit_kill_switch()` 私有方法

#### 4. 全局异常处理器

- `app/core/exceptions.py`（+27 / -1）— 新增 `sandbox_unavailable_handler`：
  - 返回 HTTP 503 + `{error_code, message, fallback, audit_id, kill_switch_reason, timestamp}`
  - 在 `register_exception_handlers()` 中注册

#### 5. HTTP 层中间件

- `app/core/middleware.py`（+52 / -0）— 新增 `SandboxKillSwitchMiddleware`：
  - 拦截 `/api/v1/compliance/sandbox/*` 路径
  - 在 `setup_middleware()` 最前注册（最早拦截）
  - 与 service 层守卫形成**双层防护**（中间件最快 / service 最兜底）

#### 6. Kill Switch API 拆分

- `app/features/compliance/router.py`（+34 / -23）：
  - `GET /kill-switch` — 读 `kill_switch.is_active()` / `reason`（不再依赖 `settings`）
  - `POST /kill-switch` — 激活（替代旧的 `toggle`，只接受 enabled=true）
  - `POST /kill-switch/resume` — 关闭（删除标记文件）

#### 7. 运维手册（263 行，新文件）

- `docs/沙箱应急操作.md`（+263）：
  - 3 种熔断方式 + 对应恢复命令
  - 状态查询 API、SQL 审计查询、告警接入建议
  - 三种触发优先级 + 故障排查

#### 8. 导出补全

- `app/sandbox/__init__.py`（+30 / -8）— 导出 `KillSwitch` / `kill_switch` / 4 个异常类

#### 关键决策

| 决策 | 理由 |
|------|------|
| 三层防御（middleware → service → audit） | 中间件最快拦截；service 业务层最后兜底；audit 留痕 |
| `.sandbox_killed` 标记文件持久化 | API 触发也写文件，进程重启不丢失熔断状态 |
| `SandboxUnavailable` 含 `audit_id` | 客户端拿到 503 也能定位到具体审计行 |
| 5 秒缓存 | 高频调用不重复读盘；紧急恢复可在 5 秒内生效 |
| `kill_switch` 接收 Protocol | 单元测试可 mock `KillSwitchLike`，不污染全局单例 |

---

### 2026-10-02 23:53  @fans  [feat(sandbox): add check_text unified entry + rule_engine] — commit `338f956`

- **触及文件**: 6 个（+575 / -7），新增 3 个

#### 1. Rule Engine（207 行，新文件）

- `app/sandbox/rule_engine.py`（+207）：
  - `Rule` dataclass（frozen，`id` / `pattern` / `severity` / `description`）
  - `RuleResult` dataclass（`risk_level` / `matched_rules` / `matched_intents` / `details`）
  - `RuleEngine.match(text)`：**字符串子串 + 正则双模匹配**，大小写不敏感
  - `SettingsRuleProvider` — 从 `settings.SANDBOX_RISK_KEYWORDS` 派生 `kw-NNN` 规则
  - `RuleProvider` Protocol — 可注入 DB / 远程配置

#### 2. service.py（304 行，新文件）

- `app/sandbox/service.py`（+304）：
  - `check_text(text, mode, biz_type, biz_id, user_id, db, rule_engine, llm_judge)`
  - **3 种 mode**：`rule_only` / `llm_only` / `combined`
  - **触发条件**：`combined` 且 rule 命中 `medium` / `high` → 才调 LLM（节省 token）
  - **合并策略**：`max(rule_severity, llm_severity)`；意图去重保序
  - **审计 fail-open**：写入失败 `logger.error` 后返回 `audit_id=None`，不抛异常
  - `scenario` 字段记录 `mode` / `biz_type` / `biz_id` / `rule_risk_level` / `llm_risk_level` / `llm_reasoning`

#### 3. 模型加 `scenario` 字段

- `app/features/compliance/models.py`（+7）— `ComplianceAuditLog.scenario: JSON`
- `app/features/compliance/audit.py`（+2）— `AuditPayload.scenario` 透传

#### 4. 迁移文件

- `alembic/versions/20260918_add_compliance_audit_logs_scenario.py`（+34）— `op.add_column scenario JSON`

#### 5. 导出补全

- `app/sandbox/__init__.py`（+28 / -11）— 导出 `Rule` / `RuleEngine` / `RuleResult` / `SettingsRuleProvider` / `check_text` / `VALID_MODES` / `LLM_TRIGGER_LEVELS`

#### 关键决策

| 决策 | 理由 |
|------|------|
| 沿用 `mode="compliance_sandbox"`，新增 `scenario` JSON | 不破坏现有 mode 语义；scenario 容纳所有 check 上下文 |
| `combined` 只在 rule 命中 medium/high 时调 LLM | low 风险不上 LLM，省 token + 降延迟 |
| 合并取**高**严重度 | 保守策略，宁误报不漏报（金融合规） |
| 意图去重保序 | 规则意图在前，LLM 意图在后，便于审计追溯 |
| 审计 fail-open | 审计故障不阻塞业务（合规底线 vs 业务可用性权衡） |

---

### 2026-10-02 23:45  @fans  [feat(sandbox): add LLMJudge for semantic risk assessment] — commit `72bdf70`

- **触及文件**: 2 个（+293 / -0），新增 2 个

#### 1. LLM Judge（282 行，新文件）

- `app/sandbox/llm_judge.py`（+282）：
  - `LLMJudge.assess(text, rules, task="risk_assessment") -> dict`
  - 返回 `{risk_level, matched_rules, matched_intents, reasoning}`
  - **`_extract_json_payload()` 容错解析** 3 段：
    1. 直接 `json.loads` 整段
    2. 抓 ` ```json ... ``` ` Markdown 围栏
    3. 抓首个 `{...}` 块（懒匹配跨行）
  - **失败降级**：LLM 异常或解析失败时返回 `risk_level="unknown"`，**不抛异常**
  - `_to_result()` 字段规范化：大写 level → 小写；列表元素类型清洗；`reasoning` 截断到 300 字
  - `gateway` 参数支持 Protocol 注入（duck-typing，便于单测 mock）
  - 系统提示词：金融合规严谨、不虚构企业制度、规则匹配要求返 `rule.id`

#### 2. 模块入口

- `app/sandbox/__init__.py`（+11）— 导出 `LLMJudge` / `JudgeResult`

#### 关键决策

| 决策 | 理由 |
|------|------|
| `task="risk_assessment"` 参数化 | 与 `.env` 的 `AI_TASK_ROUTES_JSON.risk_assessment` 路由配合；测试可覆盖 |
| 3 段 JSON 容错 | 国产 LLM 经常带 Markdown 围栏或夹杂中文 |
| 失败返回 `unknown` 不抛 | 让上层 `SandboxGuard` 决定降级策略 |
| `reasoning` 截断 300 字 | 防止 LLM 长输出撑爆审计字段 |
| `gateway: Protocol` 抽象 | 业务层解耦，单测可注入 mock（无需真实 LLM） |

---

<!-- AUTO:ENTRY-END -->

---

## 累计产出

| 时间 | 提交 | 模块 | 关键成果 |
|------|------|------|---------|
| 2026-10-02 23:45 | `72bdf70` | LLM Judge | 282 行：LLM 语义判定 + JSON 容错 |
| 2026-10-02 23:53 | `338f956` | Rule Engine + Service | 511 行：check_text 统一入口 + 审计 + 迁移 |
| 2026-10-03 00:11 | `36ae8ef` | Kill Switch + 体系 | 413 行：熔断 + 异常 + 中间件 + 运维手册 |
| 2026-10-03 15:55 | *(部署)* | SandboxAuditLog 新建 + 迁移 | 3 文件 + dev-log |
| 2026-10-03 16:00 | *(sink)* | sink 任务路由 | schemas / model_router / .env |

**总计：3 次提交 / 18 个文件 / +1633 行 / -37 行 + 2 次部署排障 + 1 次路由修复**

---

### 2026-10-03 15:45  @fans  [部署验证：迁移 + kill_switch 端到端]

#### 1. 本地环境问题

部署过程中发现 3 个串联障碍：

| 障碍 | 报错 | 根因 |
|---|---|---|
| ① `alembic` 命令找不到 | `'alembic' is not recognized` | 虚拟环境未激活；改用 `python -m alembic` |
| ② Access denied | `(1045, "Access denied for user 'root'@'localhost'")` | `.env` 中 `DATABASE_PASSWORD=` 留空 |
| ③ Unknown database | `(1049, "Unknown database 'financial_office'")` | 数据库本身尚未 `CREATE` |
| ④ Table doesn't exist | `(1146, "Table 'compliance_audit_logs' doesn't exist")` | **历史 bug**：`compliance_audit_logs` 表无对应创建迁移，模型存在但缺 schema |

#### 2. 修复动作

1. **补 `.env` 里的 MySQL 密码**（DATABASE_PASSWORD）
2. **Workbench 手动建库**：`CREATE DATABASE financial_office CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
3. **Workbench 手动建表** `compliance_audit_logs`（含 `user_id` / `text_sha256` / `matched_rules` JSON / `risk_level` 等列 + 3 个索引）
4. **`alembic upgrade head`** → 输出 `Running upgrade 20260917_007 -> 20260918, add compliance_audit_logs.scenario`

#### 3. kill_switch 端到端验证

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

#### 4. 遗留问题

- **`compliance_audit_logs` 表无创建迁移**——本次靠 Workbench 手动建表凑合，**下次新环境部署会同样踩坑**。
- 待办区已加入 `补 compliance_audit_logs 基线迁移` 项。

---

## 待办 / 后续

- [x] 用户本地执行 `alembic upgrade head` 应用 `scenario` 字段迁移（2026-10-03 完成）
- [ ] 接入监控告警（参考 `docs/沙箱应急操作.md` 第 6 节）
- [ ] Kill Switch API 接入钉钉 / PagerDuty 自动化
- [ ] 单测覆盖 `SandboxKillSwitchMiddleware` 端到端路径
- [ ] 编写 pytest 套件（当前用 `scripts/_test_*.py` 临时验证）
- [ ] **行业资讯一期**：预制数据 + LLM 摘要 + 归档到知识库（详见 `docs/industry-news-design.md`）
- [ ] 法规变更 AI 对比（3.2）— **二期规划**，比赛路演时主动说明
- [ ] 真实爬虫 / RSS 接入（证监会 / 央行）— 二期
- [ ] 真实钉钉/企微集成 — 二期，NotifierService 接口 + Mock 包装先上

---

### 2026-10-03 15:55  @fans  [新增 SandboxAuditLog 模型 + Alembic 迁移]

#### 1. 需求

新增精简版审计表 `sandbox_audit_log`，仅记录"风险检查事件"本身，与已有 `compliance_audit_logs`（LLM 调用完整链路审计）并存。

#### 2. 字段清单（按需求映射）

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

#### 3. 索引

| 索引名 | 列 | 用途 |
|---|---|---|
| `idx_sandbox_audit_user_created` | (user_id, created_at) | 按用户查历史 |
| `idx_sandbox_audit_biz` | (biz_type, biz_id) | 按业务对象查 |
| `idx_sandbox_audit_risk` | (risk_level) | 按风险等级筛选 |

#### 4. 变更文件

- 🆕 `app/sandbox/audit.py` — `SandboxAuditLog` 模型（96 行）
- 🆕 `alembic/versions/20260919_add_sandbox_audit_log.py` — upgrade + downgrade（67 行）
- ✏️ `app/sandbox/__init__.py` — 导出 `SandboxAuditLog`，更新模块顶部文档

#### 5. 验证

```powershell
python -m alembic upgrade head
python -m alembic current
# → 应输出 20260919

python -c "from app.sandbox import SandboxAuditLog; print(SandboxAuditLog.__tablename__)"
# → sandbox_audit_log
```

迁移链路：`20260917_007 → 20260918 → 20260919 (head)`

#### 6. 与已有审计表的差异

| 维度 | `compliance_audit_logs` | `sandbox_audit_log`（新增） |
|---|---|---|
| 定位 | LLM 调用完整链路 | 风险检查事件（精简） |
| 字段数 | 16 个（含 prompt_preview/answer_preview） | 9 个（核心字段） |
| 原文存储 | 仅脱敏预览 | 仅哈希 |
| 外键 | user_id 有外键 | 无外键 |

---

### 2026-10-03 16:00  @fans  [sink 任务路由：qwen3_max / deepseek_v3]

#### 1. 问题

`sink` 任务（文件下沉 / 研报总结类）在 `.env` 中未配置路由，导致 fallback 到 default 候选，不确定实际调了哪个模型。

#### 2. 改动

**① `app/ai/schemas.py` — `AITask` 枚举加 `SINK`**

```python
SINK = "sink"
```

**② `app/ai/model_router.py` — `_builtin_routes()` 加兜底路由**

```python
AITask.SINK.value: ["qwen3_max", "deepseek_v3"],
```

**③ `.env` — 两行配置**

```env
AI_TASK_ROUTES_JSON={..., "sink":["qwen3_max","deepseek_v3"]}
AI_MODEL_PROFILES_JSON={
  "qwen3_max":{"provider":"qwen","model":"qwen3.8-flash","temperature":0.3,"supports_long_context":true,"supports_tools":true},
  "deepseek_v3":{"provider":"deepseek","model":"ep-m-20260725121915-nrpgs","temperature":0.3,"supports_long_context":true,"supports_tools":true}
}
```

> **注意**：`.env` 不支持多行 JSON 值，全部压在一行。

#### 3. 验证结果

```
SINK enum: sink
sink candidates: ['qwen3_max', 'deepseek_v3']
sink first provider: qwen
sink first model: qwen3.8-flash
```

sink 任务优先走 `qwen3.8-flash`（qwen provider），fallback `deepseek_v3`（deepseek provider）。

### 2026-10-03 17:50  @fans  [feat(compliance): 4 层防御 + LLM Judge + 风险分类] — \eature/sandbox-4layer\

**目标**：把合规沙箱从「30 个硬匹配词」升级到「4 层防御 + 语义判断 + 风险分类」，
让准确度从 50% 提升到 90%+，满足前端项目的合规需求。

#### 1. 4 层防御架构

| 层 | 名称 | 实现 | 拦截依据 |
|----|------|------|----------|
| L1 | Kill Switch | \guard.check_kill_switch\ | 紧急熔断开关 |
| L2 | 风险词硬匹配 | \guard.check_risk_keywords\ | 205 个金融行业词 + 9 类分类 |
| L3 | PII 脱敏 | \sanitizer.py\（未变）| 正则：手机/身份证/银行卡/邮箱 |
| L4 | LLM Judge 语义判断 | \guard.llm_judge_check\ | JSON 分类 + 置信度阈值 |

#### 2. 关键改动

**① \pp/features/compliance/keywords.py\（新建）**
- 9 大类别 × 平均 23 个词 = **205 个风险词**
- 类别：money_laundering / insider_trading / tax_evasion / bribery /
  privacy_leak / illegal_commitment / conflict_of_interest /
  illegal_finance / regulatory_evasion
- 提供 \get_all_risk_keywords()\ 兼容旧 \SANDBOX_RISK_KEYWORDS\ 字符串配置

**② \pp/features/compliance/guard.py\ — 4 层防御**
\\\python
@dataclass(frozen=True)
class GuardDecision:
    allowed: bool
    blocked_reason: str | None
    risk_hits: list[str]
    risk_category: str | None   # ← 新增：9 类分类
    confidence: float           # ← 新增：0-1
    judge_source: str           # ← 新增：rule / llm_judge
\\\

\\\python
# LLM Judge prompt：让 LLM 当合规律师
\\\

**③ \pp/features/compliance/{schemas,service,audit}.py\ — 透传分类**
- \SandboxChatResponse\ 加 \
isk_category\, \confidence\, \judge_source\
- \AuditPayload\ 加同样字段
- service.py 写审计时同步记录
- 拦截时 422 detail 也带分类

**④ \lembic/versions/20261003_add_audit_risk_category.py\（新建）**
\\\sql
ALTER TABLE compliance_audit_logs
  ADD COLUMN risk_category VARCHAR(32),
  ADD COLUMN confidence FLOAT,
  ADD COLUMN judge_source VARCHAR(16);
CREATE INDEX idx_compliance_audit_category ON compliance_audit_logs(risk_category);
\\\

**⑤ \pp/core/config.py\ — 新配置**
\\\python
SANDBOX_LLM_JUDGE_ENABLED: bool = True
SANDBOX_LLM_JUDGE_CONFIDENCE_THRESHOLD: float = 0.7
SANDBOX_LLM_JUDGE_PROVIDER: str = ""
SANDBOX_LLM_JUDGE_TIMEOUT_MS: int = 15000
\\\

**⑥ \.env\ — 降级策略**
\\\env
SANDBOX_DEGRADATION_POLICY=fallback  # 沙箱 Provider 不可用时降级到普通 LLM
\\\

#### 3. 测试结果

测试脚本：\scripts/test_sandbox_accuracy.py\（34 个用例）

| 维度 | 通过率 | 备注 |
|------|--------|------|
| 硬匹配拦截（18 例）| **100%** | 18/18 全部命中正确分类 |
| 风险分类（9 类）| **7 类 100%** | 仅 regulatory_evasion / general 有偏差 |
| LLM Judge 抓语义违规 | 50%（3/6）| 3 个 timeout 是 LLM 慢 |
| PII 脱敏 | **超时挂掉** | 待 Provider 配置稳定后再跑 |

**整体通过率：24/34 = 70.6%**

#### 4. 已知问题与下一步

1. **LLM Judge timeout**：deepseek-reasoner 太慢（9-15s/次），需改 \deepseek-chat\
2. **Provider 503**：dev 环境 base_url 不是内网后缀，需用 \allback\ 策略
3. **合规知识误拦**：「反洗钱是什么」会被拦 → 已加 LLM 复核机制（见 guard.py）
4. **多轮上下文审计**：未做，列入 P1 backlog

#### 5. 前端可消费的新字段

\\\	ypescript
// SandboxChatResponse 新增
{
  risk_category: 'money_laundering' | 'insider_trading' | ...,
  confidence: 0.92,
  judge_source: 'rule' | 'llm_judge'
}
\\\

前端可基于 \risk_category\ 展示不同图标 / 文案 / 处置流程。

---

### 2026-10-03 18:25  @fans  [feat(agent): 会议 Agent 数据模型 — MeetingSession / Blackboard / AgentExecution]

**目标**：为后续会议场景的 4 Agent（moderator/noter/decision/dispatcher）建立数据底盘，
让黑板共享、Agent 执行追踪有 MySQL 表可依赖。

#### 1. 3 张表

| 表 | 关键字段 | 用途 |
|---|---|---|
| `meeting_sessions` | title / host_user_id / status | 主持人发起的会议会话 |
| `meeting_blackboard` | session_id / agent_role / state_json / **version** | 4 Agent 共享状态，乐观锁 |
| `agent_executions` | session_id / agent_role / trigger / input_snapshot / output / status | 每次 Agent 调用的快照 |

#### 2. 角色与生命周期枚举

- **AgentRole**: `moderator` / `noter` / `decision` / `dispatcher`
- **MeetingStatus**: `preparing` → `active` → `closed`
- **AgentExecutionStatus**: `thinking` → `done` / `failed`
- **AgentTrigger**: `speech_chunk` / `state_update`

#### 3. 关键设计

- `meeting_blackboard` 唯一索引 `(session_id, agent_role)`：每个 Agent 在每个会议里只有一行最新状态
- `version` 字段：乐观锁，配合 BlackboardService 防并发写冲突
- `output` 用 **TEXT**（不要 VARCHAR(65535)，MySQL 单行 VARCHAR 上限 16383）

#### 4. 变更文件

- 🆕 `app/features/agent/models.py` — 3 张表 + 4 个枚举（140 行）
- 🆕 `app/features/agent/__init__.py` — 导出所有模型
- ✏️ `alembic/env.py` + `app/models/__init__.py` — 注册 agent 模块
- 🆕 `alembic/versions/9ca81cc70198_add_meeting_agent_tables.py` — autogenerate

#### 5. 踩坑记录

1. **VARCHAR(65535) 报错**：MySQL `ERROR 1074 Column length too big`，改成 Text 即可
2. **DDL 部分提交**：第一次 migration 因 VARCHAR 失败，但前面 3 张表已在 DB 生效（MySQL DDL 非事务），第二次重跑又报 1050 已存在
3. **手工补建**：写 `scripts/fix_meeting_tables.sql` 补建 `agent_executions` + `meeting_blackboard`，然后 `alembic stamp 9ca81cc70198` 标记版本对齐

最终 DB 表：`meeting_sessions / meeting_blackboard / agent_executions / blackboard_sessions / blackboard_events`

---

### 2026-10-03 18:55  @fans  [feat(agent): BlackboardService — 乐观锁 + 内存缓存 + 订阅]

**目标**：实现共享黑板的业务层封装，MySQL 是真相源、进程内 dict 是缓存、写后通知回调（WebSocket 推送由调用方在 callback 里实现）。

#### 1. BlackboardService 核心 API

```python
class BlackboardService:
    def write(session_id: int, agent_role: str, state: dict) -> int:
        """乐观锁写入，返回新 version。冲突自动重试 3 次。"""

    def read_one(session_id: int, agent_role: str) -> dict: ...
    def read_all(session_id: int) -> dict[str, dict]: ...
    def subscribe(session_id: int, callback: StateCallback) -> int: ...
    def unsubscribe(session_id: int, callback_id: int) -> None: ...
```

回调签名：`StateCallback = Callable[[session_id, agent_role, state, version], None]`

#### 2. 数据流

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

#### 3. 关键设计决策

| 设计 | 实现 | 理由 |
|---|---|---|
| **乐观锁防冲突** | `UPDATE ... WHERE version = old_version`，rowcount=0 则冲突 → 重试 3 次 | 简单可靠，比悲观锁轻 |
| **进程内 dict 缓存** | `dict[session_id, dict[agent_role, state]]` | 不引入 Redis，单进程够用 |
| **写后同步通知** | 回调列表快照后同步触发 | 保证顺序、避免异步丢事件 |
| **回调抛错隔离** | 每个 callback 独立 try/except | 一个 WebSocket 挂了不影响其他订阅者 |
| **state 大小校验** | JSON 编码 > 64KB 拒绝 | 防 OOM |

#### 4. 踩坑

- **Core update() 不触发 onupdate hook**：原本想靠 `onupdate=func.now()` 自动更新 `updated_at`，但 SQLAlchemy Core update 走 ORM 钩子失效。修复：UPDATE 时显式 `values(updated_at=func.now())`

#### 5. 集成测试结果

```
会议 sid = 2
写入 4 角色 versions = 1,1,1,1
覆盖写 version = 2                       ← moderator 重复写 → version 自增
read_all = {moderator, noter, decision, dispatcher} ← 4 角色状态全在
回调触发次数 = 1 | [('noter', 2, None)] ← subscribe + 写后通知
```

#### 6. 变更文件

- 🆕 `app/features/agent/blackboard.py` — BlackboardService + BlackboardConflictError（200 行）
- ✏️ `app/features/agent/__init__.py` — 暴露 BlackboardService
- 🆕 `scripts/fix_meeting_tables.sql` — 手工补建 2 张缺失表
- ✏️ `alembic/versions/9ca81cc70198_add_meeting_agent_tables.py` — output 改 Text

#### 7. 下一步

| 步骤 | 内容 |
|---|---|
| `meeting_router.py` | REST：`POST /meetings` / `POST /blackboard/write` / `GET /blackboard/all` |
| `meeting_ws.py` | WebSocket：`/ws/meetings/{id}` 把 BlackboardService 的回调广播给前端 |
| `meeting_service.py` | 业务编排：会议生命周期 + 触发 Agent 写黑板 |

---

### 2026-10-03 19:00  @fans  [今日总结：会议 Agent 数据底盘完成]

#### 1. 今日完整链路

```
17:50 → 合规沙箱 4 层防御 + LLM Judge + 风险分类       (commit 42bd2a7)
17:50 → 风险词词库 100+ / Judge prompt / 测试集       (commit 7c87fa5)
18:25 → 会议 Agent 数据模型（3 张表）                 (commit f453cff)
18:55 → BlackboardService 乐观锁 + 缓存 + 订阅        (commit 9d503b7)
```

#### 2. 会议 Agent 体系全景

```
[会议主持人] → 创建 meeting_session (preparing → active → closed)
                  ↓
        ┌─────────────────────────────────────┐
        │  4 个 Agent 角色                    │
        │  moderator  控场 / 计时              │
        │  noter      转写 / 摘要              │
        │  decision   议题 / 方案推荐          │
        │  dispatcher 待办 / 任务分发           │
        └─────────────────────────────────────┘
                  ↓ 各自写
        ┌─────────────────────────────────────┐
        │  BlackboardService                  │
        │  · MySQL 持久化（乐观锁 version）    │
        │  · 进程内 dict 缓存                  │
        │  · write 后同步通知订阅者            │
        └─────────────────────────────────────┘
                  ↓ callback
        [WebSocket 广播] → 前端实时看到状态变化
```

#### 3. 数据落地

```
DB: meeting_sessions / meeting_blackboard / agent_executions
    + 原有: blackboard_sessions / blackboard_events
Migration: 9ca81cc70198_add_meeting_agent_tables.py (已 stamp)
```

#### 4. 明日计划（P1）

- `meeting_router.py` REST 路由
- `meeting_ws.py` WebSocket 推送
- `meeting_service.py` 业务编排 + 触发 Agent 写黑板

---

### 2026-10-03 22:30  @fans  [P1+P2+事件总线 + 前端联调骨架]

#### 1. 今日后半段 commit

```
20:10 → 会议元数据 topic/agenda/current_phase 入 MeetingSession 表
20:25 → 黑板事件回放：meeting_blackboard_events 表 + GET /blackboard/events
20:40 → 事件总线：moderator→noter→decision→dispatcher 自动触发链
```

#### 2. P1：会议元数据入表

- `MeetingSession` 加 `topic / agenda / current_phase` 3 字段
- `MeetingPhase` 枚举：open / discussing / closing / closed
- `_to_read` 直接读表，不再从 moderator 黑板拼
- `_sync_phase_from_state` 在 Agent 写完时同步合法 phase 回表
- alembic 迁移：`20261003_001_add_meeting_metadata.py`
- 8 场景集成测试全通过（含旧数据 NULL 兼容）

#### 3. P2：黑板事件回放

- 新表 `meeting_blackboard_events`（区分老 `blackboard_events`，避开 MetaData 冲突）
- 字段：session_id / agent_role / version / state / created_at
- `BlackboardService.write` 成功后 1 次 INSERT 落事件（同事务）
- 新增 `GET /api/v1/meetings/{id}/blackboard/events?since_event_id=N&limit=200`
- 踩到 2 坑：
  - MySQL 5.7 不支持 DATETIME DEFAULT CURRENT_TIMESTAMP(6) → 改 `now()`
  - per-agent version 与全表 id 混用歧义 → 改用全局 `since_event_id`
- 8 场景集成测试全通过

#### 4. 事件总线 + 默认触发链

- 新文件 `app/features/meeting/event_bus.py`
- `BlackboardService.subscribe_global(callback)` 全局订阅（不绑 session）
- `BlackboardService.write` 自动注入 `event_type = "{role}_updated"`
- 默认链：`moderator_updated → noter → decision → dispatcher`
- 启动时机：`ws.py get_blackboard_service()` 首次创建时懒装（幂等）
- 错误隔离：双重 try/except（_notify + chain 内部）
- 5 场景集成测试全通过

#### 5. 前端联调骨架（在 `frontend/digital-horse/` 独立 repo）

新增：
- `src/api/meeting.ts`        REST 类型 + API 封装
- `src/api/meetingWs.ts`     WS 客户端 + 重连 + 增量同步
- `src/store/meetingStore.ts` zustand 状态管理
- `src/pages/Meeting/index.tsx`   列表页 + 新建会议 Modal
- `src/pages/Meeting/Detail.tsx`  详情页 + 4 Agent 黑板展示 + WS 推送
- `router.tsx` 注册 `/meetings` + `/meetings/:id`

WS 客户端特性：
- 指数退避重连：1s → 2s → 5s → 10s → 30s 封顶
- 重连后调 `/blackboard/events?since_event_id=N` 增量补齐
- 按 (role, version) 合并，乱序丢弃
- 心跳：服务端每 30s 推 ping，客户端无需响应

#### 6. 下一阶段计划（已锁定）

- [A] 前端联调骨架 ✅ 本次
- [C] 压测：4 agent 串行触发链性能基线
- [D] 鉴权：JWT 过期 → WS 自动断 + REST 401 统一
- [B] LLM Gateway：抹 mock，接入真实 Provider

---

### 2026-10-03 23:30  @fans  [前端联调骨架 + 压测 + 鉴权加固 + 真实 LLM 链路验证]

#### 1. 今日后半段 commit（7 个）

```
20:10 → 会议元数据 topic/agenda/current_phase 入表                f534231
20:25 → 黑板事件回放：meeting_blackboard_events + GET /events       0ef5273
20:40 → 事件总线：moderator→noter→decision→dispatcher 自动链       70a03e4
21:00 → 前端联调骨架（在 frontend/digital-horse/ 独立 repo）
       · src/api/meeting.ts · meetingWs.ts
       · src/store/meetingStore.ts (zustand)
       · src/pages/Meeting/index.tsx (列表 + 新建)
       · src/pages/Meeting/Detail.tsx (详情 + 4 Agent 黑板 + WS)
       · router.tsx 注册 /meetings + /meetings/:id
21:30 → 压测：触发链 p50=228ms p95=260ms (LLM 50ms×4)              061e9ea
21:45 → 鉴权加固：统一错误响应 + WS token watchdog               f1c4966
22:00 → 真实 LLM 链路：deepseek 3709ms / doubao 2257ms / qwen 1629ms 145766c
22:15 → dev-log 总结                                            [本次]
```

#### 2. A. 前端联调骨架

- `src/api/meeting.ts`        REST 类型 + API 封装
- `src/api/meetingWs.ts`     WS 客户端 + 指数退避重连 + 增量同步
- `src/store/meetingStore.ts` zustand 状态管理
- `src/pages/Meeting/index.tsx`   列表页 + 新建会议 Modal
- `src/pages/Meeting/Detail.tsx`  详情页 + 4 Agent 黑板展示 + WS 推送

WS 客户端特性：
- 指数退避重连：1s → 2s → 5s → 10s → 30s 封顶
- 重连后调 `/blackboard/events?since_event_id=N` 增量补齐
- 按 (role, version) 合并，乱序丢弃
- 心跳：服务端每 30s 推 ping，客户端无需响应
- token 过期不重连（onAuthFailure 回调）

#### 3. C. 压测基线

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

#### 4. D. 鉴权加固

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

#### 5. B. 真实 LLM 链路

- `app/ai/router.py`（新增）
    - GET /api/v1/ai/diagnostics — 手动触发三方 ping
    - GET /api/v1/ai/diagnostics/profiles — 仅元数据
    - 需要鉴权，不自动跑

真实调用延迟（2026-10-03 21:34）：
- deepseek  3709 ms  success
- doubao    2257 ms  success
- qwen      1629 ms  success

5 场景集成测试全通过，链路全通。

#### 6. 今日 commit 总览（16 个）

```
17:50  42bd2a7  合规沙箱 4 层防御
17:50  7c87fa5  风险词词库 100+
18:25  f453cff  会议 Agent 数据模型
18:55  9d503b7  BlackboardService 乐观锁
19:05  11019d0  dev-log 完整记录
19:15  49ceda9  4 Agent 实现
19:30  847dc3e  meeting REST 路由
19:55  34d8564  WebSocket + 单例化
20:10  f534231  会议元数据入表
20:25  0ef5273  黑板事件回放
20:40  70a03e4  事件总线触发链
21:00  9a84bf4  dev-log (A+C+D+B 段)
21:30  061e9ea  压测基线
21:45  f1c4966  鉴权加固
22:00  145766c  真实 LLM 链路
22:15  [本次]    dev-log 总结
```

#### 7. 下一阶段候选

- [并发压测] uvicorn + 连接池扩容后跑 10+ 并发会议
- [LLM 流式] 把 BaseAgent 改造为支持 stream_chat，前端拿增量输出
- [生产部署] Docker + ACS / 阿里云镜像仓库（DEPLOY.md 待补）
- [鉴权刷新] JWT refresh token（当前只有 access，过期需重新登录）
- [前端 e2e] Playwright 端到端测试 WS 断线重连
