from typing import List, Optional

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "StudyDungeon Backend API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./studydungeon.db"

    # Security & Proxies
    DEBUG: bool = False
    SECRET_KEY: str = "studydungeon-default-insecure-secret-key-change-in-prod"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    SESSION_COOKIE_NAME: str = "studydungeon_session"
    COOKIE_SECURE: bool = False
    FRONTEND_ORIGIN: str = "http://localhost:5173"
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
    ]
    TRUSTED_PROXIES: List[str] = ["127.0.0.1", "localhost", "vercel.app"]
    TRUSTED_PROXY_COUNT: int = 1  # 1 hop from the right for Vercel edge rewrite proxy

    # AI Settings
    AI_PROVIDER: str = "mock"
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: Optional[str] = "gemini-2.0-flash"
    OPENROUTER_API_KEY: Optional[str] = None
    OPENROUTER_ENABLED: bool = False
    # Free models come and go on OpenRouter: these are tried first, then the live free list (openrouter_provider.py).
    OPENROUTER_MODEL: str = "google/gemma-4-31b-it:free"
    OPENROUTER_FALLBACK_MODELS: List[str] = [
        "google/gemma-4-26b-a4b-it:free",
        "nvidia/nemotron-3.5-super-vl:free",
    ]

    # Uploads & Quality Thresholds
    MAX_UPLOAD_MB: int = 15
    TEMP_UPLOAD_DIR: str = "./temp_uploads"
    INGESTION_MIN_CHARS: int = 500
    INGESTION_MIN_READABLE_RATIO: float = 0.70
    INGESTION_MIN_RELEVANCE: float = 0.70
    INGESTION_MIN_READABILITY: float = 0.65
    INGESTION_TIMEOUT_SECONDS: int = 30

    # Demo & Guests
    DEMO_GUEST_TTL_HOURS: int = 720  # 30 days
    GUEST_SESSION_DAYS: int = 30
    GUEST_CREATE_GLOBAL_PER_HOUR: int = 300
    DEMO_RATE_LIMIT_PER_HOUR: int = 60
    MIN_ANSWER_MS: int = 800
    OWN_NOTES_DAILY_POINTS_CAP: int = 2000
    RANKING_MIN_CHARS: int = 3000
    PRACTICE_POINTS_MULTIPLIER: float = 0.5
    # Upload count limits. 0 = unlimited (the default: anyone may upload as many notes as they need).
    # Set any of these in the environment to bring a limit back, e.g. to protect a small AI quota.
    UPLOAD_GUEST_DAILY_LIMIT: int = 0
    UPLOAD_PLAYER_DAILY_LIMIT: int = 0
    UPLOAD_GUEST_STORED_LIMIT: int = 0
    UPLOAD_PLAYER_STORED_LIMIT: int = 0
    UPLOAD_IP_DAILY_LIMIT: int = 0
    UPLOAD_GLOBAL_DAILY_LIMIT: int = 0

    @model_validator(mode="after")
    def validate_ai_provider_model(self) -> "Settings":
        if self.AI_PROVIDER == "gemini":
            if not self.GEMINI_MODEL or not str(self.GEMINI_MODEL).strip():
                raise ValueError("GEMINI_MODEL is required when AI_PROVIDER='gemini'")
        elif self.AI_PROVIDER == "openrouter":
            if not self.OPENROUTER_API_KEY:
                raise ValueError("OPENROUTER_API_KEY is required when AI_PROVIDER='openrouter'")
        return self

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
