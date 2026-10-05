# 行业资讯模块设计（一期规划 + 二期演进）

> 目标：让"每日简报" / "行业雷达" / "资讯聚合"功能在比赛中有清晰的"现在能做什么 / 下一阶段要做什么"叙事。
>
> 现状：**未实现**。本文档锁定**一期交付边界**与**二期实现路径**，避免比赛时被打脸。

---

## 0. 一句话定位

> **一期**：以 **RAG 知识库 + 预制资讯语料 + LLM 总结** 实现"行业资讯"核心体验。
> **二期**：接入**真实爬虫 / 第三方 API / 定时调度**，让数据源从"静态语料"升级为"实时流"。

---

## 1. 业务场景与用户故事

### 1.1 用户故事

| 角色 | 故事 | 优先级 |
|------|------|--------|
| 投研人员 | 每天早上想看 5 条与本行业相关的最新动态 | P0 |
| 风控合规 | 想追踪监管政策 / 处罚公告的变化趋势 | P0 |
| 高管 | 想看一份 AI 生成的"今日行业摘要"+ 关键数字 | P0 |
| 产品经理 | 想按行业 / 主题订阅，只看关心的内容 | P1 |

### 1.2 关键体验（路演要演示的）

```
[行业资讯列表] ──→ [资讯详情 + 原文] ──→ [AI 摘要 + 关键观点]
                                            │
                                            ↓
                                  [关联知识库文档（已有 RAG）]
                                            │
                                            ↓
                                    [一键归档到知识库]
```

---

## 2. 一期方案（比赛 Demo 版）

### 2.1 数据源：预制语料 + 静态 JSON

**目录结构**：
```
app/features/industry_news/
├── __init__.py
├── seed_data/
│   ├── 2026-10-04.json     # 5-10 条预制资讯
│   ├── 2026-10-03.json
│   └── ...
├── models.py                # IndustryNewsArticle 模型
├── schemas.py               # Pydantic
├── router.py                # REST API
├── service.py               # 业务编排
└── summarizer.py            # LLM 总结（已有 llm_gateway）
```

**预制资讯 JSON 格式**：
```json
[
  {
    "id": "news-20261004-001",
    "title": "证监会发布《关于完善证券公司风险控制指标计算标准的通知》",
    "source": "证监会官网",
    "url": "https://www.csrc.gov.cn/...",
    "category": "监管政策",
    "industry": ["证券", "基金"],
    "published_at": "2026-10-04T08:30:00+08:00",
    "summary": "本次调整主要涉及净资本计算、表内外资产分类等内容...",
    "raw_content": "（预制 500-2000 字原文）"
  }
]
```

**为什么用预制**：
- ✅ 零依赖（不爬虫、没反爬风险）
- ✅ 路演可控（不会现场爬挂）
- ✅ 合规清晰（引用来源明确）
- ✅ 一期能完整跑通"列表 / 详情 / AI 摘要 / 归档到知识库"全链路

### 2.2 模型设计

```python
# app/features/industry_news/models.py
class IndustryNewsArticle(TimestampMixin, Base):
    """行业资讯（预制数据 + 未来可对接真实数据源）"""
    __tablename__ = "industry_news_articles"

    external_id: Mapped[str]       # 来自种子文件或爬虫的 ID
    title: Mapped[str]
    source: Mapped[str]            # 证监会 / 央行 / 新浪财经
    url: Mapped[str | None]
    category: Mapped[str]          # 监管政策 / 市场动态 / 行业新闻
    industry: Mapped[list[str]]    # JSON 数组
    published_at: Mapped[datetime]
    raw_content: Mapped[str]       # LONGTEXT
    ai_summary: Mapped[str | None] # LLM 生成的摘要（一期手动触发）
    key_points: Mapped[list[str]]  # JSON 数组，AI 抽取的关键观点
    impact_level: Mapped[str]      # low / medium / high

    __table_args__ = (
        Index("idx_news_published", "published_at"),
        Index("idx_news_category", "category"),
    )
```

