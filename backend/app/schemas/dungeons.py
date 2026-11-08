from datetime import datetime
from typing import List

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
    questions: List[QuestionGameplayView]


class DungeonDetailView(BaseModel):
    id: str
    title: str
    is_public_demo: bool
    created_at: datetime
    rooms: List[DungeonRoomView]


class DungeonSummary(BaseModel):
    id: str
    title: str
    is_public_demo: bool
    created_at: datetime
    rooms_count: int
