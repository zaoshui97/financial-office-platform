"""使用本地Tesseract CLI同步识别扫描PDF页面。"""

import re
import shutil
import subprocess
import tempfile
import threading
import time
from collections.abc import Callable, Iterator, Sequence
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path

import pymupdf

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_LANGUAGES_PATTERN = re.compile(r"^[A-Za-z0-9_]+(?:\+[A-Za-z0-9_]+)*$")
_MAX_RENDERED_PIXELS = 40_000_000
_MAX_OCR_TEXT_BYTES = 5 * 1024 * 1024


class OCRError(RuntimeError):
    """不包含正文、命令输出或本地路径的OCR安全错误。"""

    code = "OCR_ERROR"


class OCRConfigurationError(OCRError):
    """OCR配置不满足安全约束。"""

    code = "OCR_CONFIGURATION_INVALID"


class OCRExecutableNotFoundError(OCRError):
    """本地Tesseract不可用。"""

    code = "OCR_EXECUTABLE_NOT_FOUND"


class OCRLanguageUnavailableError(OCRError):
    """所需Tesseract语言包不可用。"""

    code = "OCR_LANGUAGE_UNAVAILABLE"


class OCRPageLimitError(OCRError):
    """实际待OCR页数超过同步处理限制。"""

    code = "OCR_PAGE_LIMIT_EXCEEDED"


class OCRPageTimeoutError(OCRError):
    """单页OCR超过限制。"""

    code = "OCR_PAGE_TIMEOUT"


class OCRDocumentTimeoutError(OCRError):
    """文档OCR超过总时限。"""

    code = "OCR_DOCUMENT_TIMEOUT"


class OCRConcurrencyLimitError(OCRError):
    """OCR并发槽位在总时限内不可用。"""

    code = "OCR_CONCURRENCY_LIMIT"


class OCRProcessError(OCRError):
    """Tesseract进程未成功完成。"""

    code = "OCR_PROCESS_FAILED"


class OCREmptyOutputError(OCRError):
    """Tesseract没有返回可用文本。"""

    code = "OCR_EMPTY_OUTPUT"


@dataclass(frozen=True)
class OCRConfig:
    """本地OCR的受限运行参数。"""

    executable: str
    languages: str
    dpi: int
    min_native_text_chars: int
    max_pages: int
    page_timeout_seconds: float
    document_timeout_seconds: float
    max_concurrency: int

    @classmethod
    def from_settings(cls) -> "OCRConfig":
        """从应用配置构造OCR参数。"""
        return cls(
            executable=settings.PDF_OCR_EXECUTABLE,
            languages=settings.PDF_OCR_LANGUAGES,
            dpi=settings.PDF_OCR_DPI,
            min_native_text_chars=settings.PDF_OCR_MIN_NATIVE_TEXT_CHARS,
            max_pages=settings.PDF_OCR_MAX_PAGES,
            page_timeout_seconds=settings.PDF_OCR_PAGE_TIMEOUT_SECONDS,
            document_timeout_seconds=settings.PDF_OCR_DOCUMENT_TIMEOUT_SECONDS,
            max_concurrency=settings.PDF_OCR_MAX_CONCURRENCY,
        )

    def validate(self) -> None:
        """在调用系统进程前验证所有边界。"""
        executable = self.executable.strip()
        if not executable or any(ord(character) < 32 for character in executable):
            raise OCRConfigurationError("OCR可执行文件配置无效")
        if _LANGUAGES_PATTERN.fullmatch(self.languages) is None:
            raise OCRConfigurationError("OCR语言配置无效")
        if not 72 <= self.dpi <= 600:
            raise OCRConfigurationError("OCR DPI超出允许范围")
        if not 0 <= self.min_native_text_chars <= 10000:
            raise OCRConfigurationError("OCR原生文本阈值超出允许范围")
        if not 1 <= self.max_pages <= 1000:
            raise OCRConfigurationError("OCR页数限制无效")
        if not 0 < self.page_timeout_seconds <= 300:
            raise OCRConfigurationError("OCR单页超时无效")
        if not 0 < self.document_timeout_seconds <= 3600:
            raise OCRConfigurationError("OCR文档超时无效")
        if not 1 <= self.max_concurrency <= 8:
            raise OCRConfigurationError("OCR并发限制无效")


