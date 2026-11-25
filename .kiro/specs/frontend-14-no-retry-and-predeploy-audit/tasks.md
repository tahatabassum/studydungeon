# Implementation Plan: No Re-ask After Wrong Answer and Pre-Deploy Audit

## Overview

Part A moves missed questions from an immediate re-ask to the Memories queue. The re-ask lives in the Frontend (`requeue_after` bookkeeping, `chooseQuestion`, "Quick retry", and the wrapping `pickQuestionId`); the Backend already saves a `ReviewItem` due in 10 minutes and only needs to stop sending `requeue_after`. Part B audits secrets, config, database, security and deploy files, fixes small problems, and extends `docs/DEPLOY_CHECKLIST.md` (the file already exists). Then full verification, then commits and push.

Environment notes: Windows PowerShell, single-line commands. `>` writes UTF-16, so use `| Out-File -Encoding utf8`. The user's backend runs on port 8000, so test servers use another port (for example 8011) and a temp DB. Before frontend test commands run `Remove-Item Env:VITE_CONTRACT_LIVE,Env:VITE_API_BASE,Env:VITE_USE_MOCKS,Env:VITE_CONTRACT_UPLOADS -ErrorAction SilentlyContinue`. Backend commands use `.\.venv\Scripts\python.exe`. Never print or commit Secret values. Never modify `backend/.env` or delete `local.db` or any other local file.

## Tasks

- [x] 1. Part A: send missed questions to Memories instead of re-asking
  - [x] 1.1 Add the pure `selectNextQuestion` selector
    - In `frontend/src/state/questionSelector.ts` add `selectNextQuestion` per the design (fresh, same-topic unused, recycled correct, none). Never return a missed id. Keep `pickQuestionId` for existing callers.
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4_

  - [x] 1.2 Wire the selector into the Play_Session and reducer
    - In `frontend/src/pages/usePlaySession.ts` replace the `duePending` branch of `chooseQuestion` with `selectNextQuestion`; keep `missedRef` and `correctRef` sets updated from the server `result.correct` only; on `none` use the existing retreat flow with the message "No fresh questions left here. Your missed questions are waiting in Memories."
    - Remove `quickRetry` and `secondChance` state; in `frontend/src/state/runReducer.ts` stop adding to `pendingRequeue` on `result-received` and remove the `requeue-*` actions and `frontend/src/state/pendingRequeue.ts` if nothing else uses them.
    - _Requirements: 1.1, 1.2, 1.3, 2.3, 3.2_

  - [x] 1.3 Update the encounter UI and Memories labels
    - In `frontend/src/learning/MemoryScroll.tsx` and `frontend/src/encounter/EncounterPopup.tsx` remove the Quick retry button, `RequeueNotice` and Second chance tag props; show correct answer, evidence quote and the line "Saved to Memories. You will meet it again in the Daily Haunt."
    - Update `frontend/src/pages/PlayPage.tsx` for the removed props; label the surface "Memories" in `frontend/src/dashboard/ProgressCards.tsx` and `frontend/src/haunt/HauntPage.tsx`, keeping the Daily Haunt button.
    - _Requirements: 1.3, 1.4, 4.2, 4.4_

  - [x] 1.4 Align the offline and mock adapters
    - In `frontend/src/offline/adapter.ts` and `frontend/src/api/mock/mockAdapter.ts` stop re-inserting wrong questions into the queue and stop setting `requeue_after`; a wrong answer still adds the question to the mock due list so Memories shows it.
    - _Requirements: 5.5, 4.1_

  - [x] 1.5 Stop the Backend sending `requeue_after`
    - In `backend/app/api/runs.py` remove `requeue_after=3` in the fresh response and `cached_requeue` in the replay branch. Do not change the schema or other response fields.
    - Update the assertion in `backend/tests/test_floor_campaign_e2e.py` from `requeue_after == 3` to the field being absent.
    - _Requirements: 1.5, 3.4_

  - [x] 1.6 Write the frontend tests for the no-re-ask behaviour
    - Add `frontend/src/state/questionSelector.test.ts` with unit tests for each fallback step and the `none` case.
    - **Property 1: A missed question is never selected again** (fast-check, 100+ runs, includes pools that wrap)
    - **Property 2: Selection fallback order** (fast-check, 100+ runs)
    - **Validates: Requirements 1.1, 2.1, 2.2, 2.3, 2.4**
    - Add a Play_Session test (extend an existing play flow test or add `frontend/src/pages/noReask.test.tsx`) proving a wrongly answered question is not presented again in the same Run, no Quick retry control exists, and the Memories line is shown.
    - Fix existing tests that asserted requeue behaviour (`frontend/src/learning/learningLoop.test.tsx`, `frontend/src/encounter/EncounterPopup.test.tsx`, any play-session tests) so they match the new behaviour.
    - _Requirements: 1.1, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 5.1, 5.2, 5.5_

  - [x] 1.7 Write the backend tests for Memories and combat cost
    - Add `backend/tests/test_wrong_answer_memories.py`: a wrong attempt creates a `ReviewItem` with `due_at` about 10 minutes ahead and `last_result == "wrong"`, `GET /reviews/due` lists it once due (no answer in the payload), the response omits `requeue_after`, a replay with the same `attempt_id` creates no second `ReviewItem`, and HP drops by 10 (12 for the boss room) with `damage_dealt == 0`.
    - **Property 3: Wrong answers cost HP and deal no damage** (Hypothesis, 100+ examples on `calculate_combat_damage`)
    - **Property 4: Wrong answers schedule a review in 10 minutes** (Hypothesis on `calculate_next_review_interval`)
    - **Property 6: Attempt replay is idempotent**
    - **Validates: Requirements 3.1, 3.3, 3.4, 4.1, 1.5**
    - _Requirements: 1.5, 3.1, 3.3, 3.4, 4.1, 5.3, 5.4_

