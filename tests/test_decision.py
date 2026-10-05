"""决策智能域测试：法规 + 资讯 + 业务影响 + 决策回放（防篡改亮点三）。"""

from sqlalchemy import text

from fastapi.testclient import TestClient


# ────────── Regulation ──────────


def test_create_regulation(client: TestClient) -> None:
    """录入法规。"""
    resp = client.post(
        "/api/v1/decision/regulations",
        json={
            "regulation_code": "TEST-CSRC-001",
            "title": "测试内控指引",
            "issuing_authority": "证监会",
            "industry": "securities",
            "category": "compliance",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["regulation_code"] == "TEST-CSRC-001"
    assert body["status"] == "active"


def test_duplicate_regulation_code_conflict(client: TestClient) -> None:
    """重复 regulation_code 应 409。"""
    payload = {
        "regulation_code": "DUP-CSRC-001",
        "title": "测试",
    }
    r1 = client.post("/api/v1/decision/regulations", json=payload)
    assert r1.status_code == 201
    r2 = client.post("/api/v1/decision/regulations", json=payload)
    assert r2.status_code == 409


def test_list_regulations_pagination(client: TestClient) -> None:
    """分页查询法规。"""
    for i in range(3):
        client.post(
            "/api/v1/decision/regulations",
            json={
                "regulation_code": f"LIST-{i:03d}",
                "title": f"法规 {i}",
            },
        )

    resp = client.get("/api/v1/decision/regulations?page=1&page_size=20")
    assert resp.status_code == 200
    body = resp.json()
    assert "items" in body
    assert body["total"] >= 3


# ────────── IndustryNews ──────────


def test_create_news(client: TestClient) -> None:
    """录入行业资讯。"""
    resp = client.post(
        "/api/v1/decision/news",
        json={
            "title": "测试新规",
            "importance_level": "high",
            "industry": "securities",
            "tags": ["监管", "新规"],
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["importance_level"] == "high"
    assert "监管" in body["tags"]


def test_filter_news_by_importance(client: TestClient) -> None:
    """按重要度过滤。"""
    client.post(
        "/api/v1/decision/news",
        json={"title": "高优先级", "importance_level": "high"},
    )
    client.post(
        "/api/v1/decision/news",
        json={"title": "低优先级", "importance_level": "low"},
    )

    resp = client.get("/api/v1/decision/news?importance=high")
    assert resp.status_code == 200
    body = resp.json()
    items = body.get("items", body)  # 兼容裸 list 和 {items:[]} 两种结构
    assert all(n["importance_level"] == "high" for n in items)
    assert any(n["title"] == "高优先级" for n in items)


# ────────── BusinessImpact ──────────


def test_create_business_impact(client: TestClient) -> None:
    """录入业务影响评估。"""
    resp = client.post(
        "/api/v1/decision/business-impact",
        json={
            "event_type": "regulation",
            "event_id": 1,
            "event_title": "新法规出台",
            "impact_level": "high",
            "affected_departments": ["风控部", "法务部"],
            "confidence": 0.92,
            "ai_model": "qwen-max",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["impact_level"] == "high"
    assert body["confidence"] == 0.92


def test_list_business_impacts(client: TestClient) -> None:
    """查询业务影响列表。"""
    for i in range(2):
        client.post(
            "/api/v1/decision/business-impact",
            json={
                "event_type": "news",
                "event_title": f"事件 {i}",
                "impact_level": "medium",
            },
        )

    resp = client.get("/api/v1/decision/business-impact?limit=50")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert len(resp.json()) >= 2


# ────────── DecisionPlayback + 防篡改（亮点三） ──────────


def test_create_decision_playback_with_hash(client: TestClient) -> None:
    """创建决策回放应自动生成 decision_hash。"""
    resp = client.post(
        "/api/v1/decision/decision-playbacks",
        json={
            "decision_no": "DP-TEST-001",
            "decision_type": "compliance_review",
            "title": "客户适当性审查",
            "context": "客户拟购高风险产品",
            "final_decision": "补做风险评估",
            "outcome": "已补评估，通过",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["decision_hash"] is not None
    assert len(body["decision_hash"]) == 64  # SHA-256
    assert body["is_tampered"] is False


def test_decision_playback_verify_intact(client: TestClient) -> None:
    """未篡改的决策回放应通过 verify 校验。"""
    created = client.post(
        "/api/v1/decision/decision-playbacks",
        json={
            "decision_no": "DP-VERIFY-INTACT",
            "title": "完整性测试",
            "final_decision": "通过",
            "outcome": "成功",
        },
    ).json()
    pid = created["id"]

    resp = client.post(f"/api/v1/decision/decision-playbacks/{pid}/verify")
    assert resp.status_code == 200
    body = resp.json()
    assert body["is_intact"] is True
    assert "完整" in body["message"]


def test_decision_playback_detect_tampering(db_session, client: TestClient) -> None:
    """篡改 outcome 字段后 verify 应识别为 is_intact=False。

    这是亮点三「防篡改链式哈希」的核心演示：
      1. 正常创建决策回放 → 自动计算 decision_hash 落库
      2. 模拟黑客 SQL UPDATE 篡改 outcome
      3. 重新 verify → 服务端重算 SHA-256 → 哈希不一致 → is_tampered 自动置位
    """
    # 1) 正常创建
    created = client.post(
        "/api/v1/decision/decision-playbacks",
        json={
            "decision_no": "DP-TAMPER-DEMO",
            "title": "篡改测试",
            "context": "原始上下文",
            "final_decision": "原始决策",
            "outcome": "原始结果",
        },
    ).json()
    pid = created["id"]
    original_hash = created["decision_hash"]

    # 第一次 verify 应通过
    r1 = client.post(f"/api/v1/decision/decision-playbacks/{pid}/verify")
    assert r1.json()["is_intact"] is True

    # 2) 模拟黑客 SQL UPDATE 篡改 outcome
    db_session.execute(
        text("UPDATE decision_playbacks SET outcome=:v WHERE id=:i"),
        {"v": "被黑客修改", "i": pid},
    )
    db_session.commit()

    # 3) 重新 verify
    r2 = client.post(f"/api/v1/decision/decision-playbacks/{pid}/verify")
    body = r2.json()
    assert body["is_intact"] is False
    assert "篡改" in body["message"]

    # 4) 验证 is_tampered 字段已自动置位
    db_session.expire_all()
    row = db_session.execute(
        text("SELECT is_tampered, outcome, decision_hash FROM decision_playbacks WHERE id=:i"),
        {"i": pid},
    ).first()
    assert row[0] in (True, 1)  # is_tampered 已被置位
    assert row[1] == "被黑客修改"  # 确认篡改已落库
    assert row[2] == original_hash  # 原始哈希保留（作为审计证据）


def test_decision_playback_verify_404(client: TestClient) -> None:
    """不存在的 id 应返回 404。"""
    resp = client.post("/api/v1/decision/decision-playbacks/99999/verify")
    assert resp.status_code == 404


def test_list_decision_playbacks(client: TestClient) -> None:
    """查询决策回放列表。"""
    for i in range(2):
        client.post(
            "/api/v1/decision/decision-playbacks",
            json={
                "decision_no": f"DP-LIST-{i:03d}",
                "title": f"决策 {i}",
                "final_decision": "通过",
            },
        )

    resp = client.get("/api/v1/decision/decision-playbacks?limit=50")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) >= 2
    # 至少有一条带 decision_hash 字段
    assert all("decision_hash" in x for x in items)
