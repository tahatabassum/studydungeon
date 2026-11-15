from typing import List, Optional

from pydantic import BaseModel


class BoardEntryView(BaseModel):
    rank: int
    public_id: str
    handle: str
    display_name: Optional[str] = None
    tag: Optional[str] = None
    is_guest: bool
    level: int
    points: int
    rooms_cleared: int
    badge_ids: Optional[List[str]] = None


class NextAboveView(BaseModel):
    rank: int
    handle: str
    points: int
    points_needed: int


class Top20View(BaseModel):
    in_top20: bool
    cutoff_points: int
    points_needed: int


class BoardMeView(BaseModel):
    live: bool = True
    public_id: Optional[str] = None
    handle: Optional[str] = None
    rank: Optional[int] = None
    points: int = 0
    next_above: Optional[NextAboveView] = None
    top20: Top20View
    reason: Optional[str] = None


class WeekWindowView(BaseModel):
    timezone: str
    starts_at: str
    resets_at: str


class LeaderboardResponse(BaseModel):
    board: str
    period: str
    week: Optional[WeekWindowView] = None
    updated_at: str
    next_refresh_at: str
    total_ranked_players: Optional[int] = None
    entries: List[BoardEntryView]
    me: Optional[BoardMeView] = None


class PlayerStatsSummaryResponse(BaseModel):
    players: int
    rooms_cleared_total: Optional[int] = None
    answers_total: Optional[int] = None
    packs_completed_total: Optional[int] = None
    updated_at: Optional[str] = None
    cache_seconds: Optional[float] = None

