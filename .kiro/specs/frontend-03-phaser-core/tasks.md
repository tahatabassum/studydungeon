# Implementation Plan: frontend-03-phaser-core

## Overview

Implementation grows the single-room slice into a five-room dungeon with gates, a boss, a victory screen and pause, mute, restart and exit controls. Work goes bottom-up: contract and pure logic first (types, rules, mock, reducer, layout), then Phaser modules, then React wiring, then handoff and verification. Language is TypeScript (strict), as in the baseline. 

Git precondition: implementation starts only after the `feature/game-engine` PR is merged into `main` and a new branch `feature/frontend-phaser-core` is created from the updated `main`. All work for this spec happens on `feature/frontend-phaser-core`.

Implementation guidance: preserve the existing working prototype (`frontend-00-playable-slice`). Extend, do not rewrite, `MovementSystem`, `InteractionSystem`, `EffectsSystem`/`combatPlan`, `Player` and `Monster`. Keep the mock data path working (`VITE_USE_MOCKS=true`) throughout. After each task run the relevant tests plus `npm run typecheck` and `npm run build`.

After every task, run the tests relevant to the files changed and confirm `npm run typecheck` and `npm run build` in `frontend/` still pass. Keep `src/game` modules small, and do not import `@/api`, `@/demo` or `@/state` from `src/game`. Do not touch `backend/`, `.kiro/steering/`, other spec folders or `docs/` except `docs/handoff/B-to-A.md`.

## Tasks

- [x] 1. Extend the contract and rules
  - [x] 1.1 Extend API types and the Api_Client with finishRun
    - In `src/types/api.ts` add `Monster.kind`, `Room.order`, `Room.is_boss`, `Run.current_room_id` and the `RunSummary` type; leave `AnswerResult` and `AttemptRequest` unchanged
    - Add `finishRun(runId)` to `ApiClient` and implement it in `client.ts` as `POST /runs/{id}/finish` with `credentials: "include"`
    - Update `client.test.ts` and `index.test.ts` for the new method and fields
    - _Requirements: 8.1, 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] 1.2 Add room and boss profiles to Demo_Rules
    - In `src/demo/rules.ts` add `RulesProfile`, `ROOM_PROFILE` (20, 10) and `BOSS_PROFILE` (20, 12)
    - Add an optional third parameter `profile` to `applyAnswer` defaulting to `ROOM_PROFILE` so existing callers and tests stay valid
    - _Requirements: 6.6, 6.7, 6.8, 6.9_

  - [x] 1.3 Write property test for room and boss damage values
    - Add `src/demo/rules.profiles.test.ts` with fast-check, at least 100 runs
    - **Property 5: Room and boss damage values**
    - Tag: `Feature: frontend-03-phaser-core, Property 5`
    - **Validates: Requirements 6.6, 6.7, 6.8, 6.9**

