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

---

## 每日提交快照

<!-- AUTO:ENTRY-START -->

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
- \SandboxChatResponse\ 加 \isk_category\, \confidence\, \judge_source\
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

前端可基于 \isk_category\ 展示不同图标 / 文案 / 处置流程。
