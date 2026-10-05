"""机构域：多租户隔离 + 金融业务实体。

包含 3 张核心表：
  - organizations       机构/租户表（多租户隔离根表）
  - departments         部门表
  - business_domains    业务领域表（经纪/资管/投行/风控/合规）
  - customer_types       客户类型表（普通/专业/机构）
"""

from __future__ import annotations

from enum import StrEnum

from sqlalchemy import (
    BigInteger,
    ForeignKey,
    Index,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin


# ---------- 枚举定义 ----------

class OrgType(StrEnum):
    """机构类型。"""
    BANK = "bank"
    SECURITIES = "securities"
    FUND = "fund"
    INSURANCE = "insurance"
    TRUST = "trust"
    OTHER = "other"


class OrgStatus(StrEnum):
    """机构状态。"""
    ACTIVE = "active"
    SUSPENDED = "suspended"
    TERMINATED = "terminated"


class RiskPreference(StrEnum):
    """客户风险偏好。"""
    CONSERVATIVE = "conservative"  # 保守型
    BALANCED = "balanced"          # 稳健型
    AGGRESSIVE = "aggressive"      # 激进型


# ---------- 表定义 ----------

class Organization(TimestampMixin, Base):
    """机构/租户表：金融 SaaS 多租户隔离根表。

    设计要点：
      - 机构是数据隔离的最高层级（用户 → 机构 → 部门）
      - credit_code（统一社会信用代码）和 license_no（金融许可证号）体现金融属性
      - 机构级配置通过 JSON 字段扩展
    """

    __tablename__ = "organizations"
    __table_args__ = (
        Index("idx_org_code", "credit_code", unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # 基本信息
    name: Mapped[str] = mapped_column(
        String(200), nullable=False,
        comment="机构名称",
    )
    org_type: Mapped[str] = mapped_column(
        String(20),
        default=OrgType.BANK.value,
        comment="机构类型",
    )
    credit_code: Mapped[str | None] = mapped_column(
        String(50),
        unique=True,
        comment="统一社会信用代码",
    )
    license_no: Mapped[str | None] = mapped_column(
        String(100),
        comment="金融许可证号",
    )
    industry: Mapped[str | None] = mapped_column(
        String(50),
        comment="行业（银行/证券/基金/保险）",
    )

    # 联系信息
    contact_person: Mapped[str | None] = mapped_column(
        String(100),
        comment="联系人",
    )
    contact_phone: Mapped[str | None] = mapped_column(
        String(20),
        comment="联系电话",
    )
    contact_email: Mapped[str | None] = mapped_column(
        String(255),
        comment="联系邮箱",
    )
    address: Mapped[str | None] = mapped_column(
        String(500),
        comment="注册地址",
    )

    # 状态
    status: Mapped[str] = mapped_column(
        String(20),
        default=OrgStatus.ACTIVE.value,
        comment="机构状态",
    )

    # 扩展配置
    config: Mapped[str | None] = mapped_column(
        Text,
        comment="机构级配置 JSON（LLM 额度/合规规则/推送渠道）",
    )


class Department(TimestampMixin, Base):
    """部门表。"""

    __tablename__ = "departments"
    __table_args__ = (
        Index("idx_dept_org", "organization_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    organization_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        comment="机构ID",
    )
    name: Mapped[str] = mapped_column(
        String(100), nullable=False,
        comment="部门名称",
    )
    parent_id: Mapped[int | None] = mapped_column(
        BigInteger,
        comment="父部门ID（支持树形）",
    )
    manager_id: Mapped[int | None] = mapped_column(
        BigInteger,
        comment="部门负责人用户ID",
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        comment="部门描述",
    )


class BusinessDomain(TimestampMixin, Base):
    """业务领域表：金融行业业务条线定义。"""

    __tablename__ = "business_domains"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    code: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False,
        comment="业务领域编码",
    )
    name: Mapped[str] = mapped_column(
        String(100), nullable=False,
        comment="业务领域名称",
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        comment="业务领域描述",
    )
    is_active: Mapped[bool] = mapped_column(
        default=True,
        comment="是否启用",
    )


class CustomerType(TimestampMixin, Base):
    """客户类型表：投资者适当性分类。"""

    __tablename__ = "customer_types"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    name: Mapped[str] = mapped_column(
        String(100), nullable=False,
        comment="客户类型名称",
    )
    code: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False,
        comment="客户类型编码",
    )
    risk_preference: Mapped[str | None] = mapped_column(
        String(50),
        comment="风险偏好（保守/稳健/激进）",
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        comment="类型描述",
    )
    is_active: Mapped[bool] = mapped_column(
        default=True,
        comment="是否启用",
    )
