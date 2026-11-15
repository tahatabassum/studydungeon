import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_session_token
from app.demo.seed_packs import seed_content_packs
from app.models.all_models import Attempt, DungeonRoom, GameRun, Question, User


async def _boss_cleared_run(db: AsyncSession, user: User, dungeon_id: str, status: str = "active", finished_at=None) -> GameRun:
    rooms = (await db.execute(select(DungeonRoom).where(DungeonRoom.dungeon_id == dungeon_id))).scalars().all()
    boss = max(rooms, key=lambda r: r.room_order)
    q = (await db.execute(select(Question).where(Question.topic_id == boss.topic_id).limit(1))).scalar_one()
    run = GameRun(user_id=user.id, dungeon_id=dungeon_id, status=status, finished_at=finished_at)
    db.add(run)
    await db.flush()
    db.add(Attempt(id=str(uuid.uuid4()), user_id=user.id, run_id=run.id, question_id=q.id, is_correct=True, damage_dealt=boss.monster_hp))
    await db.commit()
    db.expunge_all()
    return run


@pytest.mark.asyncio
async def test_pack_unlock_reported_only_on_first_completion(async_client: AsyncClient, db_session: AsyncSession):
    packs = sorted(await seed_content_packs(db_session), key=lambda p: p.order)
    user = User(username="pack_replay_tester", is_guest=False, password_hash="hash")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, create_session_token(user.id, session_version=user.session_version))

    first = await _boss_cleared_run(db_session, user, packs[0].dungeon_id)
    r1 = await async_client.post(f"/runs/{first.id}/finish")
    assert r1.status_code == 200, r1.text
    assert r1.json()["pack_progress"]["unlocked_pack_id"] == packs[1].id

    # Re-finishing the same run stays idempotent and still reports its unlock.
    r1b = await async_client.post(f"/runs/{first.id}/finish")
    assert r1b.json()["pack_progress"]["unlocked_pack_id"] == packs[1].id

    replay = await _boss_cleared_run(db_session, user, packs[0].dungeon_id)
    r2 = await async_client.post(f"/runs/{replay.id}/finish")
    assert r2.status_code == 200
    progress = r2.json()["pack_progress"]
    assert progress["pack_id"] == packs[0].id
    assert progress["status"] == "completed"
    assert progress["unlocked_pack_id"] is None

@pytest.mark.asyncio
async def test_pack_rooms_are_zero_based_and_final_boss_is_the_boss(async_client: AsyncClient, db_session: AsyncSession):
    packs = sorted(await seed_content_packs(db_session), key=lambda p: p.order)
    user = User(username="pack_shape_tester", is_guest=False, password_hash="hash")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, create_session_token(user.id, session_version=user.session_version))

    body = (await async_client.get(f"/dungeons/{packs[0].dungeon_id}")).json()
    rooms = body["rooms"]
    assert [r["room_number"] for r in rooms] == list(range(1, len(rooms) + 1))
    bosses = [r for r in rooms if r["is_boss"]]
    assert len(bosses) == 1 and bosses[0].get("floor_id") is None
    assert body["final_boss"]["id"] == bosses[0]["id"]
    assert body["final_boss"]["name"] == "The Exam Warden"
    assert {r["monster_name"] for r in rooms}.isdisjoint({"minion", "floor_boss", "final_boss"})
    assert [f["status"] for f in body["floors"]] == ["ready"] + ["locked"] * (len(body["floors"]) - 1)
    assert all("rank" in f and f["rank"] is None for f in body["floors"])
    for floor in body["floors"]:
        assert floor["room_ids"] and bosses[0]["id"] not in floor["room_ids"]


@pytest.mark.asyncio
async def test_reseed_normalizes_legacy_one_based_room_order(db_session: AsyncSession):
    packs = await seed_content_packs(db_session)
    rooms = (await db_session.execute(select(DungeonRoom).where(DungeonRoom.dungeon_id == packs[0].dungeon_id))).scalars().all()
    for r in rooms:
        r.room_order += 1
        r.monster_type = "minion"
    await db_session.commit()

    await seed_content_packs(db_session)
    orders = sorted(
        (await db_session.execute(select(DungeonRoom.room_order).where(DungeonRoom.dungeon_id == packs[0].dungeon_id))).scalars().all()
    )
    assert orders == list(range(len(orders)))
    names = (await db_session.execute(select(DungeonRoom.monster_type).where(DungeonRoom.dungeon_id == packs[0].dungeon_id))).scalars().all()
    assert "minion" not in names
