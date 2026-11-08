import pytest
from httpx import AsyncClient
from hypothesis import given
from hypothesis import strategies as st

from app.core.config import settings
from app.services.srs import calculate_next_review_interval


# ========================================================
# FIX (c): Block registering usernames starting with "guest_"
# ========================================================
@pytest.mark.asyncio
async def test_reserved_guest_prefix_rejected(async_client: AsyncClient):
    """
    Usernames starting with 'guest_' are strictly reserved for demo guest accounts.
    Registration attempts must be rejected with 422 VALIDATION_ERROR.
    """
    res1 = await async_client.post(
        "/auth/register",
        json={"username": "guest_attacker", "password": "securepassword123"},
    )
    assert res1.status_code == 422
    data = res1.json()
    assert data["detail"]["code"] == "VALIDATION_ERROR"

    # Also test case variations (e.g. GUEST_hero)
    res2 = await async_client.post(
        "/auth/register",
        json={"username": "GUEST_hero", "password": "securepassword123"},
    )
    assert res2.status_code == 422


# ========================================================
# FIX (d): Fixed Ladder SRS Rules (game-design.md)
# ========================================================
def test_srs_fixed_ladder_exact_intervals():
    """
    game-design.md exact ladder:
    - Wrong: 10 minutes (~0.00694 days), streak reset to 0
    - Difficult correct: 1 day, streak = current + 1
    - 1st Normal correct: 3 days, streak = 1
    - 2nd Normal correct: 7 days, streak = 2
    - 3rd Normal correct: 14 days, streak = 3
    - 4th+ Normal correct: 30 days, streak = 4+
    """
    # 1. Wrong answer: resets streak to 0, 10 minutes interval
    streak, interval, due = calculate_next_review_interval(current_repetition=5, is_correct=False)
    assert streak == 0
    assert abs(interval - (10 / 1440)) < 1e-5

    # 2. Difficult correct: 1 day interval
    streak, interval, due = calculate_next_review_interval(current_repetition=2, is_correct=True, marked_hard=True)
    assert streak == 3
    assert interval == 1.0

    # 3. Normal correct progression
    streak, interval, due = calculate_next_review_interval(current_repetition=0, is_correct=True, marked_hard=False)
    assert streak == 1
    assert interval == 3.0

    streak, interval, due = calculate_next_review_interval(current_repetition=1, is_correct=True, marked_hard=False)
    assert streak == 2
    assert interval == 7.0

    streak, interval, due = calculate_next_review_interval(current_repetition=2, is_correct=True, marked_hard=False)
    assert streak == 3
    assert interval == 14.0

    streak, interval, due = calculate_next_review_interval(current_repetition=3, is_correct=True, marked_hard=False)
    assert streak == 4
    assert interval == 30.0

    streak, interval, due = calculate_next_review_interval(current_repetition=10, is_correct=True, marked_hard=False)
    assert streak == 11
    assert interval == 30.0


@given(
    streak=st.integers(min_value=0, max_value=50),
    marked_hard=st.booleans(),
)
def test_pbt_srs_ladder_monotonicity(streak, marked_hard):
    """
    For any correct streak, the interval must strictly follow the game-design.md ladder
    and be in {1.0, 3.0, 7.0, 14.0, 30.0}.
    """
    new_streak, interval, due = calculate_next_review_interval(
        current_repetition=streak,
        is_correct=True,
        marked_hard=marked_hard,
    )
    assert new_streak == streak + 1
    if marked_hard:
        assert interval == 1.0
    else:
        assert interval in (3.0, 7.0, 14.0, 30.0)


# ========================================================
# FIX (e): GEMINI_MODEL setting in config
# ========================================================
def test_gemini_model_config_exists():
    assert hasattr(settings, "GEMINI_MODEL")
    assert isinstance(settings.GEMINI_MODEL, str)
    assert len(settings.GEMINI_MODEL) > 0
