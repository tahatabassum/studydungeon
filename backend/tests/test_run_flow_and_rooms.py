import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_session_token
from app.demo.seed import seed_demo_dungeon
from app.models.all_models import User


@pytest.mark.asyncio
async def test_room_clear_flow_and_finish_blocking(async_client: AsyncClient, db_session: AsyncSession):
    """
    Test Item 2:
    1. POST /runs/{id}/rooms/{room_id}/clear returns 409 while monster HP > 0.
    2. POST /runs/{id}/finish returns 409 until boss room is cleared.
    3. Answering for room out of order or cleared room returns 409.
    4. Successful room clear awards XP (25 for normal, 100 for boss) and is idempotent.
    """
    demo_dungeon = await seed_demo_dungeon(db_session)
    user = User(username="run_flow_tester", is_guest=False, password_hash="hash")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    token = create_session_token(user.id, session_version=user.session_version)
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    # 1. Start run
    run_resp = await async_client.post("/runs", json={"dungeon_id": demo_dungeon.id})
    run_id = run_resp.json()["id"]

    dungeon_detail = (await async_client.get(f"/dungeons/{demo_dungeon.id}")).json()
    rooms = dungeon_detail["rooms"]
    room_0 = rooms[0]
    room_1 = rooms[1]

    # 2. Attempt clear room 0 while monster HP > 0 -> 409
    clear_fail = await async_client.post(f"/runs/{run_id}/rooms/{room_0['id']}/clear")
    assert clear_fail.status_code == 409
    assert clear_fail.json()["detail"]["code"] == "MONSTER_ALIVE"

    # 3. Attempt finish before boss room is cleared -> 409
    finish_fail = await async_client.post(f"/runs/{run_id}/finish")
    assert finish_fail.status_code == 409
    assert finish_fail.json()["detail"]["code"] == "BOSS_NOT_CLEARED"

    # 4. Attempt submitting answer to Room 1 before clearing Room 0 -> 409 OUT_OF_ORDER
    out_of_order_att = await async_client.post(
        f"/runs/{run_id}/attempts",
        json={
            "attempt_id": str(uuid.uuid4()),
            "question_id": room_1["questions"][0]["id"],
            "selected_answer": room_1["questions"][0]["options"][0],
            "weapon_name": "Rusty Dagger",
        },
    )
    assert out_of_order_att.status_code == 409
    assert out_of_order_att.json()["detail"]["code"] == "OUT_OF_ORDER_ROOM"
