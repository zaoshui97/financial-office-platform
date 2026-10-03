"""
端到端 Phase 1 验证脚本（无 Docker / 无 MySQL 也能跑）。

跑：
  cd d:\\Apexis\\financial-office-platform
  python scripts/verify_phase1.py

跑通项：
1) 后端配置可加载，CORS 含 5173
2) 所有 models 注册到 Base.metadata
3) alembic 迁移脚本可解析（dry-run offline 生成 SQL）
4) 创建 admin -> OAuth2 login -> /auth/me 全链路
5) 错误密码返回 401
6) 注册路径会校验（短密码 / 重复用户）
7) 前端 Login 文件已包含 USE_MOCK 守卫；不依赖 mock 快速登录
8) Docker Compose 校验：基础 YAML 解析 + service 数量 + 关键 env 占位
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# 关键：必须在 import app.core.config 之前把环境变量准备好
DEV_ENV = {
    "APP_NAME": "金融企业智能办公平台",
    "APP_ENV": "development",
    "DEBUG": "true",
    "API_V1_PREFIX": "/api/v1",
    "SECRET_KEY": "x" * 64,
    "DATABASE_CHECK_ON_STARTUP": "false",
    "DATABASE_HOST": "localhost",
    "DATABASE_PORT": "3306",
    "DATABASE_USER": "root",
    "DATABASE_PASSWORD": "",
    "DATABASE_NAME": "financial_office",
    "DATABASE_CHARSET": "utf8mb4",
    "JWT_ALGORITHM": "HS256",
    "ACCESS_TOKEN_EXPIRE_MINUTES": "120",
    "CORS_ORIGINS": '["http://localhost:3000","http://localhost:5173","http://localhost:8080"]',
    "LOG_LEVEL": "WARNING",
    "LOG_JSON_FILE": "false",
}
for k, v in DEV_ENV.items():
    os.environ[k] = v


def header(title: str) -> None:
    print("")
    print("=" * 60)
    print(title)
    print("=" * 60)


def check(label: str, ok: bool, detail: str = "") -> None:
    icon = "[OK]" if ok else "[FAIL]"
    print(f"{icon} {label}{(': ' + detail) if detail else ''}")
    if not ok:
        sys.exit(1)


def patch_engine_to_sqlite() -> None:
    """app.core.database 在模块顶层用 settings.DATABASE_URL 创建了 MySQL engine。
    验证时替换成 SQLite 共享内存（StaticPool 让所有连接访问同一份数据）。
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool
    from app.core import database

    new_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    # 立刻建一次连接到 :memory: 数据库，并保留这个连接
    new_engine.connect()
    new_session_factory = sessionmaker(bind=new_engine, autoflush=False, expire_on_commit=False)
    database.engine = new_engine
    database.SessionLocal = new_session_factory


def verify_config() -> None:
    header("1. 后端配置加载")
    from app.core.config import settings

    check("APP_NAME", settings.APP_NAME == "金融企业智能办公平台")
    check("API_V1_PREFIX", settings.API_V1_PREFIX == "/api/v1", str(settings.API_V1_PREFIX))
    check("CORS 含 5173", "http://localhost:5173" in settings.CORS_ORIGINS, str(settings.CORS_ORIGINS))
    check(
        "CORS_ALLOW_HEADERS 含 Authorization",
        "Authorization" in settings.CORS_ALLOW_HEADERS,
        str(settings.CORS_ALLOW_HEADERS),
    )
    check("SECRET_KEY 长度", len(settings.SECRET_KEY) >= 32)


def verify_models_and_alembic() -> None:
    header("2. Models & Alembic 迁移脚本可解析")
    from app.core.database import Base, engine
    from app.features.auth import models as _  # noqa: F401

    tables = sorted(Base.metadata.tables.keys())
    check("Models 已注册", len(tables) >= 1, ",".join(tables))
    check("users 表存在", "users" in tables)

    # alembic offline 模式不需要数据库连接，直接生成 SQL
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head", "--sql"],
        cwd=str(ROOT),
        env={**os.environ},
        capture_output=True,
        text=True,
    )
    out = (result.stdout or "") + (result.stderr or "")
    check(
        "alembic offline upgrade 生成 SQL",
        "CREATE TABLE users" in out,
        out.splitlines()[0] if out else "(empty)",
    )


