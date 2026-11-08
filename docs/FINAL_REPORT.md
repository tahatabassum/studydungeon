# StudyDungeon Backend — Final Architecture & Verification Report

This document records the comprehensive architectural implementation, test verification evidence, security findings, and deployment runbooks for Person A (Backend/AI owner) on branch `feature/backend-02-ingestion`.

---

## 1. Executive Summary
StudyDungeon's backend is an asynchronous API engineered for deterministic educational RPG gameplay. The platform authoritatively computes all combat damage, streak multipliers, weapon unlocks, XP progression, and fixed-ladder spaced repetition intervals on the Python backend, ensuring the AI never decides game balance or review dates. Comprehensive test automation (96 tests as of commit fd78b92 — pytest integration, unit, and Hypothesis property tests) confirms 100% test passing with zero warnings and zero schema drift across SQLite migration cycles. **Migrations and tests have been verified on SQLite only; PostgreSQL/Neon has NOT been verified locally** (see Section 8 for full list of unverified items). The entire codebase is strictly scoped to Person A boundaries, leaving `frontend/**` and `.kiro/steering/**` completely untouched.

---

## 2. Test & Verification Summary

### Pytest & Coverage
- **Total Tests Collected & Passed**: 96 tests (0 failures, 0 skipped, 0 regressions, 0 warnings).
- **Execution Time**: 9.71s.
- **Ruff Linting**: Clean across all backend modules (`All checks passed!`).
- **Alembic Schema Sync**: Verified via `alembic check` (`No new upgrade operations detected`).

### Test Inventory by Area
1. **Authentication & Session Security (15 tests)**:
   - `test_user_registration_and_login`, `test_auth_me_endpoint`
   - `test_delete_auth_me_cascade`, `test_session_revocation_after_logout`, `test_logout_invalidates_session_cookie`
   - `test_auth_attack_error_format_on_validation_failure`, `test_auth_attack_whitespace_and_unicode_username`, `test_auth_attack_timing_and_credential_leakage`
   - `test_session_attack_tampered_signature`, `test_session_attack_expired_cookie`
   - `test_constant_time_login_runs_argon2_on_missing_user`, `test_dummy_argon2_hash_parameters_parity`
   - `test_input_limits_1000_char_username_and_1mb_password`, `test_username_nfkc_normalization`
   - `test_reserved_guest_prefix_rejected`, `test_reserved_system_usernames_rejected`
2. **Demo Guest Sessions & Grounding (7 tests)**:
   - `test_demo_guest_session`, `test_guest_me_endpoint`, `test_demo_guest_cannot_login_as_regular_user`
   - `test_demo_question_quotes_appear_verbatim_in_chunks`, `test_demo_works_without_ai_provider`
   - `test_seed_demo_dungeon_idempotent_serial`, `test_seed_demo_dungeon_idempotent_repeat_call`
3. **Document Ingestion & Multi-Format Extractors (11 tests)**:
   - `test_text_normalization`, `test_text_quality_checks`
   - `test_break_ingestion_meme_rejection`, `test_break_ingestion_prompt_injection`, `test_break_ingestion_quota_exceeded`
   - `test_guest_upload_blocked`, `test_upload_invalid_extension_rejected`, `test_upload_oversized_file_rejected`
   - `test_valid_text_document_ingestion_lifecycle`, `test_document_retry_endpoint`, `test_env_threshold_min_500_chars`
4. **Questions, AI Ingestion & Grounding (7 tests)**:
   - `test_guest_cannot_generate_dungeon`, `test_dungeon_generation_and_answer_hiding_in_detail_view`
   - `test_break_dungeon_other_user_isolation`, `test_break_dungeon_generation_no_chunks`
   - `test_pbt_evidence_quote_invariant` (Hypothesis property test)
   - `test_gemini_vision_ocr_image_payload`
   - `test_zero_ai_calls_during_gameplay` (Proves 0 AI calls occur during combat attempts)
5. **Runs, Combat Engine & Weapons Security (11 tests)**:
   - `test_combat_damage_calculation`, `test_run_attempt_idempotency_and_combat_progression`
   - `test_guest_can_only_play_public_demo_dungeon`, `test_break_run_finish_after_defeat`
   - `test_room_clear_flow_and_finish_blocking` (Enforces 409 while monster alive; room ordering; boss clear)
   - `test_locked_weapon_rejected`, `test_unknown_weapon_rejected`
   - `test_hypothesis_damage_math_over_every_weapon` (Hypothesis property test)
   - `test_hypothesis_attempt_idempotency_structure` (Hypothesis property test)
   - `test_pbt_combat_damage_safety_and_invariants` (Hypothesis property test)
