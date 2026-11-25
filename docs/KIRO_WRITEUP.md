# StudyDungeon: Kiro Write-up

StudyDungeon turns a student's notes (PDF, DOCX, PPTX, TXT, images) into a playable 2D dungeon. Topics become rooms, key concepts become monsters, and source-grounded multiple-choice questions are the attacks. The FastAPI backend is authoritative for damage, HP, XP, score and spaced repetition. The AI only extracts topics and proposes questions with verbatim evidence quotes, and only during ingestion.

Two people built it with Kiro: Muhammad Abdullah (Person A) owned `backend/**`, and M Taha Tabassum (Person B) owned `frontend/**` (see `.kiro/steering/team-ownership.md`).

This file answers the judges' Kiro questions in order. Anything only the team can know is marked `[FILL IN: ...]`.

---

## 1. Which Kiro apps did we use (IDE, CLI, Web, Crew)?

The repo evidence shows `.kiro/specs`, `.kiro/hooks` and `.kiro/steering`, which the Kiro IDE and agent read. The logs (`docs/kiro-log-backend.md`, `docs/kiro-log-frontend.md`) record work by date and step. The team confirms that all of it was done in the Kiro IDE.

- Kiro IDE: Yes, and it was the only Kiro app we used. Every session ran inside the Kiro IDE: writing specs (requirements, design, tasks), steering files, hooks, and sub-agent task execution.
- Kiro CLI: Not used.
- Kiro Web: Not used.
- Kiro Crew: Not used.
- How they differed in practice: Not applicable, since we used only the IDE.

## 2. Custom agents and sub-agents

No `.kiro/agents/` directory exists, so we did not define custom agents. What we did use is Kiro's built-in orchestration. This ran in the Kiro IDE.

**Spec workflow agents.** Each spec's `.config.kiro` records the workflow that generated it:
- `requirements-first` (requirements, then design, then tasks): `frontend-00`, `frontend-03`, `frontend-04`, `frontend-06`, `frontend-07`, `frontend-08`, `frontend-10`, `frontend-11`.
- `fast-task` (clarify, requirements, design, tasks, review in one pass): `frontend-12`, `frontend-13`, `frontend-14`, `docs-submission-cleanup`.
- Design-first and bugfix workflows: `[FILL IN: used or not. No spec in .kiro/specs has these workflow types in its .config.kiro.]`

**Spec-task-execution sub-agents.** An orchestrator agent read each `tasks.md`, dispatched one sub-agent per task, and marked tasks done. The logs say:
- `docs/kiro-log-frontend.md` line 58: one sub-agent per phase for `frontend-07`.
- Line 468: `frontend-08` Phase 1 ran as 19 tasks sent to sub-agents through the Kiro task tools, in waves of 3 to 5 parallel tasks.
- Line 474 (lesson): one dispatch failed on server load after already writing files. The re-dispatch reviewed those files instead of rewriting them. Parallel agents also reported typecheck and lint errors caused by each other's half-written files, so full verification ran only after a wave finished.
- Line 407: some phases used no sub-agents, so this was not applied everywhere.

**Dependency waves.** `tasks.md` files end with a `waves` JSON block that lists which tasks can run together. Example from `frontend-13-polish-and-nav`: the back-navigation guard (`RequireVisitor` plus `replace: true` navigation), the hero primary CTA, the CSS card primitives and the `EmptyState` component were independent, so five agents built them in parallel. File ownership rules in the task text kept agents out of each other's files (for example, only the task that owned `src/App.tsx` edited it). Tests and the pass that wired everything together waited for the next wave. `docs-submission-cleanup/tasks.md` uses the same format (wave 6 holds only task 3.2).

**Interrupted tasks.** The orchestrator, not the sub-agent, changed task status. Interrupted tasks were re-dispatched from the same `tasks.md` entry.

## 3. Agent hooks

Two hooks exist in `.kiro/hooks/`:

| Hook file | Trigger | What it runs | Impact |
|---|---|---|---|
| `backend-test-on-save.json` | `file_save` on `backend/**/*.py` | `pytest backend/tests` | Every backend save runs the suite, so a broken SRS or combat change shows up immediately. Written in the older `"version": "1.0"` / `events` format. `[FILL IN: did it actually fire in your sessions?]` |
| `frontend-lint-test-on-save.json` | `PostFileSave`, matcher `frontend/src/**/*.ts` and `.tsx` | `cd frontend && npm run lint && npm run typecheck && npm test` (timeout 300 s) | Lint, types and the full vitest run after each source save. Uses the current `"version": "v1"` schema. `[FILL IN: any example where it caught a mistake.]` |

The hook prefixes follow the ownership rule: `backend-*` belongs to Person A, the frontend hook to Person B.

## 4. Spec-driven development

**Structure of each spec** (`.kiro/specs/<name>/`):
1. `requirements.md`: user stories and acceptance criteria in EARS form ("WHEN ..., THE App SHALL ...").
2. `design.md`: architecture, interfaces, and numbered correctness properties (for example "Property 1: Authenticated users never see an Entry_Route").
3. `tasks.md`: checkbox tasks, each linked to requirement numbers, property-test tasks tagged `**Validates: Requirements x.y**`, and a `waves` block for parallel execution.

