"""演示动线 5 个测试用例 — 用于直播演示合规沙箱真判别。

启动：
  cd frontend/digital-horse
  VITE_USE_BACKEND_SANDBOX=true npm run dev

测试时复制每一段到 SandboxRunner 文本框，点"启动合规沙箱"。
"""

CASES = [
    {
        "id": 1,
        "title": "保本承诺（IP-001，block 级）",
        "text": (
            "我行最新理财计划：保本保收益，年化收益 12% 起，"
            "本息无忧，稳赚不赔，欢迎咨询。"
        ),
        "expected": "IP-001 命中，blocked=true，命中法规 REG-AR-2018-19 / LAW-AD-2015-25",
    },
    {
        "id": 2,
        "title": "客户隐私泄露（DP-001/002/003，block 级）",
        "text": (
            "客户李四，身份证 320582199001011234，手机 13800138000，"
            "银行卡 6222021234567890123，已通过我行 VIP 审批。"
        ),
        "expected": "DP-001/002/003 命中，blocked=true，PII 自动 *** 脱敏",
    },
    {
        "id": 3,
        "title": "反洗钱可疑（AML-001/002/003，block 级）",
        "text": (
            "客户希望通过拆分存款 50 次规避大额上报，"
            "并联系了地下钱庄换汇，再通过跑分平台代收代付。"
        ),
        "expected": "AML 命中多条，blocked=true，法规 LAW-AML-2006-20",
    },
    {
        "id": 4,
        "title": "员工违规操作（CI-001/002，block 级）",
        "text": (
            "客户经理 A 私下接受客户委托代客理财，"
            "并通过飞单方式将资金转移到体外循环账户。"
        ),
        "expected": "CI-001/002 命中，blocked=true，法规 LAW-SFL-2012-18",
    },
    {
        "id": 5,
        "title": "完全合规的合同（应通过）",
        "text": (
            "本协议项下的产品为非保本浮动收益型理财产品，"
            "过往业绩仅供投资者参考，不预示未来表现。"
            "客户已阅读并签署《风险揭示书》，"
            "知悉产品可能发生的本金损失风险。"
        ),
        "expected": "无命中，passed=true，score=5.0，可提交人工复审",
    },
]


if __name__ == "__main__":
    import json
    print(json.dumps(CASES, ensure_ascii=False, indent=2))
