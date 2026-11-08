from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "StudyDungeon Backend API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./studydungeon.db"

    # Security
    SECRET_KEY: str = "studydungeon-default-insecure-secret-key-change-in-prod"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    SESSION_COOKIE_NAME: str = "studydungeon_session"
    FRONTEND_ORIGIN: str = "http://localhost:5173"

    # AI Settings
    AI_PROVIDER: str = "gemini"
    GEMINI_API_KEY: Optional[str] = None
    OPENROUTER_API_KEY: Optional[str] = None
    OPENROUTER_ENABLED: bool = False

    # Uploads
    MAX_UPLOAD_MB: int = 15
    TEMP_UPLOAD_DIR: str = "./temp_uploads"

    # Demo
    DEMO_GUEST_TTL_HOURS: int = 24
    DEMO_RATE_LIMIT_PER_HOUR: int = 60

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()

