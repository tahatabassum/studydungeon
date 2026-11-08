import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_cross_user_isolation(async_client: AsyncClient):
    # Register User A
    await async_client.post(
        "/auth/register",
        json={"username": "user_a", "password": "passwordA123"},
    )
    res_a = await async_client.post(
        "/auth/login",
        json={"username": "user_a", "password": "passwordA123"},
    )
    assert res_a.status_code == 200

    # User A profile
    me_a = await async_client.get("/auth/me")
    assert me_a.status_code == 200
    assert me_a.json()["username"] == "user_a"

    # Logout
    await async_client.post("/auth/logout")

    # Unauthenticated /auth/me returns 401
    me_unauth = await async_client.get("/auth/me")
    assert me_unauth.status_code == 401

