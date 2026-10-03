"""合规沙箱风险词分类词库。

按金融行业违规类别分组，用于 L1 硬匹配 + LLM Judge prompt 引用。
- 词条尽量覆盖：动词、同义词、行业黑话。
- 词条必须小写以兼容大小写不敏感匹配。
- 风险类别与前端 risk_category 字段保持一致（snake_case）。
"""

from __future__ import annotations

# 反洗钱 / 恐怖融资
MONEY_LAUNDERING: list[str] = [
    "洗钱", "洗钱罪", "反洗钱", "恐怖融资", "恐怖主义融资",
    "资金拆分", "拆分存款", "空壳公司", "壳公司", "过桥账户",
    "地下钱庄", "换汇", "跑分", "跑分平台", "代收代付",
    "虚拟货币洗钱", "usdt 洗钱", "otc 洗钱", "代币洗钱",
    "可疑交易", "大额可疑", "拆分申报", "规避申报", "规避上报",
    "反洗钱规避", "客户身份不识别", "不识别客户",
]

# 内幕交易 / 市场操纵
INSIDER_TRADING: list[str] = [
    "内幕交易", "内幕信息", "内幕消息", "老鼠仓", "老鼠单",
    "市场操纵", "操纵股价", "操纵市场", "拉高出货", "打压吸筹",
    "对倒", "对敲", "虚假申报", "抢帽子", "抢帽子交易",
    "蛊惑交易", "幌骗", "spoofing", "layering",
    "非法定增", "老鼠仓基金",
]

# 税务违规
TAX_EVASION: list[str] = [
    "偷税", "漏税", "逃税", "避税", "合理避税", "激进避税",
    "阴阳合同", "阴阳发票", "虚开发票", "虚开", "代开发票",
    "走账", "走私账", "小金库", "账外账", "两套账",
    "套票", "买票", "倒卖发票", "虚增成本", "虚减收入",
    "关联交易定价", "转移定价", "低开高开",
]

# 商业贿赂 / 利益输送
BRIBERY: list[str] = [
    "商业贿赂", "贿赂", "行贿", "受贿", "索贿",
    "回扣", "返点", "好处费", "茶水费", "打点费",
    "现金回扣", "实物回扣", "旅游回扣",
    "利益输送", "关联交易", "输送利益",
    "贪污", "挪用", "挪用公款", "职务侵占",
    "围标", "串标", "陪标",
]

# 客户隐私 / 数据安全
PRIVACY_LEAK: list[str] = [
    "客户信息", "客户数据", "客户名单", "客户资料",
    "出售客户", "贩卖客户", "倒卖客户", "客户信息倒卖",
    "客户隐私", "客户信息泄露", "客户数据泄露",
    "员工信息", "员工名单", "员工信息泄露",
    "征信报告", "信用报告", "人行征信",
    "内部数据", "数据贩卖", "数据倒卖",
    "拖库", "撞库", "脱库",
]

# 违规承诺 / 误导销售
ILLEGAL_COMMITMENT: list[str] = [
    "保本保收益", "保本", "保收益", "保息", "刚性兑付",
    "零风险", "无风险", "100% 收益", "稳赚不赔",
    "承诺收益", "约定收益", "保证收益", "最低收益",
    "年化保本", "无损失", "无回撤",
    "兜底", "担保收益", "差额补足", "结构化保本",
    "虚假宣传", "夸大宣传", "误导销售", "误导性陈述",
]

# 利益冲突 / 道德风险
CONFLICT_OF_INTEREST: list[str] = [
    "利益冲突", "冲突业务", "内幕信息知情人",
    "代客理财", "代客操作", "代客交易", "代客持有",
    "借用客户账户", "借账户", "借账号",
    "员工炒股", "员工代客", "员工跟单",
    "飞单", "私单", "体外循环",
    "兼职", "违规兼职", "同业兼职",
]

# 非法金融活动
ILLEGAL_FINANCE: list[str] = [
    "套路贷", "砍头息", "714 高炮", "校园贷", "裸贷",
    "高利贷", "民间高利贷", "套路贷", "超利贷",
    "影子银行", "影子信贷", "通道业务", "抽屉协议",
    "非法集资", "非法吸储", "非法吸收公众存款",
    "庞氏骗局", "庞氏", "传销", "非法传销",
    "虚拟盘", "对赌盘", "配资", "场外配资",
    "ico", "ifo", "虚拟货币发行",
]

# 监管规避
REGULATORY_EVASION: list[str] = [
    "规避监管", "规避检查", "规避审计", "规避审查",
    "绕开监管", "逃避监管", "逃避检查",
    "监管套利", "监管规避", "套利空间",
    "跨境赌博", "网络赌博", "赌博", "洗钱通道",
    "跑路", "暴雷", "兑付危机", "暴雷后",
]

# 整理为统一词库（带分类）
RISK_KEYWORDS_BY_CATEGORY: dict[str, list[str]] = {
    "money_laundering": MONEY_LAUNDERING,
    "insider_trading": INSIDER_TRADING,
    "tax_evasion": TAX_EVASION,
    "bribery": BRIBERY,
    "privacy_leak": PRIVACY_LEAK,
    "illegal_commitment": ILLEGAL_COMMITMENT,
    "conflict_of_interest": CONFLICT_OF_INTEREST,
    "illegal_finance": ILLEGAL_FINANCE,
    "regulatory_evasion": REGULATORY_EVASION,
}

# 兼容旧 settings.SANDBOX_RISK_KEYWORDS（str 逗号分隔） → 自动转 list
def get_all_risk_keywords() -> list[str]:
    """返回所有风险词展平列表。"""
    out: list[str] = []
    for words in RISK_KEYWORDS_BY_CATEGORY.values():
        out.extend(words)
    # 去重 + 保持顺序
    return list(dict.fromkeys(out))


# 旧 settings 解析：兼容 str（逗号分隔）/ list 两种输入
def parse_legacy_keywords(raw: Any) -> list[str]:
    """解析环境变量 SANDBOX_RISK_KEYWORDS：str 逗号分隔 / list 直接返回。"""
    if not raw:
        return []
    if isinstance(raw, (list, tuple, set)):
        return [str(kw).strip() for kw in raw if str(kw).strip()]
    if isinstance(raw, str):
        return [kw.strip() for kw in raw.split(",") if kw.strip()]
    return [str(raw).strip()]


# 给 LLM Judge prompt 用的类别描述（中文 + 英文）
CATEGORY_DESCRIPTIONS: dict[str, str] = {
    "money_laundering": "洗钱/恐怖融资：拆分资金、空壳公司、地下钱庄、虚拟货币洗钱、可疑交易规避",
    "insider_trading": "内幕交易/市场操纵：内幕信息、老鼠仓、对倒对敲、拉高出货、虚假申报",
    "tax_evasion": "税务违规：阴阳合同、虚开发票、两套账、转移定价、激进避税",
    "bribery": "商业贿赂/利益输送：回扣、商业贿赂、利益输送、围标串标、职务侵占",
    "privacy_leak": "客户隐私/数据泄露：贩卖客户信息、员工信息泄露、征信查询、数据倒卖",
    "illegal_commitment": "违规承诺/误导销售：保本保收益、刚性兑付、零风险承诺、虚假宣传",
    "conflict_of_interest": "利益冲突/道德风险：代客理财、飞单、私单、违规兼职",
    "illegal_finance": "非法金融活动：套路贷、校园贷、非法集资、传销、庞氏骗局、场外配资",
    "regulatory_evasion": "监管规避：规避检查、监管套利、跨境赌博",
}
