from datetime import datetime, timedelta
from typing import Tuple

WEAPON_BASE_DAMAGE = {
    "Rusty Dagger": 20,
    "Arcane Staff": 25,
    "Hunter Crossbow": 30,
    "Spectral Hammer": 35,
    "Flame Sigil": 40,
}

MONSTER_COUNTER_DAMAGE = 10
BOSS_COUNTER_DAMAGE = 12

WEAPON_UNLOCK_RULES = {
    "Rusty Dagger": lambda level, xp, cleared_rooms, boss_cleared: True,
    "Arcane Staff": lambda level, xp, cleared_rooms, boss_cleared: xp >= 100,
    "Hunter Crossbow": lambda level, xp, cleared_rooms, boss_cleared: cleared_rooms >= 2,
    "Spectral Hammer": lambda level, xp, cleared_rooms, boss_cleared: level >= 3,
    "Flame Sigil": lambda level, xp, cleared_rooms, boss_cleared: boss_cleared >= 1,
}


def is_weapon_unlocked(weapon_name: str, level: int = 1, xp: int = 0, cleared_rooms: int = 0, boss_cleared: int = 0) -> bool:
    if weapon_name not in WEAPON_UNLOCK_RULES:
        return False
    rule = WEAPON_UNLOCK_RULES[weapon_name]
    return rule(level, xp, cleared_rooms, boss_cleared)


def calculate_combat_damage(
    weapon_name: str,
    difficulty: str,
    current_streak: int,
    is_correct: bool,
    is_boss: bool = False,
) -> Tuple[int, int, bool]:
    """
    Returns (damage_dealt_to_monster, damage_taken_by_player, is_critical)
    """
    if not is_correct:
        player_damage = BOSS_COUNTER_DAMAGE if is_boss else MONSTER_COUNTER_DAMAGE
        return 0, player_damage, False

    base_damage = WEAPON_BASE_DAMAGE.get(weapon_name, 20)
    damage = float(base_damage)

    # Hard multiplier
    if difficulty.lower() == "hard":
        damage *= 1.25

    # Critical hit if streak reaches 3 in a row
    is_critical = False
    if current_streak >= 2:  # current answer will be 3rd in a row
        damage *= 1.50
        is_critical = True

    return int(round(damage)), 0, is_critical


def calculate_next_review_interval(current_repetition: int, is_correct: bool, marked_hard: bool = False) -> Tuple[int, float, datetime]:
    """
    Simplified SM-2 Spaced Repetition calculation
    Returns (new_repetition, interval_days, next_due_datetime)
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
