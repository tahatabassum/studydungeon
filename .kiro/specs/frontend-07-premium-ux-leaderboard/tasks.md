# Implementation Plan: frontend-07-premium-ux-leaderboard

## Overview

Premium UX overhaul delivered in Phases 0 to 8 on branch feature/frontend-premium-ux. Each phase is sized for one sub-agent, phases run sequentially, and each phase ends with a STOP checkpoint. The decisions D1 to D26 in design.md use their recommended defaults unless the user changes them at the Phase 0 STOP.

Rules for every task:

- Edit only `frontend/**`, `.kiro/specs/frontend-*`, `.kiro/hooks/frontend-*`, `.kiro/steering/frontend-*`, `docs/handoff/B-to-A.md` and `docs/kiro-log-frontend.md`. Never touch `backend/`.
- The Backend is authoritative for correctness, damage, HP, XP, score, streaks, rank and badges. Only the Mock_Adapter and the Offline_Module compute them. Never compute damage in a component or in Phaser.
- Phaser code under `src/game` imports nothing from `src/api`, `src/demo`, `src/state`, `src/offline` or `src/leaderboard`. Keep `importBoundary.test.ts` passing.
- New Event_Bridge events are additive. Existing events and payloads stay unchanged.
- New backend needs are recorded in `docs/handoff/B-to-A.md` as PROPOSED CONTRACT and built against the mock, marked pending.
- Art is code-drawn or licensed and recorded in `frontend/ASSETS_LICENSES.md`. The character pop-up reference game is a layout idea only; draw original characters.
- Paths are relative to `frontend/` unless they start with `docs/` or `.kiro/`.
- Pure logic goes in Phaser-free modules. Pools are used for effects, with no per-frame allocation. Reduced motion and mute are respected in every new effect.
- Every phase's last sub-task runs `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` in `frontend/`, records real output, updates `docs/kiro-log-frontend.md`, and updates `ASSETS_LICENSES.md` when assets changed.
- Each phase ends with a STOP task. Summarize the changes, tell the user how to view and check them, wait for approval, then commit that phase separately.
- Sub-tasks marked with `*` are optional (optional property-based tests, and all of Phase 8). Required tests (unit, example, boundary, contract) carry no marker.
- Property tests use fast-check with at least 100 runs and the tag `Feature: frontend-07-premium-ux-leaderboard, Property N: <title>`.

## Tasks

- [x] 1. Phase 0: Housekeeping (no gameplay change)
  - [x] 1.1 Create the lint, typecheck and test hook
    - Create `.kiro/hooks/frontend-lint-test-on-save.json` with trigger `PostFileSave`, matcher `^frontend/src/.*\.(ts|tsx)$` (check the current Kiro hooks docs again and adjust if the format differs), action type `command` running `npm run lint && npm run typecheck && npm test` with `cwd` frontend (or `cd frontend &&` if no cwd field exists)
    - Confirm the JSON parses and record the doc evidence in the kiro log
    - _Requirements: 18.1_

  - [x] 1.2 Write honest entries in the frontend Kiro log
    - Read `docs/kiro-log-frontend.md` and `git log --oneline` for the real history
    - Add entries for the specs used so far (frontend-00, 03, 04, 06, 07), the property-based testing used (fast-check files that exist), and the hooks used so far (this new one only; state plainly that no earlier hook existed)
    - _Requirements: 18.2_

  - [x] 1.3 Draft the UI standards steering proposal
    - Create `.kiro/steering/frontend-ui-standards.md` marked "PROPOSAL for Person A's review" covering design tokens (spacing, type, glow, elevation), motion rules (durations, Reduced_Motion), accessibility rules (contrast, focus, aria-live) and adapter rules (Api_Client only, authority, offline boundary)
    - _Requirements: 18.3_

  - [x] 1.4 Write the PROPOSED CONTRACT section in B-to-A.md
    - Append a section headed `PROPOSED CONTRACT (pending Person A)` to `docs/handoff/B-to-A.md` with example JSON for: GET /leaderboard (query, `entries[]`, `me`, `updated_at`, guests can read, rivals flagged), `finishRun` additions (`badges_earned`, `leaderboard_rank`, `weapon_unlocked`, `level_up`, plus `topic_mastery`, `weak_concepts`), `progress` additions (`badges`, `weapons[{id, unlock_level}]`, `recent_runs`, `due_review_count`), `attempt` additions (`weapon_id`, `is_critical`), Due_Review delivery (run payload or GET /reviews/due, Person A chooses), auth endpoints (POST /auth/register, /auth/login, /auth/logout, GET /auth/me) and an upload endpoint (pending)
    - State that boss phase is derived from monster HP and needs no change, that boss difficulty and any speed bonus are backend scoring changes, that the cookie session is the only credential, and that Person A must supply `api-contract.md`, `game-design.md` and `docs/handoff/demo_dungeon.sample.json`
    - _Requirements: 1.7, 1.9, 17.9, 18.4_

  - [x] 1.5 Record the baseline and prepare the plan summary
    - Run typecheck, lint, tests and build once and record the baseline test count and any existing failures in the kiro log
    - Do not change application code in this phase
    - _Requirements: 20.1, 1.8_

