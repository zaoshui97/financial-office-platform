# 团队分工

> 每天 commit 时由 auto-log 脚本读取 `git config user.name` 关联到此表的"负责人"列。

## 成员

| 姓名 | Git Config Name | 主要模块 | 当前 Sprint 任务 |
|---|---|---|---|
| 张三 | fans | 前端框架 / i18n / 性能优化 | 见下方 TODO 板 |
| 李四 | - | 知识库 / RAG | - |
| 王五 | - | 会议 / 转写 / 待办 | - |
| 待补 | - | Agent / 多智能体协作 | - |
| 待补 | - | 文档 / PPT / 视频 | - |

> 在 PowerShell 中设置自己贡献者身份：
> ```bash
> git config user.name "your-name"
> git config user.email "you@example.com"
> ```
> auto-log 会以 `git config user.name` 识别责任人。

---

## TODO 板（按 Sprint 维护）

### Sprint 1（待启动）

- [ ] 占位 `TBD` 字符串清理（MeetingDetail L51–55、L137、L145、L153、L730）
- [ ] 清理 `*.gbk.bak` 备份残留（Dashboard / Insights / Knowledge / Meeting / Settings 等）
- [ ] `dist/` 加入 .gitignore
- [ ] 把 deepseek API key 配置文档化（`.env.example`）

### Sprint 2

- [ ] 把 api-contract-v1.md 第 8 章未实现接口按优先级接入
- [ ] 知识库 → 文档生成链路 demo
- [ ] 会议纪要 → 待办闭环 demo（2 个重点场景之一）

### Sprint 3

- [ ] 多 Agent 协作演示（重点场景之二）
- [ ] 行业洞察 / 新闻定时推送
- [ ] 安全：多 Agent 多用户 session 管理、bash 命令管控
