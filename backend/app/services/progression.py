"""Which rooms a run covers and what a finished run clears. Pure helpers plus one progress query.

Every endpoint that needs to know "the rooms of this run", "is this the run's boss", "did this run clear
a floor" or "is this dungeon conquered" uses these, so the run, the floor map and the pack list agree.
"""
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Dict, Iterable, List, Optional, Sequence, Set

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.all_models import DungeonRoom, GameRun

# Modes a client may ask for. None and "full" are the classic whole-dungeon run.
FLOOR_MODES = ("floor", "replay_floor")
PRACTICE_MODES = ("weak_topics", "exam")
HAUNT_MODE = "daily_haunt"
ALLOWED_MODES = (None, "full", *FLOOR_MODES, *PRACTICE_MODES, HAUNT_MODE)
FINAL_BOSS_ALIAS = "final_boss"
# Weak topics: how many rooms a run picks.
WEAK_TOPIC_ROOMS = 2
# Daily Haunt: at most this many due questions per run.
HAUNT_CAP = 8


def sorted_rooms(rooms: Iterable[DungeonRoom]) -> List[DungeonRoom]:
    return sorted(rooms, key=lambda r: r.room_order)


def floor_ids_in_order(rooms: Sequence[DungeonRoom]) -> List[str]:
    """Floor ids ordered by their first room (not alphabetically: 'f10' must come after 'f2')."""
    seen: List[str] = []
    for r in sorted_rooms(rooms):
        if r.floor_id and r.floor_id not in seen:
            seen.append(r.floor_id)
    return seen


def final_boss_room(rooms: Sequence[DungeonRoom]) -> Optional[DungeonRoom]:
    """The last room. In a floor dungeon it is the room outside every floor (the Final_Boss)."""
    ordered = sorted_rooms(rooms)
    if not ordered:
        return None
    if floor_ids_in_order(ordered):
        outside = [r for r in ordered if not r.floor_id]
        return outside[-1] if outside else None
    return ordered[-1]


def is_final_boss_target(floor_id: Optional[str], rooms: Sequence[DungeonRoom]) -> bool:
    # Only a floor dungeon has a separate Final_Boss run.
    if not floor_id or not floor_ids_in_order(rooms):
        return False
    fb = final_boss_room(rooms)
    return fb is not None and floor_id in (fb.id, FINAL_BOSS_ALIAS)


def rooms_for(mode: Optional[str], floor_id: Optional[str], room_ids: Optional[list], rooms: Sequence[DungeonRoom]) -> List[DungeonRoom]:
    """The rooms a run plays, in order. A Daily Haunt has none (it plays due questions, not rooms)."""
    ordered = sorted_rooms(rooms)
    if mode == HAUNT_MODE:
        return []
    if room_ids:
        wanted = set(room_ids)
        return [r for r in ordered if r.id in wanted]
    if floor_id:
        if not floor_ids_in_order(ordered):
            # No floors (a generated dungeon): the client shows one legacy floor, which is every room.
            return ordered
        if is_final_boss_target(floor_id, ordered):
            fb = final_boss_room(ordered)
            return [fb] if fb else []
        return [r for r in ordered if r.floor_id == floor_id]
    return ordered


def run_rooms(run: GameRun, rooms: Sequence[DungeonRoom]) -> List[DungeonRoom]:
    return rooms_for(run.mode, run.floor_id, run.room_ids, rooms)


def counts_for_progress(run: GameRun) -> bool:
    """Practice and review runs never clear floors, conquer dungeons or unlock packs."""
    return run.mode not in PRACTICE_MODES and run.mode != HAUNT_MODE


def is_full_run(run: GameRun, rooms: Sequence[DungeonRoom] = ()) -> bool:
    """A run over every room: no floor, or a floor id in a dungeon without floors."""
    if run.mode in PRACTICE_MODES or run.mode == HAUNT_MODE or run.room_ids:
        return False
    return not run.floor_id or not floor_ids_in_order(rooms)


@dataclass
class DungeonProgress:
    cleared_floor_ids: Set[str] = field(default_factory=set)
    final_boss_cleared: bool = False
    has_active_run: bool = False

    def floors_cleared(self, floor_ids: Sequence[str]) -> int:
        return sum(1 for f in floor_ids if f in self.cleared_floor_ids)


def progress_from_runs(runs: Iterable[GameRun], rooms: Sequence[DungeonRoom]) -> DungeonProgress:
    """What a player has cleared in one dungeon, from their runs there."""
    out = DungeonProgress()
    floor_ids = floor_ids_in_order(rooms)
    for run in runs:
        if run.status == "active":
            out.has_active_run = True
        if run.status != "completed" or not counts_for_progress(run):
            continue
        if is_full_run(run, rooms):
            out.cleared_floor_ids.update(floor_ids)
            out.final_boss_cleared = True
        elif is_final_boss_target(run.floor_id, rooms):
            out.final_boss_cleared = True
        elif run.floor_id:
            out.cleared_floor_ids.add(run.floor_id)
    # A dungeon without floors is conquered by its full run only (handled above).
    return out


async def load_progress(db: AsyncSession, user_id: str, dungeon_ids: Sequence[str]) -> Dict[str, DungeonProgress]:
    """Progress for each dungeon id (two queries, whatever the number of dungeons)."""
    if not dungeon_ids:
        return {}
    rooms_res = await db.execute(select(DungeonRoom).where(DungeonRoom.dungeon_id.in_(dungeon_ids)))
    rooms_by: Dict[str, List[DungeonRoom]] = {}
    for r in rooms_res.scalars().all():
        rooms_by.setdefault(r.dungeon_id, []).append(r)
    runs_res = await db.execute(
        select(GameRun).where(GameRun.user_id == user_id, GameRun.dungeon_id.in_(dungeon_ids))
    )
    runs_by: Dict[str, List[GameRun]] = {}
    for run in runs_res.scalars().all():
        runs_by.setdefault(run.dungeon_id, []).append(run)
    return {d: progress_from_runs(runs_by.get(d, []), rooms_by.get(d, [])) for d in dungeon_ids}


def next_daily_streak(current: int, last_on: Optional[datetime], now: datetime) -> int:
    """Daily Haunt streak after finishing one at `now` (UTC days): same day keeps it, the next day adds one."""
    today: date = now.date()
    if last_on is None:
        return 1
    last: date = last_on.date()
    if last == today:
        return max(1, current)
    if last == today - timedelta(days=1):
        return current + 1
    return 1


def visible_daily_streak(current: int, last_on: Optional[datetime], now: datetime) -> int:
    """The streak as shown: it is lost once a whole UTC day passes without a Daily Haunt."""
    if last_on is None:
        return 0
    return current if last_on.date() >= now.date() - timedelta(days=1) else 0


def xp_to_next_level(level: int, total_xp: int) -> int:
    """Level curve used at finish: total XP of 100 x level reaches level + 1."""
    return max(0, 100 * level - total_xp)
