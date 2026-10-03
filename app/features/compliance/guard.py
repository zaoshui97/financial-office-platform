"""合规沙箱守卫：4 层防御。

层级：
- L1: Kill Switch（紧急熔断）
- L2: 风险词硬匹配（基于 keywords.py 分层词库）
- L3: PII 脱敏（在 sanitizer.py 中执行）
- L4: LLM Judge（语义判断 + 风险分类）

设计原则：
- 任一层拒绝即返回 blocked。
- 拦截结果携带 risk_category，前端可分级展示。
- LLM Judge 失败不阻塞主流程（fallback 到 rule）。
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

from fastapi import HTTPException, status

from app.ai.llm_gateway import llm_gateway
from app.ai.schemas import AITask
from app.core.config import settings
from app.core.logging import get_logger
from app.features.compliance.keywords import (
    CATEGORY_DESCRIPTIONS,
    RISK_KEYWORDS_BY_CATEGORY,
    get_all_risk_keywords,
    parse_legacy_keywords,
)

logger = get_logger(__name__)


# 风险分类常量（与前端约定的 snake_case）
RISK_CATEGORY_MONEY_LAUNDERING = "money_laundering"
RISK_CATEGORY_INSIDER_TRADING = "insider_trading"
RISK_CATEGORY_TAX_EVASION = "tax_evasion"
RISK_CATEGORY_BRIBERY = "bribery"
RISK_CATEGORY_PRIVACY_LEAK = "privacy_leak"
RISK_CATEGORY_ILLEGAL_COMMITMENT = "illegal_commitment"
RISK_CATEGORY_CONFLICT_OF_INTEREST = "conflict_of_interest"
RISK_CATEGORY_ILLEGAL_FINANCE = "illegal_finance"
RISK_CATEGORY_REGULATORY_EVASION = "regulatory_evasion"
RISK_CATEGORY_OTHER = "other"

VALID_CATEGORIES: set[str] = {
    RISK_CATEGORY_MONEY_LAUNDERING,
    RISK_CATEGORY_INSIDER_TRADING,
    RISK_CATEGORY_TAX_EVASION,
    RISK_CATEGORY_BRIBERY,
    RISK_CATEGORY_PRIVACY_LEAK,
    RISK_CATEGORY_ILLEGAL_COMMITMENT,
    RISK_CATEGORY_CONFLICT_OF_INTEREST,
    RISK_CATEGORY_ILLEGAL_FINANCE,
    RISK_CATEGORY_REGULATORY_EVASION,
    RISK_CATEGORY_OTHER,
}


@dataclass(frozen=True)
class GuardDecision:
    """守卫检查的合并结果。"""

    allowed: bool
    blocked_reason: str | None = None
    risk_hits: list[str] = field(default_factory=list)
    # 结构化分类与置信度，供前端分级展示 + 审计聚合
    risk_category: str | None = None
    confidence: float = 0.0
    # 来源标识：rule（硬匹配）/llm_judge（语义判断）
    judge_source: str = "rule"


# ---------------------------------------------------------------------------
# LLM Judge prompt
# ---------------------------------------------------------------------------

_JUDGE_SYSTEM_PROMPT = """你是金融行业合规审查员，负责判断用户消息是否违规。

【违规类别】
{category_descriptions}

【判断规则】
1. 区分"询问合规知识"与"请求违规操作"
   - "什么是洗钱" → 合规
   - "如何洗钱" → 违规
2. 严格按 JSON 输出，不要任何额外文字
3. 模糊时标 compliant=true 但 confidence ≤ 0.5
4. 仅在 confidence ≥ {threshold} 时标记违规
5. category 必须从给定类别中选择；不确定时归类为 "other"

