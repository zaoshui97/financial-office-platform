"""合规沙箱 PII 脱敏器单元测试。"""

from app.features.compliance.sanitizer import (
    PIISanitizer,
    sanitize_preview,
    sanitize_text,
)


def test_id_card_replaced() -> None:
    """18 位身份证号应被替换为 ***。"""
    text = "客户张三，身份证 110101199003078888，住址北京。"
    res = sanitize_text(text)
    assert "***" in res.text
    assert "110101199003078888" not in res.text
    assert res.hits.get("id_card") == 1


def test_bank_card_replaced() -> None:
    """16-19 位连续数字（银行卡）应被替换。"""
    text = "卡号 6222021234567890123 已扣款"
    res = sanitize_text(text)
    assert "***" in res.text
    assert "6222021234567890123" not in res.text
    assert res.hits.get("bank_card") == 1


def test_mobile_replaced() -> None:
    """11 位手机号应被替换。"""
    text = "联系 13800138000 处理"
    res = sanitize_text(text)
    assert "***" in res.text
    assert "13800138000" not in res.text
    assert res.hits.get("mobile") == 1


def test_email_replaced() -> None:
    """邮箱应被替换。"""
    text = "邮件 zhangsan@hengsheng.com 收悉"
    res = sanitize_text(text)
    assert "***" in res.text
    assert "zhangsan@hengsheng.com" not in res.text
    assert res.hits.get("email") == 1


def test_multiple_pii_hits() -> None:
    """多种 PII 同时存在，应全部被替换。"""
    text = "张三 13800138000，身份证 110101199003078888，邮箱 a@b.com"
    res = sanitize_text(text)
    assert res.text, "result text should not be empty"
    assert "***" in res.text
    assert res.has_pii
    assert res.total_hits == 3
    # 校验每一种 PII 都至少命中 1 次
    assert res.hits.get("id_card") == 1
    assert res.hits.get("mobile") == 1
    assert res.hits.get("email") == 1


def test_no_pii_returns_original() -> None:
    """无 PII 时原文不变。"""
    text = "查询当前金融政策的合规要求"
    res = sanitize_text(text)
    assert res.text == text
    assert not res.has_pii


def test_empty_input() -> None:
    """空输入应返回空串 + 空命中。"""
    res = sanitize_text("")
    assert res.text == ""
    assert not res.has_pii


def test_preview_truncates_then_sanitizes() -> None:
    """预览应先截前 max_chars 字再脱敏。"""
    text = "leading " + ("a" * 600) + " 110101199003078888 tail"
    res = sanitize_preview(text, max_chars=50)
    assert len(res.text) <= 50 + len(" ***") * 1  # 允许替换占位稍长


def test_custom_pattern_override() -> None:
    """注入自定义模式后默认身份证正则不再生效。"""
    custom = PIISanitizer(patterns={"token": r"TOKEN-\d+"})
    res = custom.sanitize("请使用 TOKEN-123456 激活")
    assert "***" in res.text
    assert res.hits.get("token") == 1
    assert "id_card" not in res.hits