"""决策智能域：法规管理 + 行业资讯 + 决策回放（对应亮点三）。

包含 6 张核心表：
  - regulations           法规主表
  - regulation_versions   法规版本表
  - regulation_diff_reports 法规差异对比报告
  - industry_news        行业资讯表
  - business_impact      业务影响评估表
  - decision_playbacks   决策回放表（不可篡改）
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin


# ---------- 枚举定义 ----------

class RegulationStatus(StrEnum):
    """法规状态。"""
    ACTIVE = "active"
    EXPIRED = "expired"
    DRAFT = "draft"


class RegulationCategory(StrEnum):
    """法规分类。"""
    SUPERVISION = "supervision"  # 监管类
    COMPLIANCE = "compliance"    # 合规类
    DISCLOSURE = "disclosure"    # 信息披露
    RISK_MANAGEMENT = "risk_management"  # 风险管理
    PRODUCT = "product"         # 产品类
    OTHER = "other"


class Industry(StrEnum):
    """行业分类。"""
    BANKING = "banking"    # 银行
    SECURITIES = "securities"  # 证券
    FUND = "fund"        # 基金
    INSURANCE = "insurance"  # 保险
    TRUST = "trust"      # 信托
    GENERAL = "general"  # 通用


class NewsCategory(StrEnum):
    """资讯分类。"""
    SUPERVISION = "supervision"  # 监管动态
    MARKET = "market"           # 市场资讯
    COMPETITOR = "competitor"   # 竞品动态
    POLICY = "policy"          # 政策解读
    OTHER = "other"


class ImportanceLevel(StrEnum):
    """重要程度。"""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ImpactLevel(StrEnum):
    """影响等级。"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class DecisionType(StrEnum):
    """决策类型。"""
    COMPLIANCE_REVIEW = "compliance_review"   # 合规审查
    RISK_RESPONSE = "risk_response"         # 风险响应
    BUSINESS_ADJUSTMENT = "business_adjustment"  # 业务调整


class EventType(StrEnum):
    """事件类型。"""
    REGULATION = "regulation"     # 法规变更
    NEWS = "news"               # 行业资讯
    INTERNAL = "internal"       # 内部事件


# ---------- 表定义 ----------

