"""重置 admin_test 用户的密码为 admin123"""
import sys
sys.path.insert(0, '.')
# 必须 import 所有 model 才能让 Base.metadata 知道所有表
import app.features.organization.models  # noqa: F401
import app.features.auth.models  # noqa: F401
import app.features.compliance.models  # noqa: F401
import app.features.meeting.models  # noqa: F401
import app.features.office.models  # noqa: F401
import app.features.decision.models  # noqa: F401
import app.features.chat.models  # noqa: F401
import app.features.rag.models  # noqa: F401
import app.features.blackboard.models  # noqa: F401
from sqlalchemy import select
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.features.auth.models import User

NEW_PWD = 'admin123'

with SessionLocal() as s:
    u = s.scalar(select(User).where(User.username == 'admin_test'))
    if not u:
        print('admin_test not found')
        sys.exit(1)
    u.hashed_password = hash_password(NEW_PWD)
    u.is_active = True
    s.commit()
    print(f'OK: {u.username} -> {NEW_PWD}, is_active={u.is_active}, is_superuser={u.is_superuser}')