- [x] 2. STOP: Phase 0 checkpoint, plan review
  - Show the user the plan: phases and task counts, decisions D1 to D26 with defaults, the hook file, the steering proposal and the PROPOSED CONTRACT section. Tell the user how to view them (open the four files). Wait for approval or changes to D1 to D26 before Phase 1. After approval commit Phase 0 separately.
  - _Requirements: 18.5, 20.6, 20.8_

- [x] 3. Phase 1: Full-screen layout, premium shell and API foundation
  - [x] 3.1 Implement the Viewport_Helper
    - Create `src/game/viewport.ts` with `zoomForViewport`, `layoutClass`, `hudMode` and `hudSafeBand` per design (D2: quarter-step zoom clamped to 0.75 to 3.0)
    - Pure, Phaser-free, no allocation beyond the returned rectangle
    - _Requirements: 2.5, 2.6, 3.2, 3.3_

  - [x]* 3.2 Write property tests for viewport helpers
    - **Property 1: Viewport zoom is bounded and on the grid**
    - **Property 2: HUD mode and safe band**
    - Create `src/game/viewport.property.test.ts`
    - **Validates: Requirements 2.5, 2.6, 3.2, 3.3**

  - [x] 3.3 Switch the canvas to a viewport-filling transparent stage
    - Edit `src/game/config.ts`: a single `SCALE_MODE` constant set to `Phaser.Scale.RESIZE`, `transparent: true`, keep `autoCenter`; keep `GAME_WIDTH` and `GAME_HEIGHT` exports used by tests
    - Add the `set-viewport` ToGameEvent in `src/game/events.ts` (additive) and a compatibility test listing every old event shape
    - Edit `src/game/scenes/GameScene.ts` to listen for the scale `resize` event and apply `zoomForViewport`, camera size and bounds without allocating per frame; keep `set-view-inset` handling with value 0
    - Edit `src/game/GameCanvas.tsx` to send `set-viewport` from its ResizeObserver and refit within 250 ms
    - _Requirements: 2.2, 2.3, 2.6, 1.5_

  - [x] 3.4 Add design tokens and control states
    - Edit `src/index.css` to add spacing, typography, glow and elevation tokens (keep every existing token name); add shared hover, focus-visible and pressed styles to `Button.tsx` and other controls
    - Extend `src/design/palette.test.ts` with contrast checks for the new text and component pairs (4.5:1 and 3:1)
    - _Requirements: 3.4, 3.5, 3.6, 3.7, 19.4, 19.7_

  - [x] 3.5 Build the AppShell, Themed_Backdrop and fullscreen
    - Create `src/components/AppShell.tsx` (100dvh, 100dvw, safe-area insets), `src/components/ThemedBackdrop.tsx` (gradient, vignette, fog in CSS, respects Reduced_Motion), `src/shell/useFullscreen.ts`, `src/components/FullscreenButton.tsx`
    - F key and button toggle fullscreen; a rejected request keeps the layout and announces a short message through the aria-live region
    - Restructure `src/pages/PlayPage.tsx` so the canvas fills the shell; keep the existing QuestionPanel as a bottom overlay sheet only until Phase 2 replaces it; send `set-view-inset` 0
    - Add tests with `requestFullscreen` mocked to resolve and to reject
    - _Requirements: 2.1, 2.4, 2.7, 2.8, 19.8_

  - [x] 3.6 Build the Floating_HUD
    - Edit `src/components/Hud.tsx` and create `src/components/ControlsLegend.tsx`: a top bar and bottom legend that float over the stage, stay inside the bands from `hudSafeBand`, collapse to a compact bar with a legend toggle below 640 px, and use instant state changes under Reduced_Motion
    - Update `Hud.test.tsx`, `ControlsHint.test.tsx` and `PlayFlow.smoke.test.tsx`
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.7_

  - [x] 3.7 Add zod validation and the Contract_Error
    - Install `zod` at the exact version 4.6.7 (`npm install --save-exact zod@4.6.7`)
    - Create `src/config/flags.ts`, `src/api/ContractError.ts`, `src/api/schemas.ts` for the seven existing endpoints, and edit `src/api/client.ts` so every response is parsed with its schema and failures throw `ContractError` naming the endpoint and field path; make `usePlaySession` and the pages show a clear error for it
    - Add `PROPOSED` markers in `src/types/api.ts` conventions (comment style from design Data Models) and keep `src/api/client.test.ts` passing
    - _Requirements: 17.1, 17.2, 17.3, 17.4_

  - [x] 3.8 Add fixtures and the Contract_Suite for existing endpoints
    - Create `src/api/mock/fixtures/*.json` for demo session, dungeon, run, attempt (correct and wrong), clear, finish and progress; add a test that validates each fixture against `schemas.ts`
    - Create `src/contract/suite.ts`, `src/contract/mock.contract.test.ts` and `src/contract/http.contract.test.ts` (skipped with a clear message unless `VITE_API_BASE_URL` is set and mocks are off); add script `"test:contract": "vitest --run src/contract"` to `package.json`
    - Update `frontend/.env.example` with the new flags
    - _Requirements: 17.5, 17.6, 17.7, 17.8, 17.10_

  - [x]* 3.9 Write property test for schema validation
    - **Property 22: Schema validation round trip and loud failure**
    - Create `src/api/schemas.property.test.ts` with hand-written arbitraries per schema, valid round trip and one-field mutation producing `ContractError` with the path
    - **Validates: Requirements 17.3, 17.4, 17.7**

  - [x] 3.10 Add the viewport readout and per-size verification report
    - Extend the existing `?debug=1` overlay to show viewport size, zoom, canvas size and HUD mode
    - Add a "Phase 1 viewport verification" table to `docs/kiro-log-frontend.md` with one row each for 1366x768, 1536x864, 1920x1080, 2560x1440 and 390x844: zoom (computed from `zoomForViewport`), HUD mode, bars visible, fps (leave "to be read by the user" where it cannot be measured here and say so)
    - _Requirements: 2.9, 20.2_

  - [x] 3.11 Verify and log Phase 1
    - Run typecheck, lint, the full tests, `npm run test:contract` and the build; fix failures; confirm `importBoundary.test.ts` passes; update `docs/kiro-log-frontend.md`
    - _Requirements: 20.1, 20.7, 1.8_

