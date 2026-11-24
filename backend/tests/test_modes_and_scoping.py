"""Campaign, practice and review modes end to end, plus the scoping fixes (pack 1 seed, real HTTP calls)."""
import uuid
from datetime import datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_session_token
from app.demo.seed_packs import seed_content_packs
from app.models.all_models import Attempt, Document, Dungeon, DungeonRoom, GameRun, Question, ReviewItem, Topic, User


async def _player(db: AsyncSession, client: AsyncClient, name: str) -> User:
    user = User(username=name, is_guest=False, password_hash="hash")
    db.add(user)
    await db.commit()
    await db.refresh(user)
    client.cookies.clear()
    client.cookies.set(settings.SESSION_COOKIE_NAME, create_session_token(user.id, session_version=user.session_version))
    return user


async def _pack1(db: AsyncSession):
    packs = sorted(await seed_content_packs(db), key=lambda p: p.order)
    return packs


async def _completed_floor_run(db: AsyncSession, user: User, dungeon_id: str, floor_id: str) -> None:
    db.add(GameRun(user_id=user.id, dungeon_id=dungeon_id, floor_id=floor_id, mode="floor", status="completed",
                   finished_at=datetime.utcnow()))
    await db.commit()


async def _kill_rooms_directly(db: AsyncSession, user: User, run_id: str, rooms) -> None:
    """Records winning attempts for each room so the run can clear and finish (no HTTP, no randomness)."""
    for room in rooms:
        q = (await db.execute(select(Question).where(Question.topic_id == room.topic_id).limit(1))).scalar_one()
        db.add(Attempt(id=str(uuid.uuid4()), user_id=user.id, run_id=run_id, question_id=q.id, is_correct=True,
                       damage_dealt=room.monster_hp))
    await db.commit()


async def _correct_text(db: AsyncSession, topic_id: str) -> tuple[str, str]:
    q = (await db.execute(select(Question).where(Question.topic_id == topic_id).limit(1))).scalar_one()
    return q.id, q.options[q.correct_option]


@pytest.mark.asyncio
async def test_floor_two_can_be_played_once_floor_one_is_cleared(async_client: AsyncClient, db_session: AsyncSession):
    packs = await _pack1(db_session)
    dungeon_id = packs[0].dungeon_id
    user = await _player(db_session, async_client, "floor_two_hero")
    detail = (await async_client.get(f"/dungeons/{dungeon_id}")).json()
    f1, f2 = detail["floors"][0], detail["floors"][1]
    await _completed_floor_run(db_session, user, dungeon_id, f1["id"])

    detail = (await async_client.get(f"/dungeons/{dungeon_id}")).json()
    assert [f["status"] for f in detail["floors"][:2]] == ["cleared", "ready"]

    run = await async_client.post("/runs", json={"dungeon_id": dungeon_id, "floor_id": f2["id"], "mode": "floor"})
    assert run.status_code == 201, run.text
    body = run.json()
    assert body["room_ids"] == f2["room_ids"]
    assert body["mode"] == "floor"
    first_room = (await db_session.execute(select(DungeonRoom).where(DungeonRoom.id == f2["room_ids"][0]))).scalar_one()
    qid, answer = await _correct_text(db_session, first_room.topic_id)
    # Used to be 409 OUT_OF_ORDER_ROOM: the order check counted Floor 1's rooms, which this run never plays.
    res = await async_client.post(f"/runs/{body['id']}/attempts",
                                  json={"attempt_id": str(uuid.uuid4()), "question_id": qid, "selected_answer": answer})
    assert res.status_code == 200, res.text
    assert res.json()["is_correct"] is True


