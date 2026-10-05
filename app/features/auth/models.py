"""用户SQLAlchemy模型。"""

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, TimestampMixin


class User(TimestampMixin, Base):
    """平台用户，保存登录标识、密码哈希和账号状态。"""

    __tablename__ = "users"

    username: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        unique=True,
        index=True,
        comment="登录用户名",
    )
    email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
        index=True,
        comment="电子邮箱",
    )
    full_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="用户姓名",
    )
    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="密码哈希",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="1",
        comment="账号是否启用",
    )
    is_superuser: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="0",
        comment="是否超级管理员",
    )

    # ---------- 金融行业扩展字段 ----------
    organization_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="所属机构ID（多租户隔离）",
    )
    department: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="部门",
    )
    position: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="职位",
    )
    business_line: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="业务条线",
    )
    compliance_level: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="合规等级（一般/敏感/高敏感）",
    )
    phone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
        comment="手机号（脱敏存储）",
    )
    last_login_at: Mapped[str | None] = mapped_column(
        String(19),
        nullable=True,
        comment="最后登录时间",
    )
    last_login_ip: Mapped[str | None] = mapped_column(
        String(45),
        nullable=True,
        comment="最后登录IP",
    )


class RefreshToken(Base):
    """Refresh Token 记录：用于短期 access token 过期后的轮转。

    设计：
      - jti 是 JWT 唯一标识（uuid）
      - revoked=True 时该 token 不能再用于换新 access
      - 登出（logout）调 revoke_jti
      - 索引 (user_id, jti) 用于快速查询
    """

    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    jti: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, index=True,
        comment="JWT ID（UUID），用于撤销",
    )
    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
        comment="user_id（外键到 users.id）",
    )
    revoked: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="0",
        comment="是否已撤销",
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False,
        comment="过期时间（与 JWT exp 一致，便于扫表清理）",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False,
        server_default="CURRENT_TIMESTAMP",
        comment="签发时间",
    )

    __table_args__ = (
        Index("idx_refresh_user_revoked", "user_id", "revoked"),
    )


# ============================================================================
# 权限管控域（RBAC：角色 + 权限 + 部门维度隔离）
# ============================================================================

from sqlalchemy import Text


class Role(TimestampMixin, Base):
    """角色表。"""

    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    role_code: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False,
        comment="角色编码",
    )
    role_name: Mapped[str] = mapped_column(
        String(100), nullable=False,
        comment="角色名称",
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        comment="角色描述",
    )
    is_system: Mapped[bool] = mapped_column(
        default=False,
        comment="是否系统内置（系统内置不可删除）",
    )


class Permission(TimestampMixin, Base):
    """权限表。"""

    __tablename__ = "permissions"
    __table_args__ = (
        Index("idx_permission_code", "permission_code", unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    permission_code: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False,
        comment="权限编码（格式：resource:action）",
    )
    permission_name: Mapped[str] = mapped_column(
        String(200), nullable=False,
        comment="权限名称",
    )
    resource_type: Mapped[str] = mapped_column(
        String(50),
        default="knowledge_base",
        comment="资源类型",
    )
    action: Mapped[str] = mapped_column(
        String(50),
        default="read",
        comment="操作类型",
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        comment="权限描述",
    )


class RolePermission(Base):
    """角色-权限关联表。"""

    __tablename__ = "role_permissions"

    role_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("roles.id", ondelete="CASCADE"),
        primary_key=True,
        comment="角色ID",
    )
    permission_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("permissions.id", ondelete="CASCADE"),
        primary_key=True,
        comment="权限ID",
    )


class UserRole(Base):
    """用户-角色-部门关联表（支持部门维度权限隔离）。"""

    __tablename__ = "user_roles"
    __table_args__ = (
        Index("idx_user_role_user", "user_id"),
        Index("idx_user_role_role", "role_id"),
    )

    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
        comment="用户ID",
    )
    role_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("roles.id", ondelete="CASCADE"),
        primary_key=True,
        comment="角色ID",
    )
    department_id: Mapped[int | None] = mapped_column(
        BigInteger,
        primary_key=True,
        default=None,
        comment="部门ID（支持部门维度权限隔离）",
    )