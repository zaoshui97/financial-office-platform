"""扫描PDF本地OCR回退的离线测试。"""

import logging
import subprocess
from collections.abc import Callable
from pathlib import Path

import pymupdf
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.core.config import settings
from app.features.rag.chunker import chunk_document
from app.features.rag.models import DocumentChunk, KnowledgeDocument
from app.integrations.document_parser import DocumentParseError, parse_document
from app.integrations.ocr import (
    OCRConcurrencyGate,
    OCRConcurrencyLimitError,
    OCRConfig,
    OCRConfigurationError,
    TesseractOCRRunner,
)


def _config(**overrides) -> OCRConfig:
    values = {
        "executable": "tesseract",
        "languages": "chi_sim+eng",
        "dpi": 150,
        "min_native_text_chars": 20,
        "max_pages": 30,
        "page_timeout_seconds": 30,
        "document_timeout_seconds": 180,
        "max_concurrency": 1,
    }
    values.update(overrides)
    return OCRConfig(**values)


def _pdf(
    path: Path,
    page_texts: list[str],
) -> Path:
    document = pymupdf.open()
    for text in page_texts:
        page = document.new_page(width=300, height=300)
        if text:
            page.insert_text((30, 50), text)
    document.save(path)
    document.close()
    return path


def _pdf_bytes(page_texts: list[str]) -> bytes:
    document = pymupdf.open()
    for text in page_texts:
        page = document.new_page(width=300, height=300)
        if text:
            page.insert_text((30, 50), text)
    content = document.tobytes()
    document.close()
    return content


class FakeTesseract:
    """模拟语言包检查与逐页文本文件输出。"""

    def __init__(
        self,
        page_outputs: list[str],
        *,
        languages: bytes = b"List of available languages (2):\nchi_sim\neng\n",
        failing_page: int | None = None,
        empty_page: int | None = None,
        timeout_page: int | None = None,
        stderr: bytes = b"",
    ) -> None:
        self.page_outputs = list(page_outputs)
        self.languages = languages
        self.failing_page = failing_page
        self.empty_page = empty_page
        self.timeout_page = timeout_page
        self.stderr = stderr
        self.calls: list[list[str]] = []
        self.image_paths: list[Path] = []

    def __call__(self, args: list[str], **kwargs):
        assert kwargs["shell"] is False
        self.calls.append(args)
        if args[1] == "--list-langs":
            return subprocess.CompletedProcess(args, 0, stdout=self.languages, stderr=b"")

        image_path = Path(args[1])
        output_path = Path(args[2]).with_suffix(".txt")
        page_number = int(image_path.stem.split("-")[-1])
        self.image_paths.append(image_path)
        if page_number == self.timeout_page:
            raise subprocess.TimeoutExpired(args, kwargs["timeout"])
        if page_number == self.failing_page:
            return subprocess.CompletedProcess(args, 1, stdout=b"", stderr=self.stderr)
        output = "" if page_number == self.empty_page else self.page_outputs.pop(0)
        output_path.write_text(output, encoding="utf-8")
        return subprocess.CompletedProcess(args, 0, stdout=b"", stderr=b"")


def _runner(
    monkeypatch,
    tmp_path: Path,
    fake: FakeTesseract,
    *,
    config: OCRConfig | None = None,
    clock: Callable[[], float] | None = None,
    gate: OCRConcurrencyGate | None = None,
) -> TesseractOCRRunner:
    monkeypatch.setattr("app.integrations.ocr.shutil.which", lambda _name: "tesseract")
    monkeypatch.setattr("app.integrations.ocr.subprocess.run", fake)
    temp_root = tmp_path / "ocr-temp"
    temp_root.mkdir(exist_ok=True)
    kwargs = {"temp_root": temp_root}
    if clock is not None:
        kwargs["clock"] = clock
    if gate is not None:
        kwargs["gate"] = gate
    return TesseractOCRRunner(config or _config(), **kwargs)


