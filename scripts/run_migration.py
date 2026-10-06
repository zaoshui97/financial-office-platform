"""一次性建 5 张新表（用项目自带的 pymysql 跑 SQL 文件）。

用法：python scripts/run_migration.py
效果：读 migrations/2026_10_06_new_features.sql，用 .env 里的 DB 配置执行。
"""

from __future__ import annotations

import pathlib
import sys

# 把项目根加进 Python 搜索路径（脚本入口必须在项目根或通过子目录调用时显式补）
ROOT_DIR = pathlib.Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import pymysql

from app.core.config import settings

ROOT = ROOT_DIR
SQL_FILE = ROOT / "migrations" / "2026_10_06_new_features.sql"


def main() -> None:
    sql = SQL_FILE.read_text(encoding="utf-8")
    # 拆成单条 statement（按 ; 切，忽略空段和注释）
    statements: list[str] = []
    buf: list[str] = []
    for line in sql.splitlines():
        stripped = line.strip()
        if stripped.startswith("--") or not stripped:
            continue
        buf.append(line)
        if stripped.endswith(";"):
            stmt = "\n".join(buf).rstrip().rstrip(";").strip()
            if stmt:
                statements.append(stmt)
            buf = []

    print(f"即将执行 {len(statements)} 条 DDL ...")
    conn = pymysql.connect(
        host=settings.DATABASE_HOST,
        port=settings.DATABASE_PORT,
        user=settings.DATABASE_USER,
        password=settings.DATABASE_PASSWORD,
        database=settings.DATABASE_NAME,
        charset="utf8mb4",
    )
    try:
        with conn.cursor() as cur:
            for stmt in statements:
                # 取表名做日志
                first_line = stmt.splitlines()[0][:80]
                try:
                    cur.execute(stmt)
                    print(f"  ✓ {first_line}")
                except Exception as exc:
                    # 已存在不报错（脚本幂等）
                    if "already exists" in str(exc).lower() or "1060" in str(exc):
                        print(f"  - {first_line} (已存在，跳过)")
                    else:
                        print(f"  ✗ {first_line}: {exc}")
                        raise
        conn.commit()
        print("\n✅ 5 张表已建（或已存在）")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
