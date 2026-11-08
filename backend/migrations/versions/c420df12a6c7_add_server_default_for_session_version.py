"""add_server_default_for_session_version

Revision ID: c420df12a6c7
Revises: 188c79c171dd
Create Date: 2026-11-08 03:03:47.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c420df12a6c7'
down_revision: Union[str, Sequence[str], None] = '188c79c171dd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ensure session_version has server_default=1 for existing and future rows across SQLite and PostgreSQL
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.alter_column('session_version',
                              existing_type=sa.Integer(),
                              server_default=sa.text('1'),
                              existing_nullable=False)


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.alter_column('session_version',
                              existing_type=sa.Integer(),
                              server_default=None,
                              existing_nullable=False)
