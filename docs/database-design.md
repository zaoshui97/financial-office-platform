# 金融智能办公平台数据库设计文档

> **版本**：v1.1
> **项目**：金融智能办公平台（Financial Office Platform）
> **用途**：恒生电子 2026 技术比赛答辩
> **数据库**：MySQL 8.0 + Qdrant 向量数据库
> **最后更新**：2026-10-05

---

## 〇、实施状态（v1.1 新增 · 答辩重点）

> **截至 2026-10-05，43 张表 + 3 大新域 API 已全部落库并端到端跑通。**

| 业务域 | 表数 | ORM 模型 | 迁移 | REST API | 端到端验证 |
|--------|------|----------|------|----------|------------|
| **机构域**（多租户隔离） | 4 | ✅ `app/features/organization/models.py` | ✅ 007 | ✅ 9 个端点 | ✅ |
| **会议协同域**（亮点一） | 5 | ✅ `app/features/meeting/models.py` | ✅ 003 | ✅ 已就绪 | ✅ |
| **合规审计域**（亮点二） | 5 | ✅ `app/features/compliance/models.py` | ✅ 004 | ✅ 已就绪 | ✅ |
| **金融知识中枢·可插拔AI底座**（亮点三） | 3 | ✅ `app/features/rag/models.py` | ✅ 003 | ✅ 已就绪 | ✅ RAG + Qdrant |
| **决策智能域** | 6 | ✅ `app/features/decision/models.py` | ✅ 005 | ✅ 9 个端点 | ✅ 防篡改 verify 端到端通过 |
| **多Agent协作域** | 3 | ✅ `app/features/agent/models.py` | ✅ 006 | ✅ | ✅ |
| **智能办公域** | 2 | ✅ `app/features/office/models.py` | ✅ 006 | ✅ 5 个端点 | ✅ |
| **权限管控域** | 4 | ✅ `app/features/auth/models.py` | ✅ 007 | ✅ | ✅ |
| **核心基础域** | 11 | ✅（已存在） | ✅ | ✅ | ✅ |

**亮点三防篡改演示**（`python tools/demo_presentation.py`）：

```text
[步骤 A] 原始 verify            → is_intact=True  ✅
[步骤 B] UPDATE outcome='被黑客修改'
[步骤 C] 重新 verify            → is_intact=False，is_tampered 自动置位  ✅
```

**`alembic_version` = `20261003_008`**（最新）

### 相关资源

> 以下文件随项目 zip 包一同提交，解压后在 `docs/assets/` 目录下即可查看。

| 资源 | 文件名 |
|------|--------|
| 架构图 | `architecture.png` |
| API 端点清单 | `api-endpoints.md` |
| OpenAPI Schema（可导入 Postman / Swagger UI） | `openapi.json` |

_一键重新生成以上三件：命令行执行 `python tools/generate_assets.py`_

---

## 一、数据库概览

### 1.1 设计理念

```
"金融级数据库设计 = 多租户隔离 + 7段链路指纹审计 + 全链路防篡改 + 行业特色字段"
```

本数据库设计遵循以下核心原则：

| 原则 | 体现 |
|------|------|
| **多租户隔离** | `organizations` → `departments` → `users` 三级隔离 |
| **数据主权** | 原文永不落库，只存脱敏文本 + SHA-256/SM3 哈希 |
| **防篡改** | `audit_logs` 链式哈希 + `decision_playbacks` 不可篡改哈希 |
| **金融合规** | 9 大风险分类 + 监管套利识别 + SM3 国密算法 |
| **全链路可追溯** | 7 段链路指纹（意图解析 → RAG检索 → Prompt构造 → 模型调用 → 输出校验 → 用户确认 → 执行落地） |

### 1.2 六大业务域

```
┌─────────────────────────────────────────────────────────────────┐
│                    金融智能办公平台 · 数据库                        │
├──────────────┬──────────────┬──────────────┬───────────────────┤
│  ① 会议协同域  │ ② 合规审计域  │ ③ 决策智能域  │  ④ 多Agent协作域  │
│   5 张表      │   5 张表      │   6 张表      │   3 张表           │
├──────────────┼──────────────┼──────────────┼───────────────────┤
│  ⑤ 智能办公域  │ ⑥ 权限管控域   │              │                   │
│   2 张表      │   4 张表      │              │                   │
├──────────────┴──────────────┴──────────────┴───────────────────┤
│                      机构域（机构 + 部门 + 业务 + 客户）           │
│                         4 张表（跨域复用）                        │
├─────────────────────────────────────────────────────────────────┤
│                      核心基础域（已有点）                          │
│    users(9) + chat_conversations(5) + chat_messages(8)         │
│    + knowledge_bases(6) + knowledge_documents(17)             │
│    + document_chunks(14) + alembic_version(1)                   │
├─────────────────────────────────────────────────────────────────┤
│                  总计：39 张表（18 已有点 + 21 新增）              │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 命名规范

```
表名：snake_case，复数形式，全小写
示例：meetings, policy_rules, audit_logs

字段：
  - 主键：id (BIGINT, AUTO_INCREMENT)
  - 外键：xxx_id
  - 业务唯一键：xxx_no / xxx_code
  - 时间：xxx_at (DATETIME)
  - 状态：xxx_status / xxx_state
  - JSON：xxx_data / xxx_config / xxx_result

索引命名：
  - 主键索引：pk_xxx
  - 普通索引：idx_xxx_field (field2...)
  - 唯一索引：uk_xxx_field (field2...)
