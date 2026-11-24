import time
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user_optional
from app.models.all_models import (
    Attempt,
    PlayerStats,
    PlayerWeekStats,
    PointEvent,
    User,
    UserProgress,
)
from app.schemas.leaderboard import (
    BoardEntryView,
    BoardMeView,
    LeaderboardResponse,
    NextAboveView,
    PlayerStatsSummaryResponse,
    Top20View,
    WeekWindowView,
)
from app.services.points import get_current_week_start

leaderboard_router = APIRouter(tags=["leaderboard"])

# In-memory caches
_LEADERBOARD_SNAPSHOT_CACHE = {}  # key: (board, period, week_start_str) -> (snapshot_dict, updated_at, next_refresh_at)
_STATS_PLAYERS_CACHE = {"data": None, "expires_at": 0.0}


def _public_handle(u: User, public_id: str) -> str:
    """Name#Tag, else the opaque public id. Never the login name (leaderboard rule: no usernames)."""
    if u.display_name and u.tag:
        return f"{u.display_name}#{u.tag}"
    return public_id


@leaderboard_router.get(
    "/leaderboard",
    response_model=LeaderboardResponse,
)
async def get_leaderboard(
    response: Response,
    board: str = Query("overall", pattern="^(preloaded|own_notes|overall)$"),
    period: str = Query("all", pattern="^(all|week)$"),
    user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.utcnow()
    week_start = get_current_week_start(now)
    week_start_str = week_start.strftime("%Y-%m-%d")
    cache_key = (board, period, week_start_str)

    cache_entry = _LEADERBOARD_SNAPSHOT_CACHE.get(cache_key)
    need_refresh = True
    if cache_entry:
        _entries, _updated_at, cached_next_refresh_at, _total = cache_entry
        if now < cached_next_refresh_at:
            need_refresh = False

    if need_refresh:
        # Recompute top 20
        if period == "all":
            pts_col = getattr(PlayerStats, f"points_{board}")
            reached_col = getattr(PlayerStats, f"reached_at_{board}")
            stmt = (
                select(PlayerStats, User, UserProgress)
                .join(User, PlayerStats.user_id == User.id)
                .outerjoin(UserProgress, User.id == UserProgress.user_id)
                .where(
                    PlayerStats.is_ranked == True,
                    pts_col > 0,
                    User.is_active == True,
                )
                .order_by(pts_col.desc(), reached_col.asc(), PlayerStats.public_id.asc())
                .limit(20)
            )
            count_stmt = select(func.count()).select_from(PlayerStats).where(
                PlayerStats.is_ranked == True,
                pts_col > 0,
            )
        else:
            pts_col = getattr(PlayerWeekStats, f"points_{board}")
            reached_col = getattr(PlayerWeekStats, f"reached_at_{board}")
            stmt = (
                select(PlayerWeekStats, User, UserProgress)
                .join(User, PlayerWeekStats.user_id == User.id)
                .outerjoin(UserProgress, User.id == UserProgress.user_id)
                .where(
                    PlayerWeekStats.is_ranked == True,
                    PlayerWeekStats.week_start == week_start,
                    pts_col > 0,
                    User.is_active == True,
                )
                .order_by(pts_col.desc(), reached_col.asc(), PlayerWeekStats.public_id.asc())
                .limit(20)
            )
            count_stmt = select(func.count()).select_from(PlayerWeekStats).where(
                PlayerWeekStats.is_ranked == True,
                PlayerWeekStats.week_start == week_start,
                pts_col > 0,
            )

        res = await db.execute(stmt)
        rows = res.all()
        total_ranked = (await db.execute(count_stmt)).scalar_one()

        entries = []
        for rank_idx, (stats_row, u, up) in enumerate(rows, start=1):
            handle = _public_handle(u, stats_row.public_id)
            points_val = getattr(stats_row, f"points_{board}")
            entries.append(
                BoardEntryView(
                    rank=rank_idx,
                    public_id=stats_row.public_id,
                    handle=handle,
                    display_name=u.display_name,
                    tag=u.tag,
                    is_guest=u.is_guest,
                    level=up.level if up else 1,
                    points=points_val,
                    rooms_cleared=stats_row.rooms_cleared,
                    badge_ids=[],
                )
            )

        updated_at = now
        next_refresh_at = now + timedelta(seconds=max(10, settings.LEADERBOARD_SNAPSHOT_SECONDS))
        _LEADERBOARD_SNAPSHOT_CACHE[cache_key] = (entries, updated_at, next_refresh_at, total_ranked)
    else:
        entries, updated_at, next_refresh_at, total_ranked = _LEADERBOARD_SNAPSHOT_CACHE[cache_key]

    # Compute live 'me' block
    me_view = None
    if user:
        response.headers["Cache-Control"] = "private, no-store"
        # Determine player points
        if period == "all":
            ps_res = await db.execute(select(PlayerStats).where(PlayerStats.user_id == user.id))
            p_stat = ps_res.scalar_one_or_none()
        else:
            pws_res = await db.execute(
                select(PlayerWeekStats).where(
                    PlayerWeekStats.user_id == user.id, PlayerWeekStats.week_start == week_start
                )
            )
            p_stat = pws_res.scalar_one_or_none()

        my_points = getattr(p_stat, f"points_{board}", 0) if p_stat else 0
        my_reached = getattr(p_stat, f"reached_at_{board}", now) if p_stat else now
        my_public_id = user.public_id or f"p_{user.id[:8]}"
        my_handle = _public_handle(user, my_public_id)

        if my_points == 0:
            top20_cutoff = entries[-1].points if len(entries) >= 20 else 0
            needed = (top20_cutoff - my_points + 1) if len(entries) >= 20 else 1
            me_view = BoardMeView(
                live=True,
                public_id=my_public_id,
                handle=my_handle,
                rank=None,
                points=0,
                next_above=None,
                top20=Top20View(in_top20=False, cutoff_points=top20_cutoff, points_needed=needed),
                reason="no_points_yet",
            )
        else:
            # Query rank: count players with higher points or tie-break
            tbl = PlayerStats if period == "all" else PlayerWeekStats
            pts_c = getattr(tbl, f"points_{board}")
            rch_c = getattr(tbl, f"reached_at_{board}")

            base_filter = [tbl.is_ranked == True, pts_c > 0]
            if period == "week":
                base_filter.append(tbl.week_start == week_start)

            higher_filter = (
                (pts_c > my_points)
                | ((pts_c == my_points) & (rch_c < my_reached))
                | ((pts_c == my_points) & (rch_c == my_reached) & (tbl.public_id < my_public_id))
            )
            my_rank = (
                await db.execute(select(func.count()).select_from(tbl).where(*base_filter, higher_filter))
            ).scalar_one() + 1

            # Find next above
            next_above = None
            if my_rank > 1:
                above_res = await db.execute(
                    select(tbl, User)
                    .join(User, tbl.user_id == User.id)
                    .where(*base_filter, higher_filter)
                    .order_by(pts_c.asc(), rch_c.desc(), tbl.public_id.desc())
                    .limit(1)
                )
                above_row = above_res.first()
                if above_row:
                    ab_stat, ab_user = above_row
                    ab_pts = getattr(ab_stat, f"points_{board}")
                    ab_handle = _public_handle(ab_user, ab_stat.public_id)
                    next_above = NextAboveView(
                        rank=my_rank - 1,
                        handle=ab_handle,
                        points=ab_pts,
                        points_needed=max(1, ab_pts - my_points + 1),
                    )

            in_top20 = my_rank <= 20
            top20_cutoff = entries[-1].points if len(entries) >= 20 else 0
            pts_needed = 0 if in_top20 else (top20_cutoff - my_points + 1)
            me_view = BoardMeView(
                live=True,
                public_id=my_public_id,
                handle=my_handle,
                rank=my_rank,
                points=my_points,
                next_above=next_above,
                top20=Top20View(in_top20=in_top20, cutoff_points=top20_cutoff, points_needed=max(0, pts_needed)),
            )
    else:
        response.headers["Cache-Control"] = "public, max-age=60"

    week_window = None
    if period == "week":
        next_monday = week_start + timedelta(days=7)
        week_window = WeekWindowView(
            timezone="UTC",
            starts_at=week_start.isoformat() + "Z",
            resets_at=next_monday.isoformat() + "Z",
        )

    return LeaderboardResponse(
        board=board,
        period=period,
        week=week_window,
        updated_at=updated_at.isoformat() + "Z",
        next_refresh_at=next_refresh_at.isoformat() + "Z",
        total_ranked_players=total_ranked,
        entries=entries,
        me=me_view,
    )


@leaderboard_router.get(
    "/stats/players",
    response_model=PlayerStatsSummaryResponse,
    response_model_exclude_none=True,
)
async def get_player_stats(
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    now_ts = time.time()
    cache = _STATS_PLAYERS_CACHE
    if cache["data"] and now_ts < cache["expires_at"]:
        response.headers["Cache-Control"] = "public, max-age=300"
        return cache["data"]

    # Count players with rooms_cleared > 0 and not test/system
    p_count = (
        await db.execute(
            select(func.count(PlayerStats.user_id)).where(
                PlayerStats.is_ranked == True,
                PlayerStats.rooms_cleared > 0,
            )
        )
    ).scalar_one()

    # Total rooms cleared
    rooms_total = (
        await db.execute(
            select(func.coalesce(func.sum(PlayerStats.rooms_cleared), 0)).where(
                PlayerStats.is_ranked == True
            )
        )
    ).scalar_one()

    # Answers total
    ans_total = (await db.execute(select(func.count(Attempt.id)))).scalar_one()

    # Packs completed total
    packs_total = (
        await db.execute(
            select(func.count(PointEvent.id)).where(PointEvent.reason == "pack_complete")
        )
    ).scalar_one()

    now_dt = datetime.utcnow()
    res_data = PlayerStatsSummaryResponse(
        players=p_count,
        rooms_cleared_total=rooms_total,
        answers_total=ans_total,
        packs_completed_total=packs_total,
        updated_at=now_dt.isoformat() + "Z",
        cache_seconds=300.0,
    )

    _STATS_PLAYERS_CACHE["data"] = res_data
    _STATS_PLAYERS_CACHE["expires_at"] = now_ts + 300.0

    response.headers["Cache-Control"] = "public, max-age=300"
    return res_data

