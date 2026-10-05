"""机构域 service：CRUD 实现（多租户隔离数据访问层）。"""

from __future__ import annotations

from typing import Sequence

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.features.organization.models import (
    BusinessDomain,
    CustomerType,
    Department,
    Organization,
)
from app.features.organization.schemas import (
    BusinessDomainCreate,
    CustomerTypeCreate,
    DepartmentCreate,
    OrganizationCreate,
)


# ────────── Organization ──────────


def create_organization(db: Session, data: OrganizationCreate) -> Organization:
    org = Organization(**data.model_dump())
    db.add(org)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"credit_code 已存在: {data.credit_code}",
        ) from exc
    db.refresh(org)
    return org


def list_organizations(
    db: Session, page: int = 1, page_size: int = 20
) -> tuple[Sequence[Organization], int]:
    base = select(Organization).order_by(Organization.id.desc())
    items = list(db.scalars(base.offset((page - 1) * page_size).limit(page_size)).all())
    total = db.scalar(select(func.count(Organization.id))) or 0
    return items, total


def get_organization(db: Session, org_id: int) -> Organization:
    org = db.get(Organization, org_id)
    if org is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"机构 {org_id} 不存在",
        )
    return org


# ────────── Department ──────────


def create_department(db: Session, data: DepartmentCreate) -> Department:
    get_organization(db, data.organization_id)
    dept = Department(**data.model_dump())
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


def list_departments_by_org(db: Session, org_id: int) -> Sequence[Department]:
    return db.scalars(
        select(Department)
        .where(Department.organization_id == org_id)
        .order_by(Department.id)
    ).all()


# ────────── BusinessDomain ──────────


def create_business_domain(db: Session, data: BusinessDomainCreate) -> BusinessDomain:
    bd = BusinessDomain(**data.model_dump())
    db.add(bd)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"业务领域编码已存在: {data.code}",
        ) from exc
    db.refresh(bd)
    return bd


def list_business_domains(db: Session) -> Sequence[BusinessDomain]:
    return db.scalars(
        select(BusinessDomain)
        .where(BusinessDomain.is_active.is_(True))
        .order_by(BusinessDomain.id)
    ).all()


# ────────── CustomerType ──────────


def create_customer_type(db: Session, data: CustomerTypeCreate) -> CustomerType:
    ct = CustomerType(**data.model_dump())
    db.add(ct)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"客户类型编码已存在: {data.code}",
        ) from exc
    db.refresh(ct)
    return ct


def list_customer_types(db: Session) -> Sequence[CustomerType]:
    return db.scalars(
        select(CustomerType)
        .where(CustomerType.is_active.is_(True))
        .order_by(CustomerType.id)
    ).all()
