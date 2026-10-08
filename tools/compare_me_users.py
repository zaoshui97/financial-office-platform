"""对比 /me 和 /users/{id}"""
import urllib.request, urllib.parse, json

def login(u, p):
    d = urllib.parse.urlencode({'username': u, 'password': p}).encode()
    r = urllib.request.urlopen(urllib.request.Request(
        'http://127.0.0.1:5173/api/v1/auth/login', data=d,
        headers={'Content-Type': 'application/x-www-form-urlencoded'}, method='POST'), timeout=5)
    return json.loads(r.read())['access_token']

t = login('testuser', 'Test1234!')

# /me
r = urllib.request.urlopen(urllib.request.Request(
    'http://127.0.0.1:5173/api/v1/auth/me',
    headers={'Authorization': f'Bearer {t}'}), timeout=5)
me = json.loads(r.read())
print('--- /auth/me ---')
print(json.dumps(me, ensure_ascii=False, indent=2))

# /users/3 (自己)
r = urllib.request.urlopen(urllib.request.Request(
    'http://127.0.0.1:5173/api/v1/auth/users/3',
    headers={'Authorization': f'Bearer {t}'}), timeout=5)
u3 = json.loads(r.read())
print('\n--- /auth/users/3 ---')
print(json.dumps(u3, ensure_ascii=False, indent=2))
