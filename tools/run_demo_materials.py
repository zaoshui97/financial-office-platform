"""把演示材料喂给真后端审查，生成对照报告。

需要：
  - 后端运行在 http://127.0.0.1:8030
  - admin 用户可用（密码默认 admin123，可改）

运行：python tools/run_demo_materials.py
"""
import json

import requests

from compliance_sandbox_demo_materials import MATERIALS

BASE = "http://127.0.0.1:8030/api/v1"


def login():
    r = requests.post(
        f"{BASE}/auth/login",
        json={"username": "admin", "password": "admin123"},
        timeout=5,
    )
    r.raise_for_status()
    return r.json()["data"]["access_token"]


def main():
    try:
        token = login()
    except Exception as e:
        print(f"[!] 登录失败：{e}")
        print("    请确认后端已启动：admin / admin123")
        return
    headers = {"Authorization": f"Bearer {token}"}

    print("=" * 80)
    print("合规沙箱演示材料 — 真实后端审查对照报告")
    print("=" * 80)

    total_cases = 0
    passed_expected = 0
    blocked_as_expected = 0

    for category, items in MATERIALS.items():
        print(f"\n>>> {category}")
        print("-" * 80)
        for idx, item in enumerate(items, 1):
            total_cases += 1
            r = requests.post(
                f"{BASE}/compliance/sandbox/check",
                json={"text": item["text"], "source": "demo_run"},
                headers=headers,
                timeout=10,
            )
            if r.status_code != 200:
                print(f"[{idx}. {item['name']}] HTTP {r.status_code}: {r.text[:200]}")
                continue
            data = r.json()["data"]
            n_issues = len(data["issues"])
            score = data["score"]
            passed = data["passed"]
            blocked = data["blocked"]
            # 提取命中的规则 ID
            rule_ids = ",".join(i["rule_id"] for i in data["issues"][:5])
            regs = ",".join(
                sorted(set(reg for i in data["issues"] for reg in i["regulation_ids"]))
            )[:60]
            pii = ",".join(f"{k}×{v}" for k, v in (data.get("sanitized_fields") or {}).items())

            # 判断预期
            is_compliant_case = "passed=true" in item["expected"]
            if is_compliant_case:
                ok = passed and not blocked and n_issues == 0
                if ok:
                    passed_expected += 1
                marker = "✅ 合规放行" if ok else "❌ 不应命中但命中了"
            else:
                ok = blocked and n_issues > 0
                if ok:
                    blocked_as_expected += 1
                marker = "✅ 阻断" if ok else "❌ 未阻断"

            print(f"\n[{idx}. {item['name']}]  {marker}")
            print(f"  评分: {score}  通过={passed}  阻断={blocked}  命中={n_issues}  规则={rule_ids}")
            if regs:
                print(f"  法规: {regs}")
            if pii:
                print(f"  PII 脱敏: {pii}")
            print(f"  预期: {item['expected'][:80]}")

    print("\n" + "=" * 80)
    print(f"汇总：{total_cases} 个用例")
    print(f"  - 阻断符合预期: {blocked_as_expected}")
    print(f"  - 合规放行符合预期: {passed_expected}")
    print("=" * 80)


if __name__ == "__main__":
    main()
