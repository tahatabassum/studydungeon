import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.demo.seed import seed_demo_dungeon
from app.models.all_models import Dungeon


@pytest.mark.asyncio
async def test_seed_demo_dungeon_idempotent_serial(db_session: AsyncSession):
    """
    Running seed_demo_dungeon twice in succession on the same DB must not create a duplicate demo dungeon.
    """
    dungeon1 = await seed_demo_dungeon(db_session)
    dungeon2 = await seed_demo_dungeon(db_session)

    assert dungeon1.id == dungeon2.id

    # Check total demo dungeons in DB
    res = await db_session.execute(select(Dungeon).where(Dungeon.is_public_demo.is_(True)))
    demos = res.scalars().all()
    assert len(demos) == 1


@pytest.mark.asyncio
async def test_seed_demo_dungeon_idempotent_repeat_call(db_session: AsyncSession):
    """
    Simulates repeated execution after transaction commit.
    """
    d1 = await seed_demo_dungeon(db_session)
    await db_session.commit()

    d2 = await seed_demo_dungeon(db_session)
    await db_session.commit()

    assert d1.id == d2.id

    res = await db_session.execute(select(Dungeon).where(Dungeon.is_public_demo.is_(True)))
    demos = res.scalars().all()
    assert len(demos) == 1


