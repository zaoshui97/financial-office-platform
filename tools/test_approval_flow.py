"""端到端测试：审批提交流程（Phase 1）"""
import urllib.request, urllib.parse, json, sys

API = 'http://127.0.0.1:8010/api/v1'


def http(method, path, *, token=None, data=None, is_form=False):
    url = API + path
    if data is not None:
        if is_form:
            body = urllib.parse.urlencode(data).encode()
            ctype = 'application/x-www-form-urlencoded'
        else:
            body = json.dumps(data).encode()
            ctype = 'application/json'
    else:
        body = None
        ctype = None
    headers = {}
    if ctype:
        headers['Content-Type'] = ctype
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=5)
        return r.status, json.loads(r.read() or 'null')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]


def login(u, p):
    code, body = http('POST', '/auth/login', data={'username': u, 'password': p}, is_form=True)
    assert code == 200, (code, body)
    return body['access_token']


print('=== Phase 1 端到端：审批流 ===\n')

# 1. testuser 登录
testuser_token = login('testuser', 'Test1234!')
print('1. testuser 登录 OK')

# 2. testuser 创建一条审批
code, body = http('POST', '/approvals',
    token=testuser_token,
    data={'type': 'general', 'title': '部门团建预算申请', 'content': '申请2026年Q4部门团建经费3万元，活动地点：千岛湖。'})
print(f'2. testuser 提交申请: HTTP {code}')
if code == 201:
    my_approval_id = body['id']
    print(f'   → id={my_approval_id}, status={body["status"]}')
else:
    print('   失败：', body)
    sys.exit(1)

# 3. testuser 看自己的列表（应当包含刚才这条）
code, body = http('GET', '/approvals?scope=mine&status=pending', token=testuser_token)
print(f'3. testuser scope=mine&status=pending: HTTP {code}, total={body["total"] if isinstance(body, dict) else "?"}')
assert isinstance(body, dict) and body['total'] >= 1

# 4. testuser 试 scope=all（应当被拒）
code, body = http('GET', '/approvals?scope=all', token=testuser_token)
print(f'4. testuser scope=all（应当 403）: HTTP {code}, body={body[:80] if isinstance(body, str) else body}')
assert code == 403

# 5. admin_test 登录
admin_token = login('admin_test', 'admin123')
print('5. admin_test 登录 OK')

# 6. admin_test scope=all（应当看到刚才那条）
code, body = http('GET', '/approvals?scope=all&status=pending', token=admin_token)
print(f'6. admin scope=all&status=pending: HTTP {code}, total={body["total"] if isinstance(body, dict) else "?"}')
ids = [it['id'] for it in body['items']] if isinstance(body, dict) else []
assert my_approval_id in ids, f'admin 看不到 testuser 提交的 id={my_approval_id} (ids={ids})'
print(f'   admin 看到了 id={my_approval_id} OK')

# 7. testuser 试自批自（应当被拒）
code, body = http('POST', f'/approvals/{my_approval_id}/action',
    token=testuser_token,
    data={'action': 'approve', 'comment': '我审我自己'})
print(f'7. testuser 试自批自（应当 400）: HTTP {code}')
assert code == 400

# 8. admin 通过
code, body = http('POST', f'/approvals/{my_approval_id}/action',
    token=admin_token,
    data={'action': 'approve', 'comment': '准了，注意节俭'})
print(f'8. admin approve: HTTP {code}, body={body[:120] if isinstance(body, str) else body}')
assert code == 200

# 9. testuser 再看自己的（status 应当 = approved）
code, body = http('GET', '/approvals?scope=mine&status=approved', token=testuser_token)
print(f'9. testuser scope=mine&status=approved: HTTP {code}, total={body["total"] if isinstance(body, dict) else "?"}')
assert isinstance(body, dict) and body['total'] >= 1

# 10. 详情 / 流水
code, body = http('GET', f'/approvals/{my_approval_id}/actions', token=testuser_token)
print(f'10. testuser 看流水: HTTP {code}, count={len(body) if isinstance(body, list) else "?"}')
if isinstance(body, list):
    for a in body:
        print(f'    - {a["action"]} by operator={a["operator_id"]} comment={a.get("comment") or ""}')

# 11. 测 dept 维度：把 admin_test 的 department 设为"测试部"，testuser 也设为"测试部"
import pymysql
conn = pymysql.connect(host='127.0.0.1', port=3306, user='root', password='801333',
                       database='financial_office', charset='utf8mb4')
cur = conn.cursor()
cur.execute("UPDATE users SET department='测试部' WHERE id IN (1, 3)")
conn.commit()
cur.close()
conn.close()
print('\n11. 已把 admin_test + testuser 都设为"测试部"（模拟同部门）')

# 12. testuser 再提交一条
code, body = http('POST', '/approvals',
    token=testuser_token,
    data={'type': 'leave', 'title': '请假3天', 'content': '个人原因请假10月8-10日。'})
print(f'12. testuser 提交请假: HTTP {code}')
if code == 201:
    leave_id = body['id']

# 13. testuser 不能用 scope=dept（只是普通员工）
code, body = http('GET', '/approvals?scope=dept', token=testuser_token)
print(f'13. testuser 试 scope=dept（应当 403）: HTTP {code}')

# 14. admin 试 scope=dept
code, body = http('GET', '/approvals?scope=dept&status=pending', token=admin_token)
print(f'14. admin scope=dept&status=pending: HTTP {code}, total={body["total"] if isinstance(body, dict) else "?"}')

# 15. admin 通过请假
if code == 200 and 'leave_id' in dir() and leave_id in [it['id'] for it in body['items']]:
    code, body = http('POST', f'/approvals/{leave_id}/action',
        token=admin_token,
        data={'action': 'approve', 'comment': '准假'})
    print(f'15. admin approve 请假: HTTP {code}')

print('\n=== 全部断言通过 ===')
