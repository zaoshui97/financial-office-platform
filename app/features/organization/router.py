"""机构域 REST 路由：多租户隔离核心入口（答辩亮点）。

路由顺序原则：所有具体路径（/business-domains, /customer-types, /departments）
必须先于 /{org_id} 声明，否则 FastAPI 会把字面量误解析为 int 路径参数。
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.features.organization.schemas import (
    BusinessDomainCreate,
    BusinessDomainRead,
    CustomerTypeCreate,
    CustomerTypeRead,
    DepartmentCreate,
    DepartmentRead,
    OrganizationCreate,
    OrganizationListResponse,
    OrganizationRead,
)
from app.features.organization.service import (
    create_business_domain,
    create_customer_type,
    create_department,
    create_organization,
    get_organization,
    list_business_domains,
    list_customer_types,
    list_departments_by_org,
    list_organizations,
)

router = APIRouter(prefix="/organizations", tags=["机构域（多租户隔离）"])


# ────────── Organization（最外层 CRUD）──────────


@router.post(
    "",
    response_model=OrganizationRead,
    status_code=201,
    summary="创建机构（多租户隔离根）",
)
def post_organization(
    data: OrganizationCreate,
    db: Annotated[Session, Depends(get_db)],
) -> OrganizationRead:
    """机构是数据隔离的最高层级。"""
    return OrganizationRead.model_validate(create_organization(db, data))


@router.get(
    "",
    response_model=OrganizationListResponse,
    summary="分页查询机构列表",
)
def get_organizations(
    db: Annotated[Session, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> OrganizationListResponse:
    items, total = list_organizations(db, page, page_size)
    return OrganizationListResponse(
        items=[OrganizationRead.model_validate(o) for o in items],
        total=total,
    )


# ────────── Department（具体路径，必须在 /{org_id} 之前）──────────


@router.post(
    "/departments",
    response_model=DepartmentRead,
    status_code=201,
    summary="创建部门",
)
def post_department(
    data: DepartmentCreate,
    db: Annotated[Session, Depends(get_db)],
) -> DepartmentRead:
    return DepartmentRead.model_validate(create_department(db, data))


# ────────── BusinessDomain（具体路径）──────────


@router.post(
    "/business-domains",
    response_model=BusinessDomainRead,
    status_code=201,
    summary="创建业务领域",
)
def post_business_domain(
    data: BusinessDomainCreate,
    db: Annotated[Session, Depends(get_db)],
) -> BusinessDomainRead:
    return BusinessDomainRead.model_validate(create_business_domain(db, data))


@router.get(
    "/business-domains",
    response_model=list[BusinessDomainRead],
    summary="列出所有业务领域",
)
def get_business_domains(db: Annotated[Session, Depends(get_db)]) -> list[BusinessDomainRead]:
    items = list_business_domains(db)
    return [BusinessDomainRead.model_validate(b) for b in items]


# ────────── CustomerType（具体路径）──────────


@router.post(
    "/customer-types",
    response_model=CustomerTypeRead,
    status_code=201,
    summary="创建客户类型",
)
def post_customer_type(
    data: CustomerTypeCreate,
    db: Annotated[Session, Depends(get_db)],
) -> CustomerTypeRead:
    return CustomerTypeRead.model_validate(create_customer_type(db, data))


@router.get(
    "/customer-types",
    response_model=list[CustomerTypeRead],
    summary="列出所有客户类型",
)
def get_customer_types(db: Annotated[Session, Depends(get_db)]) -> list[CustomerTypeRead]:
    items = list_customer_types(db)
    return [CustomerTypeRead.model_validate(c) for c in items]


# ────────── 路径参数（必须放在最后）──────────


@router.get(
    "/{org_id}",
    response_model=OrganizationRead,
    summary="机构详情",
)
def get_organization_route(org_id: int, db: Annotated[Session, Depends(get_db)]) -> OrganizationRead:
    return OrganizationRead.model_validate(get_organization(db, org_id))


@router.get(
    "/{org_id}/departments",
    response_model=list[DepartmentRead],
    summary="按机构ID列出部门",
)
def get_departments(org_id: int, db: Annotated[Session, Depends(get_db)]) -> list[DepartmentRead]:
    items = list_departments_by_org(db, org_id)
    return [DepartmentRead.model_validate(d) for d in items]