- [x] 4. STOP: Phase 1 checkpoint, shell and layout review
  - Summarize the changes. Tell the user to run `npm run dev` in `frontend/`, open `/play?debug=1` and check each of the five sizes (browser devtools device toolbar), the F key and button, resize, and the compact HUD below 640 px. Wait for approval, then commit Phase 1 separately.
  - _Requirements: 20.6, 20.8_

- [x] 5. Phase 2: Character-led encounter
  - [x] 5.1 Add pure encounter helpers and the lines data
    - Create `src/encounter/entrySide.ts`, `src/encounter/keys.ts` (`keyToOption`), `src/encounter/lines.json` (3 to 5 taunts and 3 to 5 reactions per kind: paper_wraith/ghost, vampire, skeleton, gear_golem, toxic_slime/witch, memory_eater, exam_warden; funny, non-gory) and `src/encounter/lines.ts` (`linesFor`, `pickLine`, skeleton fallback)
    - Create `src/art/portraits/types.ts` with the kind, pose and `portraitFor` mapping that falls back to Skeleton
    - _Requirements: 4.2, 4.5, 5.3, 5.4, 5.5, 5.6_

  - [x]* 5.2 Write property tests for encounter helpers
    - **Property 5: Entry side alternates**
    - **Property 6: Number keys map to options**
    - **Property 7: Characters and lines have fallbacks and bounded counts**
    - Create `src/encounter/encounter.property.test.ts`
    - **Validates: Requirements 4.2, 4.5, 5.3, 5.4, 5.5, 5.6**

  - [x] 5.3 Implement the Typewriter
    - Create `src/encounter/typewriter.ts` (`visibleChars`, 45 chars per second per D6), `src/encounter/useTypewriter.ts` and `src/encounter/Typewriter.tsx` that exposes the full text to assistive technology from the first frame (visually hidden full copy, aria-hidden animated copy), completes on Space, Enter or click, and shows full text under Reduced_Motion
    - _Requirements: 5.7, 5.8, 5.9_

  - [x]* 5.4 Write property test for the Typewriter
    - **Property 8: Typewriter visibility**
    - Create `src/encounter/typewriter.property.test.ts`
    - **Validates: Requirements 5.7, 5.8**

  - [x] 5.5 Draw the Ghost and Skeleton portraits
    - Create `src/art/portraits/draw.ts` (shared Canvas2D helpers), `ghost.ts` and `skeleton.ts`, each drawing idle, talking, hurt, taunt and defeated poses at portrait scale (about 360x480 logical) in original shapes using palette tokens
    - _Requirements: 5.1, 5.2, 19.5, 19.6_

  - [x] 5.6 Draw the Vampire and Witch portraits
    - Create `src/art/portraits/vampire.ts` and `witch.ts` with all five poses; original designs, no copied names or style from the reference game
    - _Requirements: 5.1, 5.2, 19.5, 19.6_

  - [x] 5.7 Draw the Clockwork Golem and Exam Warden portraits and the PortraitCanvas
    - Create `src/art/portraits/golem.ts`, `warden.ts`, `index.ts` (registry) and `src/art/portraits/PortraitCanvas.tsx` (one cached bitmap per kind and pose, CSS bob and shake, static under Reduced_Motion)
    - Add `src/art/portraits/portraits.test.ts` covering 6 kinds x 5 poses in a canvas stub and the unknown-kind fallback
    - Record the portraits in `ASSETS_LICENSES.md` as code-drawn originals
    - _Requirements: 5.1, 5.2, 5.3, 19.5, 19.6_

  - [x] 5.8 Build the Speech_Panel and Answer_Grid
    - Create `src/encounter/SpeechPanel.tsx` (parchment panel, glowing edge, candle accent drawn in CSS/SVG), `src/encounter/AnswerGrid.tsx` (2x2 large buttons, number badges, hover glow, true/false uses two wide buttons) and styles in `src/styles/encounter.css`
    - Meet 4.5:1 text contrast on parchment and visible focus
    - _Requirements: 4.3, 4.4, 19.4, 19.7_

  - [x] 5.9 Build the EncounterPopup and replace the Question_Panel
    - Create `src/encounter/EncounterPopup.tsx`: scrim dim, portrait slide in from `entrySide`, taunt line then question, keys 1 to 4 and Enter, Retreat button, focus trap and restore, result view with hurt or taunt pose, `damage_dealt` shown from the response, Source_Line and optional explanation, reaction line, slide out within 300 ms, no slide under Reduced_Motion, results announced in the aria-live region
    - Add `encounter-open` and `encounter-close` ToGameEvents (additive); wire `PlayPage.tsx` and `usePlaySession.ts` to mount the popup in place of `QuestionPanel`; leave `combatMachine` unchanged and `set-view-inset` at 0
    - Mark `QuestionPanel.tsx` unused only after its tests are migrated (task 5.11)
    - _Requirements: 4.1, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 19.8_

  - [x] 5.10 Add the Phaser result feedback
    - Create `src/game/systems/EncounterFxSystem.ts` (dim ack, pooled ghost-wisp burst, pooled curse flash purple-red, strike on the monster using the default Rusty Dagger slash until Phase 3), handle `encounter-open`/`encounter-close`, emit `result-animation-done` exactly once per result via a once-latch, and show a static hit marker instead of bursts under Reduced_Motion
    - Keep particle totals within the existing `MAX_PARTICLES` budget
    - _Requirements: 6.1, 6.2, 6.5, 6.6, 19.1, 19.2, 19.3_

  - [x] 5.11 Migrate and add tests
    - Move useful assertions from `QuestionPanel` tests to `EncounterPopup` tests (keys, focus trap, retreat, Reduced_Motion, Source_Line, explanation optional, damage text equals response); update `PlayFlow.smoke.test.tsx`; add the once-latch test
    - _Requirements: 4.5, 4.6, 4.7, 4.9, 4.10, 6.3, 6.4, 6.5, 20.1_

  - [x] 5.12 Verify and log Phase 2
    - Run typecheck, lint, tests, contract tests and build; record fps and particle counts for the encounter-open and result states from `?debug=1` (note any value the user must read); update kiro log and `ASSETS_LICENSES.md`
    - _Requirements: 20.1, 20.2, 20.7, 19.1_

