"""机构域 schemas：组织机构/部门/业务领域/客户类型。"""

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


# ────────── Organization（机构/租户） ──────────


class OrganizationCreate(BaseModel):
    """创建机构请求。"""

    name: str = Field(min_length=2, max_length=200, description="机构名称")
    org_type: str = Field(
        default="bank",
        description="机构类型: bank/securities/fund/insurance/trust/other",
    )
    credit_code: str | None = Field(default=None, max_length=50, description="统一社会信用代码")
    license_no: str | None = Field(default=None, max_length=100, description="金融许可证号")
    industry: str | None = Field(default=None, max_length=50)
    contact_person: str | None = Field(default=None, max_length=100)
    contact_phone: str | None = Field(default=None, max_length=20)
    contact_email: str | None = Field(default=None, max_length=255)
    address: str | None = Field(default=None, max_length=500)


class OrganizationRead(BaseModel):
    """机构详情响应。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    org_type: str | None = None
    credit_code: str | None = None
    license_no: str | None = None
    industry: str | None = None
    contact_person: str | None = None
    contact_phone: str | None = None
    contact_email: str | None = None
    address: str | None = None
    status: str = "active"


class OrganizationListResponse(BaseModel):
    items: list[OrganizationRead]
    total: int


# ────────── Department（部门） ──────────


class DepartmentCreate(BaseModel):
    organization_id: int
    name: str = Field(min_length=1, max_length=100)
    parent_id: int | None = None
    manager_id: int | None = None
    description: str | None = None


class DepartmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    name: str
    parent_id: int | None = None
    manager_id: int | None = None
    description: str | None = None


# ────────── BusinessDomain（业务领域） ──────────


class BusinessDomainCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None


class BusinessDomainRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    description: str | None = None
    is_active: bool = True


# ────────── CustomerType（客户类型） ──────────


class CustomerTypeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    code: str = Field(min_length=1, max_length=50)
    risk_preference: str | None = None
    description: str | None = None


class CustomerTypeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    code: str
    risk_preference: str | None = None
    description: str | None = None
    is_active: bool = True
