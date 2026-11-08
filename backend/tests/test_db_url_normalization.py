from app.core.db_url import normalize_database_url


def test_normalize_postgres_neon_url_for_asyncpg():
    """
    TDD Test: Normalizes postgres:// and postgresql:// into postgresql+asyncpg://,
    drops channel_binding and unsupported query params.
    """
    raw_neon = "postgres://user:password@ep-cool-fog-123456.us-east-2.aws.neon.tech/studydungeon?sslmode=require&channel_binding=prefer"
    normalized = normalize_database_url(raw_neon, is_alembic_sync=False)

    assert normalized.startswith("postgresql+asyncpg://")
    assert "channel_binding" not in normalized
    assert "sslmode" not in normalized
    assert "ep-cool-fog-123456.us-east-2.aws.neon.tech/studydungeon" in normalized


def test_normalize_postgres_url_for_alembic_sync():
    """
    TDD Test: Normalizes to standard postgresql:// for synchronous Alembic runner.
    """
    raw_neon = "postgresql://user:password@ep-cool-fog-123456.us-east-2.aws.neon.tech/studydungeon?sslmode=require"
    normalized = normalize_database_url(raw_neon, is_alembic_sync=True)

    assert normalized.startswith("postgresql://")
    assert not normalized.startswith("postgresql+asyncpg://")
    assert "sslmode" not in normalized


def test_normalize_sqlite_url():
    """
    Preserves sqlite URLs, stripping +aiosqlite only for alembic sync.
    """
    sqlite_url = "sqlite+aiosqlite:///./studydungeon.db"
    assert normalize_database_url(sqlite_url, is_alembic_sync=False) == sqlite_url
    assert normalize_database_url(sqlite_url, is_alembic_sync=True) == "sqlite:///./studydungeon.db"
