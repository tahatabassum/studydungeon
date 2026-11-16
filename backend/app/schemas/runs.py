from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class StartRunRequest(BaseModel):
    dungeon_id: str
    floor_id: Optional[str] = None
    mode: Optional[str] = None


class AttemptRequest(BaseModel):
    attempt_id: str
    question_id: str
    selected_answer: str
    weapon_name: str = "Rusty Dagger"


class PlayerPointsView(BaseModel):
    preloaded: int
    own_notes: int
    overall: int


class AttemptResponse(BaseModel):
    attempt_id: str
    is_correct: bool
    damage_dealt: int
    damage_taken: int
    is_critical: bool
    current_hp: int
    current_score: int
    current_streak: int
    monster_hp_remaining: int
    explanation: Optional[str] = None
    evidence_quote: Optional[str] = None
    points_awarded: Optional[int] = None
    points_reason: Optional[str] = None
    points_bonus: Optional[int] = None
    player_points: Optional[PlayerPointsView] = None
    correct_answer: Optional[str] = None
    combo: Optional[int] = None
    requeue_after: Optional[int] = None
    is_retry: Optional[bool] = None
    retry_multiplier: Optional[float] = None


class RunRoomState(BaseModel):
    room_id: str
    room_number: int
    topic_name: str
    monster_name: str
    monster_max_hp: int
    monster_current_hp: int
    is_cleared: bool
    is_boss: bool


class RunDetailResponse(BaseModel):
    id: str
    dungeon_id: str
    current_hp: int
    current_score: int
    current_streak: int
    xp_earned: int
    status: str  # active, completed, defeated
    started_at: datetime
    rooms: List[RunRoomState]
    room_ids: Optional[List[str]] = None
    floor_id: Optional[str] = None
    mode: Optional[str] = None


class ClearRoomResponse(BaseModel):
    xp_delta: int
    success: Optional[bool] = True
    room_id: Optional[str] = None
    is_cleared: Optional[bool] = True
    is_boss: Optional[bool] = None
    points_awarded: Optional[int] = None
    points_reason: Optional[str] = None


class RunSummaryResponse(BaseModel):
    id: str
    score: int
    xp_earned: int
    correct_count: int
    total_attempts: int
    accuracy: float
    mastery_band: str  # Weak, Learning, Strong
    status: str
    points_earned: Optional[int] = None
    player_points: Optional[PlayerPointsView] = None
    pack_progress: Optional[dict] = None
    floor_rank: Optional[str] = None
    mastery_by_topic: Optional[List[dict]] = None
    chest_rewards: Optional[List[dict]] = None
