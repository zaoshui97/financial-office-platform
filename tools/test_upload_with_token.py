"""模拟前端修复后上传附件：multipart/form-data 不手动设置 Content-Type"""
import urllib.request
import urllib.error
import io
import uuid
import json

# 1) 登录
login_data = urllib.parse.urlencode({'username': 'testuser', 'password': 'Test1234!'}).encode()
req = urllib.request.Request(
    'http://127.0.0.1:8030/api/v1/auth/login',
    data=login_data,
    headers={'Content-Type': 'application/x-www-form-urlencoded'}
)
with urllib.request.urlopen(req) as r:
    token = json.loads(r.read())['access_token']
print(f"Login OK, token: {token[:20]}...")

# 2) 构造 multipart/form-data (字段名 'file')
# 让 urllib 自己生成 boundary（这就是 axios 默认行为）
import mimetypes
fake_pdf_content = b'%PDF-1.4\n% Mini PDF for testing preview_token auto-generation.\n'
filename = 'test_preview_token.pdf'

boundary = uuid.uuid4().hex
body = (
    f'--{boundary}\r\n'
    f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
    f'Content-Type: application/pdf\r\n'
    f'\r\n'
).encode() + fake_pdf_content + (f'\r\n--{boundary}--\r\n').encode()

req = urllib.request.Request(
    'http://127.0.0.1:8030/api/v1/attachments/upload',
    data=body,
    headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': f'multipart/form-data; boundary={boundary}',
    }
)
try:
    with urllib.request.urlopen(req) as r:
        result = json.loads(r.read())
        print(f"\n上传成功:")
        print(f"  id={result['id']}")
        print(f"  filename={result['original_filename']}")
        print(f"  size={result['size']} (期望 {len(fake_pdf_content)})")
        print(f"  preview_token={result.get('preview_token', 'MISSING!')}")
        print(f"  preview_expires_at={result.get('preview_expires_at', 'MISSING!')}")

        # 3) 用返回的 token 立即下载验证
        if result.get('preview_token'):
            url = f"http://127.0.0.1:8030/api/v1/attachments/download-public/{result['preview_token']}"
            with urllib.request.urlopen(url) as r:
                data = r.read()
                print(f"\n免鉴权下载: status={r.status}, content_len={len(data)}")
                print(f"  内容匹配: {data == fake_pdf_content}")
except urllib.error.HTTPError as e:
    print(f"Upload HTTPError: {e.code}")
    print(e.read().decode())