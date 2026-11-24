"""add run room_ids and daily haunt streak

Revision ID: a7c3d9e1f204
Revises: f920da71bc45
Create Date: 2026-11-24 00:00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a7c3d9e1f204"
down_revision: Union[str, Sequence[str], None] = "f920da71bc45"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("game_runs") as batch:
        batch.add_column(sa.Column("room_ids", sa.JSON(), nullable=True))
    with op.batch_alter_table("user_progress") as batch:
        batch.add_column(sa.Column("daily_streak", sa.Integer(), nullable=False, server_default="0"))
        batch.add_column(sa.Column("last_haunt_on", sa.DateTime(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("user_progress") as batch:
        batch.drop_column("last_haunt_on")
        batch.drop_column("daily_streak")
    with op.batch_alter_table("game_runs") as batch:
        batch.drop_column("room_ids")