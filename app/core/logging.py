"""应用日志配置：控制台输出与 JSON 轮转文件统一管理。"""

import json
import logging
import sys
from contextvars import ContextVar
from datetime import UTC, datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any

from app.core.config import settings

request_id_context: ContextVar[str] = ContextVar("request_id", default="-")


class RequestContextFilter(logging.Filter):
    """向每条日志注入当前请求追踪标识。"""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_context.get()
        return True


class JsonFormatter(logging.Formatter):
    """将文件日志格式化为便于日志平台采集的 JSON。"""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", "-"),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def _build_rotating_handler(filename: Path, level: int) -> RotatingFileHandler:
    """创建具有统一轮转策略的文件日志处理器。"""
    handler = RotatingFileHandler(
        filename=filename,
        maxBytes=settings.LOG_MAX_BYTES,
        backupCount=settings.LOG_BACKUP_COUNT,
        encoding="utf-8",
    )
    handler.setLevel(level)
    handler.addFilter(RequestContextFilter())
    handler.setFormatter(JsonFormatter())
    return handler


def setup_logging() -> None:
    """初始化全局日志配置，并避免开发热重载造成重复处理器。"""
    root_logger = logging.getLogger()
    root_logger.setLevel(settings.LOG_LEVEL)
    root_logger.handlers.clear()

    context_filter = RequestContextFilter()
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(settings.LOG_LEVEL)
    console_handler.addFilter(context_filter)
    console_handler.setFormatter(
        logging.Formatter(
            "%(asctime)s | %(levelname)-8s | %(name)s | %(request_id)s | %(message)s",
            "%Y-%m-%d %H:%M:%S",
        )
    )
    root_logger.addHandler(console_handler)

    if settings.LOG_JSON_FILE:
        log_dir = Path(settings.LOG_DIR)
        log_dir.mkdir(parents=True, exist_ok=True)
        root_logger.addHandler(_build_rotating_handler(log_dir / "app.log", logging.INFO))
        root_logger.addHandler(_build_rotating_handler(log_dir / "error.log", logging.ERROR))

    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(
        logging.INFO if settings.DATABASE_ECHO else logging.WARNING
    )


def get_logger(name: str) -> logging.Logger:
    """返回指定名称的标准库 Logger。"""
    return logging.getLogger(name)
