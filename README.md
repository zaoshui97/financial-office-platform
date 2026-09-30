# 金融企业智能办公平台后端

当前完成：FastAPI基础工程、JWT用户认证、RAG文档上传解析，以及支持普通LLM、知识库问答和火山方舟联网搜索的智能聊天入口。

智能聊天会保存MySQL会话历史，并按任务路由到不同模型。指定`knowledge_base_id`时，从当前用户已解析的企业文档中召回相关片段，并返回引用来源。

## 环境准备

1. 激活环境：`.\.venv\Scripts\Activate.ps1`
2. 安装依赖：`python -m pip install -r requirements-dev.txt`
3. 启动基础服务：`docker compose up -d mysql redis`
4. 修改`.env`中的MySQL连接信息和模型提供方配置。
5. 使用OpenAI兼容服务时配置`AI_API_KEY`、`AI_BASE_URL`和任务模型。
6. 使用火山方舟时按下方示例配置`ARK_API_KEY`和任务模型。
7. 执行迁移：`python -m alembic upgrade head`
8. 启动服务：`python -m uvicorn app.main:app --reload`
9. 打开接口文档：`http://127.0.0.1:8000/docs`

## 火山方舟配置

```env
AI_PROVIDER=ark
ARK_API_KEY=你的火山方舟API密钥
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
AI_CHAT_MODEL=deepseek-v4-pro-260425
AI_RAG_MODEL=deepseek-v4-pro-260425
AI_WEB_SEARCH_MODEL=deepseek-v4-pro-260425
AI_WEB_SEARCH_MAX_KEYWORD=2
```

`ARK_API_KEY`只保存在后端环境变量中。修改配置后需要重新启动服务。

联网搜索还需要在火山方舟控制台单独开通内容插件。若未开通，普通聊天和RAG可以使用，但`web_search`会返回服务未开通提示。开通地址：

`https://console.volcengine.com/common-buy/CC_content_plugin`

## 多模型路由配置

业务层不直接依赖具体模型。`chat service`、文档服务和Agent服务只构造`AIRequest`并调用`llm_gateway`，由`ModelRouter`选择具名Provider。

默认任务路由：

| 业务任务 | 首选模型 | fallback |
| --- | --- | --- |
| 财务分析、复杂推理、Agent规划、工作流决策、SQL生成 | DeepSeek | Qwen |
| 文档、公文、邮件、会议纪要、中文润色 | Doubao | Qwen |
| 知识库RAG、长文档、文件问答、文档分析 | Qwen | DeepSeek |

基础配置：

```env
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-reasoner

DOUBAO_API_KEY=
DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
DOUBAO_MODEL=你的豆包Model ID

QWEN_API_KEY=
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen-plus
```

动态配置使用JSON环境变量，路由数组的顺序就是主模型到备用模型的顺序：

```env
AI_PROVIDERS_JSON={"deepseek":{"base_url":"https://api.deepseek.com/v1","api_key_env":"DEEPSEEK_API_KEY","api_style":"chat_completions","timeout_seconds":60,"max_retries":0},"doubao":{"base_url":"https://ark.cn-beijing.volces.com/api/v3","api_key_env":"DOUBAO_API_KEY","api_style":"responses","timeout_seconds":180,"max_retries":0},"qwen":{"base_url":"https://dashscope.aliyuncs.com/compatible-mode/v1","api_key_env":"QWEN_API_KEY","api_style":"chat_completions","timeout_seconds":90,"max_retries":0}}
AI_MODEL_PROFILES_JSON={"doubao_document":{"provider":"doubao","model":"你的豆包Model ID","temperature":0.6,"supports_long_context":true},"deepseek_code":{"provider":"deepseek","model":"deepseek-reasoner","temperature":0.1,"supports_reasoning":true},"qwen_rag":{"provider":"qwen","model":"qwen-plus","temperature":0.2,"supports_long_context":true}}
AI_TASK_ROUTES_JSON={"document_generation":["doubao_document","qwen_rag"],"code_reasoning":["deepseek_code","qwen_rag"],"rag_answer":["qwen_rag","deepseek_code"]}
AI_FALLBACK_ENABLED=true
AI_MAX_RETRIES=1
AI_RETRY_BACKOFF_SECONDS=0.2
```

`max_retries`控制OpenAI SDK内部重试，建议保持为0，由Gateway统一执行fallback，避免两层重试叠加导致请求长时间阻塞。推理模型可按Provider单独提高`timeout_seconds`。

调用示例：

```python
from app.ai.llm_gateway import llm_gateway
from app.ai.schemas import AIRequest

response = llm_gateway.generate(
    AIRequest(
        task="document_generation",
        messages=[{"role": "user", "content": "生成一份项目通知"}],
        complexity="medium",
        need_long_context=True,
    )
)
```

流式输出和Token预估使用同一套路由：

```python
request = AIRequest(
    task="knowledge_question",
    messages=[{"role": "user", "content": "总结制度重点"}],
    need_long_context=True,
)

estimated_tokens = llm_gateway.count_tokens(request)
for chunk in llm_gateway.stream_chat(request):
    handle_chunk(chunk)
```

每次Provider尝试都会记录Provider、模型、任务、耗时、成功状态和Token用量，不记录提示词和回答正文。默认记录到应用日志，后续可注入数据库、Redis或消息队列记录器。

## 文档接口调用顺序

1. `POST /api/v1/auth/register`注册用户。
2. `POST /api/v1/auth/login`获取JWT。
3. `POST /api/v1/rag/knowledge-bases`创建知识库。
4. `POST /api/v1/rag/knowledge-bases/{id}/documents`上传PDF、DOCX或TXT。
5. `GET /api/v1/rag/knowledge-bases/{id}/documents`查看文档记录。
6. `GET /api/v1/rag/documents/{id}/content`查看解析文本。

## 智能聊天接口

请求`POST /api/v1/chat`，并在请求头携带`Authorization: Bearer <JWT>`。

普通对话请求：

```json
{
  "message": "请帮我整理今天的工作计划",
  "mode": "llm"
}
```

知识库问答请求：

```json
{
  "message": "员工差旅住宿标准是多少？",
  "conversation_id": 1,
  "knowledge_base_id": 1,
  "mode": "rag"
}
```

联网搜索请求：

```json
{
  "message": "北京今天的天气怎么样？",
  "mode": "web_search"
}
```

`conversation_id`可省略，省略时创建新会话。为兼容旧客户端，未传`mode`时，有`knowledge_base_id`自动使用RAG，否则使用普通LLM。

## 测试

执行：`python -m pytest -q`