def _authorize(client: TestClient) -> dict[str, str]:
    client.post(
        "/api/v1/auth/register",
        json={
            "username": "ocr_upload_user",
            "email": "ocr-upload@example.com",
            "password": "DemoPass123!",
        },
    )
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "ocr_upload_user", "password": "DemoPass123!"},
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _create_knowledge_base(client: TestClient, headers: dict[str, str]) -> int:
    response = client.post(
        "/api/v1/rag/knowledge-bases",
        headers=headers,
        json={"name": "OCR测试库"},
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_ocr_disabled_preserves_scanned_pdf_failure(monkeypatch, tmp_path) -> None:
    path = _pdf(tmp_path / "scan.pdf", [""])
    monkeypatch.setattr(settings, "PDF_OCR_ENABLED", False)
    monkeypatch.setattr(
        "app.integrations.ocr.subprocess.run",
        lambda *_args, **_kwargs: pytest.fail("OCR关闭时不得调用Tesseract"),
    )

    with pytest.raises(DocumentParseError, match="扫描PDF请先进行OCR"):
        parse_document(path)


def test_pure_scanned_pdf_uses_sequential_ocr_and_cleans_temp_files(
    monkeypatch,
    tmp_path,
) -> None:
    path = _pdf(tmp_path / "scan.pdf", ["", ""])
    fake = FakeTesseract(["第一页第一段\n第一页第二段", "第二页内容"])
    runner = _runner(monkeypatch, tmp_path, fake)
    monkeypatch.setattr(settings, "PDF_OCR_ENABLED", True)

    parsed = parse_document(path, ocr_runner=runner)

    assert [segment.page_number for segment in parsed.segments] == [1, 1, 2]
    assert [segment.paragraph_index for segment in parsed.segments] == [0, 1, 2]
    assert all(segment.metadata["extraction_method"] == "ocr" for segment in parsed.segments)
    assert [call[1] for call in fake.calls] == ["--list-langs", *map(str, fake.image_paths)]
    assert all(not image_path.exists() for image_path in fake.image_paths)
    assert list((tmp_path / "ocr-temp").iterdir()) == []


def test_native_text_pdf_does_not_call_ocr(monkeypatch, tmp_path) -> None:
    path = _pdf(tmp_path / "native.pdf", ["Native financial policy text long enough"])
    fake = FakeTesseract([])
    runner = _runner(monkeypatch, tmp_path, fake)
    monkeypatch.setattr(settings, "PDF_OCR_ENABLED", True)

    parsed = parse_document(path, ocr_runner=runner)

    assert "financial policy" in parsed.text
    assert fake.calls == []
    assert parsed.segments[0].metadata == {"source_type": "pdf"}


def test_mixed_pdf_only_ocrs_required_page(monkeypatch, tmp_path) -> None:
    path = _pdf(tmp_path / "mixed.pdf", ["Native page text long enough for direct use", ""])
    fake = FakeTesseract(["扫描页内容"])
    runner = _runner(monkeypatch, tmp_path, fake)
    monkeypatch.setattr(settings, "PDF_OCR_ENABLED", True)

    parsed = parse_document(path, ocr_runner=runner)

    assert [segment.page_number for segment in parsed.segments] == [1, 2]
    assert parsed.segments[0].metadata == {"source_type": "pdf"}
    assert parsed.segments[1].metadata["extraction_method"] == "ocr"
    assert len(fake.calls) == 2


def test_mixed_pdf_over_document_page_limit_counts_only_ocr_candidates(
    monkeypatch,
    tmp_path,
) -> None:
    native_pages = [
        f"Native financial policy page {page_number} has sufficient searchable text"
        for page_number in range(1, 31)
    ]
    path = _pdf(tmp_path / "mixed-31-pages.pdf", [*native_pages, "short"])
    fake = FakeTesseract(["第三十一页识别内容"])
    runner = _runner(monkeypatch, tmp_path, fake, config=_config(max_pages=30))
    monkeypatch.setattr(settings, "PDF_OCR_ENABLED", True)

    parsed = parse_document(path, ocr_runner=runner)
    chunks = chunk_document(parsed, chunk_size=1000, overlap=150)

    assert parsed.page_count == 31
    assert [segment.page_number for segment in parsed.segments] == list(range(1, 32))
    assert parsed.segments[-1].metadata["extraction_method"] == "ocr"
    assert [Path(call[1]).stem for call in fake.calls[1:]] == ["page-31"]
    assert {page for chunk in chunks for page in chunk.metadata["page_numbers"]} == set(
        range(1, 32)
    )


def test_low_native_text_uses_ocr_threshold(monkeypatch, tmp_path) -> None:
    path = _pdf(tmp_path / "low-text.pdf", ["short"])
    fake = FakeTesseract(["完整识别文本"])
    runner = _runner(monkeypatch, tmp_path, fake)
    monkeypatch.setattr(settings, "PDF_OCR_ENABLED", True)

    parsed = parse_document(path, ocr_runner=runner)

    assert parsed.text == "完整识别文本"
    assert parsed.segments[0].metadata["extraction_method"] == "ocr"


def test_ocr_page_numbers_flow_into_chunk_metadata(monkeypatch, tmp_path) -> None:
    path = _pdf(tmp_path / "pages.pdf", ["", ""])
    fake = FakeTesseract(["第一页甲乙丙丁", "第二页戊己庚辛"])
    runner = _runner(monkeypatch, tmp_path, fake)
    monkeypatch.setattr(settings, "PDF_OCR_ENABLED", True)

    parsed = parse_document(path, ocr_runner=runner)
    chunks = chunk_document(parsed, chunk_size=8, overlap=0)

    assert {page for chunk in chunks for page in chunk.metadata["page_numbers"]} == {1, 2}
    assert all(chunk.metadata["source_type"] == "pdf" for chunk in chunks)


def test_ocr_rejects_document_over_page_limit(monkeypatch, tmp_path) -> None:
    path = _pdf(tmp_path / "too-many.pdf", ["", ""])
    fake = FakeTesseract([])
    runner = _runner(monkeypatch, tmp_path, fake, config=_config(max_pages=1))
    monkeypatch.setattr(settings, "PDF_OCR_ENABLED", True)

    with pytest.raises(DocumentParseError, match="OCR_PAGE_LIMIT_EXCEEDED"):
        parse_document(path, ocr_runner=runner)

    assert fake.calls == []


def test_ocr_rejects_31_candidate_pages_before_tesseract(monkeypatch, tmp_path) -> None:
    path = _pdf(tmp_path / "31-scanned-pages.pdf", [""] * 31)
    fake = FakeTesseract([])
    runner = _runner(monkeypatch, tmp_path, fake, config=_config(max_pages=30))
    monkeypatch.setattr(settings, "PDF_OCR_ENABLED", True)

    with pytest.raises(DocumentParseError, match="OCR_PAGE_LIMIT_EXCEEDED"):
        parse_document(path, ocr_runner=runner)

    assert fake.calls == []


def test_ocr_page_timeout_is_safe(monkeypatch, tmp_path) -> None:
    path = _pdf(tmp_path / "timeout.pdf", [""])
    fake = FakeTesseract([], timeout_page=1)
    runner = _runner(
        monkeypatch,
        tmp_path,
        fake,
        config=_config(page_timeout_seconds=1, document_timeout_seconds=100),
    )
    monkeypatch.setattr(settings, "PDF_OCR_ENABLED", True)

    with pytest.raises(DocumentParseError, match="OCR_PAGE_TIMEOUT"):
        parse_document(path, ocr_runner=runner)


def test_ocr_document_timeout_is_enforced(monkeypatch, tmp_path) -> None:
    path = _pdf(tmp_path / "document-timeout.pdf", [""])
    fake = FakeTesseract([])
    times = iter([0.0, 0.0, 0.0, 2.0])
    runner = _runner(
        monkeypatch,
        tmp_path,
        fake,
        config=_config(document_timeout_seconds=1),
        clock=lambda: next(times, 2.0),
    )
    monkeypatch.setattr(settings, "PDF_OCR_ENABLED", True)

    with pytest.raises(DocumentParseError, match="OCR_DOCUMENT_TIMEOUT"):
        parse_document(path, ocr_runner=runner)


def test_ocr_missing_executable_is_safe(monkeypatch, tmp_path) -> None:
    path = _pdf(tmp_path / "missing.pdf", [""])
    monkeypatch.setattr("app.integrations.ocr.shutil.which", lambda _name: None)
    runner = TesseractOCRRunner(_config(), temp_root=tmp_path)
    monkeypatch.setattr(settings, "PDF_OCR_ENABLED", True)

    with pytest.raises(DocumentParseError, match="OCR_EXECUTABLE_NOT_FOUND"):
        parse_document(path, ocr_runner=runner)


def test_ocr_missing_language_pack_is_safe(monkeypatch, tmp_path) -> None:
    path = _pdf(tmp_path / "language.pdf", [""])
    fake = FakeTesseract([], languages=b"List of available languages (1):\neng\n")
    runner = _runner(monkeypatch, tmp_path, fake)
    monkeypatch.setattr(settings, "PDF_OCR_ENABLED", True)

    with pytest.raises(DocumentParseError, match="OCR_LANGUAGE_UNAVAILABLE"):
        parse_document(path, ocr_runner=runner)


def test_ocr_nonzero_exit_does_not_expose_stderr(monkeypatch, tmp_path, caplog) -> None:
    path = _pdf(tmp_path / "private-customer-file.pdf", [""])
    secret = "客户正文与C:\\sensitive\\private.pdf"
    fake = FakeTesseract([], failing_page=1, stderr=secret.encode("utf-8"))
    runner = _runner(monkeypatch, tmp_path, fake)
    monkeypatch.setattr(settings, "PDF_OCR_ENABLED", True)

    with caplog.at_level(logging.INFO), pytest.raises(
        DocumentParseError,
        match="OCR_PROCESS_FAILED",
    ):
        parse_document(path, ocr_runner=runner)

    assert secret not in caplog.text
    assert str(path) not in caplog.text
    assert list((tmp_path / "ocr-temp").iterdir()) == []


def test_ocr_empty_output_is_rejected(monkeypatch, tmp_path) -> None:
    path = _pdf(tmp_path / "empty-output.pdf", [""])
    fake = FakeTesseract(["unused"], empty_page=1)
    runner = _runner(monkeypatch, tmp_path, fake)
    monkeypatch.setattr(settings, "PDF_OCR_ENABLED", True)

    with pytest.raises(DocumentParseError, match="OCR_EMPTY_OUTPUT"):
        parse_document(path, ocr_runner=runner)


def test_ocr_concurrency_gate_times_out() -> None:
    gate = OCRConcurrencyGate()

    with gate.slot(1, 1):
        with pytest.raises(OCRConcurrencyLimitError):
            with gate.slot(1, 0.01):
                pytest.fail("并发槽位不应被重复获取")


@pytest.mark.parametrize(
    "config",
    [
        _config(languages="chi sim"),
        _config(dpi=71),
        _config(max_pages=0),
        _config(page_timeout_seconds=0),
        _config(document_timeout_seconds=0),
        _config(max_concurrency=0),
    ],
)
def test_ocr_configuration_is_validated(config: OCRConfig) -> None:
    with pytest.raises(OCRConfigurationError):
        TesseractOCRRunner(config)


def test_ocr_logs_only_statistics(monkeypatch, tmp_path, caplog) -> None:
    path = _pdf(tmp_path / "sensitive-policy.pdf", [""])
    secret = "禁止写入日志的监管正文"
    fake = FakeTesseract([secret])
    runner = _runner(monkeypatch, tmp_path, fake)
    monkeypatch.setattr(settings, "PDF_OCR_ENABLED", True)

    with caplog.at_level(logging.INFO):
        parse_document(path, ocr_runner=runner)

    assert "PDF OCR完成" in caplog.text
    assert secret not in caplog.text
    assert str(path) not in caplog.text


def test_ocr_upload_failure_leaves_no_partial_chunks(
    client: TestClient,
    db_session,
    monkeypatch,
    tmp_path,
    caplog,
) -> None:
    headers = _authorize(client)
    knowledge_base_id = _create_knowledge_base(client, headers)
    monkeypatch.setattr(settings, "STORAGE_DIR", tmp_path / "uploads")
    monkeypatch.setattr(settings, "PDF_OCR_ENABLED", True)
    monkeypatch.setattr(settings, "PDF_OCR_DPI", 150)
    secret = "不应记录的OCR正文或路径"
    fake = FakeTesseract(["第一页已识别"], failing_page=2, stderr=secret.encode())
    monkeypatch.setattr("app.integrations.ocr.shutil.which", lambda _name: "tesseract")
    monkeypatch.setattr("app.integrations.ocr.subprocess.run", fake)

    with caplog.at_level(logging.WARNING):
        response = client.post(
            f"/api/v1/rag/knowledge-bases/{knowledge_base_id}/documents",
            headers=headers,
            files={"file": ("扫描制度.pdf", _pdf_bytes(["", ""]), "application/pdf")},
        )

    assert response.status_code == 422
    document = db_session.scalar(select(KnowledgeDocument))
    assert document is not None
    assert document.status == "failed"
    assert "OCR_PROCESS_FAILED" in (document.error_message or "")
    assert db_session.scalar(select(func.count(DocumentChunk.id))) == 0
    assert secret not in caplog.text
    assert "第一页已识别" not in caplog.text
