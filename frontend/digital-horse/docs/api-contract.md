# A21 金融智能办公平台 - API 接口契约

> 本文档是前后端共同遵守的契约，任何修改需双方同步确认。
> 最后更新：2024-01-24
> 版本：v1.0

---

## 通用说明

### 响应格式

所有接口统一返回以下格式：

```json
{
  "code": 200,
  "data": {},
  "msg": "操作成功"
}
```

| code | 说明 |
|------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未登录或登录过期 |
| 403 | 无权限 |
| 500 | 服务器内部错误 |

### 分页响应

列表接口统一返回分页数据：

```json
{
  "list": [],
  "total": 100,
  "page": 1,
  "pageSize": 20
}
```

---

## 模块一：会议管理 (Meeting)

### 数据类型

```typescript
// 待办事项
interface ActionItem {
  id: string;
  description: string;        // 待办描述
  assignee: string;           // 负责人ID
  assigneeName?: string;      // 负责人名称
  dueDate: string;            // 截止日期 (YYYY-MM-DD)
  status: 'todo' | 'in_progress' | 'done';
}

// 会议状态
type MeetingStatus = 'pending' | 'ongoing' | 'ended';

// 会议详情
interface Meeting {
  id: string;
  title: string;              // 会议标题
  startTime: string;          // 开始时间 (ISO8601)
  endTime: string;           // 结束时间 (ISO8601)
  participants: string[];     // 参与者ID列表
  status: MeetingStatus;
  transcript?: string;        // 录音转文本
  summary?: string;           // 会议纪要
  actionItems?: ActionItem[];  // 待办事项
  createdAt: string;
  updatedAt: string;
}

// 会议列表查询参数
interface MeetingListParams {
  status?: MeetingStatus;
  keyword?: string;
  page: number;
  pageSize: number;
}
```

### 接口列表

#### 1. 获取会议列表

```
GET /api/meetings
```

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 是 | 页码 |
| pageSize | number | 是 | 每页条数 |
| status | string | 否 | 会议状态 |
| keyword | string | 否 | 搜索关键词 |

**响应：**

```json
{
  "code": 200,
  "data": {
    "list": [{ /* Meeting */ }],
    "total": 50,
    "page": 1,
    "pageSize": 20
  },
  "msg": "success"
}
```

---

#### 2. 创建会议

```
POST /api/meetings
```

**请求体：**

```json
{
  "title": "产品评审会",
  "startTime": "2024-01-20T14:00:00+08:00",
  "endTime": "2024-01-20T15:30:00+08:00",
  "participants": ["user-001", "user-002"]
}
```

**响应：**

```json
{
  "code": 200,
  "data": { /* Meeting */ },
  "msg": "创建成功"
}
```

---

#### 3. 获取会议详情

```
GET /api/meetings/{id}
```

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 会议ID |

**响应：**

```json
{
  "code": 200,
  "data": { /* Meeting */ },
  "msg": "success"
}
```

---

#### 4. 更新会议

```
PUT /api/meetings/{id}
```

**路径参数：** `id` - 会议ID

**请求体：**

```json
{
  "title": "新标题",
  "status": "ended",
  "summary": "会议纪要内容"
}
```

**响应：**

```json
{
  "code": 200,
  "data": { /* Meeting */ },
  "msg": "更新成功"
}
```

---

#### 5. 删除会议

```
DELETE /api/meetings/{id}
```

**路径参数：** `id` - 会议ID

**响应：**

```json
{
  "code": 200,
  "data": null,
  "msg": "删除成功"
}
```

---

#### 6. 上传会议录音

```
POST /api/meetings/{id}/audio
```

**路径参数：** `id` - 会议ID

**请求体：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | 是 | 音频文件 (mp3/wav/m4a) |

**响应：**

```json
{
  "code": 200,
  "data": {
    "audioUrl": "https://cdn.example.com/audio/xxx.mp3"
  },
  "msg": "上传成功"
}
```

---

#### 7. 生成会议纪要

```
POST /api/meetings/{id}/generate
```

**路径参数：** `id` - 会议ID

