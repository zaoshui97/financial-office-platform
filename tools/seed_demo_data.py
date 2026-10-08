"""固化测试账号状态。

执行后：
  - admin_test → 超级管理员 + 测试部经理
  - testuser   → 普通员工 + 测试部
  - 重建 dev 期间因调试遗留的测试数据
"""
import pymysql

PWD_ADMIN = 'admin123'
PWD_USER = 'Test1234!'

conn = pymysql.connect(host='127.0.0.1', port=3306, user='root', password='801333',
                       database='financial_office', charset='utf8mb4')
cur = conn.cursor()

# 1) 修正 admin_test：超级管理员 + 测试部经理
cur.execute("""
    UPDATE users
    SET is_superuser = 1,
        department = '测试部',
        position = '部门经理',
        full_name = '管理员 测试',
        is_active = 1
    WHERE username = 'admin_test'
""")
print(f'admin_test 状态更新: rows={cur.rowcount}')

# 2) 修正 testuser：普通员工 + 测试部
cur.execute("""
    UPDATE users
    SET is_superuser = 0,
        department = '测试部',
        position = '普通员工',
        full_name = '测试员工',
        is_active = 1
    WHERE username = 'testuser'
""")
print(f'testuser 状态更新: rows={cur.rowcount}')

# 3) 验证
cur.execute("SELECT id, username, is_superuser, department, position, is_active FROM users WHERE username IN ('admin_test','testuser')")
for r in cur.fetchall():
    print(' ', r)

conn.commit()
cur.close()
conn.close()
print('\nseed 完成。下次后端启动即生效。')