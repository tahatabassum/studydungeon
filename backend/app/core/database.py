from typing import Any, AsyncGenerator

from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.db_url import get_ssl_connect_arg, normalize_database_url
from app.models.all_models import Base

normalized_url = normalize_database_url(settings.DATABASE_URL, is_alembic_sync=False)

# Engine configuration
engine_kwargs: dict[str, Any] = {"echo": False, "future": True}
if normalized_url.startswith("postgresql"):
    # Neon / PgBouncer poolers require statement caching to be disabled.
    connect_args: dict[str, Any] = {
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
    }
    ssl_arg = get_ssl_connect_arg(settings.DATABASE_URL)
    if ssl_arg is not None:
        connect_args["ssl"] = ssl_arg
    engine_kwargs.update(
        connect_args=connect_args,
        pool_pre_ping=True,  # Neon suspends idle computes; drop dead connections
        pool_size=5,
        max_overflow=5,
        pool_recycle=300,
    )

engine = create_async_engine(normalized_url, **engine_kwargs)

# Enforce SQLite foreign key constraints
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if "sqlite" in settings.DATABASE_URL:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()

