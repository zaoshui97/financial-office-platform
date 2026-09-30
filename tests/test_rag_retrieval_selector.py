"""Pure tests for explicit-title resolution and deterministic candidate diversity."""

from dataclasses import dataclass
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.features.rag.retrieval_selector import (
    RetrievalDocumentRef,
    extract_explicit_titles,
    filter_retrieval_candidates_by_score,
    resolve_explicit_document_ids,
    select_retrieval_candidates,
)


@dataclass(frozen=True)
class Candidate:
    document_id: int
    chunk_id: int
    score: float
    marker: str


def _select(
    question: str,
    candidates: list[Candidate],
    documents: list[RetrievalDocumentRef],
    top_n: int = 4,
) -> list[Candidate]:
    return select_retrieval_candidates(
        question,
        candidates,
        documents,
        top_n,
        document_id_of=lambda candidate: candidate.document_id,
        chunk_id_of=lambda candidate: candidate.chunk_id,
        score_of=lambda candidate: candidate.score,
    )


def test_vector_rag_defaults_use_top_twenty_candidates_and_top_six_contexts() -> None:
    assert Settings.model_fields["RAG_VECTOR_TOP_K"].default == 20
    assert Settings.model_fields["RAG_VECTOR_TOP_N"].default == 6
    assert Settings.model_fields["RAG_VECTOR_SCORE_THRESHOLD"].default == 0.45


def test_vector_score_threshold_can_be_overridden_from_environment(monkeypatch) -> None:
    monkeypatch.setenv("RAG_VECTOR_SCORE_THRESHOLD", "0.52")

    configured = Settings(_env_file=None, SECRET_KEY="x" * 32)

    assert configured.RAG_VECTOR_SCORE_THRESHOLD == 0.52


@pytest.mark.parametrize("threshold", ["-1.01", "1.01", "nan", "inf", "-inf"])
def test_vector_score_threshold_rejects_values_outside_cosine_range(
    monkeypatch, threshold: str
) -> None:
    monkeypatch.setenv("RAG_VECTOR_SCORE_THRESHOLD", threshold)

    with pytest.raises(ValidationError):
        Settings(_env_file=None, SECRET_KEY="x" * 32)


def test_score_filter_keeps_boundary_and_rejects_invalid_scores() -> None:
    boundary = Candidate(1, 1, 0.45, "boundary")
    candidates = [
        boundary,
        Candidate(1, 2, 0.449999, "below"),
        Candidate(1, 3, float("nan"), "nan"),
        Candidate(1, 4, float("inf"), "positive-infinity"),
        Candidate(1, 5, float("-inf"), "negative-infinity"),
        SimpleNamespace(document_id=1, chunk_id=6, marker="missing"),
    ]

    filtered = filter_retrieval_candidates_by_score(
        candidates,
        0.45,
        score_of=lambda candidate: candidate.score,
    )

    assert filtered == [boundary]
    assert filtered[0] is boundary
    assert boundary.score == 0.45


def test_single_title_keeps_chunk_ranked_six_in_final_top_six() -> None:
    documents = [
        RetrievalDocumentRef(13, "中华人民共和国网络安全法.pdf"),
        RetrievalDocumentRef(11, "银行保险机构数据安全管理办法.pdf"),
    ]
    candidates = [
        Candidate(13, 87, 0.69885415, "rank-1"),
        Candidate(13, 82, 0.6707109, "rank-2"),
        Candidate(13, 85, 0.66656387, "rank-3"),
        Candidate(13, 90, 0.63269377, "rank-4"),
        Candidate(13, 91, 0.6101781, "rank-5"),
        Candidate(13, 84, 0.6074338, "core-rank-6"),
        Candidate(11, 1, 0.99, "other-document"),
    ]

    selected = _select(
        "根据《中华人民共和国网络安全法》回答。",
        candidates,
        documents,
        top_n=6,
    )

    assert [candidate.chunk_id for candidate in selected] == [87, 82, 85, 90, 91, 84]
    assert selected[-1] is candidates[5]


def test_two_titles_include_document_first_seen_at_global_rank_eighteen() -> None:
    documents = [
        RetrievalDocumentRef(9, "中华人民共和国数据安全法.pdf"),
        RetrievalDocumentRef(11, "银行保险机构数据安全管理办法.pdf"),
    ]
    candidates = [
        Candidate(11, chunk_id, 1.0 - chunk_id / 100, f"industry-{chunk_id}")
        for chunk_id in range(1, 18)
    ] + [
        Candidate(9, 43, 0.55, "general-first"),
        Candidate(9, 45, 0.54, "general-second"),
    ]

    selected = _select(
        "《数据安全法》如何在《银行保险机构数据安全管理办法》中细化？",
        candidates,
        documents,
        top_n=6,
    )

    assert [candidate.document_id for candidate in selected] == [9, 11, 9, 11, 11, 11]
    assert [candidate.chunk_id for candidate in selected] == [43, 1, 45, 2, 3, 4]


