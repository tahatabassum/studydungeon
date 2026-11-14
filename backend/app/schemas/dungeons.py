from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class QuestionGameplayView(BaseModel):
    id: str
    prompt: str
    options: List[str]
    difficulty: str
    # Note: correct_option, explanation, and evidence_quote are NEVER included here


class DungeonRoomView(BaseModel):
    id: str
    room_number: int
    topic_name: str
    monster_name: str
    monster_type: str
    monster_hp: int
    is_boss: bool
    floor_id: Optional[str] = None
    monster_kind: Optional[str] = None
    questions: List[QuestionGameplayView]


class FloorTopicView(BaseModel):
    id: str
    title: str
    mastery: int = 0


class FloorBossView(BaseModel):
    id: str
    name: str
    hp: int
    kind: Optional[str] = None


class DungeonFloorView(BaseModel):
    id: str
    index: int
    title: str
    status: str = "available"  # locked, available, ready, generating, failed, cleared
    topics: List[FloorTopicView] = []
    boss: FloorBossView
    rank: Optional[str] = None
    room_ids: List[str]


class FinalBossView(BaseModel):
    id: str
    name: str
    hp: int
    unlocked: bool = False


class DungeonDetailView(BaseModel):
    id: str
    title: str
    is_public_demo: bool
    created_at: datetime
    rooms: List[DungeonRoomView]
    floors: Optional[List[DungeonFloorView]] = None
    final_boss: Optional[FinalBossView] = None


class DungeonSummary(BaseModel):
    id: str
    title: str
    is_public_demo: bool
    created_at: datetime
    rooms_count: int
