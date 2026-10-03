"""add blackboard_events table

Revision ID: 20261003_002
Revises: 20261003_001
Create Date: 2026-10-03 20:01:00.000000

新增 blackboard_events 表：
  - id, session_id, agent_role, version, state, created_at
  - 唯一索引 (session_id, agent_role, version) — 防止重复落
  - 普通索引 (session_id, version) — 加速 since_version 增量拉取

用途：前端断线重连后调 GET /blackboard/events?since_version=N
      拉取漏掉的事件流，保证本地 state 不落后。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20261003_002'
down_revision: Union[str, None] = '20261003_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'meeting_blackboard_events',
        sa.Column('id', sa.BigInteger().with_variant(sa.Integer(), 'sqlite'),
                  autoincrement=True, nullable=False),
        sa.Column('session_id', sa.BigInteger(), nullable=False,
                  comment='关联的会议会话 ID'),
        sa.Column('agent_role', sa.String(length=32), nullable=False,
                  comment='moderator / noter / decision / dispatcher'),
        sa.Column('version', sa.BigInteger(), nullable=False,
                  comment='写黑板后自增的 version 号'),
        sa.Column('state', sa.JSON(), nullable=False,
                  comment='写入的 state 快照（与 meeting_blackboard.state_json 同步）'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'),
                  nullable=False, comment='事件落库时间'),
        sa.ForeignKeyConstraint(['session_id'], ['meeting_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'idx_meeting_event_session_version',
        'meeting_blackboard_events', ['session_id', 'version'],
    )
    op.create_index(
        'uq_meeting_event_session_role_version',
        'meeting_blackboard_events', ['session_id', 'agent_role', 'version'],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index('uq_meeting_event_session_role_version', table_name='meeting_blackboard_events')
    op.drop_index('idx_meeting_event_session_version', table_name='meeting_blackboard_events')
    op.drop_table('meeting_blackboard_events')