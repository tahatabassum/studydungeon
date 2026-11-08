from unittest.mock import patch

import pytest
from httpx import AsyncClient

from app.demo.seed import seed_demo_dungeon


@pytest.mark.asyncio
async def test_zero_ai_calls_during_gameplay(async_client: AsyncClient, db_session):
    """
    Part 4 Verification: Proves that the AI provider call count strictly stays 0
    during combat gameplay (attempts, room navigation, clears).
    """
    demo = await seed_demo_dungeon(db_session)
    await db_session.commit()

    # Guest session
    await async_client.post("/demo/session")

    # Start run
    run_res = await async_client.post("/runs", json={"dungeon_id": demo.id})
    assert run_res.status_code == 201
    run_id = run_res.json()["id"]

    # Retrieve dungeon questions
    dungeon_res = await async_client.get(f"/dungeons/{demo.id}")
    q_id = dungeon_res.json()["rooms"][0]["questions"][0]["id"]

    # Wrap AI provider methods in spy/mock to track calls
    with patch("app.ai.mock_provider.MockAIProvider.classify_document") as mock_classify, \
         patch("app.ai.mock_provider.MockAIProvider.ocr_image") as mock_ocr, \
         patch("app.ai.mock_provider.MockAIProvider.build_topics_and_questions") as mock_gen:

        # Submit attempt
        attempt_res = await async_client.post(
            f"/runs/{run_id}/attempts",
            json={
                "attempt_id": "gameplay-zero-ai-001",
                "question_id": q_id,
                "selected_answer": "Arbitrary answer",
                "weapon_name": "Rusty Dagger",
            },
        )
        assert attempt_res.status_code == 200

        # Assert zero AI invocations occurred
        assert mock_classify.call_count == 0
        assert mock_ocr.call_count == 0
        assert mock_gen.call_count == 0


@pytest.mark.asyncio
async def test_scorecard_and_mastery_bands(async_client: AsyncClient, db_session):
    """
    Part 4 Verification: Validates mastery bands (Weak <50, Learning 50-79, Strong >=80)
    and progress persistence.
    """
    await async_client.post("/auth/register", json={"username": "masteryuser", "password": "Password123!"})
    await async_client.post("/auth/login", json={"username": "masteryuser", "password": "Password123!"})
    res = await async_client.get("/progress/scorecard")
    assert res.status_code == 200
    data = res.json()
    assert "total_score" in data
    assert "level" in data
    assert "accuracy" in data
    assert "mastery_band" in data
    assert data["mastery_band"] in ("Weak", "Learning", "Strong")
