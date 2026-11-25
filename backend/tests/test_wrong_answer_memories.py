"""Wrong answers go to Memories (a ReviewItem due in 10 minutes) and cost HP, never re-ask via requeue_after."""

import uuid
from datetime import datetime, timedelta

import pytest
from httpx import AsyncClient
from hypothesis import given, settings
from hypothesis import strategies as st
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import runs as runs_module
from app.core.config import settings as app_settings
from app.core.security import create_session_token
from app.demo.seed_packs import seed_content_packs
from app.models.all_models import Attempt, DungeonRoom, Question, ReviewItem, User
from app.services.combat import WEAPON_BASE_DAMAGE, calculate_combat_damage
from app.services.srs import calculate_next_review_interval

WRONG = "DEFINITELY_WRONG_ANSWER_12345"


async def _start_floor_run(async_client: AsyncClient, db_session: AsyncSession, username: str):
    packs = sorted(await seed_content_packs(db_session), key=lambda p: p.order)
    dungeon_id = packs[0].dungeon_id

    user = User(username=username, is_guest=False, password_hash="hash")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    async_client.cookies.set(
        app_settings.SESSION_COOKIE_NAME, create_session_token(user.id, session_version=user.session_version)
    )

    d_data = (await async_client.get(f"/dungeons/{dungeon_id}")).json()
    floor = d_data["floors"][0]
    run_resp = await async_client.post(
        "/runs", json={"dungeon_id": dungeon_id, "floor_id": floor["id"], "mode": "floor"}
    )
    assert run_resp.status_code == 201, run_resp.text
    run = run_resp.json()
    rooms_by_id = {r["id"]: r for r in d_data["rooms"]}
    return user, run, floor, rooms_by_id


async def _wrong_attempt(async_client: AsyncClient, run_id: str, question_id: str, attempt_id: str | None = None):
    return await async_client.post(
        f"/runs/{run_id}/attempts",
        json={
            "attempt_id": attempt_id or str(uuid.uuid4()),
            "question_id": question_id,
            "selected_answer": WRONG,
            "weapon_name": "Rusty Dagger",
        },
    )


async def _review_items(db_session: AsyncSession, user_id: str, question_id: str):
    db_session.expire_all()
    res = await db_session.execute(
        select(ReviewItem).where(ReviewItem.user_id == user_id, ReviewItem.question_id == question_id)
    )
    return res.scalars().all()


@pytest.mark.asyncio
async def test_wrong_attempt_creates_memory_and_lists_when_due(async_client: AsyncClient, db_session: AsyncSession):
    user, run, _floor, rooms_by_id = await _start_floor_run(async_client, db_session, "memories_hero")
    q = rooms_by_id[run["room_ids"][0]]["questions"][0]

    before = datetime.utcnow()
    resp = await _wrong_attempt(async_client, run["id"], q["id"])
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["is_correct"] is False
    assert data.get("requeue_after") is None
    assert data["damage_dealt"] == 0
    assert data["damage_taken"] == 10
    assert data["current_hp"] == 90

    items = await _review_items(db_session, user.id, q["id"])
    assert len(items) == 1
    item = items[0]
    assert item.last_result == "wrong"
    assert item.repetition == 0
    delta = item.due_at - before
    assert timedelta(minutes=9, seconds=55) <= delta <= timedelta(minutes=10, seconds=30)

    # Not due yet: not listed.
    not_due = await async_client.get("/reviews/due")
    assert not_due.status_code == 200
    assert q["id"] not in [i["question_id"] for i in not_due.json()]

    # Move it into the past: now listed once, with no answer in the payload.
    item.due_at = datetime.utcnow() - timedelta(minutes=1)
    await db_session.commit()

    due = await async_client.get("/reviews/due")
    assert due.status_code == 200
    listed = [i for i in due.json() if i["question_id"] == q["id"]]
    assert len(listed) == 1
    assert "correct_option" not in listed[0]
    assert "correct_answer" not in listed[0]
    assert "evidence_quote" not in listed[0]


