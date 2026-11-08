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

---

## [2026-11-08] - Step 3: AI Topic Clustering & Grounded Question Generation (Break-It Round)
**Objective:** Deterministic question bank grounding, verbatim evidence-quote verification, dungeon generation with exactly one boss room last, and gameplay security audit (answer hiding).

### What I Tried to Break
- **Answer & Explanation Leakage in Gameplay:** Called `GET /dungeons/{id}` and inspected every room question payload. Asserted that `correct_option`, `explanation`, and `evidence_quote` are strictly excluded from the gameplay response view.
- **Hypothesis PBT on Evidence Quote Substring:** Generated hundreds of synthetic quote-text pairs. Proved that only genuine verbatim substrings pass validation, while fabricated or hallucinated strings are rejected.
- **Tenant Isolation on Generation:** User B attempted to call `POST /documents/{doc_id_a}/generate-dungeon` on User A's document. Verified HTTP 404 `DOCUMENT_NOT_FOUND`.
- **Empty Chunk Generation:** Attempted generating dungeon from document without chunks. Verified HTTP 400 `NO_CHUNKS_AVAILABLE`.
- **Guest Restriction:** Guests attempted dungeon generation. Verified HTTP 403 `GUEST_FORBIDDEN`.

### Bugs Found & Fixed
- `DungeonRoom` constructor was passed `room_number` instead of `room_order`; aligned model attributes.
- Added relationship on `DungeonRoom.topic` to support clean room topic eager loading.
- Corrected Ruff imports across question test files.

### Bugs Found, Not Fixed
- None.

### Final Verification Counts
- **Pytest:** 61 passed in 7.70s (0 failures, 0 regressions).
- **Ruff:** All checks passed (0 errors, 0 warnings).
- **Alembic:** Clean migrations, zero schema drift.

---

## [2026-11-08] - Step 4: Authoritative Combat, Game Runs & Fixed-Ladder SRS (Break-It Round)
**Objective:** Authoritative state progression, client attempt idempotency (`attempt_id`), guest access containment, and end-of-run scorecard calculation.

### What I Tried to Break
- **Cross-User Run Tampering:** User B attempted to inspect or finish User A's run via `GET /runs/{id}` and `POST /runs/{id}/finish`. Verified HTTP 404 `RUN_NOT_FOUND` cross-tenant security barrier.
- **Finished/Defeated Run Resubmission:** Submitted attempts to a run with status `"defeated"`. Verified HTTP 409 `RUN_FINISHED` preventing late HP/score exploitation.
- **Idempotency Replay Attack:** Dispatched duplicate attempt payloads with identical `attempt_id`. Verified idempotent replay returning cached combat results without double damage or score inflation.
- **Guest Access Containment:** Attempted starting a run on private dungeons as guest. Verified HTTP 403 `GUEST_FORBIDDEN`, while public demo dungeon run creation succeeds cleanly.

### Bugs Found & Fixed
- Added relationship on `GameRun.dungeon` and `Attempt.question` for eager loading in runs status endpoint.
- Added `selected_answer` and `damage_taken` columns to `Attempt` model along with Alembic migration `188c79c171dd_add_attempt_selected_answer_and_damage_taken.py`.
- Fixed field name parity on `ReviewItem` (`due_at` and `repetition`).

### Bugs Found, Not Fixed
- None.

### Final Verification Counts
- **Pytest:** 65 passed in 6.07s (0 failures, 0 regressions).
- **Ruff:** All checks passed (0 errors, 0 warnings).
- **Alembic:** Migrations fully tested, 0 schema drift.

---

## [2026-11-08] - Step 5: Demo Seed Grounding & Offline Compatibility (Break-It Round)
**Objective:** Zero-AI demo execution, verbatim evidence quote verification across all seeded demo questions, and offline sample JSON parity.

### What I Tried to Break
- **Evidence Quote Verbatim Check:** Iterated through every seeded question across all topics. Verified that `q.evidence_quote` is a direct substring of `chunk.text`.
- **Zero-AI Offline Resilience:** Tested seeded dungeon access and run creation with AIProvider completely disabled or mocked. Verified zero LLM calls occur during demo gameplay.
- **System Demo Protection during Purge:** Executed `purge_expired_guests()`. Verified system user and public demo dungeon remain completely untouched.