```

---

## 二、ER 关系图（全局）

```
                                    ┌──────────────────┐
                                    │  organizations    │ ← 机构/租户（多租户隔离根）
                                    │  (多租户隔离根)    │
                                    └──────┬───────────┘
                                           │ 1:N（机构 → 部门）
                                           ▼
┌──────────────────┐              ┌──────────────────┐
│    users          │ 1:N         │   departments     │
│  ┌──────────────┐ │ ──────────► │                  │
│  │ organization_id│ │             │  (树形部门)       │
│  │ department    │ │             └──────┬───────────┘
│  │ position      │ │                    │ 1:N（部门 → 用户角色）
│  │ business_line │ │                    ▼
│  │ compliance_lvl │ │             ┌──────────────────┐
│  └──────────────┘ │             │   user_roles      │
│          │         │             │ (用户-角色-部门)    │
│          │         │             └──────┬───────────┘
│          │         │                    │
│          ▼         │                    ▼
┌──────────────────┐ │   ┌──────────────────┐     ┌──────────────────┐
│    chat_conversations│  │      roles        │◄───│   permissions     │
│                    │ │   └──────────────────┘     └──────────────────┘
└────────┬─────────┘ │
         │ 1:N        │
         ▼            │        ┌──────────────────────────────────────────┐
┌──────────────────┐ │        │          会议协同域（5 张）                │
│   chat_messages  │ │        │                                          │
│  ┌──────────────┐ │        │  meetings ─── 1:N ── meeting_participants  │
│  │ citations(JSON)│ │        │       │                                  │
│  └──────────────┘ │        │       │ 1:1                                │
└──────────────────┘ │        │       ▼                                  │
                      │        │  meeting_minutes ── 1:N ── meeting_todos  │
                      │        │       │                                  │
┌──────────────────┐ │        │       │                                  │
│  knowledge_bases  │ │        │       1:N                                 │
└────────┬─────────┘ │        │       ▼                                  │
         │ 1:N        │        │  meeting_transcripts                     │
         ▼            │        │                                          │
┌──────────────────┐ │        └──────────────────────────────────────────┘
│ knowledge_documents│ │
└────────┬─────────┘ │
         │ 1:N        │        ┌──────────────────────────────────────────┐
         ▼            │        │          合规审计域（5 张）                │
┌──────────────────┐ │        │                                          │
│  document_chunks  │ │        │  policy_rules ── 1:N ── policy_violations│
│  ┌──────────────┐ │        │       │              │                     │
│  │ vector_id    │ │        │       │              ▼                     │
│  │ embedding_xxx│ │        │       │       audit_logs (7段指纹)         │
│  └──────────────┘ │        │       │              │                     │
└───────────────────┘        │       │              ▼                     │
                              │       │       risk_alerts                  │
         ┌─────────────────────────────┼───────────────────────────────┤
         │       决策智能域（6 张）   │       多Agent协作域（3 张）   │
         │                            │                              │
         │  regulations               │  agent_configs               │
         │       │                    │       │                     │
         │       │ 1:N                │       │ 1:N                  │
         │       ▼                    │       ▼                     │
         │  regulation_versions       │  agent_tasks                 │
         │       │                    │       │                     │
         │       │ 1:N                │       │ 1:N                  │
         │       ▼                    │       ▼                     │
         │  regulation_diff_reports   │  agent_collaborations        │
         │                            │                              │
         │  industry_news             │──────────────────────────────┤
         │       │                                                  │
         │       │ 1:N                                               │
         │       ▼                                                  │
         │  business_impact                                        │
         │                                                         │
         │  decision_playbacks (防篡改哈希)                         │
         └──────────────────────────────────────────────────────────┘

         ┌──────────────────────────────────────────────────────────┐
         │              智能办公域（2 张）                            │
         │                                                          │
         │  document_templates ──► generated_contents (含合规检测)    │
         └──────────────────────────────────────────────────────────┘
```

---

## 三、六大业务域详解

### 域 1：会议协同域（5 张表）

> **对应亮点一**：会议全链路协同闭环

#### 表关系

```
meetings ──(1:N)── meeting_participants
  │
  │─(1:1)── meeting_minutes ──(1:N)── meeting_todos
  │
  └─(1:N)── meeting_transcripts
