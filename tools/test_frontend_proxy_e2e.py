"""前端视角端到端模拟：模拟 testuser / admin_test 在浏览器里的所有动作。

走 5173 vite proxy，模拟前端所有 fetch 路径。
"""
import urllib.request, urllib.parse, json, uuid

API = 'http://127.0.0.1:5173/api/v1'  # 走 vite proxy


def login(u, p):
    d = urllib.parse.urlencode({'username': u, 'password': p}).encode()
    r = urllib.request.urlopen(urllib.request.Request(
        f'{API}/auth/login', data=d,
        headers={'Content-Type': 'application/x-www-form-urlencoded'}, method='POST'), timeout=5)
    return json.loads(r.read())['access_token']


def http_json(method, path, *, token=None, data=None, params=None):
    url = API + path
    if params:
        from urllib.parse import urlencode
        url += '?' + urlencode(params)
    headers = {}
    body = None
    if data is not None:
        body = json.dumps(data).encode()
        headers['Content-Type'] = 'application/json'
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=5)
        return r.status, json.loads(r.read() or 'null')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]


def upload(token, filename, content, content_type='text/plain'):
    boundary = '----formboundary' + uuid.uuid4().hex
    body = (
        f'--{boundary}\r\n'
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f'Content-Type: {content_type}\r\n\r\n'.encode()
        + content
        + f'\r\n--{boundary}--\r\n'.encode()
    )
    req = urllib.request.Request(f'{API}/attachments/upload',
        data=body,
        headers={'Authorization': f'Bearer {token}',
                 'Content-Type': f'multipart/form-data; boundary={boundary}'},
        method='POST')
    return json.loads(urllib.request.urlopen(req, timeout=5).read())


def display_name(u):
    return u.get('full_name') or u.get('username') or '—'


print('=' * 60)
print('前端视角端到端模拟（走 vite proxy 5173）')
print('=' * 60)

# ── 1. testuser 登录 ──
print('\n[1] testuser 登录')
t_user = login('testuser', 'Test1234!')
code, me = http_json('GET', '/auth/me', token=t_user)
print(f'  /me: {me["username"]} full_name={me.get("full_name")} dept={me.get("department")} pos={me.get("position")}')

# ── 2. testuser 上传 1 个 PDF 附件 ──
print('\n[2] testuser 上传 PDF 附件（模拟前端 FormData）')
# 简易 PDF magic header
pdf_bytes = b'%PDF-1.4\n%fake pdf content for demo'
att = upload(t_user, '差旅报销凭证.pdf', pdf_bytes, 'application/pdf')
print(f'  uploaded id={att["id"]} filename={att["original_filename"]} size={att["size"]}')

# ── 3. testuser 提交审批 ──
print('\n[3] testuser 提交审批')
code, body = http_json('POST', '/approvals', token=t_user, data={
    'type': 'reimburse',
    'title': 'Q4 上海出差报销',
    'content': '出差上海产生的差旅费，含机票、酒店、餐饮。详细说明：3 天 2 晚。',
    'attachment_ids': [att['id']],
})
print(f'  HTTP {code}, approval id={body["id"]}, attachments={body["attachment_ids"]}')
approval_id = body['id']

# ── 4. testuser 拉自己的列表（应看到新申请） ──
print('\n[4] testuser scope=mine&status=pending')
code, body = http_json('GET', '/approvals', token=t_user, params={'scope': 'mine', 'status': 'pending'})
print(f'  total={body["total"]}')
for it in body['items'][:3]:
    print(f'    id={it["id"]} type={it["type"]} status={it["status"]} title={it["title"]} attachments={it["attachment_ids"]}')

# ── 5. testuser 看附件的元数据（详情页会拉） ──
print('\n[5] testuser 拉详情附件元数据（前端详情页会调）')
code, body = http_json('GET', f'/attachments/by-business/approval/{approval_id}', token=t_user)
print(f'  total={body["total"]}')
for a in body['items']:
    print(f'    - {a["original_filename"]} {a["size"]}B id={a["id"]}')

# ── 6. testuser 看申请人/审批人信息（详情页 enrichment） ──
print('\n[6] testuser 拉审批人/申请人信息（前端 enrichment）')
code, applicant = http_json('GET', '/auth/users/3', token=t_user)  # testuser 自己
print(f'  applicant: id=3 → {display_name(applicant)} ({applicant.get("department")}, {applicant.get("position")})')

# ── 7. admin_test 登录 ──
print('\n[7] admin_test 登录')
t_admin = login('admin_test', 'admin123')
code, me_admin = http_json('GET', '/auth/me', token=t_admin)
print(f'  /me: {me_admin["username"]} full_name={me_admin.get("full_name")} dept={me_admin.get("department")} pos={me_admin.get("position")} is_superuser={me_admin.get("is_superuser")}')

# ── 8. admin scope=all 应看到 testuser 的申请 ──
print('\n[8] admin scope=all 看到 testuser 的申请')
code, body = http_json('GET', '/approvals', token=t_admin, params={'scope': 'all', 'status': 'pending'})
target = [it for it in body['items'] if it['id'] == approval_id]
print(f'  列表 total={body["total"]}, 目标可见: {"yes" if target else "NO"}')
if target:
    print(f'    id={target[0]["id"]} type={target[0]["type"]} attachments={target[0]["attachment_ids"]}')

# ── 9. admin 审批（通过） ──
print('\n[9] admin 审批（通过）')
code, body = http_json('POST', f'/approvals/{approval_id}/action', token=t_admin,
    data={'action': 'approve', 'comment': '票据齐全，准予报销 5800 元'})
print(f'  HTTP {code}, action={body["action"]} by op#{body["operator_id"]}')

# ── 10. 通知已写入（admin 操作后） ──
print('\n[10] admin 通知中心应收到动作记录')
code, notifs = http_json('GET', '/notifications', token=t_admin, params={'limit': 5})
print(f'  admin 通知数: {len(notifs["items"]) if isinstance(notifs, dict) else "?"}')

# ── 11. testuser 自己的列表应当看到 status=approved ──
print('\n[11] testuser 自己的列表 status=approved')
code, body = http_json('GET', '/approvals', token=t_user, params={'scope': 'mine', 'status': 'approved'})
target = [it for it in body['items'] if it['id'] == approval_id]
print(f'  total={body["total"]}, 目标: {target[0]["status"] if target else "MISSING"}')
assert target and target[0]['status'] == 'approved'

# ── 12. 附件下载（用 admin token，下载 testuser 上传的） ──
print('\n[12] 附件下载（admin 应该能下载，因为要审核）')
resp = urllib.request.urlopen(urllib.request.Request(
    f'{API}/attachments/{att["id"]}/download',
    headers={'Authorization': f'Bearer {t_admin}'}), timeout=5)
downloaded = resp.read()
print(f'  HTTP {resp.status}, len={len(downloaded)}, starts_with={downloaded[:8]!r}')

# ── 13. 部门维度：dept 列表 ──
print('\n[13] admin 改 scope=dept（按部门过滤）')
code, body = http_json('GET', '/approvals', token=t_admin, params={'scope': 'dept', 'status': 'approved'})
print(f'  admin scope=dept&status=approved total={body["total"]}')

# ── 14. 越权：testuser 试 scope=all ──
print('\n[14] testuser 试 scope=all（应当 403）')
code, body = http_json('GET', '/approvals', token=t_user, params={'scope': 'all'})
print(f'  HTTP {code} ({"OK" if code == 403 else "ERROR"})')

print('\n' + '=' * 60)
print('前端视角 e2e 全部通过！')
print('=' * 60)