- [x] 6. STOP: Phase 2 checkpoint, encounter review
  - Summarize the changes. Tell the user to play `/play` against the mock, press E at a monster, test keys 1 to 4, Enter, Retreat, typewriter skip, correct and wrong results, the alternating side in the next room, and Reduced_Motion. Wait for approval, then commit Phase 2 separately.
  - _Requirements: 20.6, 20.8_

- [x] 7. Phase 3: Weapons, criticals and boss phases (presentation only)
  - [x] 7.1 Add weapon and critical data through the contract
    - Create `src/weapons/weapons.ts` (`WEAPONS`, `resolveWeapon`); extend `AnswerResult` with PROPOSED `weapon_id` and `is_critical`, schemas, fixtures and the contract suite; teach the Mock_Adapter to unlock by level (D7) and set `is_critical` on streak multiples of 3 (D8) without changing damage; add the dev-only query `?mockLevel=N` that sets the mock player level
    - _Requirements: 7.2, 7.3, 7.5, 17.8, 17.9_

  - [x]* 7.2 Write property test for weapons
    - **Property 9: Weapon resolution**
    - Create `src/weapons/weapons.property.test.ts`
    - **Validates: Requirements 7.2, 7.3, 7.5**

  - [x] 7.3 Implement the five weapon strike effects
    - Create `src/game/fx/weapons.ts` (pure descriptors) and `src/game/systems/WeaponFxSystem.ts` (pool of 16, slash, bolt, arrow, shockwave, fire burst, static marker under Reduced_Motion); `apply-result` passes the result so the scene reads `weapon_id`
    - _Requirements: 7.1, 7.2, 7.3, 7.6, 19.2, 19.3_

  - [x] 7.4 Add the critical hit presentation
    - In `EncounterPopup` show a 1.5x damage number when `is_critical`; in the scene add a pooled white flash at alpha 0.35 or a static marker under Reduced_Motion
    - _Requirements: 7.4, 7.6_

  - [x] 7.5 Implement boss phase and lightning logic
    - Create `src/game/bossPhase.ts` (`bossPhase`) and `src/game/lightning.ts` (`nextLightningAt`, spacing 8000 ms, peak alpha 0.25, never under Reduced_Motion)
    - _Requirements: 8.1, 8.5, 8.6_

  - [x]* 7.6 Write property tests for boss phase and lightning
    - **Property 3: Boss phase depends only on HP thresholds**
    - **Property 4: Lightning schedule respects spacing and reduced motion**
    - Create `src/game/bossPhase.property.test.ts`
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.5, 8.6**

  - [x] 7.7 Implement the enraged boss presentation
    - Create `src/game/systems/BossPhaseSystem.ts`: on phase change to enraged apply a tint shift, a new attack animation, extra fog and pooled lightning within budget (none under Reduced_Motion, tint only); add the `boss-phase-changed` FromGameEvent (additive); in `src/audio/ambient.ts` add an enraged variant switched by the hook on that event
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.6, 19.1, 19.3_

  - [x] 7.8 Build the Armory
    - Create `src/weapons/Armory.tsx` listing unlocked and locked weapons with unlock level from `progress.weapons`; mount it in `PauseMenu.tsx` now (the Dashboard mounts it in Phase 5); mock progress returns the weapon list
    - _Requirements: 7.5_

  - [x] 7.9 Verify and log Phase 3
    - Run typecheck, lint, tests, contract tests and build; record fps and particle counts for each weapon strike and the enraged boss; update kiro log and `ASSETS_LICENSES.md`
    - _Requirements: 20.1, 20.2, 20.7, 1.8_

