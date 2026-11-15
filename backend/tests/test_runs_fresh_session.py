import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_session_token
from app.demo.seed import seed_demo_dungeon
from app.main import app
from app.models.all_models import Base, User


@pytest.mark.asyncio
async def test_second_answer_and_resume_work_with_a_fresh_session_per_request(tmp_path):
    """The real server opens a new session per request, so nothing is cached: a lazy load of
    attempt.question used to crash the second answer and GET /runs/{id} with MissingGreenlet."""
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'fresh.db'}")
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with maker() as s:
        demo = await seed_demo_dungeon(s)
        user = User(username="fresh_session_tester", is_guest=False, password_hash="hash")
        s.add(user)
        await s.commit()
        demo_id, user_id, version = demo.id, user.id, user.session_version

    async def fresh_db():
        async with maker() as s:
            yield s

    app.dependency_overrides[get_db] = fresh_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            c.cookies.set(settings.SESSION_COOKIE_NAME, create_session_token(user_id, session_version=version))
            room = (await c.get(f"/dungeons/{demo_id}")).json()["rooms"][0]
            run_id = (await c.post("/runs", json={"dungeon_id": demo_id})).json()["id"]
            for q in room["questions"][:2]:
                r = await c.post(f"/runs/{run_id}/attempts", json={
                    "attempt_id": str(uuid.uuid4()), "question_id": q["id"],
                    "selected_answer": q["options"][0], "weapon_name": "Rusty Dagger",
                })
                assert r.status_code == 200, r.text
            assert (await c.get(f"/runs/{run_id}")).status_code == 200
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()