**响应：**

```json
{
  "code": 200,
  "data": {
    "summary": "本次会议主要讨论了...",
    "actionItems": [
      {
        "id": "action-001",
        "description": "完成技术方案设计",
        "assignee": "user-002",
        "assigneeName": "李四",
        "dueDate": "2024-01-25",
        "status": "todo"
      }
    ]
  },
  "msg": "生成成功"
}
```

---

#### 8. 更新待办状态

```
PUT /api/meetings/{id}/action-items/{actionId}
```

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 会议ID |
| actionId | string | 是 | 待办ID |

**请求体：**

```json
{
  "status": "done"
}
```

**响应：**

```json
{
  "code": 200,
  "data": { /* ActionItem */ },
  "msg": "更新成功"
}
```

---

#### 9. 推送待办到第三方

```
POST /api/meetings/{id}/push-webhook
```

**路径参数：** `id` - 会议ID

**请求体：**

```json
{
  "platform": "dingtalk"
}
```

| platform | 说明 |
|----------|------|
| dingtalk | 钉钉 |
| wecom | 企业微信 |
| feishu | 飞书 |

**响应：**

```json
{
  "code": 200,
  "data": {
    "pushedCount": 3
  },
  "msg": "推送成功"
}
```

---

## 模块二：智能问答 (QA)

### 数据类型

```typescript
// 参考来源
interface Reference {
  id: string;
  title: string;
  category: string;
  snippet: string;           // 匹配片段
  url?: string;
}

// 问答消息
interface QAMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  references?: Reference[];
}

// 会话信息
interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}
```

### 接口列表

#### 1. 发起问答

```
POST /api/qa/ask
```

**请求体：**

```json
{
  "question": "如何申请权限？",
  "sessionId": "session-001"  // 可选，不传则创建新会话
}
```

**响应：**

```json
{
  "code": 200,
  "data": {
    "answer": "申请权限请按以下步骤...",
    "sessionId": "session-001",
    "references": [
      {
        "id": "ref-001",
        "title": "权限申请流程",
        "category": "流程文档",
        "snippet": "权限申请需要..."
      }
    ]
  },
  "msg": "success"
}
```

---

#### 2. 获取会话历史列表

```
GET /api/qa/sessions
```

**响应：**

```json
{
  "code": 200,
  "data": [
    {
      "id": "session-001",
      "title": "关于权限的问题",
      "createdAt": "2024-01-20T10:00:00+08:00",
      "updatedAt": "2024-01-20T10:30:00+08:00"
    }
  ],
  "msg": "success"
}
```

---

#### 3. 删除会话

```
DELETE /api/qa/sessions/{id}
```

**路径参数：** `id` - 会话ID

**响应：**

```json
{
  "code": 200,
  "data": null,
  "msg": "删除成功"
}
```

---

#### 4. 重命名会话

```
PUT /api/qa/sessions/{id}
```

**路径参数：** `id` - 会话ID

**请求体：**

```json
{
  "title": "新标题"
}
```

**响应：**

```json
{
  "code": 200,
  "data": { /* Session */ },
  "msg": "更新成功"
}
```

---

#### 5. 获取会话的所有消息

```
GET /api/qa/sessions/{id}/messages
```

**路径参数：** `id` - 会话ID

**响应：**

```json
{
  "code": 200,
  "data": [
    { /* QAMessage */ },
    { /* QAMessage */ }
  ],
  "msg": "success"
}
```

---

## 模块三：知识库 (Knowledge)

### 数据类型

```typescript
// 知识库分类
type KnowledgeCategory = 'policy' | 'project' | 'faq' | 'template' | 'minutes';

// 文档状态
type DocumentStatus = 'indexed' | 'indexing' | 'failed';

// 知识库文档
interface KnowledgeDocument {
  id: string;
  title: string;
  category: KnowledgeCategory;
  content?: string;
  fileSize: number;
  fileType: string;
  status: DocumentStatus;
  uploadedAt: string;
  updatedAt: string;
  uploader?: string;
}

// 分类树
interface KnowledgeCategoryTree {
  id: string;
  name: string;
  parentId?: string;
  count: number;
  children?: KnowledgeCategoryTree[];
}
```

