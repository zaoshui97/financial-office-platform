"""邀请码 E2E：主持人生成码 + 队员加入"""
import urllib.request, urllib.parse, json
API = 'http://127.0.0.1:5173/api/v1'

def login(u, p):
    d = urllib.parse.urlencode({'username': u, 'password': p}).encode()
    r = urllib.request.urlopen(urllib.request.Request(
        f'{API}/auth/login', data=d,
        headers={'Content-Type': 'application/x-www-form-urlencoded'}, method='POST'), timeout=5)
    return json.loads(r.read())['access_token']

def http_json(method, path, *, token=None, data=None):
    headers = {}
    body = None
    if data is not None:
        body = json.dumps(data).encode()
        headers['Content-Type'] = 'application/json'
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(API + path, data=body, headers=headers, method=method)
    r = urllib.request.urlopen(req, timeout=8)
    return r.status, json.loads(r.read())

# 1. 主持人 testuser 创建一个会议
t1 = login('testuser', 'Test1234!')
code1, m1 = http_json('POST', '/meetings', token=t1, data={
    'title': '邀请码测试会议',
    'topic': '验证邀请码加入',
    'agenda': '1. 创建会议\n2. 生成邀请码\n3. 队员加入',
})
print(f'[1] testuser 创建会议 id={m1["id"]}')

# 2. 生成邀请码
code2, inv = http_json('POST', f'/meetings/{m1["id"]}/invite?expires_in_days=7', token=t1)
print(f'[2] 生成邀请码 code={inv["invite_code"]} expires_at={inv["expires_at"]}')
invite_code = inv['invite_code']

# 3. testuser 自己用码加入（应该是 joined=False 因为已是主持人）
code3, j = http_json('POST', '/meetings/join', token=t1, data={'code': invite_code})
print(f'[3] 主持人自己加入: joined={j["joined"]} msg={j["message"]}')

# 4. admin_test 用邀请码加入
t2 = login('admin_test', 'admin123')
code4, j2 = http_json('POST', '/meetings/join', token=t2, data={'code': invite_code})
print(f'[4] admin 加入: joined={j2["joined"]} msg={j2["message"]}')

# 5. 错误码
try:
    http_json('POST', '/meetings/join', token=t2, data={'code': 'BADCODE'})
except urllib.error.HTTPError as e:
    print(f'[5] 错误码响应: HTTP {e.code}')

# 6. 重置邀请码
code6, inv2 = http_json('POST', f'/meetings/{m1["id"]}/invite', token=t1)
print(f'[6] 重置邀请码: {inv["invite_code"]} -> {inv2["invite_code"]}')

# 7. 用旧码应失败
try:
    http_json('POST', '/meetings/join', token=t2, data={'code': invite_code})
except urllib.error.HTTPError as e:
    print(f'[7] 旧码: HTTP {e.code}')

# 8. 用新码成功
code8, j3 = http_json('POST', '/meetings/join', token=t2, data={'code': inv2['invite_code']})
print(f'[8] 新码加入: joined={j3["joined"]} msg={j3["message"]}')

print('\n[OK] 邀请码 E2E 完成')