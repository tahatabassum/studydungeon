# Requirements Document

## Introduction

Two changes ship together. Part A removes the "answer the same question again" behaviour after a wrong answer: a missed question goes to the Memories queue (the review queue behind `GET /reviews/due`, shown as the Daily Haunt and haunted memories) and is practised there later. Part B is a pre-deployment audit of the whole project (Render backend, Neon PostgreSQL, Vercel frontend) with small safe fixes and a written deployment guide.

Findings from code exploration that shape these requirements:
- The backend already writes a `ReviewItem` due in 10 minutes on every wrong answer (`backend/app/api/runs.py`, section "SRS Queue Update") but also returns `requeue_after: 3` in the `AttemptResponse`.
- The frontend (`frontend/src/pages/usePlaySession.ts`) turns `requeue_after` into `pendingRequeue`, then `chooseQuestion` presents the missed question again after the gap, and the Memory scroll offers a "Quick retry" button.
- `pickQuestionId` cycles `pool[count % pool.length]`, so once a monster's pool is exhausted the rotation wraps and asks the missed question again.
- `backend/tests/test_floor_campaign_e2e.py` asserts `requeue_after == 3`.
- `docs/DEPLOY_CHECKLIST.md` already exists and is extended, not replaced.

## Glossary

- **Play_Session**: The frontend combat flow in `frontend/src/pages/usePlaySession.ts` and `PlayPage.tsx`.
- **Question_Selector**: The pure frontend logic choosing the next question for a monster (`questionSelector.ts` and `chooseQuestion`).
- **Encounter**: One monster fight inside one room of a Run.
- **Run**: One playthrough created by `POST /runs`.
- **Missed_Question**: A question answered wrongly during the current Run.
- **Memories_Queue**: The player's `ReviewItem` rows, served by `GET /reviews/due` and presented as the Daily Haunt and haunted memories.
- **Attempt_API**: `POST /runs/{id}/attempts`.
- **Backend**: The FastAPI service under `backend/`.
- **Frontend**: The React and Phaser app under `frontend/`.
- **Offline_Module**: The offline demo adapter (`frontend/src/offline`) and the mock adapter (`frontend/src/api/mock`).
- **Audit**: The pre-deployment review described in Requirements 4 to 10.
- **Deploy_Checklist**: The file `docs/DEPLOY_CHECKLIST.md`.
- **Secret**: An API key, `SECRET_KEY`, database credential or session token value.

## Requirements

### Requirement 1: Missed questions leave the fight

**User Story:** As a student, I want a question I answered wrongly to leave the fight, so that I am not forced to answer it again immediately.

#### Acceptance Criteria

1. WHEN the Attempt_API reports a wrong answer, THE Question_Selector SHALL exclude that question from every later selection in the same Run.
2. WHEN the player continues after a wrong answer, THE Play_Session SHALL present the next question the player has not answered in the current Encounter.
3. THE Frontend SHALL NOT display a "Quick retry" control or a "The question returns" notice after a wrong answer.
4. WHEN a wrong answer is shown, THE Frontend SHALL show the correct answer, the evidence quote and a line stating that the question was saved to Memories.
5. THE Attempt_API SHALL return the same response fields as before, with `requeue_after` absent for wrong and correct answers.

### Requirement 2: Fights continue when pools run low

**User Story:** As a student, I want fights to continue sensibly when a monster has few questions, so that a miss never soft-locks the encounter.

#### Acceptance Criteria

1. WHEN the monster's own question list has no unanswered question and the monster is alive, THE Question_Selector SHALL select an unused question from the same topic in the dungeon question pool.
2. WHEN no unused question from the same topic remains, THE Question_Selector SHALL select a question the player answered correctly in the current Run.
3. IF every remaining question in the topic is a Missed_Question, THEN THE Play_Session SHALL end the Encounter through the existing retreat flow and keep the Run state unchanged.
4. THE Question_Selector SHALL NOT select a Missed_Question in any fallback step.

### Requirement 3: Wrong answers keep their cost

