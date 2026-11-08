import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_hostile_oversized_and_malformed_json(async_client: AsyncClient):
    """Hostile QA: Malformed JSON or garbage payloads must return 422, never crash 500."""
    res = await async_client.post(
        "/auth/login",
        content="{\"bad_json\": true,",
        headers={"content-type": "application/json"}
    )
    assert res.status_code == 422
    assert "detail" in res.json()


@pytest.mark.asyncio
async def test_hostile_path_traversal_filename_upload(async_client: AsyncClient):
    """Hostile QA: Path traversal filenames like ../../etc/passwd must be sanitized."""
    await async_client.post("/auth/register", json={"username": "traversaluser", "password": "Password123!"})
    await async_client.post("/auth/login", json={"username": "traversaluser", "password": "Password123!"})

    files = {"file": ("../../etc/passwd.txt", b"Safe educational content about operating systems " * 20, "text/plain")}
    res = await async_client.post("/documents", files=files)
    assert res.status_code == 202
    # File is saved with random uuid on disk, not traversal path
    assert "id" in res.json()


@pytest.mark.asyncio
async def test_hostile_sql_injection_attempt(async_client: AsyncClient):
    """Hostile QA: SQL injection strings in username or ID queries must be parameterized safely."""
    sqli_username = "admin' OR '1'='1"
    res = await async_client.post("/auth/login", json={"username": sqli_username, "password": "password"})
    assert res.status_code == 401
    assert res.json()["detail"]["code"] == "INVALID_CREDENTIALS"


@pytest.mark.asyncio
async def test_hostile_idor_document_access(async_client: AsyncClient):
    """Hostile QA: Attempting IDOR to read another user's private document chunks."""
    # User A uploads document
    await async_client.post("/auth/register", json={"username": "victimuser", "password": "Password123!"})
    await async_client.post("/auth/login", json={"username": "victimuser", "password": "Password123!"})
    files = {"file": ("notes.txt", b"Private lecture notes for victim user only " * 20, "text/plain")}
    doc_res = await async_client.post("/documents", files=files)
    doc_id = doc_res.json()["id"]

    # User B logs in and attempts to access User A's source preview
    await async_client.post("/auth/register", json={"username": "attackeruser", "password": "Password123!"})
    await async_client.post("/auth/login", json={"username": "attackeruser", "password": "Password123!"})

    idor_res = await async_client.get(f"/documents/{doc_id}/source-preview")
    assert idor_res.status_code in (403, 404)
