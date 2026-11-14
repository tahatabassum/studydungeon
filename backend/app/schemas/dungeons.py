from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, model_serializer


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
    status: str = "locked"  # ready, locked, cleared, generating, failed (frontend floorSchema)
    topics: List[FloorTopicView] = []
    boss: FloorBossView
    rank: Optional[str] = None
    room_ids: List[str]

    @model_serializer(mode="wrap")
    def _keep_rank(self, handler):
        # The detail route drops None fields, but the frontend contract needs rank present (null before a clear).
        data = handler(self)
        data.setdefault("rank", self.rank)
        return data


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
