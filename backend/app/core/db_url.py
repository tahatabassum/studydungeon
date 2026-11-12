from urllib.parse import parse_qs, urlencode, urlparse, urlunparse


def normalize_database_url(url: str, is_alembic_sync: bool = False) -> str:
    """
    Normalizes a Neon / PostgreSQL / SQLite connection string for asyncpg (FastAPI)
    or standard driver (Alembic sync execution).

    - Converts postgres:// and postgresql:// to postgresql+asyncpg:// (or standard postgresql:// for Alembic)
    - Maps sslmode=require to asyncpg-supported format (asyncpg does not accept ?sslmode=require parameter)
    - Removes channel_binding and other unsupported asyncpg query parameters
    """
    if not url:
        return url

    # Handle SQLite directly
    if url.startswith("sqlite"):
        if is_alembic_sync and "+aiosqlite" in url:
            return url.replace("+aiosqlite", "")
        return url

    parsed = urlparse(url)
    scheme = parsed.scheme.lower()

    if scheme in ("postgres", "postgresql", "postgresql+asyncpg", "postgresql+psycopg2"):
        if is_alembic_sync:
            # Sync Alembic uses postgresql:// (or postgresql+psycopg2://)
            target_scheme = "postgresql"
        else:
            target_scheme = "postgresql+asyncpg"
    else:
        target_scheme = scheme

    # Parse query parameters
    query_params = parse_qs(parsed.query)

    # Clean query parameters unsupported by asyncpg / sync drivers
    cleaned_params = {}
    for k, v in query_params.items():
        k_lower = k.lower()
        if k_lower in ("channel_binding", "sslmode", "target_session_attrs"):
            # Handled separately or dropped if unsupported
            continue
        cleaned_params[k] = v

    # Rebuild query string
    new_query = urlencode(cleaned_params, doseq=True)

    normalized = urlunparse((
        target_scheme,
        parsed.netloc,
        parsed.path,
        parsed.params,
        new_query,
        parsed.fragment
    ))
    return normalized

