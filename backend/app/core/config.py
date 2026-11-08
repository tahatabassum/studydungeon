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
    SECRET_KEY: str = "studydungeon-default-insecure-secret-key-change-in-prod"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    SESSION_COOKIE_NAME: str = "studydungeon_session"
    FRONTEND_ORIGIN: str = "http://localhost:5173"
    TRUSTED_PROXIES: List[str] = ["127.0.0.1", "localhost", "vercel.app"]
    TRUSTED_PROXY_COUNT: int = 1  # 1 hop from the right for Vercel edge rewrite proxy

    # AI Settings
    AI_PROVIDER: str = "gemini"
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: Optional[str] = "gemini-1.5-flash"  # Defaults for dev, validated if empty
    OPENROUTER_API_KEY: Optional[str] = None
    OPENROUTER_ENABLED: bool = False

    # Uploads & Quality Thresholds
    MAX_UPLOAD_MB: int = 15
    TEMP_UPLOAD_DIR: str = "./temp_uploads"
    INGESTION_MIN_CHARS: int = 500
    INGESTION_MIN_READABLE_RATIO: float = 0.70
    INGESTION_MIN_RELEVANCE: float = 0.70
    INGESTION_MIN_READABILITY: float = 0.65
    INGESTION_TIMEOUT_SECONDS: int = 30

    # Demo
    DEMO_GUEST_TTL_HOURS: int = 24
    DEMO_RATE_LIMIT_PER_HOUR: int = 60

    @model_validator(mode="after")
    def validate_ai_provider_model(self) -> "Settings":
        if self.AI_PROVIDER == "gemini":
            if not self.GEMINI_MODEL or not str(self.GEMINI_MODEL).strip():
                raise ValueError("GEMINI_MODEL is required when AI_PROVIDER='gemini'")
        return self

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
