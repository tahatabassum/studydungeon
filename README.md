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

## Frontend (React, Vite, Phaser)

The frontend lives in `frontend/`. It runs fully in mock mode, so no backend is needed to play.

### Run it in mock mode
```bash
cd frontend
npm install
npm run dev          # http://localhost:5173, mock mode by default (VITE_USE_MOCKS=true)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # vitest --run (unit and property tests)
npm run test:contract  # contract suite against the mock adapter
npm run build        # typecheck, then vite build
```

### Features
- Campaign: a floor map with locked, active, cleared and generating floors, a Final Boss and a Chest after a floor clear.
- Floors and rooms: each floor groups topics; clearing a floor unlocks the next one and shows a rank.
- Daily Haunt: a short review of memories that are due, ending with a finale and the daily streak.
- Run modes: weak topics, exam (with timer) and floor replay.
- Learning loop: a memory scroll after a wrong answer, a quick retry, missed questions coming back later, and a combo meter.
- Leaderboard and dashboard: readable by guests, with progress, mastery, review streak, Armory and badges.
- Auth: register, login and logout with a cookie session, plus a guest demo.
- Offline demo: if the backend is asleep or unreachable, the player can continue with a clearly labelled offline demo.
- Share card: a 1200x630 image and post text made after a run (Download or Copy).
- First run: intro cards, then a five-step tutorial (move, engage, answer, memory scroll, Daily Haunt). Skippable at every step, shown once (`sd.introSeen`, `sd.tutorialSeen`). "How to play" on the title screen replays it.
- Armory: pick an unlocked weapon to equip. The choice is UI state only and is sent as the weapon on each attempt.

### Environment variables
| Variable | Meaning |
| --- | --- |
| `VITE_USE_MOCKS` | `true` (default in `.env.example`) uses the in-browser mock; anything else uses the real backend. |
| `VITE_API_BASE` | Base URL of the real backend, for example `http://localhost:8000` or `/api`. Wins over the older `VITE_API_BASE_URL`. |
| `VITE_MOCK_DELAY_MS` | Dev only: extra latency (0 to 60000 ms) on the mock demo session, to see the waking-up screen. |
| `VITE_MOCK_SEED_REVENANTS` | `true` seeds a few due memories in the mock so the Daily Haunt and Revenants can be seen at once. |
| `VITE_BADGE_SPEED_READER` | `true` turns on the optional speed_reader badge. |

### Dev routes
- `/dev/floors`: the floor map with every floor state, for visual checks.
- `/dev/scorecard`: the Scorecard with sample data, for visual checks.

### Honest-copy rule
Screens show measured numbers only. They never promise that anything will be memorized or remembered, and a test scans the copy-bearing folders for banned phrases. Fields the backend does not send (rank, chest, XP and so on) are hidden in real mode, never invented.

### Mock mode versus real mode
Mock mode implements the whole campaign in the browser, including fields marked PROPOSED in `docs/handoff/B-to-A.md`. Real mode talks to the backend in this repository, sends only the fields it supports and hides features whose capability is missing, with a short "coming soon" note. Both modes pass the same contract tests where the contract exists.

### Mobile play

StudyDungeon plays on a phone with touch only. Touch controls turn on for a coarse pointer, at the first touch, or with `?touch=1` on a desktop (for testing). Desktop and keyboard play are unchanged.

- Move with the stick at the bottom-left. Tap the Engage button at the bottom-right when it names a target ("Fight Paper Wraith", "Face the memory").
- Answers, Next, Retreat and Continue are buttons of at least 44px. The Pause button in the top bar does what Esc does.
- Portrait works, with a dismissible hint to rotate. The page never scrolls or bounces during play; pinch zoom stays available on other screens.
- Upload from the phone: tap to choose a file (PDF, DOCX, PPTX, TXT, PNG or JPEG; you can also take a photo of your notes). In mock mode an uploaded dungeon is fully playable: summon it, open the map, play each floor and the final boss.
- Fullscreen is hidden where the browser has no Fullscreen API (iOS).
