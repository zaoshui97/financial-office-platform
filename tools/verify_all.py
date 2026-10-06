"""
金融智能办公平台 - 端到端功能验证
验证所有演示场景的 API 端点
"""
import requests

BASE = 'http://127.0.0.1:8001'
API = f'{BASE}/api/v1'

def login():
    r = requests.post(f'{API}/auth/login',
        data={'username': 'admin_test', 'password': 'admin123'})
    if r.status_code != 200:
        print(f'[FAIL] login: {r.status_code} {r.text[:100]}')
        return None
    token = r.json()['access_token']
    print(f'[OK] 登录成功 token={token[:20]}...')
    return token

def h(token, path, method='GET', json=None, data=None):
    headers = {'Authorization': f'Bearer {token}'}
    if method == 'GET':
        r = requests.get(f'{API}{path}', headers=headers)
    elif method == 'POST':
        if json:
            r = requests.post(f'{API}{path}', headers=headers, json=json)
        else:
            r = requests.post(f'{API}{path}', headers=headers, data=data)
    return r

def test_me(token):
    r = h(token, '/auth/me')
    print(f'  /auth/me → {r.status_code}  user={r.json().get("username")}')

def test_knowledge_bases(token):
    r = h(token, '/rag/knowledge-bases')
    print(f'  /rag/knowledge-bases → {r.status_code}  count={len(r.json()) if r.status_code==200 else r.text[:50]}')

def test_documents(token):
    r = h(token, '/rag/knowledge-bases/1/documents')
    docs = r.json() if r.status_code == 200 else []
    print(f'  /rag/kb/1/documents → {r.status_code}  docs={len(docs)}')
    for d in docs[:3]:
        print(f'    - {d.get("original_filename")} status={d.get("status")} idx={d.get("index_status")}')

def test_rag_qa(token, question):
    r = h(token, '/chat', method='POST', json={
        'message': question,
        'knowledge_base_id': 1,
        'task': 'rag'
    })
    d = r.json() if r.status_code == 200 else {}
    print(f'  /chat RAG → {r.status_code}  ans={str(d.get("answer","")[:80])}')
    print(f'    citations={len(d.get("citations",[]))} latency={d.get("latency_ms") or 0:.0f}ms method={d.get("retrieval_method","-")}')

def test_sandbox_chat(token):
    r = h(token, '/compliance/sandbox/chat', method='POST', json={
        'message': '资管新规对债券交易有哪些影响？'
    })
    d = r.json() if r.status_code in (200, 422) else {}
    print(f'  /compliance/sandbox/chat → {r.status_code}  blocked={d.get("blocked",False)} cat={d.get("risk_category","-")}')

def test_meetings(token):
    r = h(token, '/meetings')
    data = r.json() if r.status_code == 200 else {}
    meetings = data if isinstance(data, list) else (data.get('items') or [])
    print(f'  /meetings → {r.status_code}  meetings={len(meetings)}')
    return meetings

def test_meeting_create(token):
    import uuid
    r = h(token, '/meetings', method='POST', json={
        'title': f'测试会议 {uuid.uuid4().hex[:6]}',
        'topic': '演示测试',
        'agenda': '1. 演示测试\n2. 结束'
    })
    print(f'  /meetings POST → {r.status_code}  id={r.json().get("id") if r.status_code==201 else r.text[:50]}')
    return r.json() if r.status_code == 201 else None

def test_meeting_blackboard(token, meetings=None):
    # 先拿会议
    if not meetings:
        r = h(token, '/meetings')
        data = r.json() if r.status_code == 200 else {}
        meetings = data if isinstance(data, list) else (data.get('items') or [])
    if not meetings:
        print(f'  /meetings GET 无会议，跳过 blackboard')
        return
    mid = meetings[0]['id']
    r = h(token, f'/meetings/{mid}/blackboard')
    print(f'  /meetings/{mid}/blackboard → {r.status_code}')

