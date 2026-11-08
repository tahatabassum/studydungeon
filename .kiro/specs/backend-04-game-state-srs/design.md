# Design: Backend 04 — Authoritative Game State & Spaced Repetition (SRS)

## 1. Modules & Structure
- `app/services/combat.py`: Deterministic damage formulas, weapon unlocks, critical hit calculations.
- `app/services/srs.py`: SM-2 algorithm scheduler and end-of-run scorecard generator.
- `app/api/runs.py`: Endpoints for run management, attempt evaluation, room clears, and finish.
- `app/api/progress.py`: Endpoints for level, total XP, and weapon progression.
- `app/api/reviews.py`: Endpoints for due spaced-repetition items.
- `app/models/all_models.py`: `GameRun`, `Attempt`, `ReviewItem`, `UserProgress`.

## 2. Mathematical Combat & SRS Specifications
1. **Health Tracking:**
   - Player starting health: **100 HP**.
   - Defeat triggered at `0 HP` (`player_defeated=true`). Defeat does not wipe user XP or account progress.
2. **Deterministic Weapon Damage Formulas:**
   - Rusty Dagger: 20
   - Arcane Staff: 25
   - Hunter Crossbow: 30
   - Spectral Hammer: 35
   - Flame Sigil: 40
   - **Hard Question Multiplier:** `Damage = round(Base Damage * 1.25)`
   - **Critical Streak Multiplier:** If current correct streak ≥ 2, current hit is critical: `Damage = round(Calculated Damage * 1.50)`.
   - **Wrong Answer:** Monster deals `10 HP` (Boss: `12 HP`). Monster takes 0 damage.
3. **Idempotent Attempts:**
   - Client sends UUID `attempt_id`.
   - If an attempt with that ID already exists for the run, return the cached result without double-applying damage or score.
4. **SM-2 Spaced Repetition Scheduling:**
   - Incorrect Answer: Reset streak to 0, schedule next review in **10 minutes**.
   - Correct (Marked Difficult): Schedule in **1 day**.
   - 1st Correct: Schedule in **3 days**.
   - 2nd Correct: Schedule in **7 days**.
   - 3rd Correct: Schedule in **14 days**, subsequent in **30 days**.

## 3. Endpoints & Route Definitions
- `POST /runs`: Start run for `dungeon_id`. **Guest Rule:** Guests may start runs ONLY if `dungeon.is_public_demo == True`.
- `GET /runs/{id}` [PROPOSED]: Resume active run state after page refresh or network drop.
- `POST /runs/{id}/attempts`: Submits `{attempt_id, question_id, selected_option, response_time_ms}`. Returns authoritative damage and HP snapshot.
- `POST /runs/{id}/rooms/{room_id}/clear`: Persists room completion bonus.
- `POST /runs/{id}/finish`: Finalizes run, generates scorecard (mastery bands: Weak <50%, Learning 50-79%, Strong ≥80%).
- `GET /progress`: Current level, total XP, unlocked weapons list.
- `GET /reviews/due`: List of due questions needing revision.

## 4. Implementation Status
- **Implemented:**
  - `GameRun`, `Attempt`, `ReviewItem`, `UserProgress` SQLAlchemy models.
  - Core combat math (`calculate_combat_damage`) and SRS interval calculation (`calculate_next_review_interval`) in `app/services/combat.py`.
  - Comprehensive unit tests in `tests/test_combat.py`.
- **Missing / Pending:**
  - Route handlers: `POST /runs`, `GET /runs/{id}`, `POST /runs/{id}/attempts`, `POST /runs/{id}/rooms/{room_id}/clear`, `POST /runs/{id}/finish`.
  - Idempotency deduplication check in database.
  - Endpoints `GET /progress` and `GET /reviews/due`.

## 5. Test Strategy & Property-Based Testing
- **Property-Based Testing (PBT Candidates):**
  - **Damage Invariant:** For any valid weapon and streak, damage dealt to monster is strictly `>= Base Damage` on correct answers, and exactly `0` on wrong answers.
  - **Idempotency Invariant:** Repeating the identical `POST /runs/{id}/attempts` call $N$ times results in identical HP and state as calling it once.
  - **SRS Interval Monotonicity:** Successive correct reviews must produce strictly increasing intervals ($3 \le 7 \le 14 \le 30$).

