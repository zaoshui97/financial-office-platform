"""沙箱熔断器（Kill Switch）。

三种触发方式（任一触发即熔断）：
1. 环境变量  SANDBOX_KILL_SWITCH=true
2. 文件标记  .sandbox_killed（运维一键 touch）
3. 动态 API  kill_switch.activate(reason)

关键设计：
- 单例：整个进程只有一份状态
- 5 秒缓存：避免每次调用都读文件 / 查环境变量
- 三层触发：env（最优先）→ file → memory
- fail-safe：所有检查失败时默认不熔断（不阻塞业务）
"""

from __future__ import annotations

import os
import time
from pathlib import Path
from threading import Lock
from typing import ClassVar

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# 运维标记文件（项目根目录）
_KILL_FILE = Path(".sandbox_killed")

# 缓存 TTL（秒）
_CACHE_TTL = 5.0


class KillSwitch:
    """沙箱熔断器（进程单例）。"""

    _instance: ClassVar["KillSwitch | None"] = None
    _lock: ClassVar[Lock] = Lock()

    def __new__(cls) -> "KillSwitch":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._init()
        return cls._instance

    def __init__(self) -> None:
        # 单例属性已由 __new__ 保证，重复 __init__ 无害
        pass

    def _init(self) -> None:
        self._cache: dict = {
            "active": False,
            "reason": None,
            "checked_at": 0.0,
        }

    # ---- public ----

    def is_active(self) -> bool:
        """是否处于熔断状态（有缓存，5s 内复用）。"""
        if time.time() - self._cache["checked_at"] < _CACHE_TTL:
            return self._cache["active"]

        # 1) 环境变量（最高优先级）
        env_val = os.environ.get("SANDBOX_KILL_SWITCH", "").strip().lower()
        if env_val == "true":
            self._set_cache(True, "env:SANDBOX_KILL_SWITCH")
            return True

        # 2) 文件标记（运维快速熔断）
        if _KILL_FILE.exists():
            reason = self._read_kill_file_reason()
            self._set_cache(True, f"file:{_KILL_FILE.absolute()}|{reason}")
            return True

        # 3) 内存标记（API 触发）
        if self._cache["active"] and self._cache["reason"] and not self._cache["reason"].startswith("env:"):
            # 内存中已是 active（上次 API 触发），且未过期
            if time.time() - self._cache["checked_at"] < _CACHE_TTL:
                return True

        # 4) 全部正常
        self._set_cache(False, None)
        return False

    def activate(self, reason: str = "manual") -> None:
        """手动开启熔断（API / 运维）。"""
        # 同时写文件标记（进程重启后仍生效）
        try:
            _KILL_FILE.write_text(
                f"reason={reason}\nactivated_at={time.time()}\n",
                encoding="utf-8",
            )
        except OSError as exc:
            logger.warning("KillSwitch 无法写入标记文件: %s", exc)
        self._set_cache(True, f"api:{reason}")
        logger.warning("KillSwitch 已激活 | reason=%s", reason)

    def deactivate(self) -> None:
        """手动关闭熔断。"""
        try:
            if _KILL_FILE.exists():
                _KILL_FILE.unlink()
        except OSError as exc:
            logger.warning("KillSwitch 无法删除标记文件: %s", exc)
        self._set_cache(False, None)
        logger.info("KillSwitch 已关闭")

    @property
    def reason(self) -> str | None:
        """当前熔断原因（无熔断时返回 None）。"""
        if self._cache["active"]:
            return self._cache["reason"]
        return None

    # ---- private ----

    def _set_cache(self, active: bool, reason: str | None) -> None:
        self._cache = {
            "active": active,
            "reason": reason,
            "checked_at": time.time(),
        }

    @staticmethod
    def _read_kill_file_reason() -> str:
        """读取标记文件第一行 reason 字段。"""
        try:
            content = _KILL_FILE.read_text(encoding="utf-8")
            for line in content.splitlines():
                if line.startswith("reason="):
                    return line[len("reason="):].strip()
        except OSError:
            pass
        return "unknown"


# 全局单例（模块级，方便各处直接 import）
kill_switch = KillSwitch()


__all__ = ["KillSwitch", "kill_switch"]
