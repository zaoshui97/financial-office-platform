"""模型回答引用编号与可信检索上下文绑定测试。"""

import pytest

from app.features.chat.citation_binding import (
    bind_used_citations,
    extract_citation_numbers,
)


def test_extract_citation_numbers_preserves_first_use_order_and_deduplicates() -> None:
    answer = "先使用第二条。[2] 再使用第一条。[1] 最后重复第二条。[2]"

    assert extract_citation_numbers(answer, 2) == [2, 1]


def test_extract_citation_numbers_ignores_invalid_and_malformed_markers() -> None:
    answer = "[0] [3] [-1] [abc] [1a] [[1]] [2]] [[2] [ 1 ] [1"

    assert extract_citation_numbers(answer, 2) == []


def test_extract_citation_numbers_returns_empty_without_markers() -> None:
    assert extract_citation_numbers("回答没有引用编号。", 3) == []


def test_bind_used_citations_returns_original_objects_in_reference_order() -> None:
    contexts = [{"chunk_id": 1}, {"chunk_id": 2}, {"chunk_id": 3}]

    used = bind_used_citations("第二条。[2] 第一条。[1] 第二条。[2]", contexts)

    assert used == [contexts[1], contexts[0]]
    assert used[0] is contexts[1]
    assert used[1] is contexts[0]


def test_extract_citation_numbers_rejects_negative_context_count() -> None:
    with pytest.raises(ValueError, match="context_count"):
        extract_citation_numbers("[1]", -1)
