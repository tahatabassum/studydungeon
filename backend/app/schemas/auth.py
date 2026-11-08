import unicodedata
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class UserRegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=32)
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("username")
    @classmethod
    def validate_and_normalize_username(cls, v: str) -> str:
        # Unicode NFKC normalization
        normalized = unicodedata.normalize("NFKC", v).strip().lower()
        if len(normalized) < 3 or len(normalized) > 32:
            raise ValueError("Username must be between 3 and 32 characters after normalization")
        if normalized.startswith("guest_"):
            raise ValueError("Usernames starting with 'guest_' are reserved for demo guest accounts")
        if normalized in ("system", "system_demo") or normalized.startswith("system_"):
            raise ValueError("Usernames starting with 'system' or 'system_' are reserved for system services")
        if not normalized.replace("_", "").isalnum():
            raise ValueError("Username must contain only alphanumeric characters and underscores")
        return normalized


class UserLoginRequest(BaseModel):
    username: str = Field(..., max_length=128)
    password: str = Field(..., max_length=128)

    @field_validator("username")
    @classmethod
    def normalize_login_username(cls, v: str) -> str:
        return unicodedata.normalize("NFKC", v).strip().lower()


class UserResponse(BaseModel):
    id: str
    username: str
    is_guest: bool
    created_at: datetime
    expires_at: Optional[datetime] = None


class DemoSessionResponse(BaseModel):
    user: UserResponse
    dungeon_id: str
    expires_at: datetime
