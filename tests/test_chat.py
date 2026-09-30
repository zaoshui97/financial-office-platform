"""企业智能聊天、历史记录和知识库引用测试。"""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.llm_gateway import LLMServiceError
from app.ai.model_router import AITask
from app.ai.schemas import AIResponse, TokenUsage
from app.core.config import settings
from app.features.chat import rag_retriever
from app.features.chat import service as chat_service
from app.features.chat.models import ChatConversation, ChatMessage
from app.features.chat.rag_retriever import RetrievedContext


def _authorize(client: TestClient, username: str) -> dict[str, str]:
    """注册并登录指定测试用户。"""
    client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "email": f"{username}@example.com",
            "password": "DemoPass123!",
        },
    )
    response = client.post(
        "/api/v1/auth/login",
        data={"username": username, "password": "DemoPass123!"},
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _mock_llm(
    monkeypatch,
    callback: Callable[[list[dict[str, str]], list[str] | None], str],
) -> None:
    """替换远程模型调用，使测试无需真实API密钥。"""

    def complete(
        history: list[dict[str, str]],
        contexts: list[str] | None = None,
        task: AITask | None = None,
    ) -> str:
        return callback(history, contexts)

    monkeypatch.setattr(chat_service.llm_gateway, "complete", complete)


def _create_knowledge_base(client: TestClient, headers: dict[str, str]) -> int:
    """创建知识库并返回ID。"""
    response = client.post(
        "/api/v1/rag/knowledge-bases",
        headers=headers,
        json={"name": "聊天测试知识库", "description": "用于RAG聊天测试"},
    )
    assert response.status_code == 201
    return response.json()["id"]


def _upload_text_document(
    client: TestClient,
    headers: dict[str, str],
    knowledge_base_id: int,
    content: str,
) -> None:
    """通过现有RAG接口上传UTF-8文本材料。"""
    response = client.post(
        f"/api/v1/rag/knowledge-bases/{knowledge_base_id}/documents",
        headers=headers,
        files={"file": ("travel-policy.txt", content.encode("utf-8"), "text/plain")},
    )
    assert response.status_code == 201


def test_plain_chat_saves_history(
    client: TestClient,
    db_session: Session,
    monkeypatch,
) -> None:
    """普通LLM回答应返回会话ID并保存一轮聊天记录。"""
    headers = _authorize(client, "chat_plain_user")
    _mock_llm(monkeypatch, lambda history, contexts: "您好，我可以协助处理办公任务。")

    response = client.post(
        "/api/v1/chat",
        headers=headers,
        json={"message": "你好，请介绍你的能力"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "llm"
    assert body["answer"] == "您好，我可以协助处理办公任务。"
    assert body["citations"] == []
    assert body["retrieved_contexts"] == []
    assert body["used_citations"] == []

    conversation = db_session.get(ChatConversation, body["conversation_id"])
    messages = list(
        db_session.scalars(
            select(ChatMessage)
            .where(ChatMessage.conversation_id == body["conversation_id"])
            .order_by(ChatMessage.id)
        ).all()
    )
    assert conversation is not None
    assert conversation.title == "你好，请介绍你的能力"
    assert [(message.role, message.content) for message in messages] == [
        ("user", "你好，请介绍你的能力"),
        ("assistant", "您好，我可以协助处理办公任务。"),
    ]


def test_continue_conversation_passes_recent_history(
    client: TestClient,
    monkeypatch,
) -> None:
    """继续会话时应把此前用户和助手消息传给大模型。"""
    headers = _authorize(client, "chat_history_user")
    received_histories: list[list[dict[str, str]]] = []

    def answer(history: list[dict[str, str]], contexts: list[str] | None) -> str:
        received_histories.append(history)
        return "第一轮回答" if len(received_histories) == 1 else "第二轮回答"

    _mock_llm(monkeypatch, answer)
    first = client.post(
        "/api/v1/chat",
        headers=headers,
        json={"message": "第一轮问题"},
    )
    second = client.post(
        "/api/v1/chat",
        headers=headers,
        json={
            "message": "第二轮问题",
            "conversation_id": first.json()["conversation_id"],
        },
    )

    assert second.status_code == 200
    assert second.json()["conversation_id"] == first.json()["conversation_id"]
    assert received_histories[1] == [
        {"role": "user", "content": "第一轮问题"},
        {"role": "assistant", "content": "第一轮回答"},
        {"role": "user", "content": "第二轮问题"},
    ]


def test_rag_chat_returns_document_citations(
    client: TestClient,
    monkeypatch,
    tmp_path,
) -> None:
    """指定知识库时应检索材料，并返回回答引用来源。"""
    monkeypatch.setattr(settings, "RAG_VECTOR_SEARCH_ENABLED", False)
    headers = _authorize(client, "chat_rag_user")
    knowledge_base_id = _create_knowledge_base(client, headers)
    monkeypatch.setattr(settings, "STORAGE_DIR", tmp_path)
    _upload_text_document(
        client,
        headers,
        knowledge_base_id,
        "差旅管理制度：员工住宿标准为每晚500元，超出部分由个人承担。",
    )
    received_contexts: list[list[str] | None] = []

    def answer(history: list[dict[str, str]], contexts: list[str] | None) -> str:
        received_contexts.append(contexts)
        return "员工住宿标准为每晚500元。[1]"

    _mock_llm(monkeypatch, answer)
    response = client.post(
        "/api/v1/chat",
        headers=headers,
        json={
            "message": "差旅住宿标准是多少？",
            "knowledge_base_id": knowledge_base_id,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "rag"
    assert body["answer"] == "员工住宿标准为每晚500元。[1]"
    assert body["citations"][0]["filename"] == "travel-policy.txt"
    assert "每晚500元" in body["citations"][0]["content"]
    assert body["retrieved_contexts"] == body["citations"]
    assert body["used_citations"] == [body["citations"][0]]
    assert received_contexts[0] is not None
    assert received_contexts[0][0].startswith("[1] 文档：travel-policy.txt")


def test_rag_http_citations_only_include_final_contexts(client: TestClient, monkeypatch) -> None:
    headers = _authorize(client, "chat_selected_citations_user")
    selected_contexts = [
        RetrievedContext(
            document_id=index,
            filename=f"selected-{index}.pdf",
            content=f"selected content {index}",
            score=1.0 - index / 10,
            chunk_id=100 + index,
            page_number=index,
            page_numbers=[index],
            retrieval_method="vector",
        )
        for index in range(1, 7)
    ]
    monkeypatch.setattr(
        chat_service,
        "retrieve_knowledge_context",
        lambda **kwargs: selected_contexts,
    )
    received_contexts: list[list[str] | None] = []

    def answer(history: list[dict[str, str]], contexts: list[str] | None) -> str:
        received_contexts.append(contexts)
        return "已根据最终上下文回答。[1]"

    _mock_llm(monkeypatch, answer)

    response = client.post(
        "/api/v1/chat",
        headers=headers,
        json={"message": "请回答", "knowledge_base_id": 1, "mode": "rag", "task": "rag"},
    )

    assert response.status_code == 200
    assert received_contexts[0] is not None
    assert len(received_contexts[0]) == 6
    body = response.json()
    assert [citation["chunk_id"] for citation in body["citations"]] == [
        context.chunk_id for context in selected_contexts
    ]
    assert body["retrieved_contexts"] == body["citations"]
    assert [citation["chunk_id"] for citation in body["used_citations"]] == [101]


def test_rag_answer_without_reference_keeps_contexts_but_has_no_used_citations(
    client: TestClient,
    monkeypatch,
) -> None:
    headers = _authorize(client, "chat_unreferenced_context_user")
    selected_context = RetrievedContext(
        document_id=1,
        filename="policy.pdf",
        content="可信政策片段",
        score=0.9,
        chunk_id=101,
        page_number=1,
        page_numbers=[1],
        retrieval_method="vector",
    )
    monkeypatch.setattr(
        chat_service,
        "retrieve_knowledge_context",
        lambda **kwargs: [selected_context],
    )
    _mock_llm(monkeypatch, lambda history, contexts: "回答没有引用编号。")

    response = client.post(
        "/api/v1/chat",
        headers=headers,
        json={"message": "请回答", "knowledge_base_id": 1, "mode": "rag"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["citations"] == body["retrieved_contexts"]
    assert [citation["chunk_id"] for citation in body["retrieved_contexts"]] == [101]
    assert body["used_citations"] == []


@pytest.mark.parametrize(
    ("provider", "model"),
    [("qwen", "qwen-test"), ("deepseek", "deepseek-test")],
)
def test_rag_used_citations_follow_answer_order_for_all_models(
    client: TestClient,
    db_session: Session,
    monkeypatch,
    provider: str,
    model: str,
) -> None:
    headers = _authorize(client, f"chat_citation_binding_{provider}")
    selected_contexts = [
        RetrievedContext(
            document_id=index,
            filename=f"document-{index}.pdf",
            content=f"可信片段{index}",
            score=1.0 - index / 10,
            chunk_id=100 + index,
            page_number=index,
            page_numbers=[index],
            retrieval_method="vector",
        )
        for index in range(1, 4)
    ]
    retrieval_calls = 0
    model_calls = 0
    received_contexts: list[list[str] | None] = []

    def retrieve(**kwargs):
        nonlocal retrieval_calls
        retrieval_calls += 1
        return selected_contexts

    def complete_with_metadata(
        history: list[dict[str, str]],
        contexts: list[str] | None = None,
        task: AITask | None = None,
    ) -> AIResponse:
        nonlocal model_calls
        model_calls += 1
        received_contexts.append(contexts)
        return AIResponse(
            text="先依据第二条。[2] 再依据第一条。[1] 重复第二条。[2]",
            provider=provider,
            model=model,
            task="rag",
        )

    monkeypatch.setattr(chat_service, "retrieve_knowledge_context", retrieve)
    monkeypatch.setattr(
        chat_service.llm_gateway,
        "complete_with_metadata",
        complete_with_metadata,
    )

    response = client.post(
        "/api/v1/chat",
        headers=headers,
        json={"message": "请回答", "knowledge_base_id": 1, "mode": "rag"},
    )

    assert response.status_code == 200
    body = response.json()
    assert retrieval_calls == 1
    assert model_calls == 1
    assert received_contexts == [
        [
            f"[{index}] 文档：{context.filename}\n{context.content}"
            for index, context in enumerate(selected_contexts, start=1)
        ]
    ]
    assert body["provider"] == provider
    assert body["model"] == model
    assert body["retrieved_contexts"] == body["citations"]
    assert [citation["chunk_id"] for citation in body["used_citations"]] == [102, 101]
    assert set(body["used_citations"][0]).isdisjoint(
        {"vector", "embedding", "api_key", "token", "point_id", "generation"}
    )

    assistant_message = db_session.get(ChatMessage, body["assistant_message_id"])
    assert assistant_message is not None
    assert [citation["chunk_id"] for citation in assistant_message.citations or []] == [
        101,
        102,
        103,
    ]


def test_rag_chat_without_match_does_not_call_llm(
    client: TestClient,
    monkeypatch,
    tmp_path,
) -> None:
    """知识库无相关依据时应直接返回材料不足提示。"""
    headers = _authorize(client, "chat_no_match_user")
    knowledge_base_id = _create_knowledge_base(client, headers)
    monkeypatch.setattr(settings, "STORAGE_DIR", tmp_path)
    _upload_text_document(client, headers, knowledge_base_id, "差旅制度仅适用于境内出差。")

    def fail_if_called(
        history: list[dict[str, str]], contexts: list[str] | None
    ) -> str:
        raise AssertionError("无检索结果时不应调用大模型")

    _mock_llm(monkeypatch, fail_if_called)
    response = client.post(
        "/api/v1/chat",
        headers=headers,
        json={
            "message": "量子芯片研发预算是多少？",
            "knowledge_base_id": knowledge_base_id,
        },
    )

    assert response.status_code == 200
    assert response.json()["answer"] == "当前知识库中没有找到足够依据。"
    assert response.json()["citations"] == []
    assert response.json()["retrieved_contexts"] == []
    assert response.json()["used_citations"] == []


def test_vector_rag_empty_result_refuses_without_keyword_fallback_or_llm(
    client: TestClient,
    monkeypatch,
    tmp_path,
) -> None:
    monkeypatch.setattr(settings, "RAG_VECTOR_SEARCH_ENABLED", True)
    monkeypatch.setattr(settings, "RAG_VECTOR_FALLBACK_TO_KEYWORD", False)
    headers = _authorize(client, "chat_vector_threshold_empty_user")
    knowledge_base_id = _create_knowledge_base(client, headers)
    monkeypatch.setattr(settings, "STORAGE_DIR", tmp_path)
    _upload_text_document(
        client,
        headers,
        knowledge_base_id,
        "量子芯片预算为测试关键词匹配内容。",
    )
    vector_calls = 0

    def empty_vector_result(**kwargs):
        nonlocal vector_calls
        vector_calls += 1
        return []

    monkeypatch.setattr(rag_retriever, "retrieve_vector_chunks", empty_vector_result)

    def fail_if_called(*args, **kwargs):
        raise AssertionError("全部向量候选被过滤后不应调用聊天模型")

    monkeypatch.setattr(chat_service.llm_gateway, "complete_with_metadata", fail_if_called)

    response = client.post(
        "/api/v1/chat",
        headers=headers,
        json={
            "message": "量子芯片预算是多少？",
            "knowledge_base_id": knowledge_base_id,
            "mode": "rag",
            "task": "rag",
        },
    )

    assert response.status_code == 200
    assert response.json()["answer"] == "当前知识库中没有找到足够依据。"
    assert response.json()["citations"] == []
    assert response.json()["retrieved_contexts"] == []
    assert response.json()["used_citations"] == []
    assert response.json()["retrieval_method"] == "vector"
    assert response.json()["provider"] is None
    assert response.json()["model"] is None
    assert vector_calls == 1


def test_web_search_chat_uses_web_search_task(
    client: TestClient,
    monkeypatch,
) -> None:
    """联网模式应路由到WEB_SEARCH任务并保存对应模式。"""
    headers = _authorize(client, "chat_web_search_user")
    received_tasks: list[AITask | None] = []

    def complete(
        history: list[dict[str, str]],
        contexts: list[str] | None = None,
        task: AITask | None = None,
    ) -> str:
        received_tasks.append(task)
        return "北京今天的天气信息来自联网搜索。"

    monkeypatch.setattr(chat_service.llm_gateway, "complete", complete)
    response = client.post(
        "/api/v1/chat",
        headers=headers,
        json={"message": "北京天气怎么样？", "mode": "web_search"},
    )

    assert response.status_code == 200
    assert response.json()["mode"] == "web_search"
    assert response.json()["citations"] == []
    assert response.json()["retrieved_contexts"] == []
    assert response.json()["used_citations"] == []
    assert received_tasks == [AITask.WEB_SEARCH]


def test_chat_task_is_forwarded_to_gateway(client: TestClient, monkeypatch) -> None:
    """Chat任务应原样交给Gateway，不让业务层选择具体模型。"""
    headers = _authorize(client, "chat_task_user")
    received_tasks: list[AITask | None] = []

    def complete(
        history: list[dict[str, str]],
        contexts: list[str] | None = None,
        task: AITask | None = None,
    ) -> str:
        received_tasks.append(task)
        return "任务回答"

    monkeypatch.setattr(chat_service.llm_gateway, "complete", complete)
    response = client.post(
        "/api/v1/chat",
        headers=headers,
        json={"message": "分析利润变化", "task": "financial_analysis"},
    )

    assert response.status_code == 200
    assert response.json()["task"] == "financial_analysis"
    assert received_tasks == [AITask.FINANCIAL_ANALYSIS]


def test_rag_mode_maps_to_rag_task_and_returns_model_metadata(
    client: TestClient,
    monkeypatch,
    tmp_path,
) -> None:
    """mode=rag应自动映射任务，并返回Gateway提供的模型元数据。"""
    monkeypatch.setattr(settings, "RAG_VECTOR_SEARCH_ENABLED", False)
    headers = _authorize(client, "chat_rag_task_user")
    knowledge_base_id = _create_knowledge_base(client, headers)
    monkeypatch.setattr(settings, "STORAGE_DIR", tmp_path)
    _upload_text_document(client, headers, knowledge_base_id, "差旅住宿标准为每晚500元。")

    def complete_with_metadata(
        history: list[dict[str, str]],
        contexts: list[str] | None = None,
        task: AITask | None = None,
    ) -> AIResponse:
        assert task == AITask.RAG
        return AIResponse(
            text="住宿标准为每晚500元。",
            provider="qwen",
            model="qwen-test",
            task="rag",
            latency_ms=12.5,
            usage=TokenUsage(prompt_tokens=10, completion_tokens=4, total_tokens=14),
        )

    monkeypatch.setattr(
        chat_service.llm_gateway,
        "complete_with_metadata",
        complete_with_metadata,
    )
    response = client.post(
        "/api/v1/chat",
        headers=headers,
        json={
            "message": "住宿标准是多少？",
            "mode": "rag",
            "knowledge_base_id": knowledge_base_id,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["task"] == "rag"
    assert body["provider"] == "qwen"
    assert body["model"] == "qwen-test"
    assert body["latency_ms"] == 12.5


def test_chat_mode_parameter_combinations_are_validated(client: TestClient) -> None:
    """RAG必须携带知识库ID，其他显式模式不能携带知识库ID。"""
    headers = _authorize(client, "chat_mode_validation_user")

    missing_knowledge_base = client.post(
        "/api/v1/chat",
        headers=headers,
        json={"message": "查询制度", "mode": "rag"},
    )
    unexpected_knowledge_base = client.post(
        "/api/v1/chat",
        headers=headers,
        json={
            "message": "普通对话",
            "mode": "llm",
            "knowledge_base_id": 1,
        },
    )

    assert missing_knowledge_base.status_code == 422
    assert unexpected_knowledge_base.status_code == 422


def test_chat_resources_are_isolated_by_user(
    client: TestClient,
    monkeypatch,
) -> None:
    """用户不能继续他人会话，也不能查询他人知识库。"""
    owner_headers = _authorize(client, "chat_owner")
    other_headers = _authorize(client, "chat_other")
    _mock_llm(monkeypatch, lambda history, contexts: "测试回答")

    conversation_response = client.post(
        "/api/v1/chat",
        headers=owner_headers,
        json={"message": "创建私有会话"},
    )
    knowledge_base_id = _create_knowledge_base(client, owner_headers)

    conversation_access = client.post(
        "/api/v1/chat",
        headers=other_headers,
        json={
            "message": "访问他人会话",
            "conversation_id": conversation_response.json()["conversation_id"],
        },
    )
    knowledge_access = client.post(
        "/api/v1/chat",
        headers=other_headers,
        json={"message": "查询制度", "knowledge_base_id": knowledge_base_id},
    )

    assert conversation_access.status_code == 404
    assert knowledge_access.status_code == 404


def test_llm_failure_returns_service_unavailable(
    client: TestClient,
    db_session: Session,
    monkeypatch,
) -> None:
    """模型不可用时应返回503且不保存不完整会话。"""
    headers = _authorize(client, "chat_llm_error_user")

    def fail(history: list[dict[str, str]], contexts: list[str] | None) -> str:
        raise LLMServiceError("测试模型不可用")

    _mock_llm(monkeypatch, fail)
    response = client.post(
        "/api/v1/chat",
        headers=headers,
        json={"message": "触发模型错误"},
    )

    assert response.status_code == 503
    assert "测试模型不可用" in response.json()["detail"]
    assert db_session.scalar(select(ChatConversation.id)) is None
    assert db_session.scalar(select(ChatMessage.id)) is None
