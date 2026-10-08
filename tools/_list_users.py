import pymysql

c = pymysql.connect(host='127.0.0.1', port=3306, user='root', password='801333',
                    database='financial_office', charset='utf8mb4')
cur = c.cursor()

cur.execute("SELECT id, username, full_name, is_active FROM users ORDER BY id")
print("=== 现有用户 ===")
for r in cur.fetchall():
    print(f"  id={r[0]:3} username={r[1]:20} name={r[2]:15} active={r[3]}")

c.close()