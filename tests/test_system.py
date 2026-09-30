"""系统健康接口和中文Swagger页面测试。"""

from fastapi.testclient import TestClient


def test_liveness(client: TestClient) -> None:
    """存活接口应返回服务状态和请求追踪头。"""
    response = client.get("/api/v1/system/health/live")

    assert response.status_code == 200
    assert response.json()["status"] == "alive"
    assert response.headers["X-Request-ID"]


def test_swagger_authorization_translation(client: TestClient) -> None:
    """Swagger页面应包含授权弹窗的简体中文翻译脚本。"""
    response = client.get("/docs")

    assert response.status_code == 200
    assert "可用的身份认证" in response.text
    assert "用户名：" in response.text
    assert "密码：" in response.text
    assert "登录 / 授权" in response.text
    assert "persistAuthorization" in response.text