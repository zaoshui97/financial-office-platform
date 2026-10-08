"""跑会议邀请码迁移（v2：用在 meeting_sessions 表）"""
import pymysql, sys
from pathlib import Path

conn = pymysql.connect(host='127.0.0.1', port=3306, user='root',
                       password='801333', database='financial_office',
                       charset='utf8mb4')
cur = conn.cursor()

sql_path = Path(r"D:\Apexis\financial-office-platform\migrations\2026_10_07_meeting_invite_code.sql")
sql = sql_path.read_text(encoding='utf-8')
lines = [l for l in sql.splitlines() if not l.strip().startswith('--')]
cleaned = '\n'.join(lines)
stmts = [s.strip() for s in cleaned.split(';') if s.strip()]

for i, s in enumerate(stmts, 1):
    print(f'[{i}] {s[:80]}...')
    try:
        cur.execute(s)
        print('   OK')
    except Exception as e:
        if '1054' in str(e) or '1060' in str(e) or '1061' in str(e) or '1091' in str(e):
            # 字段/索引不存在或已存在 → 跳过
            print(f'   跳过 (already handled): {str(e)[:60]}')
            continue
        print(f'   ERR: {e}')
        sys.exit(1)

conn.commit()
print('\n迁移完成')
cur.close()
conn.close()