@pytest.mark.asyncio
async def test_a_floor_clear_does_not_complete_the_pack_but_the_final_boss_does(async_client: AsyncClient, db_session: AsyncSession):
    packs = await _pack1(db_session)
    dungeon_id = packs[0].dungeon_id
    user = await _player(db_session, async_client, "pack_rule_hero")
    detail = (await async_client.get(f"/dungeons/{dungeon_id}")).json()
    floors, final = detail["floors"], detail["final_boss"]

    # Floor 1 through the API: finishing it gives a rank and a chest, and no pack progress.
    run = (await async_client.post("/runs", json={"dungeon_id": dungeon_id, "floor_id": floors[0]["id"], "mode": "floor"})).json()
    rooms = (await db_session.execute(select(DungeonRoom).where(DungeonRoom.id.in_(floors[0]["room_ids"])))).scalars().all()
    await _kill_rooms_directly(db_session, user, run["id"], rooms)
    fin = await async_client.post(f"/runs/{run['id']}/finish")
    assert fin.status_code == 200, fin.text
    assert fin.json().get("pack_progress") is None
    assert fin.json()["floor_rank"] in ("S", "A", "B", "C")
    assert fin.json()["chest_rewards"][0]["amount"] == 40
    assert fin.json()["xp_earned"] >= 40  # the chest XP is real XP now
    packs_body = (await async_client.get("/packs")).json()
    assert packs_body["packs"][0]["status"] == "in_progress"
    assert packs_body["packs"][0]["floors_cleared"] == 1
    assert packs_body["packs"][1]["status"] == "locked"
    locked = await async_client.post("/runs", json={"dungeon_id": packs[1].dungeon_id})
    assert locked.status_code == 403 and locked.json()["detail"]["code"] == "PACK_LOCKED"

    # Remaining floors, then the Final_Boss: that finish completes the pack and unlocks pack 2.
    for f in floors[1:]:
        await _completed_floor_run(db_session, user, dungeon_id, f["id"])
    assert (await async_client.get(f"/dungeons/{dungeon_id}")).json()["final_boss"]["unlocked"] is True
    boss_run = (await async_client.post("/runs", json={"dungeon_id": dungeon_id, "floor_id": final["id"], "mode": "floor"})).json()
    assert boss_run["room_ids"] == [final["id"]]
    boss_room = (await db_session.execute(select(DungeonRoom).where(DungeonRoom.id == final["id"]))).scalar_one()
    await _kill_rooms_directly(db_session, user, boss_run["id"], [boss_room])
    done = (await async_client.post(f"/runs/{boss_run['id']}/finish")).json()
    assert done["pack_progress"]["unlocked_pack_id"] == packs[1].id
    packs_body = (await async_client.get("/packs")).json()
    assert packs_body["packs"][0]["status"] == "completed"
    assert packs_body["packs"][1]["status"] == "available"


@pytest.mark.asyncio
async def test_an_attempt_on_another_players_private_question_is_404_and_leaks_nothing(async_client: AsyncClient, db_session: AsyncSession):
    packs = await _pack1(db_session)
    owner = User(username="private_owner", is_guest=False, password_hash="hash")
    db_session.add(owner)
    await db_session.commit()
    doc = Document(user_id=owner.id, title="Secret", original_filename="s.txt", file_type="txt", status="accepted")
    db_session.add(doc)
    await db_session.commit()
    topic = Topic(document_id=doc.id, user_id=owner.id, name="Secret topic", order_index=0)
    db_session.add(topic)
    await db_session.commit()
    secret = Question(topic_id=topic.id, question_type="mcq", difficulty="easy", prompt="Secret?", options=["yes", "no"],
                      correct_option=0, evidence_quote="The secret quote", explanation="The secret explanation")
    db_session.add(secret)
    await db_session.commit()

    await _player(db_session, async_client, "snooper")
    run = (await async_client.post("/runs", json={"dungeon_id": packs[0].dungeon_id})).json()
    res = await async_client.post(f"/runs/{run['id']}/attempts",
                                  json={"attempt_id": str(uuid.uuid4()), "question_id": secret.id, "selected_answer": "no"})
    assert res.status_code == 404
    assert "secret" not in res.text.lower()


@pytest.mark.asyncio
async def test_a_reused_attempt_id_never_returns_another_players_result(async_client: AsyncClient, db_session: AsyncSession):
    packs = await _pack1(db_session)
    dungeon_id = packs[0].dungeon_id
    shared_attempt = str(uuid.uuid4())
    room = (await db_session.execute(select(DungeonRoom).where(DungeonRoom.dungeon_id == dungeon_id, DungeonRoom.room_order == 0))).scalar_one()
    qid, answer = await _correct_text(db_session, room.topic_id)

    await _player(db_session, async_client, "first_answerer")
    run_a = (await async_client.post("/runs", json={"dungeon_id": dungeon_id})).json()
    a = await async_client.post(f"/runs/{run_a['id']}/attempts", json={"attempt_id": shared_attempt, "question_id": qid, "selected_answer": answer})
    assert a.status_code == 200 and a.json()["is_correct"] is True

    await _player(db_session, async_client, "second_answerer")
    run_b = (await async_client.post("/runs", json={"dungeon_id": dungeon_id})).json()
    b = await async_client.post(f"/runs/{run_b['id']}/attempts", json={"attempt_id": shared_attempt, "question_id": qid, "selected_answer": "definitely wrong"})
    # Never the first player's cached result: a clean 409, not a replay and not a 500.
    assert b.status_code == 409, b.text
    assert b.json()["detail"]["code"] == "ATTEMPT_ID_CONFLICT"