- [x] 2. Build the five-room mock dungeon and multi-room Mock_Adapter
  - [x] 2.1 Update the Demo_Dungeon and answer key
    - Rewrite `src/demo/demoDungeon.json` with five rooms (Entry Hall, Alchemist's Lab, Clockwork Crypt, Forgotten Wing, Boss Room), monster kinds, `order`, `is_boss`, 4 original placeholder questions per Topic_Room (keep existing ids for room 1) and an 8-question boss pool with two questions per topic; boss `max_hp` 120 (exactly 6 correct answers at 20 damage defeat it; the 8-question pool still covers cycling after wrong answers), other monsters 60
    - Add an entry to `src/api/mock/answerKey.ts` for every question id
    - Add a unit test `src/demo/demoDungeon.test.ts` checking room count, labels, monsters, HP, unique question ids, an answer key entry for every question, boss pool topic coverage and that the public `Dungeon` data contains no answers
    - _Requirements: 6.10, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [x] 2.2 Make the Mock_Adapter multi-room and add finishRun
    - Replace the single `RulesState` run record with the multi-room `RunRecord` from the design (player HP, per-room monster HP, cleared set, counters, finished flag)
    - Map each question to its room, use `BOSS_PROFILE` for the boss room, return 409 for attempts on a dead monster or at player HP 0
    - `clearRoom`: 409 while monster HP above 0, XP 25 for Topic_Rooms and 100 for the Boss_Room, idempotent on repeat
    - `finishRun`: 409 before the boss is cleared, otherwise the `RunSummary` with `accuracy = correct / total` (0 when total is 0)
    - `startRun` returns `current_room_id` and the first room monster HP
    - Update `mockAdapter.test.ts` deliberately for the new shapes
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.11, 7.2, 7.7, 8.1, 8.5, 8.6, 13.3_

  - [x] 2.3 Write property test for mock run invariants across rooms
    - Add `src/api/mock/mockRun.invariants.test.ts`, at least 100 runs
    - **Property 6: Mock run invariants across rooms**
    - Tag: `Feature: frontend-03-phaser-core, Property 6`
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.11**

  - [x] 2.4 Write property test for clear succeeding only at zero HP
    - Add `src/api/mock/mockRun.clear.test.ts`, at least 100 runs
    - **Property 7: Clear succeeds only at zero monster HP**
    - Tag: `Feature: frontend-03-phaser-core, Property 7`
    - **Validates: Requirements 7.2, 12.6**

  - [x] 2.5 Write property test for run summary consistency
    - Add `src/api/mock/mockRun.summary.test.ts`, at least 100 runs
    - **Property 8: Run summary consistency**
    - Tag: `Feature: frontend-03-phaser-core, Property 8`
    - **Validates: Requirements 8.5, 8.6**

  - [x] 2.6 Write unit tests for finishRun, clear idempotence and boss balance
    - Add examples to `mockAdapter.test.ts`: full dungeon playthrough ending in a summary, `finishRun` 409 before boss, repeated `clearRoom` returns the same `xp_delta`
    - Add a boss example: from full HP (120) exactly 6 correct answers bring the Boss to 0 (5 do not), each wrong answer in the Boss_Room costs 12 player HP, and boss clear XP is 100 versus 25 for a Topic_Room
    - _Requirements: 6.9, 6.10, 6.12, 7.7, 8.1, 8.5_

  - [x] 2.7 Write property test for boss falling after exactly 6 correct answers
    - Add `src/api/mock/mockRun.boss.test.ts`, at least 100 runs
    - **Property 11: Boss falls after exactly 6 correct answers**
    - Tag: `Feature: frontend-03-phaser-core, Property 11`
    - **Validates: Requirements 6.8, 6.9, 6.10, 6.12**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Build multi-room run state and the event contract
  - [x] 4.1 Add the Question_Selector
    - Create `src/state/questionSelector.ts` exporting `pickQuestionId(pool, askedCount)` returning `pool[askedCount % pool.length]`, or undefined for an empty pool
    - _Requirements: 5.4, 5.5, 5.6_

  - [x] 4.2 Write property test and routing unit test for the Question_Selector
    - Add `src/state/questionSelector.test.ts`, at least 100 runs
    - **Property 4: Question selection stays in the pool and cycles**
    - Tag: `Feature: frontend-03-phaser-core, Property 4`
    - Add a unit test that an encounter for a monster in room k resolves only ids from that monster's `question_ids`, using the Demo_Dungeon
    - **Validates: Requirements 5.4, 5.5, 5.6**

  - [x] 4.3 Update the Event_Bridge contract
    - In `src/game/events.ts` add phase `victory`, replace `load-room` with `load-dungeon`, replace `room-cleared` with `gate-open`, add `set-muted`, and add `room-entered` and `gate-opened` from the game
    - Update `events.test.ts` for the changed events; queue-until-ready behavior must still pass
    - _Requirements: 3.2, 3.3, 3.5, 10.3_

  - [x] 4.4 Make the Run_Reducer multi-room
    - Extend `RunState` and actions as in the design (`currentRoomId`, `roomOrder`, `bossRoomId`, `roomHp`, `roomMaxHp`, `clearedRoomIds`, `summary`; actions `run-started` with rooms, `room-entered`, `room-cleared` with room id, `gate-opened`, `run-finished`)
    - Enforce guards: room change only after the predecessor is cleared, clear only at remembered HP 0, victory only after boss clear with a summary
    - Update `runReducer.test.ts` deliberately
    - _Requirements: 7.5, 8.2, 9.1, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

  - [x] 4.5 Write property test for reducer room ordering
    - Add `src/state/runReducer.rooms.test.ts`, at least 100 runs
    - **Property 9: Reducer room ordering**
    - Tag: `Feature: frontend-03-phaser-core, Property 9`
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.6**

  - [x] 4.6 Write property test for reducer value copying and victory gating
    - Add `src/state/runReducer.victory.test.ts`, at least 100 runs
    - **Property 10: Reducer copies authoritative values and gates victory**
    - Tag: `Feature: frontend-03-phaser-core, Property 10`
    - **Validates: Requirements 12.4, 12.5, 12.7**

- [x] 5. Build the pure dungeon layout
  - [x] 5.1 Implement the Layout_Builder and room-origin wall helpers
    - Create `src/game/world/DungeonLayout.ts` with `buildDungeonLayout` and `roomAt` (no Phaser import), returning typed errors for an empty list and duplicate `order`
    - Extend `RoomLayout.ts` helpers (`borderWallTiles`, pillars, torches) to accept a room origin and entry and exit gap flags; keep exported constants working
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 3.6_

  - [x] 5.2 Write property test for layout structural invariants
    - Add `src/game/world/DungeonLayout.invariants.test.ts`, at least 100 runs
    - **Property 1: Layout structural invariants**
    - Tag: `Feature: frontend-03-phaser-core, Property 1`
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.6**

  - [x] 5.3 Write property test for layout determinism
    - Add `src/game/world/DungeonLayout.determinism.test.ts`, at least 100 runs
    - **Property 2: Layout determinism and input-order independence**
    - Tag: `Feature: frontend-03-phaser-core, Property 2`
    - Add an edge-case example for the empty list error
    - **Validates: Requirements 2.5, 2.7**

  - [x] 5.4 Write property test for room lookup
    - Add `src/game/world/roomAt.test.ts`, at least 100 runs
    - **Property 3: Room lookup consistency**
    - Tag: `Feature: frontend-03-phaser-core, Property 3`
    - **Validates: Requirements 3.5, 5.1, 5.3**

- [x] 6. Build the multi-room Phaser scene
  - [x] 6.1 Add monster styles and update Monster
    - Create `src/game/entities/monsterStyles.ts` with `getMonsterStyle(kind, isBoss)` (five known kinds, default fallback, boss scale 1.8 and distinct style)
    - Update `Monster.ts` to use the style, draw the HP bar from `max_hp` and latest remaining HP, and fade out when HP reaches 0
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 6.2 Add per-room Gate, RoomTracker and current-room interaction
    - Update `Gate.ts` to be created per `GateSpec`, with a closed collider, `open()` tween, and a `gate-opened` emit
    - Create `systems/RoomTracker.ts` that calls `roomAt` each frame and emits `room-entered` on change, including once at load
    - Update `InteractionSystem.ts` to consider only the living monster of the Current_Room
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 5.1, 5.2, 5.3_

  - [x] 6.3 Rebuild GameScene for the whole dungeon
    - On `load-dungeon` run the Layout_Builder, show an error event path for invalid data, set physics and camera bounds to the world, build walls, Gates, torches, labels and monsters for every room, place the Player at spawn and follow with the camera
    - Handle `gate-open`, `set-muted` (store flag only), `apply-result` for the active encounter monster, and `reset` (close all Gates, restore monsters, return Player to spawn)
    - Disable movement unless the phase is `exploring`; respect reduced motion for new effects
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 3.1, 3.2, 3.4, 4.1, 9.4, 10.3, 10.9, 15.2, 15.4, 15.6_

  - [x] 6.4 Write unit tests for monster styles and import boundary
    - Add `monsterStyles.test.ts`: known kinds, unknown kind fallback, boss style distinct from all room styles
    - Add `src/game/importBoundary.test.ts` asserting no file in `src/game` imports `@/api`, `@/demo` or `@/state` (or their relative forms)
    - _Requirements: 4.3, 4.4, 15.1, 15.3_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Wire the React UI
  - [x] 8.1 Add RoomProgress to the HUD
    - Create `src/components/RoomProgress.tsx` with markers for cleared, current, upcoming and boss, a "Room X of N: label" text and an `aria-label`; state not conveyed by color alone
    - Render it in `Hud.tsx` using reducer state and dungeon rooms
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 8.2 Add VictoryOverlay, ConfirmDialog and the extended PauseMenu
    - Create `VictoryOverlay.tsx` (`role="dialog"`, summary values shown as received, accuracy as a percentage, "Play again" and "Exit", error state with retry)
    - Create `ConfirmDialog.tsx` (`role="alertdialog"`, focus on cancel button when opened)
    - Extend `PauseMenu.tsx` with Resume, Mute toggle (`aria-pressed`), Restart and Exit
    - _Requirements: 8.3, 8.4, 8.7, 8.8, 8.9, 10.2, 10.5, 10.7, 10.8_

  - [x] 8.3 Extend usePlaySession for multi-room orchestration
    - Send `load-dungeon`; keep per-monster ask counts (cleared on new run) and use `pickQuestionId` on `encounter-started`
    - On result settle with monster HP 0: call `clearRoom`, dispatch `room-cleared`, then send `gate-open` for Topic_Rooms or call `finishRun` and dispatch `run-finished` for the Boss_Room
    - Dispatch `room-entered` and `gate-opened` from game events; expose retry for clear and finish failures with the Gate staying closed
    - Implement retry, restart and play-again as a new run from the first room (reset game and reducer), the `muted` state with `set-muted`, and exit
    - _Requirements: 5.4, 7.1, 7.3, 7.4, 7.5, 7.6, 8.2, 9.3, 10.3, 10.4, 10.6_

  - [x] 8.4 Wire PlayPage
    - Render RoomProgress, VictoryOverlay (phase `victory`), DefeatOverlay, PauseMenu and ConfirmDialog; Esc opens pause only while exploring; Exit confirm navigates to the landing page using the existing navigation mechanism and cancel returns to the pause menu
    - Show an error state with a link to the landing page when the layout reports invalid dungeon data or the question pool is empty
    - _Requirements: 8.3, 9.2, 10.1, 10.5, 10.6, 10.7, 10.9_

  - [x] 8.5 Update the integration smoke test
    - Update `PlayFlow.smoke.test.tsx` (Phaser mocked at the bridge): Try the Demo, encounter in room 1, answer until the monster is dead, observe `gate-open` sent, simulate `gate-opened` and `room-entered` for room 2, assert the HUD shows room 2 and that an encounter in room 2 uses room 2 questions
    - _Requirements: 5.4, 7.3, 11.5, 16.2_

  - [ ]* 8.6 Write component tests for new UI
    - RoomProgress states and label, VictoryOverlay values and buttons, ConfirmDialog focus and role
    - _Requirements: 8.3, 10.8, 11.2, 11.4_

- [x] 9. Document the contract changes for Person A
  - [x] 9.1 Update docs/handoff/B-to-A.md
    - Add the new and changed fields (`Room.order`, `Room.is_boss`, `Monster.kind`, `Run.current_room_id`, `RunSummary`), the `POST /runs/{id}/finish` endpoint, mock-only boss values (120 HP, 20 damage per correct answer so exactly 6 correct answers defeat the Boss, 12 wrong-answer damage, boss clear XP 100; room monsters 60 HP, 20 damage, 10 wrong-answer damage, clear XP 25)
    - Specify `POST /runs/{id}/finish` with an explicit request shape (no request body, run id in the path, cookie credentials) and the full response shape `RunSummary { score, xp, correct, total, accuracy }` with `accuracy` a ratio from 0 to 1, plus the 409 case before the Boss is cleared
    - Document the multi-room `clearRoom` semantics: 409 while the room monster HP is above 0, idempotent on repeat, Boss clear is followed by `finishRun`
    - State that the changed Event_Bridge events are internal to the frontend and have no backend impact
    - State explicitly that Person A has NOT implemented these changes yet and the frontend uses the mock (`VITE_USE_MOCKS=true`) until Person A confirms
    - Keep all existing content of the file; append or update sections instead of rewriting
    - Also note that the backend stays authoritative and Person A must confirm
    - Add open questions: does `Run.monster_hp` refer to the current room, how are per-room HP and cleared state returned on resume, are attempts rejected out of room order, is `accuracy` a ratio or percentage, and which monster kinds exist
    - Edit only this file under `docs/`
    - _Requirements: 13.6, 13.7_

- [x] 10. Final verification
  - [x] 10.1 Run the full verification and record results
    - In `frontend/` run `npm run typecheck`, `npm run lint`, `npm run test` and `npm run build`; fix verified root causes and record the real output
    - Perform the manual browser walkthrough at 1366x768 and record results: movement across all five rooms, each Gate closed then open, boss fight, victory with summary, defeat with retry, pause, mute toggle, restart, exit confirmation, reduced motion
    - _Requirements: 15.4, 15.5, 16.1, 16.3_

## Notes

- Test sub-tasks for the eleven correctness properties and the smoke test are intentionally required (not marked optional), as requested for this spec; only the component tests in 8.6 are optional.
- Each task references specific requirements for traceability.
- Boss balance and clear XP values exist only in the mock path and need Person A's confirmation.
- Phaser rendering is verified manually and through a mocked bridge; property tests cover pure and in-memory logic.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "4.1", "5.1", "9.1"] },
    { "id": 1, "tasks": ["1.3", "2.1", "4.2", "4.3", "5.2", "5.3", "5.4", "6.1"] },
    { "id": 2, "tasks": ["2.2", "4.4", "6.2"] },
    { "id": 3, "tasks": ["2.3", "2.4", "2.5", "2.6", "2.7", "4.5", "4.6", "6.3", "6.4", "8.1"] },
    { "id": 4, "tasks": ["8.2", "8.3"] },
    { "id": 5, "tasks": ["8.4"] },
    { "id": 6, "tasks": ["8.5", "8.6"] },
    { "id": 7, "tasks": ["10.1"] }
  ]
}
```
