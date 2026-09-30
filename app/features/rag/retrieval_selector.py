"""Pure helpers for explicit-title resolution and deterministic candidate selection."""

import re
import unicodedata
from collections import defaultdict, deque
from collections.abc import Callable, Hashable, Sequence
from dataclasses import dataclass
from math import isfinite
from typing import TypeVar

CandidateT = TypeVar("CandidateT")

_EXPLICIT_TITLE_PATTERN = re.compile(r"《([^《》]+)》")
_SUPPORTED_EXTENSIONS = (".pdf", ".docx", ".txt")
_FORMAL_LAW_PREFIX = "中华人民共和国"


@dataclass(frozen=True)
class RetrievalDocumentRef:
    """A caller-validated document identity available for title resolution."""

    document_id: int
    filename: str


def filter_retrieval_candidates_by_score(
    candidates: Sequence[CandidateT],
    threshold: float,
    *,
    score_of: Callable[[CandidateT], object],
) -> list[CandidateT]:
    """Keep finite scores at or above a validated Cosine threshold."""
    try:
        normalized_threshold = float(threshold)
    except (TypeError, ValueError) as exc:
        raise ValueError("threshold must be a finite number between -1.0 and 1.0") from exc
    if not isfinite(normalized_threshold) or not -1.0 <= normalized_threshold <= 1.0:
        raise ValueError("threshold must be a finite number between -1.0 and 1.0")

    filtered: list[CandidateT] = []
    for candidate in candidates:
        try:
            raw_score = score_of(candidate)
            if isinstance(raw_score, bool):
                continue
            score = float(raw_score)
        except (AttributeError, TypeError, ValueError):
            continue
        if isfinite(score) and score >= normalized_threshold:
            filtered.append(candidate)
    return filtered


def _normalize_title(value: str) -> str:
    return unicodedata.normalize("NFKC", value).strip()


def _title_match_key(value: str) -> str:
    normalized = _normalize_title(value)
    folded = normalized.casefold()
    for extension in _SUPPORTED_EXTENSIONS:
        if folded.endswith(extension):
            normalized = normalized[: -len(extension)].rstrip()
            break
    return normalized.casefold()


def extract_explicit_titles(question: str) -> tuple[str, ...]:
    """Extract unique NFKC-normalized titles enclosed by Chinese book-title marks."""
    if not isinstance(question, str):
        raise TypeError("question must be a string")

    titles: list[str] = []
    seen_keys: set[str] = set()
    for match in _EXPLICIT_TITLE_PATTERN.finditer(question):
        title = _normalize_title(match.group(1))
        key = _title_match_key(title)
        if key and key not in seen_keys:
            titles.append(title)
            seen_keys.add(key)
    return tuple(titles)


def resolve_explicit_document_ids(
    question: str,
    documents: Sequence[RetrievalDocumentRef],
) -> tuple[int, ...]:
    """Resolve every explicit title uniquely inside the caller-provided document scope."""
    document_ids_by_title: dict[str, set[int]] = defaultdict(set)
    for document in documents:
        key = _title_match_key(document.filename)
        if key:
            document_ids_by_title[key].add(document.document_id)

    titles = extract_explicit_titles(question)
    if not titles:
        return ()

    resolved: list[int] = []
    seen_document_ids: set[int] = set()
    formal_prefix = _title_match_key(_FORMAL_LAW_PREFIX)
    for title in titles:
        title_key = _title_match_key(title)
        exact_matches = document_ids_by_title.get(title_key, set())
        if exact_matches:
            matches = exact_matches
        else:
            matches = set()
            for document_title, document_ids in document_ids_by_title.items():
                if (
                    document_title.startswith(formal_prefix)
                    and document_title[len(formal_prefix) :] == title_key
                ):
                    matches.update(document_ids)
        if len(matches) != 1:
            return ()
        document_id = next(iter(matches))
        if document_id not in seen_document_ids:
            resolved.append(document_id)
            seen_document_ids.add(document_id)
    return tuple(resolved)


def select_retrieval_candidates(
    question: str,
    candidates: Sequence[CandidateT],
    documents: Sequence[RetrievalDocumentRef],
    top_n: int,
    *,
    document_id_of: Callable[[CandidateT], int],
    chunk_id_of: Callable[[CandidateT], Hashable],
    score_of: Callable[[CandidateT], float],
) -> list[CandidateT]:
    """Select candidates without changing them or performing security and I/O checks.

    The caller remains responsible for tenant, knowledge-base, identity, and active-generation
    validation before passing documents and candidates to this function.
    """
    if type(top_n) is not int or top_n <= 0:
        raise ValueError("top_n must be a positive integer")
    if not candidates:
        return []

    ranked = [
        candidate
        for _, candidate in sorted(
            enumerate(candidates),
            key=lambda item: (-float(score_of(item[1])), item[0]),
        )
    ]
    unique_ranked: list[CandidateT] = []
    seen_chunk_ids: set[Hashable] = set()
    for candidate in ranked:
        chunk_id = chunk_id_of(candidate)
        if chunk_id in seen_chunk_ids:
            continue
        unique_ranked.append(candidate)
        seen_chunk_ids.add(chunk_id)

    resolved_document_ids = resolve_explicit_document_ids(question, documents)
    if not resolved_document_ids:
        return unique_ranked[:top_n]

    if len(resolved_document_ids) == 1:
        document_id = resolved_document_ids[0]
        return [
            candidate
            for candidate in unique_ranked
            if document_id_of(candidate) == document_id
        ][:top_n]

    candidates_by_document: dict[int, deque[CandidateT]] = {
        document_id: deque() for document_id in resolved_document_ids
    }
    for candidate in unique_ranked:
        document_id = document_id_of(candidate)
        if document_id in candidates_by_document:
            candidates_by_document[document_id].append(candidate)

    selected: list[CandidateT] = []
    selected_chunk_ids: set[Hashable] = set()
    round_limit = (top_n + len(resolved_document_ids) - 1) // len(
        resolved_document_ids
    )
    for _ in range(round_limit):
        selected_in_round = False
        for document_id in resolved_document_ids:
            queue = candidates_by_document[document_id]
            if not queue:
                continue
            candidate = queue.popleft()
            selected.append(candidate)
            selected_chunk_ids.add(chunk_id_of(candidate))
            selected_in_round = True
            if len(selected) >= top_n:
                break
        if not selected_in_round:
            break

    if len(selected) < top_n:
        for candidate in unique_ranked:
            chunk_id = chunk_id_of(candidate)
            if chunk_id in selected_chunk_ids:
                continue
            selected.append(candidate)
            selected_chunk_ids.add(chunk_id)
            if len(selected) >= top_n:
                break

    return selected