**User Story:** As a student, I want wrong answers to keep their cost and stay server-decided, so that the game remains fair.

#### Acceptance Criteria

1. WHEN a wrong answer is submitted, THE Backend SHALL reduce player HP by 10, or by 12 for a boss room, and deal 0 damage to the monster.
2. THE Frontend SHALL display correctness, damage and HP exactly as returned by the Attempt_API.
3. WHEN a wrong answer is submitted, THE Backend SHALL create or update the `ReviewItem` for the question with `due_at` 10 minutes after the attempt and `last_result` set to `wrong`.
4. WHEN an attempt is replayed with the same `attempt_id`, THE Backend SHALL return the stored result without creating a second `ReviewItem`.

### Requirement 4: Missed questions appear in Memories

**User Story:** As a student, I want to find my missed questions in Memories, so that I can recall them later.

#### Acceptance Criteria

1. WHEN a Missed_Question becomes due, THE Backend SHALL include the question in the `GET /reviews/due` response without its answer.
2. THE Frontend SHALL label the review surface "Memories" on the dashboard card and the Haunt page, with the Daily Haunt button kept as the entry point.
3. WHEN the player rests a Missed_Question correctly in the Daily Haunt, THE Backend SHALL schedule the next review by the SM-2 simplified intervals.
4. WHEN no memories are due, THE Frontend SHALL show the next due time returned by the Backend.

### Requirement 5: Automated proof of no re-ask

**User Story:** As a developer, I want automated proof that missed questions are not re-asked, so that the behaviour does not regress.

#### Acceptance Criteria

1. THE Frontend test suite SHALL contain a test showing that a Missed_Question is not presented again in the same Run, including after the monster's pool wraps.
2. THE Frontend test suite SHALL contain a test for the exhausted-pool fallback order in Requirement 2.
3. THE Backend test suite SHALL contain a test showing that a wrong attempt creates a `ReviewItem` due in 10 minutes and that `GET /reviews/due` lists it when due.
4. THE Backend test suite SHALL contain a test showing that the Attempt_API response omits `requeue_after`.
5. THE Offline_Module SHALL follow the same no-re-ask behaviour as the real Backend.

### Requirement 6: No secrets in the repository

**User Story:** As the project owner, I want no secret leaked in the repository, so that deployment does not expose credentials.

#### Acceptance Criteria

1. THE Audit SHALL scan `git ls-files` and the full git history for key patterns (`AIza`, `sk-or-`, `GEMINI_API_KEY=`, `OPENROUTER_API_KEY=`, `SECRET_KEY=`, database URLs with embedded passwords).
2. IF the scan finds a real Secret, THEN THE Audit SHALL record the file and commit in the Deploy_Checklist with a rotate-and-remove remediation, without printing the Secret value.
3. THE repository `.gitignore` SHALL list `.env`, `*.db`, `local.backup-before-cleanup.db`, `.hypothesis` and virtual environments.
4. IF a path in requirement 6.3 is tracked by git, THEN THE Audit SHALL untrack it with `git rm --cached` and keep the local file.
5. THE Frontend production bundle SHALL contain no AI key or Secret value.

### Requirement 7: Safe production configuration

**User Story:** As the operator, I want production configuration to fail fast when unsafe, so that a misconfigured deploy is caught at startup.

#### Acceptance Criteria

1. THE Backend SHALL read every setting through `pydantic-settings` in `backend/app/core/config.py`.
2. IF `COOKIE_SECURE` is true or `DEBUG` is false and `SECRET_KEY` equals the built-in default or is shorter than 32 characters, THEN THE Backend SHALL refuse to start with a clear error.
3. THE backend and frontend `.env.example` files SHALL list every required variable by name with placeholder values only.
4. WHERE `COOKIE_SECURE` is true, THE Backend SHALL set session cookies with `Secure`, `HttpOnly` and `SameSite=Lax`.
5. THE Backend CORS allow-list SHALL contain the value of `FRONTEND_ORIGIN` and no wildcard when credentials are allowed.

