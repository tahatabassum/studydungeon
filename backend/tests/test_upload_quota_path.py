import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_session_token
from app.models.all_models import User


@pytest.mark.asyncio
async def test_upload_quota_is_served_at_the_contract_path(async_client: AsyncClient, db_session: AsyncSession):
    guest = User(username="quota_guest", is_guest=True, password_hash=None)
    db_session.add(guest)
    await db_session.commit()
    await db_session.refresh(guest)
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, create_session_token(guest.id, session_version=guest.session_version, is_guest=True))

    res = await async_client.get("/uploads/quota")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["player"]["is_guest"] is True
    assert body["player"]["limit_today"] == 1
    assert body["can_upload"] is True and body.get("reason") is None
    assert body["global"] == {"available": True}
    assert "global_" not in body
    # The old, wrong path under the documents prefix is gone.
    assert (await async_client.get("/documents/uploads/quota")).status_code in (404, 405)


@pytest.mark.asyncio
async def test_upload_quota_needs_a_session(async_client: AsyncClient):
    assert (await async_client.get("/uploads/quota")).status_code == 401

@pytest.mark.asyncio
async def test_ip_daily_limit_and_global_cap(async_client: AsyncClient, db_session: AsyncSession, monkeypatch):
    import io

    notes = b"Cells are the basic unit of life. Mitochondria produce ATP through respiration. " * 20

    async def as_new_player(name: str) -> None:
        u = User(username=name, is_guest=False, password_hash="hash")
        db_session.add(u)
        await db_session.commit()
        await db_session.refresh(u)
        async_client.cookies.clear()
        async_client.cookies.set(settings.SESSION_COOKIE_NAME, create_session_token(u.id, session_version=u.session_version))

    async def upload():
        return await async_client.post(
            "/documents", files={"file": ("n.txt", io.BytesIO(notes), "text/plain")}, data={"accept_ai_notice": "true"}
        )

    monkeypatch.setattr(settings, "UPLOAD_IP_DAILY_LIMIT", 1)
    await as_new_player("ip_player_one")
    assert (await upload()).status_code == 202
    # A different account on the same network: the IP limit applies across accounts.
    await as_new_player("ip_player_two")
    quota = (await async_client.get("/uploads/quota")).json()
    assert quota["can_upload"] is False and quota["reason"] == "ip_daily_limit"
    res = await upload()
    assert res.status_code == 429
    assert res.json()["detail"]["code"] == "UPLOAD_LIMIT_IP"
    assert int(res.headers["Retry-After"]) > 0

    monkeypatch.setattr(settings, "UPLOAD_IP_DAILY_LIMIT", 100)
    monkeypatch.setattr(settings, "UPLOAD_GLOBAL_DAILY_LIMIT", 1)
    await as_new_player("global_player")
    quota = (await async_client.get("/uploads/quota")).json()
    assert quota["global"] == {"available": False} and quota["reason"] == "global_daily_limit"
    res = await upload()
    assert res.status_code == 503
    assert res.json()["detail"]["code"] == "UPLOADS_PAUSED_TODAY"
    assert res.json()["detail"]["offer_packs"] is True

@pytest.mark.asyncio
async def test_my_notes_lists_and_deletes_own_documents_with_their_dungeon(async_client: AsyncClient, db_session: AsyncSession):
    from app.models.all_models import Document, Dungeon

    guest = User(username="notes_guest", is_guest=True, password_hash=None)
    other = User(username="notes_other", is_guest=False, password_hash="hash")
    db_session.add_all([guest, other])
    await db_session.commit()
    mine = Document(user_id=guest.id, title="Biology", original_filename="bio.txt", file_type="txt", status="accepted")
    theirs = Document(user_id=other.id, title="Private", original_filename="p.txt", file_type="txt", status="accepted")
    db_session.add_all([mine, theirs])
    await db_session.commit()
    dungeon = Dungeon(user_id=guest.id, document_id=mine.id, title="Biology", is_public_demo=False)
    db_session.add(dungeon)
    await db_session.commit()
    dungeon_id, mine_id, theirs_id = dungeon.id, mine.id, theirs.id
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, create_session_token(guest.id, session_version=guest.session_version, is_guest=True))

    listed = (await async_client.get("/documents")).json()
    assert [d["id"] for d in listed] == [mine_id]
    assert listed[0]["dungeon_id"] == dungeon_id

    assert (await async_client.delete(f"/documents/{theirs_id}")).status_code == 404
    assert (await async_client.delete(f"/documents/{mine_id}")).status_code == 200
    assert (await async_client.get("/documents")).json() == []
    assert (await async_client.get(f"/dungeons/{dungeon_id}")).status_code == 404
    quota = (await async_client.get("/uploads/quota")).json()
    assert quota["player"]["stored"] == 0
