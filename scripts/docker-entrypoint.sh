#!/bin/sh
set -eu

wait_timeout="${DATABASE_WAIT_TIMEOUT_SECONDS:-120}"

case "$wait_timeout" in
    ''|*[!0-9]*)
        echo "DATABASE_WAIT_TIMEOUT_SECONDS must be a positive integer" >&2
        exit 2
        ;;
esac

if [ "$wait_timeout" -le 0 ]; then
    echo "DATABASE_WAIT_TIMEOUT_SECONDS must be a positive integer" >&2
    exit 2
fi

echo "Waiting for MySQL readiness"
python - "$wait_timeout" <<'PY'
import sys
import time

from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool

from app.core.config import settings

timeout_seconds = int(sys.argv[1])
deadline = time.monotonic() + timeout_seconds
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    poolclass=NullPool,
)

try:
    while True:
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            print("MySQL is ready", flush=True)
            break
        except Exception:
            if time.monotonic() >= deadline:
                print("MySQL readiness timed out", file=sys.stderr, flush=True)
                raise SystemExit(1)
            time.sleep(2)
finally:
    engine.dispose()
PY

echo "Applying Alembic migrations"
alembic upgrade head

echo "Starting API"
exec "$@"
