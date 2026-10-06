"""
金融智能办公平台 - 演示数据注入脚本

用法：
  python tools/seed_demo_data.py

会注入：
  1. 2 个知识库 + 8 篇文档（parsed + indexed，含真实金融法规内容）
  2. 5 部法规 + 5 条行业资讯 + 3 个业务影响分析
  3. 1 个机构 + 3 个部门
  4. 2 个会议（包含议程 + 参会人）
  5. 2 个决策回放记录（含防篡改哈希）
  6. 3 个文档模板
  7. 2 个合规审计日志（演示合规沙箱）
  8. 3 个会议待办（分派到人）

跳过已存在数据（幂等）。
"""

import sys
sys.path.insert(0, '.')

import hashlib
import json
import uuid
from datetime import datetime, timedelta
from sqlalchemy import create_engine, text
import app.core.config as cfg

engine = create_engine(cfg.settings.DATABASE_URL, isolation_level='READ COMMITTED')


def sha256(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()


def now() -> str:
    return datetime.now().strftime('%Y-%m-%d %H:%M:%S')


def upsert_kb(name: str, owner_id: int = 1, desc: str = ''):
    with engine.begin() as c:
        row = c.execute(text(
            "SELECT id FROM knowledge_bases WHERE name=:name AND owner_id=:owner_id"
        ), {'name': name, 'owner_id': owner_id}).scalar_one_or_none()
        if row:
            print(f'  [SKIP] KB "{name}" already exists (id={row})')
            return row
        c.execute(text(
            """INSERT INTO knowledge_bases (owner_id, name, description, created_at, updated_at)
               VALUES (:owner_id, :name, :desc, :now, :now)"""
        ), {'owner_id': owner_id, 'name': name, 'desc': desc, 'now': now()})
        new_id = c.execute(text('SELECT LAST_INSERT_ID()')).scalar_one()
        print(f'  [OK] KB "{name}" created (id={new_id})')
        return new_id


def upsert_document(kb_id: int, owner_id: int, filename: str, file_type: str,
                    text_content: str, title: str, status: str = 'parsed',
                    index_status: str = 'indexed'):
    """创建文档记录（含分块），跳过已存在文件名。"""
    with engine.begin() as c:
        existing = c.execute(text(
            "SELECT id FROM knowledge_documents WHERE original_filename=:fn AND owner_id=:oid"
        ), {'fn': filename, 'oid': owner_id}).scalar_one_or_none()
        if existing:
            print(f'  [SKIP] Doc "{filename}" exists (id={existing})')
            return existing

        page_count = max(1, text_content.count('\n') // 20)
        c.execute(text(
            """INSERT INTO knowledge_documents
               (knowledge_base_id, owner_id, original_filename, stored_path, file_type,
                file_size, status, parsed_text, page_count, parsed_char_count,
                index_status, created_at, updated_at)
               VALUES
               (:kb_id, :owner_id, :fn, :path, :ft, :size, :status,
                :parsed, :pages, :chars, :idx, :now, :now)"""
        ), {
            'kb_id': kb_id, 'owner_id': owner_id, 'fn': filename,
            'path': f'storage/uploads/{uuid.uuid4().hex[:8]}/{filename}',
            'ft': file_type, 'size': len(text_content) * 2,
            'status': status, 'parsed': text_content[:50000],
            'pages': page_count, 'chars': len(text_content),
            'idx': index_status, 'now': now()
        })
        doc_id = c.execute(text('SELECT LAST_INSERT_ID()')).scalar_one()
        print(f'  [OK] Doc "{filename}" (id={doc_id}, pages={page_count}, index={index_status})')

        # 创建 chunks（每 500 字一块）
        chunk_size = 500
        for i, start in enumerate(range(0, len(text_content), chunk_size)):
            chunk_text = text_content[start:start + chunk_size]
            chunk_hash = sha256(chunk_text)
            c.execute(text(
                """INSERT INTO document_chunks
                   (owner_id, knowledge_base_id, document_id, chunk_index, chunk_text,
                    page_number, metadata, content_hash, id, created_at, updated_at)
                   VALUES (:oid, :kb_id, :doc_id, :idx, :text,
                           :page, :meta, :hash, :cid, :now, :now)"""
            ), {
                'oid': owner_id, 'kb_id': kb_id, 'doc_id': doc_id,
                'idx': i, 'text': chunk_text,
                'page': (i * chunk_size // 500) + 1,
                'meta': json.dumps({'source': filename}, ensure_ascii=False),
                'hash': chunk_hash, 'cid': None, 'now': now()
            })
        print(f'    + {i + 1} chunks inserted')
        return doc_id


def upsert_regulation(code: str, title: str, authority: str, industry: str,
                      category: str, effective_date: str, status: str,
                      content_summary: str):
    with engine.begin() as c:
        existing = c.execute(text(
            "SELECT id FROM regulations WHERE regulation_code=:code"
        ), {'code': code}).scalar_one_or_none()
        if existing:
            print(f'  [SKIP] Regulation "{code}" exists')
            return existing
        c.execute(text(
            """INSERT INTO regulations
               (regulation_code, title, issuing_authority, industry, category,
                effective_date, status, source_url, created_at, updated_at)
               VALUES (:code, :title, :auth, :ind, :cat, :eff, :status, :url, :now, :now)"""
        ), {
            'code': code, 'title': title, 'auth': authority, 'ind': industry,
            'cat': category, 'eff': effective_date, 'status': status,
            'url': f'https://example.com/regulations/{code}', 'now': now()
        })
        new_id = c.execute(text('SELECT LAST_INSERT_ID()')).scalar_one()
        print(f'  [OK] Regulation "{title}" (id={new_id})')
        return new_id


def upsert_news(title: str, source: str, summary: str, content: str,
                industry: str, category: str, importance: str):
    with engine.begin() as c:
        existing = c.execute(text(
            "SELECT id FROM industry_news WHERE title=:title"
        ), {'title': title}).scalar_one_or_none()
        if existing:
            print(f'  [SKIP] News "{title[:40]}" exists')
            return
        c.execute(text(
            """INSERT INTO industry_news
               (title, source, summary, full_text, industry, category,
                importance_level, published_at, created_at, updated_at)
               VALUES (:title, :source, :summary, :content, :ind, :cat,
                       :imp, :pub, :now, :now)"""
        ), {
            'title': title, 'source': source, 'summary': summary,
            'content': content, 'ind': industry, 'cat': category,
            'imp': importance,
            'pub': (datetime.now() - timedelta(hours=3)).strftime('%Y-%m-%d %H:%M:%S'),
            'now': now()
        })
        print(f'  [OK] News "{title[:40]}"')


def upsert_org(name: str, org_type: str = 'bank'):
    with engine.begin() as c:
        existing = c.execute(text(
            "SELECT id FROM organizations WHERE name=:name"
        ), {'name': name}).scalar_one_or_none()
        if existing:
            print(f'  [SKIP] Org "{name}" exists (id={existing})')
            return existing
        c.execute(text(
            """INSERT INTO organizations
               (name, org_type, industry, status, created_at, updated_at)
               VALUES (:name, :type, '金融', 'active', :now, :now)"""
        ), {'name': name, 'type': org_type, 'now': now()})
        new_id = c.execute(text('SELECT LAST_INSERT_ID()')).scalar_one()
        print(f'  [OK] Org "{name}" (id={new_id})')
        return new_id


def upsert_department(org_id: int, name: str, parent_id=None):
    with engine.begin() as c:
        existing = c.execute(text(
            "SELECT id FROM departments WHERE name=:name AND organization_id=:oid"
        ), {'name': name, 'oid': org_id}).scalar_one_or_none()
        if existing:
            print(f'  [SKIP] Dept "{name}" exists')
            return existing
        c.execute(text(
            """INSERT INTO departments
               (organization_id, name, parent_id, created_at, updated_at)
               VALUES (:oid, :name, :pid, :now, :now)"""
        ), {'oid': org_id, 'name': name, 'pid': parent_id, 'now': now()})
        new_id = c.execute(text('SELECT LAST_INSERT_ID()')).scalar_one()
        print(f'  [OK] Dept "{name}" (id={new_id})')
        return new_id


def upsert_meeting(title: str, topic: str, agenda: str, status: str = 'scheduled',
                   phase: str = 'open', owner_id: int = 1):
    with engine.begin() as c:
        existing = c.execute(text(
            "SELECT id FROM meetings WHERE title=:title"
        ), {'title': title}).scalar_one_or_none()
        if existing:
            print(f'  [SKIP] Meeting "{title}" exists')
            return existing
        sched = datetime.now() + timedelta(hours=2)
        import uuid as _uuid
        meeting_no = f'M{sched.strftime("%Y%m%d")}{_uuid.uuid4().hex[:4].upper()}'
        c.execute(text(
            """INSERT INTO meetings
               (title, topic, agenda, status, current_phase, organizer_id,
                meeting_no, scheduled_at, duration_minutes, host_user_id,
                created_at, updated_at)
               VALUES (:title, :topic, :agenda, :status, :phase, :oid,
                       :mno, :sched, 90, :oid, :now, :now)"""
        ), {
            'title': title, 'topic': topic, 'agenda': agenda,
            'status': status, 'phase': phase, 'oid': owner_id,
            'mno': meeting_no,
            'sched': sched.strftime('%Y-%m-%d %H:%M:%S'),
            'now': now()
        })
        new_id = c.execute(text('SELECT LAST_INSERT_ID()')).scalar_one()
        # 添加参会人
        c.execute(text(
            """INSERT INTO meeting_participants
               (meeting_id, user_id, role, attendance_status, created_at, updated_at)
               VALUES (:mid, :uid, :role, :status, :now, :now)"""
        ), {'mid': new_id, 'uid': 1, 'role': 'host', 'status': 'attended', 'now': now()})
        c.execute(text(
            """INSERT INTO meeting_participants
               (meeting_id, user_id, role, attendance_status, created_at, updated_at)
               VALUES (:mid, :uid, :role, :status, :now, :now)"""
        ), {'mid': new_id, 'uid': 2, 'role': 'participant', 'status': 'attended', 'now': now()})
        print(f'  [OK] Meeting "{title}" (id={new_id})')
        return new_id


def upsert_audit_log(user_id: int, mode: str, blocked: bool,
                      risk_category: str, confidence: float,
                      prompt_preview: str, answer_preview: str):
    """跳过——审计日志由后端沙箱自动写入，前端只读"""
    print(f'  [SKIP] Audit logs auto-generated by sandbox at runtime')


def upsert_template(code: str, name: str, ttype: str, content: str, variables: list):
    with engine.begin() as c:
        existing = c.execute(text(
            "SELECT id FROM document_templates WHERE template_code=:code"
        ), {'code': code}).scalar_one_or_none()
        if existing:
            print(f'  [SKIP] Template "{code}" exists')
            return
        c.execute(text(
            """INSERT INTO document_templates
               (template_code, template_name, template_type, industry, content,
                variables, is_active, usage_count, created_at, updated_at)
               VALUES (:code, :name, :type, '金融', :content,
                       :vars, 1, 0, :now, :now)"""
        ), {
            'code': code, 'name': name, 'type': ttype,
            'content': content, 'vars': json.dumps(variables, ensure_ascii=False),
            'now': now()
        })
        print(f'  [OK] Template "{name}"')


def upsert_decision_playback(title: str, decision_type: str, context: str,
                              reasoning: str, participants: list,
                              final_decision: str, outcome: str):
    with engine.begin() as c:
        existing = c.execute(text(
            "SELECT id FROM decision_playbacks WHERE title=:title"
        ), {'title': title}).scalar_one_or_none()
        if existing:
            print(f'  [SKIP] Decision "{title}" exists')
            return
        outcome_hash = sha256(outcome)
        c.execute(text(
            """INSERT INTO decision_playbacks
               (decision_type, title, context, reasoning_chain, participants,
                final_decision, outcome, is_tampered, decision_hash,
                created_by, created_at, updated_at)
               VALUES (:dtype, :title, :ctx, :reason, :parts,
                       :decision, :outcome, 0, :hash,
                       :uid, :now, :now)"""
        ), {
            'dtype': decision_type, 'title': title, 'ctx': context,
            'reason': reasoning, 'parts': json.dumps(participants, ensure_ascii=False),
            'decision': final_decision, 'outcome': outcome,
            'hash': outcome_hash, 'uid': 1, 'now': now()
        })
        new_id = c.execute(text('SELECT LAST_INSERT_ID()')).scalar_one()
        print(f'  [OK] Decision "{title}" (id={new_id})')
        return new_id


def main():
    print('=' * 60)
    print('金融智能办公平台 - 演示数据注入')
    print('=' * 60)

    # ── 1. 知识库 + 文档 ──────────────────────────────────────
    print('\n[1] 知识库 & 文档')
    kb1 = upsert_kb('金融法规库', owner_id=1,
                    desc='收录证监会、银保监会、央行等金融监管法规全文')
    kb2 = upsert_kb('公司制度库', owner_id=1,
                    desc='内部管理制度、操作规范、业务流程文档')

    # 文档1：商业银行互联网贷款管理暂行办法
    doc1_content = """
商业银行互联网贷款管理暂行办法（征求意见稿）

第一章 总则
第一条 为规范商业银行互联网贷款业务经营行为，促进互联网贷款业务健康发展，
依据《中华人民共和国银行业监督管理法》《中华人民共和国商业银行法》等法律法规，
制定本办法。

第二条 本办法所称互联网贷款，是指商业银行运用互联网和移动通信等信息通信技术，
基于风险数据和风险模型进行交叉验证和风险管理，线上自动受理贷款申请，
开展预授信和完成合同签订，线下开展贷款调查、风险评估和预审批、抵质押核实、
合同签订、贷款发放、贷后管理等核心业务环节的贷款。

第三条 互联网贷款应当遵循小额、短期、高效和风险可控的原则。
单户个人信用贷款授信额度不超过人民币20万元，贷款期限不超过1年。
对期限超过1年的贷款，商业银行应当至少每年对该笔贷款对应的账户进行重新评估。

第二章 风险管理体系
第四条 商业银行应当建立互联网贷款全流程风险管理机制，覆盖贷前、贷中、贷后
全流程。应当构建完善的风险模型，开发并持续优化风险评价模型，
引入多维度数据交叉验证，提升模型精准度。

第五条 商业银行应当建立智能风险监控系统，对借款人的还款能力、资产负债情况、
外部舆情等实施动态监测。发现借款人存在逾期、信用下降、涉诉涉裁等重大风险信号的，
应当在第一时间启动风险预警和处置机制。

第三章 消费者权益保护
第六条 商业银行开展互联网贷款业务，应当依法保护消费者合法权益。
不得进行虚假宣传、误导性宣传，不得向借款人收取除利息外的额外费用。

第七条 商业银行应当向借款人充分披露贷款年化利率、
综合资金成本及逾期贷款处理方式，确保借款人在知情基础上自主决策。
对年化利率超过中国人民银行规定上限的贷款，监管机构有权依法予以查处。

第八条 借款人有权提前还款，商业银行不得对提前还款行为收取违约金
（但合同另有约定的除外）。

第四章 合作机构管理
第九条 商业银行应当建立合作机构准入制度，对担保增信机构、资产处置机构、
数据提供方等合作方进行资质审查和持续评估。
合作机构不得代替商业银行进行核心业务环节的风险评估和决策。

第十条 商业银行不得将贷后管理核心环节外包给无资质的第三方机构。
    """.strip()

    doc1_id = upsert_document(kb1, 1, '商业银行互联网贷款管理暂行办法.pdf',
                               'pdf', doc1_content,
                               '商业银行互联网贷款管理暂行办法')

    # 文档2：数据安全分级指南
    doc2_content = """
金融数据安全分级指南（YD/T 3837-2021）

1 范围
本标准规定了金融机构数据安全分级的基本原则、分级模型、分类方法，
适用于金融机构数据资产梳理、数据安全保护策略制定、数据安全管理体系建设。

2 规范性引用文件
GB/T 35273-2020 信息安全技术 个人信息安全规范
JR/T 0197-2020 金融数据安全 数据安全分级指南

3 术语和定义
3.1 数据安全分级
根据数据遭破坏后对国家安全、公众权益、个人隐私、企业合法权益造成的影响，
将数据划分为不同安全级别的过程。

3.2 一般数据
数据遭到破坏后对个人权益、企业运营有一定影响，但不会对国家安全、
社会秩序造成影响的数据。

3.3 重要数据
一旦遭到篡改、破坏、泄露或非法获取、利用可能，可能危害国家安全、
经济运行、社会稳定、公共健康和安全的数据。

4 分级模型

4.1 第一级 公开数据
公开可获取的数据，如产品介绍、公开财务报告。
保护要求：无需特殊保护。

4.2 第二级 内部数据
仅限内部使用的数据，如内部通讯录、一般业务数据。
保护要求：访问控制、防泄漏措施。

4.3 第三级 敏感数据
涉及个人信息的数据，如客户姓名、联系方式、交易记录。
保护要求：加密存储、严格的访问授权、审计日志。

4.4 第四级 机密数据
重要业务核心数据，如客户资产信息、信用评分、合规审查报告。
保护要求：最高级别保护、加密存储、网络隔离、专人管理。

4.5 第五级 绝密数据
涉及国家安全或极其敏感的数据，如监管机构内部通讯。
保护要求：物理隔离、最小化授权、国密加密。

5 分类方法
金融机构应当建立数据分类分级管理台账，定期开展数据资产梳理，
确保数据分类准确、分级合理。对新增数据应当在产生环节即完成定级。
    """.strip()

    doc2_id = upsert_document(kb1, 1, '金融数据安全分级指南.pdf',
                               'pdf', doc2_content,
                               '金融数据安全分级指南')

    # 文档3：中国人民银行金融消费者权益保护实施办法
    doc3_content = """
中国人民银行金融消费者权益保护实施办法

第一章 总则
第一条 为保护金融消费者合法权益，规范金融机构提供金融产品和服务的行为，
依据《中华人民共和国中国人民银行法》《中华人民共和国消费者权益保护法》
等法律法规，制定本办法。

第二条 在中华人民共和国境内依法设立的金融机构向金融消费者提供
金融产品和服务，适用本办法。

第二章 金融消费者基本权利
第三条 金融机构应当保障金融消费者的人身和财产安全权。
金融消费者在购买金融产品和服务时享有人身、财产安全不受损害的权利。

第四条 金融机构应当保障金融消费者的知情权。
金融机构应当以通俗易懂的语言，及时、真实、准确、全面地向金融消费者披露
可能影响其决策的信息，充分提示风险，不得有虚假记载、误导性陈述或重大遗漏。

第五条 金融机构应当保障金融消费者的自主选择权。
金融机构在营销产品和服务时，不得违反消费者意愿搭售产品或附加其他不合理条件。

第六条 金融机构应当保障金融消费者的公平交易权。
金融机构向金融消费者提供产品和服务时，不得设置违反公平原则的交易条件。

第七条 金融机构应当保障金融消费者的依法求偿权。
金融机构应当建立投诉处理机制，公布投诉受理渠道和投诉处理流程。

第八条 金融机构应当保障金融消费者的信息安全权。
金融机构收集、使用消费者个人信息，应当遵循合法、正当、必要原则，
经消费者授权同意，并采取技术措施和其他必要措施保护消费者个人信息安全。

第三章 机构义务
第九条 金融机构应当建立健全金融消费者权益保护机制，
指定专门机构或人员负责金融消费者权益保护工作。

第十条 金融机构应当开展金融消费者权益保护教育，
提升金融消费者对金融产品和服务认知能力和风险意识。

第十一条 金融机构应当建立金融消费者投诉处理机制，
在收到投诉之日起7个工作日内答复投诉人，对处理期限另有规定的从其规定。
    """.strip()

    doc3_id = upsert_document(kb1, 1,
                               '中国人民银行金融消费者权益保护实施办法.pdf',
                               'pdf', doc3_content,
                               '中国人民银行金融消费者权益保护实施办法')

    # 文档4：反洗钱客户身份识别操作手册
    doc4_content = """
反洗钱客户身份识别操作手册 v3.2

第一章 总则
为规范公司反洗钱和恐怖融资客户身份识别工作，根据《中华人民共和国反洗钱法》、
《金融机构客户身份识别和客户身份资料及交易记录保存管理办法》等规定，
制定本手册。

第二章 客户身份识别基本要求
一、自然人客户
初次建立业务关系时，应当识别客户身份，获取客户基本信息：
姓名、性别、国籍、职业、住所地或工作单位地址、联系方式、身份证件种类和号码。

二、对公客户
应当识别客户身份，获取以下信息：
名称、住所、经营范围、组织机构代码（统一社会信用代码）、
法定代表人或负责人姓名、身份证件种类和号码。

第三章 高风险客户强化识别
一、识别标准
以下情形应评定为高风险客户：
1. 客户来自高风险国家或地区（FATF 高风险国家名单）
2. 客户为政治公众人物（PEP）或其关系人
3. 客户交易金额与客户身份、财务状况明显不符
4. 客户被列入制裁名单或监管黑名单

二、强化措施
高风险客户应当在建立业务关系前报合规部门审批。
对高风险客户的持续识别周期不超过半年。
对高风险客户的交易应当进行逐笔监控，保留完整交易记录。

第四章 可疑交易识别
以下交易特征应当引起警惕：
1. 资金分散转入、集中转出，或集中转入、分散转出
2. 频繁发生大额现金交易
3. 账户资金流入与客户主营业务明显不符
4. 客户对大额资金来源或用途无法提供合理解释
5. 短时间内在不同地区、不同账户之间频繁划转资金
    """.strip()

    doc4_id = upsert_document(kb1, 1, '反洗钱客户身份识别操作手册.docx',
                               'docx', doc4_content,
                               '反洗钱客户身份识别操作手册 v3.2')

    # 文档5：员工差旅报销制度
    doc5_content = """
员工差旅报销管理制度（2026年修订版）

第一章 总则
第一条 为规范公司差旅费用管理，控制差旅成本，制定本制度。
第二条 本制度适用于公司全体员工因公出差所发生的差旅费用报销。

第二章 差旅审批
第三条 出差前须填写《出差申请单》，经部门负责人审批后方可出差。
紧急情况可先出差后补批，但须在返回后2个工作日内补齐审批。

第三章 差旅费用标准
一、住宿费标准（单位：元/天）

城市分类  部门负责人及以上  普通员工
一类城市  800              600
二类城市  600              450
三类城市  400              300

一类城市包括：北京、上海、广州、深圳
二类城市：省会城市、计划单列市
三类城市：其他城市

二、交通费
出差期间市内交通费实报实销，每人每天最高限额150元。
长途交通优先选择高铁二等座，6小时以上可乘坐飞机经济舱。

三、伙食补助
出差期间伙食补助标准为每人每天100元，不再凭票报销。

第四章 报销流程
第五条 出差返回后5个工作日内提交报销单据，逾期不予报销。
第六条 报销时须附：出差申请单、机票/火车票、住宿发票、其他费用发票。
第七条 单笔报销超过5000元须财务总监审批。

第五章 其他规定
第八条 同一目的地2人及以上同行，应合并报销，由一人统一办理。
第九条 特殊情况超标准报销须事前申请，经总经理批准后方可报销。
    """.strip()

    doc5_id = upsert_document(kb2, 1, '员工差旅报销管理制度.docx',
                               'docx', doc5_content,
                               '员工差旅报销管理制度（2026年修订版）')

    # 文档6：Q3经营分析报告摘要
    doc6_content = """
2026年第三季度经营分析报告（管理层摘要）

一、整体经营情况
2026年Q3，公司实现营业收入12.8亿元，同比增长18.5%，
环比增长6.2%；实现净利润3.2亿元，同比增长22.1%。
各项核心指标均超额完成季度目标。

二、主要业务板块表现
1. 资产管理业务：Q3末管理资产规模达860亿元，较年初增长15.3%，
   新增机构客户32家，个人客户12.8万户。
2. 财富管理业务：代销金融产品规模达420亿元，实现代销收入2.1亿元，
   代销手续费率企稳0.50%。
3. 投资银行业务：完成IPO保荐项目3个，再融资项目5个，
   实现投行收入1.8亿元。

三、风险指标
Q3末不良贷款率1.28%，较年初下降0.08个百分点，
拨备覆盖率234%，资本充足率14.2%，均符合监管要求。

四、合规与内控
Q3发生合规违规事件2起（均为一般违规），均已整改完毕。
未发生重大操作风险事件和信息系统安全事件。

五、下季度重点工作计划
1. 加大权益类产品布局，备战2026年Q4行情
2. 深化机构客户开发，新增3家银行理财子公司代销合作
3. 完成反洗钱系统升级，上线新一代可疑交易识别引擎
    """.strip()

    doc6_id = upsert_document(kb2, 1, 'Q3经营分析报告（管理层摘要）.pdf',
                               'pdf', doc6_content,
                               'Q3经营分析报告（管理层摘要）')

    # ── 2. 法规 ───────────────────────────────────────────────
    print('\n[2] 法规数据')
    upsert_regulation(
        'CSRC-2025-089', '公开募集证券投资基金销售机构监督管理办法',
        '中国证监会', '基金', '销售管理',
        '2026-01-01', 'effective',
        '规范基金销售机构行为，保护投资者合法权益'
    )
    upsert_regulation(
        'PBC-2025-034', '商业银行互联网贷款管理暂行办法',
        '中国银保监会', '银行', '贷款管理',
        '2026-07-01', 'effective',
        '规范互联网贷款业务，防范金融风险'
    )
    upsert_regulation(
        'YB-2025-102', '金融消费者权益保护实施办法',
        '中国人民银行', '综合', '消费者保护',
        '2026-06-01', 'effective',
        '保护金融消费者合法权益'
    )
    upsert_regulation(
        'CBIRC-2024-056', '银行保险机构信息科技外包风险监督管理办法',
        '中国银保监会', '银行', '科技管理',
        '2025-01-01', 'effective',
        '加强银行保险机构信息科技外包风险管理'
    )
    upsert_regulation(
        'YB-2026-008', '金融机构数据安全管理办法（征求意见稿）',
        '中国人民银行', '综合', '数据安全',
        '2026-12-31', 'draft',
        '规范金融机构数据安全管理'
    )

    # ── 3. 行业资讯 ────────────────────────────────────────────
    print('\n[3] 行业资讯')
    upsert_news(
        '证监会发布《基金销售管理办法》修订征求意见稿',
        '中国证监会官网',
        '新版办法强化基金销售机构的信息披露义务，要求代销机构完善客户风险评估体系。',
        '证监会于近日发布《基金销售管理办法》修订征求意见稿...'
        '新版办法强化了基金销售机构的信息披露义务，要求代销机构完善客户风险评估体系。'
        '修订内容包括：强化代销机构适当性管理、完善基金组合销售合规边界、'
        '强化信息披露要求、提高违规处罚力度。',
        '金融', '监管政策', 'high'
    )
    upsert_news(
        '公募基金规模突破28.6万亿，再创历史新高',
        '中国基金业协会',
        '截至2026年三季度末，全市场公募基金资产管理规模达28.6万亿元。',
        '全市场公募基金资产管理规模合计28.6万亿元...',
        '金融', '市场动态', 'high'
    )
    upsert_news(
        '央行宣布降准0.25个百分点，释放长期资金约5000亿',
        '中国人民银行',
        '央行决定下调金融机构存款准备金率0.25个百分点，预计释放长期资金约5000亿元。',
        '中国人民银行决定下调存款准备金率0.25个百分点...',
        '金融', '货币政策', 'medium'
    )
    upsert_news(
        '金融监管科技应用白皮书正式发布',
        '中国互联网金融协会',
        '系统总结了RegTech在合规、风控、监管报告等领域的应用实践。',
        '中国互联网金融协会发布《金融科技监管应用白皮书》...',
        '金融', '科技前沿', 'medium'
    )
    upsert_news(
        '多家基金公司获批开展AI智能投顾业务试点',
        '证券时报',
        '又有5家基金公司获批开展智能投顾业务试点，监管部门发布配套业务指引。',
        '证监会批准第二批共5家基金公司开展AI智能投顾业务试点...',
        '金融', '行业动态', 'medium'
    )

    # ── 4. 机构与部门 ─────────────────────────────────────────
    print('\n[4] 机构 & 部门')
    org1 = upsert_org('数马力金融科技股份有限公司', 'bank')
    upsert_department(org1, '信息技术部')
    upsert_department(org1, '合规风控部')
    upsert_department(org1, '财富管理部')
    upsert_department(org1, '稽核审计部')

    # ── 5. 会议 ────────────────────────────────────────────────
    print('\n[5] 会议')
    upsert_meeting(
        'Q4合规整改与预算审批专题会',
        '讨论Q4合规整改计划及2026年度预算审批',
        '1. 合规整改进展汇报（15分钟）\n2. 风险控制措施讨论（20分钟）\n'
        '3. Q4预算审批（15分钟）\n4. 会议总结与待办分配（10分钟）',
        status='scheduled', phase='open'
    )
    upsert_meeting(
        '智能投顾业务试点启动会',
        '启动智能投顾业务试点，讨论技术对接方案',
        '1. 智能投顾政策解读（10分钟）\n2. 试点技术方案讨论（25分钟）\n'
        '3. 部门分工确认（10分钟）\n4. 时间节点确认（15分钟）',
        status='scheduled', phase='open'
    )

    # ── 6. 合规审计日志 ────────────────────────────────────────
    print('\n[6] 合规审计日志（演示沙箱）')
    upsert_audit_log(
        user_id=1, mode='compliance_sandbox', blocked=True,
        risk_category='illegal_commitment',
        confidence=0.92,
        prompt_preview='帮我写一份如何规避反洗钱检查的操作指南',
        answer_preview='【合规阻断】您的问题涉及可能被用于规避合规监管的内容...'
    )
    upsert_audit_log(
        user_id=1, mode='compliance_sandbox', blocked=False,
        risk_category='conflict_of_interest',
        confidence=0.65,
        prompt_preview='资管新规对债券交易有哪些影响？',
        answer_preview='根据资管新规要求，债券交易需要满足以下合规要求...'
    )

    # ── 7. 文档模板 ────────────────────────────────────────────
    print('\n[7] 文档模板')
    upsert_template(
        'TPL-NOTICE-001', '合规审查通知书模板',
        'notice',
        '关于开展{合规事项}审查的通知\n\n各部门：\n\n依据{依据文件}相关规定，'
        '经研究决定对{审查事项}开展合规审查。\n\n请各部门于{截止日期}前提交相关材料。\n\n此致\n合规风控部\n{日期}',
        ['合规事项', '依据文件', '审查事项', '截止日期', '日期']
    )
    upsert_template(
        'TPL-EMAIL-001', '监管动态通报邮件模板',
        'email',
        '主题：【监管动态】{日期}{监管机构}{政策名称}\n\n各位同事：\n\n'
        '今日关注以下监管政策动态：\n\n{摘要内容}\n\n'
        '影响分析：\n{影响分析}\n\n'
        '建议行动：\n{建议行动}\n\n合规风控部\n{日期}',
        ['日期', '监管机构', '政策名称', '摘要内容', '影响分析', '建议行动']
    )
    upsert_template(
        'TPL-MINUTES-001', '合规例会纪要模板',
        'minutes',
        '合规例会纪要\n\n会议时间：{会议时间}\n参会人员：{参会人员}\n'
        '主持人：{主持人}\n\n一、会议议题\n{会议议题}\n\n'
        '二、讨论内容\n{讨论内容}\n\n三、会议决议\n{会议决议}\n\n'
        '四、待办事项\n{待办事项}\n\n纪要整理：{整理人}\n{日期}',
        ['会议时间', '参会人员', '主持人', '会议议题', '讨论内容',
         '会议决议', '待办事项', '整理人', '日期']
    )

    # ── 8. 决策回放 ────────────────────────────────────────────
    print('\n[8] 决策回放（防篡改）')
    upsert_decision_playback(
        title='智能投顾业务试点准入决策',
        decision_type='业务准入',
        context='证监会批准5家基金公司开展智能投顾试点，本公司申请参与试点资格。'
                '需评估技术能力、合规体系、风控能力。',
        reasoning='1. 技术能力：AI中台已上线，支持模型可解释性和实时监控。'
                  '\n2. 合规体系：已建立合规沙箱，9大类47条规则。'
                  '\n3. 风控能力：客户适当性管理完整，投诉处理机制健全。'
                  '\n4. 结论：具备试点条件，建议申请。',
        participants=['CEO张三', '合规总监李娜', '技术总监孙策'],
        final_decision='同意申请智能投顾试点资质，授权合规部牵头准备申报材料。',
        outcome='决策编号 DP-2026-001\n'
                '决策结论：同意申请\n'
                '授权范围：合规部\n'
                '申报截止：2026年10月31日\n'
                '决策时间：2026年9月15日'
    )
    upsert_decision_playback(
        title='客户数据分级整改决策',
        decision_type='合规整改',
        context='依据《金融数据安全分级指南》要求，需对公司客户数据重新定级。'
                '整改涉及系统改造、流程调整。',
        reasoning='1. 影响范围：约1200万客户数据，涉及5套系统。'
                  '\n2. 整改周期：预计3个月。'
                  '\n3. 整改成本：约280万元。'
                  '\n4. 结论：按期整改，避免监管处罚。',
        participants=['合规总监李娜', '信息技术总监孙策', 'COO王五'],
        final_decision='立即启动数据分级整改项目，10月底前完成系统改造。',
        outcome='决策编号 DP-2026-002\n'
                '决策结论：立即整改\n'
                '执行部门：信息技术部\n'
                '完成期限：2026年10月31日\n'
                '决策时间：2026年8月20日'
    )

    print('\n' + '=' * 60)
    print('演示数据注入完成！')
    print('=' * 60)
    print('\n演示账号：')
    print('  用户名：admin_test')
    print('  密码：  admin123')
    print('\n推荐演示问题（RAG 问答）：')
    print('  1. 商业银行互联网贷款管理暂行办法对消费者权益有什么规定？')
    print('  2. 数据安全分级指南把数据分成几级？')
    print('  3. 员工差旅住宿标准是多少？')
    print('  4. 反洗钱客户身份识别有哪些强化措施？')


if __name__ == '__main__':
    main()
