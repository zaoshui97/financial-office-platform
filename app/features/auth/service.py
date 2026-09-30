"""用户注册、查询和密码认证业务逻辑。"""

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.features.auth.models import User
from app.features.auth.schemas import UserCreate


def get_user_by_id(db: Session, user_id: int) -> User | None:
    """根据主键查询用户。"""
    return db.get(User, user_id)


def get_user_by_identifier(db: Session, identifier: str) -> User | None:
    """根据用户名或邮箱查询用户。"""
    normalized = identifier.strip().lower()
    statement = select(User).where(
        or_(User.username == normalized, User.email == normalized)
    )
    return db.scalar(statement)


def create_user(db: Session, data: UserCreate) -> User:
    """创建用户并处理用户名或邮箱重复冲突。"""
    duplicate_statement = select(User.id).where(
        or_(User.username == data.username, User.email == str(data.email))
    )
    if db.scalar(duplicate_statement) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="用户名或邮箱已存在",
        )

    user = User(
        username=data.username,
        email=str(data.email),
        full_name=data.full_name.strip() if data.full_name else None,
        hashed_password=hash_password(data.password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="用户名或邮箱已存在",
        ) from exc

    db.refresh(user)
    return user


def authenticate_user(db: Session, identifier: str, password: str) -> User | None:
    """验证用户名或邮箱及密码，认证失败时统一返回None。"""
    user = get_user_by_identifier(db, identifier)
    if user is None or not verify_password(password, user.hashed_password):
        return None
    if not user.is_active:
        return None
    return user