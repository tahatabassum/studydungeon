import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_demo_guest_session(async_client: AsyncClient):
    demo_res = await async_client.post("/demo/session")
    assert demo_res.status_code == 201
    data = demo_res.json()
    assert data["user"]["is_guest"] is True
    assert data["user"]["username"].startswith("guest_")
    assert data["dungeon_id"] is not None
    assert "expires_at" in data
    assert "studydungeon_session" in demo_res.cookies


@pytest.mark.asyncio
async def test_guest_me_endpoint(async_client: AsyncClient):
    demo_res = await async_client.post("/demo/session")
    assert demo_res.status_code == 201

    me_res = await async_client.get("/auth/me")
    assert me_res.status_code == 200
    data = me_res.json()
    assert data["is_guest"] is True

