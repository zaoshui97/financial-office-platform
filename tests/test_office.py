"""智能办公域测试：模板 + AI 生成内容。"""

from fastapi.testclient import TestClient


def test_create_template(client: TestClient) -> None:
    """创建文档模板。"""
    resp = client.post(
        "/api/v1/office/templates",
        json={
            "template_code": "TPL-TEST-001",
            "template_name": "测试周报模板",
            "template_type": "weekly",
            "content": "本周 {topic} 进展...",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["template_code"] == "TPL-TEST-001"
    assert body["content"] == "本周 {topic} 进展..."
    assert body["is_active"] is True


def test_duplicate_template_code_conflict(client: TestClient) -> None:
    """重复 template_code 应返回 409。"""
    payload = {
        "template_code": "TPL-DUP-001",
        "template_name": "重复测试模板",
        "content": "内容",
    }
    r1 = client.post("/api/v1/office/templates", json=payload)
    assert r1.status_code == 201
    r2 = client.post("/api/v1/office/templates", json=payload)
    assert r2.status_code == 409


def test_list_templates(client: TestClient) -> None:
    """分页查询模板。"""
    for i in range(3):
        client.post(
            "/api/v1/office/templates",
            json={
                "template_code": f"TPL-LIST-{i:03d}",
                "template_name": f"模板 {i}",
                "content": f"内容 {i}",
            },
        )

    resp = client.get("/api/v1/office/templates?page=1&page_size=20")
    assert resp.status_code == 200
    body = resp.json()
    assert "items" in body
    assert "total" in body
    assert body["total"] >= 3


def test_get_template_by_id(client: TestClient) -> None:
    """按 id 查询模板详情。"""
    created = client.post(
        "/api/v1/office/templates",
        json={"template_code": "TPL-GET-001", "template_name": "X", "content": "Y"},
    ).json()
    resp = client.get(f"/api/v1/office/templates/{created['id']}")
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]


def test_get_nonexistent_template_404(client: TestClient) -> None:
    """不存在的模板 id 返回 404。"""
    resp = client.get("/api/v1/office/templates/99999")
    assert resp.status_code == 404


def test_create_generated_content(client: TestClient) -> None:
    """记录 AI 生成内容。"""
    resp = client.post(
        "/api/v1/office/generated-contents",
        json={
            "user_id": 1,
            "content_type": "weekly",
            "title": "周报 10/05",
            "content": "本周完成...",
            "ai_model": "qwen-max",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == "周报 10/05"
    assert body["ai_model"] == "qwen-max"
    assert body["push_status"] == "unsent"


def test_list_generated_contents_by_user(client: TestClient) -> None:
    """按 user_id 过滤生成内容列表。"""
    # user_id=1 写入 2 条
    for i in range(2):
        client.post(
            "/api/v1/office/generated-contents",
            json={"user_id": 1, "content_type": "weekly", "title": f"内容 {i}"},
        )
    # user_id=2 写入 1 条
    client.post(
        "/api/v1/office/generated-contents",
        json={"user_id": 2, "content_type": "monthly", "title": "月报"},
    )

    resp = client.get("/api/v1/office/generated-contents?user_id=1")
    assert resp.status_code == 200
    body = resp.json()
    items = body if isinstance(body, list) else body.get("items", [])
    assert all(x["user_id"] == 1 for x in items)
    assert len(items) >= 2
