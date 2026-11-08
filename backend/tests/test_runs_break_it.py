import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_session_token
from app.demo.seed import seed_demo_dungeon
from app.models.all_models import GameRun, User


@pytest.mark.asyncio
async def test_break_run_other_user_isolation(async_client: AsyncClient, db_session: AsyncSession):
    """User B cannot submit attempts or finish User A's run."""
    demo_dungeon = await seed_demo_dungeon(db_session)
    user_a = User(username="runner_alice", is_guest=False, password_hash="hash")
    user_b = User(username="runner_bob", is_guest=False, password_hash="hash")
    db_session.add_all([user_a, user_b])
    await db_session.commit()
    await db_session.refresh(user_a)
    await db_session.refresh(user_b)

    run_a = GameRun(user_id=user_a.id, dungeon_id=demo_dungeon.id, current_hp=100)
    db_session.add(run_a)
    await db_session.commit()
    await db_session.refresh(run_a)

    # Bob logs in
    token_b = create_session_token(user_b.id, session_version=user_b.session_version)
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, token_b)

    # Bob tries to query Alice's run
    get_resp = await async_client.get(f"/runs/{run_a.id}")
    assert get_resp.status_code == 404
    assert get_resp.json()["detail"]["code"] == "RUN_NOT_FOUND"

    # Bob tries to finish Alice's run
    fin_resp = await async_client.post(f"/runs/{run_a.id}/finish")
    assert fin_resp.status_code == 404
    assert fin_resp.json()["detail"]["code"] == "RUN_NOT_FOUND"


@pytest.mark.asyncio
async def test_break_run_finish_after_defeat(async_client: AsyncClient, db_session: AsyncSession):
    """Attempt submission on defeated or completed run is blocked with 409."""
    demo_dungeon = await seed_demo_dungeon(db_session)
    user = User(username="defeated_runner", is_guest=False, password_hash="hash")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    run = GameRun(user_id=user.id, dungeon_id=demo_dungeon.id, current_hp=0, status="defeated")
    db_session.add(run)
    await db_session.commit()
    await db_session.refresh(run)

    token = create_session_token(user.id, session_version=user.session_version)
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    resp = await async_client.post(
        f"/runs/{run.id}/attempts",
        json={
            "attempt_id": "attempt-on-defeated-run",
            "question_id": "dummy-q",
            "selected_answer": "whatever",
        },
    )
    assert resp.status_code == 409
    assert resp.json()["detail"]["code"] == "RUN_FINISHED"

