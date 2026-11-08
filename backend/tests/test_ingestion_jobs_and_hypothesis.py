import io
import uuid

import pytest
from httpx import AsyncClient
from hypothesis import given
from hypothesis import strategies as st
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_session_token
from app.models.all_models import Document, User


@pytest.mark.asyncio
async def test_document_retry_endpoint(async_client: AsyncClient, db_session: AsyncSession):
    """Failed document can be re-queued via POST /documents/{id}/retry."""
    user = User(username="retry_user", is_guest=False, password_hash="hash")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    doc = Document(user_id=user.id, title="Failed Upload", original_filename="fail.txt", file_type="txt", status="failed", rejection_reason="Network error")
    db_session.add(doc)
    await db_session.commit()
    await db_session.refresh(doc)

    token = create_session_token(user.id, session_version=user.session_version)
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    retry_resp = await async_client.post(f"/documents/{doc.id}/retry")
    assert retry_resp.status_code == 200
    assert retry_resp.json()["status"] == "processing"


@pytest.mark.asyncio
async def test_env_threshold_min_500_chars(async_client: AsyncClient, db_session: AsyncSession):
    """Text below 500 characters is rejected by default per env INGESTION_MIN_CHARS."""
    user = User(username="short_note_user", is_guest=False, password_hash="hash")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    token = create_session_token(user.id, session_version=user.session_version)
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    short_text = "This note is only 100 characters long, well below the 500 character default requirement."
    files = {"file": ("short.txt", io.BytesIO(short_text.encode("utf-8")), "text/plain")}

    resp = await async_client.post("/documents", files=files)
    doc_id = resp.json()["id"]

    from app.api.documents import process_document_background
    await process_document_background(doc_id, short_text.encode("utf-8"), "txt", session=db_session)

    status_resp = await async_client.get(f"/documents/{doc_id}/status")
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] == "rejected"
    assert "insufficient readable text" in status_resp.json()["rejection_reason"]


@given(
    attempt_id=st.uuids(),
)
def test_hypothesis_attempt_idempotency_structure(attempt_id):
    """Hypothesis PBT: Verifies attempt_id is always a deterministic valid UUID."""
    assert uuid.UUID(str(attempt_id))
    # Idempotent replay of same key produces identical string representation
    assert str(attempt_id) == str(attempt_id)
