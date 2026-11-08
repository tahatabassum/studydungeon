from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_error_body_contract_401(async_client: AsyncClient):
    """401 Unauthorized returns standard detail object."""
    res = await async_client.get("/auth/me")
    assert res.status_code == 401
    body = res.json()
    assert "detail" in body
    assert isinstance(body["detail"], dict)
    assert "code" in body["detail"]
    assert "message" in body["detail"]
    assert body["detail"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_error_body_contract_404(async_client: AsyncClient):
    """404 Not Found returns standard detail object."""
    # Register and then login to obtain authenticated cookies in async_client
    await async_client.post(
        "/auth/register",
        json={"username": "errortestuser", "password": "Password123!"},
    )
    await async_client.post(
        "/auth/login",
        json={"username": "errortestuser", "password": "Password123!"},
    )
    res = await async_client.get("/dungeons/nonexistent-id-000")
    assert res.status_code == 404
    body = res.json()
    assert "detail" in body
    assert isinstance(body["detail"], dict)
    assert "code" in body["detail"]
    assert "message" in body["detail"]


@pytest.mark.asyncio
async def test_error_body_contract_422(async_client: AsyncClient):
    """422 Validation Error returns standard detail object."""
    res = await async_client.post("/auth/login", json={"invalid": "payload"})
    assert res.status_code == 422
    body = res.json()
    assert "detail" in body
    assert isinstance(body["detail"], dict)
    assert body["detail"]["code"] == "VALIDATION_ERROR"
    assert "message" in body["detail"]


@pytest.mark.asyncio
async def test_error_body_contract_500_does_not_leak_traceback():
    """Unhandled server errors return 500 without leaking stack traces or internals."""
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch("app.api.auth.verify_password", side_effect=RuntimeError("Secret DB crash stacktrace")):
            res = await client.post(
                "/auth/login",
                json={"username": "errortestuser", "password": "Password123!"},
            )
            assert res.status_code == 500
            body = res.json()
            assert "detail" in body
            assert isinstance(body["detail"], dict)
            assert body["detail"]["code"] == "INTERNAL_SERVER_ERROR"
            assert "Secret DB crash" not in str(body)
            assert "traceback" not in str(body).lower()


