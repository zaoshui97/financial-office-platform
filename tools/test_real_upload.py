"""模拟前端 FormData 上传：测 3 种 Content-Type 策略"""
import urllib.request, urllib.error, json, uuid

login_data = urllib.parse.urlencode({'username': 'testuser', 'password': 'Test1234!'}).encode()
req = urllib.request.Request(
    'http://127.0.0.1:8030/api/v1/auth/login',
    data=login_data, headers={'Content-Type': 'application/x-www-form-urlencoded'}
)
with urllib.request.urlopen(req) as r:
    token = json.loads(r.read())['access_token']

file_content = b'PDF-1.4\n% real pdf content\n%%EOF\n'
filename = 'simulate_frontend.pdf'
boundary = uuid.uuid4().hex
body = (
    f'--{boundary}\r\n'
    f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
    f'Content-Type: application/pdf\r\n\r\n'
).encode() + file_content + (f'\r\n--{boundary}--\r\n').encode()

def try_upload(headers, label):
    print(f"\n=== {label} ===")
    req = urllib.request.Request(
        'http://127.0.0.1:8030/api/v1/attachments/upload',
        data=body, headers={'Authorization': f'Bearer {token}', **headers}
    )
    try:
        with urllib.request.urlopen(req) as r:
            result = json.loads(r.read())
            print(f"OK id={result['id']}, size={result['size']}")
            return True
    except urllib.error.HTTPError as e:
        print(f"failed: {e.code}")
        print(e.read().decode()[:300])
        return False

# 1. 正确：含 boundary
try_upload({'Content-Type': f'multipart/form-data; boundary={boundary}'}, "1. multipart/form-data + boundary (axios auto)")

# 2. 不带 Content-Type
try_upload({}, "2. No Content-Type")

# 3. multipart/form-data 不带 boundary (老 bug)
try_upload({'Content-Type': 'multipart/form-data'}, "3. multipart/form-data (no boundary, old bug)")

# 4. application/json (前端发错格式)
import json as j
try_upload({'Content-Type': 'application/json'}, "4. application/json (axios treats FormData as plain object)")

# 5. application/x-www-form-urlencoded
urlenc = urllib.parse.urlencode({'type': 'leave', 'title': '测试', 'content': '详情详情详情'}).encode()
req = urllib.request.Request(
    'http://127.0.0.1:8030/api/v1/attachments/upload',
    data=urlenc,
    headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/x-www-form-urlencoded'}
)
print("\n=== 5. application/x-www-form-urlencoded (前端误把审批字段当 form 上传) ===")
try:
    with urllib.request.urlopen(req) as r:
        print(f"unexpected OK: {r.status}")
except urllib.error.HTTPError as e:
    print(f"failed: {e.code}")
    print(e.read().decode()[:500])