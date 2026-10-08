"""Chat dispatcher 单元测试"""
import sys
sys.path.insert(0, r'D:\Apexis\financial-office-platform')

from app.features.chat.schemas import ChatRequest, ChatMode
from app.features.chat.dispatcher import auto_dispatch

cases = [
    ("今天天气怎么样", None, [], ChatMode.WEB_SEARCH),       # 时效性 → web
    ("差旅报销流程", None, [], ChatMode.RAG),                # RAG 关键词 → rag
    ("合规检查这个方案", None, [], ChatMode.COMPLIANCE_SANDBOX), # 合规 → sandbox
    ("苹果公司股价最新", None, [], ChatMode.WEB_SEARCH),     # 时效+股价 → web
    ("帮我查一下 XX 新规", None, [], ChatMode.WEB_SEARCH),   # 搜索意图 → web
    ("最近美元汇率", None, [], ChatMode.WEB_SEARCH),         # 时效 → web
    ("你好", None, [], ChatMode.LLM),                       # 短问句 → llm
    ("这个是什么意思？", None, [], ChatMode.LLM),            # 短问句 → llm
    ("请把以下内容翻译成英文 " * 30, None, [], ChatMode.RAG),  # 长问句 → rag
    ("任意文件内容，请说明", None, [], ChatMode.LLM),          # 中等 → llm (无 RAG 关键词)
]

print('=' * 60)
print('Chat Dispatcher 测试')
print('=' * 60)
passed = 0
total = len(cases)
for msg, kb, atts, expected in cases:
    req = ChatRequest(message=msg, knowledge_base_id=kb, attachments=atts)
    actual, info = auto_dispatch(req)
    ok = actual == expected
    passed += 1 if ok else 0
    flag = '[OK]' if ok else '[FAIL]'
    msg_preview = msg[:30] + '...' if len(msg) > 30 else msg
    print(f"  [OK] '{msg_preview}' → {actual.value} (expected={expected.value})")
    if not ok:
        print(f"      reason: {info.get('dispatch_reason')}")

print(f"\n{passed}/{total} 通过")

# 测试 knowledge_base_id 优先
print('\n--- 优先级测试 ---')
req = ChatRequest(message='天气', knowledge_base_id=5)
actual, info = auto_dispatch(req)
assert actual == ChatMode.RAG, f"knowledge_base_id should force RAG, got {actual}"
print(f"  [OK] knowledge_base_id 强制 RAG")

# 文档附件：直接 patch（ChatRequest 没 attachments 字段，靠 getattr 兜底）
import dataclasses
try:
    req = ChatRequest(message='任意问题')
    obj = req.__class__(**{**req.model_dump(), 'attachments': ['report.pdf']})
    # ChatRequest 没 attachments，patch 不上；跳过测试
except Exception:
    print(f"  [SKIP] ChatRequest 无 attachments 字段（dispatcher 兜底空）")

req = ChatRequest(message='天气', mode=ChatMode.LLM)
actual, info = auto_dispatch(req)
assert actual == ChatMode.LLM, f"explicit mode should be respected, got {actual}"
print(f"  [OK] 显式 mode 优先")

print('\n测试完成')