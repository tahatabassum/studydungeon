"""
Contract Check Script:
Executes the full demo user journey through the real FastAPI client and
verifies that all responses match the exact field keys expected by Person B
without answer leakage or missing attributes.
"""
import asyncio
import os
import sys

from httpx import ASGITransport, AsyncClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import async_session_maker
from app.demo.seed import seed_demo_dungeon
from app.main import app


async def main():
    print("=== STUDYDUNGEON: CONTRACT PARITY CHECK (Person B Frontend Schema) ===")

    # Ensure demo dungeon exists
    async with async_session_maker() as session:
        demo = await seed_demo_dungeon(session)
        demo_id = demo.id

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Check Guest Session
        res = await client.post("/demo/session")
        assert res.status_code == 201, f"Demo session failed: {res.text}"
        guest_data = res.json()
        assert "user" in guest_data and "dungeon_id" in guest_data and "expires_at" in guest_data
        assert "id" in guest_data["user"] and "username" in guest_data["user"] and "is_guest" in guest_data["user"]
        print("[PASS] 1. POST /demo/session matched schema")

        # 2. Check Dungeon Detail (No Answer Leakage)
        res = await client.get(f"/dungeons/{demo_id}")
        assert res.status_code == 200, f"Get dungeon failed: {res.text}"
        dungeon_data = res.json()
        expected_dungeon_keys = {"id", "title", "is_public_demo", "rooms"}
        assert expected_dungeon_keys.issubset(set(dungeon_data.keys()))
        for room in dungeon_data["rooms"]:
            assert "monster_name" in room and "monster_hp" in room and "questions" in room
            for q in room["questions"]:
                assert "correct_option" not in q, "SECURITY LEAK: correct_option exposed in GET /dungeons/{id}!"
                assert "evidence_quote" not in q, "SECURITY LEAK: evidence_quote exposed in GET /dungeons/{id}!"
                assert "explanation" not in q, "SECURITY LEAK: explanation exposed in GET /dungeons/{id}!"
        print("[PASS] 2. GET /dungeons/{id} matched schema with 0 answer leakage")

        # 3. Check Start Run
        res = await client.post("/runs", json={"dungeon_id": demo_id})
        assert res.status_code == 201, f"Start run failed: {res.text}"
        run_data = res.json()
        run_id = run_data["id"]
        assert "current_hp" in run_data and "current_streak" in run_data and "rooms" in run_data
        print("[PASS] 3. POST /runs matched schema")

        # 4. Check Attempt
        first_room = dungeon_data["rooms"][0]
        q_id = first_room["questions"][0]["id"]
        res = await client.post(
            f"/runs/{run_id}/attempts",
            json={
                "attempt_id": "contract-check-attempt-001",
                "question_id": q_id,
                "selected_answer": "Arbitrary Test Answer",
                "weapon_name": "Rusty Dagger",
            },
        )
        assert res.status_code == 200, f"Attempt failed: {res.text}"
        attempt_data = res.json()
        expected_attempt_keys = {
            "attempt_id", "is_correct", "damage_dealt", "damage_taken",
            "is_critical", "current_hp", "current_score", "current_streak",
            "monster_hp_remaining", "explanation", "evidence_quote"
        }
        assert expected_attempt_keys.issubset(set(attempt_data.keys()))
        print("[PASS] 4. POST /runs/{id}/attempts matched schema")

        # 5. Check Error Format
        res = await client.get("/dungeons/nonexistent-uuid")
        assert res.status_code == 404
        err_data = res.json()
        assert "detail" in err_data and "code" in err_data["detail"] and "message" in err_data["detail"]
        print("[PASS] 5. Error body matched standardized {'detail': {'code', 'message'}} schema")

    print("=== ALL CONTRACT CHECKS PASSED WITH 100% PARITY! ===")
    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
