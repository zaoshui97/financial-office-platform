"""合规沙箱统一入口：规则 + LLM 二次确认 + 审计落库。

核心流程（check_text）：
1. kill_switch 前置守卫 — 熔断激活时拒绝（写 kill_switch scenario）
2. rule_engine.match(text)   — 永远先跑（fast 模式）
3. mode == "combined" 且 rule 命中 medium/high → LLMJudge.assess() 二次确认
4. 合并结果（LLM 风险等级覆盖规则）
5. 写审计日志（fail-open：审计失败不影响业务结果）
6. 返回 dict 给上层（router / 业务编排）

mode 取值：
- "rule_only"   只跑规则（最快、最便宜；合规底线）
- "llm_only"    只跑 LLM（跳过规则；用于"先看 AI 怎么说"的场景）
- "combined"    先规则再 LLM（推荐：fast + accurate）
"""

from __future__ import annotations

import time
from typing import Any, Protocol

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import get_logger
from app.features.compliance.audit import AuditPayload, write_audit_log
from app.sandbox.exceptions import SandboxUnavailable
from app.sandbox.kill_switch import KillSwitch, kill_switch as _kill_switch
from app.sandbox.llm_judge import LLMJudge, JudgeResult
from app.sandbox.rule_engine import RuleEngine, RuleResult

logger = get_logger(__name__)


# ---- mode 取值约定 -----------------------------------------------------------

VALID_MODES = ("rule_only", "llm_only", "combined")

# 触发 LLM 二次确认的最低规则风险等级
LLM_TRIGGER_LEVELS = ("medium", "high")


# ---- 协议：便于测试注入 mock -------------------------------------------------


class LLMJudgeLike(Protocol):
    """LLMJudge 最小契约（duck-typing），service 不直接依赖具体类。"""

    def assess(self, text: str, rules: list[dict], *, task: str = "risk_assessment") -> dict: ...


class RuleEngineLike(Protocol):
    """RuleEngine 最小契约。"""

    def match(self, text: str) -> RuleResult: ...


class KillSwitchLike(Protocol):
    """KillSwitch 最小契约。"""

    def is_active(self) -> bool: ...
    @property
    def reason(self) -> str | None: ...


# ---- 主函数 ------------------------------------------------------------------


