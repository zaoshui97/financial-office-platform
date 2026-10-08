"""验证 attachment + approval attachment_ids 链路"""
import urllib.request, urllib.parse, json
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
        return e.code, e.read().decode()[:300]


print('=== 附件链路端到端 ===')
t = login('testuser', 'Test1234!')

# 1. upload
import io, uuid
filename = 'contract_v1.txt'
fake_content = '这是测试合同附件内容：xxx'.encode('utf-8')
boundary = '----formboundary' + uuid.uuid4().hex
body = (
    f'--{boundary}\r\n'
    f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
    f'Content-Type: text/plain\r\n\r\n'.encode() +
    fake_content +
    f'\r\n--{boundary}--\r\n'.encode()
)
req = urllib.request.Request(f'{API}/attachments/upload',
    data=body,
    headers={
        'Authorization': f'Bearer {t}',
        'Content-Type': f'multipart/form-data; boundary={boundary}',
    },
    method='POST')
status, resp_text = 0, ''
try:
    r = urllib.request.urlopen(req, timeout=5)
    status = r.status
    resp_text = r.read().decode()
except urllib.error.HTTPError as e:
    status = e.code
    resp_text = e.read().decode()
print(f'1. upload: HTTP {status}')
if status != 201:
    print('  body:', resp_text)
    raise SystemExit(1)
att_id = json.loads(resp_text)['id']
print(f'   attachment id={att_id}')

# 2. 创建审批（关联附件）
code, body = http_json('POST', '/approvals', token=t, data={
    'type': 'seal',
    'title': '用印申请（含附件）',
    'content': '请审批用印，附件是合同文本。',
    'attachment_ids': [att_id],
})
print(f'2. create approval with attachment: HTTP {code}')
approval_id = body['id']
print(f'   approval id={approval_id}, attachments={body.get("attachment_ids")}')

# 3. 列表审批，确认 attachment_ids 带回
code, body = http_json('GET', '/approvals', token=t, params={'scope': 'mine'})
print(f'3. list mine: HTTP {code}')
target = [it for it in body['items'] if it['id'] == approval_id]
assert target, f'审批 {approval_id} 不在列表'
print(f'   target attachment_ids={target[0].get("attachment_ids")}')
assert att_id in target[0].get('attachment_ids', [])

# 4. admin list all 也能看到 attachment_ids
ta = login('admin_test', 'admin123')
code, body = http_json('GET', '/approvals', token=ta, params={'scope': 'all'})
target = [it for it in body['items'] if it['id'] == approval_id]
print(f'4. admin list all: HTTP {code}, attachment_ids={target[0].get("attachment_ids") if target else "MISSING"}')

# 5. 列附件（by-business）
code, body = http_json('GET', f'/attachments/by-business/approval/{approval_id}', token=ta)
print(f'5. attachments by-business: HTTP {code}, total={body["total"]}')

# 6. 下载附件（admin 应该能下载）
code_resp = urllib.request.urlopen(urllib.request.Request(
    f'{API}/attachments/{att_id}/download',
    headers={'Authorization': f'Bearer {ta}'}), timeout=5)
print(f'6. download: HTTP {code_resp.status}, content-len={len(code_resp.read())}')

# 7. 删除附件（仅上传者可删）
code, body = http_json('DELETE', f'/attachments/{att_id}', token=t)
print(f'7. delete (uploader): HTTP {code}')

print('\n=== 全部通过 ===')