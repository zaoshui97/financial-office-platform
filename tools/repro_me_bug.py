"""Reproduce the email validation bug in /auth/me"""
import urllib.request
import json

# 1) login
req = urllib.request.Request(
    "http://127.0.0.1:8030/api/v1/auth/login",
    data=json.dumps({"username": "wangwu", "password": "123456"}).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST",
)
resp = json.loads(urllib.request.urlopen(req, timeout=5).read())
token = resp["access_token"]
print(f"[1] login OK, token len = {len(token)}")

# 2) /me with token (正确的路径)
req2 = urllib.request.Request(
    "http://127.0.0.1:8030/api/v1/auth/me",
    headers={"Authorization": f"Bearer {token}"},
)
try:
    me = urllib.request.urlopen(req2, timeout=5).read()
    print(f"[2] /me OK: {me[:300].decode('utf-8', errors='replace')}")
except urllib.error.HTTPError as e:
    body = e.read()
    print(f"[2] /me FAIL: status={e.code}")
    print(f"    body: {body[:500].decode('utf-8', errors='replace')}")
