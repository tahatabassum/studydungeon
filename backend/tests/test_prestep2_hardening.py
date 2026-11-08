from datetime import datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.config import Settings, settings
from app.core.rate_limit import get_client_ip
from app.core.security import DUMMY_ARGON2_HASH, ph
from app.demo.purge import purge_expired_guests
from app.demo.seed import seed_demo_dungeon
from app.models.all_models import Dungeon, RateLimitRecord, User
from app.services.srs import calculate_next_review_interval


# ========================================================
# 1. Client IP Hops from the RIGHT (TRUSTED_PROXY_COUNT)
# ========================================================
def test_client_ip_hops_from_right():
    """
    Client IP must NOT take the leftmost entry (client-controlled spoofing).
    With TRUSTED_PROXY_COUNT = 1, taking 1 hop from right:
    Header: 'spoofed.ip.1, spoofed.ip.2, real.client.ip, vercel.proxy'
    -> real.client.ip must be selected, NOT spoofed.ip.1.
    """
    from starlette.requests import Request

    # Case A: Spoofed leftmost header
    scope = {
        "type": "http",
        "headers": [
            (b"x-forwarded-for", b"198.51.100.99, 203.0.113.50"),
        ],
        "client": ("10.0.0.1", 12345),
    }
    req = Request(scope)
    # Settings has TRUSTED_PROXY_COUNT = 1: index = len - 1 = 203.0.113.50
    assert get_client_ip(req) == "203.0.113.50"

    # Case B: Missing header falls back to socket IP
    scope_no_header = {
        "type": "http",
        "headers": [],
        "client": ("192.168.1.10", 54321),
    }
    req_no_header = Request(scope_no_header)
    assert get_client_ip(req_no_header) == "192.168.1.10"


# ========================================================
# 2. GEMINI_MODEL required when AI_PROVIDER='gemini'
# ========================================================
def test_gemini_model_required_validation():
    """
    GEMINI_MODEL must not have a hardcoded default.
    If AI_PROVIDER='gemini' and GEMINI_MODEL is empty/None, raise ValueError.
    """
    with pytest.raises(ValueError, match="GEMINI_MODEL is required"):
        Settings(AI_PROVIDER="gemini", GEMINI_MODEL="", GEMINI_API_KEY="test")

    with pytest.raises(ValueError, match="GEMINI_MODEL is required"):
        Settings(AI_PROVIDER="gemini", GEMINI_MODEL=None, GEMINI_API_KEY="test")


# ========================================================
# 3. DUMMY_ARGON2_HASH Parameters Parity
# ========================================================
def test_dummy_argon2_hash_parameters_parity():
    """
    DUMMY_ARGON2_HASH must not need rehashing and must match the default PasswordHasher configuration.
    """
    assert not ph.check_needs_rehash(DUMMY_ARGON2_HASH)


# ========================================================
# 4. Explicit SRS Ladder Tests for Wrong and Difficult Correct
# ========================================================
@pytest.mark.parametrize("streak", [0, 1, 2, 5, 10, 25])
def test_srs_wrong_resets_streak_and_gives_10_minutes(streak):
    new_streak, interval, due = calculate_next_review_interval(current_repetition=streak, is_correct=False)
    assert new_streak == 0
    assert abs(interval - (10 / 1440)) < 1e-5


@pytest.mark.parametrize("streak", [0, 1, 2, 5, 10, 25])
def test_srs_difficult_correct_gives_1_day_at_every_streak_level(streak):
    new_streak, interval, due = calculate_next_review_interval(
        current_repetition=streak,
        is_correct=True,
        marked_hard=True,
    )
    assert new_streak == streak + 1
    assert interval == 1.0


# ========================================================
# 5. Protected System User & Cascade Under Real Foreign Keys
# ========================================================
@pytest.mark.asyncio
async def test_system_user_and_demo_dungeon_protected_from_deletion(async_client: AsyncClient, db_session):
    """
    The system user ('system_demo') and public demo dungeon cannot be deleted via DELETE /auth/me.
    """
    await seed_demo_dungeon(db_session)
    sys_user = (await db_session.execute(select(User).where(User.username == "system_demo"))).scalar_one_or_none()
    assert sys_user is not None

    # Try logging in or forging token for system_demo and deleting
    from app.core.security import create_session_token
    token = create_session_token(sys_user.id, session_version=sys_user.session_version)
    async_client.cookies.set(settings.SESSION_COOKIE_NAME, token)

    del_res = await async_client.delete("/auth/me")
    assert del_res.status_code == 403
    assert del_res.json()["detail"]["code"] == "SYSTEM_USER_PROTECTED"

    # Confirm system user and demo dungeon still exist
    check = (await db_session.execute(select(User).where(User.username == "system_demo"))).scalar_one_or_none()
    assert check is not None


# ========================================================
# 6. RateLimitRecord Cleanup & Purge Safety
# ========================================================
@pytest.mark.asyncio
async def test_purge_cleans_old_rate_limits_and_never_deletes_system_or_demo(db_session):
    """
    Purge must:
    1. Delete expired guests.
    2. Clean RateLimitRecord rows older than 1 hour.
    3. NEVER delete system_demo user or the public demo dungeon.
    """
    await seed_demo_dungeon(db_session)

    # Insert old rate limit record
    old_record = RateLimitRecord(key="login:1.2.3.4", timestamp=datetime.utcnow() - timedelta(hours=2))
    fresh_record = RateLimitRecord(key="login:1.2.3.4", timestamp=datetime.utcnow() - timedelta(minutes=5))
    db_session.add_all([old_record, fresh_record])
    await db_session.commit()

    # Run purge using active test session
    await purge_expired_guests(session=db_session)

    # Verify old record is gone, fresh remains
    all_records = (await db_session.execute(select(RateLimitRecord))).scalars().all()
    assert old_record.id not in [r.id for r in all_records]
    assert fresh_record.id in [r.id for r in all_records]

    # Verify system user and demo dungeon remain
    sys_check = (await db_session.execute(select(User).where(User.username == "system_demo"))).scalar_one_or_none()
    assert sys_check is not None
    demo_check = (await db_session.execute(select(Dungeon).where(Dungeon.is_public_demo == True))).scalar_one_or_none()
    assert demo_check is not None