**Specs in the repo (20):**
- Person A, `backend-*` (8): `backend-01-foundation-auth-guest`, `backend-02-document-ingestion`, `backend-03-ai-questions`, `backend-04-game-state-srs`, `backend-05-demo-seed`, `backend-06-deploy-hardening`, `backend-07-prerequisites-and-identity`, `backend-08-packs-and-floors`. Specs 01 to 06 are fully ticked. `backend-07` was still unticked when this was written.
- Person B, `frontend-*` (11): `frontend-00-playable-slice`, `frontend-03-phaser-core`, `frontend-04-rpg-ui-combat-flow`, `frontend-06-halloween-visuals`, `frontend-07-premium-ux-leaderboard`, `frontend-08-campaign-learning-loop`, `frontend-10-live-players`, `frontend-11-layout-fixes`, `frontend-12-leaderboard-layout`, `frontend-13-polish-and-nav`, `frontend-14-no-retry-and-predeploy-audit`.
- Other (1): `docs-submission-cleanup` (this documentation pass).

The prefix decides the owner. Person A did not edit `frontend-*` specs and Person B did not edit `backend-*` specs.

**Where specs beat vibe coding:**
- **Leaderboard header clipped.** `frontend-12-leaderboard-layout` exists because `scripts/layout-check.mjs` measured a clipped table header. A higher-specificity visually-hidden (sr-only) rule hit `.sd-lb__thead`. The design (line 29) overrides it with `position: static; width: auto; height: auto; overflow: visible; clip: auto`, and the check is the acceptance test. Careful prompting would likely have restyled the table and missed the cause.
- **Back navigation.** `frontend-13` wrote down the problem as requirements first: after login or demo start, Back must not return to `/`, `/login` or `/register`. The design lists every call site and its change (`AuthForm.tsx`, `useStartDemo.ts`, `useLogout.ts` need `{ replace: true }`; `useCreateGuest.ts` and `NameScreen.tsx` already had it) and adds a `RequireVisitor` route guard. A chat session would probably have fixed one call site.
- **Missed questions are not re-asked.** `frontend-14` found that the backend stored a 10-minute review but also returned `requeue_after: 3`, and the frontend used that to re-ask. The spec decided the frontend owns the fix and the backend only omits the field, then required property tests (`frontend/src/state/questionSelector.test.ts`).
- **Pre-deploy audit.** Part B of `frontend-14` reviewed the deploy files before shipping. Its design notes flagged: `backend/render.yaml` sits in `backend/` although Render reads blueprints from the repo root, so the guide must say to move it or create the service by hand; `db_url.py` drops `sslmode`, so asyncpg SSL arguments must be re-added for Supabase URLs. The requirements then say `postgres://` and `postgresql://` URLs are converted to `postgresql+asyncpg://` with `sslmode=require` translated. The same audit looked at prompt-injection handling in ingestion `[FILL IN: confirm the missing guard it found and where it was fixed.]`

**Honest comparison with vibe coding.** Specs cost time up front. A small fix still needed requirements, a design and tasks, and we sometimes wrote more spec text than code. They paid off when a change touched many files (navigation, layout), when two people depended on one contract, and when we needed a test to prove a behavior stayed fixed. We did not use specs for every quick tweak. `[FILL IN: which parts, if any, you built conversationally.]`

## 5. Steering docs

Nine files in `.kiro/steering/`:

| File | Role |
|---|---|
| `product.md` | Vision, player journey, MVP scope and out-of-scope list. |
| `tech.md` | Fixed stack and four hard rules: server authority, no in-combat AI, per-user data scoping, secrets only in backend env. |
| `architecture.md` | Layers, request flow, cookie sessions through the Vercel proxy, ingestion pipeline, cold-start handling. |
| `api-contract.md` | Endpoint shapes, status codes and error format. The single source of truth for both sides. |
| `game-design.md` | HP, weapon damage, multipliers, scoring, SM-2 intervals. |
| `security-and-uploads.md` | Argon2, cookie rules, upload limits, prompt-injection defense. |
| `coding-standards.md` | Python typing, Pydantic v2, async SQLAlchemy, directory layout. |
| `team-ownership.md` | Who owns which paths, specs, hooks and handoff files. |
| `frontend-ui-standards.md` | Frontend UI conventions for Person B's work. |

**Strategy.** Steering was the contract between the two of us. Neither person edited a steering file alone. Changes were proposed as markdown diffs in `docs/handoff/A-to-B.md` or `docs/handoff/B-to-A.md` and committed after both agreed. `api-contract.md` was the only reference for wire formats, so the frontend could build a mock client and contract tests (`frontend/src/contract/suite.ts`) before the backend endpoints existed.

**Biggest difference.** `[FILL IN: your pick. Candidates the repo supports: api-contract.md (frontend built against it before the backend was ready) and game-design.md (combat numbers match in both halves).]` `[FILL IN: any case where a steering rule visibly changed generated code.]`

