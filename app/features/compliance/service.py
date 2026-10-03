"""合规沙箱业务编排：守卫 → 脱敏 → 调用 → 审计 → 降级。"""

from __future__ import annotations

import time
from dataclasses import dataclass, replace

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.ai.llm_gateway import LLMServiceError, llm_gateway
from app.ai.model_router import model_router
from app.ai.schemas import AIRequest, AITask
from app.core.config import settings
from app.core.logging import get_logger
from app.features.chat.schemas import ChatMode
from app.features.compliance.audit import AuditPayload, write_audit_log
from app.features.compliance.guard import GuardDecision, sandbox_guard
from app.features.compliance.network import provider_allowed
from app.features.compliance.sanitizer import sanitize_preview, sanitize_text
from app.features.compliance.schemas import SandboxChatRequest, SandboxChatResponse

logger = get_logger(__name__)


SANDBOX_SYSTEM_PROMPT = """你是睿枢金融办公智能体平台的合规助手。
请基于用户的提问提供准确、清晰、可执行的回答，回答须符合中国金融行业监管规范。
不确定时请明确说明，不得虚构企业内部制度与客户信息。
回答控制在800字以内；如内容超过该长度，请先给出最终结论再分点说明。"""


@dataclass(frozen=True)
class _RunContext:
    """单次沙箱调用的上下文。"""

    request_id: str
    user_id: int
    conversation_id: int | None


def _build_history(req: SandboxChatRequest) -> list[dict[str, str]]:
    """构造模型可消费的消息列表（用户消息已脱敏）。"""
    sanitized = sanitize_text(req.message).text
    return [{"role": "user", "content": sanitized}]


def _resolve_sandbox_profile() -> tuple[str, str]:
    """从 router 中挑选沙箱允许的首个候选（已校验白名单 + 内网）。"""
    candidates = model_router.candidates_for(AIRequest(task=AITask.CHAT, messages=[]))
    for profile in candidates:
        config = model_router.provider_for(profile.provider)
        if provider_allowed(profile.provider, config.base_url):
            return profile.provider, profile.model
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="没有可用的合规沙箱 Provider，请检查白名单与内网 base_url 配置",
    )


def _degrade_to_llm(req: SandboxChatRequest, owner_id: int) -> SandboxChatResponse:
    """fallback 策略下静默降级到普通 LLM 模式。"""
    logger.warning(
        "合规沙箱降级到普通 LLM 模式 | user_id=%s conversation_id=%s",
        owner_id,
        req.conversation_id,
    )
    sanitized = sanitize_text(req.message).text
    history = [{"role": "user", "content": sanitized}]
    response = llm_gateway.complete_with_metadata(history, task=AITask.CHAT)
    return SandboxChatResponse(
        conversation_id=req.conversation_id,
        assistant_message_id=f"degraded-{int(time.time() * 1000)}",
        answer=response.text,
        mode=ChatMode.LLM.value,
        provider=response.provider,
        model=response.model,
        latency_ms=response.latency_ms,
        sanitized_fields={},
        risk_hits=[],
    )


