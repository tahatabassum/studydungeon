from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class StartRunRequest(BaseModel):
    dungeon_id: str


class AttemptRequest(BaseModel):
    attempt_id: str
    question_id: str
    selected_answer: str
    weapon_name: str = "Rusty Dagger"


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


class RunSummaryResponse(BaseModel):
    id: str
    score: int
    xp_earned: int
    correct_count: int
    total_attempts: int
    accuracy: float
    mastery_band: str  # Weak, Learning, Strong
    status: str
