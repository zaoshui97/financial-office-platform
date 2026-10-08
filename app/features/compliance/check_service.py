"""合规沙箱结构化审查入口：4 层防御 + 规则库 + 审计 + 结构化输出。

不调 LLM 生成回答，纯粹基于 guard 4 层防御 + 词库 + 脱敏 + 审计，
返回前端 SandboxRunner 需要的结构化清单（score/passed/blocked/issues/...）。
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import get_logger
from app.features.compliance.audit import AuditPayload, write_audit_log
from app.features.compliance.guard import (
    RISK_CATEGORY_OTHER,
    SandboxGuard,
    sandbox_guard,
)
from app.features.compliance.keywords import RISK_KEYWORDS_BY_CATEGORY
from app.features.compliance.sanitizer import sanitize_preview, sanitize_text
from app.features.compliance.schemas import (
    SandboxCheckIssue,
    SandboxCheckRequest,
    SandboxCheckResponse,
)

logger = get_logger(__name__)


# 严重度 → 分值扣除（用于评分）
_SEVERITY_PENALTY: dict[str, float] = {
    "block": 1.5,
    "high": 1.0,
    "medium": 0.5,
    "low": 0.2,
}

# 风险分类 → 中文人名 + 关联法规（演示用映射，与 guard 的 snake_case 对齐）
_CATEGORY_DISPLAY: dict[str, dict[str, object]] = {
    "money_laundering": {
        "name": "反洗钱/可疑资金",
        "icon": "💰",
        "color": "#DC2626",
        "regulation_ids": ["LAW-AML-2006", "REG-AML-PBOC-2022"],
    },
    "insider_trading": {
        "name": "内幕交易/市场操纵",
        "icon": "📈",
        "color": "#EF4444",
        "regulation_ids": ["LAW-SEC-2014", "REG-INSIDER-2007"],
    },
    "tax_evasion": {
        "name": "税务违规",
        "icon": "🧾",
        "color": "#F59E0B",
        "regulation_ids": ["LAW-CS-2015", "REG-INVOICE-2023"],
    },
    "bribery": {
        "name": "商业贿赂/利益输送",
        "icon": "💼",
        "color": "#DC2626",
        "regulation_ids": ["LAW-UPC-2017", "LAW-CRIM-2017"],
    },
    "privacy_leak": {
        "name": "客户隐私/数据泄露",
        "icon": "🔒",
        "color": "#7C3AED",
        "regulation_ids": ["LAW-PIPL-2021", "LAW-CSL-2017"],
    },
    "illegal_commitment": {
        "name": "违规承诺/误导销售",
        "icon": "⚠️",
        "color": "#DC2626",
        "regulation_ids": ["LAW-AD-2015", "REG-AR-2018"],
    },
    "conflict_of_interest": {
        "name": "利益冲突/道德风险",
        "icon": "🔄",
        "color": "#F59E0B",
        "regulation_ids": ["LAW-SFL-2012", "REG-CBIRC-INS-2021"],
    },
    "illegal_finance": {
        "name": "非法金融活动",
        "icon": "🚫",
        "color": "#DC2626",
        "regulation_ids": ["LAW-CRIM-2017-176", "LAW-CRIM-2017-192"],
    },
    "regulatory_evasion": {
        "name": "监管规避",
        "icon": "🏃",
        "color": "#F59E0B",
        "regulation_ids": ["LAW-BANK-2003", "LAW-CIRC-2003"],
    },
    "other": {
        "name": "其他风险",
        "icon": "❓",
        "color": "#6B7280",
        "regulation_ids": [],
    },
}

# 命中关键词 → 规则 ID / 名称 / 严重度（演示用映射：覆盖最常见的金融红线场景）
_KEYWORD_RULES: list[dict] = [
    # ---- illegal_commitment 投资收益承诺（block 级）----
    {
        "kw": "保本保收益", "category": "illegal_commitment", "severity": "block",
        "rule_id": "IP-001", "rule_name": "承诺保本保收益",
        "suggestion": "《资管新规》明确禁止保本保收益，请改用「预期收益」表述。",
    },
    {
        "kw": "刚性兑付", "category": "illegal_commitment", "severity": "block",
        "rule_id": "IP-002", "rule_name": "刚性兑付表述",
        "suggestion": "金融机构不得承诺刚性兑付，删除该表述。",
    },
    {
        "kw": "保证收益", "category": "illegal_commitment", "severity": "block",
        "rule_id": "IP-003", "rule_name": "承诺保证收益",
        "suggestion": "删除「保证收益」表述，改用「参考收益」「过往业绩」等中性词。",
    },
    {
        "kw": "稳赚不赔", "category": "illegal_commitment", "severity": "block",
        "rule_id": "IP-004", "rule_name": "金融诈骗话术",
        "suggestion": "「稳赚不赔」属金融诈骗话术，立即删除。",
    },
    {
        "kw": "零风险", "category": "illegal_commitment", "severity": "block",
        "rule_id": "IP-005", "rule_name": "零风险承诺",
        "suggestion": "「零风险」属于绝对化承诺，违反《广告法》第 9 条。",
    },
    {
        "kw": "无风险", "category": "illegal_commitment", "severity": "high",
        "rule_id": "IP-006", "rule_name": "无风险表述",
        "suggestion": "「无风险」误导性陈述，应改为「低风险」并附风险揭示。",
    },
    {
        "kw": "百分百", "category": "illegal_commitment", "severity": "block",
        "rule_id": "IP-007", "rule_name": "百分百收益承诺",
        "suggestion": "「百分百收益」属诈骗话术，删除。",
    },
    {
        "kw": "内幕消息", "category": "insider_trading", "severity": "block",
        "rule_id": "IT-001", "rule_name": "内幕消息引用",
        "suggestion": "「内幕消息」属证券法红线，删除并使用公开信息。",
    },
    {
        "kw": "稳赚", "category": "illegal_commitment", "severity": "block",
        "rule_id": "IP-008", "rule_name": "稳赚承诺",
        "suggestion": "「稳赚」属违规收益承诺，立即删除。",
    },
    # ---- 信息披露违规（block / high 级）----
    {
        "kw": "未及时披露", "category": "regulatory_evasion", "severity": "high",
        "rule_id": "DV-001", "rule_name": "重大事件未及时披露",
        "suggestion": "应按《信披办法》第 30 条立即披露重大事件。",
    },
    {
        "kw": "内幕交易", "category": "insider_trading", "severity": "block",
        "rule_id": "DV-101", "rule_name": "内幕交易",
        "suggestion": "「内幕交易」属《证券法》第 76 条红线，立即停止并报告。",
    },
    {
        "kw": "老鼠仓", "category": "insider_trading", "severity": "block",
        "rule_id": "DV-102", "rule_name": "老鼠仓",
        "suggestion": "「老鼠仓」属证券从业人员严重违规，立即停止并移送司法机关。",
    },
    {
        "kw": "占用基金财产", "category": "conflict_of_interest", "severity": "block",
        "rule_id": "RT-002", "rule_name": "关联方资金占用",
        "suggestion": "关联方占用基金财产属严重违规，立即停止并向证监会报告。",
    },
    {
        "pattern": r"关联方.{0,15}?占用", "category": "conflict_of_interest", "severity": "high",
        "rule_id": "RT-001", "rule_name": "关联交易未披露",
        "suggestion": "关联交易应按《信披办法》第 48 条及时披露。",
    },
    # ---- 投资者适当性（high 级）----
    {
        "kw": "未做风险揭示", "category": "illegal_commitment", "severity": "block",
        "rule_id": "CS-001", "rule_name": "风险揭示缺失",
        "suggestion": "应按《适当性办法》第 15 条做投资者适当性匹配并风险揭示。",
    },
    {
        "kw": "未让客户抄录", "category": "illegal_commitment", "severity": "block",
        "rule_id": "CS-002", "rule_name": "风险声明抄录缺失",
        "suggestion": "应让客户亲笔抄录风险声明语句（《保险销售办法》第 12 条）。",
    },
    {
        "pattern": r"C1.{0,10}?R5|C1.{0,5}?R5|保守型.{0,10}?高风险",
        "category": "illegal_commitment", "severity": "block",
        "rule_id": "CS-003", "rule_name": "风险等级不匹配",
        "suggestion": "C1（保守型）不应匹配 R5（高风险）产品，违反适当性管理。",
    },
    # ---- 报销 / 用印 异常（block 级，避免放过）----
    {
        "pattern": r"(\d{6,}|\d+\.\d+)\s*元.*?(\d{6,}|\d+\.\d+)\s*元|五星级酒店|商务舱",
        "category": "other", "severity": "block",
        "rule_id": "AMT-001", "rule_name": "高额差旅异常",
        "suggestion": "单笔超 50000 元差旅需部门负责人审批，建议分项列明。",
    },
    {
        "kw": "缺用印对象", "category": "other", "severity": "block",
        "rule_id": "SEAL-001", "rule_name": "用印对象描述缺失",
        "suggestion": "印章使用申请应明确「对 XX 合同/文件用印」的具体对象，否则拒绝用印。",
    },
    {
        "kw": "未签字", "category": "other", "severity": "block",
        "rule_id": "SEAL-002", "rule_name": "审批人签字缺失",
        "suggestion": "印章使用必须由有权审批人签字（《印章使用管理办法》第 4 条），缺失将拒绝用印。",
    },
    {
        "kw": "围标", "category": "bribery", "severity": "block",
        "rule_id": "BR-003", "rule_name": "围标串标",
        "suggestion": "围标串标属商业贿赂，立即停止。",
    },
    {
        "kw": "串标", "category": "bribery", "severity": "block",
        "rule_id": "BR-004", "rule_name": "串标",
        "suggestion": "围标串标属商业贿赂，立即停止。",
    },
    # ---- money_laundering 反洗钱（block / high 级）----
    {
        "kw": "拆分", "category": "money_laundering", "severity": "high",
        "rule_id": "AML-001", "rule_name": "拆分存款规避",
        "suggestion": "拆分存款规避申报触发反洗钱预警，请如实申报。",
    },
    {
        "kw": "地下钱庄", "category": "money_laundering", "severity": "block",
        "rule_id": "AML-002", "rule_name": "地下钱庄",
        "suggestion": "严禁使用地下钱庄进行跨境资金转移。",
    },
    {
        "kw": "换汇", "category": "money_laundering", "severity": "medium",
        "rule_id": "AML-003", "rule_name": "非正规换汇",
        "suggestion": "非正规渠道换汇违法，须通过外汇指定银行办理。",
    },
    {
        "kw": "跑分", "category": "money_laundering", "severity": "block",
        "rule_id": "AML-004", "rule_name": "跑分平台",
        "suggestion": "「跑分」属洗钱行为，立即停止相关操作并向公安举报。",
    },
    {
        "kw": "空壳公司", "category": "money_laundering", "severity": "high",
        "rule_id": "AML-005", "rule_name": "空壳公司",
        "suggestion": "空壳公司常被用于洗钱，须穿透识别实际受益人。",
    },
    # ---- privacy_leak 隐私（block 级）----
    {
        "pattern": r"\b\d{17}[\dXx]\b", "category": "privacy_leak", "severity": "block",
        "rule_id": "DP-001", "rule_name": "身份证号明文",
        "suggestion": "身份证号属敏感个人信息，必须脱敏（保留前 4 后 4 位）。",
    },
    {
        "pattern": r"\b1[3-9]\d{9}\b", "category": "privacy_leak", "severity": "high",
        "rule_id": "DP-002", "rule_name": "手机号明文",
        "suggestion": "手机号属个人联系方式，建议脱敏为 138****8000 形式。",
    },
    {
        "pattern": r"(?<!\d)\d{16,19}(?!\d)", "category": "privacy_leak", "severity": "block",
        "rule_id": "DP-003", "rule_name": "银行卡号明文",
        "suggestion": "银行卡号必须脱敏，仅保留后 4 位。",
    },
    {
        "pattern": r"\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b", "category": "privacy_leak", "severity": "low",
        "rule_id": "DP-004", "rule_name": "邮箱地址明文",
        "suggestion": "邮箱地址建议脱敏或使用企业通讯录别名。",
    },
    # ---- tax_evasion 税务 ----
    {
        "kw": "阴阳合同", "category": "tax_evasion", "severity": "block",
        "rule_id": "TX-001", "rule_name": "阴阳合同",
        "suggestion": "阴阳合同属偷税手段，立即停止并向税务部门报告。",
    },
    {
        "kw": "虚开", "category": "tax_evasion", "severity": "block",
        "rule_id": "TX-002", "rule_name": "虚开发票",
        "suggestion": "虚开发票属刑事犯罪，立即停止。",
    },
    {
        "kw": "两套账", "category": "tax_evasion", "severity": "block",
        "rule_id": "TX-003", "rule_name": "两套账",
        "suggestion": "「两套账」属偷税手段，立即停止并按税法申报。",
    },
    # ---- bribery 商业贿赂 ----
    {
        "kw": "回扣", "category": "bribery", "severity": "block",
        "rule_id": "BR-001", "rule_name": "回扣",
        "suggestion": "回扣属商业贿赂，删除相关表述。",
    },
    {
        "kw": "好处费", "category": "bribery", "severity": "block",
        "rule_id": "BR-002", "rule_name": "好处费",
        "suggestion": "「好处费」属商业贿赂，立即删除。",
    },
    {
        "kw": "行贿", "category": "bribery", "severity": "block",
        "rule_id": "BR-003", "rule_name": "行贿表述",
        "suggestion": "行贿属刑事犯罪，立即删除。",
    },
    # ---- conflict_of_interest 利益冲突 ----
    {
        "kw": "代客理财", "category": "conflict_of_interest", "severity": "block",
        "rule_id": "CI-001", "rule_name": "代客理财",
        "suggestion": "员工不得代客理财，须由客户本人操作。",
    },
    {
        "kw": "飞单", "category": "conflict_of_interest", "severity": "block",
        "rule_id": "CI-002", "rule_name": "飞单",
        "suggestion": "飞单属严重违规，立即停止并向合规部门报告。",
    },
    {
        "kw": "私单", "category": "conflict_of_interest", "severity": "high",
        "rule_id": "CI-003", "rule_name": "私单",
        "suggestion": "「私单」属体外循环，删除相关表述。",
    },
    # ---- illegal_finance 非法金融 ----
    {
        "kw": "套路贷", "category": "illegal_finance", "severity": "block",
        "rule_id": "IF-001", "rule_name": "套路贷",
        "suggestion": "套路贷属非法金融活动，立即停止。",
    },
    {
        "kw": "校园贷", "category": "illegal_finance", "severity": "block",
        "rule_id": "IF-002", "rule_name": "校园贷",
        "suggestion": "校园贷属非法金融活动，立即停止。",
    },
    {
        "kw": "非法集资", "category": "illegal_finance", "severity": "block",
        "rule_id": "IF-003", "rule_name": "非法集资",
        "suggestion": "非法集资属刑事犯罪，立即停止。",
    },
    {
        "kw": "庞氏", "category": "illegal_finance", "severity": "block",
        "rule_id": "IF-004", "rule_name": "庞氏骗局",
        "suggestion": "庞氏骗局属诈骗，立即停止并向公安举报。",
    },
    {
        "kw": "传销", "category": "illegal_finance", "severity": "block",
        "rule_id": "IF-005", "rule_name": "传销",
        "suggestion": "传销属刑事犯罪，立即停止。",
    },
    # ---- regulatory_evasion 监管规避 ----
    {
        "kw": "规避监管", "category": "regulatory_evasion", "severity": "block",
        "rule_id": "RE-001", "rule_name": "规避监管",
        "suggestion": "规避监管属严重违规，立即停止相关操作。",
    },
    {
        "kw": "规避检查", "category": "regulatory_evasion", "severity": "block",
        "rule_id": "RE-002", "rule_name": "规避检查",
        "suggestion": "规避检查属严重违规，立即停止。",
    },
]


@dataclass
class _Hit:
    rule_id: str
    rule_name: str
    category: str
    severity: str
    snippet: str
    suggestion: str
    regulation_ids: list[str]


def _scan_rules(text: str) -> list[_Hit]:
    """扫描所有规则，命中即返回。

    内置否定词上下文过滤：若关键词前后 8 字内出现 "不/未/无/严禁/不存在/
    不予/不会/从未/不应/不得" 等否定词，则视为反向声明（合规宣誓）跳过。
    这样合规对照组文案（"不承诺保本、不存在刚兑"）不会被误命中。
    """
    hits: list[_Hit] = []
    lowered = text.lower()

    # 否定词集合（前后 ±8 字窗口内命中即跳过；用「否定短语」而非单字）
    NEGATIONS = (
        # 直接否定
        "不承诺", "不存在", "不允许", "不应", "未有", "未曾",
        "未承诺", "无任何", "无此", "非采用", "非使用",
        "严禁作出", "严禁", "杜绝", "不构成", "不应构成",
        "不会", "不会构成", "将不构成", "将不会", "不发生",
        "禁止", "不应当", "未经审批不得",
        "已承诺不", "明确不", "严令禁止", "反对",
        "不采用", "未采用", "不使用",
        # 否认性问题（"是否 X" 形式）
        "是否", "是否构成", "是否发生", "是否进行", "可否",
        "是否属于", "是否属于", "不属",
        # 自身否定（"不存在 X" / "无 X 行为"）
        "可能", "可能存在", "疑似", "疑似",
        # 控制风险相关表述（演示用）
        "不存在", "无风险", # 重复以增强匹配
    )

    def _is_negated(text_full: str, pos: int, length: int) -> bool:
        """检查命中位置前后 ±8 字内是否存在「否定短语」（而非单字）。

        用「短语」避免「不」「未」过宽误伤：
          - 「不承诺保本」（含否定短语）→ 跳过
          - 「手机号 13800138000 在宣传文案里」（无否定短语）→ 命中
          - 「不构成短线交易」（含否定短语）→ 跳过
          - 「零风险·保本保收益」（无否定短语）→ 命中
        """
        start = max(0, pos - 8)
        end = min(len(text_full), pos + length + 8)
        window = text_full[start:end]
        return any(neg in window for neg in NEGATIONS)

    for rule in _KEYWORD_RULES:
        matched = False
        snippet = ""
        if "kw" in rule:
            kw = rule["kw"]
            idx = -1
            while True:
                if kw in text:
                    pos = text.find(kw, idx + 1) if idx >= 0 else text.find(kw)
                elif kw.lower() in lowered:
                    pos = lowered.find(kw.lower(), idx + 1) if idx >= 0 else lowered.find(kw.lower())
                else:
                    break
                if pos < 0:
                    break
                if not _is_negated(text, pos, len(kw)):
                    matched = True
                    snippet = kw
                    break
                idx = pos
        elif "pattern" in rule:
            m = re.search(rule["pattern"], text)
            if m and not _is_negated(text, m.start(), m.end() - m.start()):
                matched = True
                snippet = m.group(0)
        if matched:
            meta = _CATEGORY_DISPLAY.get(rule["category"], _CATEGORY_DISPLAY["other"])
            regulation_ids = list(meta.get("regulation_ids", []))
            hits.append(
                _Hit(
                    rule_id=rule["rule_id"],
                    rule_name=rule["rule_name"],
                    category=rule["category"],
                    severity=rule["severity"],
                    snippet=snippet,
                    suggestion=rule["suggestion"],
                    regulation_ids=regulation_ids,
                )
            )
    # 去重（rule_id）
    seen: set[str] = set()
    unique: list[_Hit] = []
    for h in hits:
        if h.rule_id in seen:
            continue
        seen.add(h.rule_id)
        unique.append(h)
    return unique


def _aggregate_score(hits: list[_Hit]) -> float:
    """根据命中严重度聚合评分（5 分制）。"""
    score = 5.0
    for h in hits:
        score -= _SEVERITY_PENALTY.get(h.severity, 0.3)
    return max(0.0, round(score, 2))


def _pick_primary_category(hits: list[_Hit]) -> str | None:
    """优先级：block > high > medium > low，选首个命中的 category。"""
    order = {"block": 4, "high": 3, "medium": 2, "low": 1}
    if not hits:
        return None
    sorted_hits = sorted(hits, key=lambda h: -order.get(h.severity, 0))
    return sorted_hits[0].category


def execute_sandbox_check(
    db: Session,
    owner_id: int,
    req: SandboxCheckRequest,
    skip_rules: bool = False,
) -> SandboxCheckResponse:
    """合规沙箱结构化审查主入口。

    流程：扫描规则 → PII 脱敏 → 4 层守卫 → 聚合评分 → 审计 → 返回结构化。
    失败不阻塞：任一步异常降级到「仅关键词 + 不审计」，仍返回可用结果。
    """
    started = time.perf_counter()
    text = req.text or ""

    # 1) 守卫 L1: Kill Switch
    kill_decision = sandbox_guard.check_kill_switch()
    if not kill_decision.allowed:
        # 熔断：直接返回阻断
        return SandboxCheckResponse(
            score=0.0,
            passed=False,
            blocked=True,
            issues=[
                SandboxCheckIssue(
                    rule_id="KS-001",
                    rule_name="Kill Switch 已开启",
                    category=RISK_CATEGORY_OTHER,
                    severity="block",
                    snippet="",
                    suggestion="合规沙箱已熔断，请联系管理员。",
                    regulation_ids=[],
                )
            ],
            total_hits=1,
            duration_ms=int((time.perf_counter() - started) * 1000),
            sanitized_text="",
            risk_category=RISK_CATEGORY_OTHER,
            confidence=1.0,
            judge_source="rule",
            model_version="sandbox-check-v1.0",
        )

    # 2) 扫描规则（内置规则库）
    hits = _scan_rules(text) if not skip_rules else []

    # 3) PII 脱敏
    sanitization = sanitize_text(text)

    # 4) 守卫 L4: LLM Judge（仅在「询问合规知识」时启用，默认关闭以提速）
    # 演示场景下不开 LLM Judge，避免依赖外部 LLM 造成 5-10s 延迟；
    # 真生产环境按 settings.SANDBOX_LLM_JUDGE_ENABLED 启用。

    # 5) 聚合评分
    score = _aggregate_score(hits)
    blocked = any(h.severity == "block" for h in hits)
    passed = len(hits) == 0

    # 6) 构造 issues
    issues: list[SandboxCheckIssue] = []
    for h in hits:
        issues.append(
            SandboxCheckIssue(
                rule_id=h.rule_id,
                rule_name=h.rule_name,
                category=h.category,
                severity=h.severity,
                snippet=h.snippet,
                suggestion=h.suggestion,
                regulation_ids=h.regulation_ids,
            )
        )

    primary_category = _pick_primary_category(hits)

    # 7) 审计（失败降级，不阻塞主流程）
    audit_id: int | None = None
    try:
        audit = write_audit_log(
            db,
            AuditPayload(
                user_id=owner_id,
                conversation_id=None,
                request_id=f"check-{int(time.time() * 1000)}",
                provider="local-rule-engine",
                model="sandbox-check-v1.0",
                prompt=text,
                answer=None,
                pii_detected=sanitization.hits,
                risk_hits=[h.rule_id for h in hits],
                blocked=blocked,
                block_reason=("命中阻断级规则" if blocked else None),
                latency_ms=None,
                risk_category=primary_category,
                confidence=1.0,
                judge_source="rule",
                scenario={
                    "mode": "rule_only",
                    "source": req.source,
                    "business_ref": req.business_ref,
                    "total_issues": len(issues),
                },
            ),
            preview_chars=settings.SANDBOX_PREVIEW_CHARS,
        )
        audit_id = audit.id
    except Exception as exc:  # noqa: BLE001
        logger.warning("合规沙箱审计写入失败（已降级）: %s", exc)

    duration_ms = int((time.perf_counter() - started) * 1000)

    return SandboxCheckResponse(
        score=score,
        passed=passed,
        blocked=blocked,
        issues=issues,
        total_hits=len(hits),
        duration_ms=duration_ms,
        sanitized_text=sanitization.text[: settings.SANDBOX_PREVIEW_CHARS],
        sanitized_fields=sanitization.hits,
        risk_category=primary_category,
        confidence=1.0,
        judge_source="rule",
        audit_id=audit_id,
        model_version="sandbox-check-v1.0",
    )