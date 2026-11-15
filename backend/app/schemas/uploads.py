from typing import Optional
from pydantic import BaseModel, ConfigDict


class QuotaPlayerView(BaseModel):
    is_guest: bool
    used_today: int
    limit_today: int
    stored: int
    stored_limit: int
    resets_at: Optional[str] = None


class QuotaGlobalView(BaseModel):
    available: bool = True


class QuotaRankingView(BaseModel):
    min_chars: int = 3000
    min_topics: int = 2


class UploadQuotaResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    can_upload: bool
    reason: Optional[str] = None
    player: QuotaPlayerView
    global_: Optional[QuotaGlobalView] = None
    ranking: Optional[QuotaRankingView] = None

