"""快速验证合规沙箱真后端连通性。

需要：
  1. 后端 .env 已配数据库
  2. python -m uvicorn app.main:app --port 8030 --reload

运行：python tools/test_sandbox_check.py
"""
import json
import sys

import requests

BASE = "http://127.0.0.1:8030/api/v1"

# 测试用 5 个用例
CASES = [
    ("保本承诺（block）", "我行理财保本保收益，年化 12%，稳赚不赔。"),
    ("客户隐私（block）", "客户 13800138000 身份证 320582199001011234 申请贷款。"),
    ("反洗钱（block）", "客户通过地下钱庄换汇，拆分存款规避大额申报。"),
    ("员工违规（block）", "客户经理代客理财，通过飞单转到体外循环账户。"),
    ("合规文本（通过）", "本产品为非保本浮动收益型，过往业绩不预示未来表现。"),
]


def login():
    """获取 JWT。"""
    r = requests.post(
        f"{BASE}/auth/login",
        json={"username": "admin", "password": "admin123"},
        timeout=5,
    )
    r.raise_for_status()
    return r.json()["data"]["access_token"]


def main():
    print(">>> 登录获取 token...")
    try:
        token = login()
    except Exception as e:
        print(f"登录失败: {e}")
        print("请确认：1) 后端已启动 2) 有 admin 用户")
        sys.exit(1)
    print(f"OK token 长度: {len(token)}")

    headers = {"Authorization": f"Bearer {token}"}
    for title, text in CASES:
        print(f"\n>>> 用例：{title}")
        r = requests.post(
            f"{BASE}/compliance/sandbox/check",
            json={"text": text, "source": "demo_cli"},
            headers=headers,
            timeout=10,
        )
        if r.status_code != 200:
            print(f"  HTTP {r.status_code}: {r.text[:200]}")
            continue
        data = r.json()["data"]
        print(f"  score={data['score']}  passed={data['passed']}  blocked={data['blocked']}  issues={len(data['issues'])}  audit_id={data.get('audit_id')}")
        for iss in data["issues"][:3]:
            print(f"    - [{iss['severity']}] {iss['rule_name']} (cat={iss['category']}, regs={iss['regulation_ids']})")
        if data.get("sanitized_fields"):
            print(f"  PII 脱敏: {data['sanitized_fields']}")


if __name__ == "__main__":
    main()
