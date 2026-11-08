# Kiroween 2026 Devpost Hackathon Write-up

## 1. Inspiration
Studying dense academic notes and textbook chapters with traditional flashcard apps often feels repetitive. We wanted to fuse classic retro dungeon crawlers (Pokémon/Zelda) with rigorous active recall spaced repetition, turning revision into an engaging gothic RPG adventure.

## 2. What It Does
StudyDungeon ingests student study notes (PDFs, DOCX, PPTX, TXT, images) and clusters them into 2 to 6 topic rooms. Each room features an academic monster whose HP is depleted by answering grounded multiple-choice questions. In-game combat is strictly authoritative on the FastAPI backend: correct answers unleash weapon damage and streak criticals, while wrong answers deal player damage and schedule the question into a deterministic spaced repetition ladder.

## 3. How We Built It
- **Backend & AI Architecture (Person A):** FastAPI, SQLAlchemy 2.0 (asyncio), Alembic migrations, Argon2id password hashing, and the model named in the `GEMINI_MODEL` environment variable (multimodal vision, with deterministic offline mock provider for automated testing). A Google AI Studio API key (free tier works).
- **Frontend & Game Engine (Person B):** React 18, TypeScript, Tailwind CSS, and Phaser 3 rendering retro 2D pixel-art dungeons, procedural rooms, and combat animations.
- **Deterministic RPG Authority:** The AI strictly extracts study chunks and proposes candidate questions with verbatim evidence citations. The backend Python engine authoritatively computes all combat damage, streak multipliers, weapon unlocks, XP progression, and SRS review intervals. The AI never decides HP, XP, damage, or review intervals.
- **Security & Integrity:** Session cookies with SameSite/HttpOnly flags, database-backed rate limiting, reverse-proxy spoofing protections via right-hand IP hop offsets, and zero-hallucination evidence quotes verified verbatim against source chunk text.

## 4. Kiro Features Used

### 4.1 Kiro IDE, CLI, Web, Crew: How Did They Differ?

[FILL IN: Which sessions used Kiro IDE, which used the CLI or web interface, and whether Kiro Crew was used at all? The logs record work by date and step but do not name the tool used for each session.]

### 4.2 Custom Agents

[FILL IN: Were any custom agents (`.kiro/agents/`) created or used during this project? No `.kiro/agents/` directory was found in the repository.]

### 4.3 Agent Hooks

One hook exists in `.kiro/hooks/`:

- **`backend-test-on-save.json`** — triggers `pytest backend/tests` on save of any `backend/**/*.py` file.

