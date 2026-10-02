"""合规沙箱守卫：Kill Switch、风险词、自定义 System Prompt 拦截。"""

from __future__ import annotations

from dataclasses import dataclass, field

from fastapi import HTTPException, status

from app.core.config import settings


@dataclass(frozen=True)
class GuardDecision:
    """守卫检查的合并结果。"""

    allowed: bool
    blocked_reason: str | None = None
    risk_hits: list[str] = field(default_factory=list)


class SandboxGuard:
    """执行沙箱准入检查：Kill Switch、风险词、自定义 system prompt 拦截。"""

    @staticmethod
    def check_kill_switch() -> GuardDecision:
        """若紧急熔断开启则拒绝。"""
        if settings.SANDBOX_KILL_SWITCH:
            return GuardDecision(
                allowed=False,
                blocked_reason="SANDBOX_KILL_SWITCH 已开启，所有沙箱调用已熔断",
            )
        return GuardDecision(allowed=True)

    @staticmethod
    def check_risk_keywords(text: str) -> GuardDecision:
        """对文本做大小写不敏感的风险词匹配。"""
        if not text:
            return GuardDecision(allowed=True)
        keywords = settings.SANDBOX_RISK_KEYWORDS
        if not keywords:
            return GuardDecision(allowed=True)
        lowered = text.lower()
        hits = [kw for kw in keywords if kw.lower() in lowered]
        if hits:
            return GuardDecision(
                allowed=False,
                blocked_reason=f"命中风险词: {', '.join(hits)}",
                risk_hits=hits,
            )
        return GuardDecision(allowed=True)

    @staticmethod
    def reject_custom_system_prompt(instructions: str | None) -> None:
        """沙箱内禁止自定义 system prompt（需求第 5 点）。"""
        if instructions and instructions.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="合规沙箱禁止自定义 system prompt，请使用平台预置模板",
            )

    def evaluate(
        self,
        message: str,
        instructions: str | None = None,
    ) -> GuardDecision:
        """合并所有守卫检查，命中任一即拒绝。"""
        self.reject_custom_system_prompt(instructions)
        kill = self.check_kill_switch()
        if not kill.allowed:
            return kill
        risk = self.check_risk_keywords(message)
        if not risk.allowed:
            return risk
        return GuardDecision(allowed=True)


sandbox_guard = SandboxGuard()