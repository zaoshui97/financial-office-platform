"""合规沙箱 PII 脱敏器。

按需求仅替换：身份证、银行卡、手机号、邮箱 → ***。
所有脱敏函数返回脱敏后的字符串和命中详情，供审计使用。
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Mapping


# 默认正则模式。手机号必须放在银行卡之前，避免长数字串中 11 位片段被
# 银行卡正则截取。
DEFAULT_PATTERNS: dict[str, str] = {
    "id_card": r"\b\d{17}[\dXx]\b",
    "mobile": r"\b1[3-9]\d{9}\b",
    # 银行卡：16-19 位，且周围不是数字（避免吃掉身份证和手机号片段）。
    "bank_card": r"(?<!\d)\d{16,19}(?!\d)",
    "email": r"\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b",
}

_REPLACEMENT = "***"


@dataclass(frozen=True)
class SanitizationResult:
    """单次脱敏的结果。"""

    text: str
    hits: dict[str, int] = field(default_factory=dict)

    @property
    def has_pii(self) -> bool:
        """是否存在任一 PII 命中。"""
        return any(count > 0 for count in self.hits.values())

    @property
    def total_hits(self) -> int:
        """所有 PII 命中次数总和。"""
        return sum(self.hits.values())


class PIISanitizer:
    """基于正则的 PII 脱敏器，可注入自定义模式集合。"""

    def __init__(self, patterns: Mapping[str, str] | None = None) -> None:
        self._patterns: dict[str, re.Pattern[str]] = {
            name: re.compile(pattern)
            for name, pattern in (patterns or DEFAULT_PATTERNS).items()
        }

    def sanitize(self, text: str) -> SanitizationResult:
        """对字符串进行 PII 替换，返回脱敏文本与命中计数。"""
        if not text:
            return SanitizationResult(text="", hits={})
        hits: dict[str, int] = {}
        sanitized = text
        for name, regex in self._patterns.items():
            sanitized, count = regex.subn(_REPLACEMENT, sanitized)
            if count > 0:
                hits[name] = count
        return SanitizationResult(text=sanitized, hits=hits)

    def preview(self, text: str, max_chars: int) -> SanitizationResult:
        """先截取前 max_chars 字符，再脱敏。"""
        if max_chars <= 0 or not text:
            return SanitizationResult(text="", hits={})
        snippet = text[:max_chars]
        return self.sanitize(snippet)


# 进程级默认实例，便于业务侧直接复用。
_default_sanitizer = PIISanitizer()


def sanitize_text(text: str) -> SanitizationResult:
    """对一段文本执行默认脱敏。"""
    return _default_sanitizer.sanitize(text)


def sanitize_preview(text: str, max_chars: int = 500) -> SanitizationResult:
    """截取前 max_chars 字并脱敏，供审计预览字段使用。"""
    return _default_sanitizer.preview(text, max_chars=max_chars)