class Regulation(TimestampMixin, Base):
    """法规主表。"""

    __tablename__ = "regulations"
    __table_args__ = (
        Index("idx_regulation_code", "regulation_code", unique=True),
        Index("idx_regulation_industry", "industry"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # 法规标识
    regulation_code: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False,
        comment="法规编号",
    )
    title: Mapped[str] = mapped_column(
        String(500), nullable=False,
        comment="法规标题",
    )
    issuing_authority: Mapped[str | None] = mapped_column(
        String(200),
        comment="颁布机构",
    )

    # 分类
    industry: Mapped[str] = mapped_column(
        String(50),
        default=Industry.BANKING.value,
        comment="适用行业",
    )
    category: Mapped[str] = mapped_column(
        String(100),
        default=RegulationCategory.SUPERVISION.value,
        comment="法规分类",
    )

    # 生命周期
    effective_date: Mapped[str | None] = mapped_column(
        String(10),
        comment="生效日期",
    )
    expiry_date: Mapped[str | None] = mapped_column(
        String(10),
        comment="失效日期",
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default=RegulationStatus.ACTIVE.value,
        comment="法规状态",
    )
    source_url: Mapped[str | None] = mapped_column(
        String(500),
        comment="原文链接",
    )


class RegulationVersion(TimestampMixin, Base):
    """法规版本表。"""

    __tablename__ = "regulation_versions"
    __table_args__ = (
        Index("idx_version_regulation", "regulation_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    regulation_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("regulations.id", ondelete="CASCADE"),
        nullable=False,
        comment="法规ID",
    )
    version_no: Mapped[str] = mapped_column(
        String(20), nullable=False,
        comment="版本号",
    )
    document_file_id: Mapped[int | None] = mapped_column(
        BigInteger,
        comment="关联文档ID（knowledge_documents.id）",
    )
    full_text: Mapped[str | None] = mapped_column(
        Text().with_variant(LONGTEXT, "mysql"),
        comment="法规全文",
    )
    effective_date: Mapped[str | None] = mapped_column(
        String(10),
        comment="生效日期",
    )
    is_current: Mapped[bool] = mapped_column(
        default=False,
        comment="是否为当前版本",
    )


class RegulationDiffReport(TimestampMixin, Base):
    """法规差异对比报告。"""

    __tablename__ = "regulation_diff_reports"
    __table_args__ = (
        Index("idx_diff_regulation", "regulation_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    regulation_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("regulations.id", ondelete="CASCADE"),
        nullable=False,
        comment="法规ID",
    )
    old_version_id: Mapped[int | None] = mapped_column(
        BigInteger,
        comment="旧版本ID",
    )
    new_version_id: Mapped[int | None] = mapped_column(
        BigInteger,
        comment="新版本ID",
    )
    diff_summary: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        comment="差异摘要 {major: [], general: [], new: []}",
    )
    detailed_changes: Mapped[str | None] = mapped_column(
        Text().with_variant(LONGTEXT, "mysql"),
        comment="详细变更内容",
    )
    impact_analysis: Mapped[str | None] = mapped_column(
        Text,
        comment="影响分析",
    )
    affected_business: Mapped[list[str] | None] = mapped_column(
        JSON,
        comment="受影响业务 [{department, business, impact_level}]",
    )
    ai_model: Mapped[str | None] = mapped_column(
        String(50),
        comment="生成模型",
    )
    generated_at: Mapped[str | None] = mapped_column(
        String(19),
        comment="生成时间",
    )
    generated_by: Mapped[int | None] = mapped_column(
        BigInteger,
        comment="生成人用户ID",
    )


class IndustryNews(TimestampMixin, Base):
    """行业资讯表。"""

    __tablename__ = "industry_news"
    __table_args__ = (
        Index("idx_news_published", "published_at"),
        Index("idx_news_industry", "industry"),
        Index("idx_news_importance", "importance_level"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # 基本信息
    title: Mapped[str] = mapped_column(
        String(500), nullable=False,
        comment="资讯标题",
    )
    source: Mapped[str | None] = mapped_column(
        String(100),
        comment="来源网站",
    )
    source_url: Mapped[str | None] = mapped_column(
        String(500),
        comment="原文链接",
    )
    published_at: Mapped[str | None] = mapped_column(
        String(19),
        comment="发布时间",
    )

    # 分类
    industry: Mapped[str] = mapped_column(
        String(50),
        default=Industry.BANKING.value,
        comment="行业",
    )
    category: Mapped[str] = mapped_column(
        String(100),
        default=NewsCategory.SUPERVISION.value,
        comment="资讯分类",
    )

    # 内容
    summary: Mapped[str | None] = mapped_column(
        Text,
        comment="AI 摘要",
    )
    full_text: Mapped[str | None] = mapped_column(
        Text().with_variant(LONGTEXT, "mysql"),
        comment="完整正文",
    )
    importance_level: Mapped[str] = mapped_column(
        String(20),
        default=ImportanceLevel.MEDIUM.value,
        comment="重要程度",
    )

    # 推送状态
    is_pushed: Mapped[bool] = mapped_column(
        default=False,
        comment="是否已推送",
    )
    pushed_at: Mapped[str | None] = mapped_column(
        String(19),
        comment="推送时间",
    )

    # 标签
    tags: Mapped[list[str] | None] = mapped_column(
        JSON,
        comment="标签列表",
    )


class BusinessImpact(TimestampMixin, Base):
    """业务影响评估表。"""

    __tablename__ = "business_impact"
    __table_args__ = (
        Index("idx_impact_type", "event_type"),
        Index("idx_impact_level", "impact_level"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # 事件信息
    event_type: Mapped[str] = mapped_column(
        String(50),
        default=EventType.REGULATION.value,
        comment="事件类型",
    )
    event_id: Mapped[int | None] = mapped_column(
        BigInteger,
        comment="关联事件ID",
    )
    event_title: Mapped[str | None] = mapped_column(
        String(500),
        comment="事件标题",
    )

    # 影响评估
    impact_level: Mapped[str] = mapped_column(
        String(20),
        default=ImpactLevel.MEDIUM.value,
        comment="影响等级",
    )
    impact_scope: Mapped[list[str] | None] = mapped_column(
        JSON,
        comment="影响范围 [{type, scope, description}]",
    )
    affected_departments: Mapped[list[str] | None] = mapped_column(
        JSON,
        comment="受影响部门列表",
    )
    predicted_actions: Mapped[list[dict[str, Any]] | None] = mapped_column(
        JSON,
        comment="建议处理事项 [{action, priority, deadline}]",
    )
    ai_model: Mapped[str | None] = mapped_column(
        String(50),
        comment="评估模型",
    )
    confidence: Mapped[float | None] = mapped_column(
        comment="置信度（0-1）",
    )


class DecisionPlayback(TimestampMixin, Base):
    """决策回放表：记录 AI 辅助决策的全链路推理过程（不可篡改哈希）。"""

    __tablename__ = "decision_playbacks"
    __table_args__ = (
        Index("idx_playback_type", "decision_type"),
        Index("idx_playback_created", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # 决策标识
    decision_no: Mapped[str] = mapped_column(
        String(50), unique=True,
        comment="决策编号",
    )
    decision_type: Mapped[str] = mapped_column(
        String(50),
        default=DecisionType.COMPLIANCE_REVIEW.value,
        comment="决策类型",
    )
    title: Mapped[str] = mapped_column(
        String(200), nullable=False,
        comment="决策标题",
    )

    # 决策内容
    context: Mapped[str | None] = mapped_column(
        Text,
        comment="决策背景",
    )
    data_sources: Mapped[list[dict[str, Any]] | None] = mapped_column(
        JSON,
        comment="数据来源 [{source_type, source_id, description}]",
    )
    reasoning_chain: Mapped[str | None] = mapped_column(
        Text().with_variant(LONGTEXT, "mysql"),
        comment="推理链（完整思考过程）",
    )
    participants: Mapped[list[str] | None] = mapped_column(
        JSON,
        comment="参与角色 [{role, id, name}]",
    )
    final_decision: Mapped[str | None] = mapped_column(
        Text,
        comment="最终决策",
    )
    outcome: Mapped[str | None] = mapped_column(
        Text,
        comment="决策结果",
    )

    # 防篡改
    is_tampered: Mapped[bool] = mapped_column(
        default=False,
        comment="是否检测到篡改",
    )
    decision_hash: Mapped[str | None] = mapped_column(
        String(64),
        comment="不可篡改哈希（SM3）",
    )
    created_by: Mapped[int | None] = mapped_column(
        BigInteger,
        comment="创建人用户ID",
    )
