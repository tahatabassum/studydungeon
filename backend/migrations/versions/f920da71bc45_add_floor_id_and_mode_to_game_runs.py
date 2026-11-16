"""add_floor_id_and_mode_to_game_runs

Revision ID: f920da71bc45
Revises: eeae786589dc
Create Date: 2026-11-15 22:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f920da71bc45'
down_revision: Union[str, Sequence[str], None] = 'eeae786589dc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('game_runs', sa.Column('floor_id', sa.String(length=36), nullable=True))
    op.add_column('game_runs', sa.Column('mode', sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column('game_runs', 'mode')
    op.drop_column('game_runs', 'floor_id')

