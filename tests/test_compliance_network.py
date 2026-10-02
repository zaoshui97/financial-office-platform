"""合规沙箱网络白名单单元测试。"""

from app.features.compliance.network import is_internal_base_url, provider_allowed


def test_internal_ip_v4_10() -> None:
    assert is_internal_base_url("http://10.0.0.5:8000/v1") is True


def test_internal_ip_v4_172() -> None:
    assert is_internal_base_url("http://172.20.10.3:9000") is True


def test_internal_ip_v4_192() -> None:
    assert is_internal_base_url("http://192.168.1.1:11434") is True


def test_loopback_internal() -> None:
    assert is_internal_base_url("http://127.0.0.1:9000") is True


def test_public_ip_blocked() -> None:
    assert is_internal_base_url("https://api.openai.com/v1") is False


def test_public_suffix_allowed() -> None:
    """默认*.hengsheng.com 后缀允许。"""
    assert is_internal_base_url("https://llm.hengsheng.com/v1") is True


def test_empty_url_blocked() -> None:
    assert is_internal_base_url("") is False
    assert is_internal_base_url(None) is False  # type: ignore[arg-type]


def test_provider_whitelist_with_internal() -> None:
    """白名单含 provider 且 base_url 内网：通过。"""
    from app.core.config import settings

    settings.SANDBOX_PROVIDER_WHITELIST = ["custom"]
    try:
        assert (
            provider_allowed("custom", "http://10.0.0.1:9000") is True
        )
    finally:
        settings.SANDBOX_PROVIDER_WHITELIST = []


def test_provider_whitelist_blocks_external() -> None:
    """白名单含 provider 但 base_url 外网：拒绝。"""
    from app.core.config import settings

    settings.SANDBOX_PROVIDER_WHITELIST = ["custom"]
    try:
        assert (
            provider_allowed("custom", "https://api.openai.com/v1") is False
        )
    finally:
        settings.SANDBOX_PROVIDER_WHITELIST = []


def test_no_whitelist_requires_internal() -> None:
    """无白名单时仅内网通过。"""
    from app.core.config import settings

    settings.SANDBOX_PROVIDER_WHITELIST = []
    assert provider_allowed("anything", "http://10.0.0.1") is True
    assert provider_allowed("anything", "https://api.openai.com") is False