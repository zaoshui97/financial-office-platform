"""Pytest公共Fixture：使用SQLite隔离测试，不依赖本地MySQL。"""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
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
from app.main import app


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """为每个测试提供独立的内存数据库会话。"""
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    testing_session = sessionmaker(
        bind=test_engine,
        class_=Session,
        autoflush=False,
        expire_on_commit=False,
    )
    Base.metadata.create_all(bind=test_engine)
    session = testing_session()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)
        test_engine.dispose()


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """创建覆盖数据库依赖的FastAPI测试客户端。"""

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()