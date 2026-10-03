# 会议触发链并发基线（2026-10-03 21:37）

## 测试环境

- 真实 uvicorn server（127.0.0.1:18800）
- httpx 异步客户端，10 个会议同时触发
- 真实 LLM 链路（doubao/deepseek/qwen 任一）
- MySQL 连接池 10+20=30（够 10 并发）

## 10 会议并发触发

| 指标 | 数值 |
|---|---|
| n_concurrent | 10 |
| total | 53.44 s |
| throughput | 0.19 chains/sec |
| mean chain | 23566 ms |
| p50 | 18948 ms |
| p95 | 53434 ms |
| max | 53434 ms |
| min | 16721 ms |

## 结论

- 4 agent × 真实 LLM ≈ 7-15s/chain（视 provider）
- 10 并发下吞吐 ~0.2 chains/sec
- 串行改为并行（解 version 冲突）可提升 ~4x

## 建议

- 当前单会议串行链是瓶颈，并发只在不同会议间有效
- 优化方向：4 agent 改成并行（前提：黑板 version 机制允许）
