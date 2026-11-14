from typing import List, Optional
from pydantic import BaseModel


class PackItem(BaseModel):
    id: str
    order: int
    title: str
    description: str
    dungeon_id: str
    floors_total: int
    floors_cleared: int = 0
    final_boss_cleared: bool = False
    status: str  # locked, available, in_progress, completed
    points_earned: int = 0


class PacksResponse(BaseModel):
    packs: List[PackItem]
    next_pack_id: Optional[str] = None
    all_completed: bool = False


class PackProgressView(BaseModel):
    pack_id: str
    status: str
    unlocked_pack_id: Optional[str] = None
    all_completed: bool = False