- [x] 8. STOP: Phase 3 checkpoint, weapons and boss review
  - Summarize the changes. Tell the user how to see each weapon (mock unlocks by level; use the dev query `?mockLevel=8` added in 7.1), a critical hit on a 3-streak, the enraged boss below 60 of 120 HP, and the pause-menu Armory. Wait for approval, then commit Phase 3 separately.
  - _Requirements: 20.6, 20.8_

- [x] 9. Phase 4: Haunted memories (revenants)
  - [x] 9.1 Add due reviews through the contract
    - Add `DueReview`, `ApiClient.getDueReviews`, schema, fixture, contract case and `progress.due_review_count` (PROPOSED); create `src/api/mock/mockReviews.ts` (wrong-answer set, plus seeded set when `VITE_MOCK_SEED_REVENANTS` is "true")
    - _Requirements: 9.9, 17.8, 17.9_

  - [x]* 9.2 Write property test for mock due reviews
    - **Property 11: Mock due reviews follow wrong answers**
    - Create `src/api/mock/mockReviews.property.test.ts`
    - **Validates: Requirements 9.9**

  - [x] 9.3 Implement the RevenantSystem
    - Add `spawn-revenants` (ToGame) and `revenant-engaged`, `revenant-rested` (FromGame) events in `events.ts` with the `RevenantSpawn` type defined there; create `src/game/systems/RevenantSystem.ts` (pool of 3, glowing translucent look distinct from monsters, spawn only after the room monster HP is 0, "memory laid to rest" pooled effect, static marker under Reduced_Motion)
    - _Requirements: 9.2, 9.5, 9.7, 9.8, 19.2, 19.3_

  - [x] 9.4 Wire revenants into the play session
    - In `usePlaySession.ts` fetch due reviews per room, send `spawn-revenants` (max 3), start the same encounter on `revenant-engaged` with the intro line "The ghost of a question you forgot..." before the question, decrement the displayed counter on a correct result, and refetch progress afterward; leave the gate-open flow unchanged
    - _Requirements: 9.1, 9.3, 9.5, 9.6, 9.8_

  - [x] 9.5 Add the Haunted memories counter
    - Create `src/components/HauntedCounter.tsx` and show it in the Floating_HUD; export it for the Dashboard
    - _Requirements: 9.4, 9.6_

  - [x]* 9.6 Write property test for revenant counting
    - **Property 10: Revenant spawn count and counter**
    - Create `src/encounter/revenants.property.test.ts` against pure `spawnCount` and `remainingDue` helpers in `src/encounter/revenants.ts`
    - **Validates: Requirements 9.1, 9.4, 9.5, 9.6**

  - [x] 9.7 Verify and log Phase 4
    - Run typecheck, lint, tests, contract tests and build; record fps and particle counts with 3 revenants present; update kiro log
    - _Requirements: 20.1, 20.2, 20.7, 1.8_

- [ ] 10. STOP: Phase 4 checkpoint, revenants review
  - Summarize the changes. Tell the user to answer a question wrong, clear the room monster and see the revenant, and to start the app with `VITE_MOCK_SEED_REVENANTS=true` to see three at once. Check the counter, the intro line and the rest effect. Wait for approval, then commit Phase 4 separately.
  - _Requirements: 20.6, 20.8_

