import unicodedata
from unittest.mock import patch

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.services.srs import calculate_next_review_interval


# ========================================================
# GAP 1: Session Revocation After Logout
# ========================================================
@pytest.mark.asyncio
async def test_session_revocation_after_logout(async_client: AsyncClient):
    """
    After logout, reusing the previous cookie MUST return 401 UNAUTHORIZED.
    """
    await async_client.post(
        "/auth/register",
        json={"username": "revocation_user", "password": "securepassword123"},
    )
    login_res = await async_client.post(
        "/auth/login",
        json={"username": "revocation_user", "password": "securepassword123"},
    )
    saved_cookie = login_res.cookies.get(settings.SESSION_COOKIE_NAME)
    assert saved_cookie is not None

    # Verify session works
    me_res = await async_client.get("/auth/me")
    assert me_res.status_code == 200

    # Logout
    logout_res = await async_client.post("/auth/logout")
    assert logout_res.status_code == 200

    # Re-apply the old cookie and attempt access
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, saved_cookie)
    me_after_logout = await async_client.get("/auth/me")
    assert me_after_logout.status_code == 401
    assert me_after_logout.json()["detail"]["code"] == "UNAUTHORIZED"


# ========================================================
# GAP 2: Constant-Time Login (Argon2 Dummy Verify)
# ========================================================
@pytest.mark.asyncio
async def test_constant_time_login_runs_argon2_on_missing_user(async_client: AsyncClient):
    """
    When username does not exist, Argon2 verify_password must still be executed
    against a dummy hash to prevent timing attacks.
    """
    with patch("app.api.auth.verify_password", wraps=lambda p, h: False) as spy_verify:
        res = await async_client.post(
            "/auth/login",
            json={"username": "non_existent_ninja", "password": "attemptedpassword123"},
        )
        assert res.status_code == 401
        assert spy_verify.called, "verify_password was not called for missing user!"


# ========================================================
# GAP 3: Input Limits & NFKC Normalization
# ========================================================
@pytest.mark.asyncio
async def test_input_limits_1000_char_username_and_1mb_password(async_client: AsyncClient):
    """
    1000-char username or 1MB password must be rejected at validation (422)
    without triggering Argon2.
    """
    huge_username = "a" * 1000
    huge_password = "P" * (1024 * 1024)  # 1MB

    with patch("app.api.auth.hash_password") as mock_hash:
        res = await async_client.post(
            "/auth/register",
            json={"username": huge_username, "password": "validpassword123"},
        )
        assert res.status_code == 422
        assert not mock_hash.called

        res2 = await async_client.post(
            "/auth/register",
            json={"username": "validuser", "password": huge_password},
        )
        assert res2.status_code == 422
        assert not mock_hash.called

        # Also test min password length 8
        res3 = await async_client.post(
            "/auth/register",
            json={"username": "validuser", "password": "short"},  # 5 chars
        )
        assert res3.status_code == 422


@pytest.mark.asyncio
async def test_username_nfkc_normalization(async_client: AsyncClient):
    """
    Usernames must be NFKC-normalized and lowercased.
    Homoglyphs/fullwidth characters (e.g. 'Ｔｅｓｔ' vs 'test') must normalize identically and collide.
    """
    fullwidth_user = "Ｔｅｓｔ"  # Fullwidth 'Test'
    normalized_expected = unicodedata.normalize("NFKC", fullwidth_user).lower()
    assert normalized_expected == "test"

    reg1 = await async_client.post(
        "/auth/register",
        json={"username": "test", "password": "password1234"},
    )
    assert reg1.status_code == 201

    # Attempting to register fullwidth homoglyph 'Ｔｅｓｔ' must be rejected as duplicate 409
    reg2 = await async_client.post(
        "/auth/register",
        json={"username": fullwidth_user, "password": "password1234"},
    )
    assert reg2.status_code == 409
    assert reg2.json()["detail"]["code"] == "USERNAME_TAKEN"


# ========================================================
# GAP 4: SRS Logic in app/services/srs.py
# ========================================================
def test_srs_service_in_dedicated_module():
    rep, interval, due = calculate_next_review_interval(current_repetition=0, is_correct=True)
    assert rep == 1
    assert interval == 3.0
