"""将模型回答中的编号引用绑定到已验证的检索上下文。"""

import re
from collections.abc import Sequence
from typing import TypeVar

_CITATION_PATTERN = re.compile(r"(?<!\[)\[(\d+)\](?!\])")
_CitationT = TypeVar("_CitationT")


def extract_citation_numbers(answer: str, context_count: int) -> list[int]:
    """按首次出现顺序提取范围内的十进制引用编号并去重。"""
    if context_count < 0:
        raise ValueError("context_count不能小于0")

    numbers: list[int] = []
    seen: set[int] = set()
    for match in _CITATION_PATTERN.finditer(answer):
        number = int(match.group(1))
        if number < 1 or number > context_count or number in seen:
            continue
        seen.add(number)
        numbers.append(number)
    return numbers


def bind_used_citations(
    answer: str,
    retrieved_contexts: Sequence[_CitationT],
) -> list[_CitationT]:
    """直接从可信检索上下文中选择回答明确引用的对象。"""
    return [
        retrieved_contexts[number - 1]
        for number in extract_citation_numbers(answer, len(retrieved_contexts))
    ]
