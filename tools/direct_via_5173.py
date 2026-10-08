"""看 vite proxy 实际打到哪"""
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
print(json.dumps(json.loads(r.read()), ensure_ascii=False, indent=2))

# /users/3
r = urllib.request.urlopen(urllib.request.Request(
    'http://127.0.0.1:5173/api/v1/auth/users/3',
    headers={'Authorization': f'Bearer {t}'}), timeout=5)
print(json.dumps(json.loads(r.read()), ensure_ascii=False, indent=2))
