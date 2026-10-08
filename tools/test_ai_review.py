"""测试 AI 辅助审批：提交一个工单，看 AI 审查报告"""
import urllib.request, urllib.parse, json, uuid

API = 'http://127.0.0.1:8030/api/v1'

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


print('=' * 60)
print('AI 辅助审批 E2E 测试')
print('=' * 60)

t = login('testuser', 'Test1234!')

# 上传一个发票附件
att = upload(t, 'invoice_5800.pdf', b'%PDF-1.4\nfake invoice 5800', 'application/pdf')
print(f'\n[1] 上传附件 id={att["id"]}')

# 提交报销工单
print('\n[2] 提交报销工单（金额 5800，含发票，匹配制度）')
code, body = http_json('POST', '/approvals', token=t, data={
    'type': 'reimburse',
    'title': 'Q4 上海差旅费报销',
    'content': '2026-10-05 至 2026-10-07 出差上海，差旅费合计 5800 元，包含往返机票 2200 元、酒店 2 晚 1800 元、餐饮 800 元、出租车 600 元、打包发票已附。请审批。',
    'attachment_ids': [att['id']],
})
print(f'  HTTP {code}, id={body["id"]}')
print(f'  ai_suggestion: {body.get("ai_suggestion")}')
ai = body.get('ai_review') or {}
if ai:
    print(f'  overall.score: {ai["overall"]["score"]}')
    print(f'  overall.risk_level: {ai["overall"]["risk_level"]}')
    print(f'  overall.suggestion: {ai["overall"]["suggestion"]}')
    print(f'  overall.summary: {ai["overall"]["summary"]}')
    print(f'  overall.auto_pass_eligible: {ai["overall"]["auto_pass_eligible"]}')
    print(f'  explainability: {ai.get("explainability")}')
    print(f'  latency_ms: {ai.get("latency_ms")}')
    print(f'\n  --- 4 维度详情 ---')
    for dim_name, dim in ai['dimensions'].items():
        print(f'  [{dim_name}] score={dim["score"]} {dim.get("summary", "")}')
        if dim.get('hits'):
            for h in dim['hits'][:3]:
                print(f'    hit: {h}')
        if dim.get('flags'):
            for f in dim['flags']:
                print(f'    flag: [{f["level"]}] {f["message"]}')
        if dim.get('matches'):
            for m in dim['matches'][:2]:
                print(f'    policy: {m["doc_title"]} {m["clause"]} sim={m["similarity"]} verdict={m["verdict"]}')
else:
    print('  ❌ AI 审查没返回报告')

print('\n' + '=' * 60)
print('  提交第二份：高金额触发异常')
print('=' * 60)

# 提交大额异常工单
code, body2 = http_json('POST', '/approvals', token=t, data={
    'type': 'reimburse',
    'title': '紧急设备采购',
    'content': '由于业务紧急需要，现申请采购苹果笔记本电脑 1 台，金额 65000 元，请审批。',
    'attachment_ids': [],
})
print(f'  HTTP {code}, id={body2["id"]}')
ai2 = body2.get('ai_review') or {}
if ai2:
    print(f'  overall: score={ai2["overall"]["score"]} risk={ai2["overall"]["risk_level"]} suggestion={ai2["overall"]["suggestion"]}')
    print(f'  anomaly flags:')
    for f in ai2['dimensions']['anomaly'].get('flags', []):
        print(f'    [{f["level"]}] {f["message"]}')
    print(f'  completeness: {ai2["dimensions"]["completeness"].get("summary")}')

print('\n' + '=' * 60)
print('  admin 通过/驳回时携带 AI 建议')
print('=' * 60)

t_admin = login('admin_test', 'admin123')
# 通过第一份
code, body3 = http_json('POST', f'/approvals/{body["id"]}/action', token=t_admin, data={
    'action': 'approve',
    'comment': '票据齐全，AI 建议通过，准予报销',
    'override_reason': None,
})
print(f'  approve HTTP {code}, action={body3["action"]} ai_suggestion={body3.get("ai_suggestion")}')

# 驳回第二份（覆盖 AI 建议）
code, body4 = http_json('POST', f'/approvals/{body2["id"]}/action', token=t_admin, data={
    'action': 'reject',
    'comment': '金额超过 5 万，需走采购流程而非工单',
    'override_reason': 'AI 标 red 但我想走采购流程更合适',
})
print(f'  reject HTTP {code}, action={body4["action"]} ai_suggestion={body4.get("ai_suggestion")} override_reason={body4.get("override_reason")}')

print('\n' + '=' * 60)
print('AI 辅助审批 E2E 全部通过！')
print('=' * 60)