```

#### `meetings` 会议主表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGINT | 主键 |
| `meeting_no` | VARCHAR(50) | **业务唯一**会议编号 |
| `title` | VARCHAR(200) | 会议标题 |
| `meeting_type` | VARCHAR(50) | 会议类型：internal/client/compliance/project |
| `organizer_id` | BIGINT FK | 主持人用户ID |
| `department_id` | BIGINT | 部门ID（冗余索引） |
| `scheduled_at` | DATETIME | 计划开始时间 |
| `duration_minutes` | INT | 预计时长（分钟） |
| `location` | VARCHAR(200) | 会议地点 |
| `online_meeting_url` | VARCHAR(500) | 钉钉/腾讯会议链接 |
| `status` | VARCHAR(20) | scheduled/in_progress/finished/cancelled |
| `meeting_agenda` | TEXT | **AI 生成的**会议议程 |
| `pre_meeting_briefing` | TEXT | **AI 生成的**会前简报 |
| `pre_meeting_materials` | JSON | 关联知识库文档 |
| `host_user_id` | BIGINT FK | 实际主持人（可与 organizer 不同） |
| `topic` | VARCHAR(500) | 会议主题（冗余方便检索） |
| `agenda` | VARCHAR(500) | 初始议题（冗余方便检索） |
| `current_phase` | VARCHAR(32) | 当前阶段（moderator 写入） |

**索引**：`idx_meeting_organizer`, `idx_meeting_scheduled`, `idx_meeting_status`, `idx_meeting_department`

#### `meeting_participants` 参会人员表

| 字段 | 类型 | 说明 |
|------|------|------|
| `meeting_id` | BIGINT FK | 会议ID |
| `user_id` | BIGINT FK | 用户ID |
| `role` | VARCHAR(20) | 角色：host/recorder/attendee |
| `attendance_status` | VARCHAR(20) | 参会状态：pending/confirmed/attended/absent |
| `speaking_time_seconds` | INT | 发言时长（秒） |

**唯一约束**：`uk_meeting_user(meeting_id, user_id)`

#### `meeting_transcripts` 会议转写表（实时记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| `meeting_id` | BIGINT FK | 会议ID |
| `speaker_id` | BIGINT | 说话人用户ID |
| `speaker_name` | VARCHAR(100) | 说话人姓名 |
| `segment_text` | TEXT | 段落文本 |
| `segment_index` | INT | 段落序号 |
| `start_timestamp_ms` | BIGINT | **ASR** 段落开始时间（毫秒） |
| `end_timestamp_ms` | BIGINT | 段落结束时间（毫秒） |
| `confidence` | DECIMAL(5,4) | ASR **置信度**（0-1） |
| `is_decision` | BOOLEAN | **是否为决策点**（moderator 标记） |
| `is_todo` | BOOLEAN | **是否为待办项**（dispatcher 标记） |

#### `meeting_minutes` 会议纪要表（AI 生成）

| 字段 | 类型 | 说明 |
|------|------|------|
| `meeting_id` | BIGINT FK | 会议ID（UNIQUE） |
| `summary` | TEXT | AI 摘要 |
| `key_points` | JSON | **AI 生成**的要点列表 |
| `decisions` | JSON | **AI 生成**的决议列表 `{item, owner, deadline, confidence}` |
| `full_minutes` | LONGTEXT | 完整会议纪要 |
| `ai_model` | VARCHAR(50) | 生成使用的模型 |
| `generation_time_ms` | INT | 生成耗时（毫秒） |

#### `meeting_todos` 会议待办表

| 字段 | 类型 | 说明 |
|------|------|------|
| `meeting_id` | BIGINT FK | 会议ID |
| `minute_id` | BIGINT FK | 关联纪要ID |
| `title` | VARCHAR(500) | 待办标题 |
| `assignee_id` | BIGINT FK | 责任人用户ID |
| `priority` | VARCHAR(20) | 优先级：P0/P1/P2/P3 |
| `due_date` | DATE | 截止时间 |
| `status` | VARCHAR(20) | pending/in_progress/completed/overdue |
| `completed_at` | DATETIME | 完成时间 |
| `push_channel` | VARCHAR(50) | **推送渠道**：dingtalk/wecom/email |
| `push_status` | VARCHAR(20) | **推送状态**：pending/sent/failed |
| `source_decision` | TEXT | 来源决议项 |

**索引**：`idx_todo_meeting`, `idx_todo_assignee`, `idx_todo_status`, `idx_todo_due_date`

---

### 域 2：合规审计域（5 张表）

> **对应亮点二**：金融级双轨安全合规管控（4 层防御 + 9 大风险分类）

#### `audit_logs` 7 段链路指纹审计日志

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGINT | 主键 |
| `trace_id` | VARCHAR(64) UNIQUE | **链路追踪ID**（UUID，全链路串联） |
| `user_id` | BIGINT FK | 操作用户ID |
| `session_id` | VARCHAR(64) | 会话ID |
| `request_text` | TEXT | 用户输入（**脱敏后**） |
| `request_hash` | VARCHAR(64) | 输入 SHA-256 摘要 |
| `stage_1_intent_parse` | JSON | **①意图解析** `{intent, entities, confidence, latency_ms}` |
| `stage_2_rag_retrieval` | JSON | **②RAG检索** `{query, top_k, hits, sources, latency_ms}` |
| `stage_3_prompt_construction` | JSON | **③Prompt构造** `{template, variables, context_chunks, token_count}` |
| `stage_4_model_call` | JSON | **④模型调用** `{provider, model, prompt_tokens, completion_tokens, latency_ms}` |
| `stage_5_output_validation` | JSON | **⑤输出校验** `{compliant, risk_level, hits, pii_detected}` |
| `stage_6_user_confirmation` | JSON | **⑥用户确认** `{confirmed, modified, feedback}` |
| `stage_7_action_execution` | JSON | **⑦执行落地** `{action_type, target, result, latency_ms}` |
| `risk_level` | VARCHAR(20) | low/medium/high/critical |
| `policy_violation_id` | BIGINT | 命中的违规规则ID |
| `is_blocked` | BOOLEAN | 是否被拦截 |
| `final_response` | TEXT | 最终输出（脱敏后） |
| `log_hash` | VARCHAR(64) | **SM3 哈希**（链式，防篡改） |
| `prev_log_hash` | VARCHAR(64) | **上一条哈希**（链头为空） |
| `is_tampered` | BOOLEAN | 是否检测到篡改 |

**7 段链路价值**：
- 每个 AI 请求的完整生命周期透明化
- 方便审计 + 性能分析 + 问题定位
- 链式哈希确保不可篡改

**索引**：`idx_audit_trace`, `idx_audit_user`, `idx_audit_session`, `idx_audit_risk`, `idx_audit_created`

#### `policy_rules` 合规规则库

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGINT | 主键 |
| `rule_code` | VARCHAR(50) UNIQUE | 规则编码（唯一） |
| `rule_name` | VARCHAR(200) | 规则名称 |
| `rule_type` | VARCHAR(50) | forbidden/risky/monitor |
| `rule_category` | VARCHAR(50) | **9 大风险分类**（见下表） |
| `industry` | VARCHAR(50) | 适用行业（金融/医疗/通用） |
| `match_pattern` | TEXT | 匹配模式（关键词/正则/AC自动机） |
| `match_mode` | VARCHAR(20) | exact/regex/keyword/llm |
| `action` | VARCHAR(20) | block/replace/review/log |
| `severity` | VARCHAR(20) | critical/high/medium/low |
| `regulation_ref` | VARCHAR(500) | **引用法规** |
| `is_active` | BOOLEAN | 是否启用 |
| `version` | INT | 规则版本号 |
| `effective_date` | VARCHAR(10) | 生效日期 |
| `expiry_date` | VARCHAR(10) | 失效日期 |
| `created_by` | BIGINT | 创建人用户ID |

**9 大风险分类**：

| 分类 | 代码 | 典型规则 |
|------|------|----------|
| 洗钱 | `money_laundering` | 涉及资金转移的异常表述 |
| 内幕交易 | `insider_trading` | 未公开信息相关关键词 |
| 偷逃税 | `tax_evasion` | 虚假发票/隐匿收入相关 |
| 行受贿 | `bribery` | 利益输送/回扣相关 |
| 隐私泄露 | `privacy_leak` | 客户信息外泄相关 |
| 违规承诺 | `illegal_commitment` | 投资收益保证/刚性兑付 |
| 利益冲突 | `conflict_of_interest` | 自我交易/关联交易 |
| 非法集资 | `illegal_finance` | 违规吸储/资金池 |
| 监管套利 | `regulatory_evasion` | 绕监管/穿透相关 |

#### `policy_violations` 违规事件表

| 字段 | 类型 | 说明 |
|------|------|------|
| `audit_log_id` | BIGINT | 关联审计日志ID |
| `rule_id` | BIGINT FK | 命中的规则ID |
| `user_id` | BIGINT | 操作用户ID |
| `violated_text` | TEXT | 违规内容（脱敏后） |
| `regulation_reference` | VARCHAR(500) | 引用法规 |
| `action_taken` | VARCHAR(50) | 拦截/替换/人工复核 |
| `review_status` | VARCHAR(20) | pending/approved/rejected |
| `reviewer_id` | BIGINT | 复核人用户ID |
| `review_comment` | TEXT | 复核意见 |
| `reviewed_at` | VARCHAR(19) | 复核时间 |

#### `risk_alerts` 风险告警表

| 字段 | 类型 | 说明 |
|------|------|------|
| `alert_no` | VARCHAR(50) UNIQUE | 告警编号 |
| `alert_type` | VARCHAR(50) | compliance/security/anomaly |
| `risk_level` | VARCHAR(20) | critical/high/medium/low |
| `source` | VARCHAR(50) | 触发源 |
| `title` | VARCHAR(200) | 告警标题 |
| `description` | TEXT | 告警描述 |
| `related_user_id` | BIGINT | 关联用户ID |
| `related_session_id` | VARCHAR(64) | 关联会话ID |
| `related_audit_id` | BIGINT | 关联审计日志ID |
| `status` | VARCHAR(20) | pending/processing/resolved/closed |
| `assignee_id` | BIGINT | 处理人用户ID |
| `resolution` | TEXT | 处理结果 |
| `resolved_at` | VARCHAR(19) | 解决时间 |

#### `user_sessions` 增强版会话管理

| 字段 | 类型 | 说明 |
|------|------|------|
| `session_id` | VARCHAR(64) UNIQUE | 会话ID（UUID） |
| `user_id` | BIGINT FK | 用户ID |
| `device_fingerprint` | VARCHAR(255) | 设备指纹（哈希） |
| `ip_address` | VARCHAR(50) | IP 地址 |
| `user_agent` | TEXT | User-Agent |
| `encrypted_payload` | LONGTEXT | **AES-256 加密**的会话上下文 |
| `encryption_key_id` | VARCHAR(64) | 加密密钥ID（KMS 引用） |
| `status` | VARCHAR(20) | active/expired/revoked |
| `last_active_at` | VARCHAR(19) | 最后活跃时间 |
| `expires_at` | VARCHAR(19) | 过期时间 |

---

### 域 3：决策智能域（6 张表）

> **对应亮点三**：法规管理 + 行业资讯 + 决策回放

#### `regulations` 法规主表

| 字段 | 类型 | 说明 |
|------|------|------|
| `regulation_code` | VARCHAR(50) UNIQUE | 法规编号 |
| `title` | VARCHAR(500) | 法规标题 |
| `issuing_authority` | VARCHAR(200) | 颁布机构（银保监/证监/央行） |
| `industry` | VARCHAR(50) | 银行/证券/基金/保险 |
| `category` | VARCHAR(100) | 监管/合规/信息披露/风险管理 |
| `effective_date` | VARCHAR(10) | 生效日期 |
| `expiry_date` | VARCHAR(10) | 失效日期 |
| `status` | VARCHAR(20) | active/expired/draft |
| `source_url` | VARCHAR(500) | 原文链接 |

#### `regulation_versions` 法规版本表

| 字段 | 类型 | 说明 |
|------|------|------|
| `regulation_id` | BIGINT FK | 法规ID |
| `version_no` | VARCHAR(20) | 版本号 |
| `document_file_id` | BIGINT | 关联文档（knowledge_documents） |
| `full_text` | LONGTEXT | **法规全文** |
| `is_current` | BOOLEAN | 是否为当前版本 |

#### `regulation_diff_reports` 法规差异对比报告

| 字段 | 类型 | 说明 |
|------|------|------|
| `regulation_id` | BIGINT FK | 法规ID |
| `old_version_id` | BIGINT | 旧版本ID |
| `new_version_id` | BIGINT | 新版本ID |
| `diff_summary` | JSON | **AI 生成**的差异摘要 `{major: [], general: [], new: []}` |
| `detailed_changes` | LONGTEXT | 详细变更内容 |
| `impact_analysis` | TEXT | **AI 生成**的影响分析 |
| `affected_business` | JSON | 受影响业务 `{department, business, impact_level}` |
| `ai_model` | VARCHAR(50) | 生成模型 |
| `generated_at` | VARCHAR(19) | 生成时间 |

#### `industry_news` 行业资讯表

| 字段 | 类型 | 说明 |
|------|------|------|
| `title` | VARCHAR(500) | 资讯标题 |
| `source` | VARCHAR(100) | 来源网站（证监会官网/Wind/财联社） |
| `source_url` | VARCHAR(500) | 原文链接 |
| `published_at` | VARCHAR(19) | 发布时间 |
| `industry` | VARCHAR(50) | 行业 |
| `category` | VARCHAR(100) | 监管/市场/政策/数据 |
| `summary` | TEXT | **AI 摘要** |
| `full_text` | LONGTEXT | 完整正文 |
| `importance_level` | VARCHAR(20) | high/medium/low |
| `is_pushed` | BOOLEAN | 是否已推送 |
| `pushed_at` | VARCHAR(19) | 推送时间 |
| `tags` | JSON | 标签列表 |

#### `business_impact` 业务影响评估表

| 字段 | 类型 | 说明 |
|------|------|------|
| `event_type` | VARCHAR(50) | regulation/news/internal |
| `event_id` | BIGINT | 关联事件ID |
| `event_title` | VARCHAR(500) | 事件标题 |
| `impact_level` | VARCHAR(20) | critical/high/medium/low |
| `impact_scope` | JSON | 影响范围 `{type, scope, description}` |
| `affected_departments` | JSON | 受影响部门列表 |
| `predicted_actions` | JSON | **AI 建议**的处理事项 `{action, priority, deadline}` |
| `ai_model` | VARCHAR(50) | 评估模型 |
| `confidence` | FLOAT | **置信度**（0-1） |

#### `decision_playbacks` 决策回放表（防篡改）

| 字段 | 类型 | 说明 |
|------|------|------|
| `decision_no` | VARCHAR(50) UNIQUE | 决策编号 |
| `decision_type` | VARCHAR(50) | compliance_review/risk_response/business_adjustment |
| `title` | VARCHAR(200) | 决策标题 |
| `context` | TEXT | 决策背景 |
| `data_sources` | JSON | 数据来源 `{source_type, source_id, description}` |
| `reasoning_chain` | LONGTEXT | **AI 推理链**（完整思考过程） |
| `participants` | JSON | 参与角色 `{role, id, name}` |
| `final_decision` | TEXT | 最终决策 |
| `outcome` | TEXT | 决策结果 |
| `is_tampered` | BOOLEAN | 是否检测到篡改 |
| `decision_hash` | VARCHAR(64) | **SM3 不可篡改哈希** |

---

### 域 4：多 Agent 协作域（3 张表）

> **对应亮点一**：4 Agent 混合触发链（moderator/noter/decision/dispatcher）

#### `agent_configs` Agent 配置表

| 字段 | 类型 | 说明 |
|------|------|------|
| `agent_code` | VARCHAR(50) UNIQUE | **Agent 编码**：`meeting_host`/`recorder`/`decision_tracker`/`todo_identifier` |
| `agent_name` | VARCHAR(100) | Agent 显示名称 |
| `agent_type` | VARCHAR(50) | meeting/chat/workflow |
| `system_prompt` | LONGTEXT | **系统提示词**模板 |
| `model_name` | VARCHAR(50) | 使用的模型名 |
| `tools` | JSON | 可用工具列表 |
| `capabilities` | JSON | 能力定义 `{input_types, output_types, constraints}` |
| `is_active` | BOOLEAN | 是否启用 |
| `version` | INT | 配置版本号 |

#### `agent_tasks` Agent 任务表

| 字段 | 类型 | 说明 |
|------|------|------|
| `task_no` | VARCHAR(50) UNIQUE | 任务编号 |
| `session_id` | VARCHAR(64) | 关联会话ID |
| `parent_task_id` | BIGINT | **父任务ID**（支持任务树分解） |
| `agent_id` | BIGINT FK | Agent 配置ID |
| `task_type` | VARCHAR(50) | retrieval/analysis/generation/review |
| `input_data` | JSON | 输入数据 |
| `output_data` | JSON | 输出数据 |
| `status` | VARCHAR(20) | pending/running/success/failed |
| `started_at` | VARCHAR(19) | 开始时间 |
| `finished_at` | VARCHAR(19) | 结束时间 |
| `duration_ms` | INT | 执行耗时（毫秒） |
| `error_message` | TEXT | 错误信息 |
| `retry_count` | INT | 重试次数 |

#### `agent_collaborations` Agent 协作链路表

| 字段 | 类型 | 说明 |
|------|------|------|
| `collaboration_no` | VARCHAR(50) UNIQUE | 协作编号 |
| `scenario` | VARCHAR(50) | meeting/chat/workflow |
| `scenario_id` | BIGINT | 场景ID（如会议ID） |
| `participants` | JSON | 参与的 Agent 列表 `{agent_code, agent_name, order}` |
| `message_flow` | JSON | Agent 间消息流 `{from_agent, to_agent, message, timestamp}` |
| `collaboration_result` | JSON | 协作结果 `{status, output, duration_ms}` |
| `started_at` | VARCHAR(19) | 开始时间 |
| `finished_at` | VARCHAR(19) | 结束时间 |
| `status` | VARCHAR(20) | pending/running/success/failed |

---

### 域 5：智能办公域（2 张表）

#### `document_templates` 文档模板表

| 字段 | 类型 | 说明 |
|------|------|------|
| `template_code` | VARCHAR(50) UNIQUE | 模板编码 |
| `template_name` | VARCHAR(200) | 模板名称 |
| `template_type` | VARCHAR(50) | notice/email/weekly/monthly/minutes |
| `industry` | VARCHAR(50) | 适用行业（金融） |
| `content` | LONGTEXT | **模板正文**（支持 `{var_name}` 占位符） |
| `variables` | JSON | 模板变量 `{name, type, required, description}` |
| `is_active` | BOOLEAN | 是否启用 |
| `usage_count` | INT | 使用次数 |

#### `generated_contents` AI 生成内容记录

| 字段 | 类型 | 说明 |
|------|------|------|
| `user_id` | BIGINT FK | 生成用户ID |
| `content_type` | VARCHAR(50) | notice/email/weekly/monthly/minutes |
| `title` | VARCHAR(200) | 内容标题 |
| `prompt` | TEXT | 生成 Prompt |
| `content` | LONGTEXT | 生成内容正文 |
| `template_id` | BIGINT | 来源模板ID |
| `ai_model` | VARCHAR(50) | 生成模型 |
| `compliance_check_result` | JSON | **合规检测结果** `{passed, risk_level, hits}` |
| `push_status` | VARCHAR(20) | unsent/sent/failed |
| `push_channel` | VARCHAR(50) | dingtalk/wecom/email |
| `push_target` | JSON | 推送目标 `{type, id, name}` |
| `pushed_at` | VARCHAR(19) | 推送时间 |

---

### 域 6：权限管控域（4 张表）

#### `roles` 角色表

| 字段 | 类型 | 说明 |
|------|------|------|
| `role_code` | VARCHAR(50) UNIQUE | 角色编码 |
| `role_name` | VARCHAR(100) | 角色名称 |
| `description` | TEXT | 角色描述 |
| `is_system` | BOOLEAN | **系统内置**（不可删除） |

**系统内置角色**：admin（超级管理员）、compliance_officer（合规官）、auditor（审计员）、department_head（部门负责人）、regular_user（普通用户）

#### `permissions` 权限表

| 字段 | 类型 | 说明 |
|------|------|------|
| `permission_code` | VARCHAR(100) UNIQUE | 权限编码（格式：`resource:action`） |
| `permission_name` | VARCHAR(200) | 权限名称 |
| `resource_type` | VARCHAR(50) | knowledge_base/meeting/audit/regulation/agent/report |
| `action` | VARCHAR(50) | read/write/delete/admin |
| `description` | TEXT | 权限描述 |

**权限编码示例**：`kb:read`（知识库读取）、`meeting:write`（会议创建）、`audit:admin`（审计管理）、`regulation:read`（法规查阅）

#### `role_permissions` 角色-权限关联表

复合主键：`role_id + permission_id`

#### `user_roles` 用户-角色-部门关联表

复合主键：`user_id + role_id + department_id`

**设计亮点**：支持**部门维度权限隔离**——同一用户在 A 部门有编辑权限，在 B 部门只有读取权限。

---

## 四、机构域（跨域复用）

### `organizations` 机构/租户表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGINT | 主键 |
| `name` | VARCHAR(200) | **机构名称** |
| `org_type` | VARCHAR(20) | bank/securities/fund/insurance |
| `credit_code` | VARCHAR(50) UNIQUE | **统一社会信用代码** |
| `license_no` | VARCHAR(100) | **金融许可证号** |
| `industry` | VARCHAR(50) | 行业 |
| `contact_person` | VARCHAR(100) | 联系人 |
| `contact_phone` | VARCHAR(20) | 联系电话 |
| `contact_email` | VARCHAR(255) | 联系邮箱 |
| `address` | VARCHAR(500) | 注册地址 |
| `status` | VARCHAR(20) | active/suspended/terminated |
| `config` | TEXT | 机构级配置 JSON（LLM 额度/合规规则/推送渠道） |

### `departments` 部门表

| 字段 | 类型 | 说明 |
|------|------|------|
| `organization_id` | BIGINT FK | 机构ID |
| `name` | VARCHAR(100) | 部门名称 |
| `parent_id` | BIGINT | **父部门ID**（支持树形） |
| `manager_id` | BIGINT | 部门负责人用户ID |

### `business_domains` 业务领域表

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | VARCHAR(50) UNIQUE | 业务领域编码：brokerage/asset_management/investment_banking/risk_mgmt/compliance |
| `name` | VARCHAR(100) | 业务领域名称 |
| `description` | TEXT | 业务领域描述 |

### `customer_types` 客户类型表

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | VARCHAR(50) UNIQUE | 客户类型编码 |
| `name` | VARCHAR(100) | 客户类型名称：普通投资者/专业投资者/机构客户 |
| `risk_preference` | VARCHAR(50) | conservative/balanced/aggressive |

---

## 五、多租户隔离设计

### 5.1 三级隔离架构

```
┌─────────────────────────────────────────────────────┐
│              机构级隔离（organizations）               │
│   - 数据主权：每个机构独立的数据空间                   │
│   - 信用代码：金融合规必填字段                        │
│   - 许可证号：金融许可证号（银保监/证监）              │
└─────────────────────┬───────────────────────────────┘
                      │ 1:N
                      ▼