### 2.3 REST API

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/v1/news/` | 资讯列表（按日期 / 行业 / 分类筛选） |
| GET | `/api/v1/news/{id}` | 资讯详情 |
| POST | `/api/v1/news/{id}/summarize` | 调用 LLM 生成 AI 摘要（一期手动触发） |
| POST | `/api/v1/news/{id}/archive` | 一键归档到知识库（**已有 RAG 链路复用**） |
| GET | `/api/v1/news/daily-briefing` | "每日简报"接口：今日 top 5 + AI 综述 |

### 2.4 核心体验链路

```python
# service.py 核心流程（伪代码）

async def get_daily_briefing(user_id: int, db: Session) -> DailyBriefing:
    # 1. 拉今日资讯（预制数据）
    today_news = await db.execute(
        select(IndustryNewsArticle)
        .where(IndustryNewsArticle.published_at >= today_start)
        .order_by(IndustryNewsArticle.impact_level.desc(), IndustryNewsArticle.published_at.desc())
        .limit(5)
    )

    # 2. LLM 生成"今日综述"（已有 llm_gateway）
    overview = await llm_gateway.complete(
        messages=[
            {"role": "system", "content": "你是金融行业研究助手..."},
            {"role": "user", "content": build_overview_prompt(today_news)}
        ],
        task=AITask.SUMMARY  # 已有 AITask 枚举
    )

    # 3. 拼装返回
    return DailyBriefing(
        date=today,
        overview=overview,
        articles=today_news
    )
```

### 2.5 与已有模块的复用

| 能力 | 复用模块 | 说明 |
|------|----------|------|
| LLM 总结 | `app/ai/llm_gateway.py` | 已有 `complete()` / `stream_chat()` |
| 归档到知识库 | `app/features/rag/service.py` | 已有 `upload_and_parse_document()` |
| 合规过滤 | `app/sandbox/service.py` | 标题 / 摘要过 LLM Judge |
| 用户鉴权 | `app/features/auth/` | 完全复用 |
| 数据隔离 | `app/features/auth/dependencies.py` | 已有 `CurrentUser` |

---

## 3. 二期规划（赛后再做）

### 3.1 真实数据源接入

#### 3.1.1 候选数据源

| 来源 | 类型 | 接入方式 | 合规性 | 优先级 |
|------|------|----------|--------|--------|
| 证监会公告 | RSS / 官网 | RSS 订阅 + 列表页解析 | ✅ 公开 | 🔴 P0 |
| 央行公开新闻 | RSS | RSS 订阅 | ✅ 公开 | 🔴 P0 |
| 国家金融监督管理总局 | RSS | RSS 订阅 | ✅ 公开 | 🟡 P1 |
| 上交所 / 深交所公告 | API | 官方 OpenAPI | ✅ 公开 | 🟡 P1 |
| 财新 / 36 氪 / 第一财经 | 网页 | 反爬严格 | ⚠️ 需授权 | 🟢 P2 |
| Wind / 万得 | API | 付费 | ⚠️ 需采购 | 🟢 P3 |
| 同花顺 / 东方财富 | API | 需注册 | ⚠️ 需协议 | 🟡 P1 |

#### 3.1.2 爬虫架构（二期）

```
[数据源]
   ↓ HTTP/RSS
[Crawler Worker] ─── 1-3 个 worker 进程
   ↓ 原始 HTML/JSON
[Parser] ─── 抽取标题 / 摘要 / 原文
   ↓ 结构化数据
[Dedup Service] ─── 指纹去重（simhash / sha256）
   ↓
[IndustryNewsArticle 入库]
   ↓
[AI Summarizer] ─── 触发 LLM 总结
   ↓
[发布到用户 feed]
```

#### 3.1.3 技术选型

| 环节 | 选型 | 理由 |
|------|------|------|
| HTTP 客户端 | `httpx` | 异步友好 |
| HTML 解析 | `selectolax` / `beautifulsoup4` | 性能好 |
| RSS 解析 | `feedparser` | 事实标准 |
| 任务调度 | `APScheduler` / `Celery Beat` | 简单场景用前者 |
| 去重 | `simhash` | 准文本指纹 |
| 反爬应对 | 代理池 + UA 轮换 + 限速 | 仅用于授权源 |

### 3.2 定时调度

```python
# 伪代码（二期）
@scheduler.scheduled_job("cron", hour=8, minute=0)
async def fetch_daily_news():
    """每天 8 点拉取前一日资讯"""
    for source in REGULATORY_SOURCES:
        articles = await source.fetch_latest()
        await dedup_and_save(articles)
        await trigger_summarization(articles)
