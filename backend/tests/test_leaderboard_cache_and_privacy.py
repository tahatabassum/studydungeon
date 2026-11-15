import json

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import leaderboard as leaderboard_module
from app.core.config import settings
from app.core.security import create_session_token
from app.models.all_models import PlayerStats, User


async def _ranked_player(db: AsyncSession, username: str, public_id: str, points: int, display_name=None, tag=None) -> User:
    user = User(username=username, is_guest=False, password_hash="hash", public_id=public_id, display_name=display_name, tag=tag)
    db.add(user)
    await db.flush()
    db.add(PlayerStats(user_id=user.id, public_id=public_id, points_overall=points, points_preloaded=points, rooms_cleared=1))
    await db.commit()
    await db.refresh(user)
    return user


@pytest.fixture(autouse=True)
def _clear_board_cache():
    leaderboard_module._LEADERBOARD_SNAPSHOT_CACHE.clear()
    yield
    leaderboard_module._LEADERBOARD_SNAPSHOT_CACHE.clear()


@pytest.mark.asyncio
async def test_second_request_is_served_from_the_snapshot(async_client: AsyncClient, db_session: AsyncSession):
    await _ranked_player(db_session, "alice_login", "p_alice01", 300, "Raven", "4821")
    first = await async_client.get("/leaderboard?board=overall&period=all")
    assert first.status_code == 200, first.text
    # The cached path used to unpack 3 of the 4 stored values and answer 500.
    second = await async_client.get("/leaderboard?board=overall&period=all")
    assert second.status_code == 200, second.text
    assert second.json()["updated_at"] == first.json()["updated_at"]
    assert [e["public_id"] for e in second.json()["entries"]] == ["p_alice01"]


@pytest.mark.asyncio
async def test_board_never_exposes_login_names(async_client: AsyncClient, db_session: AsyncSession):
    # A player with no display name and tag (an older account) must not show their login name.
    await _ranked_player(db_session, "secret_login_top", "p_top0001", 500)
    me = await _ranked_player(db_session, "secret_login_me", "p_me00001", 100)
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, create_session_token(me.id, session_version=me.session_version))
    res = await async_client.get("/leaderboard?board=overall&period=all")
    assert res.status_code == 200, res.text
    body = json.dumps(res.json())
    assert "secret_login" not in body
    data = res.json()
    assert data["entries"][0]["handle"] == "p_top0001"
    assert data["me"]["handle"] == "p_me00001"
    assert data["me"]["next_above"]["handle"] == "p_top0001"
