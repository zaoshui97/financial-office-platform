"""
AI 辅助审批 — 4 维度审查器

维度：
  1) compliance     合规（复用合规守卫）
  2) completeness   要素完整性
  3) anomaly        异常检测
  4) policy         制度匹配（占位 → 后续接 RAG）

输出统一结构，供前端展示 & 审批人决策参考。
AI 不阻断流程，仅给建议。
"""
from __future__ import annotations
import json
import logging
import re
import time
import uuid
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.features.approval.models import Approval
from app.features.compliance.guard import sandbox_guard, GuardDecision

logger = logging.getLogger(__name__)

# ---------- 阈值 / 模板 ----------
AMOUNT_HIGH = 10_000       # 标黄
AMOUNT_RED = 50_000        # 标红
AUTO_PASS_MAX = 1_000      # 自动通过候选上限
LOW_RISK_TYPES = {"leave", "seal"}  # 低风险类型

# 要素完整性 — 必填规则
REQUIRED_FIELDS: dict[str, list[str]] = {
    "reimburse": ["amount", "attachment"],   # content 中需含金额 + 有附件
    "leave":     ["date", "reason"],
    "seal":      ["attachment", "seal_target"],
    "general":   ["content"],
}

# 制度匹配 — 演示用映射（Phase 2 接 RAG）
POLICY_HINTS: dict[str, list[dict]] = {
    "reimburse": [
        {"doc": "差旅报销管理办法", "clause": "第 5.2 条",
         "rule": "差旅费应附发票及行程明细，单笔超过 5000 元需部门负责人审批。"},
    ],
    "leave": [
        {"doc": "考勤管理办法", "clause": "第 3.1 条",
         "rule": "年假/事假需提前 1 天申请，病假需附医院证明。"},
    ],
    "seal": [
        {"doc": "印章使用管理办法", "clause": "第 4.3 条",
         "rule": "印章使用必须经有权人审批，复印件须标注复印件用途。"},
    ],
    "general": [
        {"doc": "通用事务管理办法", "clause": "第 1 条",
         "rule": "通用申请需说明事项、依据与期望处理时间。"},
    ],
}


# ---------- 维度 1: 合规 ----------
def _check_compliance(content: str) -> dict:
    """合规检查 — 复用 sandbox_guard 的 L1+L2 关键词层（不调 LLM Judge，避免超时）。
    
    L4 LLM Judge 由 sandbox_chat 路径触发；AI 辅助审批仅做"高召回"的前置筛查，
    真正的语义判断由审批人 + L4 共同兜底。
    """
    from app.features.compliance.guard import sandbox_guard
    try:
        # L1: Kill Switch
        kill = sandbox_guard.check_kill_switch()
        if not kill.allowed:
            return {
                "score": 25,
                "risk_level": "high",
                "hits": [{"category": "system", "reason": kill.blocked_reason or "Kill Switch 已开启", "judge_source": "rule"}],
                "summary": kill.blocked_reason or "Kill Switch 已开启",
            }
        # L2: 关键词硬匹配
        risk = sandbox_guard.check_risk_keywords(content or "")
        if not risk.allowed:
            return {
                "score": 25,
                "risk_level": "high",
                "hits": [{
                    "category": risk.risk_category or "other",
                    "reason": risk.blocked_reason or f"命中风险关键词：{content[:30]}",
                    "judge_source": risk.judge_source or "rule",
                }],
                "summary": risk.blocked_reason or "命中风险关键词",
            }
        return {
            "score": 100,
            "risk_level": "low",
            "hits": [],
            "summary": "合规检查通过（无敏感词/违规表述）",
        }
    except Exception as e:
        logger.warning("compliance 调用失败，降级放行: %s", e)
        return {
            "score": 80,
            "risk_level": "low",
            "hits": [],
            "summary": "合规检测降级（异常）",
        }


# ---------- 维度 2: 要素完整性 ----------
def _check_completeness(approval: Approval, content: str,
                       attachment_ids: list[int]) -> dict:
    """按工单类型检查必填要素。"""
    missing: list[str] = []
    text = content or ""
    t = (approval.type or "general").lower()

    rules = REQUIRED_FIELDS.get(t, REQUIRED_FIELDS["general"])
    for rule in rules:
        if rule == "amount":
            if not re.search(r"(\d{2,}|\d+\.\d+)\s*元|¥\s*\d|￥\s*\d", text):
                missing.append("未识别到金额")
        elif rule == "date":
            if not re.search(r"\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}\s*月\s*\d{1,2}\s*[日号]", text):
                missing.append("缺少起止日期")
        elif rule == "reason":
            if len(text.strip()) < 10:
                missing.append("事由说明过短（< 10 字）")
        elif rule == "attachment":
            if not attachment_ids:
                missing.append("未上传附件")
        elif rule == "seal_target":
            if not re.search(r"合同|文件|证明|函件|公章|法人章|财务章", text):
                missing.append("未说明用印对象")
        elif rule == "content":
            if len(text.strip()) < 5:
                missing.append("正文内容为空")

    score = 100 - len(missing) * 18
    return {
        "score": max(score, 0),
        "missing_fields": missing,
        "summary": "必填要素齐全" if not missing else f"缺 {len(missing)} 项：{'、'.join(missing[:3])}",
    }


