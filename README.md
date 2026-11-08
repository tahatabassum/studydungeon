# studydungeon
AI-powered gamified learning RPG built for Kiroween 2026

## Backend Architecture & Operations

StudyDungeon's backend is a high-performance asynchronous API designed for deterministic, verifiable educational RPG gameplay powered by FastAPI, SQLAlchemy (asyncio), PostgreSQL / SQLite, and a configurable AI provider (model selected via the `GEMINI_MODEL` environment variable; a Google AI Studio API key — free tier works).

### Core Architecture & Guarantees
- **Deterministic RPG Authority**: The AI strictly extracts study chunks and proposes candidate questions with verbatim evidence citations. The backend Python engine authoritatively computes all combat damage, streak multipliers, weapon unlocks, XP progression, and SRS review intervals. The AI never decides HP, XP, damage, or review intervals.
- **SRS Leitner/Fixed Ladder**: Implements the official PRD spaced repetition schedule: wrong answers reset streak to 0 with a 10-minute retry interval; difficult correct answers schedule for 1 day across all streak tiers; normal correct answers advance progressively through 3, 7, 14, and 30 days.
- **Strict Tenant & Guest Isolation**: Public guest accounts can play the pre-seeded public demo dungeon and experience combat, but cannot upload documents, generate dungeons, or access another user's runs or scorecards. Cross-tenant queries strictly return `403` / `404`.
- **Argon2id Security**: Modern password hashing with constant-time dummy verification on nonexistent usernames to prevent timing oracle attacks. Session tokens are signed, httpOnly, and revocable via `session_version`.

### Environment Variables
Configure the following environment variables (refer to `.env.example`):
- `DATABASE_URL`: Asynchronous DB connection string (e.g., `postgresql+asyncpg://user:pass@host:5432/studydungeon` or `sqlite+aiosqlite:///./studydungeon.db`).
- `AI_PROVIDER`: `gemini` (production) or `mock` (development / testing).
- `GEMINI_API_KEY`: Google Gemini API key.
- `GEMINI_MODEL`: Gemini model identifier (e.g., `gemini-2.0-flash`). Required when `AI_PROVIDER=gemini`.
- `SECRET_KEY`: Cryptographic signing key for sessions.
- `FRONTEND_ORIGIN`: Allowed origin for CORS (default: `http://localhost:5173`).
- `TRUSTED_PROXY_COUNT`: Number of reverse proxy hops from the right to determine client IP (default: `1`).
- `MAX_UPLOAD_MB`: File upload size limit in megabytes (default: `15`).
- `TEMP_UPLOAD_DIR`: Path for temporary upload processing.

### Testing & Verification
```bash
# Install runtime and testing dependencies
pip install -r backend/requirements.txt
pip install -r backend/requirements-dev.txt

# Run full automated test suite (Pytest + Hypothesis property tests)
pytest -q

# Run static analysis and linting
ruff check .

# Execute end-to-end integration smoke script
python backend/scripts/smoke.py
```

### Database Migrations
Database schemas are managed authoritatively via Alembic:
```bash
# Apply pending migrations
alembic upgrade head

# Rollback all migrations
alembic downgrade base

# Verify schema synchronization
alembic check
```


### Supported Files & Limits
- **File Types**: PDF, DOCX, PPTX, TXT, PNG, JPEG.
- **Upload Constraints**: Maximum file size 15 MB (`MAX_UPLOAD_MB=15`), maximum 30 pages per document, minimum 500 extractable characters (`INGESTION_MIN_CHARS=500`).
- **Quota**: Maximum 5 documents per registered user; guest accounts cannot upload or trigger generation.

### Public Demo & Try-It-Out Experience
- Guests can immediately test gameplay via `POST /demo/session`.
- Includes a fully grounded, pre-seeded academic computer architecture dungeon with 3 rooms and a final boss.
- Combat is 100% playable offline without requiring Gemini API quotas or credentials.

### License
- StudyDungeon is licensed under the MIT License. Copyright (c) 2026 M Taha Tabassum.
