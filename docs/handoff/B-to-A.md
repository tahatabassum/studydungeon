# Handoff: Person B (game/frontend) to Person A (backend)

Date: 2026-11-07 (spec: frontend-00-playable-slice)

> These shapes are the frontend's working assumptions, built against mock fixtures. They are **replaced by `.kiro/steering/api-contract.md` once Person A publishes it**. The backend remains authoritative for correctness, damage, HP, XP, score and streak.

All requests use `credentials: "include"` against `VITE_API_BASE_URL`. Non-2xx responses are surfaced as a typed `ApiError` carrying the status code.

## Shared types

```ts
interface User { id: string; username: string; is_guest: boolean }
type QuestionType = 'mcq' | 'true_false'
interface Question { id: string; type: QuestionType; prompt: string; options: string[] } // no correct answer, no explanation
interface Monster { id: string; name: string; max_hp: number; question_ids: string[]; kind: string } // CHANGED 2026-11-07: added `kind`
interface Room { id: string; label: string; order: number; is_boss: boolean; monster: Monster } // CHANGED 2026-11-07: added `order`, `is_boss`
interface Dungeon { id: string; name: string; rooms: Room[]; questions: Question[] }
interface Run { id: string; dungeon_id: string; player_hp: number; monster_hp: number; current_room_id: string } // CHANGED 2026-11-07: added `current_room_id`
interface RunSummary { score: number; xp: number; correct: number; total: number; accuracy: number } // NEW 2026-11-07
```

> **Changed 2026-11-07:** `Room.order`, `Room.is_boss`, `Monster.kind`, `Run.current_room_id` and `RunSummary` are new. See the update section at the end of this file.

## Endpoints

### POST /demo/session
- Request: no body.
- Response: `{ user: User, dungeon_id: string, expires_at: string }` (ISO timestamp). `user.is_guest` is `true`.

### GET /dungeons/{id}
- Response: `Dungeon`. Questions never include the correct answer or explanation.

### POST /runs
- Request: `{ dungeon_id: string }`
- Response: `Run`

### POST /runs/{id}/attempts
- Request (only these fields, never a damage value):
  ```ts
  { question_id: string; selected_answer: string; attempt_id: string }
  ```
- `attempt_id` is a client-generated unique id. Resubmitting the same `attempt_id` must return the stored result without changing state (idempotent). The client reuses it when retrying after a failure.
- Response:
  ```ts
  interface AnswerResult {
    correct: boolean
    damage_dealt: number
    monster_hp_remaining: number
    player_hp_remaining: number
    score_delta: number
    xp_delta: number
    streak: number
    source: { page: number; chunk_id: string }
    review_status: 'due' | 'not_due'
    explanation?: string // OPTIONAL
  }
  ```
- `explanation` is optional. The UI shows "From your notes: page X" and appends the explanation only when present; absence is not an error.

