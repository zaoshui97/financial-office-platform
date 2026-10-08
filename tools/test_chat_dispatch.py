"""Chat dispatcher 端到端：实际发请求看 mode 自动选"""
import urllib.request, urllib.parse, json
API = 'http://127.0.0.1:5173/api/v1'

def login(u, p):
    d = urllib.parse.urlencode({'username': u, 'password': p}).encode()
    r = urllib.request.urlopen(urllib.request.Request(
        f'{API}/auth/login', data=d,
        headers={'Content-Type': 'application/x-www-form-urlencoded'}, method='POST'), timeout=5)
    return json.loads(r.read())['access_token']

def chat(token, msg, kb_id=None, mode=None):
    data = {'message': msg, 'conversation_id': None}
    if kb_id is not None:
        data['knowledge_base_id'] = kb_id
    if mode is not None:
        data['mode'] = mode
    body = json.dumps(data).encode()
    req = urllib.request.Request(f'{API}/chat', data=body,
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}, method='POST')
    r = urllib.request.urlopen(req, timeout=30)
    return json.loads(r.read())

t = login('testuser', 'Test1234!')
print('=' * 60)
print('Chat dispatcher 端到端')
print('=' * 60)
for msg in ['今天天气', '合规检查', '你好']:
    try:
        r = chat(t, msg)
        print(f'  msg="{msg[:20]}" mode={r.get("mode")} model={r.get("model")} answer_len={len(r.get("answer", ""))}')
    except urllib.error.HTTPError as e:
        print(f'  msg="{msg[:20]}" ERR {e.code}: {e.read().decode()[:80]}')