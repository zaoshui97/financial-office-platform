"""模拟前端走 vite proxy 拉数据"""
import urllib.request, json, urllib.parse

def login(u, p):
    data = urllib.parse.urlencode({'username': u, 'password': p}).encode()
    req = urllib.request.Request(
        'http://127.0.0.1:5173/api/v1/auth/login', data=data,
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
    )
    return json.loads(urllib.request.urlopen(req, timeout=5).read())['access_token']

for u, p in [('testuser', 'Test1234!'), ('admin_test', 'admin123')]:
    t = login(u, p)
    req = urllib.request.Request(
        'http://127.0.0.1:5173/api/v1/approvals?scope=mine&limit=10',
        headers={'Authorization': f'Bearer {t}'},
    )
    data = json.loads(urllib.request.urlopen(req, timeout=5).read())
    print(f'{u} scope=mine: total={data["total"]}')
    for it in data['items']:
        print(f'  id={it["id"]} status={it["status"]} title={it.get("title")}')

# admin scope=all
t = login('admin_test', 'admin123')
req = urllib.request.Request(
    'http://127.0.0.1:5173/api/v1/approvals?scope=all&limit=20',
    headers={'Authorization': f'Bearer {t}'},
)
data = json.loads(urllib.request.urlopen(req, timeout=5).read())
print(f'admin scope=all: total={data["total"]}')