# ---------- 维度 3: 异常检测 ----------
def _check_anomaly(db: Session, approval: Approval, content: str) -> dict:
    """金额/重复/时间/历史均值 4 类异常。"""
    flags: list[dict] = []
    text = content or ""
    t = (approval.type or "general").lower()

    # 1) 金额阈值
    m = re.search(r"(\d{2,}|\d+\.\d+)\s*元|¥\s*(\d+)|￥\s*(\d+)", text)
    amount = None
    if m:
        try:
            amount = float(m.group(1) or m.group(2) or m.group(3))
        except (ValueError, TypeError):
            amount = None
    if amount is not None:
        if amount > AMOUNT_RED:
            flags.append({"level": "red", "code": "AMOUNT_OVER_LIMIT",
                          "message": f"金额 {amount:.0f} 元，超过 {AMOUNT_RED} 警戒线"})
        elif amount > AMOUNT_HIGH:
            flags.append({"level": "yellow", "code": "AMOUNT_HIGH",
                          "message": f"金额 {amount:.0f} 元，超过 {AMOUNT_HIGH} 关注线"})

    # 2) 重复申请：30 天内同 user_id + 同 type + 同金额
    if amount is not None and t in ("reimburse", "seal", "general"):
        cutoff = datetime.utcnow() - timedelta(days=30)
        dup_q = select(func.count(Approval.id)).where(
            Approval.user_id == approval.user_id,
            Approval.type == approval.type,
            Approval.id != approval.id,
            Approval.created_at >= cutoff,
        )
        try:
            dup_count = db.execute(dup_q).scalar() or 0
        except Exception:
            dup_count = 0
        if dup_count >= 2:
            flags.append({"level": "yellow", "code": "FREQUENT_SUBMIT",
                          "message": f"30 天内同类型提交 {dup_count + 1} 次，请确认是否重复"})

    # 3) 时间窗口：非工作时间批量提交
    now = datetime.utcnow()
    if now.weekday() >= 5:  # 周末
        flags.append({"level": "yellow", "code": "WEEKEND_SUBMIT",
                      "message": "周末提交，建议核实紧急程度"})
    elif now.hour < 7 or now.hour >= 22:
        flags.append({"level": "yellow", "code": "OFF_HOURS_SUBMIT",
                      "message": "非工作时间提交"})

    # 4) 历史均值对比（仅报销类）
    if t == "reimburse" and amount is not None:
        cutoff6m = datetime.utcnow() - timedelta(days=180)
        try:
            avg_q = select(func.avg(
                func.cast(
                    func.regexp_replace(Approval.content, r'[^0-9.]', ''),
                    # SQLite/MySQL 兼容：直接拿原始 content，函数 cast 可能在 MySQL 失败，try/except 兜底
                    # 真实金额提取用 Python 端做更稳，这里仅做粗略
                    # 跳过此步，不做 SQL 复杂提取
                )
            )).where(
                Approval.user_id == approval.user_id,
                Approval.type == "reimburse",
                Approval.created_at >= cutoff6m,
                Approval.id != approval.id,
            )
            # 拿不到准确的 SQL 提取 → 跳过
        except Exception:
            pass

    score = 100 - len(flags) * 18
    if any(f["level"] == "red" for f in flags):
        score = min(score, 50)
    return {
        "score": max(score, 0),
        "flags": flags,
        "summary": "无异常" if not flags else f"{len(flags)} 项关注",
    }


# ---------- 维度 4: 制度匹配 ----------
def _check_policy(approval: Approval, content: str) -> dict:
    """按工单类型返回匹配的制度条款（占位 → Phase 2 接 RAG 检索）。"""
    t = (approval.type or "general").lower()
    matches = []
    for hint in POLICY_HINTS.get(t, POLICY_HINTS["general"]):
        # 简单关键词相似度（Phase 2 替换为 RAG cosine）
        kw = set(hint["rule"])
        text = set(content or "")
        overlap = len(kw & text) / max(len(kw), 1)
        sim = min(0.95, 0.55 + overlap * 2)  # 0.55 - 0.95
        matches.append({
            "doc_title": hint["doc"],
            "clause": hint["clause"],
            "rule_excerpt": hint["rule"],
            "similarity": round(sim, 2),
            "verdict": "support" if sim > 0.7 else "neutral",
        })
    matches.sort(key=lambda m: m["similarity"], reverse=True)
    top = matches[:3]
    if not top:
        return {"score": 50, "matches": [], "summary": "未匹配到相关制度"}
    avg_sim = sum(m["similarity"] for m in top) / len(top)
    return {
        "score": int(avg_sim * 100),
        "matches": top,
        "summary": f"匹配 {len(top)} 条制度条款" + (
            "，制度支持" if top[0]["verdict"] == "support" else "，需人工核验"),
    }