6. **Spaced Repetition (SRS) Ladder (17 tests)**:
   - `test_srs_intervals`, `test_srs_fixed_ladder_exact_intervals`, `test_srs_service_in_dedicated_module`
   - `test_pbt_srs_ladder_monotonicity`, `test_pbt_srs_intervals_safety` (Hypothesis)
   - Parameterized tests across streak levels `[0, 1, 2, 5, 10, 25]` verifying wrong resets to 10 min and difficult correct gives 1 day.
7. **Cross-Tenant Isolation & Error Uniformity (13 tests)**:
   - `test_cross_user_isolation`, `test_two_account_cross_tenant_isolation`, `test_break_run_other_user_isolation`
   - `test_source_preview_owner_and_guest_safety`
   - Standard error body tests (`test_error_body_contract_401`, `404`, `422`, `500`)
   - Hostile round (`test_hostile_oversized_and_malformed_json`, `test_hostile_path_traversal_filename_upload`, `test_hostile_sql_injection_attempt`, `test_hostile_idor_document_access`)
8. **Config, Health & Migrations (15 tests)**:
   - `test_health_endpoint`, `test_health_ready_endpoint`
   - `test_client_ip_hops_from_right`, `test_gemini_model_required_validation`, `test_gemini_model_config_exists`
   - `test_system_user_and_demo_dungeon_protected_from_deletion`, `test_is_system_flag_blocks_account_deletion`
   - `test_purge_cleans_old_rate_limits_and_never_deletes_system_or_demo`
   - `test_normalize_postgres_neon_url_for_asyncpg`, `test_normalize_postgres_url_for_alembic_sync`, `test_normalize_sqlite_url`
   - `test_migration_chain_from_shared_base_with_pre_existing_user`
   - `test_scorecard_and_mastery_bands`
   - `test_full_contract_parity_demo_journey`

---

## 3. Feature Verification Matrix

| Feature | How Verified | Result | Evidence | Gap |
| :--- | :--- | :--- | :--- | :--- |
| Register / Login / Logout | `test_auth.py`, `test_isolation_deep.py` | **DONE** | Status 201/200, session cookies set and revoked. | None |
| Constant-time login path | `test_step0_gaps.py::test_constant_time_login_runs_argon2_on_missing_user` | **DONE** | `DUMMY_ARGON2_HASH` executed on missing usernames. | None |
| Reserved usernames | `test_prestep_fixes.py`, `test_system_flag.py` | **DONE** | Usernames starting with `guest_` or `system` rejected with 422. | None |
| Client IP rate limiting | `test_prestep2_hardening.py::test_client_ip_hops_from_right` | **DONE** | Right-offset hop counting prevents spoofing. | None |
| Demo guest session | `test_demo.py`, `scripts/smoke.py` | **DONE** | Zero credentials required; 24h TTL applied. | None |
| Upload limits & sanitation | `test_ingestion_pipeline.py`, `test_hostile_security_round.py` | **DONE** | Rejects non-allowlist formats, files > 15MB, files < 500 chars. | None |
| Prompt injection guard | `test_ingestion_break_it.py::test_break_ingestion_prompt_injection` | **DONE** | Evaluator system instruction ignores user override attempts. | None |
| Zero AI calls in combat | `test_gameplay_zero_ai_and_mastery.py` | **DONE** | Mock AI call count verified == 0 during run attempts. | None |
| Answer hiding in dungeon view | `test_contract_parity.py`, `test_questions_pipeline.py` | **DONE** | `GET /dungeons/{id}` strictly strips correct answers, explanations, quotes. | None |
| Weapon security | `test_weapon_security.py` | **DONE** | HTTP 403 `WEAPON_LOCKED` on unearned weapons. | None |
| Room progression rules | `test_run_flow_and_rooms.py` | **DONE** | 409 on alive monster clear; 409 on out-of-order rooms; 409 on finish before boss. | None |
| Spaced repetition ladder | `test_prestep2_hardening.py` | **DONE** | Wrong: 10m + reset; Difficult: 1d; Normal: 3d, 7d, 14d, 30d. | None |
| Tenant isolation | `test_isolation_deep.py` | **DONE** | Account 2 receives 403/404 on Account 1's records. | None |
| Error response shape | `test_error_bodies.py` | **DONE** | Uniform `{"detail": {"code": "...", "message": "..."}}`. | None |
| Gemini Vision OCR | `test_gemini_vision.py` | **DONE** | Inline base64 image data payload correctly built and tested. | None |
| Neon Postgres normalization | `test_db_url_normalization.py` | **DONE** | Converts to `postgresql+asyncpg://` and strips invalid params. | None |

