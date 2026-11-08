import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_user_registration_and_login(async_client: AsyncClient):
    # Register
    reg_res = await async_client.post(
        "/auth/register",
        json={"username": "dungeon_master", "password": "securepassword123"},
    )
    assert reg_res.status_code == 201
    data = reg_res.json()
    assert data["username"] == "dungeon_master"
    assert data["is_guest"] is False

    # Duplicate registration
    dup_res = await async_client.post(
        "/auth/register",
        json={"username": "dungeon_master", "password": "securepassword123"},
    )
    assert dup_res.status_code == 409

    # Login
    login_res = await async_client.post(
        "/auth/login",
        json={"username": "dungeon_master", "password": "securepassword123"},
    )
    assert login_res.status_code == 200
    assert "studydungeon_session" in login_res.cookies

    # Invalid login
    bad_login = await async_client.post(
        "/auth/login",
        json={"username": "dungeon_master", "password": "wrongpassword"},
    )
    assert bad_login.status_code == 401


@pytest.mark.asyncio
async def test_auth_me_endpoint(async_client: AsyncClient):
    # Register and login
    await async_client.post(
        "/auth/register",
        json={"username": "warrior1", "password": "password1234"},
    )
    login_res = await async_client.post(
        "/auth/login",
        json={"username": "warrior1", "password": "password1234"},
    )
    assert login_res.status_code == 200

    # Get profile
    me_res = await async_client.get("/auth/me")
    assert me_res.status_code == 200
    data = me_res.json()
    assert data["username"] == "warrior1"
    assert data["is_guest"] is False

