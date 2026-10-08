"""一次性脚本：把 wangwu 密码重置为 123456。仅供开发调试用。"""
import sys
sys.path.insert(0, ".")

import pymysql
from app.core.security import hash_password

conn = pymysql.connect(
    host="127.0.0.1", port=3306,
    user="root", password="801333",
    database="financial_office", charset="utf8mb4",
)
cur = conn.cursor()

# 1) 查现状
cur.execute("SELECT id, username, full_name, is_superuser, is_active FROM users WHERE username=%s", ("wangwu",))
row = cur.fetchone()
print(f"现状: {row}")

# 2) 重置密码
new_pw = "123456"
hashed = hash_password(new_pw)
cur.execute("UPDATE users SET hashed_password=%s WHERE username=%s", (hashed, "wangwu"))
conn.commit()
print(f"OK: wangwu 密码已重置为 '{new_pw}', affected rows = {cur.rowcount}")

# 3) 验证
cur.execute("SELECT username, is_active, is_superuser FROM users WHERE username=%s", ("wangwu",))
print(f"重置后: {cur.fetchone()}")

cur.close()
conn.close()