```

### 3.3 个性化订阅

| 维度 | 字段 |
|------|------|
| 行业 | 银行 / 证券 / 保险 / 基金 / 信托 |
| 主题 | 监管 / 市场 / 公司 / 产品 |
| 关键词 | 自由文本（用 embedding 匹配） |
| 频率 | 实时 / 每日 / 每周 |

### 3.4 智能标签 / 分类

- LLM 自动打标签：`category` / `industry` / `impact_level`
- 关联知识库文档：向量化后与已有 RAG 知识库关联
- 趋势分析：同一主题多篇资讯聚类 + 时间线

---

## 4. 关键技术决策

| 决策 | 理由 |
|------|------|
| **一期用预制数据** | 零依赖、零风险、零爬虫合规问题；路演可控 |
| **模型预留 `source` / `url` / `external_id`** | 二期接真实源不需要重构 |
| **AI 摘要手动触发** | 避免每次列表查询都调 LLM（成本 + 延迟） |
| **复用已有 RAG / LLM Gateway** | 不重复造轮子，保持架构一致 |
| **明确独立为 `industry_news` 模块** | 不混入 `rag` / `chat`，边界清晰 |
| **`impact_level` 字段预设** | 二期可由 AI 自动判定 |

---

## 5. 一期交付物清单

### 5.1 必须有

- [ ] `app/features/industry_news/models.py` — `IndustryNewsArticle` 模型 + Alembic 迁移
- [ ] `app/features/industry_news/schemas.py` — Pydantic
- [ ] `app/features/industry_news/service.py` — 业务编排
- [ ] `app/features/industry_news/router.py` — REST API（5 个端点）
- [ ] `app/features/industry_news/summarizer.py` — LLM 摘要
- [ ] `app/features/industry_news/seed_data/` — 5-10 条预制 JSON
- [ ] `app/features/industry_news/seed_loader.py` — 启动时加载种子数据
- [ ] 前端 `pages/IndustryNews/*` 接入真实后端（替换 mock）
- [ ] 集成测试：5 个核心场景

### 5.2 可选

- [ ] `app/features/industry_news/__init__.py` — 模块导出
- [ ] `docs/industry-news-data-sources.md` — 二期数据源调研
- [ ] `evals/news_summarization_quality.json` — AI 摘要质量评估
- [ ] 前端"今日简报"小组件（Dashboard 嵌入）

---

## 6. 一期 vs 二期对比表（路演用）

| 维度 | 一期（比赛） | 二期（赛后） |
|------|--------------|--------------|
| 数据源 | 预制 JSON（5-10 条） | RSS + 官方 API + 爬虫 |
| 更新频率 | 手动 / 启动加载 | 定时（每日 8 点） |
| 资讯数量 | 数十条 | 数千条 / 月 |
| AI 摘要 | 按需触发 | 自动 + 缓存 |
| 个性化 | 无 | 订阅 + 关键词 |
| 趋势分析 | 无 | 主题聚类 + 时间线 |
| 合规过滤 | 接入沙箱 | 接入沙箱 + 来源白名单 |
| 工作量 | 1-2 天 | 1-2 周 |

---

## 7. 风险与对策

| 风险 | 概率 | 影响 | 对策 |
|------|------|------|------|
| 预制数据"看起来假" | 中 | 中 | 标注"演示数据"+ 真实来源链接 |
| LLM 总结失败 | 低 | 高 | 兜底返回原文前 200 字 |
| 归档到知识库失败 | 中 | 中 | try/except + 错误提示"归档失败" |
| 比赛被问"为什么不爬虫" | 高 | 中 | **主动说明**一期方案 + 二期路径 |
| 比赛被问"数据更新吗" | 高 | 低 | "数据每场赛前手动更新，演示数据" |

---

## 8. 路演话术模板

> Q：行业资讯数据哪来的？会更新吗？
>
> A：一期我们用**预制数据 + AI 总结**演示完整链路——列表 / 详情 / 摘要 / 归档到知识库都跑通。
> 二期我们会接**证监会、央行、交易所的官方 RSS 和 API**，做到**每天自动更新**。
> 这一块我们做了详细的**二期演进路径图**（指向 §3），技术选型也已敲定（RSS 订阅 + feedparser + APScheduler）。

> Q：为什么不用爬虫？
>
> A：**合规先行**。金融行业数据来源的合法性、版权、反爬协议都要谈，**比赛时间不允许我们冒这个风险**。
> 一期我们用**权威源预制数据**，既保证演示效果，也避免合规问题。
> 二期我们会**只爬官方公开源**（证监会 / 央行），**付费源（Wind）走采购协议**。

---

## 9. 与已有模块的关系

```
┌─────────────────────────────────────────────────┐
│           行业资讯模块（industry_news）          │
│  · IndustryNewsArticle 模型                     │
│  · 列表 / 详情 / 摘要 / 归档                    │
└──────────┬──────────────────────┬───────────────┘
           │                      │
           ↓                      ↓
  ┌────────────────┐    ┌──────────────────┐
  │ LLM Gateway    │    │ RAG 知识库        │
  │ (已有)         │    │ (已有)            │
  │ · 摘要生成     │    │ · 一键归档        │
  │ · 关键观点抽取  │    │ · 向量化检索      │
  └────────────────┘    └──────────────────┘
           │
           ↓
  ┌────────────────┐
  │ 合规沙箱        │
  │ (已有)          │
  │ · 标题/摘要过滤 │
  └────────────────┘
```

**零新依赖、零新基础设施**，复用平台已有能力。

---

## 10. 一期实施步骤（1-2 天）

### Day 1 上午：模型 + 种子数据

- [ ] 写 `models.py` + Alembic 迁移
- [ ] 准备 5-10 条预制 JSON（覆盖：监管政策 / 市场动态 / 行业新闻）
- [ ] 写 `seed_loader.py` 启动加载

### Day 1 下午：API + 业务逻辑

- [ ] 写 `schemas.py` + `service.py`
- [ ] 写 `router.py` 5 个端点
- [ ] 写 `summarizer.py` 调 LLM Gateway

### Day 2 上午：前端接入

- [ ] 改 `pages/IndustryNews/index.tsx` 调真实后端
- [ ] 改 `pages/IndustryNews/Detail.tsx` 接 AI 摘要 + 归档按钮
- [ ] Dashboard 加"今日简报"卡片

### Day 2 下午：测试 + 文档

- [ ] 集成测试 5 场景
- [ ] 更新 `dev-log.md`
- [ ] 更新本设计文档的实施状态

---

## 11. 验收标准

### 11.1 功能验收

- [ ] `GET /api/v1/news/` 返回列表（至少 5 条）
- [ ] `GET /api/v1/news/{id}` 返回详情
- [ ] `POST /api/v1/news/{id}/summarize` 返回 LLM 摘要（>50 字）
- [ ] `POST /api/v1/news/{id}/archive` 真的在 `knowledge_documents` 落库
- [ ] `GET /api/v1/news/daily-briefing` 返回今日 top 5 + AI 综述

### 11.2 体验验收

- [ ] 前端 IndustryNews 页面无 mock 数据残留
- [ ] 摘要生成延迟 < 5s（含 LLM）
- [ ] 归档成功后跳转知识库新文档
- [ ] 移动端布局正常

### 11.3 路演验收

- [ ] "每日简报"可在 Dashboard 演示
- [ ] 摘要 + 归档流程 < 30s 演示完
- [ ] 二期路径图可打印 / 截图备用

---

## 12. 后续模块衔接

| 模块 | 衔接点 |
|------|--------|
| 知识库 RAG | 归档入口（`POST /news/{id}/archive`） |
| 合规沙箱 | 标题 / 摘要过滤（`check_text`） |
| 会议 Agent | "今日简报"可作为 moderator 输入 |
| 行业雷达 | 未来用相同数据源 + 不同分析维度 |

---

## 附：相关文档

- `docs/PHASE2_MOCK_REMNANTS.md` — 前端 Mock 清单（IndustryNews 仍 mock）
- `docs/DEPLOY.md` — 部署文档
- `app/features/rag/` — 已有 RAG 知识库实现（参考架构）
- `app/ai/llm_gateway.py` — LLM 调用（摘要能力）
- `app/sandbox/service.py` — 合规过滤（标题审核）

---

**最后更新**：2026-10-04
**作者**：@fans
**状态**：📋 设计完成，待实施（一期）