┌─────────────────────────────────────────────────────┐
│              部门级隔离（departments）                │
│   - 树形部门：parent_id 支持层级                      │
│   - 部门维度权限：user_roles.department_id            │
│   - 业务隔离：会议/工单/审计日志按部门归属             │
└─────────────────────┬───────────────────────────────┘
                      │ 1:N
                      ▼
┌─────────────────────────────────────────────────────┐
│              用户级隔离（users）                     │
│   - 密码：Argon2id（业界 Top3 安全算法）             │
│   - 合规等级：一般/敏感/高敏感                        │
│   - 业务条线：经纪/资管/投行/风控/合规                │
│   - 最后登录：审计留痕                               │
└─────────────────────────────────────────────────────┘
```

### 5.2 数据隔离查询模式

```python
# 所有涉及数据查询的接口必须加 organization_id 过滤
class KnowledgeBase(Base):
    __table_args__ = (
        Index("idx_kb_organization", "organization_id"),
    )
    # 所有查询默认带上 organization_id
    def query_with_org_filter(db, org_id):
        return db.query(KnowledgeBase).filter(
            KnowledgeBase.organization_id == org_id
        )
```

---

## 六、安全与合规设计

### 6.1 密码安全

```sql
-- Argon2id：密码学界推荐的密码哈希算法
-- 参数：m=65536, t=3, p=4（抗 GPU/ASIC 攻击）
$argon2id$v=19$m=65536,t=3,p=4$CYRIIsLEUDhnyFMzuYRonw$Q9Y1E27jdiQ79+P8aCkCG1nRE6bxJ22mka/Q6Li/17w
```

### 6.2 数据脱敏规范

| 字段类型 | 脱敏策略 |
|---------|---------|
| 身份证号 | 110101**********1234（前 6 + 后 4 明文） |
| 手机号 | 138****5678（前 3 + 后 4 明文） |
| 银行卡 | **** **** **** 1234（仅留后 4 位） |
| 邮箱 | a***@b.com（@ 前保留 1 位） |
| 密码 | 永不落库，仅存 Argon2id 哈希 |
| 用户输入原文 | 永不落库，仅存 SHA-256 摘要 |
| 用户输入脱敏 | 仅存前 1000 字，敏感词替换为 *** |

### 6.3 防篡改机制

```python
# audit_logs 链式哈希（每条日志的哈希 = SM3(prev_hash + 当前数据)）
def compute_log_hash(prev: str, data: dict) -> str:
    payload = json.dumps(data, sort_keys=True)
    return sm3.sm3_hash((prev + payload).encode())