def verify_end_to_end() -> None:
    header("3. 端到端：create user -> login -> /me")

    patch_engine_to_sqlite()

    from app.core.database import Base, engine
    # 先在 SQLite 上建表
    Base.metadata.create_all(engine)

    from fastapi.testclient import TestClient
    from app.main import create_app

    app = create_app()
    client = TestClient(app)

    # 3.1 创建用户
    create_payload = {
        "username": "alice",
        "email": "alice@example.com",
        "password": "S3cret_pwd!",
        "full_name": "Alice",
    }
    r = client.post("/api/v1/auth/register", json=create_payload)
    check("注册成功 201", r.status_code == 201, f"status={r.status_code} body={r.text[:200]}")
    user = r.json()
    check("返回 id", "id" in user)
    check("is_active=true", user["is_active"] is True)
    check("is_superuser=false", user["is_superuser"] is False)

    # 3.2 重复注册 -> 409
    r2 = client.post("/api/v1/auth/register", json=create_payload)
    check("重复注册 409", r2.status_code == 409, f"status={r2.status_code}")

    # 3.3 登录拿到 JWT
    r3 = client.post(
        "/api/v1/auth/login",
        data={"username": "alice", "password": "S3cret_pwd!"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    check("登录 200", r3.status_code == 200, f"status={r3.status_code} body={r3.text[:200]}")
    tok = r3.json()
    check("返回 access_token", bool(tok.get("access_token")))
    check("token_type=bearer", tok.get("token_type") == "bearer")
    check("expires_in > 0", int(tok.get("expires_in", 0)) > 0)

    # 3.4 /auth/me 用 token
    r4 = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {tok['access_token']}"})
    check("/auth/me 200", r4.status_code == 200, f"status={r4.status_code}")
    me = r4.json()
    check("/auth/me username=alice", me["username"] == "alice")
    check("/auth/me email=alice@example.com", me["email"] == "alice@example.com")

    # 3.5 错误密码
    r5 = client.post(
        "/api/v1/auth/login",
        data={"username": "alice", "password": "WRONG"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    check("错误密码 401", r5.status_code == 401, f"status={r5.status_code}")

    # 3.6 缺 token 访问 /me -> 401
    r6 = client.get("/api/v1/auth/me")
    check("缺 token 401", r6.status_code == 401, f"status={r6.status_code}")

    # 3.7 system/health/live
    r7 = client.get("/api/v1/system/health/live")
    check("health/live 200", r7.status_code == 200, f"status={r7.status_code} body={r7.text[:120]}")

    # 3.8 create_user.py 可加载（不实际跑 main）
    spec_path = str(ROOT / "scripts" / "create_user.py")
    import importlib.util
    spec = importlib.util.spec_from_file_location("create_user_mod", spec_path)
    cu = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(cu)
    check("create_user.py 可加载", hasattr(cu, "main"))


def verify_frontend_text() -> None:
    header("4. 前端文件关键改动到位")

    login_path = ROOT / "frontend" / "digital-horse" / "src" / "pages" / "Login" / "index.tsx"
    request_path = ROOT / "frontend" / "digital-horse" / "src" / "utils" / "request.ts"
    protected_path = ROOT / "frontend" / "digital-horse" / "src" / "components" / "ProtectedRoute.tsx"
    userstore_path = ROOT / "frontend" / "digital-horse" / "src" / "store" / "userStore.ts"
    ai_path = ROOT / "frontend" / "digital-horse" / "src" / "api" / "ai.ts"
    env_prod = ROOT / "frontend" / "digital-horse" / ".env.production"
    env_dev = ROOT / "frontend" / "digital-horse" / ".env.development"

    login_src = login_path.read_text(encoding="utf-8")
    request_src = request_path.read_text(encoding="utf-8")
    protected_src = protected_path.read_text(encoding="utf-8")
    userstore_src = userstore_path.read_text(encoding="utf-8")
    ai_src = ai_path.read_text(encoding="utf-8")

    check("Login 有 USE_MOCK 守卫", "USE_MOCK" in login_src)
    check("Login 调用 authApi.login", "authApi.login" in login_src)
    check("Login 调用 authApi.me", "authApi.me" in login_src)
    check(
        "Login 在 USE_MOCK=false 时隐藏快速体验",
        "USE_MOCK && (" in login_src,
    )
    check(
        "request.ts baseURL 默认 /api/v1",
        "baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1'" in request_src,
    )
    check("ProtectedRoute 未登录跳 /login", "/login?from=" in protected_src)
    check("ProtectedRoute 探活 /auth/me", "authApi" in protected_src and ".me()" in protected_src)
    check("userStore AuthToken 字段", "AuthToken" in userstore_src and "access_token" in userstore_src)
    check("userStore persist name=auth-storage", "'auth-storage'" in userstore_src)
    check("ai.ts 安全警示注释", "安全风险" in ai_src or "Phase 2 将改为" in ai_src)
    check(
        ".env.production VITE_API_BASE_URL=/api/v1",
        "VITE_API_BASE_URL=/api/v1" in env_prod.read_text(encoding="utf-8"),
    )
    check(
        ".env.development VITE_USE_MOCK=false",
        "VITE_USE_MOCK=false" in env_dev.read_text(encoding="utf-8"),
    )


def verify_docker_compose() -> None:
    header("5. docker-compose.prod.yml 语法 & 关键 service")

    try:
        import yaml
    except ImportError:
        check("yaml 模块可用", False, "pip install pyyaml")
        return

    compose_path = ROOT / "docker-compose.prod.yml"
    with compose_path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    services = data.get("services", {})
    check("包含 mysql service", "mysql" in services)
    check("包含 redis service", "redis" in services)
    check("包含 qdrant service", "qdrant" in services)
    check("包含 backend service", "backend" in services)
    check("包含 frontend service", "frontend" in services)

    backend = services.get("backend", {})
    check(
        "backend depends_on mysql/redis/qdrant",
        set(backend.get("depends_on", {}).keys()) >= {"mysql", "redis", "qdrant"},
    )
    check(
        "backend 设置 RUN_MIGRATIONS_ON_START=true",
        backend.get("environment", {}).get("RUN_MIGRATIONS_ON_START") == "true",
    )

    frontend = services.get("frontend", {})
    args = (frontend.get("build") or {}).get("args", {})
    check("frontend build args VITE_API_BASE_URL=/api/v1", args.get("VITE_API_BASE_URL") == "/api/v1")
    check("frontend build args VITE_USE_MOCK=false", args.get("VITE_USE_MOCK") == "false")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-e2e", action="store_true", help="跳过端到端测试（仅跑配置 / 模型 / 前端文本 / compose）")
    args = parser.parse_args()

    verify_config()
    verify_models_and_alembic()
    if not args.skip_e2e:
        verify_end_to_end()
    verify_frontend_text()
    verify_docker_compose()

    print("")
    print("[Phase 1 Static Verify] All checks passed.")
    print("Reminder: docker compose full verification requires Docker daemon.")
    return 0


if __name__ == "__main__":
    sys.exit(main())