---

## 4. Expected vs. Actual Game Rules Numbers

| Parameter | Game Design Rule (`game-design.md`) | Backend Actual Implementation | Status |
| :--- | :--- | :--- | :--- |
| Starter Weapon (Rusty Dagger) Base Damage | 20 HP | 20 HP | **MATCH** |
| Iron Longsword Base Damage (Level 2 Unlock) | 28 HP | 28 HP | **MATCH** |
| Battleaxe Base Damage (Level 4 Unlock) | 35 HP | 35 HP | **MATCH** |
| Flame Sigil Base Damage (Level 6 Unlock) | 40 HP | 40 HP | **MATCH** |
| Streak Critical Multiplier | 1.5x (applied on streak $\ge 3$) | 1.5x | **MATCH** |
| Hard Question Multiplier | 1.25x | 1.25x | **MATCH** |
| Normal Monster Counter-Damage | 10 HP | 10 HP | **MATCH** |
| Boss Monster Counter-Damage | 12 HP | 12 HP | **MATCH** |
| Normal Room Clear XP | 25 XP | 25 XP | **MATCH** |
| Boss Room Clear XP | 100 XP | 100 XP | **MATCH** |
| SRS Wrong Answer Penalty | 10 minutes interval, streak reset to 0 | 10 minutes (0.00694 days), streak reset to 0 | **MATCH** |
| SRS Difficult Correct Interval | 1 day at every streak tier | 1.0 day | **MATCH** |
| SRS Normal Correct Sequence | 3 days, 7 days, 14 days, 30 days | 3 days, 7 days, 14 days, 30 days | **MATCH** |
| Mastery Bands | Weak: <50%, Learning: 50-79%, Strong: $\ge$80% | Weak (<50%), Learning (50-79%), Strong ($\ge$80%) | **MATCH** |

---

## 5. Security & Isolation Sweep Findings
1. **Timing Oracle Protection**: `verify_password(password, DUMMY_ARGON2_HASH)` is invoked when a username is not found in the database.
2. **Reverse Proxy Spoofing**: `get_client_ip()` slices from the *right* using `TRUSTED_PROXY_COUNT=1`, discarding arbitrary leftmost attacker-controlled values.
3. **Session Revocation**: `users.session_version` integer increments upon logout. Stale cookies fail session authentication immediately.
4. **Secret Leakage Audit**:
   - Zero hardcoded credentials or `AIzaSy` keys in code or commit history.
   - `git check-ignore -v .kiro` returns nothing (all Kiro files tracked).
   - `.gitignore` rigorously excludes `.env`, `*.db`, caches, and uploads.

---

## 6. Deployment Readiness
- **Production Dockerfile**: Slim Python 3.11 image with non-root `appuser`, Tesseract OCR, curl healthcheck, and auto-migrating entrypoint (`alembic upgrade head && python -m app.demo.seed`).
- **Render Blueprint**: Configured in `backend/render.yaml` with zero real secrets (`sync: false`).
- **Readiness Probes**:
  - `GET /health`: Instant, DB-free status check.
  - `GET /health/ready`: Validates live database connectivity.

*Unverified Deployment Activities (Honest Disclosure)*:
- Live Docker container build was not executed directly in this local agent environment due to no local Docker daemon.
- Live deployment to Render, Neon, and Vercel was not directly executed (must be initiated by the human administrator).
- Live Gemini API call using a real billing key was not run automatically by pytest (verified with unit mock tests; opt-in script provided at `backend/scripts/live_gemini_check.py`).

---

## 7. Human "Only You Can Do" Checklist
1. **Merge PR**: Merge PR on branch `feature/backend-02-ingestion` into `main` on GitHub.
2. **Database Provisioning**: Create free PostgreSQL instance on [Neon](https://console.neon.tech) and copy connection string into Render `DATABASE_URL`.
3. **Render Deployment**: Deploy `studydungeon-api` Web Service from `backend/render.yaml`.
4. **Vercel Frontend Configuration**: Set `VITE_USE_MOCKS=false` and confirm `/api/*` rewrite points to the live Render backend.
5. **Live AI Verification**: Run `python backend/scripts/live_gemini_check.py` with your `GEMINI_API_KEY` to confirm Google Gemini 2.0 connectivity.
6. **Video & Devpost**: Record a 2.5-minute gameplay walkthrough following `docs/DEMO_VIDEO_SCRIPT.md` and submit on Devpost before deadline.

