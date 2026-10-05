# API 端点清单（v1.1）

> 自动生成，共 43 条路径、62 个端点。

## 目录

- [AI 路由](#ai-路由)
- [RAG 知识域](#rag-知识域)
- [会议协同域](#会议协同域)
- [决策智能域](#决策智能域)
- [合规审计域](#合规审计域)
- [对话域](#对话域)
- [智能办公域](#智能办公域)
- [机构域](#机构域)
- [系统域](#系统域)
- [认证授权域](#认证授权域)
- [黑板域](#黑板域)

---

## AI 路由

端点数：**2**

| Method | Path | Summary | Tags |
|---|---|---|---|
| `GET` | `/api/v1/ai/diagnostics` | 显式触发三方模型健康检查（产生远程调用，仅供运维） | AI 诊断 |
| `GET` | `/api/v1/ai/diagnostics/profiles` | 列出被诊断的 profile 名（仅元数据，不产生远程调用） | AI 诊断 |

## RAG 知识域

端点数：**12**

| Method | Path | Summary | Tags |
|---|---|---|---|
| `GET` | `/api/v1/rag/documents/{document_id}` | 文档状态 | 企业知识库 |
| `DELETE` | `/api/v1/rag/documents/{document_id}` | 删除文档 | 企业知识库 |
| `GET` | `/api/v1/rag/documents/{document_id}/content` | 查看文档解析文本 | 企业知识库 |
| `POST` | `/api/v1/rag/documents/{document_id}/index` | 建立文档向量索引 | 企业知识库 |
| `POST` | `/api/v1/rag/documents/{document_id}/reindex` | 重新建立文档向量索引 | 企业知识库 |
| `GET` | `/api/v1/rag/knowledge-bases` | 知识库列表 | 企业知识库 |
| `POST` | `/api/v1/rag/knowledge-bases` | 创建知识库 | 企业知识库 |
| `GET` | `/api/v1/rag/knowledge-bases/{knowledge_base_id}` | 知识库详情 | 企业知识库 |
| `PATCH` | `/api/v1/rag/knowledge-bases/{knowledge_base_id}` | 更新知识库 | 企业知识库 |
| `DELETE` | `/api/v1/rag/knowledge-bases/{knowledge_base_id}` | 删除知识库 | 企业知识库 |
| `POST` | `/api/v1/rag/knowledge-bases/{knowledge_base_id}/documents` | 上传并解析文档 | 企业知识库 |
| `GET` | `/api/v1/rag/knowledge-bases/{knowledge_base_id}/documents` | 知识库文档列表 | 企业知识库 |

## 会议协同域

端点数：**4**

| Method | Path | Summary | Tags |
|---|---|---|---|
| `POST` | `/api/v1/meetings` | 创建会议（自动激活 + 写 moderator 初始 state） | 会议 Agent |
| `GET` | `/api/v1/meetings` | 列出当前用户的会议（可选按状态过滤） | 会议 Agent |
| `GET` | `/api/v1/meetings/{meeting_id}` | 会议详情（含 moderator 最新的 topic/agenda/phase） | 会议 Agent |
| `DELETE` | `/api/v1/meetings/{meeting_id}` | 关闭会议（仅 host / 仅 active） | 会议 Agent |

## 决策智能域

端点数：**9**

| Method | Path | Summary | Tags |
|---|---|---|---|
| `POST` | `/api/v1/decision/business-impact` | AI 评估业务影响 | 决策智能域（亮点三） |
| `GET` | `/api/v1/decision/business-impact` | 查询业务影响列表 | 决策智能域（亮点三） |
| `POST` | `/api/v1/decision/decision-playbacks` | 记录决策回放（自动计算防篡改哈希） | 决策智能域（亮点三） |
| `GET` | `/api/v1/decision/decision-playbacks` | 查询决策回放 | 决策智能域（亮点三） |
| `POST` | `/api/v1/decision/decision-playbacks/{playback_id}/verify` | 校验决策回放完整性（防篡改） | 决策智能域（亮点三） |
| `POST` | `/api/v1/decision/news` | 录入行业资讯 | 决策智能域（亮点三） |
| `GET` | `/api/v1/decision/news` | 查询行业资讯（可选按重要度过滤） | 决策智能域（亮点三） |
| `POST` | `/api/v1/decision/regulations` | 录入法规 | 决策智能域（亮点三） |
| `GET` | `/api/v1/decision/regulations` | 分页查询法规 | 决策智能域（亮点三） |

## 合规审计域

端点数：**4**

| Method | Path | Summary | Tags |
|---|---|---|---|
| `GET` | `/api/v1/compliance/sandbox/audit` | 审计日志查询 | 合规沙箱 |
| `GET` | `/api/v1/compliance/sandbox/kill-switch` | 查看 Kill Switch 状态 | 合规沙箱 |
| `POST` | `/api/v1/compliance/sandbox/kill-switch` | 开启 Kill Switch（熔断） | 合规沙箱 |
| `POST` | `/api/v1/compliance/sandbox/kill-switch/resume` | 关闭 Kill Switch（恢复） | 合规沙箱 |

## 对话域

端点数：**3**

| Method | Path | Summary | Tags |
|---|---|---|---|
| `POST` | `/api/v1/chat` | 企业AI聊天（一次性响应） | 智能聊天助手 |
| `POST` | `/api/v1/chat/stream` | 企业AI聊天（流式 SSE） | 智能聊天助手 |
| `POST` | `/api/v1/compliance/sandbox/chat` | 合规沙箱 LLM 聊天 | 合规沙箱 |

## 智能办公域

端点数：**5**

| Method | Path | Summary | Tags |
|---|---|---|---|
| `POST` | `/api/v1/office/generated-contents` | 记录 AI 生成内容 | 智能办公 |
| `GET` | `/api/v1/office/generated-contents` | 分页查询 AI 生成内容 | 智能办公 |
| `POST` | `/api/v1/office/templates` | 创建文档模板 | 智能办公 |
| `GET` | `/api/v1/office/templates` | 分页查询模板 | 智能办公 |
| `GET` | `/api/v1/office/templates/{template_id}` | 模板详情 | 智能办公 |

## 机构域

端点数：**9**

| Method | Path | Summary | Tags |
|---|---|---|---|
| `POST` | `/api/v1/organizations` | 创建机构（多租户隔离根） | 机构域（多租户隔离） |
| `GET` | `/api/v1/organizations` | 分页查询机构列表 | 机构域（多租户隔离） |
| `GET` | `/api/v1/organizations/business-domains` | 列出所有业务领域 | 机构域（多租户隔离） |
| `POST` | `/api/v1/organizations/business-domains` | 创建业务领域 | 机构域（多租户隔离） |
| `GET` | `/api/v1/organizations/customer-types` | 列出所有客户类型 | 机构域（多租户隔离） |
| `POST` | `/api/v1/organizations/customer-types` | 创建客户类型 | 机构域（多租户隔离） |
| `POST` | `/api/v1/organizations/departments` | 创建部门 | 机构域（多租户隔离） |
| `GET` | `/api/v1/organizations/{org_id}` | 机构详情 | 机构域（多租户隔离） |
| `GET` | `/api/v1/organizations/{org_id}/departments` | 按机构ID列出部门 | 机构域（多租户隔离） |

## 系统域

端点数：**2**

| Method | Path | Summary | Tags |
|---|---|---|---|
| `GET` | `/api/v1/system/health/live` | 存活检查 | 系统 |
| `GET` | `/api/v1/system/health/ready` | 就绪检查 | 系统 |

## 认证授权域

端点数：**3**

| Method | Path | Summary | Tags |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | 用户登录 | 用户认证 |
| `GET` | `/api/v1/auth/me` | 当前用户 | 用户认证 |
| `POST` | `/api/v1/auth/register` | 注册用户 | 用户认证 |

## 黑板域

端点数：**9**

| Method | Path | Summary | Tags |
|---|---|---|---|
| `POST` | `/api/v1/blackboard/events` | Agent 写入事件 | 4 Agent 共享黑板 |
| `GET` | `/api/v1/blackboard/events` | 按 session 拉取事件（支持 since_id 轮询） | 4 Agent 共享黑板 |
| `GET` | `/api/v1/blackboard/sessions` | 列出当前用户 OPEN 的 session | 4 Agent 共享黑板 |
| `POST` | `/api/v1/blackboard/sessions` | 创建协作 session | 4 Agent 共享黑板 |
| `POST` | `/api/v1/blackboard/sessions/{session_id}/close` | 手动关闭 session | 4 Agent 共享黑板 |
| `GET` | `/api/v1/blackboard/sessions/{session_id}/summary` | 汇总 4 角色最新事件 + 错误数 | 4 Agent 共享黑板 |
| `GET` | `/api/v1/meetings/{meeting_id}/blackboard` | 读会议黑板全部 Agent 最新状态 | 会议 Agent |
| `GET` | `/api/v1/meetings/{meeting_id}/blackboard/events` | 拉取 id > since_event_id 的事件流（重连后增量同步） | 会议 Agent |
| `POST` | `/api/v1/meetings/{meeting_id}/blackboard/{agent_role}` | 触发指定 Agent 跑一次（同步等结果） | 会议 Agent |

