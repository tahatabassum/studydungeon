import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_session_token
from app.demo.seed_packs import seed_content_packs
from app.models.all_models import Attempt, DungeonRoom, Question, User


@pytest.mark.asyncio
async def test_floor_campaign_locking_and_progression(async_client: AsyncClient, db_session: AsyncSession):
    packs = sorted(await seed_content_packs(db_session), key=lambda p: p.order)
    pack1 = packs[0]
    dungeon_id = pack1.dungeon_id

    user = User(username="floor_campaign_hero", is_guest=False, password_hash="hash")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    token = create_session_token(user.id, session_version=user.session_version)
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    # 1. Fetch dungeon details - should show floors
    d_resp = await async_client.get(f"/dungeons/{dungeon_id}")
    assert d_resp.status_code == 200, d_resp.text
    d_data = d_resp.json()
    assert "floors" in d_data
    assert len(d_data["floors"]) >= 2
    f1 = d_data["floors"][0]
    f2 = d_data["floors"][1]
    final_boss = d_data.get("final_boss")

    # Floor 1 must be ready, Floor 2 locked, Final Boss locked
    assert f1["status"] == "ready"
    assert f2["status"] == "locked"
    if final_boss:
        assert final_boss["unlocked"] is False

    # 2. Starting Floor 2 directly must fail with 403 FLOOR_LOCKED
    fail_f2 = await async_client.post(
        "/runs",
        json={"dungeon_id": dungeon_id, "floor_id": f2["id"], "mode": "floor"},
    )
    assert fail_f2.status_code == 403
    assert fail_f2.json()["detail"]["code"] == "FLOOR_LOCKED"

    # 3. Starting Final Boss directly must fail with 403 FINAL_BOSS_LOCKED
    if final_boss:
        fail_fb = await async_client.post(
            "/runs",
            json={"dungeon_id": dungeon_id, "floor_id": final_boss["id"], "mode": "floor"},
        )
        assert fail_fb.status_code == 403
        assert fail_fb.json()["detail"]["code"] == "FINAL_BOSS_LOCKED"

    # 4. Start Floor 1 run
    f1_run_resp = await async_client.post(
        "/runs",
        json={"dungeon_id": dungeon_id, "floor_id": f1["id"], "mode": "floor"},
    )
    assert f1_run_resp.status_code == 201, f1_run_resp.text
    f1_run = f1_run_resp.json()
    run_id = f1_run["id"]
    assert f1_run["floor_id"] == f1["id"]
    assert f1_run["mode"] == "floor"
    assert len(f1_run["rooms"]) == len(f1["room_ids"])

    # 5. Test attempt submission: wrong answer returns requeue_after and correct_answer, never leaks on correct
    f1_room_id = f1["room_ids"][0]
    f1_room_data = next(r for r in d_data["rooms"] if r["id"] == f1_room_id)
    q_id = f1_room_data["questions"][0]["id"]
    q_opts = f1_room_data["questions"][0]["options"]

    # Wrong answer
    wrong_att = await async_client.post(
        f"/runs/{run_id}/attempts",
        json={
            "attempt_id": str(uuid.uuid4()),
            "question_id": q_id,
            "selected_answer": "DEFINITELY_WRONG_ANSWER_12345",
            "weapon_name": "Rusty Dagger",
        },
    )
    assert wrong_att.status_code == 200, wrong_att.text
    w_data = wrong_att.json()
    assert w_data["is_correct"] is False
    assert w_data["requeue_after"] == 3
    assert "correct_answer" in w_data
    assert w_data["correct_answer"] in q_opts

    # Defeat floor 1 rooms to allow finish
    db_rooms = (
        await db_session.execute(
            select(DungeonRoom).where(DungeonRoom.id.in_(f1["room_ids"])).order_by(DungeonRoom.room_order)
        )
    ).scalars().all()

    for r in db_rooms:
        q = (await db_session.execute(select(Question).where(Question.topic_id == r.topic_id).limit(1))).scalar_one()
        db_session.add(
            Attempt(
                id=str(uuid.uuid4()),
                user_id=user.id,
                run_id=run_id,
                question_id=q.id,
                is_correct=True,
                damage_dealt=r.monster_hp,
            )
        )
    await db_session.commit()

    # 6. Finish Floor 1
    fin_resp = await async_client.post(f"/runs/{run_id}/finish")
    assert fin_resp.status_code == 200, fin_resp.text
    fin_data = fin_resp.json()
    assert fin_data["floor_rank"] in ["S", "A", "B", "C"]
    assert fin_data["mastery_by_topic"] is not None
    assert len(fin_data["chest_rewards"]) > 0
    assert fin_data["chest_rewards"][0]["kind"] == "xp"

    # 7. Check dungeon status: Floor 1 cleared with rank, Floor 2 now ready!
    d2_resp = await async_client.get(f"/dungeons/{dungeon_id}")
    assert d2_resp.status_code == 200
    d2_data = d2_resp.json()
    f1_after = d2_data["floors"][0]
    f2_after = d2_data["floors"][1]
    assert f1_after["status"] == "cleared"
    assert f1_after["rank"] == fin_data["floor_rank"]
    assert f2_after["status"] == "ready"


@pytest.mark.asyncio
async def test_openrouter_provider_instantiation_and_helpers():
    from app.ai.openrouter_provider import OpenRouterProvider
    provider = OpenRouterProvider(api_key="test-dummy-key")
    assert provider.primary_model == "meta-llama/llama-3.3-70b-instruct:free"
    assert len(provider.fallback_models) >= 2

    # Test clean json helper
    raw_md = '```json\n{"summary": "test", "topics": []}\n```'
    parsed = provider._clean_json(raw_md)
    assert parsed["summary"] == "test"
