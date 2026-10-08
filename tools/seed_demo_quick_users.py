"""固化方案 C：在 users 表插入/更新 4 个 demo 账号。

账号 (用户名 / 密码 / 角色):
  zhangsan / 123456  → SUPER_ADMIN（张三 / 测试部 / 部门经理）
  lisi     / 123456  → DEPT_ADMIN（李四 / 合规部 / 部门经理）—— DEPT_ADMIN 由前端
                        is_superuser=false + position='部门经理' 表达
  wangba   / 123456  → DEPT_ADMIN（王八 / 市场部 / 部门经理）—— 审批王五的市场部差旅报销用
  wangwu   / 123456  → USER（王五 / 市场部 / 普通员工）
  zhaoliu  / 123456  → AUDITOR（赵六 / 审计部 / 审计员）

密码哈希走应用层 password_hash（pwdlib）保持与生产一致，避免原生 bcrypt 与 pwdlib 哈希格式不一致。

运行：cd D:\\Apexis\\financial-office-platform && python tools/seed_demo_quick_users.py
"""
from __future__ import annotations

import sys
from pathlib import Path

# 让脚本能 import app 包
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.security import hash_password  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

DB_URL = "mysql+pymysql://root:801333@127.0.0.1:3306/financial_office?charset=utf8mb4"

ACCOUNTS = [
    {
        "username": "zhangsan",
        "email": "zhangsan@financial.example.com",
        "full_name": "张三",
        "department": "测试部",
        "position": "部门经理",
        "is_superuser": 1,
        "is_active": 1,
        "password": "123456",
        "label": "超级管理员",
    },
    {
        "username": "lisi",
        "email": "lisi@financial.example.com",
        "full_name": "李四",
        "department": "合规部",
        "position": "部门经理",
        "is_superuser": 0,
        "is_active": 1,
        "password": "123456",
        "label": "部门管理员",
    },
    {
        "username": "wangwu",
        "email": "wangwu@financial.example.com",
        "full_name": "王五",
        "department": "市场部",
        "position": "普通员工",
        "is_superuser": 0,
        "is_active": 1,
        "password": "123456",
        "label": "普通员工",
    },
    {
        "username": "wangba",
        "email": "wangba@financial.example.com",
        "full_name": "王八",
        "department": "市场部",
        "position": "部门经理",
        "is_superuser": 0,
        "is_active": 1,
        "password": "123456",
        "label": "市场部部门经理",
    },
    {
        "username": "zhaoliu",
        "email": "zhaoliu@financial.example.com",
        "full_name": "赵六",
        "department": "审计部",
        "position": "审计员",
        "is_superuser": 0,
        "is_active": 1,
        "password": "123456",
        "label": "审计员",
    },
]


def main() -> None:
    engine = create_engine(DB_URL, echo=False, future=True)
    with Session(engine, future=True) as session:
        for acc in ACCOUNTS:
            hashed = hash_password(acc["password"])
            row = session.execute(
                text(
                    "SELECT id FROM users WHERE username = :u"
                ),
                {"u": acc["username"]},
            ).first()
            if row is None:
                session.execute(
                    text(
                        """
                        INSERT INTO users (
                            username, email, full_name, hashed_password,
                            department, position, is_active, is_superuser,
                            created_at, updated_at
                        ) VALUES (
                            :username, :email, :full_name, :hashed_password,
                            :department, :position, :is_active, :is_superuser,
                            NOW(), NOW()
                        )
                        """
                    ),
                    {
                        "username": acc["username"],
                        "email": acc["email"],
                        "full_name": acc["full_name"],
                        "hashed_password": hashed,
                        "department": acc["department"],
                        "position": acc["position"],
                        "is_active": acc["is_active"],
                        "is_superuser": acc["is_superuser"],
                    },
                )
                print(f"[INSERT] {acc['username']} ({acc['label']})")
            else:
                session.execute(
                    text(
                        """
                        UPDATE users
                           SET email = :email,
                               full_name = :full_name,
                               hashed_password = :hashed_password,
                               department = :department,
                               position = :position,
                               is_active = :is_active,
                               is_superuser = :is_superuser,
                               updated_at = NOW()
                         WHERE username = :username
                        """
                    ),
                    {
                        "username": acc["username"],
                        "email": acc["email"],
                        "full_name": acc["full_name"],
                        "hashed_password": hashed,
                        "department": acc["department"],
                        "position": acc["position"],
                        "is_active": acc["is_active"],
                        "is_superuser": acc["is_superuser"],
                    },
                )
                print(f"[UPDATE] {acc['username']} ({acc['label']})")

        # 验证
        print("\n=== 当前 4 个 demo 账号状态 ===")
        rows = session.execute(
            text(
                "SELECT id, username, full_name, department, position, "
                "is_superuser, is_active FROM users "
                "WHERE username IN ('zhangsan','lisi','wangwu','wangba','zhaoliu') "
                "ORDER BY is_superuser DESC, username"
            )
        ).all()
        for r in rows:
            print(f"  id={r[0]} {r[1]} ({r[2]}) {r[3]}/{r[4]} "
                  f"super={r[5]} active={r[6]}")

        session.commit()
    print("\nseed 完成。下次后端启动即生效。")


if __name__ == "__main__":
    main()