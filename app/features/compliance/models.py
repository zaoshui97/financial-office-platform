"""合规审计域：合规沙箱 + 7 段链路指纹 + 金融合规规则 + 违规事件追踪（对应亮点二）。

包含 6 张核心表：
  - compliance_audit_logs   合规审计日志（沙箱场景的审计写入）
  - policy_rules             合规规则库（AC 自动机模式 + 9 大风险分类）
  - policy_violations        违规事件表（复核流程）
  - audit_logs               7 段链路指纹审计日志（防篡改链式哈希）
  - risk_alerts              风险告警表（分级响应）
  - user_sessions            增强版会话管理（AES-256 加密）
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from sqlalchemy import JSON, BigInteger, DateTime, Float, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin


class ComplianceAuditLog(TimestampMixin, Base):
    """合规沙箱单次调用的审计记录。"""

    __tablename__ = "compliance_audit_logs"

    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="调用用户ID",
    )
    conversation_id: Mapped[int | None] = mapped_column(
        BigInteger,
        nullable=True,
        comment="关联的聊天会话ID，可为空",
    )
    request_id: Mapped[str] = mapped_column(
        String(64), nullable=False, comment="AI 请求追踪 ID"
    )
    mode: Mapped[str] = mapped_column(
        String(32), nullable=False, comment="回答模式（compliance_sandbox）"
    )
    provider: Mapped[str] = mapped_column(
        String(64), nullable=False, comment="实际调用的 Provider 名称"
    )
    model: Mapped[str] = mapped_column(
        String(128), nullable=False, comment="实际调用的模型名"
    )
    prompt_hash: Mapped[str] = mapped_column(
        String(64), nullable=False, comment="原始 prompt 的 SHA-256 摘要"
    )
    prompt_length: Mapped[int] = mapped_column(
        BigInteger, nullable=False, comment="原始 prompt 字符数"
    )
    prompt_preview: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="原始 prompt 脱敏后前 500 字（永不含 PII 原文）",
    )
    answer_hash: Mapped[str | None] = mapped_column(
        String(64), nullable=True, comment="模型回答的 SHA-256 摘要"
    )
    answer_length: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, comment="模型回答字符数"
    )
    answer_preview: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="模型回答脱敏后前 500 字"
    )
    pii_detected: Mapped[dict[str, Any] | None] = mapped_column(
        JSON, nullable=True, comment="命中了哪些 PII 规则及次数"
    )
    risk_hits: Mapped[list[str] | None] = mapped_column(
        JSON, nullable=True, comment="命中了哪些风险词"
    )
    risk_category: Mapped[str | None] = mapped_column(
        String(32), nullable=True, comment="风险分类（money_laundering 等）"
    )
    confidence: Mapped[float | None] = mapped_column(
        Float, nullable=True, comment="Judge 置信度（0-1）"
    )
    judge_source: Mapped[str | None] = mapped_column(
        String(16), nullable=True, comment="判定来源 rule/llm_judge"
    )
    blocked: Mapped[bool] = mapped_column(
        nullable=False, default=False, comment="是否被拦截"
    )
    block_reason: Mapped[str | None] = mapped_column(
        String(128), nullable=True, comment="拦截原因"
    )
    latency_ms: Mapped[float | None] = mapped_column(
        Float, nullable=True, comment="调用耗时（毫秒）"
    )
    completed_at: Mapped[Any | None] = mapped_column(
        DateTime, nullable=True, comment="调用结束时间（含失败）"
    )
    scenario: Mapped[dict[str, Any] | None] = mapped_column(
        JSON, nullable=True,
        comment=(
            "调用场景元数据：mode(rule_only/llm_only/combined)、"
            "biz_type、biz_id、rule_risk_level、llm_risk_level 等"
        ),
    )

    __table_args__ = (
        Index("idx_compliance_audit_user_created", "user_id", "created_at"),
        Index("idx_compliance_audit_request", "request_id"),
        Index("idx_compliance_audit_blocked", "blocked"),
        Index("idx_compliance_audit_category", "risk_category"),
    )


# ============================================================================
# 7 段链路指纹审计 + 合规规则库 + 告警（亮点二：4 层防御 + 9 大风险分类）
# ============================================================================

from sqlalchemy import Float, ForeignKey
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import Mapped, mapped_column


class RiskLevelEnum(StrEnum):
    """风险等级。"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AlertTypeEnum(StrEnum):
    """告警类型。"""
    COMPLIANCE = "compliance"
    SECURITY = "security"
    ANOMALY = "anomaly"


