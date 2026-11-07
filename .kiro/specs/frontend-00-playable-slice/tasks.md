# Implementation Plan: frontend-00-playable-slice

## Overview

Build the first playable vertical slice in TypeScript under `frontend/` only: Try the Demo, move in one room, meet a monster, answer, see animated damage, clear the room or be defeated and retry. Work bottom-up: tooling, types and pure rules, mock API, state, landing page, Phaser game, React play UI, handoff doc, verification. Do not touch `backend/`, `docs/` (except creating `docs/handoff/B-to-A.md`), `.kiro/steering/` or other specs. Pin new dependencies to exact versions. After each task, run the relevant tests and confirm `npm run typecheck` and `npm run build` still pass.

## Tasks

- [x] 1. Tooling and scaffold
  - [x] 1.1 Add lint and test tooling
    - Add exact-pinned dev dependencies: eslint, typescript-eslint, eslint-plugin-react-hooks, vitest, jsdom, @testing-library/react, @testing-library/user-event, fast-check
    - Add `lint` (`eslint .`) and `test` (`vitest --run`) scripts; create `eslint.config.js` and Vitest config (jsdom, `@/*` alias)
    - Add an ESLint `no-restricted-imports` rule forbidding `src/game/**` from importing `@/demo` and `@/api`
    - Create `frontend/.env.example` with `VITE_API_BASE_URL=` and `VITE_USE_MOCKS=true`
    - _Requirements: 1.2, 1.3, 1.5, 6.7_

  - [x] 1.2 Create src skeleton, tokens and router
    - Create `src/main.tsx`, `src/App.tsx` (react-router routes `/`, `/login`, `/play`), `src/index.css` and the folder layout from the design
    - Define the Design_Tokens as CSS variables and Tailwind `@theme` colors; add global focus ring and `prefers-reduced-motion` rules
    - Rename `index.html` body classes to existing token utilities (for example `bg-background text-parchment`)
    - _Requirements: 1.1, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 2. Types, demo rules and API layer
  - [x] 2.1 Define API types
    - Create `src/types/api.ts` with User, DemoSessionResponse, Question, Monster, Room, Dungeon, Run, AttemptRequest, AnswerResult, ClearRoomResponse
    - _Requirements: 4.1_

  - [x] 2.2 Implement the Demo_Rules module
    - Create `src/demo/rules.ts` with `INITIAL_STATE` (100 HP, monster 60, streak 0), `WEAPON_DAMAGE` 20, `WRONG_ANSWER_DAMAGE` 10 and pure `applyAnswer`
    - Document the agreed values (100/60/20/10) in a code comment and state that the backend is authoritative
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_

  - [x] 2.3 Write property tests for the Demo_Rules
    - **Property 1: Correct answer result**
    - **Property 2: Wrong answer result**
    - **Property 3: Rules state invariants over sequences**
    - **Property 4: Rules determinism**
    - Add a unit test for starting values; at least 100 runs each, tagged `Feature: frontend-00-playable-slice, Property N`
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 15.1**

  - [x] 2.4 Implement demo data and Mock_Adapter
    - Create `src/demo/demoDungeon.json` (one room, one monster with 60 HP, four to five placeholder questions)
    - Create `src/api/mock/answerKey.ts` (correct answers, explanations, source pages) kept out of the public Dungeon shape
    - Create `src/api/mock/mockAdapter.ts` implementing every ApiClient operation, using the Demo_Rules, and storing results by `attempt_id` for idempotency
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 10.5_

  - [x] 2.5 Implement the real Api_Client and selector
    - Create `src/api/errors.ts` (`ApiError` with status), `src/api/client.ts` (fetch, `credentials: "include"`, `VITE_API_BASE_URL`, attempt body limited to `question_id`, `selected_answer`, `attempt_id`) and `src/api/index.ts` selecting the Mock_Adapter through a dynamic import only when `VITE_USE_MOCKS` is `true`
    - _Requirements: 4.1, 4.2, 4.3, 4.7, 4.8, 4.9, 3.8_

  - [x] 2.6 Write property and unit tests for the API layer
    - **Property 5: Mock attempt results conform to the contract**
    - **Property 6: Attempt idempotence**
    - Unit tests: demo session shape (`is_guest` true), typed `ApiError` on non-success, request body has no damage field, mock flag selection
    - **Validates: Requirements 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 15.3**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Run state and session
  - [x] 4.1 Implement the Run_State reducer
    - Create `src/state/runReducer.ts` with the Phase type, RunState and actions from the design; `result-received` only copies authoritative values and adds `xp_delta`
    - _Requirements: 10.6, 10.7, 12.1, 12.4_

  - [x] 4.2 Write property tests for the reducer
    - **Property 7: Reducer copies authoritative values**
    - **Property 8: Reducer sequence invariants and terminal phases**
    - Include HP boundary tests: player HP clamped 0..100, monster HP 0..60, HP never below 0, terminal phases at 0 HP
    - **Validates: Requirements 10.6, 12.1, 12.2, 12.4, 15.2, 15.5**

  - [x] 4.3 Implement the in-memory session context
    - Create `src/state/SessionContext.tsx` holding user, dungeonId and expiresAt in memory only
    - _Requirements: 3.4, 3.8_

