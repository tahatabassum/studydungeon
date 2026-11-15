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