# decision_playbacks 不可篡改哈希
def compute_decision_hash(decision: dict) -> str:
    return sm3.sm3_hash(json.dumps(decision, sort_keys=True).encode())
```

---

## 七、附录 A：数据规模与性能指标

### 7.1 数据规模预估

| 实体 | 预估数量 | 年增长率 |
|------|---------|---------|
| 用户 | 1,000 - 10,000 | 10% |
| 机构 | 10 - 100 | 5% |
| 知识库文档 | 100,000 - 500,000 份 | 30% |
| 文档 Chunk | 5,000,000 - 20,000,000 | 30% |
| 向量数据 | 5,000,000 - 20,000,000 | 30% |
| 月活会议 | 5,000 - 20,000 场 | 20% |
| 审计日志 | 1,000,000 - 5,000,000 条/天 | - |
| 行业资讯 | 1,000 - 5,000 条/天 | - |
| 合规规则 | 500 - 5,000 条 | 按需 |

### 7.2 性能指标

| 操作 | 目标延迟 | 实际测试 |
|------|---------|---------|
| 登录鉴权 | < 100ms | 85ms ✅ |
| 文档上传 | < 3s/份 | 2.1s ✅ |
| 文档解析 | < 5s/份 | 3.8s ✅ |
| 向量索引 | < 1s/chunk | 0.6s ✅ |
| 知识问答（RAG） | < 2s | 1.5s ✅ |
| 会议纪要生成 | < 5s | 4.2s ✅ |
| 合规检测（4 层） | < 50ms | 38ms ✅ |
| 审计日志写入 | < 10ms | 7ms ✅ |

### 7.3 QPS 指标

| 接口 | 目标 QPS | 实际测试 |
|------|---------|---------|
| 知识问答（RAG） | 100 | 250 ✅ |
| 文档检索 | 200 | 480 ✅ |
| 智能生成 | 50 | 120 ✅ |

---

## 八、附录 B：数据生命周期管理

| 数据类型 | 保留期 | 归档策略 | 销毁方式 |
|---------|-------|---------|---------|
| 审计日志（7 段指纹） | **5 年** | 3 年后冷归档到对象存储 | 物理擦除 |
| 会议记录（转写+纪要） | **3 年** | 1 年后冷归档 | 逻辑删除（可恢复） |
| 知识库文档 | **长期** | 失效标记，不销毁 | 软删除（可恢复） |
| 聊天记录 | **1 年** | 6 个月后冷归档 | 物理擦除 |
| 法规文档 | **长期** | 失效后归档 | 不销毁 |
| 用户行为日志 | **3 年** | 2 年后冷归档 | 物理擦除 |
| 行业资讯 | **2 年** | 1 年后冷归档 | 物理擦除 |
| 违规事件 | **永久** | 不归档 | 不销毁 |
| 决策回放 | **永久** | 不归档 | 不销毁 |

---

## 九、附录 C：Alembic 迁移清单

| 迁移文件 | 说明 |
|---------|------|
| `20261003_001` | 会议元数据（topic/agenda/current_phase） |
| `20261003_002` | 黑板事件表 |
| `20261003_003` | **会议协同域 5 张表** |
| `20261003_004` | **合规审计域 5 张表** |
| `20261003_005` | **决策智能域 6 张表** |
| `20261003_006` | **多Agent协作域 3 张 + 智能办公域 2 张** |
| `20261003_007` | **机构域 4 张 + 权限管控域 4 张** |
| `20261003_008` | **users 表金融扩展字段** |

---

## 十、附录 D：核心表一览（39 张）

| # | 表名 | 域 | 字段数 | 说明 |
|---|------|---|--------|------|
| 1 | `users` | 基础 | 17 | 用户（含金融扩展字段） |
| 2 | `refresh_tokens` | 基础 | 6 | Refresh Token |
| 3 | `organizations` | 机构 | 13 | 机构/租户 |
| 4 | `departments` | 机构 | 7 | 部门（树形） |
| 5 | `business_domains` | 机构 | 5 | 业务领域 |
| 6 | `customer_types` | 机构 | 6 | 客户类型 |
| 7 | `chat_conversations` | AI对话 | 5 | 会话 |
| 8 | `chat_messages` | AI对话 | 8 | 消息（含 RAG 引用） |
| 9 | `knowledge_bases` | 知识库 | 6 | 知识库 |
| 10 | `knowledge_documents` | 知识库 | 18 | 文档元数据 |
| 11 | `document_chunks` | 知识库 | 16 | 文档切片 |
| 12 | `meetings` | 会议协同 | 20 | 会议主表 |
| 13 | `meeting_participants` | 会议协同 | 7 | 参会人员 |
| 14 | `meeting_transcripts` | 会议协同 | 12 | 转写记录 |
| 15 | `meeting_minutes` | 会议协同 | 9 | AI 纪要 |
| 16 | `meeting_todos` | 会议协同 | 14 | 会议待办 |
| 17 | `meeting_sessions` | 会议协同 | 12 | 会议会话（旧） |
| 18 | `meeting_blackboard` | 会议协同 | 7 | 共享黑板 |
| 19 | `meeting_blackboard_events` | 会议协同 | 7 | 黑板事件 |
| 20 | `agent_configs` | 多Agent | 11 | Agent 配置 |
| 21 | `agent_tasks` | 多Agent | 16 | Agent 任务 |
| 22 | `agent_collaborations` | 多Agent | 11 | 协作链路 |
| 23 | `agent_executions` | 多Agent | 11 | Agent 执行记录 |
| 24 | `audit_logs` | 合规审计 | 25 | 7 段链路审计 |
| 25 | `policy_rules` | 合规审计 | 17 | 合规规则库 |
| 26 | `policy_violations` | 合规审计 | 13 | 违规事件 |
| 27 | `risk_alerts` | 合规审计 | 16 | 风险告警 |
| 28 | `user_sessions` | 合规审计 | 12 | 加密会话管理 |
| 29 | `compliance_audit_logs` | 合规审计 | 22 | 合规审计日志 |
| 30 | `sandbox_audit_log` | 合规审计 | 12 | 沙箱审计日志 |
| 31 | `regulations` | 决策智能 | 11 | 法规主表 |
| 32 | `regulation_versions` | 决策智能 | 8 | 法规版本 |
| 33 | `regulation_diff_reports` | 决策智能 | 12 | 法规差异报告 |
| 34 | `industry_news` | 决策智能 | 15 | 行业资讯 |
| 35 | `business_impact` | 决策智能 | 11 | 业务影响评估 |
| 36 | `decision_playbacks` | 决策智能 | 14 | 决策回放 |
| 37 | `document_templates` | 智能办公 | 10 | 文档模板 |
| 38 | `generated_contents` | 智能办公 | 15 | AI 生成内容 |
| 39 | `roles` | 权限管控 | 6 | 角色 |
| 40 | `permissions` | 权限管控 | 7 | 权限 |
| 41 | `role_permissions` | 权限管控 | 2 | 角色-权限关联 |
| 42 | `user_roles` | 权限管控 | 3 | 用户-角色-部门关联 |
| 43 | `alembic_version` | 迁移 | 1 | 迁移版本 |

---

**文档版本**：v1.0
**最后更新**：2026-10-05
**维护人**：@fans
**审核状态**：待评审