class AlertStatusEnum(StrEnum):
    """告警状态。"""
    PENDING = "pending"
    PROCESSING = "processing"
    RESOLVED = "resolved"
    CLOSED = "closed"


class RuleTypeEnum(StrEnum):
    """规则类型。"""
    FORBIDDEN = "forbidden"
    RISKY = "risky"
    MONITOR = "monitor"


class RuleCategoryEnum(StrEnum):
    """风险分类（9 大类）。"""
    MONEY_LAUNDERING = "money_laundering"
    INSIDER_TRADING = "insider_trading"
    TAX_EVASION = "tax_evasion"
    BRIBERY = "bribery"
    PRIVACY_LEAK = "privacy_leak"
    ILLEGAL_COMMITMENT = "illegal_commitment"
    CONFLICT_OF_INTEREST = "conflict_of_interest"
    ILLEGAL_FINANCE = "illegal_finance"
    REGULATORY_EVASION = "regulatory_evasion"
    OTHER = "other"


class MatchModeEnum(StrEnum):
    """匹配模式。"""
    KEYWORD = "keyword"
    REGEX = "regex"
    EXACT = "exact"
    LLM = "llm"


class RuleActionEnum(StrEnum):
    """命中后动作。"""
    BLOCK = "block"
    REPLACE = "replace"
    REVIEW = "review"
    LOG = "log"


class SeverityEnum(StrEnum):
    """严重程度。"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ReviewStatusEnum(StrEnum):
    """复核状态。"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class SessionStatusEnum(StrEnum):
    """会话状态。"""
    ACTIVE = "active"
    EXPIRED = "expired"
    REVOKED = "revoked"


class AuditLog(TimestampMixin, Base):
    """7 段链路指纹审计日志：完整记录每次 AI 调用的全链路节点。"""

    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("idx_audit_trace", "trace_id"),
        Index("idx_audit_user", "user_id"),
        Index("idx_audit_session", "session_id"),
        Index("idx_audit_risk", "risk_level"),
        Index("idx_audit_created", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # 链路追踪
    trace_id: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False,
        comment="链路追踪ID（UUID）",
    )
    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="操作用户ID",
    )
    session_id: Mapped[str | None] = mapped_column(
        String(64),
        comment="会话ID（chat_conversations.id）",
    )

    # 输入输出（脱敏）
    request_text: Mapped[str | None] = mapped_column(
        Text,
        comment="用户输入（脱敏后，最多前 1000 字）",
    )
    request_hash: Mapped[str] = mapped_column(
        String(64), nullable=False,
        comment="输入 SHA-256 摘要",
    )

    # === 7 段链路指纹 ===
    stage_1_intent_parse: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        comment="①意图解析 {intent, entities, confidence, latency_ms}",
    )
    stage_2_rag_retrieval: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        comment="②RAG检索 {query, top_k, hits, sources, latency_ms}",
    )
    stage_3_prompt_construction: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        comment="③Prompt构造 {template, variables, context_chunks, token_count}",
    )
    stage_4_model_call: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        comment="④模型调用 {provider, model, prompt_tokens, completion_tokens, latency_ms}",
    )
    stage_5_output_validation: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        comment="⑤输出校验 {compliant, risk_level, hits, pii_detected}",
    )
    stage_6_user_confirmation: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        comment="⑥用户确认 {confirmed, modified, feedback}",
    )
    stage_7_action_execution: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        comment="⑦执行落地 {action_type, target, result, latency_ms}",
    )

    # 元数据
    risk_level: Mapped[str | None] = mapped_column(
        String(20),
        comment="low/medium/high/critical",
    )
    policy_violation_id: Mapped[int | None] = mapped_column(
        BigInteger,
        comment="命中的违规规则ID",
    )
    is_blocked: Mapped[bool] = mapped_column(
        default=False,
        comment="是否被拦截",
    )
    final_response: Mapped[str | None] = mapped_column(
        Text,
        comment="最终输出（脱敏后，最多前 1000 字）",
    )

    # 防篡改链式哈希
    log_hash: Mapped[str] = mapped_column(
        String(64), nullable=False,
        comment="SM3 哈希（链式）",
    )
    prev_log_hash: Mapped[str | None] = mapped_column(
        String(64),
        comment="上一条日志的哈希（链头为空）",
    )
    is_tampered: Mapped[bool] = mapped_column(
        default=False,
        comment="是否被检测到篡改",
    )