def execute_sandbox_chat(
    db: Session,
    owner_id: int,
    req: SandboxChatRequest,
) -> SandboxChatResponse:
    """沙箱对话主入口：守卫 → 脱敏 → 选 Provider → 调用 → 审计。"""
    if not settings.SANDBOX_MODE_ENABLED:
        if settings.SANDBOX_DEGRADATION_POLICY == "off":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="合规沙箱模式未启用（SANDBOX_MODE_ENABLED=False）",
            )
        if settings.SANDBOX_DEGRADATION_POLICY == "fallback":
            return _degrade_to_llm(req, owner_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="合规沙箱模式未启用",
        )

    decision: GuardDecision = sandbox_guard.evaluate(
        message=req.message, instructions=None
    )
    sanitization = sanitize_preview(
        req.message, max_chars=settings.SANDBOX_PREVIEW_CHARS
    )

    if not decision.allowed:
        audit = write_audit_log(
            db,
            AuditPayload(
                user_id=owner_id,
                conversation_id=req.conversation_id,
                request_id="blocked",
                provider="-",
                model="-",
                prompt=req.message,
                answer=None,
                pii_detected=sanitization.hits,
                risk_hits=decision.risk_hits,
                risk_category=decision.risk_category,
                confidence=decision.confidence,
                judge_source=decision.judge_source,
                blocked=True,
                block_reason=decision.blocked_reason,
                latency_ms=None,
            ),
            preview_chars=settings.SANDBOX_PREVIEW_CHARS,
        )
        if settings.SANDBOX_DEGRADATION_POLICY == "fallback":
            logger.warning(
                "合规沙箱命中拦截但策略为 fallback，降级到普通 LLM | user_id=%s reason=%s",
                owner_id,
                decision.blocked_reason,
            )
            return _degrade_to_llm(req, owner_id)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "reason": decision.blocked_reason,
                "audit_id": audit.id,
                "risk_hits": decision.risk_hits,
                "risk_category": decision.risk_category,
                "confidence": decision.confidence,
                "judge_source": decision.judge_source,
            },
        )

    try:
        provider_name, model_name = _resolve_sandbox_profile()
    except HTTPException as exc:
        if settings.SANDBOX_DEGRADATION_POLICY == "fallback":
            return _degrade_to_llm(req, owner_id)
        raise exc

    history = _build_history(req)
    started = time.perf_counter()
    # 强制 temperature=0 + max_tokens=2000：复制 router 给出的 profile 并覆写。
    base_profile = model_router.candidates_for(
        AIRequest(task=AITask.CHAT, messages=[])
    )[0]
    sandbox_profile = replace(
        base_profile,
        temperature=settings.SANDBOX_TEMPERATURE,
        max_tokens=settings.SANDBOX_MAX_TOKENS,
    )
    provider_config = model_router.provider_for(provider_name)
    if sandbox_profile.api_style and sandbox_profile.api_style != provider_config.api_style:
        provider_config = replace(
            provider_config, api_style=sandbox_profile.api_style
        )
    provider_impl = llm_gateway._provider_for(
        provider_name, llm_gateway._providers
    )
    sandbox_request = AIRequest(
        task=AITask.CHAT,
        messages=history,
        # 沙箱调用强制使用平台预置 system prompt，业务层任何传入
        # instructions 都会被 guard.reject_custom_system_prompt 拦截。
        instructions=SANDBOX_SYSTEM_PROMPT,
        max_tokens=settings.SANDBOX_MAX_TOKENS,
        need_long_context=False,
        need_web_search=False,
        need_tools=False,
    )
    try:
        response = provider_impl.chat(
            sandbox_request,
            sandbox_profile,
            provider_config,
        )
        latency_ms = (time.perf_counter() - started) * 1000
        response = response.model_copy(
            update={
                "task": AITask.CHAT.value,
                "latency_ms": latency_ms,
                "request_id": str(sandbox_profile.name),
            }
        )
    except Exception as exc:
        if settings.SANDBOX_DEGRADATION_POLICY == "fallback":
            logger.warning(
                "合规沙箱 Provider 失败，降级到普通 LLM | user_id=%s error=%s",
                owner_id,
                exc,
            )
            return _degrade_to_llm(req, owner_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    answer_preview = sanitize_preview(
        response.text, max_chars=settings.SANDBOX_PREVIEW_CHARS
    )
    audit = write_audit_log(
        db,
        AuditPayload(
            user_id=owner_id,
            conversation_id=req.conversation_id,
            request_id=response.request_id or "",
            provider=response.provider or provider_name,
            model=response.model or model_name,
            prompt=req.message,
            answer=response.text,
            pii_detected=sanitization.hits,
            risk_hits=decision.risk_hits,
            risk_category=decision.risk_category,
            confidence=decision.confidence,
            judge_source=decision.judge_source,
            blocked=False,
            block_reason=None,
            latency_ms=latency_ms,
        ),
        preview_chars=settings.SANDBOX_PREVIEW_CHARS,
    )

    return SandboxChatResponse(
        conversation_id=req.conversation_id,
        assistant_message_id=str(audit.id),
        answer=answer_preview.text,
        mode=ChatMode.COMPLIANCE_SANDBOX.value,
        provider=response.provider or provider_name,
        model=response.model or model_name,
        latency_ms=latency_ms,
        sanitized_fields=sanitization.hits,
        risk_hits=decision.risk_hits,
        risk_category=decision.risk_category,
        confidence=decision.confidence,
        judge_source=decision.judge_source,
        audit_id=audit.id,
    )