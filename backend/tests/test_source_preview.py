import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_session_token
from app.demo.seed import seed_demo_dungeon
from app.models.all_models import Document, DocumentChunk, User


@pytest.mark.asyncio
async def test_source_preview_owner_and_guest_safety(async_client: AsyncClient, db_session: AsyncSession):
    """
    Test Item 4:
    - GET /documents/{id}/source-preview returns citations with 1-based page numbers and stable chunk_ids.
    - Scoped strictly to owner (Account 2 gets 404).
    - Guests can view source preview ONLY for the public demo dungeon document.
    """
    demo_dungeon = await seed_demo_dungeon(db_session)

    # 1. User 1 creates document and chunk
    u1 = User(username="source_owner", is_guest=False, password_hash="hash")
    db_session.add(u1)
    await db_session.commit()
    await db_session.refresh(u1)

    doc_1 = Document(user_id=u1.id, title="Quantum Computing Notes", original_filename="qc.txt", file_type="txt", status="accepted")
    db_session.add(doc_1)
    await db_session.commit()
    await db_session.refresh(doc_1)

    chunk_1 = DocumentChunk(document_id=doc_1.id, user_id=u1.id, chunk_index=0, text="Qubits exhibit superposition and entanglement.", page_number=1)
    db_session.add(chunk_1)
    await db_session.commit()
    await db_session.refresh(chunk_1)

    # Owner views preview
    token_1 = create_session_token(u1.id, session_version=u1.session_version)
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, token_1)

    resp = await async_client.get(f"/documents/{doc_1.id}/source-preview")
    assert resp.status_code == 200
    data = resp.json()
    assert data["document_id"] == doc_1.id
    assert len(data["chunks"]) == 1
    assert data["chunks"][0]["page_number"] == 1
    assert data["chunks"][0]["chunk_id"] == chunk_1.id
    assert "superposition" in data["chunks"][0]["text"]

    # 2. Account 2 intruder receives 404
    u2 = User(username="intruder_preview", is_guest=False, password_hash="hash")
    db_session.add(u2)
    await db_session.commit()
    await db_session.refresh(u2)

    token_2 = create_session_token(u2.id, session_version=u2.session_version)
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, token_2)
    intruder_resp = await async_client.get(f"/documents/{doc_1.id}/source-preview")
    assert intruder_resp.status_code == 404

    # 3. Guest can view demo dungeon document preview
    guest = User(username="guest_viewer", is_guest=True, password_hash=None)
    db_session.add(guest)
    await db_session.commit()
    await db_session.refresh(guest)

    token_g = create_session_token(guest.id, session_version=guest.session_version, is_guest=True)
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, token_g)

    # Guest accessing private doc -> 404
    guest_priv = await async_client.get(f"/documents/{doc_1.id}/source-preview")
    assert guest_priv.status_code == 404

    # Guest accessing public demo doc -> 200
    guest_demo = await async_client.get(f"/documents/{demo_dungeon.document_id}/source-preview")
    assert guest_demo.status_code == 200
    assert len(guest_demo.json()["chunks"]) >= 1
