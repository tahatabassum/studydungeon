import sys
from logging.config import fileConfig
from pathlib import Path
import asyncio
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context

# Ensure backend root is on sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import settings
from app.core.db_url import normalize_database_url
from app.models.all_models import Base

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata

# Configure db url
if not config.get_main_option("sqlalchemy.url") or config.get_main_option("sqlalchemy.url") == "driver://user:pass@localhost/dbname":
    raw_url = settings.DATABASE_URL
    if "postgres" in raw_url:
        db_url = normalize_database_url(raw_url, is_alembic_sync=False)
    else:
        db_url = normalize_database_url(raw_url, is_alembic_sync=True)
    config.set_main_option("sqlalchemy.url", db_url)


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        render_as_batch=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    connect_args = {}
    db_target = config.get_main_option("sqlalchemy.url") or ""
    if "postgres" in db_target:
        connect_args["statement_cache_size"] = 0
        connect_args["prepared_statement_cache_size"] = 0

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    url = config.get_main_option("sqlalchemy.url") or ""
    if "+asyncpg" in url or "+aiosqlite" in url:
        asyncio.run(run_async_migrations())
    else:
        connectable = engine_from_config(
            config.get_section(config.config_ini_section, {}),
            prefix="sqlalchemy.",
            poolclass=pool.NullPool,
        )

        with connectable.connect() as connection:
            do_run_migrations(connection)


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
