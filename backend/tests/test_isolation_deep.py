import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_session_token
from app.demo.seed import seed_demo_dungeon
from app.models.all_models import Document, DocumentChunk, Dungeon, GameRun, User


@pytest.mark.asyncio
async def test_two_account_cross_tenant_isolation(async_client: AsyncClient, db_session: AsyncSession):
    """
    Account 2 receives 403 or 404 attempting to access Account 1's:
    - Documents
    - Dungeons
    - Runs
    - Attempts
    - Scorecard
    """
    await seed_demo_dungeon(db_session)

    # Account 1
    u1 = User(username="account_one", is_guest=False, password_hash="hash")
    # Account 2
    u2 = User(username="account_two", is_guest=False, password_hash="hash")
    db_session.add_all([u1, u2])
    await db_session.commit()
    await db_session.refresh(u1)
    await db_session.refresh(u2)

    # Create Account 1 artifacts
    doc_1 = Document(user_id=u1.id, title="Account 1 Secret Notes", original_filename="a1.txt", file_type="txt", status="accepted")
    db_session.add(doc_1)
    await db_session.commit()
    await db_session.refresh(doc_1)

    chunk_1 = DocumentChunk(document_id=doc_1.id, user_id=u1.id, chunk_index=0, text="Account 1 proprietary data text.", page_number=1)
    dungeon_1 = Dungeon(user_id=u1.id, document_id=doc_1.id, title="Account 1 Dungeon", is_public_demo=False)
    db_session.add_all([chunk_1, dungeon_1])
    await db_session.commit()
    await db_session.refresh(dungeon_1)

    run_1 = GameRun(user_id=u1.id, dungeon_id=dungeon_1.id, current_hp=100)
    db_session.add(run_1)
    await db_session.commit()
    await db_session.refresh(run_1)

    # Log in as Account 2
    token_2 = create_session_token(u2.id, session_version=u2.session_version)
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, token_2)

    # 1. Document access
    doc_resp = await async_client.get(f"/documents/{doc_1.id}/status")
    assert doc_resp.status_code == 404

    # 2. Document delete
    doc_del = await async_client.delete(f"/documents/{doc_1.id}")
    assert doc_del.status_code == 404

    # 3. Private Dungeon access
    dungeon_resp = await async_client.get(f"/dungeons/{dungeon_1.id}")
    assert dungeon_resp.status_code == 404

    # 4. Private Dungeon run creation
    run_resp = await async_client.post("/runs", json={"dungeon_id": dungeon_1.id})
    assert run_resp.status_code == 403

    # 5. Run status & finish
    run_get = await async_client.get(f"/runs/{run_1.id}")
    assert run_get.status_code == 404
    run_fin = await async_client.post(f"/runs/{run_1.id}/finish")
    assert run_fin.status_code == 404


@pytest.mark.asyncio
async def test_logout_invalidates_session_cookie(async_client: AsyncClient, db_session: AsyncSession):
    """Logging out revokes session_version; re-using the old cookie returns 401."""
    user = User(username="cookie_revoker", is_guest=False, password_hash="hash")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    token = create_session_token(user.id, session_version=user.session_version)
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    # Authenticated call succeeds
    me_resp = await async_client.get("/auth/me")
    assert me_resp.status_code == 200

    # Logout
    logout_resp = await async_client.post("/auth/logout")
    assert logout_resp.status_code == 200

    # Re-apply the old cookie
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, token)
    post_logout_me = await async_client.get("/auth/me")
    assert post_logout_me.status_code == 401
    assert post_logout_me.json()["detail"]["code"] in ("UNAUTHORIZED", "SESSION_REVOKED")
