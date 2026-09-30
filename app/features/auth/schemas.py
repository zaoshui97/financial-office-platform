"""用户认证请求与响应数据模型。"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    """用户注册请求。"""

    username: str = Field(min_length=3, max_length=50, pattern=r"^[A-Za-z0-9_.-]+$")
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=100)

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        """统一用户名大小写并移除两端空格。"""
        return value.strip().lower()

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        """统一邮箱大小写。"""
        return str(value).strip().lower()


class UserRead(BaseModel):
    """对外返回的用户信息，不包含密码哈希。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr
    full_name: str | None
    is_active: bool
    is_superuser: bool
    created_at: datetime


class TokenResponse(BaseModel):
    """OAuth2访问令牌响应。"""

    access_token: str
    token_type: str = "bearer"
    expires_in: int