def test_two_titles_with_sufficient_candidates_allocate_three_per_document() -> None:
    documents = [RetrievalDocumentRef(1, "甲.pdf"), RetrievalDocumentRef(2, "乙.pdf")]
    candidates = [
        Candidate(1, 1, 0.99, "a1"),
        Candidate(1, 2, 0.98, "a2"),
        Candidate(1, 3, 0.97, "a3"),
        Candidate(2, 4, 0.80, "b1"),
        Candidate(2, 5, 0.70, "b2"),
        Candidate(2, 6, 0.60, "b3"),
    ]

    selected = _select("比较《甲》和《乙》。", candidates, documents, top_n=6)

    assert [candidate.marker for candidate in selected] == [
        "a1",
        "b1",
        "a2",
        "b2",
        "a3",
        "b3",
    ]


def test_two_titles_fill_short_document_slots_by_global_score() -> None:
    documents = [RetrievalDocumentRef(1, "甲.pdf"), RetrievalDocumentRef(2, "乙.pdf")]
    candidates = [
        Candidate(1, 1, 0.99, "a1"),
        Candidate(3, 30, 0.95, "global"),
        Candidate(2, 20, 0.90, "b1"),
        Candidate(1, 2, 0.80, "a2"),
        Candidate(1, 3, 0.70, "a3"),
        Candidate(1, 4, 0.60, "a4"),
    ]

    selected = _select("比较《甲》和《乙》。", candidates, documents, top_n=6)

    assert [candidate.marker for candidate in selected] == [
        "a1",
        "b1",
        "a2",
        "a3",
        "global",
        "a4",
    ]


def test_missing_title_keeps_global_score_order() -> None:
    documents = [RetrievalDocumentRef(1, "已有文档.pdf")]
    candidates = [
        Candidate(1, 1, 0.4, "low"),
        Candidate(2, 2, 0.9, "high"),
        Candidate(1, 3, 0.7, "middle"),
    ]

    selected = _select("请查询《不存在的文档》。", candidates, documents)

    assert [candidate.marker for candidate in selected] == ["high", "middle", "low"]


def test_ambiguous_title_does_not_filter_candidates() -> None:
    documents = [
        RetrievalDocumentRef(1, "同名制度.pdf"),
        RetrievalDocumentRef(2, "同名制度.docx"),
    ]
    candidates = [
        Candidate(2, 2, 0.8, "second"),
        Candidate(1, 1, 0.9, "first"),
        Candidate(3, 3, 0.7, "third"),
    ]

    assert resolve_explicit_document_ids("《同名制度》", documents) == ()
    assert [candidate.marker for candidate in _select("《同名制度》", candidates, documents)] == [
        "first",
        "second",
        "third",
    ]


@pytest.mark.parametrize(
    ("question_title", "filename"),
    [
        ("数据安全法", "中华人民共和国数据安全法.pdf"),
        ("网络安全法", "中华人民共和国网络安全法.pdf"),
        ("个人信息保护法", "中华人民共和国个人信息保护法.pdf"),
    ],
)
def test_controlled_formal_law_name_matching(question_title: str, filename: str) -> None:
    documents = [RetrievalDocumentRef(9, filename)]

    assert resolve_explicit_document_ids(f"《{question_title}》", documents) == (9,)


def test_exact_match_takes_priority_over_controlled_formal_law_match() -> None:
    documents = [
        RetrievalDocumentRef(1, "数据安全法.pdf"),
        RetrievalDocumentRef(9, "中华人民共和国数据安全法.pdf"),
    ]

    assert resolve_explicit_document_ids("《数据安全法》", documents) == (1,)


@pytest.mark.parametrize("question_title", ["安全法", "数据安全"])
def test_arbitrary_partial_titles_do_not_match_formal_law_names(question_title: str) -> None:
    documents = [RetrievalDocumentRef(9, "中华人民共和国数据安全法.pdf")]

    assert resolve_explicit_document_ids(f"《{question_title}》", documents) == ()


def test_ambiguous_controlled_formal_law_match_is_rejected() -> None:
    documents = [
        RetrievalDocumentRef(9, "中华人民共和国数据安全法.pdf"),
        RetrievalDocumentRef(10, "中华人民共和国数据安全法.docx"),
    ]

    assert resolve_explicit_document_ids("《数据安全法》", documents) == ()


def test_partial_multi_title_resolution_keeps_global_score_order() -> None:
    documents = [RetrievalDocumentRef(11, "银行保险机构数据安全管理办法.pdf")]
    candidates = [
        Candidate(11, 1, 0.8, "matched"),
        Candidate(9, 2, 0.9, "unresolved-title-document"),
        Candidate(6, 3, 0.7, "other"),
    ]

    selected = _select(
        "比较《不存在的法律》和《银行保险机构数据安全管理办法》。",
        candidates,
        documents,
    )

    assert [candidate.marker for candidate in selected] == [
        "unresolved-title-document",
        "matched",
        "other",
    ]


