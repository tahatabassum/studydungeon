from datetime import datetime, timedelta
from typing import Tuple


def calculate_next_review_interval(
    current_repetition: int,
    is_correct: bool,
    marked_hard: bool = False,
) -> Tuple[int, float, datetime]:
    """
    Simplified SM-2 Spaced Repetition calculation.
    Returns (new_repetition, interval_days, next_due_datetime).
    Guarantees non-negative repetition and positive future timestamp.
    """
    safe_rep = max(0, current_repetition)
    now = datetime.utcnow()
    if not is_correct:
        # 10 minutes interval, reset repetition streak
        return 0, 10 / 1440, now + timedelta(minutes=10)

    if marked_hard:
        return safe_rep + 1, 1.0, now + timedelta(days=1)

    rep = safe_rep + 1
    if rep == 1:
        interval = 3.0
    elif rep == 2:
        interval = 7.0
    elif rep == 3:
        interval = 14.0
    else:
        interval = 30.0

    return rep, interval, now + timedelta(days=interval)

