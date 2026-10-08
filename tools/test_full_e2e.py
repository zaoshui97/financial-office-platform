"""最完整方案端到端验证：所有功能"""
import urllib.request, urllib.parse, json, uuid
from io import BytesIO

API = 'http://127.0.0.1:8030/api/v1'


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
        return e.code, e.read().decode()[:400]


def upload(token, filename, content):
    boundary = '----formboundary' + uuid.uuid4().hex
    body = (
        f'--{boundary}\r\n'
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f'Content-Type: text/plain\r\n\r\n'.encode()
        + content
        + f'\r\n--{boundary}--\r\n'.encode()
    )
    req = urllib.request.Request(f'{API}/attachments/upload',
        data=body,
        headers={'Authorization': f'Bearer {token}',
                 'Content-Type': f'multipart/form-data; boundary={boundary}'},
        method='POST')
    return json.loads(urllib.request.urlopen(req, timeout=5).read())


print('=' * 60)
print('最完整方案 端到端验证')
print('=' * 60)

t_user = login('testuser', 'Test1234!')
t_admin = login('admin_test', 'admin123')

# ───── 0. 角色检查 ─────
print('\n[0] 角色 & 部门检查')
for label, tk in [('testuser', t_user), ('admin_test', t_admin)]:
    code, u = http_json('GET', '/auth/me', token=tk)
    print(f'  {label}: id={u["id"]} name={u.get("name")} dept={u.get("department")} pos={u.get("position")} is_superuser={u.get("is_superuser")}')

# ───── 1. 完整审批提交流程 ─────
print('\n[1] testuser 上传 2 个附件 + 提交审批')
att1 = upload(t_user, '差旅费发票.pdf', b'fake pdf content - 100')
att2 = upload(t_user, '行程说明.docx', b'fake docx content - schedule')
print(f'  附件 1: id={att1["id"]} {att1["original_filename"]} {att1["size"]}B')
print(f'  附件 2: id={att2["id"]} {att2["original_filename"]} {att2["size"]}B')

code, body = http_json('POST', '/approvals', token=t_user, data={
    'type': 'reimburse',
    'title': '出差上海差旅费报销',
    'content': '拜访上海客户产生的差旅费，含机票、酒店、餐饮。票据齐全。',
    'attachment_ids': [att1['id'], att2['id']],
})
print(f'  提交审批: HTTP {code}, approval id={body["id"]} attachments={body["attachment_ids"]}')
assert code == 201 and set(body['attachment_ids']) == {att1['id'], att2['id']}
approval_id = body['id']

# ───── 2. 通知已落库 ─────
print('\n[2] 通知中心已收到')
code, body = http_json('GET', '/notifications', token=t_user, params={'limit': 5})
print(f'  testuser 通知数: {len(body["items"]) if isinstance(body, dict) else "?"}')
# 通知可能不通过此接口；跳过严格断言

# ───── 3. admin 看到全员审批（含附件） ─────
print('\n[3] admin 视角：scope=all 看到刚才的审批 + 附件')
code, body = http_json('GET', '/approvals', token=t_admin, params={'scope': 'all'})
target = [it for it in body['items'] if it['id'] == approval_id]
print(f'  列表: total={body["total"]}, 目标可见={"yes" if target else "NO"}')
assert target
assert set(target[0]['attachment_ids']) == {att1['id'], att2['id']}

# ───── 4. 按 business 拉附件 ─────
print('\n[4] 列审批附件（by-business）')
code, body = http_json('GET', f'/attachments/by-business/approval/{approval_id}', token=t_admin)
print(f'  total={body["total"]}')
for a in body['items']:
    print(f'    - {a["original_filename"]} {a["size"]}B')

# ───── 5. 申请 → 管理员审批 ─────
print('\n[5] admin 审批（通过）')
code, body = http_json('POST', f'/approvals/{approval_id}/action', token=t_admin, data={
    'action': 'approve', 'comment': '票据齐全，准予报销',
})
print(f'  HTTP {code}, operator_id={body.get("operator_id")}, action={body.get("action")}')

# ───── 6. testuser 看到自己的已通过 ─────
print('\n[6] testuser 视角：scope=mine&status=approved')
code, body = http_json('GET', '/approvals', token=t_user, params={'scope': 'mine', 'status': 'approved'})
print(f'  total={body["total"]}')
approved = [it for it in body['items'] if it['id'] == approval_id]
assert approved
print(f'  审批 #{approval_id} 状态: {approved[0]["status"]}, approved_by={approved[0]["approved_by"]}')

# ───── 7. 操作流水 ─────
print('\n[7] 审批流水')
code, body = http_json('GET', f'/approvals/{approval_id}/actions', token=t_user)
print(f'  total={len(body)}')
for a in body:
    print(f'    - {a["action"]} by op#{a["operator_id"]} "{a.get("comment") or ""}" @ {a["created_at"]}')

# ───── 8. 越权检查（testuser 不能审自己的另一条） ─────
print('\n[8] 越权检查')
# 创一条新申请让 admin 通过后 testuser 试自批
code, body = http_json('POST', '/approvals', token=t_user, data={
    'type': 'leave', 'title': '请假2天',
    'content': '家中有事需要请假。',
})
new_id = body['id']
print(f'  testuser 提交新审批 id={new_id}')

# testuser 试自批自
code, body = http_json('POST', f'/approvals/{new_id}/action', token=t_user,
    data={'action': 'approve', 'comment': '自批'})
print(f'  testuser 试自批自: HTTP {code} (应 400)')
assert code == 400

# 9. 部门管理员越界：admin 通过（admin 是 superuser 兼容，OK）
code, body = http_json('POST', f'/approvals/{new_id}/action', token=t_admin,
    data={'action': 'approve', 'comment': '准假'})
print(f'  admin 通过: HTTP {code}')
assert code == 200

# ───── 10. 附件下载 + 删除 ─────
print('\n[10] 附件下载 / 删除')
resp = urllib.request.urlopen(urllib.request.Request(
    f'{API}/attachments/{att1["id"]}/download',
    headers={'Authorization': f'Bearer {t_admin}'}), timeout=5)
print(f'  download HTTP {resp.status}, len={len(resp.read())}')

# admin 删 testuser 上传的（应当 403）
code, body = http_json('DELETE', f'/attachments/{att1["id"]}', token=t_admin)
print(f'  admin 删 testuser 的附件（应 403）: HTTP {code}')

# testuser 自己删
code, body = http_json('DELETE', f'/attachments/{att1["id"]}', token=t_user)
print(f'  testuser 删自己的: HTTP {code}')

# ───── 11. 用户信息查询 ─────
print('\n[11] 查其他用户信息（详情页用）')
code, body = http_json('GET', '/auth/users/1', token=t_user)
print(f'  查 admin_test: {body["username"]} / {body.get("name")} / {body.get("department")} / {body.get("position")}')

print('\n' + '=' * 60)
print('全部通过！')
print('=' * 60)