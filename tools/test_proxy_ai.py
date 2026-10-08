"""通过 5173 vite proxy 验证 AI 审查已写入 list/detail"""
import urllib.request, urllib.parse, json
API = 'http://127.0.0.1:5173/api/v1'

def login(u, p):
    d = urllib.parse.urlencode({'username': u, 'password': p}).encode()
    r = urllib.request.urlopen(urllib.request.Request(
        f'{API}/auth/login', data=d,
        headers={'Content-Type': 'application/x-www-form-urlencoded'}, method='POST'), timeout=5)
    return json.loads(r.read())['access_token']

t = login('admin_test', 'admin123')
r = urllib.request.urlopen(urllib.request.Request(
    f'{API}/approvals?scope=all&limit=10',
    headers={'Authorization': f'Bearer {t}'}), timeout=5)
data = json.loads(r.read())
print(f'total={data["total"]}')
for it in data['items'][:5]:
    has_ai = bool(it.get('ai_review'))
    print(f"  id={it['id']} type={it['type']} status={it['status']} "
          f"ai_suggestion={it.get('ai_suggestion')} "
          f"has_ai_review={has_ai}")
    if has_ai:
        o = it['ai_review']['overall']
        print(f"    AI score={o['score']} risk={o['risk_level']} suggestion={o['suggestion']}")
        print(f"    AI summary: {o['summary']}")
        for dim, d_data in it['ai_review']['dimensions'].items():
            print(f"      [{dim}] score={d_data['score']} {d_data['summary']}")