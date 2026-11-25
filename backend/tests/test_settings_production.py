"""Production settings validator (frontend-14 task 3.2, requirements 7.2 and 7.5)."""

import pytest
from pydantic import ValidationError

from app.core.config import DEFAULT_SECRET_KEY, Settings

LONG_KEY = "k" * 40


def make(**kwargs: object) -> Settings:
    # _env_file=None keeps a developer's local .env out of the test.
    return Settings(_env_file=None, **kwargs)  # type: ignore[call-arg]


def test_default_key_rejected_in_production() -> None:
    with pytest.raises(ValidationError, match="built-in default"):
        make(COOKIE_SECURE=True, SECRET_KEY=DEFAULT_SECRET_KEY)


def test_short_key_rejected_in_production() -> None:
    with pytest.raises(ValidationError, match="at least 32"):
        make(COOKIE_SECURE=True, SECRET_KEY="k" * 31)


def test_long_key_accepted_in_production() -> None:
    assert make(COOKIE_SECURE=True, SECRET_KEY=LONG_KEY).COOKIE_SECURE is True


def test_dev_mode_allows_default_key() -> None:
    assert make(COOKIE_SECURE=False, SECRET_KEY=DEFAULT_SECRET_KEY).SECRET_KEY == DEFAULT_SECRET_KEY
    assert make(COOKIE_SECURE=False, SECRET_KEY="short").SECRET_KEY == "short"


def test_cors_wildcard_rejected() -> None:
    with pytest.raises(ValidationError, match="wildcard"):
        make(CORS_ORIGINS=["*"])
    with pytest.raises(ValidationError, match="wildcard"):
        make(FRONTEND_ORIGIN="*")
