import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_session_token
from app.models.all_models import Document, DocumentChunk, User


@pytest.mark.asyncio
async def test_break_dungeon_other_user_isolation(async_client: AsyncClient, db_session: AsyncSession):
    """User B cannot generate or access User A's private dungeon."""
    user_a = User(username="user_alice", is_guest=False, password_hash="hash")
    user_b = User(username="user_bob", is_guest=False, password_hash="hash")
    db_session.add_all([user_a, user_b])
    await db_session.commit()
    await db_session.refresh(user_a)
    await db_session.refresh(user_b)

    doc_a = Document(
        user_id=user_a.id,
        title="Alice Secrets",
        original_filename="alice.txt",
        file_type="txt",
        status="accepted",
    )
    db_session.add(doc_a)
    await db_session.commit()
    await db_session.refresh(doc_a)

    chunk_a = DocumentChunk(
        document_id=doc_a.id,
        user_id=user_a.id,
        chunk_index=0,
        text="Confidential research on quantum cryptanalysis.",
        page_number=1,
    )
    db_session.add(chunk_a)
    await db_session.commit()

    # User B logs in
    token_b = create_session_token(user_b.id, session_version=user_b.session_version)
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, token_b)

    # Bob tries to generate dungeon from Alice's document -> 404
    resp = await async_client.post(f"/documents/{doc_a.id}/generate-dungeon")
    assert resp.status_code == 404
    assert resp.json()["detail"]["code"] == "DOCUMENT_NOT_FOUND"


@pytest.mark.asyncio
async def test_break_dungeon_generation_no_chunks(async_client: AsyncClient, db_session: AsyncSession):
    """Attempting to generate a dungeon for a document without chunks returns 400."""
    user = User(username="empty_doc_user", is_guest=False, password_hash="hash")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    doc = Document(
        user_id=user.id,
        title="Empty Doc",
        original_filename="empty.txt",
        file_type="txt",
        status="accepted",
    )
    db_session.add(doc)
    await db_session.commit()
    await db_session.refresh(doc)

    token = create_session_token(user.id, session_version=user.session_version)
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    resp = await async_client.post(f"/documents/{doc.id}/generate-dungeon")
    assert resp.status_code == 400
    assert resp.json()["detail"]["code"] == "NO_CHUNKS_AVAILABLE"
