"""用户注册、登录和JWT身份认证测试。"""

from fastapi.testclient import TestClient


def register_user(client: TestClient) -> dict[str, object]:
    """创建测试用户并返回响应数据。"""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "username": "demo_user",
            "email": "demo@example.com",
            "password": "DemoPass123!",
            "full_name": "演示用户",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_register_user(client: TestClient) -> None:
    """注册接口应创建用户且不返回密码哈希。"""
    user = register_user(client)

    assert user["username"] == "demo_user"
    assert user["email"] == "demo@example.com"
    assert "hashed_password" not in user


def test_duplicate_user_is_rejected(client: TestClient) -> None:
    """重复用户名或邮箱应返回冲突状态。"""
    register_user(client)

    response = client.post(
        "/api/v1/auth/register",
        json={
            "username": "demo_user",
            "email": "other@example.com",
            "password": "DemoPass123!",
        },
    )

    assert response.status_code == 409


def test_login_and_read_current_user(client: TestClient) -> None:
    """有效凭证应获得JWT并访问当前用户接口。"""
    register_user(client)

    login_response = client.post(
        "/api/v1/auth/login",
        data={"username": "demo_user", "password": "DemoPass123!"},
    )
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]

    me_response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert me_response.status_code == 200
    assert me_response.json()["username"] == "demo_user"


def test_invalid_password_is_rejected(client: TestClient) -> None:
    """错误密码不能获得访问令牌。"""
    register_user(client)

    response = client.post(
        "/api/v1/auth/login",
        data={"username": "demo_user", "password": "wrong-password"},
    )

    assert response.status_code == 401