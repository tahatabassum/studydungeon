import logging
from datetime import datetime, timedelta
from typing import Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.all_models import (
    ContentPack,
    Dungeon,
    DungeonRoom,
    GameRun,
    PlayerStats,
    PlayerWeekStats,
    PointEvent,
    User,
)

logger = logging.getLogger("studydungeon.points")


def get_current_week_start(now: Optional[datetime] = None) -> datetime:
    """Returns Monday 00:00:00 UTC for the current week."""
    if now is None:
        now = datetime.utcnow()
    # Monday is weekday 0
    days_since_monday = now.weekday()
    monday = now - timedelta(days=days_since_monday)
    return datetime(monday.year, monday.month, monday.day, 0, 0, 0)


async def get_or_create_player_stats(
    user: User, db: AsyncSession
) -> Tuple[PlayerStats, PlayerWeekStats]:
    """Retrieves or initializes PlayerStats and PlayerWeekStats for current week in a single query."""
    week_start = get_current_week_start()
    week_pk = f"{user.id}:{week_start.strftime('%Y-%m-%d')}"

    stmt = (
        select(PlayerStats, PlayerWeekStats)
        .outerjoin(PlayerWeekStats, PlayerWeekStats.id == week_pk)
        .where(PlayerStats.user_id == user.id)
    )
    res = await db.execute(stmt)
    row = res.first()
    ps = row[0] if row else None
    pws = row[1] if row else None

    public_id = user.public_id or f"p_{user.id[:8]}"
    now = datetime.utcnow()

    if not ps:
        ps = PlayerStats(
            user_id=user.id,
            public_id=public_id,
            points_preloaded=0,
            points_own_notes=0,
            points_overall=0,
            reached_at_preloaded=now,
            reached_at_own_notes=now,
            reached_at_overall=now,
            rooms_cleared=0,
            is_ranked=not (user.is_test or user.is_system),
        )
        db.add(ps)

    if not pws:
        if ps is None:
            pws_res = await db.execute(select(PlayerWeekStats).where(PlayerWeekStats.id == week_pk))
            pws = pws_res.scalar_one_or_none()

        if not pws:
            pws = PlayerWeekStats(
                id=week_pk,
                user_id=user.id,
                week_start=week_start,
                public_id=public_id,
                points_preloaded=0,
                points_own_notes=0,
                points_overall=0,
                reached_at_preloaded=now,
                reached_at_own_notes=now,
                reached_at_overall=now,
                rooms_cleared=0,
                is_ranked=not (user.is_test or user.is_system),
            )
            db.add(pws)

    return ps, pws


async def award_attempt_points(
    user: User,
    run: GameRun,
    dungeon: Dungeon,
    question_id: str,
    attempt_id: str,
    is_correct: bool,
    difficulty: str,
    duration_ms: int,
    db: AsyncSession,
) -> Tuple[int, str, int, dict]:
    """
    Evaluates and records points for an attempt.
    Returns (points_awarded, points_reason, points_bonus, player_points_dict).
    """
    ps, pws = await get_or_create_player_stats(user, db)

    # Determine board
    is_preloaded = dungeon.is_public_demo or getattr(dungeon, "pack", None) is not None
    if not is_preloaded:
        cp_res = await db.execute(select(ContentPack.id).where(ContentPack.dungeon_id == dungeon.id).limit(1))
        is_preloaded = cp_res.scalar_one_or_none() is not None
    board = "preloaded" if is_preloaded else "own_notes"

    now = datetime.utcnow()
    week_start = get_current_week_start(now)

    if not is_correct:
        return 0, "wrong", 0, {
            "preloaded": ps.points_preloaded,
            "own_notes": ps.points_own_notes,
            "overall": ps.points_overall,
        }

    # 1. Anti-cheat / too fast check
    is_too_fast = duration_ms < settings.MIN_ANSWER_MS and duration_ms > 0

    # 2. Check if first correct in current week
    fc_res = await db.execute(
        select(PointEvent.id).where(
            PointEvent.user_id == user.id,
            PointEvent.question_id == question_id,
            PointEvent.week_start == week_start,
            PointEvent.reason.in_(["first_correct", "too_fast"]),
        ).limit(1)
    )
    already_answered_week = fc_res.scalar_one_or_none() is not None

    if already_answered_week:
        base_points = 10
        reason = "repeat_correct"
    else:
        diff_str = (difficulty or "medium").lower()
        base_points = 150 if diff_str == "hard" else 100
        reason = "first_correct"

    if is_too_fast:
        base_points = max(1, int(base_points * 0.25))
        reason = "too_fast"

    # Streak bonus (+25 every 3rd consecutive correct in this run)
    points_bonus = 0
    # Note: run.current_streak is updated during combat
    if run.current_streak > 0 and run.current_streak % 3 == 0 and not is_too_fast:
        points_bonus = 25

    total_award = base_points + points_bonus

    # Record event
    event = PointEvent(
        user_id=user.id,
        attempt_id=attempt_id,
        run_id=run.id,
        board=board,
        reason=reason,
        points=total_award,
        week_start=week_start,
        created_at=now,
        question_id=question_id,
    )
    db.add(event)

    # Update player stats
    if board == "preloaded":
        ps.points_preloaded += total_award
        pws.points_preloaded += total_award
        ps.reached_at_preloaded = now
        pws.reached_at_preloaded = now
    else:
        ps.points_own_notes += total_award
        pws.points_own_notes += total_award
        ps.reached_at_own_notes = now
        pws.reached_at_own_notes = now

    ps.points_overall += total_award
    pws.points_overall += total_award
    ps.reached_at_overall = now
    pws.reached_at_overall = now

    # Updates will commit with the attempt transaction in db.commit()
    return total_award, reason, points_bonus, {
        "preloaded": ps.points_preloaded,
        "own_notes": ps.points_own_notes,
        "overall": ps.points_overall,
    }


