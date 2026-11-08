# StudyDungeon — Backend Kiro Activity Log (Person A)

This log records dated facts, steering documents, feature specifications, automated hooks, and code milestones completed on the backend/AI side of StudyDungeon.

---

## [2026-11-08] - Session 1: Foundation, Steering & Architecture Setup
**Objective:** Establish project scaffolding, architectural contracts, Alembic migrations, database models, and Kiro specs.

### Steering Files Created (`.kiro/steering/`)
- `product.md`: Product vision, core player journey, and scope boundaries.
- `tech.md`: Fixed technical stack selections (FastAPI, SQLAlchemy 2.0, PostgreSQL, Gemini, Phaser 3).
- `architecture.md`: Complete system architecture, layer diagrams, request flow, session cookies via Vercel proxy, and cold-start handling.
- `api-contract.md`: REST API specifications, status codes, and JSON schemas for all endpoints.
- `game-design.md`: Authoritative combat math, weapon baselines (Rusty Dagger 20 to Flame Sigil 40), damage multipliers, and SM-2 spaced repetition rules.
- `security-and-uploads.md`: Argon2 password hashing rules, upload restrictions (15MB cap, max 30 pages), and anti-prompt-injection policies.
- `coding-standards.md`: Python/FastAPI conventions, Pydantic validation standards, and project organization.
- `team-ownership.md`: Division of ownership between Person A (backend) and Person B (frontend/game).

### Feature Specifications Created (`.kiro/specs/`)
- `backend-01-foundation-auth-guest`: `requirements.md`, `design.md`, `tasks.md`.
- `backend-02-document-ingestion`: `requirements.md`, `design.md`, `tasks.md`.
- `backend-03-ai-questions`: `requirements.md`, `design.md`, `tasks.md`.
- `backend-04-game-state-srs`: `requirements.md`, `design.md`, `tasks.md`.
- `backend-05-demo-seed`: `requirements.md`, `design.md`, `tasks.md`.
- `backend-06-deploy-hardening`: `requirements.md`, `design.md`, `tasks.md`.

### Automated Hooks Created (`.kiro/hooks/`)
- `backend-test-on-save.json`: Triggers `pytest backend/tests` automatically whenever backend Python files are saved.

### Code & Infrastructure Milestones Completed
- **FastAPI Core Skeleton:** `app/main.py` with app factory, CORS middleware, and unified JSON error handling.
- **SQLAlchemy 2.0 Async Models:** `app/models/all_models.py` defining 11 entities.
- **Alembic Database Migrations:** `alembic.ini`, `migrations/env.py`, initial migration `6355c67fe08b_initial_migration.py`.
- **Authentication & Guest Demo Endpoints:** `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /demo/session`.
- **Combat & SRS Service:** `app/services/combat.py` implementing exact damage multipliers and SM-2 intervals.
- **Demo Seed & Export:** `app/demo/seed.py` and `scripts/export_sample.py` exporting `docs/handoff/demo_dungeon.sample.json`.

---

## [2026-11-08] - Step 0: Baseline BREAK IT Round
**Objective:** Hostile testing and property-based verification on baseline authentication, combat calculations, demo guest sessions, and error handling.

### What I Tried to Break
- **Combat & SRS Math Invariants:** Fuzzing with `Hypothesis` passing negative streaks, unknown weapons, and arbitrary/negative repetition states to `calculate_combat_damage` and `calculate_next_review_interval`.
- **Username Malformations:** Whitespace-only usernames (`"   "`), non-alphanumeric unicode payloads, and boundary string lengths.
- **Credential & Timing Leakage:** Asserting identical status (401) and error structure (`INVALID_CREDENTIALS`) on non-existent usernames vs bad passwords.
- **Session Cookie Tampering:** Altering base64 payload bytes and HMAC signatures; passing expired tokens.
- **Guest Impersonation:** Calling `POST /auth/login` using an auto-generated guest username.
- **Exception Serialization:** Triggering custom Pydantic validator failures and observing the JSON response renderer.

### Bugs Found and Fixed (Root Cause)
1. **SRS Interval Negative Repetition Bug:**
   - *Root Cause:* Passing negative `current_repetition` (e.g. `-2`) returned negative new repetition (`-1`), violating the non-negative invariant.
   - *Fix:* Clamped repetition input in `app/services/combat.py` with `safe_rep = max(0, current_repetition)`.
2. **Whitespace Username Acceptance:**
   - *Root Cause:* Pydantic `min_length=3` counted raw whitespace characters; `"   "` passed validation and registered an empty-named user.
   - *Fix:* Added `@field_validator("username")` in `app/schemas/auth.py` to strip and enforce at least 3 alphanumeric/underscore characters.
3. **500 Server Error on Validation Exception Serialization:**
   - *Root Cause:* Starlette's `JSONResponse` raised `TypeError: Object of type ValueError is not JSON serializable` when custom validator exceptions were embedded inside Pydantic's `exc.errors()`.
   - *Fix:* Sanitized `ctx["error"]` in `app/core/errors.py` `validation_exception_handler` to convert raw exception objects to strings.

### Bugs Found, Not Fixed
- None. All discovered issues have been resolved.

### Remaining Risks
- In-memory rate limiting is not yet active (scheduled for Step 1).
- Guest cleanup is currently manual until `purge_guests` background task is hooked up.

### Final Verification Counts
- **Pytest:** 18 passed in 2.31s (including 2 Hypothesis property-based test suites).
- **Ruff:** All checks passed (0 errors, 0 warnings).
