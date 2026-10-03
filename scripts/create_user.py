# 创建初始超级管理员 / 普通用户（不硬编码默认密码）。
#
# 用法：
#   docker compose -f docker-compose.prod.yml exec backend \
#     python scripts/create_user.py --username admin --email admin@example.com \
#       --password-env ADMIN_PASSWORD --full-name 管理员 --superuser
#
# 推荐：把密码放在环境变量里，而不是命令行参数，避免泄漏到 shell history / ps 输出。
#
# 也支持交互式输入（不传 --password / --password-env 时）：
#   docker compose exec backend python scripts/create_user.py --username admin --superuser
#
# 已存在同名 / 同邮箱用户会报错，不会覆盖。

import argparse
import getpass
import os
import sys
from pathlib import Path

# 让脚本能直接 import app.*
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import or_, select  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.database import SessionLocal  # noqa: E402
from app.core.logging import setup_logging  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.features.auth.models import User  # noqa: E402
from app.features.auth.schemas import UserCreate  # noqa: E402
from app.features.auth.service import create_user  # noqa: E402


def resolve_password(args: argparse.Namespace) -> str:
    if args.password:
        return args.password
    if args.password_env:
        value = os.environ.get(args.password_env)
        if not value:
            print(
                f"[error] 环境变量 {args.password_env} 未设置；"
                f"请 export {args.password_env}=... 后再执行，或直接用 --password。",
                file=sys.stderr,
            )
            sys.exit(2)
        return value
    # 交互式：不在容器里 TTY 时不要阻塞
    try:
        return getpass.getpass("password: ")
    except (EOFError, KeyboardInterrupt):
        print("[error] 未提供密码（也无 TTY 可输入）", file=sys.stderr)
        sys.exit(2)


def main() -> int:
    parser = argparse.ArgumentParser(description="创建初始用户")
    parser.add_argument("--username", required=True, help="登录用户名（小写，3-50 字符)")
    parser.add_argument("--email", required=True, help="邮箱")
    parser.add_argument(
        "--password",
        default=None,
        help="明文密码（不推荐，会出现在 shell history）",
    )
    parser.add_argument(
        "--password-env",
        default=None,
        help="从该环境变量读取密码（推荐）",
    )
    parser.add_argument("--full-name", default=None, help="显示姓名")
    parser.add_argument(
        "--superuser",
        action="store_true",
        help="创建为超级管理员",
    )
    parser.add_argument(
        "--active/--inactive",
        dest="active",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="账号是否启用（默认启用）",
    )
    args = parser.parse_args()

    setup_logging()

    password = resolve_password(args)
    if len(password) < 8:
        print("[error] 密码长度至少 8 位", file=sys.stderr)
        return 2

    payload = UserCreate(
        username=args.username,
        email=args.email,
        password=password,
        full_name=args.full_name,
    )

    with SessionLocal() as db:
        # 预先检查，避免落到 create_user 才抛 IntegrityError 时信息不直观
        duplicate = db.scalar(
            select(User.id).where(
                or_(User.username == payload.username, User.email == str(payload.email))
            )
        )
        if duplicate is not None:
            print(
                f"[error] 用户已存在（username={payload.username} 或 email={payload.email}）",
                file=sys.stderr,
            )
            return 1

        try:
            user = create_user(db, payload)
        except Exception as exc:  # noqa: BLE001
            print(f"[error] 创建用户失败: {exc}", file=sys.stderr)
            return 1

        if args.superuser:
            user.is_superuser = True
        if not args.active:
            user.is_active = False
        db.commit()
        db.refresh(user)

        print("[ok] 用户创建成功")
        print(f"  id          = {user.id}")
        print(f"  username    = {user.username}")
        print(f"  email       = {user.email}")
        print(f"  full_name   = {user.full_name}")
        print(f"  is_active   = {user.is_active}")
        print(f"  is_superuser= {user.is_superuser}")
        print(f"  api_v1      = {settings.API_V1_PREFIX}")

    return 0


if __name__ == "__main__":
    sys.exit(main())