【输出格式】
{{"compliant": true/false, "category": "类别", "reason": "一句话理由", "confidence": 0.0-1.0}}
"""


def _build_judge_prompt(message: str, hint: str | None = None) -> str:
    """构造 LLM Judge 用户消息。"""
    cat_desc = "\n".join(f"- {k}: {v}" for k, v in CATEGORY_DESCRIPTIONS.items())
    sys_prompt = _JUDGE_SYSTEM_PROMPT.format(
        category_descriptions=cat_desc,
        threshold=settings.SANDBOX_LLM_JUDGE_CONFIDENCE_THRESHOLD,
    )
    hint_block = f"\n【额外提示】{hint}\n" if hint else ""
    # 用 user 消息承载分类任务，system 承担合规定义。
    user_prompt = (
        f"系统指令：{sys_prompt}{hint_block}\n"
        f"=== 用户消息 ===\n{message}\n\n"
        "请按系统指令输出 JSON："
    )
    return user_prompt


# ---------------------------------------------------------------------------
# 主守卫类
# ---------------------------------------------------------------------------


class SandboxGuard:
    """执行沙箱准入检查：4 层防御。"""

    def __init__(self) -> None:
        # 合并内置词库 + settings 自定义词（兼容 str 和 list 两种格式）
        builtin = get_all_risk_keywords()
        custom_str = parse_legacy_keywords(settings.SANDBOX_RISK_KEYWORDS)
        custom_list = list(settings.SANDBOX_RISK_KEYWORDS_LIST or [])
        merged = builtin + custom_list + custom_str
        self._all_keywords: list[str] = list(dict.fromkeys(merged))
        # 分类索引：word → category
        self._keyword_to_category: dict[str, str] = {}
        for cat, words in RISK_KEYWORDS_BY_CATEGORY.items():
            for w in words:
                self._keyword_to_category[w] = cat
        # settings 自定义词默认归到 "other"
        for w in custom_list + custom_str:
            self._keyword_to_category.setdefault(w, RISK_CATEGORY_OTHER)

    # -----------------------------------------------------------------------
    # L1: Kill Switch
    # -----------------------------------------------------------------------

    @staticmethod
    def check_kill_switch() -> GuardDecision:
        """若紧急熔断开启则拒绝。"""
        if settings.SANDBOX_KILL_SWITCH:
            return GuardDecision(
                allowed=False,
                blocked_reason="SANDBOX_KILL_SWITCH 已开启，所有沙箱调用已熔断",
                risk_category=RISK_CATEGORY_OTHER,
                confidence=1.0,
                judge_source="rule",
            )
        return GuardDecision(allowed=True)

    # -----------------------------------------------------------------------
    # L2: 风险词硬匹配（带分类）
    # -----------------------------------------------------------------------

    def check_risk_keywords(self, text: str) -> GuardDecision:
        """对文本做大小写不敏感的风险词匹配，返回带分类的拦截结果。

        命中后调用 LLM Judge 复核"询问合规知识"vs"请求违规"，避免误拦。
        LLM Judge 失败时默认按硬匹配拦截（保守策略）。
        """
        if not text or not self._all_keywords:
            return GuardDecision(allowed=True)
        lowered = text.lower()
        hits: list[str] = []
        categories: set[str] = set()
        for kw in self._all_keywords:
            if kw.lower() in lowered:
                hits.append(kw)
                cat = self._keyword_to_category.get(kw)
                if cat:
                    categories.add(cat)
        if hits:
            primary_category = (
                sorted(categories)[0] if categories else RISK_CATEGORY_OTHER
            )
            decision = GuardDecision(
                allowed=False,
                blocked_reason=f"命中风险词: {', '.join(hits[:5])}",
                risk_hits=hits,
                risk_category=primary_category,
                confidence=1.0,  # 硬匹配置信度 = 1
                judge_source="rule",
            )
            # LLM Judge 复核：区分"问合规知识"vs"做违规事"
            if settings.SANDBOX_LLM_JUDGE_ENABLED and self._looks_like_knowledge_query(text):
                review = self.llm_judge_check(
                    text,
                    hint="硬匹配已命中风险词，请判断用户是在'询问合规知识'还是'请求违规操作'。"
                    "如果是询问合规知识，标 compliant=true；如果是请求违规操作，标 compliant=false。",
                )
                if review.allowed:
                    logger.info(
                        "硬匹配命中但 LLM Judge 判定为合规知识询问，放行 | text=%s hits=%s",
                        text[:80],
                        hits,
                    )
                    return GuardDecision(allowed=True)
                # Judge 也认为违规 → 升级 Judge 分类与置信度
                decision = GuardDecision(
                    allowed=False,
                    blocked_reason=f"[LLM Judge 复核] {review.blocked_reason}",
                    risk_hits=hits,
                    risk_category=review.risk_category or primary_category,
                    confidence=review.confidence,
                    judge_source="llm_judge",
                )
            return decision
        return GuardDecision(allowed=True)

    @staticmethod
    def _looks_like_knowledge_query(text: str) -> bool:
        """启发式：判断文本是否像"询问合规知识"。

        命中以下特征之一即视为知识询问（需要 LLM 复核）：
        - 含疑问词：什么/如何/哪些/为什么/怎么/定义
        - 含学习特征：法规/制度/定义/知识/介绍/区别
        """
        if not text:
            return False
        knowledge_signals = [
            "什么是", "什么是", "什么叫",
            "如何", "怎样", "怎么",
            "哪些", "为什么",
            "定义", "区别", "介绍", "概述",
            "法规", "制度", "知识", "理论",
            "?", "？", "吗", "呢",
        ]
        return any(sig in text for sig in knowledge_signals)

    # -----------------------------------------------------------------------
    # L3: 自定义 system prompt 拦截
    # -----------------------------------------------------------------------

    @staticmethod
    def reject_custom_system_prompt(instructions: str | None) -> None:
        """沙箱内禁止自定义 system prompt（需求第 5 点）。"""
        if instructions and instructions.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="合规沙箱禁止自定义 system prompt，请使用平台预置模板",
            )

    # -----------------------------------------------------------------------
    # L4: LLM Judge 语义判断
    # -----------------------------------------------------------------------

    def llm_judge_check(self, message: str, hint: str | None = None) -> GuardDecision:
        """调用 LLM 当合规审查员，做语义判断。

        失败时静默放行（不阻塞业务），但写 warning 日志。
        hint: 额外上下文说明（如"硬匹配已命中，请判断是询问还是违规"）。
        """
        if not settings.SANDBOX_LLM_JUDGE_ENABLED:
            return GuardDecision(allowed=True)
        if not message or len(message.strip()) < 5:
            return GuardDecision(allowed=True)

        prompt = _build_judge_prompt(message, hint=hint)
        try:
            response_text = llm_gateway.complete(
                history=[{"role": "user", "content": prompt}],
                task=AITask.CHAT,
            )
            result = self._parse_judge_response(response_text)
            if result is None:
                logger.warning("LLM Judge 返回无法解析的内容: %s", response_text[:200])
                return GuardDecision(allowed=True)

            compliant = bool(result.get("compliant", True))
            category = result.get("category") or RISK_CATEGORY_OTHER
            if category not in VALID_CATEGORIES:
                category = RISK_CATEGORY_OTHER
            confidence = float(result.get("confidence", 0.0))
            reason = result.get("reason", "")

            if not compliant and confidence >= settings.SANDBOX_LLM_JUDGE_CONFIDENCE_THRESHOLD:
                return GuardDecision(
                    allowed=False,
                    blocked_reason=f"[LLM Judge:{category}] {reason}",
                    risk_hits=[f"llm_judge:{category}"],
                    risk_category=category,
                    confidence=confidence,
                    judge_source="llm_judge",
                )
            # 合规或低置信度违规 → 放行
            return GuardDecision(allowed=True)
        except Exception as exc:
            logger.warning("LLM Judge 异常，静默放行: %s", exc)
            return GuardDecision(allowed=True)

    @staticmethod
    def _parse_judge_response(text: str) -> dict[str, Any] | None:
        """解析 LLM 返回的 JSON，容忍 ```json 包裹或前缀文字。"""
        if not text:
            return None
        s = text.strip()
        # 去掉 ```json 包裹
        if s.startswith("```"):
            s = s.strip("`")
            if s.lower().startswith("json"):
                s = s[4:]
            s = s.strip()
        # 尝试找第一个 { 到最后一个 }
        start = s.find("{")
        end = s.rfind("}")
        if start < 0 or end <= start:
            return None
        try:
            return json.loads(s[start : end + 1])
        except json.JSONDecodeError:
            return None

    # -----------------------------------------------------------------------
    # 主入口：4 层合并
    # -----------------------------------------------------------------------

    def evaluate(
        self,
        message: str,
        instructions: str | None = None,
    ) -> GuardDecision:
        """合并 4 层守卫检查，命中任一即拒绝。"""
        # L3: 拒绝自定义 system prompt
        self.reject_custom_system_prompt(instructions)

        # L1: Kill Switch
        kill = self.check_kill_switch()
        if not kill.allowed:
            return kill

        # L2: 风险词硬匹配（带分类）
        risk = self.check_risk_keywords(message)
        if not risk.allowed:
            return risk

        # L4: LLM Judge 语义判断
        judge = self.llm_judge_check(message)
        if not judge.allowed:
            return judge

        return GuardDecision(allowed=True)


sandbox_guard = SandboxGuard()