### Bugs Found & Fixed
- Re-exported [`docs/handoff/demo_dungeon.sample.json`](file:///D:/dev-stuff/studydungeon/docs/handoff/demo_dungeon.sample.json) from canonical seeded data.
- Verified and documented that `demo_dungeon.sample.json` contains correct answers for demo purposes only.

### Bugs Found, Not Fixed
- None.

### Final Verification Counts
- **Pytest:** 67 passed in 6.52s (0 failures, 0 regressions).
- **Ruff:** All checks passed (0 errors, 0 warnings).
- **Alembic:** Migrations clean, zero schema drift.

---

## [2026-11-08] - Step 6: Integration, API Contract Parity & Smoke Verification
**Objective:** End-to-end integration across all backend layers, contract verification, openapi.json export, and automated smoke test.

### What I Tried to Break
- **Contract Error Bodies:** Verified 401, 403, 404, 409, 413, 415, 422, and 429 response bodies strictly conform to `{"detail": {"code": "...", "message": "..."}}`.
- **E2E Pipeline Integration Smoke Test:** Executed `backend/scripts/smoke.py`:
  1. `/health` check.
  2. Registration of new user.
  3. Login with cookie issuance.
  4. Document multipart upload.
  5. Status polling.
  6. Grounded dungeon generation.
  7. Run initialization.
  8. Idempotent attempt submission with combat damage.
  9. Run finalization with mastery band calculation.
  10. Progress statistics persistence.
  11. Unauthenticated demo guest session creation.
- **Cross-Account Isolation:** Confirmed user 2 cannot query user 1's documents, dungeons, runs, or scorecards.

### Bugs Found & Fixed
- `smoke.py` needed `sys.path` injection and explicit mock provider initialization to run standalone from the command line.
- Exported fresh `docs/openapi.json` from `create_app().openapi()`.
- Added Day 2 integration replies to `docs/handoff/A-to-B.md`.

### Bugs Found, Not Fixed
- None.

### Final Verification Counts
- **Smoke Test:** 11 of 11 integration steps passed with 100% success.
- **Pytest:** 67 passed in 6.52s.
- **Ruff:** All checks passed (0 errors, 0 warnings).
- **Alembic:** Clean schema, zero drift.

---

## [2026-11-08] - Step 7 & 8: Production Deployment Hardening & Submission Artifacts
**Objective:** Hardened containerization, database auto-migration on deployment startup, Devpost writeup, and submission verification checklist.

### Accomplishments
- **Production Container Entrypoint:** Configured `Dockerfile` to automatically execute `alembic upgrade head && python -m app.demo.seed` prior to spinning up `uvicorn` on the dynamic `$PORT`.
- **Submission Artifacts:** Created [`docs/SUBMISSION_CHECKLIST.md`](file:///D:/dev-stuff/studydungeon/docs/SUBMISSION_CHECKLIST.md) and populated the authentic hackathon journey in [`docs/KIRO_WRITEUP.md`](file:///D:/dev-stuff/studydungeon/docs/KIRO_WRITEUP.md).
- **Static Contract Generation:** Built and verified `backend/scripts/export_openapi.py` with static generation of `docs/openapi.json`.
- **Automated Smoke Testing:** End-to-end multi-stage smoke script `backend/scripts/smoke.py` passes all 11 lifecycle scenarios.

### Bugs Found & Fixed
- Added `python-multipart`, `pymupdf`, `python-docx`, `python-pptx`, and `pillow` to `requirements.txt`.
- Resolved unused imports and formatting across scripts and test fixtures.

### Bugs Found, Not Fixed
- None.

### Final Verification Counts
- **Pytest:** 67 passed in 6.01s (0 failures, 0 regressions).
- **Ruff:** All checks passed (0 errors, 0 warnings).
- **Smoke Test:** 11 of 11 lifecycle steps passed.
- **Alembic:** Fully synced with SQLite/Postgres schemas; 0 schema drift detected.