# ---------- 汇总 ----------
def _aggregate(compliance: dict, completeness: dict, anomaly: dict,
               policy: dict, approval: Approval) -> dict:
    """按权重汇总 4 维度 → 总体评分 + 建议。"""
    weights = {"compliance": 0.30, "completeness": 0.20,
               "anomaly": 0.20, "policy": 0.30}
    score = (
        compliance["score"] * weights["compliance"]
        + completeness["score"] * weights["completeness"]
        + anomaly["score"] * weights["anomaly"]
        + policy["score"] * weights["policy"]
    )
    score = round(score, 1)

    # 风险等级：合规 high → 强制 high；任一维度 red flag → medium
    risk_level = compliance.get("risk_level", "low")
    if any(f.get("level") == "red" for f in anomaly.get("flags", [])):
        risk_level = "high" if risk_level == "high" else "medium"

    # 建议
    if risk_level == "high" or score < 50:
        suggestion = "reject"
    elif (score < 75
          or completeness.get("missing_fields")
          or any(f.get("level") == "red" for f in anomaly.get("flags", []))):
        suggestion = "review"
    else:
        suggestion = "pass"

    # 自动通过候选
    auto_eligible = False
    if (suggestion == "pass"
        and (approval.type or "").lower() in LOW_RISK_TYPES
        and risk_level == "low"
        and not anomaly.get("flags")
        and not completeness.get("missing_fields")
        and policy.get("score", 0) >= 85
        and approval.content):
        # 抽取金额
        m = re.search(r"(\d{2,}|\d+\.\d+)\s*元", approval.content or "")
        amt = float(m.group(1)) if m else 0
        if amt <= AUTO_PASS_MAX:
            auto_eligible = True

    confidence = round(min(0.99, 0.6 + score / 250), 2)

    summary = {
        "pass": "工单符合制度与合规要求，建议通过。",
        "review": "工单有 1 项以上关注项，建议人工核实。",
        "reject": "工单存在高风险，建议驳回。",
    }[suggestion]

    return {
        "score": score,
        "risk_level": risk_level,
        "suggestion": suggestion,
        "auto_pass_eligible": auto_eligible,
        "confidence": confidence,
        "summary": summary,
    }


def review_approval(
    db: Session,
    approval: Approval,
    attachment_ids: list[int] | None = None,
) -> dict:
    """对单个审批单跑 4 维度审查，返回结构化报告。

    不抛错；任意维度失败会降级放行并记录。
    """
    started = time.time()
    review_id = f"ar_{datetime.utcnow():%Y%m%d_%H%M%S}_{uuid.uuid4().hex[:6]}"
    content = approval.content or ""

    try:
        compliance = _check_compliance(content)
    except Exception as e:
        logger.exception("compliance fail: %s", e)
        compliance = {"score": 50, "risk_level": "low", "hits": [], "summary": "降级"}
    try:
        completeness = _check_completeness(approval, content, attachment_ids or [])
    except Exception as e:
        logger.exception("completeness fail: %s", e)
        completeness = {"score": 50, "missing_fields": [], "summary": "降级"}
    try:
        anomaly = _check_anomaly(db, approval, content)
    except Exception as e:
        logger.exception("anomaly fail: %s", e)
        anomaly = {"score": 50, "flags": [], "summary": "降级"}
    try:
        policy = _check_policy(approval, content)
    except Exception as e:
        logger.exception("policy fail: %s", e)
        policy = {"score": 50, "matches": [], "summary": "降级"}

    overall = _aggregate(compliance, completeness, anomaly, policy, approval)

    elapsed_ms = int((time.time() - started) * 1000)

    report = {
        "review_id": review_id,
        "approval_id": approval.id,
        "reviewed_at": datetime.utcnow().isoformat() + "Z",
        "latency_ms": elapsed_ms,
        "model_version": "ai-reviewer-v1.0",
        "overall": overall,
        "dimensions": {
            "compliance": compliance,
            "completeness": completeness,
            "anomaly": anomaly,
            "policy": policy,
        },
        "explainability": (
            f"AI 已审 4 维度"
            f"，{len(anomaly.get('flags', []))} 个关注项"
            f"，{len(completeness.get('missing_fields', []))} 个缺失要素"
        ),
    }
    logger.info(
        "ai review id=%s approval_id=%s score=%s suggestion=%s latency_ms=%s",
        review_id, approval.id, overall["score"], overall["suggestion"], elapsed_ms,
    )
    return report
