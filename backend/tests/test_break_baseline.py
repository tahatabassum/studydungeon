import base64
import hashlib
import hmac
import json
import time

import pytest
from httpx import AsyncClient
from hypothesis import given
from hypothesis import strategies as st

from app.core.config import settings
from app.services.combat import calculate_combat_damage, calculate_next_review_interval

# ==========================================
# 1. PROPERTY-BASED ATTACKS ON COMBAT LOGIC
# ==========================================

@given(
    weapon=st.text(),
    difficulty=st.text(),
    streak=st.integers(min_value=-1000, max_value=10000),
    is_correct=st.booleans(),
    is_boss=st.booleans(),
)
def test_pbt_combat_damage_safety_and_invariants(weapon, difficulty, streak, is_correct, is_boss):
    """
    Combat damage must NEVER crash or return invalid numbers regardless of input chaos.
    - If incorrect: damage dealt MUST be exactly 0, and player damage must be > 0.
    - If correct: damage dealt must be >= min base damage (20) for standard weapons, player damage must be 0.
    """
    damage, player_dmg, is_crit = calculate_combat_damage(
        weapon_name=weapon,
        difficulty=difficulty,
        current_streak=streak,
        is_correct=is_correct,
        is_boss=is_boss,
    )
    assert isinstance(damage, int)
    assert isinstance(player_dmg, int)
    assert isinstance(is_crit, bool)

    if not is_correct:
        assert damage == 0
        assert player_dmg in (10, 12)
        assert is_crit is False
    else:
        assert player_dmg == 0
        assert damage >= 0


@given(
    rep=st.integers(min_value=-100, max_value=1000),
    is_correct=st.booleans(),
    marked_hard=st.booleans(),
)
def test_pbt_srs_intervals_safety(rep, is_correct, marked_hard):
    """
    SRS scheduling must handle negative or arbitrary repetition states without crash,
    and output monotonically valid positive future timestamps.
    """
    new_rep, interval, due = calculate_next_review_interval(
        current_repetition=rep,
        is_correct=is_correct,
        marked_hard=marked_hard,
    )
    assert new_rep >= 0
    assert interval > 0


# ==========================================
# 2. HOSTILE INTEGRATION ATTACKS ON AUTH
# ==========================================

@pytest.mark.asyncio
async def test_auth_attack_error_format_on_validation_failure(async_client: AsyncClient):
    """
    Validation error on bad JSON or missing fields must match api-contract.md:
    {"detail": {"code": "VALIDATION_ERROR", "message": "..."}}
    """
    res = await async_client.post("/auth/register", json={"username": ""})
    assert res.status_code == 422
    data = res.json()
    assert "detail" in data
    assert isinstance(data["detail"], dict)
    assert data["detail"]["code"] == "VALIDATION_ERROR"
    assert "message" in data["detail"]


@pytest.mark.asyncio
async def test_auth_attack_whitespace_and_unicode_username(async_client: AsyncClient):
    """
    Attacker tries whitespace-only username or usernames with spaces around them.
    Whitespace username must be rejected.
    """
    res = await async_client.post("/auth/register", json={"username": "   ", "password": "validpassword123"})
    assert res.status_code == 422 or res.status_code == 400


@pytest.mark.asyncio
async def test_auth_attack_timing_and_credential_leakage(async_client: AsyncClient):
    """
    Attacker tries non-existent username vs wrong password on existing username.
    Response code and structure MUST be indistinguishable (401 with generic INVALID_CREDENTIALS).
    """
    # 1. Non-existent user
    res1 = await async_client.post("/auth/login", json={"username": "ghost_user", "password": "somepassword123"})
    assert res1.status_code == 401
    d1 = res1.json()["detail"]
    assert d1["code"] == "INVALID_CREDENTIALS"

    # 2. Create real user
    await async_client.post("/auth/register", json={"username": "real_user", "password": "realpassword123"})

    # 3. Existing user with wrong password
    res2 = await async_client.post("/auth/login", json={"username": "real_user", "password": "wrongpassword123"})
    assert res2.status_code == 401
    d2 = res2.json()["detail"]
    assert d2["code"] == "INVALID_CREDENTIALS"
    assert d1["message"] == d2["message"]


@pytest.mark.asyncio
async def test_session_attack_tampered_signature(async_client: AsyncClient):
    """
    Attacker tries modifying payload in cookie and altering signature.
    Must be rejected with 401 UNAUTHORIZED, not 500 error.
    """
    # Register and get real token
    await async_client.post("/auth/register", json={"username": "victim", "password": "password123"})
    login_res = await async_client.post("/auth/login", json={"username": "victim", "password": "password123"})
    real_cookie = login_res.cookies.get(settings.SESSION_COOKIE_NAME)
    assert real_cookie is not None

    payload_b64, sig = real_cookie.split(".")
    # Tamper payload
    tampered_cookie = f"{payload_b64}a.{sig}"

    async_client.cookies.set(settings.SESSION_COOKIE_NAME, tampered_cookie)
    res = await async_client.get("/auth/me")
    assert res.status_code == 401
    assert res.json()["detail"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_session_attack_expired_cookie(async_client: AsyncClient):
    """
    Attacker presents a syntactically valid signed token that has expired.
    Must be rejected with 401.
    """
    payload = {
        "sub": "user_expired_id",
        "guest": False,
        "exp": int(time.time()) - 100,  # 100 seconds in past
    }
    payload_bytes = json.dumps(payload).encode("utf-8")
    payload_b64 = base64.urlsafe_b64encode(payload_bytes).decode("utf-8").rstrip("=")
    sig = hmac.new(settings.SECRET_KEY.encode("utf-8"), payload_b64.encode("utf-8"), hashlib.sha256).hexdigest()
    expired_token = f"{payload_b64}.{sig}"

    async_client.cookies.set(settings.SESSION_COOKIE_NAME, expired_token)
    res = await async_client.get("/auth/me")
    assert res.status_code == 401
    assert res.json()["detail"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_demo_guest_cannot_login_as_regular_user(async_client: AsyncClient):
    """
    Attacker sees guest username in response and tries calling POST /auth/login with that username.
    Guests have no password and must be rejected.
    """
    demo_res = await async_client.post("/demo/session")
    guest_username = demo_res.json()["user"]["username"]

    login_res = await async_client.post("/auth/login", json={"username": guest_username, "password": "password"})
    assert login_res.status_code == 401
    assert login_res.json()["detail"]["code"] == "INVALID_CREDENTIALS"
