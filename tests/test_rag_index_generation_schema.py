"""文档索引版本字段的数据结构测试。"""

from sqlalchemy import inspect

from app.features.rag.models import KnowledgeDocument


def test_index_generation_columns_are_nullable_strings(db_session) -> None:
    """索引版本字段允许旧数据保持NULL且不设置默认版本。"""
    table = inspect(KnowledgeDocument).local_table
    active = table.c.active_index_generation
    building = table.c.building_index_generation

    assert active.type.length == 36
    assert building.type.length == 36
    assert active.nullable is True
    assert building.nullable is True
    assert active.default is None
    assert building.default is None
    assert active.server_default is None
    assert building.server_default is None