- [ ] 11. Phase 5: Scorecard, leaderboard and dashboard
  - [ ] 11.1 Add leaderboard, run summary and progress additions through the contract
    - Add `LeaderboardEntry`, `LeaderboardResponse`, `ApiClient.getLeaderboard`, schemas, fixtures, contract cases; add PROPOSED `RunSummary` fields (`badges_earned`, `leaderboard_rank`, `weapon_unlocked`, `level_up`, `topic_mastery`, `weak_concepts`) and PROPOSED progress fields (`badges`, `recent_runs`)
    - Create `src/api/mock/mockLeaderboard.ts` with 8 seeded Ghost_Rivals and ranking of the player's finished runs
    - Create the badge catalog `src/badges/badges.ts` and `src/badges/BadgeGrid.tsx` (ids, labels, icons from lucide-react)
    - _Requirements: 11.9, 17.8, 17.9, 15.1_

  - [ ] 11.2 Implement ranking, provisional rank and board view
    - Create `src/leaderboard/ranking.ts` (comparator, `rankEntries`), `src/leaderboard/provisional.ts` (`insertProvisional`), `src/leaderboard/view.ts` (`buildBoardView` with pinned me row and rival labels)
    - _Requirements: 11.5, 11.6, 11.7, 11.9_

  - [ ]* 11.3 Write property tests for the leaderboard
    - **Property 14: Ranking is a total, permutation-invariant order**
    - **Property 15: Provisional rank insertion**
    - **Property 16: Board view pins me and labels rivals**
    - Create `src/leaderboard/leaderboard.property.test.ts`
    - **Validates: Requirements 11.5, 11.6, 11.7, 11.9**

  - [ ] 11.4 Implement polling
    - Create `src/leaderboard/useLeaderboard.ts` (fetch on mount, every 30 s only while mounted and visible, clears on unmount, keeps old rows on a failed poll, exposes loading, empty and error states); add a fake-timer test; no websockets
    - _Requirements: 11.10, 11.11, 11.12_

  - [ ] 11.5 Build the Leaderboard screen
    - Create `src/leaderboard/LeaderboardPage.tsx`, `Podium.tsx`, `Row.tsx`, `Avatar.tsx` (themed avatar by kind), tabs All-time and This week, top-3 podium, rows with rank, avatar, name, level, score, accuracy, best streak and badge icons, pinned highlighted me row, guest call to action "Create an account to claim your spot", "Ghost Rival - demo" labels, skeleton, empty and error states; add the `/leaderboard` route readable by guests; personal dungeons show only the player's own best runs
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.6, 11.8, 11.9, 11.11_

  - [ ] 11.6 Implement mastery and count-up logic
    - Create `src/scorecard/mastery.ts` (`classifyMastery`) and `src/scorecard/useCountUp.ts` with pure `countUpValue`
    - _Requirements: 10.1, 10.3, 10.9_

  - [ ]* 11.7 Write property tests for mastery and count-up
    - **Property 12: Mastery bands**
    - **Property 13: Count-up is monotone and ends at the target**
    - Create `src/scorecard/scorecard.property.test.ts`
    - **Validates: Requirements 10.1, 10.3, 10.9**

  - [ ] 11.8 Build the Scorecard
    - Create `src/scorecard/Scorecard.tsx` replacing `VictoryOverlay`: score count-up, accuracy ring, XP bar with level-up effect, weapon unlocked, badges earned, topic mastery bars with Weak, Learning and Strong labels (text plus color), weak concepts with Source_Line, animated rank reveal, buttons Play again, View leaderboard, Share card (opens the Phase 7 dialog; disabled with a tooltip until then) and Create account for guests; finishRun failure shows an error with Retry; results and rank announced in the aria-live region
    - Update `usePlaySession.ts`, `PlayPage.tsx` and tests
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 19.8_

  - [ ] 11.9 Build the Dashboard
    - Create `src/pages/DashboardPage.tsx` and `src/dashboard/*`: level and XP bar, Continue Dungeon, Play Demo (starts the demo session), top-5 preview with "you" highlighted, recent runs, `HauntedCounter`, `BadgeGrid`, `Armory`, links to upload and settings; skeletons while pending, error card with Retry; guest variant with demo card, provisional stats and call to action; add the `/dashboard` route and make `LandingPage` link to it
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 7.5, 9.4_

  - [ ] 11.10 Verify and log Phase 5
    - Run typecheck, lint, tests, contract tests and build; record fps for the Scorecard animations; update kiro log
    - _Requirements: 20.1, 20.2, 20.7, 1.8_

- [ ] 12. STOP: Phase 5 checkpoint, scorecard, leaderboard and dashboard review
  - Summarize the changes. Tell the user to finish a run to see the Scorecard, open `/leaderboard` as guest and as a player, switch tabs, wait 30 s to see a refresh in the network panel, and open `/dashboard`. Wait for approval, then commit Phase 5 separately.
  - _Requirements: 20.6, 20.8_

- [ ] 13. Phase 6: Auth and offline demo fallback
  - [ ] 13.1 Add auth through the contract
    - Add `Credentials`, `ApiClient.register`, `login`, `logout`, `getMe`, schemas, fixtures, contract cases and `src/api/mock/mockAuth.ts` (in-memory table, 401/409/422/429 simulation); cookie session only, no token storage
    - _Requirements: 13.5, 17.8, 17.9_

  - [ ] 13.2 Implement auth validation and error mapping
    - Create `src/auth/validation.ts` (username 3 to 20 letters/digits/underscore, register password 10 to 72 with a letter and a digit, login password non-empty), `src/auth/errors.ts` (`mapAuthError` for 401, 409, 422, 429, 5xx) and `src/auth/retryAfter.ts` (`parseRetryAfter`, default 10)
    - _Requirements: 13.3, 13.4, 13.7_

  - [ ]* 13.3 Write property test for auth helpers
    - **Property 17: Auth validation and messages**
    - Create `src/auth/auth.property.test.ts`
    - **Validates: Requirements 13.1, 13.3, 13.4, 13.7**

  - [ ] 13.4 Build the Login and Register screens
    - Create `src/auth/LoginPage.tsx` and `RegisterPage.tsx` replacing `LoginPlaceholder.tsx`: exactly two fields, show/hide password, themed layout, field-level messages, friendly status errors, submit disabled for Retry-After, navigate to the Dashboard on success; extend `SessionContext` with `getMe` on load
    - Add tests including empty `localStorage` and `sessionStorage` after login
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

  - [ ] 13.5 Build the Waking up loader
    - Create `src/pages/WakingUp.tsx` with rotating tips and `src/state/useDemoStart.ts` (8 s timer offers the Offline demo while the request continues; late success ignored after Offline is chosen); add `setApiOverride` to `src/api/index.ts`; use it from the Landing page demo start; add the dev-only `VITE_MOCK_DELAY_MS` option passed to the mock adapter's `delayMs` for `startDemoSession`; keep the guest banner text "Playing as guest. Progress is temporary. Create an account to save." in `GuestBanner.tsx`
    - _Requirements: 14.1, 14.2, 14.3, 14.8_

  - [ ] 13.6 Build the Offline_Module
    - Create `src/offline/index.ts` (exports `createOfflineAdapter`), `adapter.ts`, `rules.ts` (wraps `src/demo/rules.ts` profiles and `applyAnswer`; injected clock and ids, no `Math.random`), `rivals.ts` (8 bundled Ghost_Rivals), `demoDungeon.json` (copy of the placeholder; note in B-to-A.md that `demo_dungeon.sample.json` will replace it when supplied); shell label "Offline demo - progress is not saved"; loaded only via dynamic `import('@/offline')` in the explicit choice handler
    - _Requirements: 14.3, 14.4, 14.5, 14.6, 14.7, 1.2_

  - [ ]* 13.7 Write property tests for the Offline_Module
    - **Property 18: Offline rules conform to the game rules**
    - **Property 19: Offline determinism**
    - Create `src/offline/offline.property.test.ts` with a reference model of the working rules
    - **Validates: Requirements 14.5, 1.2**

  - [ ] 13.8 Add boundary tests
    - Create `src/test/boundary.test.ts` that fails when any file outside `src/offline/**` and tests statically imports `src/offline`, and extend `src/game/importBoundary.test.ts` to also forbid `offline` and `leaderboard` imports from `src/game`; add the Offline label and banner render tests
    - _Requirements: 14.7, 20.4, 20.5, 1.4_

  - [ ] 13.9 Verify and log Phase 6
    - Run typecheck, lint, tests, contract tests and build; confirm the production build keeps `src/offline` in a separate chunk; update kiro log
    - _Requirements: 20.1, 20.7, 14.7, 1.8_

