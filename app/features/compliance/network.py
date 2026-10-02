"""合规沙箱网络白名单：校验 Provider 的 base_url 是否在内网段。"""

from __future__ import annotations

import ipaddress
from urllib.parse import urlparse

from app.core.config import settings

# 内网保留网段（RFC1918 / 100.64.0.0/10 运营商级 NAT）。
INTERNAL_NETWORKS: tuple[ipaddress._BaseNetwork, ...] = (
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
)


def _host_in_internal_networks(host: str) -> bool:
    """判断 host 是否命中内网 IP 段。"""
    try:
        # urlparse 对纯域名不会抛错，这里对字面量 IP 段单独走 try。
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    return any(ip in network for network in INTERNAL_NETWORKS)


def _host_matches_suffix(host: str, suffixes: list[str]) -> bool:
    """判断 host 是否命中任一允许后缀（如 .hengsheng.com）。"""
    host = host.lower().strip()
    return any(host.endswith(suffix.lower()) for suffix in suffixes if suffix)


def is_internal_base_url(base_url: str) -> bool:
    """校验 URL 是否指向内网。

    规则：URL 解析成功 + host 是内网 IP，或 host 以 SANDBOX_BASE_URL_INTERNAL_SUFFIXES
    中任一后缀结尾。否则视为外网，沙箱禁止调用。
    """
    if not base_url:
        return False
    try:
        parsed = urlparse(base_url)
    except ValueError:
        return False
    host = (parsed.hostname or "").strip().lower()
    if not host:
        return False
    if _host_in_internal_networks(host):
        return True
    return _host_matches_suffix(host, settings.SANDBOX_BASE_URL_INTERNAL_SUFFIXES)


def provider_allowed(provider_name: str, base_url: str) -> bool:
    """判断 provider 是否能在沙箱内被使用。

    规则：
    1. provider_name 在 SANDBOX_PROVIDER_WHITELIST 中，或
    2. 白名单为空但 base_url 命中内网。
    """
    whitelist = settings.SANDBOX_PROVIDER_WHITELIST
    if provider_name in whitelist:
        return is_internal_base_url(base_url)
    if not whitelist:
        return is_internal_base_url(base_url)
    return False