from sqlalchemy import text
import sys
sys.path.insert(0, '.')
from app.core.database import SessionLocal

with SessionLocal() as s:
    print('--- SCHEMAS ---')
    rows = s.execute(text("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA")).fetchall()
    for r in rows:
        print(' ', r[0])
    print('--- organizations 在哪 ---')
    rows = s.execute(text("SELECT TABLE_SCHEMA, TABLE_NAME FROM information_schema.TABLES WHERE TABLE_NAME='organizations'")).fetchall()
    for r in rows:
        print(' ', tuple(r))
    print('--- users 在哪 ---')
    rows = s.execute(text("SELECT TABLE_SCHEMA, TABLE_NAME FROM information_schema.TABLES WHERE TABLE_NAME='users'")).fetchall()
    for r in rows:
        print(' ', tuple(r))
    print('--- current DB/schema ---')
    print(' ', s.execute(text('SELECT DATABASE()')).scalar(), '/', s.execute(text('SELECT SCHEMA()')).scalar())