@dataclass(frozen=True)
class OCRPageResult:
    """单页OCR文本及非敏感统计。"""

    page_number: int
    text: str
    nonempty_line_count: int
    latency_ms: float


class OCRConcurrencyGate:
    """进程内动态并发门，等待时间计入文档总超时。"""

    def __init__(self) -> None:
        self._condition = threading.Condition()
        self._active = 0

    @contextmanager
    def slot(self, limit: int, timeout: float) -> Iterator[None]:
        """在限定时间内获取一个OCR文档执行槽位。"""
        deadline = time.monotonic() + timeout
        with self._condition:
            while self._active >= limit:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise OCRConcurrencyLimitError("OCR并发槽位不可用")
                self._condition.wait(remaining)
            self._active += 1
        try:
            yield
        finally:
            with self._condition:
                self._active -= 1
                self._condition.notify()


_OCR_CONCURRENCY_GATE = OCRConcurrencyGate()


class TesseractOCRRunner:
    """顺序渲染PDF页面并通过Tesseract CLI提取文本。"""

    def __init__(
        self,
        config: OCRConfig | None = None,
        *,
        temp_root: Path | None = None,
        clock: Callable[[], float] = time.monotonic,
        gate: OCRConcurrencyGate = _OCR_CONCURRENCY_GATE,
    ) -> None:
        self.config = config or OCRConfig.from_settings()
        self.temp_root = temp_root
        self._clock = clock
        self._gate = gate
        self.config.validate()

    def _resolve_executable(self) -> str:
        configured = self.config.executable.strip()
        contains_separator = any(separator in configured for separator in ("/", "\\"))
        if contains_separator:
            path = Path(configured)
            if not path.is_absolute() or not path.is_file():
                raise OCRExecutableNotFoundError("本地Tesseract不可用")
            return str(path)
        resolved = shutil.which(configured)
        if resolved is None:
            raise OCRExecutableNotFoundError("本地Tesseract不可用")
        return resolved

    def _remaining(self, deadline: float) -> float:
        remaining = deadline - self._clock()
        if remaining <= 0:
            raise OCRDocumentTimeoutError("文档OCR超过总时限")
        return remaining

    def _run_language_check(self, executable: str, deadline: float) -> None:
        timeout = min(self.config.page_timeout_seconds, self._remaining(deadline))
        try:
            result = subprocess.run(
                [executable, "--list-langs"],
                stdin=subprocess.DEVNULL,
                capture_output=True,
                check=False,
                shell=False,
                timeout=timeout,
            )
        except FileNotFoundError as exc:
            raise OCRExecutableNotFoundError("本地Tesseract不可用") from exc
        except subprocess.TimeoutExpired as exc:
            raise OCRDocumentTimeoutError("OCR语言包检查超时") from exc
        if result.returncode != 0:
            raise OCRProcessError("Tesseract语言包检查失败")
        raw_languages = result.stdout + b"\n" + result.stderr
        available = {
            line.strip()
            for line in raw_languages.decode("utf-8", errors="ignore").splitlines()
            if line.strip() and not line.lower().startswith("list of available languages")
        }
        required = set(self.config.languages.split("+"))
        if not required.issubset(available):
            raise OCRLanguageUnavailableError("Tesseract语言包不可用")

    def _render_page(self, page: pymupdf.Page, image_path: Path) -> None:
        scale = self.config.dpi / 72
        projected_pixels = int(page.rect.width * scale) * int(page.rect.height * scale)
        if projected_pixels > _MAX_RENDERED_PIXELS:
            raise OCRProcessError("PDF页面渲染尺寸超过限制")
        pixmap = page.get_pixmap(
            dpi=self.config.dpi,
            colorspace=pymupdf.csRGB,
            alpha=False,
        )
        try:
            pixmap.save(str(image_path))
        finally:
            del pixmap

    def _ocr_page(
        self,
        executable: str,
        page: pymupdf.Page,
        page_number: int,
        temp_dir: Path,
        deadline: float,
    ) -> OCRPageResult:
        started = self._clock()
        page_deadline = started + self.config.page_timeout_seconds
        image_path = temp_dir / f"page-{page_number}.png"
        output_base = temp_dir / f"page-{page_number}-ocr"
        output_path = output_base.with_suffix(".txt")
        self._render_page(page, image_path)
        document_remaining = self._remaining(deadline)
        page_remaining = page_deadline - self._clock()
        if page_remaining <= 0:
            image_path.unlink(missing_ok=True)
            raise OCRPageTimeoutError("单页OCR超过限制")
        timeout = min(page_remaining, document_remaining)
        document_limited = document_remaining <= page_remaining
        try:
            result = subprocess.run(
                [
                    executable,
                    str(image_path),
                    str(output_base),
                    "-l",
                    self.config.languages,
                    "--dpi",
                    str(self.config.dpi),
                    "--psm",
                    "6",
                ],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
                shell=False,
                timeout=timeout,
            )
        except FileNotFoundError as exc:
            raise OCRExecutableNotFoundError("本地Tesseract不可用") from exc
        except subprocess.TimeoutExpired as exc:
            if document_limited:
                raise OCRDocumentTimeoutError("文档OCR超过总时限") from exc
            raise OCRPageTimeoutError("单页OCR超过限制") from exc
        finally:
            image_path.unlink(missing_ok=True)
        if result.returncode != 0:
            raise OCRProcessError("Tesseract识别失败")
        if not output_path.is_file():
            raise OCREmptyOutputError("Tesseract没有生成文本")
        if output_path.stat().st_size > _MAX_OCR_TEXT_BYTES:
            raise OCRProcessError("Tesseract文本输出超过限制")
        try:
            text = output_path.read_bytes().decode("utf-8-sig", errors="strict").strip()
        except UnicodeDecodeError as exc:
            raise OCRProcessError("Tesseract文本编码无效") from exc
        finally:
            output_path.unlink(missing_ok=True)
        if not text:
            raise OCREmptyOutputError("Tesseract没有返回可用文本")
        self._remaining(deadline)
        if self._clock() >= page_deadline:
            raise OCRPageTimeoutError("单页OCR超过限制")
        return OCRPageResult(
            page_number=page_number,
            text=text,
            nonempty_line_count=sum(1 for line in text.splitlines() if line.strip()),
            latency_ms=round((self._clock() - started) * 1000, 2),
        )

    def extract_pages(
        self,
        document: pymupdf.Document,
        page_numbers: Sequence[int],
    ) -> dict[int, OCRPageResult]:
        """在一个并发槽位中按页串行OCR，不改写原PDF。"""
        requested_pages = list(page_numbers)
        if not requested_pages:
            return {}
        if requested_pages != sorted(set(requested_pages)) or any(
            page_number < 1 or page_number > document.page_count
            for page_number in requested_pages
        ):
            raise OCRConfigurationError("OCR页码请求无效")
        if len(requested_pages) > self.config.max_pages:
            raise OCRPageLimitError("待OCR页数超过同步OCR限制")

        started = self._clock()
        deadline = started + self.config.document_timeout_seconds
        executable = self._resolve_executable()
        results: dict[int, OCRPageResult] = {}
        with self._gate.slot(
            self.config.max_concurrency,
            self._remaining(deadline),
        ):
            self._run_language_check(executable, deadline)
            with tempfile.TemporaryDirectory(
                prefix="financial-office-ocr-",
                dir=self.temp_root,
            ) as directory:
                temp_dir = Path(directory)
                for page_number in requested_pages:
                    self._remaining(deadline)
                    results[page_number] = self._ocr_page(
                        executable,
                        document.load_page(page_number - 1),
                        page_number,
                        temp_dir,
                        deadline,
                    )
        logger.info(
            "PDF OCR完成 | pages=%s lines=%s latency_ms=%.2f",
            len(results),
            sum(result.nonempty_line_count for result in results.values()),
            (self._clock() - started) * 1000,
        )
        return results
