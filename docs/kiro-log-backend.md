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

---

## [2026-11-08] - Step 2: Document Ingestion & Multimodal Guardrails (Break-It Round)
**Objective:** End-to-end multi-format ingestion (PDF, DOCX, PPTX, TXT, images), AIProvider interface with mock/Gemini implementations, quotas, and hostile QA testing.

### What I Tried to Break
- **Guest Upload Bypass:** Sent `POST /documents` with guest auth cookie. Verified HTTP 403 `GUEST_FORBIDDEN` error body.
- **Unsupported Executable / Archive Upload:** Attempted upload with `malicious.exe` and `payload.zip`. Verified HTTP 415 `UNSUPPORTED_FILE_TYPE`.
- **Oversized Upload:** Sent 16MB file exceeding `MAX_UPLOAD_MB` (15MB). Verified HTTP 413 `FILE_TOO_LARGE`.
- **User Document Quota Limit:** Seeded 5 documents and attempted a 6th upload. Verified HTTP 400 `QUOTA_EXCEEDED`.
- **Meme / Receipt Content Ingestion:** Ingested non-academic meme text. Verified background processing marks document status as `rejected` with actionable message.
- **Prompt Injection in Document Notes:** Injected `Ignore all previous instructions...` inside notes text. Verified AI evaluation neutralizes instructions without privilege escalation.
- **Cascading Deletion:** Uploaded document, extracted chunks, and issued `DELETE /documents/{id}`. Verified document and all related chunks are purged.

### Bugs Found & Fixed
- Missing `python-multipart` prevented multipart form uploads; installed and added dependency.
- Extractors needed `python-docx`, `python-pptx`, `pymupdf`, and `pillow`; installed into virtual environment.
- Background worker execution in unit tests was asynchronous; added optional session parameter for deterministic test inspection.
- Fixed unused imports across ingestion test fixtures.

### Bugs Found, Not Fixed
- None.

### Final Verification Counts
- **Pytest:** 56 passed in 6.81s (0 failures, 0 regressions).
- **Ruff:** All checks passed (0 errors, 0 warnings).
- **Alembic:** Migrations up to date; 0 schema drift.