def test_ambiguous_multi_title_resolution_keeps_global_score_order() -> None:
    documents = [
        RetrievalDocumentRef(11, "银行保险机构数据安全管理办法.pdf"),
        RetrievalDocumentRef(9, "中华人民共和国数据安全法.pdf"),
        RetrievalDocumentRef(10, "中华人民共和国数据安全法.docx"),
    ]
    candidates = [
        Candidate(11, 1, 0.8, "matched"),
        Candidate(9, 2, 0.9, "ambiguous-first"),
        Candidate(10, 3, 0.7, "ambiguous-second"),
    ]

    selected = _select(
        "比较《数据安全法》和《银行保险机构数据安全管理办法》。",
        candidates,
        documents,
    )

    assert [candidate.marker for candidate in selected] == [
        "ambiguous-first",
        "matched",
        "ambiguous-second",
    ]


def test_single_controlled_formal_law_title_filters_to_the_unique_document() -> None:
    documents = [
        RetrievalDocumentRef(9, "中华人民共和国数据安全法.pdf"),
        RetrievalDocumentRef(11, "银行保险机构数据安全管理办法.pdf"),
    ]
    candidates = [
        Candidate(11, 1, 0.99, "other-high"),
        Candidate(9, 2, 0.60, "target-first"),
        Candidate(9, 3, 0.50, "target-second"),
    ]

    selected = _select("请依据《数据安全法》回答。", candidates, documents)

    assert [candidate.marker for candidate in selected] == ["target-first", "target-second"]


def test_document_scope_is_limited_to_caller_provided_documents() -> None:
    in_scope = [RetrievalDocumentRef(11, "银行保险机构数据安全管理办法.pdf")]

    assert resolve_explicit_document_ids("《数据安全法》", in_scope) == ()


@pytest.mark.parametrize(
    "question",
    ["《数据安全法》", "《数据安全法.pdf》", "《数据安全法.PDF》"],
)
def test_extension_is_optional_for_exact_matching(question: str) -> None:
    documents = [RetrievalDocumentRef(9, "数据安全法.pdf")]

    assert resolve_explicit_document_ids(question, documents) == (9,)


def test_nfkc_and_surrounding_whitespace_are_normalized() -> None:
    documents = [RetrievalDocumentRef(9, "数据安全法.pdf")]
    question = "请依据《　数据安全法．ＰＤＦ　》回答。"

    assert extract_explicit_titles(question) == ("数据安全法.PDF",)
    assert resolve_explicit_document_ids(question, documents) == (9,)


def test_question_without_titles_keeps_old_score_order() -> None:
    candidates = [
        Candidate(1, 1, 0.2, "low"),
        Candidate(2, 2, 0.8, "high"),
        Candidate(1, 3, 0.5, "middle"),
    ]

    selected = _select("请比较两份制度。", candidates, [], top_n=2)

    assert [candidate.marker for candidate in selected] == ["high", "middle"]


def test_no_title_result_never_exceeds_top_six() -> None:
    candidates = [
        Candidate(1, chunk_id, float(chunk_id), f"chunk-{chunk_id}")
        for chunk_id in range(1, 9)
    ]

    selected = _select("请说明相关要求。", candidates, [], top_n=6)

    assert [candidate.chunk_id for candidate in selected] == [8, 7, 6, 5, 4, 3]


def test_chunk_deduplication_preserves_highest_ranked_object_and_limit() -> None:
    highest = Candidate(1, 7, 0.9, "highest")
    duplicate = Candidate(1, 7, 0.8, "duplicate")
    candidates = [duplicate, Candidate(2, 8, 0.7, "other"), highest, Candidate(3, 9, 0.6, "last")]

    selected = _select("无标题", candidates, [], top_n=2)

    assert selected == [highest, candidates[1]]
    assert selected[0] is highest


def test_multiple_titles_fill_remaining_slots_by_global_score() -> None:
    documents = [RetrievalDocumentRef(1, "甲.pdf"), RetrievalDocumentRef(2, "乙.pdf")]
    candidates = [
        Candidate(3, 30, 0.95, "global-first"),
        Candidate(1, 10, 0.80, "named-a"),
        Candidate(2, 20, 0.70, "named-b"),
        Candidate(4, 40, 0.60, "global-second"),
    ]

    selected = _select("《甲》和《乙》", candidates, documents, top_n=4)

    assert [candidate.marker for candidate in selected] == [
        "named-a",
        "named-b",
        "global-first",
        "global-second",
    ]


def test_empty_candidates_return_empty_result() -> None:
    assert _select("《甲》", [], [RetrievalDocumentRef(1, "甲.pdf")]) == []


@pytest.mark.parametrize("top_n", [0, -1, True, 1.5, "4"])
def test_invalid_top_n_is_rejected(top_n) -> None:
    with pytest.raises(ValueError, match="positive integer"):
        _select("无标题", [Candidate(1, 1, 1.0, "one")], [], top_n=top_n)
