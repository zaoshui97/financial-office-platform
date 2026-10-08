"""测试 download-public 接口"""
import pymysql
import urllib.request
import json

conn = pymysql.connect(host='127.0.0.1', port=3306, user='root', password='801333',
                       database='financial_office', charset='utf8mb4')
cur = conn.cursor()

# 取一个有 token 的附件
cur.execute("SELECT id, preview_token, original_filename FROM attachments WHERE preview_token IS NOT NULL LIMIT 1")
row = cur.fetchone()
conn.close()

if not row:
    print("No token found")
else:
    aid, token, fname = row
    print(f"Testing attachment id={aid} token={token[:20]}... filename={fname}")
    url = f"http://127.0.0.1:8030/api/v1/attachments/download-public/{token}"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as resp:
            print(f"Status: {resp.status}")
            print(f"Content-Type: {resp.headers.get('Content-Type')}")
            data = resp.read(200)
            print(f"First 200 bytes: {data[:200]}")
    except urllib.error.HTTPError as e:
        print(f"HTTPError: {e.code} {e.reason}")
        print(e.read())