Note: this hook uses the schema format `"version": "1.0"` / `"events": ["file_save"]`, which differs from the current Kiro v1 hook schema (`"version": "v1"`, `"trigger": "PostFileSave"`). Whether this hook actually fired during development sessions is not recorded in `docs/kiro-log-backend.md`. [FILL IN: Did this hook fire during your sessions? Were there any hook-triggered test runs shown in Kiro's output?]

### 4.4 Spec-Driven Development vs Vibe Coding

Spec-driven development was used for all backend features and most frontend features. The following specs exist in `.kiro/specs/`:

| Spec folder | Tasks ticked |
|---|---|
| `backend-01-foundation-auth-guest` | 10 / 10 |
| `backend-02-document-ingestion` | 10 / 10 |
| `backend-03-ai-questions` | 8 / 8 |
| `backend-04-game-state-srs` | 10 / 10 |
| `backend-05-demo-seed` | 8 / 8 |
| `backend-06-deploy-hardening` | 8 / 8 |
| `frontend-00-playable-slice` | 36 / 39 |
| `frontend-03-phaser-core` | 41 / 42 |
| `frontend-04-rpg-ui-combat-flow` | 79 / 80 |
| `frontend-06-halloween-visuals` | 46 / 47 |

All six backend specs are fully ticked. The three frontend specs with open tasks are not regressions; the open items are noted in the frontend log as pending (e.g., user FPS readings in `frontend-06`).

[FILL IN: Was any part of the project built in "vibe" (conversational) mode rather than via a spec? If so, which parts?]

### 4.5 Steering Docs

Eight steering files exist in `.kiro/steering/`:

| File | Purpose as recorded in `kiro-log-backend.md` |
|---|---|
| `product.md` | Product vision, core player journey, and scope boundaries. |
| `tech.md` | Fixed technical stack selections (FastAPI, SQLAlchemy 2.0, PostgreSQL, Gemini, Phaser 3). |
| `architecture.md` | System architecture, layer diagrams, request flow, session cookies via Vercel proxy, cold-start handling. |
| `api-contract.md` | REST API specifications, status codes, and JSON schemas for all endpoints. |
| `game-design.md` | Authoritative combat math, weapon baselines, damage multipliers, and SM-2 spaced repetition rules. |
| `security-and-uploads.md` | Argon2 password hashing rules, upload restrictions, and anti-prompt-injection policies. |
| `coding-standards.md` | Python/FastAPI conventions, Pydantic validation standards, and project organization. |
| `team-ownership.md` | Division of ownership between Person A (backend) and Person B (frontend/game). |

The log records that all steering files were created on 2026-11-08 Session 1 and were used as architectural contracts throughout development. [FILL IN: Did Kiro actively read these steering files during spec sessions, or were they used only as human reference? Any examples where a steering rule visibly influenced generated code?]

### 4.6 MCP

Not used. No `.kiro/settings/mcp.json` exists in the repository and no MCP server references appear in any log.

### 4.7 Property-Based Testing (Hypothesis)

Hypothesis property-based tests were written as part of the backend development. Evidence from `docs/kiro-log-backend.md`:

- Step 0 (Baseline BREAK IT Round): Hypothesis PBT was used to verify combat damage invariants and SRS interval safety.
- Step 1: PBT on SRS ladder monotonicity across streak range [0, 25].
- Step 3: PBT on evidence-quote substring invariant (only verbatim substrings pass).
- Gap Closure: Hypothesis PBT across all weapon types verifying damage math.

**Six `@given` tests as of commit fd78b92, across four files:**

| File | Test | Areas covered |
|---|---|---|
| `test_break_baseline.py` | `test_pbt_combat_damage_safety_and_invariants` | Damage/streak math — any input, any streak |
| `test_break_baseline.py` | `test_pbt_srs_intervals_safety` | SRS — negative/arbitrary repetition states do not crash |
| `test_ingestion_jobs_and_hypothesis.py` | `test_hypothesis_attempt_idempotency_structure` | attempt_id UUID determinism |
| `test_prestep_fixes.py` | `test_pbt_srs_ladder_monotonicity` | SRS correct answers always land on {1.0, 3.0, 7.0, 14.0, 30.0} days |
| `test_questions_pipeline.py` | `test_pbt_evidence_quote_invariant` | Evidence-quote validation — fabricated strings rejected |
| `test_weapon_security.py` | `test_hypothesis_damage_math_over_every_weapon` | All real weapon names, all difficulty levels |

**Bug caught by Hypothesis:** The log records that in Step 0, clamping of negative repetition in SRS was fixed (negative `current_repetition` caused incorrect interval output before `test_pbt_srs_intervals_safety` was green).

[FILL IN: Were the Hypothesis tests written by you manually, generated by Kiro, or a combination? Were they run inside Kiro sessions or in a separate terminal?]

### 4.8 Kiro Powers

Not used. No powers are installed or referenced in any log or configuration file.

---

## 5. Challenges We Ran Into
- Enforcing deterministic combat math and spaced repetition schedules so that game balance and review dates remain strictly authoritative and never subject to LLM non-determinism.
- Sanitizing and handling diverse student note formats (multi-page scanned PDFs, DOCX, PPTX) while strictly blocking prompt injection attempts embedded in uploaded files.
- Preventing IP-spoofing attacks behind reverse proxies through right-offset hop resolution.

## 6. Accomplishments That We're Proud Of
- 96 tests as of commit fd78b92 (0 failures) — unit, integration, and Hypothesis property-based tests across the backend.
- Zero-AI "Try the Demo" guest experience allowing hackathon judges to immediately play the game without sign-up or AI API keys.
- Clean separation of team ownership between Person A (backend/AI) and Person B (frontend/game).

## 7. What We Learned
- Designing authoritative game state architectures in FastAPI with append-only attempt logs.
- Crafting resilient document extraction pipelines with PyMuPDF, python-docx, and python-pptx.
- How to use Kiro Specs and Steering to maintain architectural consistency across a multi-feature project.

## 8. What's Next for StudyDungeon
- Collaborative multiplayer study dungeons where classmates team up to fight a shared final exam boss.
- Anki and Quizlet deck bidirectional synchronization.
- Custom pixel-art sprite unlocks for mastery milestones.

## 9. Built With
- FastAPI
- Google AI Studio (model configured via `GEMINI_MODEL` environment variable; free tier works)
- Phaser 3
- React
- SQLAlchemy & Alembic
- Python 3.11
- TypeScript
- Docker

---

## Changes and Placeholders Log

### Claims removed or corrected from the previous version of this file:
1. "Google Gemini 2.0" → replaced with "the model named in the `GEMINI_MODEL` environment variable" everywhere.
2. "82 unit, integration, and Hypothesis property-based tests" → replaced with "96 tests as of commit fd78b92".
3. Section "4. Kiro Features Used" was a flat bullet list without distinguishing between verified and unverified. Replaced with 8 labelled subsections sourced from repo evidence only.
4. Claimed Kiro Spec `requirements.md`, `design.md`, and `tasks.md` were used — **verified**: 10 spec folders found in `.kiro/specs/` with tick counts above.
5. Claimed Kiro Steering was used for architectural contracts — **verified**: 8 steering files found in `.kiro/steering/`.
6. Claimed a hook `backend-test-on-save.json` exists — **verified**: file exists. Whether it fired is unverified.
7. Removed claim "Other Kiro Features: Not used" as an undifferentiated catch-all; replaced with explicit per-feature "Not used" statements for MCP and Powers.

### [FILL IN] placeholders inserted (require human input):
- `[FILL IN: 4.1]` — Which tool (IDE / CLI / Web / Crew) was used in which sessions?
- `[FILL IN: 4.2]` — Were any custom agents created?
- `[FILL IN: 4.3]` — Did the `backend-test-on-save` hook actually fire?
- `[FILL IN: 4.4]` — Was any part of the project built in vibe mode?
- `[FILL IN: 4.5]` — Did Kiro actively read steering files during sessions?
- `[FILL IN: 4.7]` — Were Hypothesis tests written manually or generated by Kiro?