- [x] 5. Landing page
  - [x] 5.1 Create shared UI components
    - Create `Button` (primary and secondary variants) and `Spinner` with accessible status text
    - _Requirements: 2.3, 3.2_

  - [x] 5.2 Build the Landing_Page and login placeholder
    - Hero, three-step explanation, Try_Demo_Button calling `api.startDemoSession`, pending and error states, navigation to `/play`; Login_Button navigating to a placeholder `/login`
    - Redirect `/play` to `/` when no session exists
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ]* 5.3 Write Landing_Page component tests
    - Pending disables the button, success navigates, failure shows an alert and re-enables, Login navigates
    - _Requirements: 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 6. Phaser game
  - [x] 6.1 Define the Event_Bridge
    - Create `src/game/events.ts` with ToGameEvent, FromGameEvent and a typed emitter that queues events until `ready`
    - _Requirements: 6.3, 6.4_

  - [x] 6.2 Implement Game_Canvas and Boot_Scene
    - Create `GameCanvas.tsx` (single instance under strict mode, `destroy(true)` on cleanup, `Phaser.Scale.FIT`), `config.ts` and `BootScene.ts` with a loading bar that starts GameScene
    - _Requirements: 6.1, 6.2, 7.1, 7.5_

  - [x] 6.3 Implement Game_Scene room, walls, gate and camera
    - Create `GameScene.ts`, `entities/Gate.ts`; build the room from the `load-room` event with procedural graphics, static walls, follow camera and room label; no hard-coded dungeon data
    - _Requirements: 6.4, 7.2, 7.3, 7.4_

  - [x] 6.4 Implement Player and movement
    - Create `entities/Player.ts` and `systems/MovementSystem.ts`: WASD and arrows, normalized diagonal speed, wall collision, input disabled unless phase is `exploring`
    - _Requirements: 8.1, 8.2, 8.3, 8.6_

  - [x] 6.5 Implement Monster and interaction
    - Create `entities/Monster.ts` (procedural shape, idle tween, HP bar) and `systems/InteractionSystem.ts` (64 px range, prompt, E or Space emits `encounter-started`)
    - _Requirements: 6.5, 8.4, 8.5_

  - [x] 6.6 Implement combat effects and result handling
    - Create `systems/EffectsSystem.ts`; on `apply-result` animate attack effect, damage number, hit flash, monster attack, 120 ms shake and HP bar tweens using only result values; skip shake and flash and snap bars under reduced motion; fade monster and open gate on `monster_hp_remaining` 0 or `room-cleared`; emit `result-animation-done`
    - _Requirements: 6.6, 10.1, 10.2, 10.3, 10.4, 12.1_

  - [ ]* 6.7 Write Game_Canvas tests
    - With Phaser mocked, verify strict-mode double mount leaves one game and unmount destroys it
    - _Requirements: 6.1, 6.2_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. React play UI
  - [x] 8.1 Build HUD and guest banner
    - Create `Hud.tsx` (progressbars with aria values for player HP and monster HP, XP) and `GuestBanner.tsx` with the exact banner text and a Create account control
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 8.2 Build the Question_Panel and Source_Line
    - Create `QuestionPanel.tsx` (parchment dialog, roles and labels, focus in and restore, 1 to 4 keys, disabled while pending, error with retry using the same `attempt_id`, True/False support) and `SourceLine.tsx` ("From your notes: page X" plus the explanation only when present; page only when absent, no error)
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 10.5_

  - [x] 8.3 Build defeat overlay and pause menu
    - Create `DefeatOverlay.tsx` (Retry receives focus) and `PauseMenu.tsx` (Resume and Restart)
    - _Requirements: 12.4, 12.6, 13.1, 13.3_

  - [x] 8.4 Wire the Play_Page
    - Create `pages/PlayPage.tsx`: load dungeon and run through `api`, own the reducer, bridge events, open the Question_Panel on `encounter-started`, submit attempts, send `apply-result`, update state on `result-animation-done`, call `clearRoom` on monster defeat, show room-cleared message, Retry and Restart start a new run and send `reset`, Esc pause and resume, reduced-motion hook sending `set-reduced-motion`
    - _Requirements: 9.1, 10.6, 10.7, 11.5, 12.2, 12.3, 12.5, 13.1, 13.2, 13.3, 13.4_

  - [ ]* 8.5 Write component tests for the play UI
    - QuestionPanel: dialog attributes, number keys submit once, disabled while pending, retry reuses `attempt_id`
    - Hud progressbar attributes, exact Guest_Banner text, DefeatOverlay focuses Retry
    - _Requirements: 9.3, 9.5, 9.6, 9.7, 11.2, 11.3, 12.6_

  - [x] 8.6 Write integration smoke test for the play flow
    - Render App with the Mock_Adapter (`VITE_USE_MOCKS` true) and Phaser mocked at the GameCanvas/bridge boundary
    - Click Try the Demo, land on `/play`, simulate `encounter-started` from the bridge, answer a question
    - Assert HUD HP and XP update from the Answer_Result and `apply-result` was sent to the game
    - _Requirements: 15.6, 3.3, 3.4, 9.1, 10.6_

