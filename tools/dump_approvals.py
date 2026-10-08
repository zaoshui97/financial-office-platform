"""检查当前后端审批数据"""
import urllib.request, json, urllib.parse

def login(u, p):
    data = urllib.parse.urlencode({'username': u, 'password': p}).encode()
    req = urllib.request.Request(
        'http://127.0.0.1:8010/api/v1/auth/login', data=data,
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
    )
    return json.loads(urllib.request.urlopen(req, timeout=5).read())['access_token']

t = login('admin_test', 'admin123')
req = urllib.request.Request(
    'http://127.0.0.1:8010/api/v1/approvals?scope=all&limit=20',
    headers={'Authorization': f'Bearer {t}'},
)
data = json.loads(urllib.request.urlopen(req, timeout=5).read())
print('total =', data['total'])
for it in data['items']:
    title = (it.get('title') or '')[:40]
    print(f'  id={it["id"]:>3} user={it["user_id"]} type={it["type"]:<10} status={it["status"]:<10} sandbox={str(it["sandbox_passed"]):<5} title={title}')