### 接口列表

#### 1. 上传文档

```
POST /api/knowledge/upload
```

**请求体：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | 是 | 文档文件 |
| category | string | 是 | 分类 |
| title | string | 否 | 文档标题（不传则用文件名） |

**响应：**

```json
{
  "code": 200,
  "data": { /* KnowledgeDocument */ },
  "msg": "上传成功"
}
```

---

#### 2. 获取文档列表

```
GET /api/knowledge/documents
```

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 是 | 页码 |
| pageSize | number | 是 | 每页条数 |
| category | string | 否 | 分类 |
| keyword | string | 否 | 搜索关键词 |
| status | string | 否 | 文档状态 |

**响应：**

```json
{
  "code": 200,
  "data": {
    "list": [{ /* KnowledgeDocument */ }],
    "total": 100,
    "page": 1,
    "pageSize": 20
  },
  "msg": "success"
}
```

---

#### 3. 获取文档详情

```
GET /api/knowledge/documents/{id}
```

**路径参数：** `id` - 文档ID

**响应：**

```json
{
  "code": 200,
  "data": { /* KnowledgeDocument */ },
  "msg": "success"
}
```

---

#### 4. 删除文档

```
DELETE /api/knowledge/documents/{id}
```

**路径参数：** `id` - 文档ID

**响应：**

```json
{
  "code": 200,
  "data": null,
  "msg": "删除成功"
}
```

---

#### 5. 获取分类树

```
GET /api/knowledge/categories
```

**响应：**

```json
{
  "code": 200,
  "data": [
    {
      "id": "cat-001",
      "name": "制度文档",
      "count": 25,
      "children": [
        { "id": "cat-002", "name": "人事制度", "count": 10 },
        { "id": "cat-003", "name": "财务制度", "count": 15 }
      ]
    }
  ],
  "msg": "success"
}
```

---

#### 6. 语义搜索

```
POST /api/knowledge/search
```

**请求体：**

```json
{
  "query": "年假如何计算",
  "category": "policy",
  "limit": 10
}
```

**响应：**

```json
{
  "code": 200,
  "data": {
    "results": [
      {
        "document": { /* KnowledgeDocument */ },
        "score": 0.95,
        "highlight": "年假天数根据<em>司龄</em><em>计算</em>..."
      }
    ]
  },
  "msg": "success"
}
```

---

## 模块四：文档生成 (Document)

### 数据类型

```typescript
// 文档类型
type DocumentType = 'notice' | 'email' | 'minutes' | 'report';

// 生成请求
interface GenerateDocumentRequest {
  type: DocumentType;
  params: Record<string, any>;
}

// 生成响应
interface GenerateDocumentResponse {
  title: string;
  content: string;
  createdAt: string;
}

// 历史记录
interface DocumentHistoryItem {
  id: string;
  type: DocumentType;
  title: string;
  params: Record<string, any>;
  createdAt: string;
}
```

### 接口列表

#### 1. 生成文档

```
POST /api/documents/generate
```

**请求体：**

```json
{
  "type": "notice",
  "params": {
    "title": "关于Q1总结会议的通知",
    "time": "2024-01-25 14:00",
    "location": "会议室A",
    "participants": ["全体员工"]
  }
}
```

**响应：**

```json
{
  "code": 200,
  "data": {
    "title": "关于Q1总结会议的通知",
    "content": "<h1>关于Q1总结会议的通知</h1>...",
    "createdAt": "2024-01-20T10:00:00+08:00"
  },
  "msg": "生成成功"
}
```

---

#### 2. 获取生成历史

```
GET /api/documents/history
```

**Query 参数：** `page`, `pageSize`

**响应：**

```json
{
  "code": 200,
  "data": {
    "list": [{ /* DocumentHistoryItem */ }],
    "total": 30,
    "page": 1,
    "pageSize": 20
  },
  "msg": "success"
}
```

---

#### 3. 获取历史文档详情

