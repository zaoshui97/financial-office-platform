"""本地文件存储：安全保存用户上传的企业文档。"""

import re
import unicodedata
from dataclasses import dataclass
from email.header import decode_header
from pathlib import Path
from urllib.parse import unquote_to_bytes
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}
ALLOWED_FILENAME_CHARSETS = {"ascii", "us-ascii", "utf-8", "utf8"}
MAX_ORIGINAL_FILENAME_LENGTH = 255
READ_BUFFER_SIZE = 1024 * 1024
_INVALID_PERCENT_ESCAPE = re.compile(r"%(?![0-9A-Fa-f]{2})")
_PERCENT_ESCAPE = re.compile(r"%[0-9A-Fa-f]{2}")
_RFC2047_FILENAME = re.compile(r"(?:=\?[^?\s]+\?[bBqQ]\?[^?]*\?=\s*)+")
_WINDOWS_DRIVE = re.compile(r"^[A-Za-z]:")


class UploadFilenameError(ValueError):
    """上传文件名无法安全解析或不符合安全约束。"""


def _split_header_parameters(value: str) -> list[str]:
    """按分号拆分Header参数，同时保留引号内分号。"""
    parts: list[str] = []
    current: list[str] = []
    quoted = False
    escaped = False
    for character in value:
        if escaped:
            current.append(character)
            escaped = False
            continue
        if quoted and character == "\\":
            current.append(character)
            escaped = True
            continue
        if character == '"':
            current.append(character)
            quoted = not quoted
            continue
        if character == ";" and not quoted:
            parts.append("".join(current).strip())
            current = []
            continue
        current.append(character)
    if quoted or escaped:
        raise UploadFilenameError("文件名Header格式无效")
    parts.append("".join(current).strip())
    return parts


def _unquote_header_parameter(value: str) -> str:
    """严格移除Header参数引号和反斜杠转义。"""
    if not value.startswith('"'):
        if '"' in value:
            raise UploadFilenameError("文件名Header格式无效")
        return value
    if len(value) < 2 or not value.endswith('"'):
        raise UploadFilenameError("文件名Header格式无效")
    result: list[str] = []
    escaped = False
    for character in value[1:-1]:
        if escaped:
            result.append(character)
            escaped = False
        elif character == "\\":
            escaped = True
        else:
            result.append(character)
    if escaped:
        raise UploadFilenameError("文件名Header格式无效")
    return "".join(result)


def _content_disposition_parameters(value: str | None) -> dict[str, str]:
    """读取原始Content-Disposition参数，不隐式解码扩展参数。"""
    if not value:
        return {}
    if any(character in value for character in ("\x00", "\r", "\n")):
        raise UploadFilenameError("文件名Header包含非法控制字符")
    segments = _split_header_parameters(value)
    parameters: dict[str, str] = {}
    for segment in segments[1:]:
        if not segment:
            continue
        name, separator, raw_value = segment.partition("=")
        normalized_name = name.strip().lower()
        if not separator or not normalized_name:
            raise UploadFilenameError("文件名Header格式无效")
        if normalized_name in parameters:
            raise UploadFilenameError("文件名Header参数重复")
        parameters[normalized_name] = _unquote_header_parameter(raw_value.strip())
    return parameters


def _strict_percent_decode(value: str) -> bytes:
    """严格执行一次百分号解码，拒绝非法转义。"""
    try:
        value.encode("ascii")
    except UnicodeEncodeError as exc:
        raise UploadFilenameError("扩展文件名必须使用ASCII百分号编码") from exc
    if _INVALID_PERCENT_ESCAPE.search(value):
        raise UploadFilenameError("文件名包含非法百分号编码")
    return unquote_to_bytes(value)


def _decode_extended_filename(value: str) -> str:
    """严格解码RFC 5987/8187 UTF-8 filename*。"""
    charset, separator, remainder = value.partition("'")
    _language, second_separator, encoded_value = remainder.partition("'")
    if not separator or not second_separator:
        raise UploadFilenameError("filename*格式无效")
    if charset.strip().lower() not in {"utf-8", "utf8"}:
        raise UploadFilenameError("filename*仅支持UTF-8编码")
    try:
        return _strict_percent_decode(encoded_value).decode("utf-8", errors="strict")
    except UnicodeDecodeError as exc:
        raise UploadFilenameError("filename*不是有效UTF-8") from exc