- [ ] 14. STOP: Phase 6 checkpoint, auth and offline review
  - Summarize the changes. Tell the user to register and log in on the mock (try a short password, a taken username, and the mock 429 trigger), then simulate a slow server (set `VITE_MOCK_DELAY_MS=12000` as added in 13.5) to see the loader and the Offline demo choice. Wait for approval, then commit Phase 6 separately.
  - _Requirements: 20.6, 20.8_

- [ ] 15. Phase 7: Badges, lore and share card
  - [ ] 15.1 Implement badge rules and wire them into mock and offline
    - Create `src/badges/rules.ts` (`evaluateBadges`, D19 flag for speed_reader); use it in the Mock_Adapter and the Offline_Module summaries (`badges_earned`, memory_keeper after 3 revenants); the Http_Client path displays only the backend list
    - _Requirements: 15.1, 15.2, 15.3_

  - [ ]* 15.2 Write property test for badge rules
    - **Property 20: Badge rules**
    - Create `src/badges/rules.property.test.ts`
    - **Validates: Requirements 15.1, 15.2, 15.3**

  - [ ] 15.3 Add the intro story and taunt lines
    - Create `src/lore/intro.ts` and `src/lore/IntroStory.tsx` (skippable, shown once per browser using `sd.introSeen`, text only, Reduced_Motion respected); mount it before the first run; encounter taunts already come from `lines.json`
    - _Requirements: 15.4_

  - [ ] 15.4 Build the share card
    - Create `src/share/renderShareCard.ts` (1200x630 canvas with score, rank, badges, dungeon name; awaits `document.fonts.load` for the @fontsource families), `src/share/postText.ts` (`buildPostText` starting with `#KiroweenHackathon26`), `src/share/ShareDialog.tsx` (Download PNG, Copy post text, selectable fallback textarea on clipboard rejection, error on null blob); enable the Scorecard Share card button
    - _Requirements: 15.5, 15.6, 15.7, 15.8, 15.9_

  - [ ]* 15.5 Write property test for the post text
    - **Property 21: Share post text**
    - Create `src/share/postText.property.test.ts`
    - **Validates: Requirements 15.7**

  - [ ] 15.6 Add share and lore tests
    - Add tests for the clipboard rejection fallback, a source scan that fails on remote URLs, `fetch(` or remote images in `src/share/**`, and the intro shown once
    - _Requirements: 15.4, 15.8, 15.9_

  - [ ] 15.7 Verify and log Phase 7
    - Run typecheck, lint, tests, contract tests and build; update kiro log and `ASSETS_LICENSES.md`
    - _Requirements: 20.1, 20.7, 1.8_

- [ ] 16. STOP: Phase 7 checkpoint, badges, lore and share review
  - Summarize the changes. Tell the user to clear localStorage key `sd.introSeen` to replay the intro, finish a run, earn badges, open Share card, download the PNG and paste the copied text. Wait for approval, then commit Phase 7 separately.
  - _Requirements: 20.6, 20.8_

- [ ] 17. Phase 8 (optional): Upload wizard
  - [ ]* 17.1 Add the upload contract and mock
    - Add PROPOSED `uploadNotes` to the ApiClient, schemas, fixtures and mock steps (reading, extracting, relevance check, topic detection); accepted formats text read from one constant marked pending until `api-contract.md` is published
    - _Requirements: 16.2, 17.8, 17.9_

  - [ ]* 17.2 Build the upload wizard
    - Create `src/upload/UploadWizard.tsx`: drag and drop plus file picker, accepted formats text, progress steps, relevance result with the rejection reason, detected topics; route from the Dashboard link
    - _Requirements: 16.1, 16.2, 16.3_

  - [ ]* 17.3 Hide the wizard for guests and test it
    - Show "Create an account to upload your own notes" for guests; add component tests for drag and drop, rejection reason and guest state
    - _Requirements: 16.4, 16.1, 16.3_

  - [ ]* 17.4 Verify and log Phase 8
    - Run typecheck, lint, tests, contract tests and build; update kiro log
    - _Requirements: 20.1, 20.7, 1.8_

