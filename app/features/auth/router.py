"""用户注册、登录和当前用户接口。"""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Form, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token
from app.features.auth.dependencies import CurrentUser
from app.features.auth.schemas import TokenResponse, UserCreate, UserRead
from app.features.auth.service import authenticate_user, create_user, get_user_by_id

import json as _json

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
async def login(
    request: Request,
    username: Annotated[str, Form()] = "",
    password: Annotated[str, Form()] = "",
    db: Annotated[Session, Depends(get_db)] = None,
) -> TokenResponse:
    """使用用户名或邮箱和密码换取JWT访问令牌。

    支持两种 Content-Type（友好兼容，避免 422）：
      - application/x-www-form-urlencoded（OAuth2 标准）
      - application/json（前端兼容）
    任一种失败时统一返回 401 + 友好中文提示。
    """
    # 兼容 JSON 登录：若 form 为空且 Content-Type 是 JSON，尝试从 body 读
    if not username and not password:
        ctype = (request.headers.get("content-type") or "").lower()
        if "application/json" in ctype:
            try:
                raw = await request.body()
                body: dict[str, Any] = _json.loads(raw or b"{}") if raw else {}
                username = body.get("username") or body.get("email") or ""
                password = body.get("password") or ""
            except Exception:  # noqa: BLE001
                pass

    if not username or not password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="请提供用户名和密码",
        )

    user = authenticate_user(db, username, password)
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


def _resolve_user_role(user) -> str:
    """从 User ORM 对象解析单一角色字符串。

    优先级（与 approval.service._is_dept_admin 保持一致）：
      1) is_superuser=True → SUPER_ADMIN
      2) user_roles 关联表里挂的 RBAC 角色（Phase 2 上线后主要靠这条）
      3) position 启发式兜底（Phase 1 过渡期，避免改了 position 还要再去
         维护 user_roles 表）：
         - "审计员" → AUDITOR
         - 含"主管/经理/总监/主任/leader/manager/director" → DEPT_ADMIN
      4) 都没有 → USER
    """
    if getattr(user, "is_superuser", False):
        return "SUPER_ADMIN"
    # 1) RBAC 角色（user_roles 关联）
    user_roles = getattr(user, "user_roles", None) or []
    for ur in user_roles:
        role = getattr(ur, "role", None)
        if role and getattr(role, "role_code", None):
            return role.role_code
    # 2) position 启发式（与 approval.service._is_dept_admin 对齐）
    pos = (getattr(user, "position", None) or "").strip()
    if pos:
        if pos == "审计员":
            return "AUDITOR"
        dept_keywords = ("主管", "经理", "总监", "主任", "leader", "manager", "director")
        if any(kw in pos.lower() for kw in dept_keywords):
            return "DEPT_ADMIN"
    return "USER"


@router.get("/me", response_model=UserRead, summary="当前用户")
def read_current_user(current_user: CurrentUser) -> UserRead:
    """返回当前访问令牌对应的用户信息。"""
    payload = UserRead.model_validate(current_user)
    # 角色字段需要从 user_roles 关联读取，独立于 model_validate
    payload.role = _resolve_user_role(current_user)
    return payload


@router.get("/users/{user_id}", response_model=UserRead, summary="按 id 查用户（鉴权后）")
def get_user_by_id_route(
    user_id: int,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> UserRead:
    """查询指定用户的基础信息（用于审批详情显示申请人 / 部门 / 角色）。

    鉴权：任意登录用户可查（仅基础公开信息：username/name/department/position/role）。
    """
    u = get_user_by_id(db, user_id)
    if u is None:
        raise HTTPException(status_code=404, detail="用户不存在")
    payload = UserRead.model_validate(u)
    # 与 /auth/me 保持一致：走 _resolve_user_role 统一解析（含 position 启发式）
    payload.role = _resolve_user_role(u)
    return payload