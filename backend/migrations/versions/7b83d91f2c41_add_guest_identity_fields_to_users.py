"""add_guest_identity_fields_to_users

Revision ID: 7b83d91f2c41
Revises: c420df12a6c7
Create Date: 2026-11-11 08:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7b83d91f2c41'
down_revision: Union[str, Sequence[str], None] = 'c420df12a6c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('public_id', sa.String(length=16), nullable=True))
        batch_op.add_column(sa.Column('display_name', sa.String(length=32), nullable=True))
        batch_op.add_column(sa.Column('display_name_norm', sa.String(length=32), nullable=True))
        batch_op.add_column(sa.Column('tag', sa.String(length=8), nullable=True))
        batch_op.add_column(sa.Column('is_test', sa.Boolean(), server_default=sa.text('0'), nullable=False))
        batch_op.add_column(sa.Column('notice_accepted_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('notice_version', sa.String(length=16), nullable=True))
        batch_op.add_column(sa.Column('last_active_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False))
        batch_op.add_column(sa.Column('upgraded_at', sa.DateTime(), nullable=True))
        batch_op.create_index('ix_users_public_id', ['public_id'], unique=True)
        batch_op.create_index('ix_users_display_name_norm', ['display_name_norm'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_index('ix_users_display_name_norm')
        batch_op.drop_index('ix_users_public_id')
        batch_op.drop_column('upgraded_at')
        batch_op.drop_column('last_active_at')
        batch_op.drop_column('notice_version')
        batch_op.drop_column('notice_accepted_at')
        batch_op.drop_column('is_test')
        batch_op.drop_column('tag')
        batch_op.drop_column('display_name_norm')
        batch_op.drop_column('display_name')
        batch_op.drop_column('public_id')
