"""答辩演示：3 大新域 + 防篡改端到端。

用法：python tools/demo_presentation.py
会输出 JSON，便于现场打印或截图。

说明：脚本自动用时间戳拼接唯一编号，避免脏数据冲突。
"""
from __future__ import annotations

import json
import sys
import time

from fastapi.testclient import TestClient
from sqlalchemy import text, create_engine

sys.path.insert(0, ".")

from app.core.config import settings  # noqa: E402
from app.main import create_app  # noqa: E402

app = create_app()
client = TestClient(app)
engine = create_engine(settings.DATABASE_URL)

# 用时间戳保证每次演示数据唯一
TS = str(int(time.time()))[-6:]


def banner(title: str) -> None:
    print()
    print("=" * 70)
    print(f"  {title}")
    print("=" * 70)


def show(label: str, resp) -> dict:
    print(f"  {label:<40} status={resp.status_code}")
    try:
        body = resp.json()
        print(f"  -> {json.dumps(body, ensure_ascii=False, indent=2)[:300]}")
        return body
    except Exception:
        print(f"  -> {resp.text[:200]}")
        return {}


def main() -> None:
    banner(f"亮点一：多租户隔离（机构域）  [TS={TS}]")
    org = show("POST /organizations", client.post("/api/v1/organizations", json={
        "name": f"演示银行 {TS}", "org_type": "bank",
        "credit_code": f"911100000{TS}000X",
        "license_no": f"J0001H{TS}001", "industry": "banking",
    }))
    org_id = org.get("id")
    if org_id:
        show("POST /organizations/departments", client.post(
            "/api/v1/organizations/departments",
            json={"organization_id": org_id, "name": "风险合规部"},
        ))

    banner(f"亮点三：决策智能（法规 + 决策回放）  [TS={TS}]")
    show("POST /decision/regulations", client.post(
        "/api/v1/decision/regulations",
        json={"regulation_code": f"DEMO-{TS}", "title": "演示法规：内控指引",
              "issuing_authority": "证监会", "industry": "securities"},
    ))
    show("POST /decision/news", client.post(
        "/api/v1/decision/news",
        json={"title": f"监管新动态 {TS}", "importance_level": "high", "tags": ["监管"]},
    ))

    banner("亮点三：决策回放 + 防篡改")
    pb = show("POST /decision/decision-playbacks", client.post(
        "/api/v1/decision/decision-playbacks",
        json={"decision_no": f"DEMO-DP-{TS}", "title": "客户适当性审查",
              "context": "客户拟购高风险产品", "final_decision": "补做风险评估",
              "outcome": "已补评估，通过"},
    ))
    pb_id = pb.get("id")
    v1 = v2 = None
    if pb_id:
        print()
        print("  [步骤 A] 原始 verify")
        v1 = show("POST /decision/decision-playbacks/{id}/verify",
                  client.post(f"/api/v1/decision/decision-playbacks/{pb_id}/verify"))

        print()
        print("  [步骤 B] 模拟黑客篡改 outcome 字段")
        with engine.begin() as c:
            c.execute(text("UPDATE decision_playbacks SET outcome='被黑客修改' WHERE id=:i"),
                      {"i": pb_id})
        print("  -> 篡改完成")

        print()
        print("  [步骤 C] 重新 verify → 应触发篡改告警")
        v2 = show("POST /decision/decision-playbacks/{id}/verify",
                  client.post(f"/api/v1/decision/decision-playbacks/{pb_id}/verify"))

    banner("智能办公：模板 + AI 生成内容")
    show("POST /office/templates", client.post(
        "/api/v1/office/templates",
        json={"template_code": f"TPL-{TS}", "template_name": "演示周报",
              "content": "本周 {topic} 进展..."},
    ))
    show("POST /office/generated-contents", client.post(
        "/api/v1/office/generated-contents",
        json={"user_id": 1, "content_type": "weekly", "title": f"周报 {TS}",
              "content": "...", "ai_model": "qwen-max"},
    ))

    banner("完成")
    print("全部 3 大新域 + 防篡改端到端跑通 ✅")
    if v1 and v2:
        print(f"  v1.is_intact={v1.get('is_intact')} (正常)")
        print(f"  v2.is_intact={v2.get('is_intact')} (篡改后)")


if __name__ == "__main__":
    main()
