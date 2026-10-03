#!/usr/bin/env sh
# 容器启动脚本：
#   1) 可选地等待 MySQL 就绪
#   2) 可选地自动跑 Alembic 迁移
#   3) 启动 Uvicorn
#
# 通过环境变量控制行为：
#   - RUN_MIGRATIONS_ON_START (default: "true")
#   - WAIT_FOR_DB (default: "true")
#   - DB_WAIT_TIMEOUT (default: 60s)
#   - API_HOST / API_PORT / API_WORKERS (default: 0.0.0.0 / 8000 / 2)

set -eu

RUN_MIGRATIONS_ON_START="${RUN_MIGRATIONS_ON_START:-true}"
WAIT_FOR_DB="${WAIT_FOR_DB:-true}"
DB_WAIT_TIMEOUT="${DB_WAIT_TIMEOUT:-60}"
API_HOST="${API_HOST:-0.0.0.0}"
API_PORT="${API_PORT:-8000}"
API_WORKERS="${API_WORKERS:-2}"

wait_for_db() {
  echo "[start.sh] waiting for MySQL at ${DATABASE_HOST}:${DATABASE_PORT} ..."
  i=0
  while [ "$i" -lt "$DB_WAIT_TIMEOUT" ]; do
    if python - <<'PY'
import os, socket, sys
host = os.environ.get("DATABASE_HOST", "127.0.0.1")
port = int(os.environ.get("DATABASE_PORT", "3306"))
with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
    s.settimeout(2)
    try:
        s.connect((host, port))
        sys.exit(0)
    except OSError:
        sys.exit(1)
PY
    then
      echo "[start.sh] MySQL reachable"
      return 0
    fi
    i=$((i + 1))
    sleep 1
  done
  echo "[start.sh] MySQL not reachable after ${DB_WAIT_TIMEOUT}s" >&2
  return 1
}

if [ "$WAIT_FOR_DB" = "true" ]; then
  wait_for_db
fi

if [ "$RUN_MIGRATIONS_ON_START" = "true" ]; then
  echo "[start.sh] running alembic upgrade head"
  alembic upgrade head
fi

echo "[start.sh] launching uvicorn on ${API_HOST}:${API_PORT} (workers=${API_WORKERS})"
exec uvicorn app.main:app \
  --host "${API_HOST}" \
  --port "${API_PORT}" \
  --workers "${API_WORKERS}" \
  --proxy-headers \
  --forwarded-allow-ips="*"