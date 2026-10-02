"""沙箱规则引擎：基于关键词的轻量风险检测。

设计为可插拔：
- 内置风险词来自 settings.SANDBOX_RISK_KEYWORDS
- 调用方可注入 extra_rules，每条形如 {"id","pattern","severity","description"}
- 匹配结果带命中的规则 id 列表，供 LLMJudge.assess 二次确认

非职责：
- 不做 LLM 判定（由 app.sandbox.llm_judge.LLMJudge 负责）
- 不写审计日志（由 app.sandbox.service 统一落库）
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Iterable, Protocol

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


@dataclass(frozen=True)
class Rule:
    """单条风险规则。

    Attributes:
        id: 规则唯一标识（要写进审计日志 + 交给 LLM 二次确认）
        pattern: 命中模式（大小写不敏感）。字符串按子串匹配；compiled 正则按 search。
        severity: low / medium / high
        description: 规则中文描述（供 LLM 引用 + 人工审计）
    """

    id: str
    pattern: str
    severity: str
    description: str = ""

    def __post_init__(self) -> None:
        if self.severity not in {"low", "medium", "high"}:
            raise ValueError(f"Rule.severity 必须是 low/medium/high: {self.id}")


@dataclass(frozen=True)
class RuleResult:
    """规则引擎单次匹配结果。

    Attributes:
        risk_level: 取所有命中规则中最高严重度
        matched_rules: 命中的 Rule.id 列表（保序去重）
        matched_intents: 命中的意图描述（与 matched_rules 一一对应，便于上层展示）
        details: 每条命中规则的详情 [{id, severity, description, snippet}]
    """

    risk_level: str = "low"
    matched_rules: list[str] = field(default_factory=list)
    matched_intents: list[str] = field(default_factory=list)
    details: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "risk_level": self.risk_level,
            "matched_rules": list(self.matched_rules),
            "matched_intents": list(self.matched_intents),
            "details": list(self.details),
        }


_SEVERITY_RANK = {"low": 0, "medium": 1, "high": 2}


def _max_severity(levels: Iterable[str]) -> str:
    """从一组 severity 中取最高。空集返回 low。"""
    best = "low"
    for lv in levels:
        if _SEVERITY_RANK.get(lv, 0) > _SEVERITY_RANK[best]:
            best = lv
    return best


class RuleProvider(Protocol):
    """规则来源抽象：settings / DB / 远程配置都可实现。"""

    def get_rules(self) -> list[Rule]: ...


class SettingsRuleProvider:
    """从 settings.SANDBOX_RISK_KEYWORDS 派生规则（每词一条 medium 规则）。"""

    def get_rules(self) -> list[Rule]:  # noqa: D401
        keywords = settings.SANDBOX_RISK_KEYWORDS or []
        return [
            Rule(
                id=f"kw-{idx:03d}",
                pattern=kw,
                severity="medium",
                description=f"内置风险词: {kw}",
            )
            for idx, kw in enumerate(keywords)
            if kw.strip()
        ]


class RuleEngine:
    """规则匹配引擎。

    Example:
        engine = RuleEngine(extra_rules=[
            Rule(id="R-001", pattern=r"\\d{17}[\\dXx]", severity="high",
                 description="身份证号"),
        ])
        result = engine.match("客户身份证 110101199001011234 ...")
        if result.risk_level == "high":
            ...
    """

    def __init__(
        self,
        *,
        extra_rules: list[Rule] | None = None,
        provider: RuleProvider | None = None,
    ) -> None:
        """创建引擎。

        Args:
            extra_rules: 调用方注入的额外规则
            provider: 规则来源（默认 SettingsRuleProvider 拿 settings.SANDBOX_RISK_KEYWORDS）
        """
        self._provider: RuleProvider = provider or SettingsRuleProvider()
        self._extra = list(extra_rules or [])

    def all_rules(self) -> list[Rule]:
        """返回当前生效的全部规则（provider + extra，去重 by id）。"""
        seen: set[str] = set()
        merged: list[Rule] = []
        for rule in [*self._provider.get_rules(), *self._extra]:
            if rule.id in seen:
                logger.debug("RuleEngine 跳过重复规则 id=%s", rule.id)
                continue
            seen.add(rule.id)
            merged.append(rule)
        return merged

    def match(self, text: str) -> RuleResult:
        """对文本执行全部规则，返回 RuleResult。"""
        if not text:
            return RuleResult()

        lowered = text.lower()
        matched_rules: list[str] = []
        matched_intents: list[str] = []
        details: list[dict[str, Any]] = []
        severities: list[str] = []

        for rule in self.all_rules():
            hit = self._match_one(rule, text, lowered)
            if hit is None:
                continue
            matched_rules.append(rule.id)
            snippet = hit  # 命中的子串
            intent = rule.description or f"命中规则 {rule.id}"
            matched_intents.append(intent)
            severities.append(rule.severity)
            details.append(
                {
                    "id": rule.id,
                    "severity": rule.severity,
                    "description": rule.description,
                    "snippet": snippet[:120],  # 截断保护
                }
            )

        return RuleResult(
            risk_level=_max_severity(severities) if severities else "low",
            matched_rules=matched_rules,
            matched_intents=matched_intents,
            details=details,
        )

    @staticmethod
    def _match_one(rule: Rule, text: str, lowered_text: str) -> str | None:
        """单规则匹配：字符串走子串（大小写不敏感），否则当正则。"""
        pat = rule.pattern
        if not pat:
            return None
        # 先按纯字符串走（小写比较）
        if pat.lower() in lowered_text:
            # 返回原文中对应的子串（保持原 case）
            start = lowered_text.find(pat.lower())
            return text[start : start + len(pat)]
        # 回退：尝试当正则
        try:
            match = re.search(pat, text, flags=re.IGNORECASE)
        except re.error:
            return None
        return match.group(0) if match else None


__all__ = [
    "Rule",
    "RuleResult",
    "RuleProvider",
    "SettingsRuleProvider",
    "RuleEngine",
]