## 6. MCP

`[FILL IN: MCP servers used, if any.]` No `.kiro/settings/mcp.json` exists in the repo and no log mentions an MCP server. `[FILL IN: if web search or fetch was used for provider docs, say so here.]`

## 7. Property-based testing

**Frontend (fast-check, vitest).** 11 property-test files were listed in the first frontend log entry, and many more were added later (`frontend/src/**/*.property.test.ts`, for example `api/wire/wire.property.test.ts`, `audio/sfx.property.test.ts`, `board/board.property.test.ts`, `encounter/revenants.property.test.ts`, `game/viewport.property.test.ts`). Specific ones named in this write-up:
- `state/questionSelector.test.ts`: the selector never returns a missed question and falls back from the monster pool to an unused same-topic question in a fixed order.
- `dashboard/heroCta.test.ts`: the Hero shows exactly one primary CTA (Property 5 of `frontend-13`).
- `RequireVisitor` guard: Properties 1 to 3 of `frontend-13` (signed-in users never see `/`, `/login` or `/register`; the restoring state shows a neutral placeholder).

**Backend (Hypothesis).** `@given` tests live in `test_break_baseline.py`, `test_ingestion_jobs_and_hypothesis.py`, `test_prestep_fixes.py`, `test_questions_pipeline.py`, `test_weapon_security.py` and `test_wrong_answer_memories.py`. They cover:
- Combat damage over every weapon and difficulty (`test_hypothesis_damage_math_over_every_weapon`).
- A wrong answer costs 10 HP (12 for a boss) and deals 0 damage (`test_wrong_answer_memories.py`).
- The SRS 10-minute interval after a wrong answer, and ladder monotonicity over {1, 3, 7, 14, 30} days (`test_pbt_srs_ladder_monotonicity`).
- Evidence-quote validation: only verbatim substrings pass.
- Database URL normalization for `postgres://`, `postgresql://` and `postgresql+asyncpg://` with `sslmode` and other query parameters.

**Real bugs the logs say property tests caught:**
- Preloaded dungeon choice: `pickPreloaded` picked the first open pack by array position instead of its `order` field. Fixed in `src/identity/resolvePreloaded.ts` (`kiro-log-frontend.md:470`).
- `describeLimitError` looked up error codes in a plain object, so the code `constructor` returned garbage. Fixed with `Object.hasOwn` (`:503`).
- Joystick: re-rounding after clamping gave a vector of length 1.001. Clamp now truncates (`:452`).
- Sound effects: Property 16 failed with seed -2109931452 because the fake clock stepped 1000 ms but the `boss` cue has a 1500 ms rate limit. Clock now steps 2000 ms and the counterexample is pinned (`:92`). This was a test bug, not a product bug.
- SRS: negative repetition counts were clamped after the Hypothesis SRS test exposed incorrect intervals (`kiro-log-backend.md:32`).

Two backend logs entries (evidence-quote substring, damage across weapons) were verification only and found no bug.

`[FILL IN: were the property tests written by Kiro, by you, or both?]`

## 8. Kiro powers

`[FILL IN: powers installed or used, if any.]` No power is referenced in the repo or logs.

## 9. Results and lessons

**In numbers** (from the repo at the time of writing):
- 145 commits.
- 20 specs (8 backend, 11 frontend, 1 docs).
- 2 hooks, 9 steering files.
- 165 backend tests and 1554 frontend tests passing `[FILL IN: re-run both suites before submitting and update these numbers]`.
- 89 tracked files under `.kiro/`, none gitignored.

**Lessons:**
- Write the contract first. `api-contract.md` let two people work without waiting on each other.
- A measuring script (`layout-check.mjs`) found layout bugs that screenshots missed. Pair a spec's acceptance criteria with a check that can fail.
- Parallel agents need file-ownership rules, and verification should wait for the end of each wave.
- Property tests found real bugs in small pure functions (selection, parsing, clamping) more often than in screens.
- Deploy files deserve their own audit before shipping.

---

## Project notes

### What it does
Ingests notes, clusters them into 2 to 6 topic rooms, and runs turn-based combat. Correct answers deal weapon damage and streak criticals. Wrong answers cost the player HP and schedule the question into a spaced-repetition ladder.

### Built with
FastAPI, SQLAlchemy 2.0 (async), Alembic, Argon2, Google AI Studio (model set by `GEMINI_MODEL`), React 18, TypeScript, Tailwind CSS, Phaser 3, PostgreSQL, Python 3.11, Docker.

### Challenges
- Keeping combat math and review schedules deterministic and server-side.
- Handling mixed note formats while blocking prompt injection in uploaded files.
- Preventing IP spoofing behind a reverse proxy (client IP is taken `TRUSTED_PROXY_COUNT` hops from the right of `X-Forwarded-For`).

### What's next
Shared multiplayer study dungeons, Anki and Quizlet sync, sprite unlocks for mastery milestones.
