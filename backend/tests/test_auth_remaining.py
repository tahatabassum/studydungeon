from datetime import datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.all_models import Document, Dungeon, GameRun, User, UserProgress


@pytest.mark.asyncio
async def test_delete_auth_me_cascade(async_client: AsyncClient, db_session):
    """
    DELETE /auth/me must delete the user and cascade delete their progress, documents, dungeons, runs.
    Subsequent /auth/me must return 401.
    """
    # 1. Register & login
    await async_client.post("/auth/register", json={"username": "delete_me_user", "password": "password123"})
    login_res = await async_client.post("/auth/login", json={"username": "delete_me_user", "password": "password123"})
    assert login_res.status_code == 200

    # Verify user exists in DB
    user_res = await db_session.execute(select(User).where(User.username == "delete_me_user"))
    user = user_res.scalar_one_or_none()
    assert user is not None
    user_id = user.id

    # Add a mock document and run to test cascading
    doc = Document(user_id=user_id, title="Test Notes", original_filename="test.txt", file_type="txt", status="accepted")
    db_session.add(doc)
    dungeon = Dungeon(user_id=user_id, title="Test Dungeon")
    db_session.add(dungeon)
    await db_session.flush()

    run = GameRun(user_id=user_id, dungeon_id=dungeon.id)
    db_session.add(run)
    await db_session.commit()

    # 2. Call DELETE /auth/me
    del_res = await async_client.delete("/auth/me")
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # 3. Verify user and cascades are gone
    u_check = await db_session.execute(select(User).where(User.id == user_id))
    assert u_check.scalar_one_or_none() is None

    p_check = await db_session.execute(select(UserProgress).where(UserProgress.user_id == user_id))
    assert p_check.scalar_one_or_none() is None

    d_check = await db_session.execute(select(Document).where(Document.user_id == user_id))
    assert d_check.scalar_one_or_none() is None

    # 4. Old cookie now returns 401
    me_res = await async_client.get("/auth/me")
    assert me_res.status_code == 401


@pytest.mark.asyncio
async def test_db_rate_limiting_with_x_forwarded_for(async_client: AsyncClient):
    """
    Login endpoint must be rate-limited per IP (10/min) using X-Forwarded-For.
    11th request from same IP within the window must return 429 Too Many Requests.
    """
    headers = {"X-Forwarded-For": "203.0.113.195, 10.0.0.1"}

    # Attempt 10 failed logins
    for i in range(10):
        res = await async_client.post(
            "/auth/login",
            json={"username": f"attacker_{i}", "password": "wrongpassword123"},
            headers=headers,
        )
        assert res.status_code == 401

    # 11th request must receive 429
    blocked = await async_client.post(
        "/auth/login",
        json={"username": "attacker_11", "password": "wrongpassword123"},
        headers=headers,
    )
    assert blocked.status_code == 429
    assert blocked.json()["detail"]["code"] == "RATE_LIMIT_EXCEEDED"


@pytest.mark.asyncio
async def test_lazy_purge_of_expired_guests_on_demo_session(async_client: AsyncClient, db_session):
    """
    POST /demo/session must trigger a lazy cleanup that deletes guest users
    whose expires_at < now().
    """
    # Create an expired guest directly in DB
    expired_guest = User(
        username="expired_guest_99",
        password_hash=None,
        is_guest=True,
        expires_at=datetime.utcnow() - timedelta(hours=2),
    )
    db_session.add(expired_guest)
    await db_session.commit()
    expired_id = expired_guest.id

    # Call POST /demo/session
    res = await async_client.post("/demo/session")
    assert res.status_code == 201

    # Verify expired guest was purged
    check = await db_session.execute(select(User).where(User.id == expired_id))
    assert check.scalar_one_or_none() is None