### POST /runs/{id}/rooms/{room_id}/clear
- Request: no body.
- Response: `{ xp_delta: number }` (added to HUD XP).
- **Changed 2026-11-07:** multi-room semantics apply (409 while the room's monster is alive, idempotent on repeat). See the update section below.

### POST /runs/{id}/finish (NEW 2026-11-07)
- See the update section below.

## Agreed demo balance values

| Value | Amount |
| --- | --- |
| Player HP | 100 |
| Monster HP | 60 |
| Correct-answer damage (Rusty Dagger) | 20 (limited to remaining monster HP) |
| Wrong-answer player damage | 10 (limited to remaining player HP) |
| score_delta per correct answer | 100 |
| xp_delta per correct answer | 10 |

Wrong answers: `damage_dealt` 0, `score_delta` 0, `xp_delta` 0, streak reset to 0, `review_status` `due`. Correct answers: streak +1, `review_status` `not_due`.

**Person A: please confirm these match `game-design.md` and the backend.** The frontend only uses them inside the mock path (`src/demo/rules.ts`); the real backend decides.

## Demo dungeon JSON shape (bundled placeholder)

`src/demo/demoDungeon.json` follows the public `Dungeon` type: one room ("Chamber of Basics"), one monster ("Skeleton Scribe", `max_hp` 60) and 4 to 5 multiple-choice questions with placeholder content. The answer key (correct answer, explanation, source page) is held separately in the mock (`src/api/mock/answerKey.ts`) and is not part of the `Dungeon` shape.

```json
{
  "id": "demo-dungeon",
  "name": "Demo Dungeon",
  "rooms": [{ "id": "room-1", "label": "Chamber of Basics",
    "monster": { "id": "monster-1", "name": "Skeleton Scribe", "max_hp": 60, "question_ids": ["q1", "q2", "q3"] } }],
  "questions": [{ "id": "q1", "type": "mcq", "prompt": "...", "options": ["...", "...", "...", "..."] }]
}
```

## Open questions for Person A

1. Is `explanation` returned in `AnswerResult`? Always, only on wrong answers, or never?
2. Does the clear-room response carry only `xp_delta`, or also totals (score, level)?
3. What fields does the `Run` response include (HP values, room progress, score)? Are HP values server-tracked per run?
4. Error response format (e.g. `{ "detail": "..." }`, error codes) and which statuses to expect (401, 404, 429, 5xx).
5. For `selected_answer`: is it the option text or an option id? Currently assumed to be the option text; `Question.options` is `string[]`.
6. True/False questions: are the options `["True", "False"]` and is `selected_answer` one of those strings?
7. Cookie and CORS: session cookie name, `SameSite`/`Secure` settings across frontend and API origins, and `Access-Control-Allow-Credentials` with an explicit origin.
8. Guest session lifetime: is `expires_at` fixed (mock uses 24h)? What happens on expiry mid-run?
9. Retry behavior: does starting a new run via `POST /runs` reset room and monster HP for the same dungeon?
10. Is `source.chunk_id` stable, and is `source.page` 1-based?

---

## Update 2026-11-07: frontend-03-phaser-core (multi-room dungeon)

> **Status: Person A has NOT implemented any of these changes yet.** The frontend runs against the mock (`VITE_USE_MOCKS=true`) until Person A confirms the shapes and values below. The backend stays authoritative for correctness, damage, HP, XP, score, streak and the run summary. The frontend never computes them.

### New and changed fields

| Type | Field | Change | Notes |
| --- | --- | --- | --- |
| `Room` | `order: number` | new | Ascending order of rooms in the dungeon. Boss room has the highest `order`. |
| `Room` | `is_boss: boolean` | new | Exactly one boss room, last in order. |
| `Monster` | `kind: string` | new | Visual type id, e.g. `paper_wraith`, `toxic_slime`, `gear_golem`, `memory_eater`, `exam_warden`. Plain string; unknown kinds get a default look on the frontend. |
| `Run` | `current_room_id: string` | new | Room the run is currently in. |
| `RunSummary` | `{ score, xp, correct, total, accuracy }` | new | Returned by finish. |

```ts
interface Monster { id: string; name: string; max_hp: number; question_ids: string[]; kind: string }
interface Room { id: string; label: string; order: number; is_boss: boolean; monster: Monster }
interface Run { id: string; dungeon_id: string; player_hp: number; monster_hp: number; current_room_id: string }
interface RunSummary { score: number; xp: number; correct: number; total: number; accuracy: number }
// AnswerResult and AttemptRequest are unchanged.
```

`Run.monster_hp` is assumed to be the HP of the monster in `current_room_id`.

### POST /runs/{id}/finish

- Request: no body. The run id is in the path. Sent with `credentials: "include"` (session cookie).
- Response (200): `RunSummary`
  ```ts
  { score: number; xp: number; correct: number; total: number; accuracy: number }
  ```
  `accuracy` is a ratio from 0 to 1 (`correct / total`, 0 when `total` is 0). The frontend formats it as a percentage.
- Error: `409` if the boss room has not been cleared yet.
- The frontend calls it right after the boss `clearRoom` succeeds and shows the returned values as received.

### POST /runs/{id}/rooms/{room_id}/clear (multi-room semantics)

- `404` for an unknown room.
- `409` while the room's monster HP is above 0.
- Idempotent: repeating the call for a cleared room returns the same `xp_delta` and changes nothing.
- Success returns `{ xp_delta: number }`.
- Clearing the boss room is followed by `finishRun`.

### Balance values (mock only, Person A please confirm)

| Value | Topic rooms | Boss room |
| --- | --- | --- |
| Monster HP | 60 | 120 |
| Correct-answer damage | 20 | 20 |
| Wrong-answer player damage | 10 | 12 |
| Clear XP (`xp_delta` on clear) | 25 | 100 |

The boss needs exactly 6 correct answers (120 HP at 20 damage). Player HP stays 100. The demo boss has an 8-question pool (two per topic); the frontend cycles through the pool after wrong answers. Existing per-answer values (score 100, XP 10 per correct answer) are unchanged. The mock does not enforce room order on attempts; the frontend guards order with closed Gates.

### Event bridge changes

The Phaser/React Event_Bridge events changed (`load-room` replaced by `load-dungeon`, `room-cleared` replaced by `gate-open`, new `set-muted`, `room-entered`, `gate-opened`, phase `victory`). These are internal to the frontend and have **no backend impact**.

### Open questions for Person A

1. Does `Run.monster_hp` refer to the monster of `current_room_id`?
2. How are per-room monster HP and cleared state returned when a run is resumed?
3. Does the backend reject attempts made out of room order (for example, a question from room 3 while room 2 is uncleared)?
4. Is `RunSummary.accuracy` a ratio (0 to 1) or a percentage?
5. Which `Monster.kind` values will exist? The frontend currently knows `paper_wraith`, `toxic_slime`, `gear_golem`, `memory_eater`, `exam_warden`.
6. Do the boss values (120 HP, wrong-answer damage 12, clear XP 100) and room clear XP (25) match `game-design.md`?
7. Is `finishRun` idempotent, and what happens if it is called twice?

---

## PROPOSED CONTRACT (pending Person A)

Date: frontend-07-premium-ux-leaderboard, Phase 0.

> **Status: nothing below is implemented by the backend.** Every shape is a frontend proposal, built against the mock (`VITE_USE_MOCKS=true`) and marked pending. New fields are optional on the frontend, so a backend that has not added them still works. The backend stays authoritative for correctness, damage, HP, XP, score, streak, rank and badges. The session cookie (`credentials: "include"`) is the only credential; the frontend stores no token.

### Files requested from Person A

Please publish `.kiro/steering/api-contract.md`, `.kiro/steering/game-design.md` and `docs/handoff/demo_dungeon.sample.json`. They do not exist yet and the shapes below replace them until they do.

### GET /leaderboard

- Query: `?dungeon_id=<id>&period=all|week&limit=20`
- Guests can read it. Rivals (seeded demo entries) are flagged `is_seeded_rival`.
- Response:
  ```json
  {
    "entries": [
      { "id": "u_17", "rank": 1, "display_name": "Mira", "is_guest": false, "is_seeded_rival": false,
        "level": 4, "score": 2400, "accuracy": 0.92, "best_streak": 9, "badge_ids": ["boss_slayer", "streak_5"] },
      { "id": "rival_3", "rank": 2, "display_name": "Ghost Rival", "is_guest": false, "is_seeded_rival": true,
        "level": 3, "score": 2100, "accuracy": 0.8, "best_streak": 6, "badge_ids": [] }
    ],
    "me": { "rank": 7, "is_provisional": false, "entry": { "id": "u_42", "rank": 7, "display_name": "Sam", "is_guest": false, "is_seeded_rival": false, "level": 2, "score": 900, "accuracy": 0.7, "best_streak": 3, "badge_ids": ["first_blood"] } },
    "updated_at": "2026-11-20T12:00:00Z"
  }
  ```
- `me.rank` is `null` and `me.entry` is `null` when the caller has no finished run. Ties: score desc, accuracy desc, best_streak desc, display_name asc, id asc.

### POST /runs/{id}/finish additions (all optional)

```json
{
  "score": 500, "xp": 160, "correct": 5, "total": 6, "accuracy": 0.83,
  "badges_earned": ["first_blood", "boss_slayer"],
  "leaderboard_rank": 7,
  "weapon_unlocked": "arcane_staff",
  "level_up": { "from": 1, "to": 2 },
  "topic_mastery": [{ "room_id": "room-1", "label": "Chamber of Basics", "percent": 75 }],
  "weak_concepts": [{ "text": "Definition of entropy", "page": 12 }]
}
```

Badge ids: `perfect_room`, `no_damage`, `streak_5`, `boss_slayer`, `first_blood`, `memory_keeper`, `speed_reader`, `dungeon_master`. Weapon ids: `rusty_dagger`, `arcane_staff`, `hunter_crossbow`, `spectral_hammer`, `flame_sigil`.

### GET /progress additions (all optional)

```json
{
  "badges": ["first_blood"],
  "weapons": [{ "id": "rusty_dagger", "unlock_level": 1 }, { "id": "arcane_staff", "unlock_level": 2 }],
  "recent_runs": [{ "id": "run_9", "dungeon_name": "Demo Dungeon", "score": 500, "accuracy": 0.83, "finished_at": "2026-11-20T11:55:00Z" }],
  "due_review_count": 3
}
```

### POST /runs/{id}/attempts response additions (all optional)

```json
{ "correct": true, "damage_dealt": 20, "weapon_id": "arcane_staff", "is_critical": false }
```

The frontend only presents `weapon_id` and `is_critical`; it never computes damage.

Phase 3 details (weapons, criticals, boss phase). Everything here is presentation only:

- `weapon_id` (optional string): one of `rusty_dagger`, `arcane_staff`, `hunter_crossbow`, `spectral_hammer`, `flame_sigil`. An absent or unknown id plays the Rusty Dagger slash, so the backend may add weapons without breaking the client. The mock sends the best weapon for the player level (dagger L1, staff L2, crossbow L3, hammer L5, sigil L8; mock only).
- `is_critical` (optional boolean): enlarges the damage number (1.5x) and plays a white flash. **`damage_dealt` is unchanged by a critical hit.** The mock sets it on every third correct answer in a row (streak 3, 6, 9...). A critical that deals bonus damage would be a scoring and balance change owned by the backend; the frontend would simply show the larger `damage_dealt` it receives.
- `GET /progress` `weapons`: the full weapon list with `unlock_level`, so the Armory (pause menu now, Dashboard later) can mark each weapon unlocked or locked from `level`. If the field is absent the Armory is hidden.
- Which weapon a result used, and when a weapon unlocks, are backend decisions. The frontend has no weapon choice.
- Boss phase: the frontend derives `enraged` from HP only (`monster_hp_remaining / max_hp < 0.5`, so 59 of 120 is enraged and 60 is not). **Any difficulty increase in the boss phase (more damage, harder questions) is a backend concern**; the frontend only changes tint, attack animation, fog, lightning (at most one flash per 8 s, peak overlay alpha 0.25, none under Reduced Motion) and the ambient audio.
- Dev only: `?mockLevel=N` (1 to 99) sets the mock player level so each weapon can be seen. It is ignored in production builds and has no effect on a real backend.

### Due review delivery (Person A chooses one)

> **SUPERSEDED (frontend-08):** the bare-array `GET /reviews/due?dungeon_id=` proposal below is replaced by the `{due_count, next_due_at, daily_streak, items}` shape in "frontend-08 campaign additions", item 6. Person A's `GET /reviews/due` already exists in a different shape (see item 6).

- Option 1: include `due_reviews` in the `POST /runs` response.
- Option 2: `GET /reviews/due`.
- Item shape (the question never carries the answer):
  ```json
  { "id": "rev_1", "question": { "id": "q2", "type": "mcq", "prompt": "...", "options": ["...", "..."] }, "room_id": "room-1", "times_missed": 2 }
  ```
- Phase 4 details (the frontend is built against Option 2; `ApiClient.getDueReviews(dungeonId)` hides the choice, so switching to Option 1 needs no UI change):
  - `GET /reviews/due?dungeon_id=<id>` returns a **bare JSON array** of the items above (empty array when nothing is due). `times_missed` is optional.
  - `GET /progress` `due_review_count` should equal the length of that array for the dungeon; the counter in the HUD reads it and refetches it after a Revenant is rested.
  - A Revenant is shown in `room_id` once that room's monster is defeated: at most 3 per room, in the order returned. They are optional and never block the gate.
  - **Answering a Revenant uses the normal `POST /runs/{id}/attempts` with the due question's id, after the room monster is already defeated.** The backend must accept that (not return 409 "monster already defeated") when the question is due, must **leave the room monster at 0 HP** (`monster_hp_remaining: 0`, `damage_dealt: 0`), and must still deduct player HP, update streak, score and XP and the review schedule. The mock charges 10 player HP for a wrong answer (same as a topic room) and clears the review on a correct one. The frontend never computes any of this.
  - Dev only: `VITE_MOCK_SEED_REVENANTS=true` makes the mock treat the first 3 questions of every non-boss room as due, so 3 Revenants show at once. It has no effect on a real backend.

### Auth endpoints

Cookie session only; no token in the body.

- `POST /auth/register` body `{ "username": "sam", "password": "..." }` returns `201 { "user": { "id": "u_42", "username": "sam", "is_guest": false } }`. Errors: `409` taken, `422` invalid.
- `POST /auth/login` same body, returns `200 { "user": { ... } }`. Errors: `401`, `429` with `Retry-After`.
- `POST /auth/logout` returns `204`.
- `GET /auth/me` returns `200 { "user": { ... } }` or `401`.

### Upload endpoint (pending)

`POST /uploads` multipart (`file`, optional `title`) returns `202 { "upload_id": "up_1", "status": "processing" }`; `GET /uploads/{id}` returns `{ "status": "processing|ready|failed", "dungeon_id": "d_5" }`. Hidden for guests. Optional feature; the frontend mocks it.

### Backend notes

- Boss phase (normal or enraged) is derived by the frontend from monster HP (below 50 percent is enraged). **No backend change needed.**
- Boss difficulty (HP, wrong-answer damage, question mix) and any speed bonus are **backend scoring and balance changes**. The frontend does not compute them. Please confirm the values in `game-design.md`.

### Open questions for Person A

1. Which due review delivery option do you prefer?
2. Is the leaderboard scoped per dungeon, global, or both?
3. Who computes badges and weapon unlocks, and when (at finish)?
4. Will guests appear on the leaderboard, or only read it?

---

### frontend-08 campaign additions

Date: frontend-08-campaign-learning-loop, Phase 0. Branch `feature/frontend-campaign`.

> **Status: nothing below is implemented by the backend.** Every shape is a frontend proposal, built against the mock (`VITE_USE_MOCKS=true`) and marked pending. All new fields are optional on the frontend: a backend that has not added them still works (real mode shows one legacy floor "The Crypt" and hides the campaign-only features). The backend stays authoritative for correctness, damage, HP, XP, score, streaks, ranks, mastery, review scheduling, question selection and badges. The frontend only displays.

#### Reconciliation with Person A's real contract (what the frontend changes, no action for Person A)

The frontend now maps your real shapes at the HTTP boundary: `title`, `rooms[].questions[]`, `room_number`, `topic_name`, `monster_name`, `monster_type` (kind derived from the name), `RunDetailResponse`, `is_correct`/`damage_taken`/`current_hp`/`current_score`/`current_streak`, `xp_earned`/`correct_count`/`total_attempts`, `unlocked_weapons` (names), the bare auth bodies, and `studydungeon_session`. Questions for Person A:

1. `.kiro/steering/api-contract.md` Section 3 (`selected_option`, `correct`, `source{...}`, `review_status`, `{run_id, ...}`) disagrees with `docs/openapi.json` and the A-to-B Day 3 table. We build against openapi. Please refresh `api-contract.md`.
2. Vercel rewrite destination: Day 1 keeps `/api` in the destination, Day 3 drops it. Which is final? The frontend reads `VITE_API_BASE` (falls back to `VITE_API_BASE_URL`).
3. Attempts on a cleared room return 409 `ROOM_ALREADY_CLEARED`, so our earlier PROPOSED "answer a Revenant through `POST /attempts` after the monster is defeated" is **withdrawn**. See item 3 (`daily_haunt` run) for the replacement.
4. `POST /runs` returns `RunDetailResponse`; we use `rooms[]` for per-room HP. Please keep `GET /runs/{id}` for resume.
5. Weapons: the frontend sends `weapon_name` (validated by you) only if you accept the equipped-weapon item below. The earlier PROPOSED `weapon_id` stays optional on the attempt response (item 4) so the strike animation matches the weapon you used; without it the Rusty Dagger animation plays.
6. `GET /documents/{id}/status` returns `chunks_count` while `api-contract.md` says `topic_count`. Please confirm.

Status of the earlier PROPOSED items (also in `.kiro/specs/frontend-08-campaign-learning-loop/design.md`): `is_critical` implemented; `weapon_id` not as a response field; finish additions, progress additions and leaderboard not addressed; due reviews implemented in a different shape (item 6); auth implemented with different bodies (adopted); `POST /uploads` superseded by `POST /documents` (adopted); boss phase derived from HP (no backend change).

#### 1. `GET /dungeons/{id}` gains floors and a final boss

Rooms stay as today and get a `floor_id`. Floors can be a simple grouping field. A dungeon without `floors` is shown as one floor "The Crypt".

```json
{
  "id": "d_1", "title": "Computer Systems", "is_public_demo": true,
  "floors": [
    { "id": "f_1", "index": 1, "title": "The Entry Crypt", "status": "cleared",
      "topics": [ { "id": "t_1", "title": "CPU", "mastery": 82 }, { "id": "t_2", "title": "Storage", "mastery": 55 } ],
      "boss": { "id": "m_2", "name": "Memory Wraith", "hp": 90 }, "rank": "A" },
    { "id": "f_2", "index": 2, "title": "The Alchemy Wing", "status": "generating",
      "topics": [], "boss": { "id": "m_4", "name": "Packet Spectre", "hp": 85 }, "rank": null }
  ],
  "final_boss": { "id": "m_5", "name": "The Exam Warden", "hp": 220, "unlocked": false },
  "rooms": [ { "id": "r_1", "floor_id": "f_1", "room_number": 1, "topic_name": "CPU", "monster_name": "Silicon Golem", "monster_type": "Silicon Golem", "monster_hp": 80, "is_boss": false, "questions": [] } ]
}
```

`status` is one of `locked`, `ready`, `generating`, `failed`, `cleared`. `rank` is `S|A|B|C|null`. `mastery` is 0 to 100. Please also add a `monster_kind` (visual id such as `paper_wraith`, `exam_warden`) so the client does not parse `monster_type`; until then the client derives it.

#### 2. Question pool and backend selection

Each topic has 15 to 20 questions in the database. **The backend picks 6 to 8 per run, seeded by run id, and returns only those.** The client never draws randomly in real mode. The client only draws (seeded by `run_seed`) inside the mock.

#### 3. `POST /runs` body and response

```json
{ "dungeon_id": "d_1", "floor_id": "f_2", "mode": "floor" }
```

`mode` is one of `floor`, `daily_haunt`, `weak_topics`, `exam`, `replay_floor`; `floor_id` is `null` for `daily_haunt`, `weak_topics` and `exam`. The response keeps `RunDetailResponse` and adds the encounters, the revenants for the run and the seed:

```json
{
  "id": "run_9", "dungeon_id": "d_1", "mode": "floor", "run_seed": "run_9", "current_hp": 100, "current_score": 0, "current_streak": 0, "xp_earned": 0, "status": "active", "started_at": "2026-11-20T12:00:00Z",
  "rooms": [ { "room_id": "r_3", "floor_id": "f_2", "room_number": 1, "topic_name": "Networking", "monster_name": "Packet Spectre", "monster_max_hp": 85, "monster_current_hp": 85, "is_cleared": false, "is_boss": true } ],
  "encounters": [ { "room_id": "r_3", "questions": [ { "id": "q_31", "prompt": "...", "options": ["...", "..."], "difficulty": "easy" } ] } ],
  "revenants": [ { "question_id": "q_7", "prompt": "...", "options": ["...", "..."], "due_at": "2026-11-20T09:00:00Z" } ]
}
```

For `daily_haunt` the run contains only due items (no room monster); answering them must be accepted by `POST /attempts` and must update the review schedule. Replaces the withdrawn "Revenant attempt after the monster is defeated" proposal.

#### 4. Attempt response additions (all optional)

```json
{
  "is_correct": false, "damage_dealt": 0, "damage_taken": 10, "is_critical": false, "current_hp": 90, "current_score": 200, "current_streak": 0, "monster_hp_remaining": 40,
  "explanation": "The ALU performs arithmetic and logic.", "evidence_quote": "The Arithmetic Logic Unit (ALU) performs ...",
  "requeue_after": 3, "is_retry": false, "retry_multiplier": 1.0, "combo": 0, "weapon_id": "rusty_dagger",
  "correct_answer": "Arithmetic Logic Unit (ALU)", "source": { "page": 4, "chunk_id": "c_12" }
}
```

- `requeue_after`: number of further questions before this one returns, or `null` when it is not requeued.
- `is_retry` and `retry_multiplier`: set when the answered question is a returned miss; the frontend shows damage and reward as received and never computes them.
- `combo`: derived from the streak by the backend (frontend tiers at 3, 5, 8, 12 are display only).
- `is_critical`, `weapon_id`: presentation (`weapon_id` is the weapon the backend used; see "Equipped weapon").
- `correct_answer`: **only after a wrong answer** (never in `GET /dungeons/{id}`). The real attempt response today reveals no correct answer, only `explanation` and `evidence_quote`, so the Memory Scroll cannot name the right option without this field. If absent, the scroll shows the explanation and quote only.
- `source.page` and `source.chunk_id`: needed for "From your notes: page X" (today only `evidence_quote` is returned; `GET /documents/{id}/source-preview` exists but needs a chunk id).

#### 5. `POST /runs/{id}/finish` additions (all optional)

Extends the existing `RunSummaryResponse` and the earlier PROPOSED finish additions (not duplicated here: `badges_earned`, `leaderboard_rank`, `weapon_unlocked`, `level_up`).

```json
{
  "id": "run_9", "score": 800, "xp_earned": 160, "correct_count": 7, "total_attempts": 9, "accuracy": 0.78, "mastery_band": "Learning", "status": "completed",
  "floor_rank": "A",
  "mastery_by_topic": [ { "topic_id": "t_3", "title": "Networking", "mastery": 71 } ],
  "badges_earned": ["boss_slayer"], "leaderboard_rank": 7, "weapon_unlocked": "arcane_staff",
  "level_up": { "from": 1, "to": 2 },
  "chest_rewards": [ { "id": "cr_1", "kind": "xp", "label": "Bonus XP", "amount": 40 }, { "id": "cr_2", "kind": "coins", "label": "Coins", "amount": 25 } ]
}
```

`floor_rank` is `S|A|B|C|null` (null for non-floor modes). `chest_rewards` may be empty. `mastery_by_topic` supersedes the earlier `topic_mastery` proposal.

#### 6. Due reviews and Daily Haunt (REPLACES the earlier bare-array proposal)

Your `GET /reviews/due` exists as a bare array of `{question_id, prompt, options, next_review_at, repetition_count}`. The frontend will use this shape instead (global across dungeons, which fits Daily Haunt across all floors):

```json
GET /reviews/due
{
  "due_count": 12,
  "next_due_at": "2026-11-21T08:00:00Z",
  "daily_streak": 4,
  "items": [ { "question_id": "q_7", "prompt": "...", "options": ["...", "..."], "due_at": "2026-11-20T09:00:00Z", "repetition_count": 2, "topic_id": "t_1", "floor_id": "f_1" } ]
}
```

`topic_id`/`floor_id` let the client place a Revenant in the right room (optional; unknown items still appear in Daily Haunt). `next_due_at` is `null` when nothing is scheduled. The `daily_haunt` run (item 3) is built by the backend from due items, about 5 minutes (our mock caps at 8 items), and `daily_streak` counts consecutive days with at least one completed Daily Haunt. The earlier `?dungeon_id=` filter is dropped.

#### 7. `GET /progress` additions (all optional)

```json
{
  "user_id": "u_42", "level": 2, "total_xp": 140, "unlocked_weapons": ["Rusty Dagger", "Arcane Staff"],
  "xp_to_next": 60,
  "notes_conquered_percent": 38,
  "memory_strength": [ { "topic_id": "t_1", "title": "CPU", "strength": 82 } ],
  "streak_calendar": [ { "date": "2026-11-19", "reviewed": true }, { "date": "2026-11-20", "reviewed": false } ],
  "weak_concepts": [ { "text": "Definition of entropy", "page": 12, "source_ref": "chunk c_9" } ]
}
```

`xp_to_next` is also requested (the frontend HUD uses it; today it is missing). `streak_calendar` covers the last 12 weeks. `notes_conquered_percent` is the share of topics at Strong mastery. Earlier PROPOSED progress fields (`badges`, `weapons`, `recent_runs`, `due_review_count`) are not duplicated here.

#### 8. Generation status and lazy floors

Floors are generated lazily one by one, so floor 1 is playable first. The client polls every 2.5 s while any floor is `generating`:

```json
GET /documents/{id}/status
{ "id": "doc_1", "status": "accepted", "chunks_count": 24, "dungeon_id": "d_5", "floors": [ { "id": "f_1", "status": "ready" }, { "id": "f_2", "status": "generating" }, { "id": "f_3", "status": "locked" } ] }
```

Alternatively `GET /dungeons/{id}` `floors[].status` is polled. `POST /floors/{id}/retry` (new) re-runs a `failed` floor and returns `{"id": "f_2", "status": "generating"}`. There is a per-dungeon size cap with a friendly error: `422 {"detail": {"code": "DUNGEON_TOO_LARGE", "message": "These notes are very large. Upload a smaller section to get the best floors."}}`.

#### 9. Backend scoring decisions needed from Person A

The mock uses these placeholder values; please decide and tell us:

| Topic | Mock default | Question |
| --- | --- | --- |
| Retry damage and XP | `retry_multiplier` 0.5 | Reduced, full or zero reward for a returned miss? Does a retry reset the streak? |
| Floor rank thresholds | S >= 0.90 first-try accuracy with no retry, A >= 0.80, B >= 0.60, else C | Your thresholds, and does HP lost matter? |
| Exam mode scoring | Same as floor, covers all topics | Different weighting, timer, no requeue? |
| Boss-phase question difficulty | Frontend only changes presentation below 50 percent HP | Should enraged boss phase serve harder questions? |
| Mastery formula | EMA alpha 0.3 per topic, bands 50 and 80 | Your per-topic formula (SM-2 related?) |
| Requeue gap | 3 questions, at most 2 returns | Your gap and cap |

#### Equipped weapon (optional item, PROPOSED)

The attempt request already accepts `weapon_name` (default "Rusty Dagger", validated against unlocks). To let the Armory remember the player's choice, we propose:

```json
GET /progress  ->  { "...": "...", "equipped_weapon": "Arcane Staff" }
PUT /progress/equipped-weapon   { "weapon": "Arcane Staff" }  ->  200 { "equipped_weapon": "Arcane Staff" }
```

`PUT` returns 403 `WEAPON_LOCKED` for a locked weapon. When `weapon_name` is omitted in an attempt, the backend uses `equipped_weapon`. Pending: the frontend builds the Armory selection against the mock only.

#### Open questions for Person A (frontend-08)

1. Will you add `floors[]`, `final_boss` and `floor_id` to `GET /dungeons/{id}`, and which phase of your work (so we can hide features until they exist)?
2. Do you accept `mode` and `floor_id` on `POST /runs`, including the `daily_haunt` run that accepts attempts on due items?
3. Can the attempt response include `correct_answer` (after wrong answers only) and `source.page`?
4. Is `GET /reviews/due` going to carry `daily_streak` and `next_due_at`, or should the frontend call a separate daily-run endpoint?
5. Who owns the dungeon size cap and its error code?

#### Phase 1A update (frontend-08): real mode now plays the existing 5-room game

Date: frontend-08 Phase 1A. The frontend reads your real shapes through `src/api/wire/` and plays the demo end to end against your backend (`VITE_USE_MOCKS=false`, `VITE_API_BASE=http://localhost:8000`). Nothing under `backend/` was changed. Everything below is a note for you; items marked PROPOSED are not built on our side.

##### Doc mismatches for Person A

1. **`api-contract.md` Section 3 vs `openapi.json` and the code (C1).** The contract text uses `selected_option`, `correct`, `source{page,slide,chunk_id}`, `review_status`, `{run_id, player_hp, ...}` from `POST /runs`, and `GET /reviews/due` items `{question_id, prompt, due_at}`. The code uses `selected_answer`, `is_correct`, no `source`/`review_status`, a `RunDetailResponse` with `id`, `current_hp` and `rooms[]`, and `GET /reviews/due` items `{question_id, prompt, options, next_review_at, repetition_count}`. We build against the code and `openapi.json`. Please refresh `api-contract.md`.
2. **`topic_count` vs `chunks_count` (C29).** `api-contract.md` says `topic_count` on the document status; `openapi.json` and the code say `chunks_count`. We will use `chunks_count` in the upload wizard (frontend-07 P8). Please confirm.
3. **Finish body: three versions.** The A-to-B Day 3 table says `POST /runs/{id}/finish` returns `{ run_id, status, total_score, xp_earned, rooms_cleared, accuracy, mastery_band }`. `openapi.json` and `backend/app/schemas/runs.py` say `{ id, score, xp_earned, correct_count, total_attempts, accuracy, mastery_band, status }`. We follow the code. Please fix the A-to-B table.
4. **Room clear body.** The A-to-B Day 3 table says `{ room_id, is_cleared, xp_delta }`; the code returns `{ success, room_id, xp_delta, is_boss }`. `openapi.json` has no response model for this route. We follow the code. Please add a response model so it appears in `openapi.json`.
5. **`GET /runs/{id}` in A-to-B Day 1** lists `{ id, dungeon_id, current_hp, current_score, current_streak, status, started_at }` (no `xp_earned`, no `rooms`); the code and Day 3 return `xp_earned` and `rooms[]`. We follow the code.
6. **Vercel rewrite: two forms (see the next note).**
7. **Error bodies.** Day 3 says every error is `{"detail": {"code", "message"}}`. That holds for your `HTTPException`s and the 422 handler (which adds `errors[]`), but FastAPI's own array form `{"detail": [{loc,msg,type}]}` can still appear from a route outside your handler. The frontend accepts all three shapes.
8. **`Username` rules.** `api-contract.md` says 3 to 20 characters and a 10 to 72 character password; the code allows 3 to 32 and 8 to 128, normalized to lowercase. We follow the code.

##### Vercel rewrite: confirm which one is deployed

The frontend uses the **Day 3 form** (`frontend/vercel.json`, destination without `/api`). `VITE_API_BASE=/api` goes with it.

```json
// Day 3 (what the frontend ships): the /api prefix is stripped
{ "rewrites": [ { "source": "/api/:path*", "destination": "https://studydungeon-api.onrender.com/:path*" } ] }

// Day 1 (not used): the /api prefix is kept, so the backend would need routes under /api
{ "rewrites": [ { "source": "/api/:path*", "destination": "https://studydungeon-api.onrender.com/api/:path*" } ] }
```

The backend routes have no `/api` prefix (`/health`, `/demo/session`, `/runs`), so only the Day 3 form can work. Please confirm that is what is deployed. `vercel.json` also has a catch-all rewrite to `/index.html` so deep links such as `/play` load the app.

##### Observations from reading the backend (no change made; please decide)

1. **`monster_hp_remaining` is always 0** in `POST /runs/{id}/attempts` (`runs.py` returns the literal `0`), also for idempotent replays. The frontend computes the remaining HP itself from the room's `monster_hp` (or `monster_current_hp` from `POST /runs` and `GET /runs/{id}`) minus `damage_dealt`. PROPOSED: return the real remaining HP, so the server stays the single source of truth. Until then, a reload mid-room is rebuilt through `GET /runs/{id}`.
2. **Progress never changes.** Nothing in `backend/app` writes `UserProgress`, and `POST /runs/{id}/rooms/{room_id}/clear` computes `xp_delta` (25 or 100) without adding it to `GameRun.xp_earned`. So `GET /progress` stays at level 1, 0 XP and `["Rusty Dagger"]`, and the run summary's `xp_earned` counts only the 10 XP per correct answer. The frontend shows the room-clear XP it receives in the HUD; the finish screen shows `xp_earned`. If this is intended later, no frontend change is needed.
3. **Weapon unlocks.** Because of item 2, the frontend always sends `weapon_name: "Rusty Dagger"` against a fresh backend (it picks the best weapon only from `unlocked_weapons` returned by `GET /progress`). The check in `runs.py` also allows a weapon when `is_weapon_unlocked(level, xp)` passes, but `cleared_rooms` and `boss_cleared` are never passed, so the crossbow and the sigil can only come from `unlocked_weapons`.
4. **Review items.** Every attempt inserts a new `ReviewItem` (also for correct answers, due in 3 days) and always passes `current_repetition=0`, so one question can appear several times in `GET /reviews/due` with the same `question_id`. The frontend drops duplicates by `question_id`.
5. **Room Revenants are hidden in real mode** (capability off) because attempts on a cleared room return 409 `ROOM_ALREADY_CLEARED`. The haunted counter still shows the count from `GET /reviews/due`.
6. **`GET /reviews/due` is global** (no `dungeon_id` filter). The frontend resolves `room_id` from the loaded dungeon and keeps items from other dungeons with an empty room id so they still count.
7. **Idempotent replay** returns `is_critical: false` and the stored `damage_dealt`. The frontend caches the first response per `attempt_id`, so a normal retry after a lost response shows the right values.
8. **Question choice.** In real mode the frontend cycles the room's `questions[]` (`questionSelector`) in the order you send them. PROPOSED, later: a server-chosen next question, so requeue and pools can live on the backend (Phase 1B+).
##### Real-backend verification (frontend-08 Phase 1A, local run against http://localhost:8000)
Observed with the running backend (`ai_provider: mock`). Nothing under `backend/` was changed. The Http_Client mapped every response it could read without a ContractError.
1. **Demo dungeon not seeded in a fresh local DB.** `POST /demo/session` returns `dungeon_id: "demo-dungeon-seeded-id"` (the fallback literal) and `GET /dungeons/demo-dungeon-seeded-id` then returns 404 `DUNGEON_NOT_FOUND`. `seed_demo_dungeon` only runs from the Dockerfile entrypoint (`python -m app.demo.seed`), not from `main.py` lifespan, and `GET /dungeons` is `[]`. Local fix: run `python -m app.demo.seed` from `backend/`. PROPOSED: seed in the lifespan, or fail `POST /demo/session` instead of returning a dungeon id that does not exist. Task 7 of backend-05 is marked done but `main.py` does not call the seed.
2. **500 on some questions of a mock-AI generated dungeon.** Dungeon from `POST /documents` + `generate-dungeon` (1 boss room, 2 questions). `POST /runs/{id}/attempts` for the second question always returns 500 `INTERNAL_SERVER_ERROR` (any option, with or without `weapon_name`); the first question works. After the first successful attempt, `GET /runs/{id}` also returns 500 (before any attempt it returns 200). Not reproduced on the seeded demo dungeon (not available locally). Please check the server log for that run.
3. **Run on another user's dungeon:** `POST /runs` returns 403 `FORBIDDEN` ("You do not own this dungeon."); the frontend maps it to an ApiError with that code.
4. **Cookie session:** the session cookie is `studydungeon_session`, `HttpOnly; SameSite=lax; Path=/`, not `Secure`. CORS preflight from `http://localhost:5173` returns `allow-credentials: true` and echoes the origin, so `credentials: 'include'` works from the dev server. Node tests need a cookie jar (added in `frontend/src/contract/cookieFetch.ts`).

---

### frontend-10 live players

Date: frontend-10-live-players, Phase 0. Branch `feature/frontend-live-players`. Spec: `.kiro/specs/frontend-10-live-players/`.

> **Status.** Part 1 is REAL on `main` (backend-07) and the frontend will call it in Phase 1. Parts 2 to 6 are PROPOSED: nothing in them is built on your side, and the frontend builds them against the mock (`VITE_USE_MOCKS=true`) and hides them in real mode until the first call proves them. The shapes follow `docs/handoff/BACKEND_REQUIREMENTS_V2.md` (section letters in brackets); where this section differs from V2, this section is newer. The backend stays authoritative for points, ranks, names, pack status, quota and counts. The frontend only displays. Nothing under `backend/` was changed.

#### How the frontend decides a feature exists (so you know what a status code does)

For each feature the real client keeps a state in memory for the page session: `on`, `off` or `unproven`. REAL features (guest name check, guest create, upgrade, delete account) start `on`. PROPOSED features start `unproven`; the first call is the probe:

| Answer | Effect |
| --- | --- |
| 2xx and the body passes our zod schema | feature `on` |
| 404, 405 or 501 | feature `off` for the page session; the old behavior stays |
| any other error (401, 403, 422, 429, 5xx) | state unchanged, the error is shown |
| 2xx but the body fails the schema | `ContractError` naming the endpoint and field; state unchanged |

So an endpoint that does not exist yet must answer 404 (FastAPI does this by default). We recommend a `GET /meta` capability endpoint (V2 open question 13). We do not use it yet.

#### 1. REAL now: what the frontend will call (please confirm nothing changes)

| Endpoint | Request | Response we read |
| --- | --- | --- |
| `POST /guests/name-check` | `{display_name}` | `{ok, display_name?, reason?, message?}`; `reason` is `too_short`, `too_long`, `characters` or `not_allowed` |
| `POST /guests` | `{display_name, accept_public_notice: true}` | 201 `{user, notice_version}`; 409 `SESSION_EXISTS` (we then call `GET /auth/me`), 429 `RATE_LIMIT_EXCEEDED`, 503 `GUEST_CREATION_PAUSED`, 422 `NOTICE_NOT_ACCEPTED`, 422 `NAME_INVALID` with `detail.reason` |
| `GET /auth/me` | cookie | `id, public_id?, username?, display_name?, tag?, handle?, is_guest, created_at, expires_at?` (we make `username` nullable and read the new fields as optional) |
| `POST /auth/upgrade` | `{username, password}` | the same user, `is_guest` false; 403 `NOT_A_GUEST`, 409 `USERNAME_TAKEN`, 422, 429 |
| `DELETE /auth/me` | `{"confirm": "DELETE"}` | `{success, message}`; 422 `CONFIRMATION_REQUIRED`, 403 `SYSTEM_USER_PROTECTED`, 401 |
| `GET /dungeons` | cookie | `[{id, title, is_public_demo, created_at, rooms_count}]`; we pick the oldest public demo as the preloaded dungeon until `GET /packs` exists |
| `GET /health` | none, no cookie (`credentials: omit`) | ignored. Sent once when the title screen loads (warm-up). Please keep it DB-free and CORS-allowed for the dev origins. |

The frontend shows the `handle` (`Name#1234`) and never the `username` of a guest.

Phase 0 review update 2026-11-11 (no action for Person A unless a question below says so): the name screen prefills a random spooky name generated locally and the player can roll another or edit it. The separate confirmation checkbox is removed; the public notice is shown directly above the button "Accept and continue", and pressing it (or Enter) sends `accept_public_notice: true` exactly as before, so the contract is unchanged. The intro story and tutorial no longer open before the name screen. A first-time player who picks "Play preloaded dungeons" opens the first playable floor run directly; the frontend decides "first time" only from data you return (pack `status`, `floors_cleared`, `points_earned`, or cleared rooms in the dungeon data or `GET /progress`) and opens the floor map when that data is missing. The waking screen: when `POST /guests` (or the legacy `POST /demo/session`) takes more than 8 s, the player chooses "Keep waiting" (the request stays open, up to about 60 s in total) or "Play offline demo". The frontend never switches a real session to offline by itself. Please keep `POST /guests` able to take up to 60 s on a cold start without the proxy cutting it.

#### 2. Findings from reading the backend (please decide; no frontend workaround is possible for the first three)

1. **`POST /guests` has no `dungeon_id`.** `POST /demo/session` returns one. After the name step the frontend must find a playable dungeon: `GET /packs` if it exists, else the public demo from `GET /dungeons`. Please add `dungeon_id` to the `POST /guests` response, or confirm `GET /packs` is coming. We never call `POST /demo/session` while a session exists, because it creates a new anonymous guest and overwrites the cookie. Please keep `POST /demo/session` working until we report that the name step is live (V2 A-R12).
2. **Registered users have no display name or tag.** `register` creates none (`auth.py`), so `GET /auth/me` returns `handle = username` for them. A leaderboard that lists `handle` would publish login names, which V2 A-R8 forbids. Please build V2 A-R10 (display name and tag on register, same moderation) before the live leaderboard ships. The frontend cannot tell a login name from a handle.
3. **Guest `username`.** V2 A.3 says `username: null` for guests; the code returns an internal `guest_xxxxxxxx`. The frontend never shows it. Please return null for guests when convenient (V2 A.3).
4. **No sliding renewal found.** V2 A-R4 says the 30-day cookie is renewed on activity and A-R5 purges after 30 days of inactivity. In `core/deps.py` I found no write to `last_active_at` (I searched for the field and did not read the whole file); `create_guest` sets it once and the lazy purge deletes guests whose `last_active_at` is older than 30 days. If nothing updates it, an active guest is purged 30 days after creation. Please check.
5. **Name moderation matches substrings.** `identity.py` tests whether a reserved word or profane word is contained in the normalized name, so ordinary names such as `Nomad`, `Groot`, `Modest`, `Dickens` or `Staffan` return `not_allowed`. The frontend shows "That name is not available. Try another." Please consider whole-word matching for short reserved words (`mod`, `root`, `null`, `kiro`, `dick`).
6. **Names are not unique** (V2 A-R3), so there is no "name taken" error. The frontend only maps the four reasons above.
7. `POST /auth/login` still sets the cookie with `secure=False` (V2 P6 asked for `COOKIE_SECURE`), and `register` sets no cookie. No frontend change; noted for completeness.
8. The frontend sends `confirm: "DELETE"` on `DELETE /auth/me`; the route also accepts no body. No change needed.

#### 3. PROPOSED: packs (V2 B)

```json
GET /packs
{ "packs": [ { "id": "pack-1", "order": 1, "title": "...", "description": "...", "dungeon_id": "d_pack1",
               "floors_total": 2, "floors_cleared": 2, "final_boss_cleared": true, "status": "completed", "points_earned": 2350 } ],
  "next_pack_id": "pack-2", "all_completed": false }
```

- `status` is `locked`, `available`, `in_progress` or `completed`. Without a session: pack 1 `available`, the rest `locked`.
- `POST /runs` on a locked pack returns 403 `PACK_LOCKED` with a friendly message. The frontend then opens the pack page.
- `POST /runs/{id}/finish` gains `"pack_progress": {"pack_id", "status", "unlocked_pack_id", "all_completed"}`. The frontend shows the "Next dungeon unlocked" screen from `unlocked_pack_id`, and the "All dungeons conquered" screen from `all_completed`. Without `pack_progress` it refetches `GET /packs` and compares statuses.
- The frontend computes no unlock in real mode; the mock (Pack 1 = the demo, Packs 2 and 3 = sample content, labeled "Sample content" on screen) computes it for development only.

#### 4. PROPOSED: points fields (V2 C)

All optional, additive, never sent by the client. The frontend labels the run value "Dungeon score" and the leaderboard value "Leaderboard points".

```json
POST /runs/{id}/attempts   + { "points_awarded": 10, "points_reason": "repeat_correct", "points_bonus": 25,
                                "player_points": { "preloaded": 1250, "own_notes": 0, "overall": 1250 } }
POST /runs/{id}/rooms/{room_id}/clear   + { "points_awarded": 50, "points_reason": "room_clear" }
POST /runs/{id}/finish   + { "points_earned": 830, "player_points": { "preloaded": 2080, "own_notes": 0, "overall": 2080 } }
```

`points_reason` values the frontend words: `first_correct`, `repeat_correct`, `retry`, `wrong`, `too_fast`, `practice`, `not_ranked`, `daily_cap`, `room_clear`, `boss_clear`, `pack_complete`. An unknown reason is shown without reason text. Please tell us if the list changes. The mock uses a simplified table (first correct 100 or 150 once per question and week, repeat 10, retry half, practice half, room 50, boss 200, pack 500) only as a stand-in.

#### 5. PROPOSED: leaderboard (V2 D)

```
GET /leaderboard?board=preloaded|own_notes|overall&period=all|week
```

Response exactly as V2 D.3 (`board`, `period`, `week{timezone, starts_at, resets_at}`, `updated_at`, `next_refresh_at`, `total_ranked_players`, `entries[]`, `me`). The old `dungeon_id` and `limit` form is retired in real mode; the offline demo keeps its own legacy board.

What the frontend does with it:

- Shows entries in the order and with the ranks you send. It never sorts or re-ranks. Ties are explained as "whoever reached the total first" (V2 D-R6).
- `points_needed` in `next_above` and `top20` is shown as sent (V2 includes the +1 tie rule). The frontend never recomputes it.
- Entries must not contain `username`, an internal `id` or IP data (V2 A-R8). Our wire mapper drops them, but the real fix is on your side.
- Refresh policy: one request when the page opens or the board or period changes; one request when `next_refresh_at` passes (plus 0 to 2 s of jitter); one request when the tab becomes visible and the last request is older than 60 s; never two requests for the same board and period less than 60 s apart; a 429 waits at least `Retry-After`; nothing while the tab is hidden or the page is closed. Please keep `me` cheap, since it is refreshed at most once per minute per open leaderboard tab.
- `me: null` without a session; `me.rank: null` with `reason: "no_points_yet"`; `me.next_above: null` at rank 1; `top20.points_needed: 0` inside the top 20.
- Suggested header: `Cache-Control: private, no-store` when `me` is present (V2 D-R9).

#### 6. PROPOSED: player counter (V2 E)

```json
GET /stats/players
{ "players": 143, "rooms_cleared_total": 982, "answers_total": 15230, "packs_completed_total": 61,
  "updated_at": "2026-11-20T12:00:00Z", "cache_seconds": 300 }
```

The title screen shows "143 explorers have braved the dungeon" from `players` only when `players` is 10 or more. For 1 to 9 it shows "Be among the first explorers" with no number. The number is formatted with `Intl.NumberFormat` and is never offset or rounded. The frontend caches the answer in memory for `cache_seconds` (300 s when absent), and hides the line on any failure or when `players` is 0, missing, negative or not an integer. Never invent or inflate: no minimum, no offset. The other totals are ignored.

#### 7. PROPOSED: guest upload (V2 G)

```json
GET /uploads/quota   (session required, guests included)
{ "can_upload": true, "reason": null,
  "player": { "is_guest": true, "used_today": 0, "limit_today": 1, "stored": 0, "stored_limit": 2, "resets_at": "2026-11-21T00:00:00Z" },
  "global": { "available": true }, "ranking": { "min_chars": 3000, "min_topics": 2 } }
```

- When `can_upload` is false, `reason` is `player_daily_limit`, `ip_daily_limit`, `stored_limit`, `global_daily_limit` or `ai_unavailable`. The frontend disables the drop zone and offers "Play preloaded dungeons instead".
- A 2xx answer for a guest turns guest upload on in the frontend. A 403 `GUEST_FORBIDDEN` from `POST /documents` turns it off again (today's behavior).
- `POST /documents` gains the multipart field `accept_ai_notice` (value `true`). The frontend always sends it after the player ticks the notice; today's backend should ignore unknown form fields. Later: 422 `AI_NOTICE_NOT_ACCEPTED` when missing.
- Error codes the frontend words: 429 `UPLOAD_LIMIT_PLAYER` and `UPLOAD_LIMIT_IP` (with `Retry-After`), 503 `UPLOADS_PAUSED_TODAY` and `AI_BUSY` (with `offer_packs: true`), 400 `QUOTA_EXCEEDED`, 422 `TOO_MANY_PAGES`, `TOO_MANY_SLIDES`, `TOO_MUCH_TEXT`. The last three need `detail.limit` and `detail.found` (integers) so the screen can say "This PDF has 42 pages; the limit is 30." The frontend keeps all `detail` extras on the error.
- File rules text the frontend will show. All limits live in one constants module (`frontend/src/upload/limits.ts`) with a TODO to read them from the server later (for example from `GET /uploads/quota` or a future `GET /meta`), and every UI text about the rules is built from it. Please confirm the numbers: "Accepted formats: PDF, DOCX, PPTX, TXT, PNG, JPEG. Up to 15 MB. PDF up to 30 pages, PPTX up to 30 slides, DOCX up to 60,000 characters, at least 500 characters of text." **The 60,000 DOCX character limit is UNCONFIRMED**: it is Person A's default `MAX_DOCX_CHARS` (V2 assumption B20) and has not been agreed. Please confirm it or send the real value; until then the frontend uses 60,000 as a placeholder. There is no single contract text today, so the rest is a proposal too.
- `GET /documents/{id}/status` additions the wizard reads when present: `counts_for_ranking`, `ranking_note`, `dungeon_id`, `floors[{id, status}]`. With `floors[]` the wizard lists one row per floor while it generates; without it, one status line.
- AI notice (draft, to check against provider terms; it makes no promise about retention or training): "Your notes are sent to third-party AI providers (Google Gemini, and models routed through OpenRouter as a fallback) to generate questions. Free tiers may let these providers keep or use the content under their own terms. Do not upload personal or confidential information."

#### 8. Suggested `GET /meta` (optional)

```json
GET /meta
{ "version": "2026-11", "capabilities": { "guest_identity": true, "packs": true, "live_leaderboard": true,
  "player_counter": true, "guest_upload": true, "upload_quota": true, "daily_haunt": false, "floors": true } }
```

When it exists, the frontend can drop the probing. Not required.

#### 9. Contract tests the frontend adds (run against your backend with `VITE_API_BASE` and `VITE_USE_MOCKS=false`)

Each case is skipped when its endpoint answers 404, 405 or 501. Run against a disposable database: they create guests and delete an account.

- name check accepts `Raven`; refuses `ab`, a 17-character name, `Adm1n`, `ghost rival` with the right `reason`
- `POST /guests` returns a handle `Name#1234`, `GET /auth/me` returns the same handle and `public_id`; two guests with one name get different tags
- upgrade keeps `id`, `public_id` and handle; a second upgrade answers `NOT_A_GUEST`
- delete with `{"confirm":"DELETE"}` then `GET /auth/me` answers 401
- `GET /dungeons` includes a public demo dungeon for a named guest
- (when built) `GET /packs` shape; `PACK_LOCKED`; attempt points fields and idempotent replay; `GET /leaderboard` invariants (at most 20 entries, ranks 1..n increasing, `me` null without a cookie, no `username` or internal id); `GET /stats/players` integer; `GET /uploads/quota` shape

#### 10. Questions for Person A (frontend-10)

1. Can `POST /guests` return `dungeon_id`, or is `GET /packs` the way to find the first dungeon? (Finding 1)
2. Will you build V2 A-R10 (display name and tag for registered users) before the live leaderboard? (Finding 2)
3. Is `last_active_at` updated anywhere, so active guests are not purged at day 30? (Finding 4)
4. Can short reserved words use whole-word matching? (Finding 5)
5. Which phase of your work builds `GET /packs`, the points fields, the new leaderboard, `GET /stats/players` and `GET /uploads/quota`, in what order? We build in the order guest entry, packs, leaderboard, counter, upload.
6. Are the points reason values in section 4 final?
7. Do you want `GET /meta` (section 8)?
8. Are the file rules numbers in section 7 right (30 pages, 30 slides, 500 minimum characters)? **Please confirm or send the real DOCX character limit: 60,000 is UNCONFIRMED (your default B20, not agreed).** Would you serve these limits from `GET /uploads/quota` or `GET /meta` so the frontend can drop its constants?
9. Please keep `POST /demo/session` until we report the name step is live, and keep `GET /health` DB-free with CORS for 5173 and 5174. A cold free-tier start can take up to 60 s: please make sure `POST /guests` is not cut earlier by a proxy timeout.
10. Does `GET /leaderboard` for a registered user without a display name show the login name as `handle`? If yes, please fix before launch (Finding 2).
