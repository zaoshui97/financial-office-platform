# 金融企业智能办公平台 API 契约

> 契约版本：v1.0
> 后端版本：0.1.0
> 更新时间：2026-07-24
> 状态：与当前后端实现一致

本文档是当前前后端联调基线。前端只应调用本文列出的接口；新增或修改路径、字段、状态码时，前后端需同步更新本文档。

## 1. 通用约定

### 1.1 服务地址

本地开发地址：

```text
http://127.0.0.1:8000
```

API 统一前缀：

```text
/api/v1
```

Swagger 文档：

```text
http://127.0.0.1:8000/docs
```

### 1.2 字段与数据类型

- 请求和响应字段统一使用 `snake_case`。
- 所有业务主键均为正整数，不使用 `session-001` 等字符串 ID。
- 时间字段为 ISO 8601 字符串，例如 `2026-07-24T10:30:00`。
- 普通接口使用 `application/json`。
- 登录接口使用 `application/x-www-form-urlencoded`。
- 文件上传接口使用 `multipart/form-data`。

### 1.3 响应格式

当前接口直接返回业务数据，不使用 `{ code, data, msg }` 包装。

成功示例：

```json
{
  "id": 1,
  "username": "demo_user"
}
```

普通错误示例：

```json
{
  "detail": "知识库不存在"
}
```

参数校验错误为 HTTP `422`，响应示例：

```json
{
  "detail": [
    {
      "type": "string_too_short",
      "loc": ["body", "message"],
      "msg": "String should have at least 1 character",
      "input": ""
    }
  ]
}
```

### 1.4 身份认证

除健康检查、注册和登录外，其余接口均需要 JWT。

请求头：

```http
Authorization: Bearer <access_token>
```

JWT 过期或无效时返回 HTTP `401`：

```json
{
  "detail": "身份凭证无效或已过期"
}
```

### 1.5 常用状态码

| 状态码 | 含义 |
|---|---|
| 200 | 请求成功 |
| 201 | 资源创建成功 |
| 400 | 请求内容不合法，例如空文件 |
| 401 | 未登录、令牌无效或登录失败 |
| 404 | 当前用户无权访问或资源不存在 |
| 409 | 资源状态冲突或重复数据 |
| 413 | 上传文件过大 |
| 415 | 不支持的文件类型 |
| 422 | 请求参数校验失败或文档解析失败 |
| 500 | 未处理的服务器内部错误 |
| 503 | 数据库或大模型服务不可用 |

## 2. TypeScript 公共类型

```typescript
export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
}

export interface KnowledgeBase {
  id: number;
  name: string;
  description: string | null;
  owner_id: number;
  created_at: string;
}

export type DocumentStatus = "processing" | "parsed" | "failed";

export interface KnowledgeDocument {
  id: number;
  knowledge_base_id: number;
  original_filename: string;
  file_type: "pdf" | "docx" | "txt";
  file_size: number;
  status: DocumentStatus;
  page_count: number | null;
  parsed_char_count: number;
  error_message: string | null;
  created_at: string;
}

export interface ChatCitation {
  document_id: number;
  filename: string;
  content: string;
  score: number;
}

export interface ChatResponse {
  conversation_id: number;
  assistant_message_id: number;
  mode: "llm" | "rag" | "web_search";
  answer: string;
  citations: ChatCitation[];
}
```

## 3. 系统接口

### 3.1 存活检查

```http
GET /api/v1/system/health/live
```

无需认证。

成功响应 `200`：

```json
{
  "status": "alive",
  "service": "金融企业智能办公平台",
  "version": "0.1.0"
}
```

### 3.2 就绪检查

```http
GET /api/v1/system/health/ready
```

无需认证，用于检查 MySQL 是否可连接。

成功响应 `200`：

```json
{
  "status": "ready",
  "database": "connected"
}
```

失败响应 `503`：

```json
{
  "status": "not_ready",
  "database": "disconnected"
}
```

## 4. 用户认证

### 4.1 注册用户

```http
POST /api/v1/auth/register
Content-Type: application/json
```

请求体：

```json
{
  "username": "demo_user",
  "email": "demo@example.com",
  "password": "DemoPass123!",
  "full_name": "演示用户"
}
```

约束：

- `username`：3 至 50 个字符，仅允许英文字母、数字、下划线、点和短横线。
- `email`：合法邮箱地址。
- `password`：8 至 128 个字符。
- `full_name`：可选，最长 100 个字符。

