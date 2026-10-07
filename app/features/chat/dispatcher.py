"""
Chat dispatcher — 多 Agent 路由（用户不可见）

根据用户消息特征自动选择最合适的 Agent：
  - 短问句（< 30 字 / 无附件）→ ChatAgent (LLM 直答)
  - 中长问句或附件为文档类（pdf/docx/txt/md）→ RAGAgent (知识库检索)
  - 含网络检索关键词 / 时效性词 → WebSearchAgent
  - 含合规/合规沙箱相关关键词 → ComplianceAgent

设计原则：
  1. 用户不可见 —— 只在 ChatResponse 增加 'dispatch' 字段用于审计/调试
  2. 用户可显式覆盖 —— request.mode='auto' 时启用，否则按用户传入 dispatcher
  3. 失败降级 —— LLM 不可用时降级到最小可用的 Agent
"""
from __future__ import annotations
import logging
import re
from typing import Literal

from app.features.chat.schemas import ChatMode, ChatRequest

logger = logging.getLogger(__name__)

# 阈值（基于经验，可调）
SHORT_QUESTION_MAX = 30     # < 30 字 → 短问句
LONG_QUESTION_MIN = 200     # > 200 字 → 长问句 / 复杂任务
ATTACHMENT_DOC_EXTS = {".pdf", ".docx", ".doc", ".txt", ".md", ".markdown",
                       ".xlsx", ".xls", ".pptx", ".csv"}
ATTACHMENT_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}

# 关键词路由
WEB_SEARCH_KEYWORDS = {
    "最新", "新闻", "今天", "本周", "本月", "今年", "刚刚", "实时",
    "now", "today", "latest", "news", "current", "recent",
    "股价", "汇率", "天气", "比分", "动态", "行情",
    "搜索", "搜一下", "查一下", "帮我查", "查查",
}
COMPLIANCE_KEYWORDS = {
    "合规", "敏感", "风险词", "违规", "审查", "拦截", "沙箱",
    "敏感词", "敏感信息", "PII", "脱敏", "合规检测",
    "compliance", "sanitize", "redact",
}
RAG_KEYWORDS = {
    "知识库", "文档", "合同", "制度", "手册", "流程", "规章",
    "规定", "我们公司", "企业内部", "本公司", "政策",
    "knowledge", "policy", "document", "manual", "internal",
}


def _has_attachment(req: ChatRequest) -> bool:
    """检查请求里是否带附件（ChatRequest 暂无 attachments 字段，依赖前端 metadata）。"""
    raw = getattr(req, "attachments", None) or []
    return len(raw) > 0


def _attachment_extensions(req: ChatRequest) -> list[str]:
    raw = getattr(req, "attachments", None) or []
    return [a.lower() for a in raw]


def _classify_intent(message: str) -> dict:
    """基于关键词的意图识别（轻量级，Phase 2 可换 LLM 分类）。"""
    text = (message or "").strip()
    lowered = text.lower()
    hits = {
        "compliance": sum(1 for k in COMPLIANCE_KEYWORDS if k in lowered or k in text),
        "web_search": sum(1 for k in WEB_SEARCH_KEYWORDS if k in lowered or k in text),
        "rag":        sum(1 for k in RAG_KEYWORDS if k in lowered or k in text),
    }
    return hits


def auto_dispatch(req: ChatRequest) -> tuple[ChatMode, dict]:
    """根据请求特征自动选择 Agent 模式。

    Returns:
        (mode, dispatch_info) — dispatch_info 写到日志 + 前端
    """
    msg_len = len((req.message or "").strip())
    has_att = _has_attachment(req)
    att_exts = _attachment_extensions(req)
    intent_hits = _classify_intent(req.message or "")
    info: dict = {
        "message_length": msg_len,
        "has_attachment": has_att,
        "attachment_extensions": att_exts,
        "intent_hits": intent_hits,
    }

    # 1) 用户显式指定 mode → 优先
    if req.mode is not None:
        info["dispatch_reason"] = f"user_explicit:{req.mode.value}"
        return req.mode, info

    # 2) 用户带了 knowledge_base_id → 强制 RAG
    if req.knowledge_base_id is not None:
        info["dispatch_reason"] = "knowledge_base_provided"
        return ChatMode.RAG, info

    # 3) 用户显式选了 RAG task
    if (req.task or "").value == "rag":
        info["dispatch_reason"] = "task=rag"
        return ChatMode.RAG, info

    # 4) 合规意图命中 ≥ 1 → Compliance Sandbox
    if intent_hits["compliance"] >= 1:
        info["dispatch_reason"] = f"intent=compliance(hits={intent_hits['compliance']})"
        return ChatMode.COMPLIANCE_SANDBOX, info

    # 5) 附件为文档类 → RAG（文档解析）
    if has_att and any(ext in ATTACHMENT_DOC_EXTS for ext in att_exts):
        info["dispatch_reason"] = f"doc_attachment({att_exts})"
        return ChatMode.RAG, info

    # 6) 时效性 / 搜索意图 → Web Search
    if intent_hits["web_search"] >= 1:
        info["dispatch_reason"] = f"intent=web_search(hits={intent_hits['web_search']})"
        return ChatMode.WEB_SEARCH, info

    # 7) 长问句 → RAG（需要上下文）
    if msg_len >= LONG_QUESTION_MIN:
        info["dispatch_reason"] = f"long_question(len={msg_len})"
        return ChatMode.RAG, info

    # 8) 短问句 + RAG 关键词 → RAG（短问句别错过关键词意图）
    if msg_len <= SHORT_QUESTION_MAX:
        if intent_hits["rag"] >= 1:
            info["dispatch_reason"] = f"short+rag_intent(hits={intent_hits['rag']})"
            return ChatMode.RAG, info
        info["dispatch_reason"] = f"short_question(len={msg_len})"
        return ChatMode.LLM, info

    # 9) RAG 关键词命中 → RAG
    if intent_hits["rag"] >= 1:
        info["dispatch_reason"] = f"intent=rag(hits={intent_hits['rag']})"
        return ChatMode.RAG, info

    # 默认 LLM
    info["dispatch_reason"] = "default_llm"
    return ChatMode.LLM, info


def dispatch_with_log(req: ChatRequest) -> ChatMode:
    """包装一层，自动 dispatch + 记日志。

    Phase 2：用户偏好 → forward to user-specified agent（已在 auto_dispatch 第 1 步）
    """
    mode, info = auto_dispatch(req)
    logger.info(
        "chat dispatch | mode=%s reason=%s msg_len=%s has_att=%s hits=%s",
        mode.value, info["dispatch_reason"], info["message_length"],
        info["has_attachment"], info["intent_hits"],
    )
    return mode