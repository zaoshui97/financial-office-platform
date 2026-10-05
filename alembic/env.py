"""Alembic环境配置：加载应用数据库地址与模型元数据。"""

from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context
from app.core.config import settings
from app.core.database import Base

# 导入所有 feature 模型（顺序按字母序 + 域）
from app.features.agent import models as agent_models  # noqa: F401
from app.features.auth import models as auth_models  # noqa: F401
from app.features.blackboard import models as blackboard_models  # noqa: F401
from app.features.chat import models as chat_models  # noqa: F401
from app.features.compliance import models as compliance_models  # noqa: F401
from app.features.decision import models as decision_models  # noqa: F401
from app.features.meeting import models as meeting_models  # noqa: F401
from app.features.office import models as office_models  # noqa: F401
from app.features.organization import models as organization_models  # noqa: F401
from app.features.rag import models as rag_models  # noqa: F401

config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL.replace("%", "%%"))

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """在不建立数据库连接的情况下生成迁移SQL。"""
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """连接数据库并执行迁移。"""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()