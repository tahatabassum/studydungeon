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
    public_id: Optional[str] = None
    username: Optional[str] = None
    display_name: Optional[str] = None
    tag: Optional[str] = None
    handle: Optional[str] = None
    is_guest: bool
    created_at: datetime
    expires_at: Optional[datetime] = None


class DemoSessionResponse(BaseModel):
    user: UserResponse
    dungeon_id: str
    expires_at: datetime


class GuestNameCheckRequest(BaseModel):
    display_name: str


class GuestNameCheckResponse(BaseModel):
    ok: bool
    display_name: Optional[str] = None
    reason: Optional[str] = None
    message: Optional[str] = None


class CreateGuestRequest(BaseModel):
    display_name: str
    accept_public_notice: bool = Field(..., description="Must accept public notice")


class CreateGuestResponse(BaseModel):
    user: UserResponse
    dungeon_id: Optional[str] = None
    notice_version: str


class UpgradeGuestRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=32)
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("username")
    @classmethod
    def validate_and_normalize_username(cls, v: str) -> str:
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


class DeleteAccountRequest(BaseModel):
    confirm: Optional[str] = Field(None, description="Optional 'DELETE' confirmation string")

