# single-08 Top-6 真实回归 Run 2

## 状态

**前置检查失败，Run 2 未发送真实 RAG 请求。**

- `127.0.0.1:8000` 没有监听进程，无法确认 Uvicorn 使用本次修改后的代码。
- 按既定约束，未启动或重启服务，也未继续健康、配置和 Qdrant 检查。
- 未登录，未发送 `/api/v1/chat`。
- Query Embedding、Qdrant、聊天模型和 Chat API 调用次数均为 `0`。
- 未新增会话或消息，未修改知识库、文档、Chunk、generation、索引或 Collection。
- 原失败报告 `single_08_after_top6.json/.md` 未被覆盖。

需要先启动包含最新代码的 Uvicorn 进程，再执行真实回归。