- [ ] 18. STOP: Phase 8 checkpoint, final review
  - Summarize the changes and the whole feature. Give the user the final checks: all commands green, `npm run test:contract` on the mock, and the steps to switch to the real API (`VITE_USE_MOCKS=false`, `VITE_API_BASE_URL=<url>`, rerun `npm run test:contract` and fix what it reveals). Wait for approval, then commit Phase 8 separately and ask about merging.
  - _Requirements: 17.6, 17.10, 20.6, 20.8_

## Notes

- Tasks marked with `*` are optional. Phase 8 is wholly optional.
- Task counts (sub-tasks, plus one STOP checkpoint per phase): Phase 0 has 5 sub-tasks, Phase 1 has 11, Phase 2 has 12, Phase 3 has 9, Phase 4 has 7, Phase 5 has 10, Phase 6 has 9, Phase 7 has 7, Phase 8 has 4 (all optional). Total 74 sub-tasks and 9 STOP tasks.
- Each task references specific requirements for traceability.
- Property tests validate the 22 correctness properties in design.md; boundary, contract and example tests are required.
- Dev-only switches added during implementation (`?mockLevel=`, `VITE_MOCK_DELAY_MS`, `VITE_MOCK_SEED_REVENANTS`) must be documented in `.env.example` and the kiro log.


## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["1.4"] },
    { "id": 4, "tasks": ["1.5"] },
    { "id": 5, "tasks": ["3.1"] },
    { "id": 6, "tasks": ["3.2"] },
    { "id": 7, "tasks": ["3.3"] },
    { "id": 8, "tasks": ["3.4"] },
    { "id": 9, "tasks": ["3.5"] },
    { "id": 10, "tasks": ["3.6"] },
    { "id": 11, "tasks": ["3.7"] },
    { "id": 12, "tasks": ["3.8"] },
    { "id": 13, "tasks": ["3.9"] },
    { "id": 14, "tasks": ["3.10"] },
    { "id": 15, "tasks": ["3.11"] },
    { "id": 16, "tasks": ["5.1"] },
    { "id": 17, "tasks": ["5.2"] },
    { "id": 18, "tasks": ["5.3"] },
    { "id": 19, "tasks": ["5.4"] },
    { "id": 20, "tasks": ["5.5"] },
    { "id": 21, "tasks": ["5.6"] },
    { "id": 22, "tasks": ["5.7"] },
    { "id": 23, "tasks": ["5.8"] },
    { "id": 24, "tasks": ["5.9"] },
    { "id": 25, "tasks": ["5.10"] },
    { "id": 26, "tasks": ["5.11"] },
    { "id": 27, "tasks": ["5.12"] },
    { "id": 28, "tasks": ["7.1"] },
    { "id": 29, "tasks": ["7.2"] },
    { "id": 30, "tasks": ["7.3"] },
    { "id": 31, "tasks": ["7.4"] },
    { "id": 32, "tasks": ["7.5"] },
    { "id": 33, "tasks": ["7.6"] },
    { "id": 34, "tasks": ["7.7"] },
    { "id": 35, "tasks": ["7.8"] },
    { "id": 36, "tasks": ["7.9"] },
    { "id": 37, "tasks": ["9.1"] },
    { "id": 38, "tasks": ["9.2"] },
    { "id": 39, "tasks": ["9.3"] },
    { "id": 40, "tasks": ["9.4"] },
    { "id": 41, "tasks": ["9.5"] },
    { "id": 42, "tasks": ["9.6"] },
    { "id": 43, "tasks": ["9.7"] },
    { "id": 44, "tasks": ["11.1"] },
    { "id": 45, "tasks": ["11.2"] },
    { "id": 46, "tasks": ["11.3"] },
    { "id": 47, "tasks": ["11.4"] },
    { "id": 48, "tasks": ["11.5"] },
    { "id": 49, "tasks": ["11.6"] },
    { "id": 50, "tasks": ["11.7"] },
    { "id": 51, "tasks": ["11.8"] },
    { "id": 52, "tasks": ["11.9"] },
    { "id": 53, "tasks": ["11.10"] },
    { "id": 54, "tasks": ["13.1"] },
    { "id": 55, "tasks": ["13.2"] },
    { "id": 56, "tasks": ["13.3"] },
    { "id": 57, "tasks": ["13.4"] },
    { "id": 58, "tasks": ["13.5"] },
    { "id": 59, "tasks": ["13.6"] },
    { "id": 60, "tasks": ["13.7"] },
    { "id": 61, "tasks": ["13.8"] },
    { "id": 62, "tasks": ["13.9"] },
    { "id": 63, "tasks": ["15.1"] },
    { "id": 64, "tasks": ["15.2"] },
    { "id": 65, "tasks": ["15.3"] },
    { "id": 66, "tasks": ["15.4"] },
    { "id": 67, "tasks": ["15.5"] },
    { "id": 68, "tasks": ["15.6"] },
    { "id": 69, "tasks": ["15.7"] },
    { "id": 70, "tasks": ["17.1"] },
    { "id": 71, "tasks": ["17.2"] },
    { "id": 72, "tasks": ["17.3"] },
    { "id": 73, "tasks": ["17.4"] }
  ]
}
```n
