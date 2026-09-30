# refusal-01 Run 2 阈值真实回归报告

## 结论

- 验收通过：HTTP `200`，回答为“当前知识库中没有找到足够依据。”，引用为空。
- 生产阈值日志：安全校验后候选 `20` 条，`0.45` 阈值过滤后 `0` 条，最终上下文 `0` 条。
- Query Embedding `1` 次、Qdrant 查询 `1` 次（Top-K/limit `20`），Qwen `0` 次、DeepSeek `0` 次。
- 未触发关键词回退；响应 `retrieval_method=vector`，provider/model 均为空。

## 前置检查

- Uvicorn PID `44404` 的启动时间晚于阈值代码修改时间。
- 应用：`200 / ready / connected`。
- 有效配置：Top-K `20`、Top-N `6`、score threshold `0.45`。
- Collection：`green / 1024 / Cosine / 95 Points`。

## 检索与响应

- 原始最高分：`0.33558702`，低于 `0.45`。该数值来自相同题目、相同95点Collection的18题校准报告；生产日志按安全设计只记录数量，不记录候选分数。
- 过滤前后：`20 → 0`；Embedding 批次 `1`，返回查询向量 `1` 个。
- 总请求耗时：`1242.57 ms`；模型未调用，因此无模型耗时。
- 新增会话 ID `48`，助手消息 ID `54`。

## 数据核验

- 用户3会话数：`11 → 12`，新增 `1`；消息数：`22 → 24`，新增 `2`。
- 文档数 `13`、Chunk数 `97` 均未变化；知识库与索引摘要前后一致。
- Collection 前后均为 `95 Points`，未修改文档、Chunk、generation、映射或向量。
- 登录密码、Token及响应对象引用已在请求进程结束前清除。
