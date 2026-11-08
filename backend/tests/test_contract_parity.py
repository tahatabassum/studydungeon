import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import async_session_maker
from app.demo.seed import seed_demo_dungeon
from app.main import app


@pytest.mark.asyncio
async def test_full_contract_parity_demo_journey():
    """
    Automated Pytest wrapper for frontend contract parity verification:
    Ensures guest session, dungeon view, run start, and combat attempts
    match expected JSON keys with zero answer leakage.
    """
    async with async_session_maker() as session:
        demo = await seed_demo_dungeon(session)
        demo_id = demo.id

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Guest Session
        res = await client.post("/demo/session")
        assert res.status_code == 201
        guest_data = res.json()
        assert "user" in guest_data and "dungeon_id" in guest_data and "expires_at" in guest_data
        assert "id" in guest_data["user"] and "username" in guest_data["user"]

        # 2. Dungeon View (Zero Leakage)
        res = await client.get(f"/dungeons/{demo_id}")
        assert res.status_code == 200
        dungeon_data = res.json()
        assert {"id", "title", "is_public_demo", "rooms"}.issubset(set(dungeon_data.keys()))
        for room in dungeon_data["rooms"]:
            assert "monster_name" in room and "monster_hp" in room and "questions" in room
            for q in room["questions"]:
                assert "correct_option" not in q
                assert "evidence_quote" not in q
                assert "explanation" not in q

        # 3. Start Run
        res = await client.post("/runs", json={"dungeon_id": demo_id})
        assert res.status_code == 201
        run_data = res.json()
        run_id = run_data["id"]

        # 4. Attempt
        first_room = dungeon_data["rooms"][0]
        q_id = first_room["questions"][0]["id"]
        res = await client.post(
            f"/runs/{run_id}/attempts",
            json={
                "attempt_id": "contract-test-attempt-001",
                "question_id": q_id,
                "selected_answer": "Arbitrary Test Answer",
                "weapon_name": "Rusty Dagger",
            },
        )
        assert res.status_code == 200
        attempt_data = res.json()
        expected_attempt_keys = {
            "attempt_id", "is_correct", "damage_dealt", "damage_taken",
            "is_critical", "current_hp", "current_score", "current_streak",
            "monster_hp_remaining", "explanation", "evidence_quote"
        }
        assert expected_attempt_keys.issubset(set(attempt_data.keys()))