def test_decision_playbacks(token):
    r = requests.get(f'{API}/decision/decision-playbacks')
    data = r.json() if r.status_code == 200 else []
    pbs = data if isinstance(data, list) else (data.get('items') or [])
    print(f'  /decision/decision-playbacks → {r.status_code}  count={len(pbs)}')
    # 验证防篡改
    if pbs:
        pb_id = pbs[0].get('id')
        r2 = requests.post(f'{API}/decision/decision-playbacks/{pb_id}/verify')
        d = r2.json() if r2.status_code == 200 else {}
        print(f'  /decision-playbacks/{pb_id}/verify → {r2.status_code}  is_intact={d.get("is_intact")}')

def test_regulations(token):
    r = requests.get(f'{API}/decision/regulations')
    data = r.json() if r.status_code == 200 else {}
    regs = data if isinstance(data, list) else (data.get('items') or [])
    print(f'  /decision/regulations → {r.status_code}  count={len(regs)}')
    for reg in list(regs)[:3]:
        print(f'    - {reg.get("title")} status={reg.get("status")}')

def test_news(token):
    r = requests.get(f'{API}/decision/news')
    data = r.json() if r.status_code == 200 else {}
    news = data if isinstance(data, list) else (data.get('items') or [])
    print(f'  /decision/news → {r.status_code}  count={len(news)}')

def test_organizations():
    r = requests.get(f'{API}/organizations')
    data = r.json() if r.status_code == 200 else {}
    orgs = data if isinstance(data, list) else (data.get('items') or [])
    print(f'  /organizations → {r.status_code}  count={len(orgs)}')
    for o in list(orgs)[:2]:
        print(f'    - {o.get("name")} ({o.get("org_type")})')

def test_office_templates():
    r = requests.get(f'{API}/office/templates')
    if r.status_code == 200:
        data = r.json()
        tpls = data if isinstance(data, list) else (data.get('items') or [])
        print(f'  /office/templates → {r.status_code}  count={len(tpls)}')
    else:
        print(f'  /office/templates → {r.status_code}  {r.text[:80]}')

def test_compliance_audit(token):
    r = h(token, '/compliance/sandbox/audit')
    logs = r.json() if r.status_code == 200 else []
    print(f'  /compliance/sandbox/audit → {r.status_code}  count={len(logs)}')

def test_blackboard_sessions(token):
    r = h(token, '/blackboard/sessions')
    sessions = r.json() if r.status_code == 200 else []
    print(f'  /blackboard/sessions → {r.status_code}  sessions={len(sessions)}')

def main():
    print('=' * 60)
    print('金融智能办公平台 - 端到端验证')
    print('=' * 60)
    print()

    token = login()
    if not token:
        print('登录失败，无法继续')
        return

    # 1. 认证
    print('\n[1] 认证')
    test_me(token)

    # 2. RAG 知识库
    print('\n[2] RAG 知识库')
    test_knowledge_bases(token)
    test_documents(token)

    # 3. RAG 问答（核心演示）
    print('\n[3] RAG 智能问答（核心演示）')
    questions = [
        '商业银行互联网贷款管理暂行办法对消费者权益有什么规定？',
        '数据安全分级指南把数据分成几级？',
        '员工差旅住宿标准是多少？',
        '反洗钱客户身份识别有哪些强化措施？',
        '今天的天气怎么样？',  # 测试拒答
    ]
    for q in questions:
        test_rag_qa(token, q)

    # 4. 合规沙箱
    print('\n[4] 合规沙箱')
    test_sandbox_chat(token)
    test_compliance_audit(token)

    # 5. 会议
    print('\n[5] 会议管理')
    test_meetings(token)
    test_meeting_create(token)
    test_meeting_blackboard(token)

    # 6. 决策智能
    print('\n[6] 决策智能')
    test_decision_playbacks(token)
    test_regulations(token)
    test_news(token)

    # 7. 机构 / 多租户
    print('\n[7] 机构（多租户）')
    test_organizations()

    # 8. 智能办公
    print('\n[8] 智能办公')
    test_office_templates()

    # 9. 黑板协同
    print('\n[9] 黑板协同')
    test_blackboard_sessions(token)

    print('\n' + '=' * 60)
    print('验证完成！')
    print('=' * 60)

if __name__ == '__main__':
    main()
