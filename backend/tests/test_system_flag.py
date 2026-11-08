import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.all_models import User


@pytest.mark.asyncio
async def test_reserved_system_usernames_rejected(async_client: AsyncClient):
    """
    Ensure usernames 'system', 'system_demo', or anything starting with 'system_'
    are strictly rejected upon registration with 422 Unprocessable Entity.
    """
    # 1. Exact 'system'
    resp1 = await async_client.post(
        "/auth/register",
        json={"username": "system", "password": "securepassword123"},
    )
    assert resp1.status_code == 422
    assert "reserved" in resp1.text.lower()

    # 2. Exact 'system_demo'
    resp2 = await async_client.post(
        "/auth/register",
        json={"username": "system_demo", "password": "securepassword123"},
    )
    assert resp2.status_code == 422
    assert "reserved" in resp2.text.lower()

    # 3. Case variations e.g. 'SYSTEM_ADMIN' or 'System'
    resp3 = await async_client.post(
        "/auth/register",
        json={"username": "SYSTEM", "password": "securepassword123"},
    )
    assert resp3.status_code == 422


@pytest.mark.asyncio
async def test_is_system_flag_blocks_account_deletion(async_client: AsyncClient, db_session: AsyncSession):
    """
    Ensure any user flagged with is_system=True cannot be deleted via DELETE /auth/me,
    even if their username was changed.
    """
    # Create a system flagged user directly in the database
    sys_user = User(
        username="special_system_bot",
        password_hash=None,
        is_guest=False,
        is_system=True,
    )
    db_session.add(sys_user)
    await db_session.commit()
    await db_session.refresh(sys_user)

    assert sys_user.is_system is True

    # Craft auth cookie for this system user
    from app.core.config import settings
    from app.core.security import create_session_token

    cookie_val = create_session_token(sys_user.id, session_version=sys_user.session_version)
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, cookie_val)

    # Attempt to delete the system user
    del_resp = await async_client.delete("/auth/me")
    assert del_resp.status_code == 403
    err_body = del_resp.json()["detail"]
    assert err_body["code"] == "SYSTEM_USER_PROTECTED"

    # Confirm user still exists in DB
    re_check = await db_session.execute(select(User).where(User.id == sys_user.id))
    assert re_check.scalar_one_or_none() is not None
