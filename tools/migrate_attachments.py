"""建 attachments 表（一次性脚本）。"""
import pymysql, re

conn = pymysql.connect(host='127.0.0.1', port=3306, user='root', password='801333',
                       database='financial_office', charset='utf8mb4')
cur = conn.cursor()

with open('migrations/2026_10_06_new_features.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# 移除行内注释再分割
sql_no_comment = re.sub(r'--[^\n]*\n', '\n', sql)

executed = 0
for stmt in sql_no_comment.split(';'):
    s = stmt.strip()
    if not s:
        continue
    if 'attachments' in s and 'CREATE TABLE' in s.upper():
        cur.execute(s)
        executed += 1
        print(f'executed: {s[:80]}')

conn.commit()
cur.execute('DESCRIBE attachments')
print('--- table schema ---')
for r in cur.fetchall():
    print(' ', r)
cur.close()
conn.close()
print(f'\n{executed} statements executed.')