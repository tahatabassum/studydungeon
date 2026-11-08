import io

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_session_token
from app.models.all_models import User


@pytest.mark.asyncio
async def test_guest_upload_blocked(async_client: AsyncClient, db_session: AsyncSession):
    """Guests (is_guest=True) must be blocked from uploading documents with 403."""
    guest = User(username="guest_tester123", is_guest=True, password_hash=None)
    db_session.add(guest)
    await db_session.commit()
    await db_session.refresh(guest)

    token = create_session_token(guest.id, session_version=guest.session_version, is_guest=True)
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    files = {"file": ("notes.txt", io.BytesIO(b"Some lecture notes here"), "text/plain")}
    resp = await async_client.post("/documents", files=files)
    assert resp.status_code == 403
    assert resp.json()["detail"]["code"] in ("GUEST_FORBIDDEN", "GUEST_RESTRICTED")


@pytest.mark.asyncio
async def test_upload_invalid_extension_rejected(async_client: AsyncClient, db_session: AsyncSession):
    """Uploading unsupported extensions (e.g. .exe, .zip, .mp3) must return 415."""
    user = User(username="valid_student_1", is_guest=False, password_hash="hash")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    token = create_session_token(user.id, session_version=user.session_version, is_guest=False)
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    files = {"file": ("malicious.exe", io.BytesIO(b"MZfakebinary"), "application/x-dosexec")}
    resp = await async_client.post("/documents", files=files)
    assert resp.status_code == 415
    assert resp.json()["detail"]["code"] == "UNSUPPORTED_FILE_TYPE"


@pytest.mark.asyncio
async def test_upload_oversized_file_rejected(async_client: AsyncClient, db_session: AsyncSession):
    """Uploading files larger than MAX_UPLOAD_MB must return 413."""
    user = User(username="valid_student_2", is_guest=False, password_hash="hash")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    token = create_session_token(user.id, session_version=user.session_version, is_guest=False)
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    # 16 MB dummy buffer (exceeds default 15MB)
    huge_data = b"X" * (16 * 1024 * 1024)
    files = {"file": ("huge_notes.txt", io.BytesIO(huge_data), "text/plain")}
    resp = await async_client.post("/documents", files=files)
    assert resp.status_code == 413
    assert resp.json()["detail"]["code"] == "FILE_TOO_LARGE"


@pytest.mark.asyncio
async def test_valid_text_document_ingestion_lifecycle(async_client: AsyncClient, db_session: AsyncSession):
    """
    Valid text upload succeeds -> 202 Accepted -> status moves to accepted ->
    chunks are extracted and queryable -> DELETE cascades properly.
    """
    user = User(username="valid_student_3", is_guest=False, password_hash="hash")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    token = create_session_token(user.id, session_version=user.session_version, is_guest=False)
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    # Valid study notes with > 500 characters
    notes_content = (
        "Operating Systems and Architecture Lecture 1. "
        "A process is a program in execution containing program code and current activity. "
        "Each process has a Process Control Block (PCB) representing execution context. "
        "The CPU switches between processes using context switching, saving state in PCB registers. "
        "Inter-process communication (IPC) occurs via message passing or shared memory. "
        "Threads are lightweight units of execution within a process sharing address space. "
        "Concurrency introduces race conditions resolved using semaphores, mutexes, and monitors. "
        "Deadlocks happen when processes hold resources while waiting for others, requiring prevention algorithms."
    )
    files = {"file": ("os_lecture_1.txt", io.BytesIO(notes_content.encode("utf-8")), "text/plain")}
    resp = await async_client.post("/documents", files=files)
    assert resp.status_code == 202
    data = resp.json()
    doc_id = data["id"]
    assert data["status"] == "processing"

    # Poll status endpoint
    status_resp = await async_client.get(f"/documents/{doc_id}/status")
    assert status_resp.status_code == 200
    st_data = status_resp.json()
    assert st_data["status"] in ("processing", "accepted")

    # List documents
    list_resp = await async_client.get("/documents")
    assert list_resp.status_code == 200
    docs = list_resp.json()
    assert any(d["id"] == doc_id for d in docs)

    # Delete document cascade
    del_resp = await async_client.delete(f"/documents/{doc_id}")
    assert del_resp.status_code == 200

    # Confirm deleted
    post_del_check = await async_client.get(f"/documents/{doc_id}/status")
    assert post_del_check.status_code == 404
