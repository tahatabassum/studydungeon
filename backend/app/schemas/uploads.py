from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class QuotaPlayerView(BaseModel):
    is_guest: bool
    used_today: int
    limit_today: int
    stored: int
    stored_limit: int
    resets_at: Optional[str] = None
    # True when no daily or stored limit applies (limit_today and stored_limit are then 0).
    unlimited: bool = False


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
    # global is a Python keyword: the field is global_ in code and "global" on the wire (the contract key).
    global_: Optional[QuotaGlobalView] = Field(default=None, alias="global")
    ranking: Optional[QuotaRankingView] = None