@pytest.mark.asyncio
async def test_wrong_answer_costs_12_hp_in_boss_room(async_client: AsyncClient, db_session: AsyncSession):
    user, run, floor, rooms_by_id = await _start_floor_run(async_client, db_session, "boss_memories_hero")
    room_ids = run["room_ids"]
    assert len(room_ids) >= 2

    # Defeat every room before the boss so the order check allows the boss room.
    db_rooms = (
        await db_session.execute(
            select(DungeonRoom).where(DungeonRoom.id.in_(room_ids[:-1])).order_by(DungeonRoom.room_order)
        )
    ).scalars().all()
    for r in db_rooms:
        q = (await db_session.execute(select(Question).where(Question.topic_id == r.topic_id).limit(1))).scalar_one()
        db_session.add(
            Attempt(
                id=str(uuid.uuid4()),
                user_id=user.id,
                run_id=run["id"],
                question_id=q.id,
                is_correct=True,
                damage_dealt=r.monster_hp,
            )
        )
    await db_session.commit()

    boss_q = rooms_by_id[room_ids[-1]]["questions"][0]
    resp = await _wrong_attempt(async_client, run["id"], boss_q["id"])
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["is_correct"] is False
    assert data["damage_dealt"] == 0
    assert data["damage_taken"] == 12
    assert data["current_hp"] == 88
    assert data.get("requeue_after") is None


@pytest.mark.asyncio
async def test_replay_same_attempt_id_creates_no_second_review_item(
    async_client: AsyncClient, db_session: AsyncSession
):
    """Property 6: Attempt replay is idempotent (memory cache path and database path)."""
    user, run, _floor, rooms_by_id = await _start_floor_run(async_client, db_session, "replay_memories_hero")
    q = rooms_by_id[run["room_ids"][0]]["questions"][0]
    attempt_id = str(uuid.uuid4())

    first = await _wrong_attempt(async_client, run["id"], q["id"], attempt_id)
    assert first.status_code == 200, first.text
    assert len(await _review_items(db_session, user.id, q["id"])) == 1

    # Replay served from the in-memory cache.
    second = await _wrong_attempt(async_client, run["id"], q["id"], attempt_id)
    assert second.status_code == 200
    assert second.json() == first.json()
    assert len(await _review_items(db_session, user.id, q["id"])) == 1

    # Replay served from the database (cache cleared).
    runs_module._PROCESSED_ATTEMPTS.clear()
    third = await _wrong_attempt(async_client, run["id"], q["id"], attempt_id)
    assert third.status_code == 200, third.text
    t = third.json()
    f = first.json()
    for key in ("is_correct", "damage_dealt", "damage_taken", "current_hp"):
        assert t[key] == f[key]
    assert t.get("requeue_after") is None
    assert len(await _review_items(db_session, user.id, q["id"])) == 1

    count = (
        await db_session.execute(select(func.count(Attempt.id)).where(Attempt.id == attempt_id))
    ).scalar_one()
    assert count == 1
    assert (await async_client.get(f"/runs/{run['id']}")).json()["current_hp"] == 90


# Feature: frontend-14-no-retry-and-predeploy-audit, Property 3: Wrong answers cost HP and deal no damage
# **Validates: Requirements 3.1**
@settings(max_examples=200, deadline=None)
@given(
    weapon=st.sampled_from(sorted(WEAPON_BASE_DAMAGE)),
    difficulty=st.sampled_from(["easy", "medium", "hard"]),
    streak=st.integers(min_value=0, max_value=50),
    is_boss=st.booleans(),
    hp=st.integers(min_value=0, max_value=100),
)
def test_property_wrong_answer_costs_hp_and_deals_no_damage(weapon, difficulty, streak, is_boss, hp):
    dealt, taken, critical = calculate_combat_damage(
        weapon_name=weapon,
        difficulty=difficulty,
        current_streak=streak,
        is_correct=False,
        is_boss=is_boss,
    )
    assert dealt == 0
    assert taken == (12 if is_boss else 10)
    assert critical is False
    assert max(0, hp - taken) == max(0, hp - (12 if is_boss else 10))


# Feature: frontend-14-no-retry-and-predeploy-audit, Property 4: Wrong answers schedule a review in 10 minutes
# **Validates: Requirements 3.3**
@settings(max_examples=200, deadline=None)
@given(
    repetition=st.integers(min_value=-5, max_value=100),
    marked_hard=st.booleans(),
)
def test_property_wrong_answer_schedules_review_in_ten_minutes(repetition, marked_hard):
    before = datetime.utcnow()
    rep, interval, due = calculate_next_review_interval(
        current_repetition=repetition, is_correct=False, marked_hard=marked_hard
    )
    after = datetime.utcnow()
    assert rep == 0
    assert interval == pytest.approx(10 / 1440)
    assert before + timedelta(minutes=10) <= due <= after + timedelta(minutes=10)