- [x] 2. Checkpoint - Part A complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Part B: pre-deployment audit and fixes
  - [x] 3.1 Secret leak scan and ignore rules
    - Run `git ls-files` and search tracked files and full history (`git log -p`) for `AIza`, `sk-or-`, `GEMINI_API_KEY=`, `OPENROUTER_API_KEY=`, `SECRET_KEY=` and `://user:password@` database URLs. Record findings by file and commit only, never the value; remediation for any real hit is rotate the key and remove it from the tree.
    - Confirm `.gitignore` covers `.env`, `*.db`, `local.backup-before-cleanup.db`, `.hypothesis`, `.venv` and `node_modules`; add missing entries; run `git rm --cached` for any tracked match and keep the local files.
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 3.2 Config, env files, cookies and CORS
    - In `backend/app/core/config.py` add a production validator: refuse to start when `SECRET_KEY` is the built-in default or shorter than 32 characters while `COOKIE_SECURE` is true or `DEBUG` is false. Keep tests working by letting the test settings set a long key.
    - Make `backend/.env.example`, root `.env.example` and `frontend/.env.example` list every required variable (including `DATABASE_URL`, `SECRET_KEY`, `GEMINI_API_KEY`, `AI_PROVIDER`, `FRONTEND_ORIGIN`, `COOKIE_SECURE`, `TRUSTED_PROXY_COUNT`, `MAX_UPLOAD_MB`, `VITE_API_BASE`, `VITE_USE_MOCKS`) with placeholders only.
    - Check `backend/app/main.py` and `backend/app/core/security.py`: cookie `Secure`, `HttpOnly`, `SameSite=Lax` in production; CORS origins come from `FRONTEND_ORIGIN` with no wildcard.
    - Add `backend/tests/test_settings_production.py` covering the validator.
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 3.3 Database layer review and fixes
    - Review `backend/app/core/db_url.py`, `database.py`, `migrations/` and `alembic.ini`: `postgres://` and `postgresql://` convert to asyncpg, `sslmode=require` becomes asyncpg SSL arguments, `pool_pre_ping=True`, a small pool with `pool_recycle` for Neon, and Alembic using the sync driver URL.
    - Verify one Alembic head (`alembic heads`) and no SQLite-only constructs (for example `batch_alter_table` without need, `AUTOINCREMENT`, naive server defaults); run `alembic upgrade head` on a fresh SQLite file and, if Docker or PostgreSQL is available, on a throwaway PostgreSQL database on a non-default port.
    - Fix problems found with small changes.
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 3.4 Write the database URL normalization tests
    - Add `backend/tests/test_db_url_normalization.py` with examples for Neon URLs and a Hypothesis test.
    - **Property 5: Database URL normalization**
    - **Validates: Requirements 8.1**

  - [x] 3.5 Security review and fixes
    - Check every route in `backend/app/api/` for `user_id == current_user.id` scoping; guests receive 403 on `POST /documents` and `POST /documents/{id}/generate-dungeon`; login limit 10/min/IP and demo limit 60/hr/IP with `X-Forwarded-For` parsed by `TRUSTED_PROXY_COUNT`; upload extension whitelist, magic bytes, `MAX_UPLOAD_MB`, `uuid4` temp names and cleanup; the prompt-injection guard text in `backend/app/ai/`; error handlers in `backend/app/core/errors.py` return no stack traces.
    - Fix gaps with small changes and add or extend tests in `backend/tests/test_security_audit.py`.
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 3.6 Dependency vulnerability checks
    - Run `.\.venv\Scripts\python.exe -m pip_audit -r requirements.txt` (install `pip-audit` in the venv only if missing) and `npm audit --omit=dev` in `frontend`; apply safe patch-level upgrades only; record results and any accepted risk for the checklist.
    - _Requirements: 9.7_

  - [x] 3.7 Deploy artifact fixes
    - In `backend/Dockerfile` start uvicorn with `--proxy-headers --forwarded-allow-ips "*"`, keep host 0.0.0.0 and `${PORT}`, keep the non-root user and tesseract; run `docker build` when Docker is available, otherwise review statically.
    - Confirm `healthCheckPath: /health` returns 200 without auth; resolve the `backend/render.yaml` location versus `dockerfilePath: backend/Dockerfile` mismatch (move it to the repo root or fix the paths) and make sure it lists every required variable name.
    - In `frontend/vercel.json` confirm the `/api/:path*` rewrite to `https://studydungeon-api.onrender.com/api/:path*` and add the SPA fallback after it so `/dashboard` returns `index.html`.
    - _Requirements: 10.1, 10.2, 10.4_

  - [x] 3.8 Frontend build, bundle scan and offline fallback
    - Run `npm run build` in `frontend` with `VITE_API_BASE=/api` and `VITE_USE_MOCKS=false`; search `frontend/dist` for `AIza`, `sk-or-`, `GEMINI` and `SECRET_KEY`; confirm the 8 second cold-start fallback to the offline demo still works (existing test or a small new one).
    - _Requirements: 6.5, 10.3, 10.5_