### Requirement 8: Neon-ready database layer

**User Story:** As the operator, I want the database layer to work on Neon, so that the backend connects and migrates on first deploy.

#### Acceptance Criteria

1. WHEN `DATABASE_URL` uses `postgres://` or `postgresql://`, THE Backend SHALL convert it to `postgresql+asyncpg://` and translate `sslmode=require` into asyncpg SSL arguments.
2. THE Backend SHALL create the async engine with `pool_pre_ping` enabled and pool settings suitable for a serverless PostgreSQL database that suspends.
3. THE Alembic migration chain SHALL have exactly one head and SHALL contain no SQLite-only constructs.
4. WHEN the container starts, THE Backend SHALL run `alembic upgrade head` through the sync Postgres driver before serving requests.
5. WHERE Docker or a local PostgreSQL is available, THE Audit SHALL run `alembic upgrade head` against a throwaway PostgreSQL database.

### Requirement 9: Security controls verified

**User Story:** As the operator, I want security controls verified, so that the public deployment is safe.

#### Acceptance Criteria

1. THE Audit SHALL verify that every private query filters by `user_id == current_user.id`.
2. IF a guest user calls `POST /documents` or `POST /documents/{id}/generate-dungeon`, THEN THE Backend SHALL respond 403.
3. THE Backend SHALL limit login to 10 requests per minute per client IP and `POST /demo/session` to 60 per hour per client IP, using the client IP derived from `X-Forwarded-For` and `TRUSTED_PROXY_COUNT`.
4. WHEN a file is uploaded, THE Backend SHALL check the extension whitelist, the magic bytes and `MAX_UPLOAD_MB`, store it under a `uuid4` name and delete it after extraction.
5. THE AI system prompt SHALL instruct the model to ignore commands inside user notes.
6. IF an unhandled exception occurs, THEN THE Backend SHALL return a unified error body without a stack trace.
7. THE Audit SHALL run `pip-audit` and `npm audit --omit=dev` and record the results in the Deploy_Checklist.

### Requirement 10: Deploy artifacts verified

**User Story:** As the operator, I want the deploy artifacts verified, so that Render and Vercel builds succeed.

#### Acceptance Criteria

1. THE backend Dockerfile SHALL start uvicorn on host 0.0.0.0 and port `$PORT`, run as a non-root user, install `tesseract-ocr` and pass proxy header settings.
2. THE Render health check path SHALL equal a route that returns 200 without authentication.
3. WHEN `npm run build` runs with `VITE_API_BASE=/api` and `VITE_USE_MOCKS=false`, THE Frontend SHALL build without errors.
4. THE `frontend/vercel.json` SHALL rewrite `/api/:path*` to the Render service and SHALL include a SPA fallback so a deep link such as `/dashboard` returns `index.html`.
5. IF the Backend does not answer within 8 seconds, THEN THE Frontend SHALL offer the offline demo.

### Requirement 11: Deployment record and guide

**User Story:** As the owner, I want a written record and a deployment guide, so that I can deploy and verify without guessing.

#### Acceptance Criteria

1. THE Deploy_Checklist SHALL record what was checked, what was fixed and what remains, with no Secret values.
2. THE Deploy_Checklist SHALL give step-by-step Render, Neon and Vercel instructions with environment variable names only.
3. THE Deploy_Checklist SHALL list post-deploy smoke tests: `/health`, demo session, register and login, one combat attempt, and a deep-link reload.

### Requirement 12: Full verification before release

**User Story:** As a maintainer, I want the full verification suites green before release, so that nothing regressed.

#### Acceptance Criteria

1. WHEN verification runs, THE Backend test suite and `ruff` SHALL pass with `AI_PROVIDER=mock`, `GEMINI_MODEL=mock`, empty keys and a temporary SQLite database.
2. WHEN verification runs, THE Frontend typecheck, lint and full test suite SHALL pass.
3. THE final commits SHALL stage files by explicit path and SHALL exclude `.env*` and `*.db` files.