async def award_room_clear_points(
    user: User,
    run: GameRun,
    dungeon: Dungeon,
    room: DungeonRoom,
    db: AsyncSession,
) -> Tuple[int, str]:
    """
    Awards room clear points (50 for normal, 200 for floor/final boss) once per week.
    Returns (points_awarded, points_reason).
    """
    ps, pws = await get_or_create_player_stats(user, db)

    is_preloaded = dungeon.is_public_demo or (
        await db.execute(select(ContentPack.id).where(ContentPack.dungeon_id == dungeon.id))
    ).scalar_one_or_none() is not None
    board = "preloaded" if is_preloaded else "own_notes"

    now = datetime.utcnow()
    week_start = get_current_week_start(now)

    is_boss = room.is_boss or (room.floor_id is None and "boss" in (room.monster_kind or "").lower())
    reason = "boss_clear" if is_boss else "room_clear"
    target_points = 200 if is_boss else 50

    # Check once per week
    ev_res = await db.execute(
        select(PointEvent.id).where(
            PointEvent.user_id == user.id,
            PointEvent.room_id == room.id,
            PointEvent.week_start == week_start,
            PointEvent.reason == reason,
        ).limit(1)
    )
    already_cleared = ev_res.scalar_one_or_none() is not None

    # Track total rooms cleared by player (for player stats / counter)
    ps.rooms_cleared += 1
    pws.rooms_cleared += 1

    if already_cleared:
        await db.flush()
        return 0, reason

    event = PointEvent(
        user_id=user.id,
        attempt_id=None,
        run_id=run.id,
        board=board,
        reason=reason,
        points=target_points,
        week_start=week_start,
        created_at=now,
        room_id=room.id,
    )
    db.add(event)

    if board == "preloaded":
        ps.points_preloaded += target_points
        pws.points_preloaded += target_points
        ps.reached_at_preloaded = now
        pws.reached_at_preloaded = now
    else:
        ps.points_own_notes += target_points
        pws.points_own_notes += target_points
        ps.reached_at_own_notes = now
        pws.reached_at_own_notes = now

    ps.points_overall += target_points
    pws.points_overall += target_points
    ps.reached_at_overall = now
    pws.reached_at_overall = now

    await db.flush()
    return target_points, reason


async def award_pack_completion_points(
    user: User,
    run: GameRun,
    pack_id: str,
    db: AsyncSession,
) -> int:
    """
    Awards 500 points for first-time completion of a pack.
    Returns points awarded (500 or 0).
    """
    ps, pws = await get_or_create_player_stats(user, db)
    now = datetime.utcnow()
    week_start = get_current_week_start(now)

    # Check if pack ever completed
    ev_res = await db.execute(
        select(PointEvent.id).where(
            PointEvent.user_id == user.id,
            PointEvent.pack_id == pack_id,
            PointEvent.reason == "pack_complete",
        ).limit(1)
    )
    if ev_res.scalar_one_or_none() is not None:
        return 0

    points = 500
    event = PointEvent(
        user_id=user.id,
        attempt_id=None,
        run_id=run.id,
        board="preloaded",
        reason="pack_complete",
        points=points,
        week_start=week_start,
        created_at=now,
        pack_id=pack_id,
    )
    db.add(event)

    ps.points_preloaded += points
    pws.points_preloaded += points
    ps.points_overall += points
    pws.points_overall += points
    ps.reached_at_preloaded = now
    pws.reached_at_preloaded = now
    ps.reached_at_overall = now
    pws.reached_at_overall = now

    await db.flush()
    return points