成功响应 `201`：

```json
{
  "id": 1,
  "username": "demo_user",
  "email": "demo@example.com",
  "full_name": "演示用户",
  "is_active": true,
  "is_superuser": false,
  "created_at": "2026-07-24T10:00:00"
}
```

可能错误：

- `409`：用户名或邮箱已存在。
- `422`：字段格式不合法。

### 4.2 用户登录

```http
POST /api/v1/auth/login
Content-Type: application/x-www-form-urlencoded
```

表单字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| username | string | 是 | 用户名或邮箱 |
| password | string | 是 | 登录密码 |

前端调用示例：

```typescript
const form = new URLSearchParams();
form.set("username", username);
form.set("password", password);

const response = await fetch("/api/v1/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: form,
});
```

成功响应 `200`：

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 7200
}
```

可能错误：

- `401`：用户名、邮箱或密码错误。
- `422`：缺少表单字段。

### 4.3 获取当前用户

```http
GET /api/v1/auth/me
Authorization: Bearer <access_token>
```

成功响应 `200`：返回 `User` 对象。

```json
{
  "id": 1,
  "username": "demo_user",
  "email": "demo@example.com",
  "full_name": "演示用户",
  "is_active": true,
  "is_superuser": false,
  "created_at": "2026-07-24T10:00:00"
}
```

## 5. 企业知识库

### 5.1 创建知识库

```http
POST /api/v1/rag/knowledge-bases
Authorization: Bearer <access_token>
Content-Type: application/json
```

请求体：

```json
{
  "name": "企业制度库",
  "description": "人事、财务和差旅制度"
}
```

约束：

- `name`：1 至 100 个字符。
- `description`：可选，最长 500 个字符。

成功响应 `201`：

```json
{
  "id": 1,
  "name": "企业制度库",
  "description": "人事、财务和差旅制度",
  "owner_id": 1,
  "created_at": "2026-07-24T10:10:00"
}
```

### 5.2 获取知识库列表

```http
GET /api/v1/rag/knowledge-bases
Authorization: Bearer <access_token>
```

当前接口不分页，只返回当前用户拥有的知识库。

成功响应 `200`：

```json
[
  {
    "id": 1,
    "name": "企业制度库",
    "description": "人事、财务和差旅制度",
    "owner_id": 1,
    "created_at": "2026-07-24T10:10:00"
  }
]
```

### 5.3 上传并解析文档

```http
POST /api/v1/rag/knowledge-bases/{knowledge_base_id}/documents
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

路径参数：

| 参数 | 类型 | 说明 |
|---|---|---|
| knowledge_base_id | integer | 当前用户的知识库 ID |

表单字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| file | File | 是 | PDF、DOCX 或 TXT 文件 |

限制：

- 默认最大文件大小为 20 MB。
- TXT 支持 UTF-8、UTF-8 BOM 和 GB18030。
- 扫描版 PDF 当前不支持 OCR。

成功响应 `201`：

```json
{
  "id": 10,
  "knowledge_base_id": 1,
  "original_filename": "travel-policy.pdf",
  "file_type": "pdf",
  "file_size": 102400,
  "status": "parsed",
  "page_count": 5,
  "parsed_char_count": 12680,
  "error_message": null,
  "created_at": "2026-07-24T10:20:00"
}
```

可能错误：

- `400`：上传文件为空。
- `404`：知识库不存在或不属于当前用户。
- `413`：文件超过大小限制。
- `415`：文件不是 PDF、DOCX 或 TXT。
- `422`：文件损坏、加密、编码未知或没有可提取文本。

### 5.4 获取知识库文档列表

```http
GET /api/v1/rag/knowledge-bases/{knowledge_base_id}/documents
Authorization: Bearer <access_token>
```

当前接口不分页。

成功响应 `200`：返回 `KnowledgeDocument[]`。

```json
[
  {
    "id": 10,
    "knowledge_base_id": 1,
    "original_filename": "travel-policy.pdf",
    "file_type": "pdf",
    "file_size": 102400,
    "status": "parsed",
    "page_count": 5,
    "parsed_char_count": 12680,
    "error_message": null,
    "created_at": "2026-07-24T10:20:00"
  }
]
```

### 5.5 获取文档解析全文

```http
GET /api/v1/rag/documents/{document_id}/content
Authorization: Bearer <access_token>
```

成功响应 `200`：在 `KnowledgeDocument` 基础上增加 `parsed_text`。

