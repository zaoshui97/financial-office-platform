"""一次性迁移脚本：给 attachments 加 preview_token 字段。"""
import pymysql
import sys

conn = pymysql.connect(host='127.0.0.1', port=3306, user='root', password='801333',
                       database='financial_office', charset='utf8mb4')
cur = conn.cursor()

# 1. 追加字段（已存在则忽略）
stmts = [
    "ALTER TABLE attachments ADD COLUMN preview_token VARCHAR(64) NULL COMMENT '24h 临时预览 token'",
    "ALTER TABLE attachments ADD COLUMN preview_expires_at DATETIME NULL COMMENT '预览 token 过期时间'",
    "CREATE INDEX idx_attachment_preview_token ON attachments (preview_token)",
]
for s in stmts:
    try:
        cur.execute(s)
        print(f"OK: {s[:60]}...")
    except Exception as e:
        msg = str(e)
        if 'Duplicate column' in msg or 'Duplicate key' in msg or 'already exists' in msg:
            print(f"  skip: {msg[:80]}")
        else:
            print(f"ERR: {msg}", file=sys.stderr)
            raise

conn.commit()

# 2. 验证列结构
cur.execute("DESCRIBE attachments")
print("\n=== attachments 表结构 ===")
for row in cur.fetchall():
    print(" ", row)

# 3. 看看现有附件是否都有 token（没有就回填）
cur.execute("SELECT COUNT(*) FROM attachments WHERE preview_token IS NULL")
n_null = cur.fetchone()[0]
print(f"\n附件 preview_token 为空的: {n_null}")
if n_null > 0:
    from datetime import datetime, timedelta
    import secrets
    rows_to_fill = []
    cur.execute("SELECT id FROM attachments WHERE preview_token IS NULL")
    for (aid,) in cur.fetchall():
        rows_to_fill.append((secrets.token_urlsafe(32), datetime.utcnow() + timedelta(hours=24), aid))
    cur.executemany("UPDATE attachments SET preview_token=%s, preview_expires_at=%s WHERE id=%s", rows_to_fill)
    conn.commit()
    print(f"  已回填 {len(rows_to_fill)} 条")

cur.close()
conn.close()
print("\n迁移完成 ✓")
