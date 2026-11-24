"""A real room clear through the API, for a pack floor and for a generated dungeon's floor."""
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_session_token
from app.demo.seed_packs import seed_content_packs
from app.models.all_models import Document, DocumentChunk, DungeonRoom, Question, User


async def _win_room(client: AsyncClient, db: AsyncSession, run_id: str, room_id: str) -> None:
    room = (await db.execute(select(DungeonRoom).where(DungeonRoom.id == room_id))).scalar_one()
    qs = (await db.execute(select(Question).where(Question.topic_id == room.topic_id))).scalars().all()
    hp = room.monster_hp
    i = 0
    while hp > 0:
        q = qs[i % len(qs)]
        i += 1
        res = await client.post(f"/runs/{run_id}/attempts", json={
            "attempt_id": str(uuid.uuid4()), "question_id": q.id, "selected_answer": q.options[q.correct_option]})
        assert res.status_code == 200, res.text
        hp = res.json()["monster_hp_remaining"]
        assert i < 40


async def _login(client: AsyncClient, db: AsyncSession, name: str) -> User:
    user = User(username=name, is_guest=False, password_hash="hash")
    db.add(user)
    await db.commit()
    await db.refresh(user)
    client.cookies.clear()
    client.cookies.set(settings.SESSION_COOKIE_NAME, create_session_token(user.id, session_version=user.session_version))
    return user


@pytest.mark.asyncio
async def test_clearing_every_room_of_a_pack_floor_then_finishing(async_client: AsyncClient, db_session: AsyncSession):
    packs = sorted(await seed_content_packs(db_session), key=lambda p: p.order)
    dungeon_id = packs[0].dungeon_id
    await _login(async_client, db_session, "room_clear_hero")
    floor = (await async_client.get(f"/dungeons/{dungeon_id}")).json()["floors"][0]
    run = (await async_client.post("/runs", json={"dungeon_id": dungeon_id, "floor_id": floor["id"], "mode": "floor"})).json()
    for idx, room_id in enumerate(floor["room_ids"]):
        await _win_room(async_client, db_session, run["id"], room_id)
        clear = await async_client.post(f"/runs/{run['id']}/rooms/{room_id}/clear")
        assert clear.status_code == 200, clear.text  # was 500: DungeonRoom has no is_boss
        last = idx == len(floor["room_ids"]) - 1
        assert clear.json()["is_boss"] is last
        assert clear.json()["xp_delta"] == (100 if last else 25)
        assert clear.json()["points_reason"] == ("boss_clear" if last else "room_clear")
    fin = await async_client.post(f"/runs/{run['id']}/finish")
    assert fin.status_code == 200, fin.text
    detail = (await async_client.get(f"/dungeons/{dungeon_id}")).json()
    assert [f["status"] for f in detail["floors"][:2]] == ["cleared", "ready"]


@pytest.mark.asyncio
async def test_clearing_a_room_of_a_generated_dungeon_floor(async_client: AsyncClient, db_session: AsyncSession):
    user = await _login(async_client, db_session, "own_notes_hero")
    doc = Document(user_id=user.id, title="Web", original_filename="web.pptx", file_type="pptx", status="accepted")
    db_session.add(doc)
    await db_session.commit()
    text = ("HTML structures a page. CSS styles it. JavaScript makes it interactive. HTTP carries requests and "
            "responses between the browser and the server. ") * 8
    for i in range(3):
        db_session.add(DocumentChunk(document_id=doc.id, user_id=user.id, chunk_index=i, text=text, page_number=i + 1))
    await db_session.commit()
    gen = await async_client.post(f"/documents/{doc.id}/generate-dungeon")
    assert gen.status_code == 201, gen.text
    body = gen.json()
    # One topic makes a single boss room without floors; the client then plays it as the legacy floor.
    floor_id = body["floors"][0]["id"] if body.get("floors") else "floor-legacy"
    run = (await async_client.post("/runs", json={"dungeon_id": body["id"], "floor_id": floor_id, "mode": "floor"})).json()
    assert run["room_ids"], run
    first = run["room_ids"][0]
    await _win_room(async_client, db_session, run["id"], first)
    clear = await async_client.post(f"/runs/{run['id']}/rooms/{first}/clear")
    assert clear.status_code == 200, clear.text
    assert clear.json()["points_reason"] in ("room_clear", "boss_clear")