```
GET /api/documents/history/{id}
```

**路径参数：** `id` - 历史记录ID

**响应：**

```json
{
  "code": 200,
  "data": {
    "title": "文档标题",
    "content": "文档内容...",
    "params": {},
    "createdAt": "2024-01-20T10:00:00+08:00"
  },
  "msg": "success"
}
```

---

## 模块五：行业洞察 (Insights)

### 数据类型

```typescript
// 新闻条目
interface NewsItem {
  id: string;
  title: string;
  source: string;
  publishTime: string;
  summary: string;
  content?: string;
  url?: string;
  isStarred: boolean;
  category?: string;
}

// 法规条目
interface RegulationItem {
  id: string;
  name: string;
  publisher: string;
  publishTime: string;
  status: 'effective' | 'draft' | 'pending';
}
```

### 接口列表

#### 1. 获取行业洞察数据

```
GET /api/insights
```

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 是 | 页码 |
| pageSize | number | 是 | 每页条数 |
| category | string | 否 | 分类 |
| starred | boolean | 否 | 仅收藏 |

**响应：**

```json
{
  "code": 200,
  "data": {
    "list": [{ /* NewsItem */ }],
    "total": 100,
    "page": 1,
    "pageSize": 20
  },
  "msg": "success"
}
```

---

#### 2. 收藏/取消收藏新闻

```
POST /api/insights/news/{id}/star
```

**路径参数：** `id` - 新闻ID

**响应：**

```json
{
  "code": 200,
  "data": {
    "isStarred": true
  },
  "msg": "收藏成功"
}
```

---

#### 3. 搜索新闻

```
POST /api/insights/search
```

**请求体：**

```json
{
  "keyword": "金融科技",
  "category": "政策",
  "page": 1,
  "pageSize": 20
}
```

**响应：**

```json
{
  "code": 200,
  "data": {
    "list": [{ /* NewsItem */ }],
    "total": 50,
    "page": 1,
    "pageSize": 20
  },
  "msg": "success"
}
```

---

## 模块六：用户与认证 (Auth)

### 数据类型

```typescript
// 用户角色
type UserRole = 'admin' | 'manager' | 'employee';

// 用户信息
interface User {
  id: string;
  name: string;
  avatar?: string;
  email: string;
  role: UserRole;
  department?: string;
  position?: string;
}

// 登录请求
interface LoginRequest {
  username: string;
  password: string;
}

// 登录响应
interface LoginResponse {
  token: string;
  user: User;
  expiresAt: string;
}
```

### 接口列表

#### 1. 登录

```
POST /api/auth/login
```

**请求体：**

```json
{
  "username": "zhangsan",
  "password": "password123"
}
```

**响应：**

```json
{
  "code": 200,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "user-001",
      "name": "张三",
      "email": "zhangsan@example.com",
      "role": "employee",
      "department": "产品部",
      "position": "产品经理"
    },
    "expiresAt": "2024-01-21T10:00:00+08:00"
  },
  "msg": "登录成功"
}
```

---

#### 2. 获取当前用户信息

```
GET /api/auth/me
```

**响应：**

```json
{
  "code": 200,
  "data": { /* User */ },
  "msg": "success"
}
```

---

#### 3. 登出

```
POST /api/auth/logout
```

**响应：**

```json
{
  "code": 200,
  "data": null,
  "msg": "登出成功"
}
```

---

## 附录：错误码对照表

| 错误码 | 说明 | 处理建议 |
|--------|------|----------|
| 200 | 成功 | - |
| 400 | 参数错误 | 检查请求参数 |
| 401 | 未登录 | 跳转登录页 |
| 403 | 无权限 | 提示用户权限不足 |
| 404 | 资源不存在 | 检查ID是否正确 |
| 409 | 冲突 | 如重复创建等 |
| 413 | 文件过大 | 压缩或分割文件 |
| 429 | 请求过于频繁 | 降低请求频率 |
| 500 | 服务器错误 | 联系后端排查 |

---

**文档维护人：** 前端组
**下次评审日期：** 2024-01-31