```json
{
  "id": 10,
  "knowledge_base_id": 1,
  "original_filename": "travel-policy.pdf",
  "file_type": "pdf",
  "file_size": 102400,
  "status": "parsed",
  "page_count": 5,
  "parsed_char_count": 12680,
  "error_message": null,
  "created_at": "2026-07-24T10:20:00",
  "parsed_text": "差旅管理制度……"
}
```

可能错误：

- `404`：文档不存在或不属于当前用户。
- `409`：文档尚未解析成功。

## 6. 智能聊天助手

### 6.1 发起或继续聊天

```http
POST /api/v1/chat
Authorization: Bearer <access_token>
Content-Type: application/json
```

请求字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| message | string | 是 | 用户问题，1 至 10000 个字符 |
| conversation_id | integer | 否 | 已有会话 ID；不传时创建新会话 |
| knowledge_base_id | integer | 否 | 当前用户知识库 ID；传入时启用 RAG |
| mode | string | 否 | `llm`、`rag`或`web_search`；不传时自动推断 |

普通 LLM 对话：

```json
{
  "message": "请帮我整理今天的工作计划",
  "mode": "llm"
}
```

RAG 知识库问答：

```json
{
  "message": "员工差旅住宿标准是多少？",
  "knowledge_base_id": 1,
  "mode": "rag"
}
```

联网搜索问答：

```json
{
  "message": "北京今天的天气怎么样？",
  "mode": "web_search"
}
```

继续已有 RAG 会话：

```json
{
  "message": "超出标准如何处理？",
  "conversation_id": 5,
  "knowledge_base_id": 1,
  "mode": "rag"
}
```

注意：

- `rag`模式必须提供`knowledge_base_id`。
- `llm`和`web_search`模式不能提供`knowledge_base_id`。
- 为兼容旧客户端，未传`mode`时，有`knowledge_base_id`自动使用`rag`，否则使用`llm`。
- `knowledge_base_id`是单次请求参数。继续同一会话时，若本轮仍需知识库检索，也必须再次传入。

成功响应 `200`：

```json
{
  "conversation_id": 5,
  "assistant_message_id": 22,
  "mode": "rag",
  "answer": "员工住宿标准为每晚500元。[1]",
  "citations": [
    {
      "document_id": 10,
      "filename": "travel-policy.pdf",
      "content": "员工住宿标准为每晚500元，超出部分由个人承担。",
      "score": 24.0
    }
  ]
}
```

返回说明：

- `mode` 为 `llm` 时，`citations` 通常为空数组。
- `mode` 为 `rag` 时，`citations` 返回本轮命中的文档片段。
- `mode` 为 `web_search` 时，由火山方舟执行联网搜索，当前`citations`返回空数组。
- `web_search`需要火山方舟账号已开通内容插件；未开通时接口返回`503`。
- 知识库没有匹配依据时，返回 `当前知识库中没有找到足够依据。`，不会调用大模型。

可能错误：

- `401`：未登录或令牌无效。
- `404`：会话或知识库不存在，或不属于当前用户。
- `422`：请求字段不合法。
- `503`：未配置大模型 API、联网搜索提供方不正确或远程模型调用失败。

## 7. 前端联调流程

推荐调用顺序：

1. 调用注册接口创建用户。
2. 调用登录接口获取 `access_token`。
3. 保存令牌，并为受保护接口添加 `Authorization` 请求头。
4. 调用 `/auth/me` 验证登录状态。
5. 创建知识库。
6. 上传并解析文档。
7. 使用 `knowledge_base_id` 发起 RAG 聊天。
8. 保存响应中的 `conversation_id`，用于继续对话。

前端登录状态建议：

- 本地开发可将 `access_token` 保存到内存状态或 `sessionStorage`。
- 收到 HTTP `401` 时清除令牌并跳转登录页。
- 当前后端没有刷新令牌和注销接口；前端注销时直接清除本地令牌。

## 8. 当前未提供的接口

以下能力尚未在后端实现，前端不得直接假定存在：

- 聊天会话列表、消息列表、重命名和删除接口。
- 知识库或文档删除接口。
- 文档分页、分类树、语义搜索接口。
- 用户注销和刷新令牌接口。
- 会议管理、录音上传、会议纪要和待办接口。
- 文档生成和生成历史接口。
- 行业洞察、新闻搜索和收藏接口。
- Agent 和工作流接口。

上述接口需要新增时，应先更新本契约，再进入后端和前端开发。