@pytest.mark.asyncio
async def test_daily_haunt_needs_due_memories_then_reviews_them_and_counts_the_streak(async_client: AsyncClient, db_session: AsyncSession):
    packs = await _pack1(db_session)
    dungeon_id = packs[0].dungeon_id
    user = await _player(db_session, async_client, "haunted_hero")

    nothing = await async_client.post("/runs", json={"dungeon_id": dungeon_id, "mode": "daily_haunt"})
    assert nothing.status_code == 409 and nothing.json()["detail"]["code"] == "NOTHING_DUE"

    room = (await db_session.execute(select(DungeonRoom).where(DungeonRoom.dungeon_id == dungeon_id, DungeonRoom.room_order == 2))).scalar_one()
    qid, answer = await _correct_text(db_session, room.topic_id)
    db_session.add(ReviewItem(user_id=user.id, question_id=qid, due_at=datetime.utcnow() - timedelta(minutes=5), repetition=0, interval_days=0))
    await db_session.commit()

    run = await async_client.post("/runs", json={"dungeon_id": dungeon_id, "mode": "daily_haunt"})
    assert run.status_code == 201, run.text
    assert run.json()["mode"] == "daily_haunt"
    assert run.json()["room_ids"] == []
    # A room question from room 3 is fine here: a review run has no room order.
    res = await async_client.post(f"/runs/{run.json()['id']}/attempts", json={"attempt_id": str(uuid.uuid4()), "question_id": qid, "selected_answer": answer})
    assert res.status_code == 200, res.text
    review = (await db_session.execute(select(ReviewItem).where(ReviewItem.user_id == user.id, ReviewItem.question_id == qid))).scalar_one()
    await db_session.refresh(review)
    assert review.due_at > datetime.utcnow()

    fin = await async_client.post(f"/runs/{run.json()['id']}/finish")
    assert fin.status_code == 200, fin.text
    assert fin.json().get("pack_progress") is None
    progress = (await async_client.get("/progress")).json()
    assert progress["daily_streak"] == 1
    assert progress["due_review_count"] == 0
    # A review run never clears floors.
    assert (await async_client.get(f"/dungeons/{dungeon_id}")).json()["floors"][0]["status"] == "ready"


@pytest.mark.asyncio
async def test_weak_topics_picks_the_two_worst_topics_and_exam_takes_every_topic(async_client: AsyncClient, db_session: AsyncSession):
    packs = await _pack1(db_session)
    dungeon_id = packs[0].dungeon_id
    await _player(db_session, async_client, "practice_hero")
    weak = await async_client.post("/runs", json={"dungeon_id": dungeon_id, "mode": "weak_topics"})
    assert weak.status_code == 201, weak.text
    assert len(weak.json()["room_ids"]) == 2
    assert [r["room_id"] for r in weak.json()["rooms"]] == weak.json()["room_ids"]
    assert weak.json()["rooms"][-1]["is_boss"] is True

    exam = (await async_client.post("/runs", json={"dungeon_id": dungeon_id, "mode": "exam"})).json()
    all_rooms = (await db_session.execute(select(DungeonRoom).where(DungeonRoom.dungeon_id == dungeon_id))).scalars().all()
    assert len(exam["room_ids"]) == len(all_rooms)

    bad = await async_client.post("/runs", json={"dungeon_id": dungeon_id, "mode": "speedrun"})
    assert bad.status_code == 422 and bad.json()["detail"]["code"] == "INVALID_MODE"


@pytest.mark.asyncio
async def test_progress_reports_xp_to_next_level(async_client: AsyncClient, db_session: AsyncSession):
    await _player(db_session, async_client, "fresh_progress")
    body = (await async_client.get("/progress")).json()
    assert body["level"] == 1 and body["total_xp"] == 0 and body["xp_to_next"] == 100
    assert body["daily_streak"] == 0


@pytest.mark.asyncio
async def test_generated_dungeons_get_floors_of_two_rooms_and_a_final_boss(async_client: AsyncClient, db_session: AsyncSession):
    from app.api.dungeons import _floor_plan

    assert _floor_plan("abcdefgh-1234", 1) == [None]
    assert _floor_plan("abcdefgh-1234", 2) == ["abcdefgh-f1", None]
    assert _floor_plan("abcdefgh-1234", 5) == ["abcdefgh-f1", "abcdefgh-f1", "abcdefgh-f2", "abcdefgh-f2", None]
    assert _floor_plan("abcdefgh-1234", 6) == ["abcdefgh-f1", "abcdefgh-f1", "abcdefgh-f2", "abcdefgh-f2", "abcdefgh-f3", None]


@pytest.mark.asyncio
async def test_a_legacy_floor_id_on_a_dungeon_without_floors_plays_every_room(async_client: AsyncClient, db_session: AsyncSession):
    user = await _player(db_session, async_client, "legacy_floor_hero")
    dungeon = Dungeon(user_id=user.id, title="Old notes", is_public_demo=False)
    db_session.add(dungeon)
    await db_session.commit()
    doc = Document(user_id=user.id, title="Old", original_filename="o.txt", file_type="txt", status="accepted")
    db_session.add(doc)
    await db_session.commit()
    for i in range(3):
        t = Topic(document_id=doc.id, user_id=user.id, name=f"T{i}", order_index=i)
        db_session.add(t)
        await db_session.flush()
        db_session.add(DungeonRoom(dungeon_id=dungeon.id, topic_id=t.id, room_order=i, monster_type=f"M{i}", monster_hp=40))
    await db_session.commit()
    run = await async_client.post("/runs", json={"dungeon_id": dungeon.id, "floor_id": "floor-legacy", "mode": "floor"})
    assert run.status_code == 201, run.text
    assert len(run.json()["room_ids"]) == 3
