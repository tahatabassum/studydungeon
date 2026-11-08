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
