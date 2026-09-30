"""用户注册、OAuth2登录和当前用户接口。"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token
from app.features.auth.dependencies import CurrentUser
from app.features.auth.schemas import TokenResponse, UserCreate, UserRead
from app.features.auth.service import authenticate_user, create_user

router = APIRouter(prefix="/auth", tags=["用户认证"])


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    summary="注册用户",
)
def register_user(
    data: UserCreate,
    db: Annotated[Session, Depends(get_db)],
) -> UserRead:
    """注册普通用户，密码仅以哈希形式保存。"""
    return UserRead.model_validate(create_user(db, data))


@router.post("/login", response_model=TokenResponse, summary="用户登录")
def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    """使用用户名或邮箱和密码换取JWT访问令牌。"""
    user = authenticate_user(db, form_data.username, form_data.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名、邮箱或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return TokenResponse(
        access_token=create_access_token(user.id),
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.get("/me", response_model=UserRead, summary="当前用户")
def read_current_user(current_user: CurrentUser) -> UserRead:
    """返回当前访问令牌对应的用户信息。"""
    return UserRead.model_validate(current_user)