class PolicyRule(TimestampMixin, Base):
    """合规规则库：金融行业 9 大风险分类规则。"""

    __tablename__ = "policy_rules"
    __table_args__ = (
        Index("idx_rule_code", "rule_code", unique=True),
        Index("idx_rule_category", "rule_category"),
        Index("idx_rule_active", "is_active"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    rule_code: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False,
        comment="规则编码（唯一）",
    )
    rule_name: Mapped[str] = mapped_column(
        String(200), nullable=False,
        comment="规则名称",
    )
    rule_type: Mapped[str] = mapped_column(
        String(50),
        default=RuleTypeEnum.RISKY.value,
        comment="规则类型",
    )
    rule_category: Mapped[str] = mapped_column(
        String(50),
        default=RuleCategoryEnum.OTHER.value,
        comment="风险分类（9 大类）",
    )
    industry: Mapped[str] = mapped_column(
        String(50),
        default="financial",
        comment="适用行业",
    )

    match_pattern: Mapped[str] = mapped_column(
        Text, nullable=False,
        comment="匹配模式（关键词/正则/AC自动机）",
    )
    match_mode: Mapped[str] = mapped_column(
        String(20),
        default=MatchModeEnum.KEYWORD.value,
        comment="匹配模式",
    )
    action: Mapped[str] = mapped_column(
        String(20),
        default=RuleActionEnum.LOG.value,
        comment="命中后动作",
    )
    severity: Mapped[str] = mapped_column(
        String(20),
        default=SeverityEnum.MEDIUM.value,
        comment="严重程度",
    )
    regulation_ref: Mapped[str | None] = mapped_column(
        String(500),
        comment="引用法规",
    )

    is_active: Mapped[bool] = mapped_column(
        default=True,
        comment="是否启用",
    )
    version: Mapped[int] = mapped_column(
        default=1,
        comment="规则版本号",
    )
    effective_date: Mapped[str | None] = mapped_column(
        String(10),
        comment="生效日期（YYYY-MM-DD）",
    )
    expiry_date: Mapped[str | None] = mapped_column(
        String(10),
        comment="失效日期",
    )
    created_by: Mapped[int | None] = mapped_column(
        BigInteger,
        comment="创建人用户ID",
    )


class PolicyViolation(TimestampMixin, Base):
    """违规事件表：记录每次命中规则后的复核流程。"""

    __tablename__ = "policy_violations"
    __table_args__ = (
        Index("idx_violation_audit", "audit_log_id"),
        Index("idx_violation_rule", "rule_id"),
        Index("idx_violation_user", "user_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    audit_log_id: Mapped[int | None] = mapped_column(
        BigInteger,
        comment="关联审计日志ID",
    )
    rule_id: Mapped[int] = mapped_column(
        BigInteger,
        comment="命中的规则ID",
    )
    user_id: Mapped[int | None] = mapped_column(
        BigInteger,
        comment="操作用户ID",
    )
    violated_text: Mapped[str | None] = mapped_column(
        Text,
        comment="违规内容（脱敏后）",
    )
    regulation_reference: Mapped[str | None] = mapped_column(
        String(500),
        comment="引用法规",
    )
    action_taken: Mapped[str | None] = mapped_column(
        String(50),
        comment="处理动作（拦截/替换/人工复核）",
    )
    review_status: Mapped[str] = mapped_column(
        String(20),
        default=ReviewStatusEnum.PENDING.value,
        comment="复核状态",
    )
    reviewer_id: Mapped[int | None] = mapped_column(
        BigInteger,
        comment="复核人用户ID",
    )
    review_comment: Mapped[str | None] = mapped_column(
        Text,
        comment="复核意见",
    )
    reviewed_at: Mapped[str | None] = mapped_column(
        String(19),
        comment="复核时间",
    )


class RiskAlert(TimestampMixin, Base):
    """风险告警表：分级响应机制。"""

    __tablename__ = "risk_alerts"
    __table_args__ = (
        Index("idx_alert_type", "alert_type"),
        Index("idx_alert_level", "risk_level"),
        Index("idx_alert_status", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    alert_no: Mapped[str] = mapped_column(
        String(50), unique=True,
        comment="告警编号",
    )
    alert_type: Mapped[str] = mapped_column(
        String(50),
        default=AlertTypeEnum.COMPLIANCE.value,
        comment="告警类型",
    )
    risk_level: Mapped[str] = mapped_column(
        String(20),
        default=RiskLevelEnum.MEDIUM.value,
        comment="风险等级",
    )
    source: Mapped[str | None] = mapped_column(
        String(50),
        comment="触发源",
    )
    title: Mapped[str] = mapped_column(
        String(200), nullable=False,
        comment="告警标题",
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        comment="告警描述",
    )

    related_user_id: Mapped[int | None] = mapped_column(
        BigInteger,
        comment="关联用户ID",
    )
    related_session_id: Mapped[str | None] = mapped_column(
        String(64),
        comment="关联会话ID",
    )
    related_audit_id: Mapped[int | None] = mapped_column(
        BigInteger,
        comment="关联审计日志ID",
    )

    status: Mapped[str] = mapped_column(
        String(20),
        default=AlertStatusEnum.PENDING.value,
        comment="告警状态",
    )
    assignee_id: Mapped[int | None] = mapped_column(
        BigInteger,
        comment="处理人用户ID",
    )
    resolution: Mapped[str | None] = mapped_column(
        Text,
        comment="处理结果",
    )
    resolved_at: Mapped[str | None] = mapped_column(
        String(19),
        comment="解决时间",
    )


class UserSession(Base):
    """增强版会话管理：AES-256 加密会话内容。"""

    __tablename__ = "user_sessions"
    __table_args__ = (
        Index("idx_session_user", "user_id"),
        Index("idx_session_expires", "expires_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    session_id: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False,
        comment="会话ID（UUID）",
    )
    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="用户ID",
    )

    device_fingerprint: Mapped[str | None] = mapped_column(
        String(255),
        comment="设备指纹（哈希）",
    )
    ip_address: Mapped[str | None] = mapped_column(
        String(50),
        comment="IP地址",
    )
    user_agent: Mapped[str | None] = mapped_column(
        Text,
        comment="User-Agent",
    )

    encrypted_payload: Mapped[str | None] = mapped_column(
        Text().with_variant(LONGTEXT, "mysql"),
        comment="AES-256 加密的会话上下文",
    )
    encryption_key_id: Mapped[str | None] = mapped_column(
        String(64),
        comment="加密密钥ID（KMS 引用）",
    )

    status: Mapped[str] = mapped_column(
        String(20),
        default=SessionStatusEnum.ACTIVE.value,
        comment="会话状态",
    )
    created_at: Mapped[str] = mapped_column(
        String(19),
        nullable=False,
        server_default="CURRENT_TIMESTAMP",
        comment="创建时间",
    )
    last_active_at: Mapped[str | None] = mapped_column(
        String(19),
        comment="最后活跃时间",
    )
    expires_at: Mapped[str | None] = mapped_column(
        String(19),
        comment="过期时间",
    )