def check_text(
    text: str,
    *,
    mode: str = "combined",
    biz_type: str,
    biz_id: str,
    user_id: int | None = None,
    conversation_id: int | None = None,
    db: Session | None = None,
    rule_engine: RuleEngineLike | None = None,
    llm_judge: LLMJudgeLike | None = None,
    kill_switch: KillSwitchLike | None = None,
) -> dict[str, Any]:
    """对一段文本做合规风险检测，必要时写审计日志。

    Args:
        text: 待检测文本
        mode: rule_only / llm_only / combined
        biz_type: 业务类型（如 "chat" / "rag" / "research_report"）
        biz_id: 业务实体 ID（自由字符串，仅用于审计追溯）
        user_id: 调用方用户 ID（不传则审计落 user_id=0 占位）
        conversation_id: 关联的聊天会话 ID（可空）
        db: SQLAlchemy Session（可空；为空时不写审计日志）
        rule_engine: 可注入自定义规则引擎（默认使用 settings 派生 + 业务注入）
        llm_judge: 可注入自定义 LLM 判定器（默认使用全局 llm_gateway）
        kill_switch: 可注入自定义熔断器（默认使用全局单例）

    Raises:
        SandboxUnavailable: kill_switch 激活时抛出，audit_id 可用于追踪

    Returns:
        dict，结构：
          {
            "risk_level": "low"|"medium"|"high"|"unknown",
            "matched_rules": [...],
            "matched_intents": [...],
            "rule_result": {...},
            "llm_result": {...} | None,
            "audit_id": int | None,
            "latency_ms": float,
            "mode": str,
            "biz_type": str,
            "biz_id": str,
          }
    """
    if mode not in VALID_MODES:
        raise ValueError(f"mode 必须是 {VALID_MODES} 之一，当前: {mode!r}")

    ks = kill_switch or _kill_switch

    # ---- 0. 前置守卫：Kill Switch ----
    if ks.is_active():
        ks_reason = ks.reason or "unknown"
        logger.warning(
            "KillSwitch 激活，拒绝沙箱调用 | biz_type=%s biz_id=%s reason=%s",
            biz_type,
            biz_id,
            ks_reason,
        )
        # 即使在熔断时也写审计日志（留痕）
        audit_id: int | None = None
        if db is not None:
            audit_id = _write_audit_kill_switch(
                db=db,
                text=text,
                user_id=user_id,
                conversation_id=conversation_id,
                biz_type=biz_type,
                biz_id=biz_id,
                ks_reason=ks_reason,
            )
        raise SandboxUnavailable(
            message="合规沙箱已熔断，请稍后重试",
            error_code="SANDBOX_KILLED",
            audit_id=audit_id,
            kill_switch_reason=ks_reason,
        )

    started = time.perf_counter()
    engine = rule_engine or RuleEngine()
    judge = llm_judge or LLMJudge(gateway=_default_gateway())

    # ---- 1. 规则匹配（rule_only / combined 必跑）----
    rule_result: RuleResult = (
        engine.match(text) if mode in ("rule_only", "combined") else RuleResult()
    )

    # ---- 2. LLM 判定 ----
    llm_dict: dict | None = None
    if mode == "llm_only":
        llm_dict = _safe_llm(judge, text, rules=[])
    elif mode == "combined" and rule_result.risk_level in LLM_TRIGGER_LEVELS:
        # 把规则命中的描述喂给 LLM 做语义确认
        rules_for_llm = [
            {
                "id": d["id"],
                "name": d["description"],
                "severity": d["severity"],
            }
            for d in rule_result.details
        ]
        llm_dict = _safe_llm(judge, text, rules=rules_for_llm)

    # ---- 3. 合并结果 ----
    final_level, final_intents = _merge(rule_result, llm_dict)

    latency_ms = (time.perf_counter() - started) * 1000

    # ---- 4. 写审计日志（fail-open）----
    audit_id = None
    if db is not None:
        audit_id = _write_audit(
            db=db,
            text=text,
            user_id=user_id,
            conversation_id=conversation_id,
            final_level=final_level,
            rule_result=rule_result,
            llm_dict=llm_dict,
            mode=mode,
            biz_type=biz_type,
            biz_id=biz_id,
            latency_ms=latency_ms,
        )

    return {
        "risk_level": final_level,
        "matched_rules": list(rule_result.matched_rules),
        "matched_intents": final_intents,
        "rule_result": rule_result.to_dict(),
        "llm_result": llm_dict,
        "audit_id": audit_id,
        "latency_ms": latency_ms,
        "mode": mode,
        "biz_type": biz_type,
        "biz_id": biz_id,
    }


# ---- helpers ----------------------------------------------------------------


def _safe_llm(judge: LLMJudgeLike, text: str, *, rules: list[dict]) -> dict | None:
    """调用 LLM 判定，失败时返回 None（不抛异常）。"""
    try:
        return judge.assess(text, rules=rules)
    except Exception as exc:  # 任意异常都降级
        logger.warning(
            "LLMJudge 失败，合并阶段将忽略 LLM 结果 | error=%s",
            exc,
        )
        return None


def _merge(rule_result: RuleResult, llm_dict: dict | None) -> tuple[str, list[str]]:
    """合并规则 + LLM 结果。

    策略：
    - LLM 给出有效风险等级（low/medium/high）时，最终等级取 LLM 与 Rule 的较高者
    - LLM 失败或 unknown 时，回退到 Rule 的等级
    - matched_intents 始终是规则意图 + LLM matched_intents 去重拼接
    """
    rule_level = rule_result.risk_level or "low"
    rule_intents = list(rule_result.matched_intents)

    if not llm_dict:
        return rule_level, rule_intents

    llm_level = str(llm_dict.get("risk_level", "low")).lower()
    if llm_level not in ("low", "medium", "high"):
        llm_level = "low"

    final_level = _max_severity([rule_level, llm_level])

    # 合并意图：规则意图 + LLM 给的意图，去重保序
    llm_intents = llm_dict.get("matched_intents") or []
    if not isinstance(llm_intents, list):
        llm_intents = []
    merged_intents: list[str] = []
    seen: set[str] = set()
    for item in [*rule_intents, *(str(x) for x in llm_intents if x)]:
        key = item.strip()
        if not key or key in seen:
            continue
        seen.add(key)
        merged_intents.append(key)

    return final_level, merged_intents


