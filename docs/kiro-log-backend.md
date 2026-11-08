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

---

## [2026-11-08] - Step 0: Baseline BREAK IT Round
**Objective:** Hostile testing and property-based verification on baseline authentication, combat calculations, demo guest sessions, and error handling.
- Bugs resolved: Clamped negative repetition in SRS; fixed whitespace username bypass; handled Starlette JSON error serialization.

---

## [2026-11-08] - Step 1: Pre-Step 2 Hardening & Security Audit
**Objective:** Address client-controlled IP spoofing, model validation, Argon2 hash parameter parity, strict fixed-ladder SRS verification, SQLite PRAGMA foreign keys, and system user protections.

### What I Tried to Break
- **IP Spoofing:** Passed spoofed comma-separated `X-Forwarded-For` chains (`"198.51.100.99, 203.0.113.50"`). Verified client IP is determined by taking `TRUSTED_PROXY_COUNT` (default 1) hops from the right, preventing leftmost client-controlled forgery.
- **Model Configuration Omission:** Configured `AI_PROVIDER="gemini"` with empty or `None` `GEMINI_MODEL`. Verified startup model validator raises descriptive `ValueError`.
- **Argon2 Hash Rehash Parity:** Asserted `DUMMY_ARGON2_HASH` parameters match `ph.check_needs_rehash() == False`.
- **SRS Ladder Monotonicity & Resets:** Tested exact ladder values across streak range `[0, 25]`: wrong strictly gives 10 minutes and resets streak to 0; difficult correct gives 1.0 day; normal progression gives 3d, 7d, 14d, 30d.
- **System Demo Protection:** Attempted calling `DELETE /auth/me` with `system_demo` token. Verified 403 `SYSTEM_USER_PROTECTED` and confirmed system user & demo dungeon remain intact.
- **RateLimitRecord Stale Pruning:** Inserted 2-hour-old rate limit logs and confirmed `purge_expired_guests()` cleans records older than 1 hour without impacting fresh records or system data.
- **Real Foreign Key Enforcement:** Enabled SQLite PRAGMA `foreign_keys=ON` across engines to guarantee cascade integrity in local tests.

### Bugs Found & Fixed
- Client IP extraction was previously vulnerable to leftmost spoofing; fixed by slicing from the right using `TRUSTED_PROXY_COUNT`.
- `GEMINI_MODEL` had a fallback default; removed and made strictly required under `AI_PROVIDER="gemini"`.
- `DELETE /auth/me` had no safeguard for `system_demo`; added explicit 403 protection.
- `purge_expired_guests()` did not clean up stale `RateLimitRecord` logs; added threshold cleanup.

### Bugs Found, Not Fixed
- None.

### Final Verification Counts
- **Pytest:** 47 passed in 4.90s.
- **Ruff:** All checks passed (0 errors, 0 warnings).
- **Alembic:** Migrations clean, zero schema drift.