def _decode_rfc2047_filename(value: str) -> str | None:
    """完整且严格地解码RFC 2047编码词；普通文件名返回空。"""
    if not value.startswith("=?"):
        return None
    if _RFC2047_FILENAME.fullmatch(value) is None:
        raise UploadFilenameError("RFC 2047文件名格式无效")
    try:
        decoded_parts = decode_header(value)
    except (LookupError, ValueError) as exc:
        raise UploadFilenameError("RFC 2047文件名无法解码") from exc
    result: list[str] = []
    for part, charset in decoded_parts:
        if isinstance(part, str):
            result.append(part)
            continue
        normalized_charset = (charset or "ascii").lower()
        if normalized_charset not in ALLOWED_FILENAME_CHARSETS:
            raise UploadFilenameError("RFC 2047文件名编码不受支持")
        try:
            result.append(part.decode(normalized_charset, errors="strict"))
        except (LookupError, UnicodeDecodeError) as exc:
            raise UploadFilenameError("RFC 2047文件名无法解码") from exc
    return "".join(result)


def _reject_path_syntax(value: str) -> None:
    """拒绝绝对路径、路径分隔符、盘符和上级目录。"""
    if "/" in value or "\\" in value:
        raise UploadFilenameError("文件名不能包含路径分隔符")
    if _WINDOWS_DRIVE.match(value) or value in {".", ".."}:
        raise UploadFilenameError("文件名不能包含路径信息")


def _validate_percent_encoded_path(
    value: str,
    *,
    already_percent_decoded: bool,
) -> None:
    """仅为安全检查解码一次，不用解码结果替换真实文件名。"""
    if "%" not in value:
        return
    if _INVALID_PERCENT_ESCAPE.search(value):
        raise UploadFilenameError("文件名包含非法百分号编码")
    if already_percent_decoded:
        if _PERCENT_ESCAPE.search(value):
            raise UploadFilenameError("文件名包含重复百分号编码")
        return
    decoded_bytes = _strict_percent_decode(value)
    try:
        decoded_once = decoded_bytes.decode("utf-8", errors="strict")
    except UnicodeDecodeError as exc:
        raise UploadFilenameError("百分号编码文件名不是有效UTF-8") from exc
    decoded_once = unicodedata.normalize("NFKC", decoded_once)
    if _PERCENT_ESCAPE.search(decoded_once):
        raise UploadFilenameError("文件名包含重复百分号编码")
    _reject_path_syntax(decoded_once)


def parse_upload_filename(
    upload_filename: str | None,
    content_disposition: str | None = None,
) -> str:
    """按明确优先级恢复并安全规范化用户上传文件名。"""
    parameters = _content_disposition_parameters(content_disposition)
    percent_decoded = False
    if "filename*" in parameters:
        candidate = _decode_extended_filename(parameters["filename*"])
        percent_decoded = True
    else:
        header_filename = parameters.get("filename")
        decoded_header = (
            _decode_rfc2047_filename(header_filename) if header_filename else None
        )
        candidate = decoded_header if decoded_header is not None else upload_filename
        if candidate:
            decoded_upload = _decode_rfc2047_filename(candidate)
            if decoded_upload is not None:
                candidate = decoded_upload
    if not candidate:
        raise UploadFilenameError("上传文件名不能为空")

    normalized = unicodedata.normalize("NFKC", candidate)
    if len(normalized) > MAX_ORIGINAL_FILENAME_LENGTH:
        raise UploadFilenameError("上传文件名过长")
    if any(unicodedata.category(character).startswith("C") for character in normalized):
        raise UploadFilenameError("上传文件名包含非法控制字符")
    _reject_path_syntax(normalized)
    _validate_percent_encoded_path(
        normalized,
        already_percent_decoded=percent_decoded,
    )
    return normalized


@dataclass(frozen=True)
class StoredFile:
    """保存后的文件信息。"""

    path: Path
    original_filename: str
    extension: str
    size: int


def save_upload_file(file: UploadFile, user_id: int, knowledge_base_id: int) -> StoredFile:
    """校验文件类型和大小，并使用随机文件名写入本地存储。"""
    try:
        original_filename = parse_upload_filename(
            file.filename,
            file.headers.get("content-disposition"),
        )
    except UploadFilenameError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    extension = Path(original_filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="仅支持PDF、DOCX和TXT文件",
        )

    directory = settings.STORAGE_DIR / str(user_id) / str(knowledge_base_id)
    directory.mkdir(parents=True, exist_ok=True)
    target_path = directory / f"{uuid4()}{extension}"
    max_bytes = settings.RAG_MAX_FILE_SIZE_MB * 1024 * 1024
    total_size = 0

    try:
        with target_path.open("wb") as output:
            while chunk := file.file.read(READ_BUFFER_SIZE):
                total_size += len(chunk)
                if total_size > max_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"文件大小不能超过{settings.RAG_MAX_FILE_SIZE_MB}MB",
                    )
                output.write(chunk)
    except Exception:
        target_path.unlink(missing_ok=True)
        raise
    finally:
        file.file.close()

    if total_size == 0:
        target_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="上传文件不能为空")

    return StoredFile(
        path=target_path,
        original_filename=original_filename,
        extension=extension,
        size=total_size,
    )