def _max_severity(levels: list[str]) -> str:
    rank = {"low": 0, "medium": 1, "high": 2}
    best = "low"
    for lv in levels:
        if rank.get(lv, 0) > rank[best]:
            best = lv
    return best


def _write_audit(
    *,
    db: Session,
    text: str,
    user_id: int | None,
    conversation_id: int | None,
    final_level: str,
    rule_result: RuleResult,
    llm_dict: dict | None,
    mode: str,
    biz_type: str,
    biz_id: str,
    latency_ms: float,
) -> int | None:
    """写审计日志；失败不抛异常。"""
    blocked = final_level == "high"
    block_reason = None
    if blocked:
        block_reason = "high risk: " + "; ".join(rule_result.matched_intents[:3]) or "high risk"

    llm_level = None
    llm_intents: list[str] = []
    if llm_dict:
        raw_level = llm_dict.get("risk_level")
        if isinstance(raw_level, str):
            llm_level = raw_level
        llm_intents = [str(x) for x in (llm_dict.get("matched_intents") or []) if x]

    scenario = {
        "mode": mode,
        "biz_type": biz_type,
        "biz_id": biz_id,
        "final_risk_level": final_level,
        "rule_risk_level": rule_result.risk_level,
        "rule_matched": list(rule_result.matched_rules),
        "llm_risk_level": llm_level,
        "llm_matched_intents": llm_intents,
        "llm_reasoning": (llm_dict or {}).get("reasoning") if llm_dict else None,
    }

    payload = AuditPayload(
        user_id=user_id if user_id is not None else 0,
        conversation_id=conversation_id,
        request_id=biz_id[:64],
        provider="rule_engine" if mode != "llm_only" else "llm_judge",
        model="combined" if mode == "combined" else mode,
        prompt=text,
        answer=(llm_dict or {}).get("reasoning") if llm_dict else None,
        pii_detected={},
        risk_hits=list(rule_result.matched_rules),
        blocked=blocked,
        block_reason=block_reason,
        latency_ms=latency_ms,
        scenario=scenario,
    )
    try:
        record = write_audit_log(
            db,
            payload,
            preview_chars=settings.SANDBOX_PREVIEW_CHARS,
        )
        return record.id
    except Exception as exc:
        # fail-open：审计失败不影响业务结果
        logger.error(
            "审计日志写入失败（已降级）| user_id=%s biz=%s/%s error=%s",
            user_id,
            biz_type,
            biz_id,
            exc,
        )
        return None


def _write_audit_kill_switch(
    *,
    db: Session,
    text: str,
    user_id: int | None,
    conversation_id: int | None,
    biz_type: str,
    biz_id: str,
    ks_reason: str,
) -> int | None:
    """写 kill_switch 触发时的审计日志；失败不抛异常。"""
    scenario = {
        "event_type": "kill_switch_triggered",
        "biz_type": biz_type,
        "biz_id": biz_id,
        "ks_reason": ks_reason,
    }
    payload = AuditPayload(
        user_id=user_id if user_id is not None else 0,
        conversation_id=conversation_id,
        request_id=biz_id[:64],
        provider="-",
        model="-",
        prompt=text,
        answer=None,
        pii_detected={},
        risk_hits=["kill_switch_activated"],
        blocked=True,
        block_reason=f"SANDBOX_KILLED: {ks_reason}",
        latency_ms=None,
        scenario=scenario,
    )
    try:
        record = write_audit_log(
            db,
            payload,
            preview_chars=settings.SANDBOX_PREVIEW_CHARS,
        )
        return record.id
    except Exception as exc:
        logger.error("KillSwitch 审计写入失败（已降级）| user_id=%s error=%s", user_id, exc)
        return None


def _default_gateway():
    """延迟导入默认 LLM Gateway，避免 service import 期循环依赖。"""
    from app.ai.llm_gateway import llm_gateway

    return llm_gateway


__all__ = ["check_text", "VALID_MODES", "LLM_TRIGGER_LEVELS"]
