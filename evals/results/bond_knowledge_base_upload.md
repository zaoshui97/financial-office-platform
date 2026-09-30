# 债券市场与交易规则知识库上传验收

## 结果

- 验收成功。应用就绪检查为 `HTTP 200 / ready / connected`。
- 从 `evals/results/knowledge_base_inventory.json` 读取源文件路径：`D:\rag_docs\finance_policy\深圳证券交易所债券交易规则.pdf`。
- 登录请求 `HTTP 200`；同名知识库不存在；创建请求 `HTTP 201`。
- 新知识库 ID 为 `2`，所有者为用户 `3`，名称和描述与任务要求一致。
- 上传请求仅发送一次，返回 `HTTP 201`；新文档 ID 为 `14`。

## 文件与解析

- 中文原文件名精确保留为 `深圳证券交易所债券交易规则.pdf`。
- 文件大小为 `546904` 字节，SHA-256 为 `571ab528a8a934bfe7ea28aa5d9a088a79100ab6fc96c51f567fafe64118e01f`。
- PDF 文件头有效、可读、未加密，共 `40` 页；40 页均有原生文本层。
- 每页原生非空白字符数均达到 OCR 阈值，未调用 Tesseract；OCR 页数和调用次数均为 `0`。
- 文档状态为 `parsed`，解析文本非空，共 `19955` 字符；索引状态为 `pending`。

## Chunk 核验

- 共生成 `24` 个 Chunk，`chunk_index` 从 `0` 连续编号。
- 页码元数据合法，完整覆盖 PDF 第 `1–40` 页，没有越界页码。
- 所有 Chunk 的 `content_hash` 均与 Chunk 文本 UTF-8 SHA-256 一致。
- 文档及全部 Chunk 均归属用户 `3`、知识库 `2`、文档 `14`。
- `active_index_generation`、`building_index_generation`、Point ID、Embedding provider/model/dimension/version 和 Collection 均为空。
- 保存文件使用生成式文件名，保存内容 SHA-256 与源文件一致。

## 隔离与安全

- 未操作原知识库 ID `1`，未上传其他资料。
- 未调用 Embedding、Qdrant 写入、聊天模型、`index` 或 `reindex`。
- 密码和 Token 未输出或持久化；请求结束后已清除相关内存引用。
