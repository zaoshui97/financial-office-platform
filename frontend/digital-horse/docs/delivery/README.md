# 上交材料配套目录

> 用于比赛 / 课程验收的"自留档"体系。每天 commit 时由 `scripts/auto-log.cjs` 自动记录。

## 亮点 1 进度看板（实时）

| 阶段 | 状态 | 入口 |
|---|---|---|
| 会前预演（4 Agent 模拟） |  Done | `/meeting/:id/rehearsal` |
| 会中实时 4 Agent 协作 |  Done | `/meeting-room/:id` 默认渲染 |
| 会后自动汇总（结构化摘要） |  Done | 结束会议自动触发 |
| **会后自动派单（本次新增）** |  Done | `PostMeetingDrawer` / 独立报告页 |
| **报告导出 PDF / Markdown（本次新增）** |  Done | `ExportToolbar` |
| **独立报告页（本次新增）** |  Done | `/meeting/:id/report` |
| 工单关闭流转 |  Done | `ActionCard` |
| 分享到知识库 |  Done | `ExportToolbar` → 分享 |
| **资讯详情 Drawer（2026-09-24 新增）** |  Done | `/industry-news` 三处点击入口 |
| **资讯一键发起合规审查（2026-09-24 打通）** |  Done | 详情 Drawer 高/中影响度按钮 |
| **MOCK 资讯正文补全（2026-09-24 补全）** |  Done | 7 条每条 3-5 段真实业务内容 |
| **AI 智能中心独立页面恢复（2026-10-02 Phase 1）** |  Done | `/qa` `/agent` `/chat` 路由重新挂载；Sidebar 恢复 AI能力 分组 |

## 文件清单

| 文件 | 用途 | 维护方式 |
|---|---|---|
| `dev-log.md` | 每日 commit 快照（自动） + 踩坑与决策（手动） | **自动**，commit 时追加 |
| `team.md` | 团队分工与 Sprint TODO | 手动，每 Sprint 更新 |
| `api-gap-tracker.md` | 接口实现缺口追踪，对照 `docs/api-contract-v1.md` §8 | **手动**，每补一个接口追加一行 |
| `scenario-analysis.md` | 每个企业办公场景的痛点 / 用户故事 / 改造前后 / 量化收益 | 手动，每完成一个场景补一段 |
| `metrics.md` | 流程提效量化指标（演示视频 / PPT 取材处） | 手动，演示前实测回填 |
| `ROUTE-MATRIX.md` | 路由状态单一事实来源（含挂载 / 重定向 / 废弃） | **手动**，每次路由变更必更新 |
| `DECISIONS.md` | 重大决策留档（下线 / 恢复 / 重构），含上下文与回滚方案 | **手动**，每次重大变更必追加 |

## 自动记录怎么触发

`.husky/pre-commit` 已经做了：

```
git commit
  ↓
node scripts/auto-log.cjs   ← 把 staged 文件 + 行数变化写进 dev-log.md
  ↓
node scripts/check-i18n.js  ← i18n 静态校验
```

**前置设置**（每位开发者第一次 clone 后做一次）：

```bash
git config user.name "your-name"   # auto-log 会用这个识别责任人
git config user.email "you@example.com"
```

如果你想让责任人显示为真实姓名（如"张三"），把 `user.name` 设置成真实姓名即可。`team.md` 表里也有 `Git Config Name` 字段做映射。

## 哪些内容必须**手动**维护

auto-log 只会改 `dev-log.md` 的"每日提交快照"。下面这些内容**auto-log 不会写**，需要你每天 / 每个 Sprint 手动补：

### 每天要做的（手动）

- `dev-log.md` 中当日 entry 下方的 `<!-- 手动补充：为什么改 / 决策理由 / 踩坑记录 -->` 区域，简述**为什么改**

### 每个 Sprint 要做的（手动）

- `team.md` 的 TODO 板
- `api-gap-tracker.md` 每补一个接口追加一行
- `scenario-analysis.md` 每完成一个场景补一段

### 演示前要做的（手动）

- `metrics.md` 实测回填真实数字

## 怎么确认今天没漏

每周一次跑：

```bash
node scripts/auto-log.cjs --print-only  # 可以扩展：只打印统计，不写文件
```

或者直接打开 `docs/delivery/dev-log.md`，看 AUTO 区段里有没有当天日期。

## 写入时机速查

| 时刻 | 动作 |
|---|---|
| 提交代码前 | 自动：`pre-commit` 钩子会记录 |
| 解决问题后（重大） | 手动：写一段到 `dev-log.md` "踩坑与决策"区 |
| 实现新接口后 | 手动：`api-gap-tracker.md` 追加一行 |
| 完成一个场景 | 手动：`scenario-analysis.md` 补段落 |
| Sprint 计划会 | 手动：更新 `team.md` TODO 板 |
