import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_session_token
from app.demo.seed import seed_demo_dungeon
from app.models.all_models import Dungeon, User


@pytest.mark.asyncio
async def test_guest_can_only_play_public_demo_dungeon(async_client: AsyncClient, db_session: AsyncSession):
    """Guest can start run on demo dungeon, but gets 403 on user private dungeons."""
    demo_dungeon = await seed_demo_dungeon(db_session)

    # 1. Private dungeon
    normal_user = User(username="regular_host", is_guest=False, password_hash="hash")
    db_session.add(normal_user)
    await db_session.commit()
    await db_session.refresh(normal_user)

    priv_dungeon = Dungeon(user_id=normal_user.id, title="Secret Vault", is_public_demo=False)
    db_session.add(priv_dungeon)
    await db_session.commit()
    await db_session.refresh(priv_dungeon)

    # Guest user
    guest = User(username="guest_player_99", is_guest=True, password_hash=None)
    db_session.add(guest)
    await db_session.commit()
    await db_session.refresh(guest)

    token = create_session_token(guest.id, session_version=guest.session_version, is_guest=True)
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    # Attempt private dungeon -> 403
    p_resp = await async_client.post("/runs", json={"dungeon_id": priv_dungeon.id})
    assert p_resp.status_code == 403
    assert p_resp.json()["detail"]["code"] == "GUEST_FORBIDDEN"

    # Play public demo dungeon -> 201 Created
    demo_resp = await async_client.post("/runs", json={"dungeon_id": demo_dungeon.id})
    assert demo_resp.status_code == 201
    assert "id" in demo_resp.json()
    assert demo_resp.json()["current_hp"] == 100


@pytest.mark.asyncio
async def test_run_attempt_idempotency_and_combat_progression(async_client: AsyncClient, db_session: AsyncSession):
    """
    Submitting an attempt updates HP, score, streak and is idempotent by attempt_id.
    """
    demo_dungeon = await seed_demo_dungeon(db_session)
    user = User(username="player_hero", is_guest=False, password_hash="hash")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    token = create_session_token(user.id, session_version=user.session_version, is_guest=False)
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    # Start run
    run_resp = await async_client.post("/runs", json={"dungeon_id": demo_dungeon.id})
    assert run_resp.status_code == 201
    run_id = run_resp.json()["id"]

    # Get first room question
    dungeon_detail = (await async_client.get(f"/dungeons/{demo_dungeon.id}")).json()
    first_room = dungeon_detail["rooms"][0]
    first_q = first_room["questions"][0]

    attempt_uuid = str(uuid.uuid4())
    attempt_payload = {
        "attempt_id": attempt_uuid,
        "question_id": first_q["id"],
        "selected_answer": first_q["options"][1],  # correct option in demo CPU topic
        "weapon_name": "Rusty Dagger",
    }

    # First attempt submission
    att_resp_1 = await async_client.post(f"/runs/{run_id}/attempts", json=attempt_payload)
    assert att_resp_1.status_code == 200
    res_data_1 = att_resp_1.json()
    assert res_data_1["is_correct"] is True
    assert res_data_1["damage_dealt"] == 20

    # Idempotent replay with identical attempt_id returns cached result without double damage/score
    att_resp_2 = await async_client.post(f"/runs/{run_id}/attempts", json=attempt_payload)
    assert att_resp_2.status_code == 200
    res_data_2 = att_resp_2.json()
    assert res_data_2 == res_data_1