- [x] 4. Write the deploy checklist
  - [x] 4.1 Extend `docs/DEPLOY_CHECKLIST.md`
    - Add sections: what was checked, what was fixed, what remains (including audit results from 3.1 to 3.8), a Render, Neon and Vercel step-by-step guide with environment variable names only, and post-deploy smoke tests (`/health`, demo session, register and login, one combat attempt with a wrong answer then the Memories entry, deep-link reload of `/dashboard`).
    - _Requirements: 11.1, 11.2, 11.3_

- [ ] 5. Full verification
  - [x] 5.1 Backend suite and lint
    - In `backend` run pytest and ruff with `$env:DATABASE_URL='sqlite+aiosqlite:///./sd-probe-tmp.db'; $env:AI_PROVIDER='mock'; $env:GEMINI_MODEL='mock'; $env:GEMINI_API_KEY=''; $env:OPENROUTER_API_KEY=''`, then delete only the `sd-probe-tmp.db` file. Fix failures.
    - _Requirements: 12.1_

  - [x] 5.2 Frontend typecheck, lint and tests
    - Clear the VITE env variables as noted above, then run the typecheck, lint and full `npm test -- --run` in `frontend`. Fix failures.
    - _Requirements: 12.2_

  - [ ] 5.3 Play route layout check
    - Run the existing layout or viewport test for the play and combat route (`frontend/src/encounter/stageLayout.test.ts` and any layout check script) and confirm the Memory scroll without the retry button does not overflow.
    - _Requirements: 1.3, 1.4, 12.2_

- [ ] 6. Commit and push
  - [-] 6.1 Commit the combat change
    - Stage the Part A files by explicit path (never `git add -A`, never `.env*` or `*.db`) and commit with a message starting `fix(combat): send missed questions to Memories instead of re-asking`.
    - _Requirements: 12.3_

  - [ ] 6.2 Commit the audit fixes and push
    - Stage the Part B files and `docs/DEPLOY_CHECKLIST.md` by explicit path and commit with `chore: pre-deploy audit fixes` (or one combined commit with the message `fix(combat): send missed questions to Memories instead of re-asking; chore: pre-deploy audit fixes`); run `git push origin feature/frontend-live-players`.
    - _Requirements: 12.3_

- [ ] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional. Part A tests (1.6, 1.7) are required.
- Do not modify `backend/.env` or delete `local.db` or other local databases.
- Spec work stops at these documents; implementation happens when tasks are executed.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.5", "3.1", "3.2"] },
    { "id": 1, "tasks": ["1.2", "1.4", "1.7", "3.3", "3.5", "3.6", "3.7"] },
    { "id": 2, "tasks": ["1.3", "3.4"] },
    { "id": 3, "tasks": ["1.6", "3.8"] },
    { "id": 4, "tasks": ["4.1"] },
    { "id": 5, "tasks": ["5.1", "5.2", "5.3"] },
    { "id": 6, "tasks": ["6.1"] },
    { "id": 7, "tasks": ["6.2"] }
  ]
}
```
