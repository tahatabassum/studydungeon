import uuid

import pytest
from httpx import AsyncClient
from hypothesis import given
from hypothesis import strategies as st
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_session_token
from app.demo.seed import seed_demo_dungeon
from app.models.all_models import User, UserProgress
from app.services.combat import WEAPON_BASE_DAMAGE, calculate_combat_damage


@pytest.mark.asyncio
async def test_locked_weapon_rejected(async_client: AsyncClient, db_session: AsyncSession):
    """Submitting an attempt with a weapon the user has not unlocked returns 403 FORBIDDEN."""
    demo_dungeon = await seed_demo_dungeon(db_session)
    user = User(username="novice_fighter", is_guest=False, password_hash="hash")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    # User starts at level 1 with only Rusty Dagger
    progress = UserProgress(user_id=user.id, level=1, total_xp=0, unlocked_weapons=["Rusty Dagger"])
    db_session.add(progress)
    await db_session.commit()

    token = create_session_token(user.id, session_version=user.session_version)
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    run_resp = await async_client.post("/runs", json={"dungeon_id": demo_dungeon.id})
    run_id = run_resp.json()["id"]

    dungeon_detail = (await async_client.get(f"/dungeons/{demo_dungeon.id}")).json()
    q_id = dungeon_detail["rooms"][0]["questions"][0]["id"]

    # Attempt to attack using "Flame Sigil" (requires Defeat 1st Boss)
    resp = await async_client.post(
        f"/runs/{run_id}/attempts",
        json={
            "attempt_id": str(uuid.uuid4()),
            "question_id": q_id,
            "selected_answer": "Arbitrary",
            "weapon_name": "Flame Sigil",
        },
    )
    assert resp.status_code == 403
    assert resp.json()["detail"]["code"] == "WEAPON_LOCKED"


@pytest.mark.asyncio
async def test_unknown_weapon_rejected(async_client: AsyncClient, db_session: AsyncSession):
    """Submitting an unknown weapon returns 422 or 400."""
    demo_dungeon = await seed_demo_dungeon(db_session)
    user = User(username="cheater_user", is_guest=False, password_hash="hash")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    token = create_session_token(user.id, session_version=user.session_version)
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    run_resp = await async_client.post("/runs", json={"dungeon_id": demo_dungeon.id})
    run_id = run_resp.json()["id"]

    dungeon_detail = (await async_client.get(f"/dungeons/{demo_dungeon.id}")).json()
    q_id = dungeon_detail["rooms"][0]["questions"][0]["id"]

    resp = await async_client.post(
        f"/runs/{run_id}/attempts",
        json={
            "attempt_id": str(uuid.uuid4()),
            "question_id": q_id,
            "selected_answer": "Arbitrary",
            "weapon_name": "BFG 9000 Hacked Weapon",
        },
    )
    assert resp.status_code in (400, 422)
    assert resp.json()["detail"]["code"] == "UNKNOWN_WEAPON"


@given(
    weapon=st.sampled_from(list(WEAPON_BASE_DAMAGE.keys())),
    difficulty=st.sampled_from(["easy", "medium", "hard"]),
    streak=st.integers(min_value=0, max_value=20),
    is_correct=st.booleans(),
    is_boss=st.booleans(),
)
def test_hypothesis_damage_math_over_every_weapon(weapon, difficulty, streak, is_correct, is_boss):
    """Hypothesis PBT: Verifies mathematical invariants for all weapons and combat variables."""
    dmg_monster, dmg_player, is_crit = calculate_combat_damage(
        weapon_name=weapon,
        difficulty=difficulty,
        current_streak=streak,
        is_correct=is_correct,
        is_boss=is_boss,
    )
    if not is_correct:
        assert dmg_monster == 0
        assert dmg_player == (12 if is_boss else 10)
        assert is_crit is False
    else:
        assert dmg_player == 0
        base = WEAPON_BASE_DAMAGE[weapon]
        assert dmg_monster >= base
        if streak >= 2:
            assert is_crit is True
            assert dmg_monster >= round(base * 1.5)
