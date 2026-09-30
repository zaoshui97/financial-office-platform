"""用户SQLAlchemy模型。"""

from sqlalchemy import Boolean, String
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