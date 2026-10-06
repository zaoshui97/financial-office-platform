from sqlalchemy import text
import sys
sys.path.insert(0, '.')
from app.core.database import SessionLocal

with SessionLocal() as s:
    rows = s.execute(text('SELECT id, username, email, is_active, is_superuser FROM users')).fetchall()
    print(f'users ({len(rows)}):')
    for r in rows:
        print(' ', tuple(r))
    rows = s.execute(text('SELECT id, name, code FROM organizations')).fetchall()
    print(f'organizations ({len(rows)}):')
    for r in rows:
        print(' ', tuple(r))