"""直连 8030（不走 proxy）对比"""
import urllib.request, urllib.parse, json

def login(u, p):
    d = urllib.parse.urlencode({'username': u, 'password': p}).encode()
    r = urllib.request.urlopen(urllib.request.Request(
        'http://127.0.0.1:8030/api/v1/auth/login', data=d,
        headers={'Content-Type': 'application/x-www-form-urlencoded'}, method='POST'), timeout=5)
    return json.loads(r.read())['access_token']

t = login('testuser', 'Test1234!')

# /me 直连
r = urllib.request.urlopen(urllib.request.Request(
    'http://127.0.0.1:8030/api/v1/auth/me',
    headers={'Authorization': f'Bearer {t}'}), timeout=5)
me = json.loads(r.read())
print('--- 8030 /auth/me ---')
print(json.dumps(me, ensure_ascii=False, indent=2))

# /users/3 直连
try:
    r = urllib.request.urlopen(urllib.request.Request(
        'http://127.0.0.1:8030/api/v1/auth/users/3',
        headers={'Authorization': f'Bearer {t}'}), timeout=5)
    u3 = json.loads(r.read())
    print('\n--- 8030 /auth/users/3 ---')
    print(json.dumps(u3, ensure_ascii=False, indent=2))
except urllib.error.HTTPError as e:
    print(f'\n--- 8030 /auth/users/3 ERROR {e.code} ---')
    print(e.read().decode()[:500])
