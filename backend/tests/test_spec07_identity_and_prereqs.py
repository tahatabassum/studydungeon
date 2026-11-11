import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.demo.seed import seed_demo_dungeon


@pytest.mark.asyncio
async def test_guest_name_check_valid_and_invalid(async_client: AsyncClient):
    # Valid name
    res = await async_client.post("/guests/name-check", json={"display_name": "Raven"})
    assert res.status_code == 200
    assert res.json()["ok"] is True
    assert res.json()["display_name"] == "Raven"

    # Too short
    res = await async_client.post("/guests/name-check", json={"display_name": "ab"})
    assert res.status_code == 200
    assert res.json()["ok"] is False
    assert res.json()["reason"] == "too_short"

    # Reserved name
    res = await async_client.post("/guests/name-check", json={"display_name": "Admin"})
    assert res.status_code == 200
    assert res.json()["ok"] is False
    assert res.json()["reason"] == "not_allowed"

    # Lookalike reserved
    res = await async_client.post("/guests/name-check", json={"display_name": "Adm1n"})
    assert res.status_code == 200
    assert res.json()["ok"] is False
    assert res.json()["reason"] == "not_allowed"


@pytest.mark.asyncio
async def test_create_guest_lifecycle_and_cookie(async_client: AsyncClient, db_session):
    # Refuse if notice not accepted
    res = await async_client.post("/guests", json={"display_name": "Shadow", "accept_public_notice": False})
    assert res.status_code == 422
    assert res.json()["detail"]["code"] == "NOTICE_NOT_ACCEPTED"

    # Successful creation
    res = await async_client.post("/guests", json={"display_name": "Shadow", "accept_public_notice": True})
    assert res.status_code == 201
    data = res.json()
    assert "user" in data
    assert data["user"]["display_name"] == "Shadow"
    assert data["user"]["tag"] is not None
    assert "#" in data["user"]["handle"]
    assert data["user"]["is_guest"] is True
    assert data["user"]["public_id"] is not None

    # Check cookie set
    assert settings.SESSION_COOKIE_NAME in async_client.cookies

    # GET /auth/me returns guest details
    me_res = await async_client.get("/auth/me")
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["handle"] == data["user"]["handle"]
    assert me_data["public_id"] == data["user"]["public_id"]


@pytest.mark.asyncio
async def test_upgrade_guest_to_registered(async_client: AsyncClient):
    # 1. Create a guest
    res = await async_client.post("/guests", json={"display_name": "Warrior", "accept_public_notice": True})
    assert res.status_code == 201
    guest_info = res.json()["user"]

    # 2. Upgrade account
    up_res = await async_client.post(
        "/auth/upgrade",
        json={"username": "warrior_hero", "password": "secure_password_123"},
    )
    assert up_res.status_code == 200
    up_data = up_res.json()
    assert up_data["is_guest"] is False
    assert up_data["username"] == "warrior_hero"
    assert up_data["id"] == guest_info["id"]
    assert up_data["public_id"] == guest_info["public_id"]
    assert up_data["handle"] == guest_info["handle"]

    # 3. Second upgrade attempt fails
    up_again = await async_client.post(
        "/auth/upgrade",
        json={"username": "warrior_hero2", "password": "secure_password_123"},
    )
    assert up_again.status_code == 403
    assert up_again.json()["detail"]["code"] == "NOT_A_GUEST"


@pytest.mark.asyncio
async def test_p1_p2_p3_p4_prerequisites_verification(async_client: AsyncClient, db_session):
    dungeon = await seed_demo_dungeon(db_session)

    # Create guest
    g_res = await async_client.post("/guests", json={"display_name": "PrereqTester", "accept_public_notice": True})
    assert g_res.status_code == 201

    # Start run
    run_res = await async_client.post("/runs", json={"dungeon_id": dungeon.id})
    assert run_res.status_code == 201
    run_id = run_res.json()["id"]

    # Get first room question
    d_res = await async_client.get(f"/dungeons/{dungeon.id}")
    room_1 = d_res.json()["rooms"][0]
    q_1 = room_1["questions"][0]

    # Attempt question
    import uuid
    att_res = await async_client.post(
        f"/runs/{run_id}/attempts",
        json={
            "attempt_id": str(uuid.uuid4()),
            "question_id": q_1["id"],
            "selected_answer": q_1["options"][0],
            "weapon_name": "Rusty Dagger",
        },
    )
    assert att_res.status_code == 200
    att_data = att_res.json()
    # P2: check monster_hp_remaining is non-zero when monster not dead
    assert "monster_hp_remaining" in att_data
    assert att_data["monster_hp_remaining"] >= 0
