"""SQLAlchemy基础配置：声明式基类、引擎、会话和数据库依赖。"""

from collections.abc import Generator
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Integer, create_engine, func, text
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class Base(DeclarativeBase):
    """全部SQLAlchemy模型的声明式基类。"""


class TimestampMixin:
    """为业务模型提供主键和创建、更新时间。"""

    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"),
        primary_key=True,
        autoincrement=True,
        comment="主键ID",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        comment="创建时间",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        comment="更新时间",
    )


engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    pool_recycle=settings.DATABASE_POOL_RECYCLE,
    pool_timeout=settings.DATABASE_POOL_TIMEOUT,
    echo=settings.DATABASE_ECHO,
)

SessionLocal = sessionmaker(
    bind=engine,
    class_=Session,
    autoflush=False,
    expire_on_commit=False,
)


def get_db() -> Generator[Session, None, None]:
    """为单次请求提供数据库会话，异常时回滚事务。"""
    session = SessionLocal()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def check_database_connection() -> None:
    """执行轻量查询验证MySQL连接。"""
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    logger.info("数据库连接正常 | database=%s", settings.DATABASE_NAME)


def dispose_database_engine() -> None:
    """释放数据库连接池。"""
    engine.dispose()