- [x] 9. Handoff documentation
  - [x] 9.1 Create `docs/handoff/B-to-A.md`
    - List each assumed endpoint request and response shape, the finalized request and response shapes, the agreed balance values (player 100 HP, monster 60 HP, correct damage 20, wrong damage 10, score 100, xp 10), that `explanation` is optional, the demo dungeon JSON shape and open questions for Person A
    - State that the shapes are replaced by `.kiro/steering/api-contract.md` once published
    - _Requirements: 14.1, 14.2_

- [x] 10. Final verification
  - [x] 10.1 Run all checks and a manual walkthrough
    - Run `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` in `frontend/` and record real output; fix verified failures only
    - Manual walkthrough with `VITE_USE_MOCKS=true` at 1366x768: Try the Demo, move, interact, correct and wrong answers, room clear, defeat and retry, pause, reduced motion
    - _Requirements: 15.4, 2.6_

## Notes

- Required tests: Demo_Rules properties (2.3), API layer properties (2.6), reducer properties with HP boundaries (4.2) and the integration smoke test (8.6)
- Only extensive React component tests (5.3, 6.7, 8.5) are marked `*` and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- After each task, run the relevant tests and confirm `npm run typecheck` and `npm run build` pass
- Property tests validate universal correctness properties; unit tests validate examples and edge cases
- Phaser rendering and layout are verified through the manual walkthrough, not property tests
- Out of scope for this spec: login, register, dashboard, upload, scorecard, multiple rooms, boss, real assets and audio, offline fallback UX, backend integration, deployment, hooks

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "9.1"] },
    { "id": 2, "tasks": ["2.2", "4.3", "5.1", "6.1"] },
    { "id": 3, "tasks": ["2.3", "2.4", "2.5", "4.1", "6.2", "8.1"] },
    { "id": 4, "tasks": ["2.6", "4.2", "5.2", "6.3", "8.2", "8.3"] },
    { "id": 5, "tasks": ["5.3", "6.4"] },
    { "id": 6, "tasks": ["6.5"] },
    { "id": 7, "tasks": ["6.6"] },
    { "id": 8, "tasks": ["6.7", "8.4"] },
    { "id": 9, "tasks": ["8.5", "8.6"] },
    { "id": 10, "tasks": ["10.1"] }
  ]
}
```
