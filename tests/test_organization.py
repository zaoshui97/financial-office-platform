"""机构域测试：多租户隔离核心入口。"""

from fastapi.testclient import TestClient


def _create_org(client: TestClient, code_suffix: str = "001") -> dict:
    resp = client.post(
        "/api/v1/organizations",
        json={
            "name": f"演示银行 {code_suffix}",
            "org_type": "bank",
            "credit_code": f"91110000000000{code_suffix}X",
            "license_no": f"J0001H00000{code_suffix}1",
            "industry": "banking",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_create_organization(client: TestClient) -> None:
    """创建机构应返回 201 + 含 id 字段。"""
    org = _create_org(client)
    assert org["id"] >= 1
    assert org["name"].startswith("演示银行")
    assert org["status"] == "active"


def test_duplicate_credit_code_conflict(client: TestClient) -> None:
    """重复 credit_code 应返回 409。"""
    _create_org(client, code_suffix="001")
    resp = client.post(
        "/api/v1/organizations",
        json={
            "name": "另一个银行",
            "org_type": "bank",
            "credit_code": "91110000000000001X",  # 与上面相同
        },
    )
    assert resp.status_code == 409


def test_list_organizations_pagination(client: TestClient) -> None:
    """分页接口应返回分页结构 + total 字段。"""
    for i in range(3):
        _create_org(client, code_suffix=f"00{i + 1}")

    resp = client.get("/api/v1/organizations?page=1&page_size=10")
    assert resp.status_code == 200
    body = resp.json()
    assert "items" in body
    assert "total" in body
    assert body["total"] >= 3
    assert len(body["items"]) <= 10


def test_get_organization_by_id(client: TestClient) -> None:
    """按 id 查询应能正确返回。"""
    created = _create_org(client)
    org_id = created["id"]
    resp = client.get(f"/api/v1/organizations/{org_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == org_id


def test_get_nonexistent_organization_404(client: TestClient) -> None:
    """不存在的 id 应返回 404。"""
    resp = client.get("/api/v1/organizations/99999")
    assert resp.status_code == 404


def test_create_department_under_org(client: TestClient) -> None:
    """在已有机构下创建部门。"""
    org = _create_org(client)
    resp = client.post(
        "/api/v1/organizations/departments",
        json={"organization_id": org["id"], "name": "风险合规部"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "风险合规部"
    assert body["organization_id"] == org["id"]


def test_list_departments_by_org(client: TestClient) -> None:
    """按机构ID应能列出该机构所有部门。"""
    org = _create_org(client)
    for name in ["风控部", "运营部", "IT 部"]:
        r = client.post(
            "/api/v1/organizations/departments",
            json={"organization_id": org["id"], "name": name},
        )
        assert r.status_code == 201

    resp = client.get(f"/api/v1/organizations/{org['id']}/departments")
    assert resp.status_code == 200
    names = [d["name"] for d in resp.json()]
    assert "风控部" in names
    assert "运营部" in names
    assert "IT 部" in names


def test_create_and_list_business_domain(client: TestClient) -> None:
    """业务领域 CRUD 正常。"""
    resp = client.post(
        "/api/v1/organizations/business-domains",
        json={"code": "RETAIL", "name": "零售业务", "description": "面向个人客户"},
    )
    assert resp.status_code == 201
    assert resp.json()["code"] == "RETAIL"

    resp = client.get("/api/v1/organizations/business-domains")
    assert resp.status_code == 200
    items = resp.json() if isinstance(resp.json(), list) else resp.json().get("items", [])
    codes = [b["code"] for b in items]
    assert "RETAIL" in codes


def test_create_and_list_customer_type(client: TestClient) -> None:
    """客户类型 CRUD 正常。"""
    resp = client.post(
        "/api/v1/organizations/customer-types",
        json={"name": "高净值客户", "code": "HNW", "risk_preference": "low"},
    )
    assert resp.status_code == 201
    assert resp.json()["code"] == "HNW"

    resp = client.get("/api/v1/organizations/customer-types")
    assert resp.status_code == 200
    items = resp.json() if isinstance(resp.json(), list) else resp.json().get("items", [])
    assert any(c["code"] == "HNW" for c in items)
