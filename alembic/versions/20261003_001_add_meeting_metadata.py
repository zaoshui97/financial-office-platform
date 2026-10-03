"""add meeting metadata fields

Revision ID: 20261003_001
Revises: 9ca81cc70198
Create Date: 2026-10-03 19:55:00.000000

新增 3 个字段到 meeting_sessions：
  - topic: 会议主题（500 字符）
  - agenda: 初始议题（500 字符）
  - current_phase: 会议阶段（32 字符，open/discussing/closing/closed）

说明：原本 topic/agenda/phase 写在黑板 moderator.state 里，现平移到表字段，
便于 REST 详情接口直接读取，phase 由 moderator Agent 跑完同步回表。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20261003_001'
down_revision: Union[str, None] = '9ca81cc70198'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'meeting_sessions',
        sa.Column('topic', sa.String(length=500), nullable=True, comment='会议主题'),
    )
    op.add_column(
        'meeting_sessions',
        sa.Column('agenda', sa.String(length=500), nullable=True, comment='初始议题'),
    )
    op.add_column(
        'meeting_sessions',
        sa.Column('current_phase', sa.String(length=32), nullable=True,
                  comment='会议阶段（open/discussing/closing/closed）'),
    )


def downgrade() -> None:
    op.drop_column('meeting_sessions', 'current_phase')
    op.drop_column('meeting_sessions', 'agenda')
    op.drop_column('meeting_sessions', 'topic')