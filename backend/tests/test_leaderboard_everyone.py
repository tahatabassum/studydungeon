"""Everyone who played is on the board (0 points included), every guest has a name, and players are never purged."""
from datetime import datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import leaderboard as leaderboard_module
from app.core.config import settings
from app.core.security import create_session_token
from app.models.all_models import PlayerStats, User


@pytest.fixture(autouse=True)
def _fresh_board():
    leaderboard_module._LEADERBOARD_SNAPSHOT_CACHE.clear()
    yield
    leaderboard_module._LEADERBOARD_SNAPSHOT_CACHE.clear()


async def _user(db: AsyncSession, name: str, public_id: str, points=None, guest=False, display=None, tag=None) -> User:
    u = User(username=name, is_guest=guest, password_hash=None if guest else "hash", public_id=public_id, display_name=display, tag=tag)
    db.add(u)
    await db.flush()
    if points is not None:  # a points record means the player answered at least one question
        db.add(PlayerStats(user_id=u.id, public_id=public_id, points_overall=points, points_preloaded=points))
    await db.commit()
    await db.refresh(u)
    return u


@pytest.mark.asyncio
async def test_everyone_who_played_is_ranked_even_with_zero_points(async_client: AsyncClient, db_session: AsyncSession):
    await _user(db_session, "top_login", "p_top00001", 300, display="Raven", tag="4821")
    zero = await _user(db_session, "zero_login", "p_zero0001", 0, guest=True, display="Pale Moth", tag="1234")
    await _user(db_session, "idle_login", "p_idle0001", None, display="Idle", tag="0001")  # never played

    body = (await async_client.get("/leaderboard?board=overall&period=all")).json()
    assert [(e["rank"], e["handle"], e["points"]) for e in body["entries"]] == [(1, "Raven#4821", 300), (2, "Pale Moth#1234", 0)]
    assert body["total_ranked_players"] == 2

    async_client.cookies.set(settings.SESSION_COOKIE_NAME, create_session_token(zero.id, session_version=zero.session_version, is_guest=True))
    me = (await async_client.get("/leaderboard?board=overall&period=all")).json()["me"]
    assert me["rank"] == 2 and me["points"] == 0
    assert me["next_above"]["handle"] == "Raven#4821" and me["next_above"]["points_needed"] == 301


@pytest.mark.asyncio
async def test_a_player_who_never_played_has_no_rank_yet(async_client: AsyncClient, db_session: AsyncSession):
    idle = await _user(db_session, "never_played", "p_never001", None, display="Idle", tag="0002")
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, create_session_token(idle.id, session_version=idle.session_version))
    me = (await async_client.get("/leaderboard?board=overall&period=all")).json()["me"]
    assert me["rank"] is None and me["reason"] == "no_points_yet"


@pytest.mark.asyncio
async def test_demo_guests_get_a_name_and_tag(async_client: AsyncClient, db_session: AsyncSession):
    res = await async_client.post("/demo/session")
    assert res.status_code == 201, res.text
    user = res.json()["user"]
    assert user["display_name"] and user["tag"] and user["public_id"]
    assert user["handle"] == f"{user['display_name']}#{user['tag']}"


@pytest.mark.asyncio
async def test_unnamed_older_accounts_get_a_readable_handle(async_client: AsyncClient, db_session: AsyncSession):
    await _user(db_session, "old_guest_login", "p_abcd1234", 50, guest=True)
    entry = (await async_client.get("/leaderboard?board=overall&period=all")).json()["entries"][0]
    assert entry["handle"] == "Guest#1234"
    assert "old_guest_login" not in str(entry)


@pytest.mark.asyncio
async def test_expired_guests_who_played_are_kept_but_never_played_ones_are_purged(async_client: AsyncClient, db_session: AsyncSession):
    past = datetime.utcnow() - timedelta(days=1)
    player = await _user(db_session, "expired_player", "p_exp00001", 120, guest=True, display="Old Bat", tag="7777")
    idle = await _user(db_session, "expired_idle", "p_exp00002", None, guest=True)
    for u in (player, idle):
        u.expires_at = past
    await db_session.commit()
    player_id, idle_id = player.id, idle.id

    assert (await async_client.post("/demo/session")).status_code == 201  # runs the lazy purge
    remaining = set((await db_session.execute(select(User.id).where(User.id.in_([player_id, idle_id])))).scalars().all())
    assert remaining == {player_id}
