# 会议触发链性能基线（2026-10-03 21:13）

## 测试环境

- LLM mock 延迟：50 ms × 4 agent
- 4 agent 串行链：moderator → noter → decision → dispatcher
- MySQL 持久化 + BlackboardService 缓存

## S1: 单会议跑 30 次触发链

| 指标 | 数值 |
|---|---|
| n | 30 |
| p50 | 228.5 ms |
| p95 | 260.4 ms |
| p99 | 363.3 ms |
| max | 363.3 ms |
| min | 226.5 ms |
| mean | 234.4 ms |
| stdev | 25.1 ms |

## 业务开销分析

| 维度 | 数值 |
|---|---|
| 理论下限 | 200 ms (4 × LLM 延迟) |
| 实际 mean | 234.4 ms |
| 业务开销 | 34.4 ms (+17.2%) |

业务开销 = 4 次 BlackboardService.write + 4 次 MySQL UPDATE + 4 次 INSERT 事件 + 订阅回调派发 + HTTP 序列化

## 结论

- 业务开销占比 < 17.2%，**触发链延迟瓶颈在 LLM 本身**
- 若要降低延迟 → 缩短 LLM 调用（缓存 / 并发 / 换更快模型）
- 并发改造：将 4 agent 串行触发改为并行（前提：解 version 冲突）→ 理论 50ms

## 不在压测范围内

- 并发吞吐（10+ 会议同时触发）需要：
  - 真实 HTTP 服务（uvicorn，TestClient thread-safety 受限）
  - 连接池扩容（默认 5 → 20+）
  - 单独跑脚本 — 见 scripts/bench_meeting_chain_concurrent.py（未来）
