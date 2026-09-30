"""认证安全工具：密码哈希、JWT签发和JWT解析。"""

from datetime import UTC, datetime, timedelta

import jwt
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash

from app.core.config import settings

password_hash = PasswordHash.recommended()


class TokenDecodeError(Exception):
    """JWT无法通过签名、有效期或载荷校验。"""


def hash_password(password: str) -> str:
    """使用推荐算法生成不可逆密码哈希。"""
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    """验证明文密码是否与数据库中的哈希一致。"""
    return password_hash.verify(password, hashed_password)


def create_access_token(user_id: int) -> str:
    """为指定用户签发短期访问令牌。"""
    issued_at = datetime.now(UTC)
    expires_at = issued_at + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "type": "access",
        "iat": issued_at,
        "exp": expires_at,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> int:
    """校验访问令牌并返回用户ID。"""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        if payload.get("type") != "access":
            raise TokenDecodeError
        return int(payload["sub"])
    except (InvalidTokenError, KeyError, TypeError, ValueError) as exc:
        raise TokenDecodeError from exc