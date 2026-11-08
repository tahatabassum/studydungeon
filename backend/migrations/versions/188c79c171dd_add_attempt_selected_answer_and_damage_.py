"""add_attempt_selected_answer_and_damage_taken

Revision ID: 188c79c171dd
Revises: fe55ed8d4807
Create Date: 2026-11-08 01:36:49.616360

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '188c79c171dd'
down_revision: Union[str, Sequence[str], None] = 'fe55ed8d4807'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('attempts', sa.Column('selected_answer', sa.String(length=255), nullable=False, server_default=''))
    op.add_column('attempts', sa.Column('damage_taken', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('attempts', 'damage_taken')
    op.drop_column('attempts', 'selected_answer')
