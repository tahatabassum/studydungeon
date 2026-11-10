# Implementation Plan: frontend-08-campaign-learning-loop

## Overview

A campaign of Floors that grows with the notes, a Daily Haunt review loop and visible progress, delivered on branch `feature/frontend-campaign` in Phase 0 (documents) and Phases 1 to 6. Each phase is sized for one sub-agent, phases run sequentially, and each phase ends with a STOP checkpoint. The decisions D1 to D26 in design.md use their recommended defaults unless the user changes them at the Phase 0 STOP.

### Build order (approved by the user; see design.md "Build order")

1. frontend-08 Phase 0 (this: reconcile and plan)
2. frontend-08 P1: floors data model and reconciliation fixes
3. frontend-08 P2: floor map and campaign flow
4. frontend-07 P5: scorecard, leaderboard, dashboard, built on floors and mastery
5. frontend-07 P6: auth, the "Waking up the dungeon..." loader, offline demo with floors
6. frontend-08 P3: Daily Haunt and modes
7. frontend-08 P4: learning loop
8. frontend-08 P5: game feel and ranks
9. frontend-07 P7: badges, lore, share card (merge the intro story with the frontend-08 tutorial into one first-run flow)
10. frontend-08 P6: tutorial, polish, a11y and responsive, README, log, licences
11. Optional: frontend-07 P8 upload wizard, reusing the floor-generation status UI
12. Optional: equip a weapon from the Armory (needs the PROPOSED equipped-weapon field)

Items 4, 5, 9 and 11 are tasks in `.kiro/specs/frontend-07-premium-ux-leaderboard/tasks.md`. This plan references them and never duplicates their work. After frontend-08 P2 stops, run frontend-07 P5 and P6 before starting frontend-08 P3.

Rules for every task:

- Edit only `frontend/**`, `.kiro/specs/frontend-*`, `.kiro/hooks/frontend-*`, `docs/handoff/B-to-A.md` and `docs/kiro-log-frontend.md`. Never touch `backend/`.
- The Backend is authoritative for correctness, damage, HP, XP, score, streaks, ranks, mastery, review scheduling, question selection and badges. The UI only displays. Local computation is allowed only in the Mock_Adapter (`src/api/mock`), the labeled Offline_Demo module and the pure helpers they call.
- Phaser code under `src/game` imports nothing from `src/api`, `src/demo`, `src/state`, `src/offline`, `src/campaign`, `src/learning`, `src/haunt`, `src/rewards` or `src/tutorial`. Keep `importBoundary.test.ts` passing and extend it.
- New Event_Bridge events are additive. Existing events and payloads stay unchanged.
- Do not invent live endpoints. New needs are PROPOSED in `docs/handoff/B-to-A.md` (section "frontend-08 campaign additions"), built against the mock and marked pending.
- Zod-validate all real responses. Keep `npm run test:contract` passing against the mock.
- 60 fps on an 8 GB integrated-GPU laptop: pools, no per-frame allocation. Reduced motion and mute are respected. WCAG AA.
- Art is code-drawn or licensed and recorded in `frontend/ASSETS_LICENSES.md`.
- Copy is honest: measured numbers only, never a claim that memorization is guaranteed.
- Keep all 576 existing tests passing.
- Paths are relative to `frontend/` unless they start with `docs/` or `.kiro/`.
- Every phase's last sub-task runs `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:contract` and `npm run build` in `frontend/`, records the real output, and updates `docs/kiro-log-frontend.md` (and `ASSETS_LICENSES.md` when art changed).
- Each phase ends with a STOP task. Summarize the changes, say how to view and what to check, wait for approval, then commit that phase separately.
- Sub-tasks marked `*` are optional (property-based tests and optional features). Required example, boundary and contract tests carry no marker.
- Property tests use fast-check with at least 100 runs and the tag `Feature: frontend-08-campaign-learning-loop, Property N: <title>`.

## Tasks

- [x] 1. Phase 0: Reconcile and plan (documents only)
  - [x] 1.1 Write requirements.md, design.md and tasks.md for this spec
    - Contract reconciliation table (C1 to C31), current modeling summary, decisions D1 to D26, risks, cut list, build order
    - _Requirements: 1.1, 15.4, 16.5_
  - [x] 1.2 Append "frontend-08 campaign additions" to the PROPOSED CONTRACT section of `docs/handoff/B-to-A.md`
    - Floors, question pool, run request, attempt and finish additions, due reviews (supersedes the bare array), progress additions, generation status, scoring decisions, equipped weapon
    - _Requirements: 15.4_
  - [x] 1.3 Add dependency notes to the frontend-07 tasks.md Phase 5, 6, 7 and 8 sections
    - Notes only; no checkbox state or task text changed
    - _Requirements: 16.5_

- [x] 2. STOP: Phase 0 checkpoint, plan review
  - Summarize the reconciliation highlights, decisions D1 to D26, risks and cut list. Say how to view the three documents and the B-to-A.md section. Wait for approval, then commit Phase 0 separately.

- [x] 3. Phase 1: Floors data model and adapters
  - Split by user: Phase 1A = 3.1, 3.2, 3.3 and the wire/contract part of 3.18, then STOP for review; Phase 1B = 3.4 to 3.17 and the rest of 3.18.
  - [x] 3.1 Apply the contract-reconciliation fixes so the Frontend matches the real contract
    - Create `src/api/wire/` with wire zod schemas and pure mappers for dungeon (C2 to C6), run start (C8), attempt result (C10, C11), room clear (C17), finish (C15), progress (C14), due reviews (C20) and the auth bodies (C22), plus `kindFromMonsterType` (C5)
    - Switch `src/api/client.ts` (Http_Client) to validate with the wire schemas and return mapped domain values; keep `ContractError` naming the endpoint and field
    - Update `src/api/errors.ts` to expose `detail.code` and `detail.message`, handle the 422 array form (C24), and map the codes in C16, C18 and C28 to friendly messages
    - Make `source`, `review_status` and `xp_to_next` optional in the domain types and schemas and adapt the HUD and Source line to the missing values (C10, C14)
    - Read `VITE_API_BASE ?? VITE_API_BASE_URL` in `src/api/index.ts` and `src/config/flags.ts`; add `frontend/vercel.json` with the Day 3 rewrite (C26) and update `.env.example`
    - Add `ApiClient.getRun(runId)` (C21) over `GET /runs/{id}`
    - Add the legacy single-Floor mapping hook point (completed in 3.4)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_
  - [x] 3.2 Align the Mock_Adapter and demo data with the real balance values
    - Demo monster HP to 80, 90, 85, 85 and the Exam Warden to 220 (C7); critical x1.5 and hard-question x1.25 damage in the mock (C12); weapon table with base damage 20, 25, 30, 35, 40 and unlock rules (C13); `unlocked_weapons` names mapped to ids
    - Keep every existing mock test passing; update expected numbers only where the contract changed them and note each change in the kiro log
    - _Requirements: 1.9, 3.1_
  - [x]* 3.3 Write property test for wire mapping
    - **Property 1: Wire mapping produces valid domain values and fails loudly**
    - **Validates: Requirements 1.2, 1.3, 1.4**
  - [x] 3.4 Add the floors Domain_Model, schemas and ApiClient surface
    - Add `Floor`, `FloorStatus`, `FinalBoss`, `TopicInfo`, `RunMode`, `FloorRank`, `StartRunRequest`, `DueReviewsResponse`, `GenerationStatus` and the optional attempt, finish and progress additions listed in design.md
    - Add zod schemas (optional where PROPOSED), `startRun(req)`, `getDueReviews()` new shape (keep the old bare-array method as a thin adapter), `getGenerationStatus`, `retryFloor`
    - Implement the legacy mapping: no `floors` means one Floor "The Crypt" with all rooms (D17)
    - Add capability detection to the Http_Client (D26)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - [x]* 3.5 Write property test for the legacy floor mapping
    - **Property 2: Legacy dungeons become one honest floor**
    - **Validates: Requirements 2.6**
  - [x] 3.6 Build the mock question pool, seeded draw and requeue as pure modules
    - Create `src/api/mock/seededRng.ts` (FNV-1a hash and mulberry32), `pool.ts` (pools of 15 to 20, synthetic "Sample question" for dev fixtures), `draw.ts` (`drawQuestions`, size `6 + hash mod 3` limited to the pool) and `requeue.ts` (gap 3, at most 2 returns)
    - Return `requeue_after`, `is_retry` and `retry_multiplier` (0.5) from the mock attempt (D5, D21)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  - [x]* 3.7 Write property test for the seeded draw
    - **Property 4: Seeded draw is deterministic, bounded and repeat-free**
    - **Validates: Requirements 3.2, 3.3, 3.4**
  - [x]* 3.8 Write property test for requeue
    - **Property 5: Requeue never loses or duplicates a question**
    - **Validates: Requirements 3.5, 3.6**
  - [x] 3.9 Build mock mastery, ranks, floors, generation status and Daily Haunt selection
    - Create `src/learning/mastery.ts` (`masteryBand`, bounds), `src/learning/rank.ts` (`rankFor`, D7), `src/api/mock/mockMastery.ts` (EMA, D6), `mockFloors.ts` (Floors, Final_Boss unlock, `floor_id` on rooms, run per Floor), `mockGeneration.ts` (status over time, forced failure switch, `retryFloor`), `mockHaunt.ts` and `src/haunt/hauntSelection.ts`
    - Add `floor_rank`, `mastery_by_topic` and `chest_rewards` to the mock `finishRun`, `mode` and `run_seed` to the mock `startRun`
    - Map the seeded demo to 2 Floors plus the Final_Boss (D13)
    - _Requirements: 3.7, 3.8, 3.9, 3.10, 4.4, 10.2_
  - [x]* 3.10 Write property test for mastery bounds
    - **Property 6: Mastery stays in range**
    - **Validates: Requirements 3.7**
  - [x]* 3.11 Write property test for mastery bands
    - **Property 7: Mastery bands match their boundaries**
    - **Validates: Requirements 10.2**
  - [x]* 3.12 Write property test for floor rank
    - **Property 8: Floor rank is monotone in accuracy**
    - **Validates: Requirements 3.8, 11.3**
  - [x]* 3.13 Write property test for Daily Haunt selection
    - **Property 9: Daily Haunt contains only due items and handles empty**
    - **Validates: Requirements 3.9, 7.5, 7.6**
  - [x]* 3.14 Write property test for generation status
    - **Property 10: Generation status only moves forward**
    - **Validates: Requirements 3.10**
  - [x] 3.15 Add Floor fixtures with 1, 3, 10 and 25 Floors
    - Generate `src/api/mock/fixtures/floors.{1,3,10,25}.ts` with mixed statuses, unique ids, contiguous indexes and a Final_Boss; register them in the fixtures index and the fixture validation test
    - _Requirements: 2.7_
  - [x]* 3.16 Write property test for fixtures
    - **Property 3: Floor fixtures are valid at every size**
    - **Validates: Requirements 2.5, 2.7**
  - [x] 3.17 Add the development-only route `/dev/floors`
    - Lazy-registered only when `import.meta.env.DEV`; `?floors=1|3|10|25&status=mixed`; renders a JSON and status table placeholder now (the map arrives in Phase 2); a test proves the route is absent when DEV is false and that fixtures of 3 or more Floors are not reachable in production
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 3.18 Extend the contract suite and the boundary tests
    - Add `src/contract/suite.ts` cases for `getDungeon` with floors, `startRun` with mode, `getDueReviews` new shape, `getGenerationStatus`, `finishRun` additions and wire mapper tests against `docs/handoff/demo_dungeon.sample.json`
    - Extend `importBoundary.test.ts` with the new module folders; add a test that real mode loads no mock module
    - _Requirements: 1.9, 4.4, 15.1, 15.2, 15.5_
  - [x] 3.19 Run Phase 1 verification and update the log
    - Run typecheck, lint, `npm test`, `npm run test:contract` and `npm run build`; record real output and test counts in `docs/kiro-log-frontend.md`
    - _Requirements: 16.1, 16.2, 16.3_

- [x] 4. STOP: Phase 1 checkpoint, data model and reconciliation review
  - Summarize the changes, show how to run the contract tests and open `/dev/floors`, wait for approval, then commit Phase 1 separately.

- [x] 5. Phase 2: Floor map and campaign flow
  - [x] 5.1 Implement the pure floor map logic
    - Create `src/campaign/floorLayout.ts` with `layoutFloors`, `visibleRange`, `nextFocus` and `nextPlayable` (D2)
    - _Requirements: 5.8, 5.9, 5.10_
  - [x]* 5.2 Write property test for virtualization
    - **Property 11: Virtualization covers the viewport and the focused node**
    - **Validates: Requirements 5.8**
  - [x]* 5.3 Write property test for keyboard navigation
    - **Property 12: Keyboard navigation reaches every node**
    - **Validates: Requirements 5.9**
  - [x]* 5.4 Write property test for Continue
    - **Property 13: Continue picks the first playable floor**
    - **Validates: Requirements 5.10, 5.6**
  - [x] 5.5 Build the node components
    - `FloorNode` (title, `MasteryBar` ring in `src/learning/MasteryBar.tsx`, boss icon, status chip, rank), `FogOverlay` (CSS and pre-rendered noise, no per-frame work), spinner for generating, Retry for failed, `FinalBossNode`
    - Halloween styling with design tokens from `.kiro/steering/frontend-ui-standards.md`; Reduced_Motion disables drifting fog
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 10.1, 14.2_
  - [x] 5.6 Build `FloorMap`
    - Winding SVG path (chunked), windowed node rendering, roving tabindex keyboard navigation, Continue button, "Your notes became N floors" header, empty state, smooth scroll (instant under Reduced_Motion)
    - _Requirements: 5.1, 5.7, 5.8, 5.9, 5.10, 5.11, 14.1, 14.5_
  - [x] 5.7 Add generation status polling and live announcements
    - `useGenerationStatus` polls every 2.5 s, pauses on hidden tabs, stops at terminal status, times out after 10 minutes with a Retry; announces "Floor N is being summoned..." and failures in a polite live region
    - _Requirements: 3.10, 5.3, 5.4, 14.4_
  - [x] 5.8 Wire the campaign flow
    - Add `CampaignPage` at `/campaign/:dungeonId` and route the landing and demo flow to it
    - Start a Floor with `startRun({dungeon_id, floor_id, mode: 'floor'})`, load only that Floor's rooms into the existing play experience, finish the run when the Floor_Boss is cleared, show the Scorecard (frontend-07 P5 owns its final design), then refetch the Dungeon and return to the map
    - Run the Final_Boss through the same encounter experience; show the Backend message when a start is rejected
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [x] 5.9 Wire the demo and the dev route
    - Demo shows exactly 2 Floors plus the Final_Boss; `/dev/floors` renders the real `FloorMap` for 1, 3, 10 and 25 Floors with a forced-failure switch
    - Failure and empty copy: "Floor 3 could not be summoned", "Your notes are not ready yet"
    - _Requirements: 4.3, 4.4, 5.11_
  - [x] 5.10 Write example tests for the map and flow
    - Node rendering per status, fog on locked, Retry on failed, Continue states, keyboard-only open, campaign flow with the mock (start, boss closes the Floor, map updates)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.10, 6.1, 6.2, 6.3_
  - [x] 5.11 Run Phase 2 verification and update the log
    - Run typecheck, lint, `npm test`, `npm run test:contract` and `npm run build`; record real output; note the measured map fps at 25 Floors
    - _Requirements: 16.1, 16.2, 16.3_

- [x] 6. STOP: Phase 2 checkpoint, floor map and campaign review
  - Summarize, say how to view the demo map and `/dev/floors?floors=25`, wait for approval, then commit Phase 2 separately. Next in the build order: frontend-07 Phases 5 and 6.

- [x] 7. Phase 3: Daily Haunt and run modes
  - Depends on frontend-07 P5 (Dashboard) and P6 (offline demo with floors) having been completed.
  - [x] 7.1 Move the Frontend to the new due-reviews shape
    - `getDueReviews()` returns `{due_count, next_due_at, daily_streak, items}` in the Http_Client mapper and the mock; migrate the HUD haunted counter and `usePlaySession` off the bare-array method
    - _Requirements: 7.6, 15.1_
  - [x] 7.2 Implement the Daily Haunt run
    - Start `startRun({dungeon_id, floor_id: null, mode: 'daily_haunt'})`; show the items as Revenants in a Haunted Hall presentation using `spawn-revenants` with a display-only room id, reusing `revenantLook`, `RevenantSystem` and `HauntedCounter`; no Phaser import changes
    - Hide the feature in real mode when the capability is missing (D26)
    - _Requirements: 7.1, 7.2_
  - [x] 7.3 Add the "memories laid to rest" finale and the daily streak
    - `HauntFinale` shows the number laid to rest and the Backend `daily_streak`; Reduced_Motion uses a static card
    - _Requirements: 7.3_
  - [x] 7.4 Add the Dashboard Daily Haunt button and empty state
    - `DailyHauntButton` with due count and streak on the Dashboard built in frontend-07 P5 (and on the `CampaignPage` header); nothing due shows a celebration and the next due time
    - _Requirements: 7.4, 7.5_
  - [x] 7.5 Build the mode picker and exam timer
    - `ModePicker` with Weak Topics, Exam and Replay Floor mapped to `startRun` bodies; `ExamTimer` off by default with 10, 20 and 30 minute choices, polite announcements at 5 and 1 minute, and `finishRun` at zero
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  - [x] 7.6 Implement Replay Floor and Weak Topics flows
    - Replay lists only cleared Floors; Weak Topics starts the `weak_topics` run; both reuse the campaign play flow and return to the map
    - _Requirements: 8.2, 8.6_
  - [x] 7.7 Write example tests for Daily Haunt and modes
    - Run from due items only, finale text, empty state with next due time, mode request bodies, timer default off, keyboard-only completion
    - _Requirements: 7.1, 7.3, 7.5, 8.2, 8.3, 8.5, 14.1_
  - [x] 7.8 Run Phase 3 verification and update the log
    - Run typecheck, lint, `npm test`, `npm run test:contract` and `npm run build`; record real output
    - _Requirements: 16.1, 16.2, 16.3_

- [x] 8. STOP: Phase 3 checkpoint, Daily Haunt and modes review
  - Summarize, say how to play a Daily Haunt and each mode, wait for approval, then commit Phase 3 separately.

- [x] 9. Phase 4: Learning loop
  - [x] 9.1 Add the second chance to the run reducer and play flow
    - Track `pendingRequeue` from `requeue_after`; show "the question returns..." and present the question again after the given gap; no local gap computation
    - _Requirements: 9.1, 9.5_
  - [x] 9.2 Build the Memory_Scroll
    - Animated parchment with correct answer (when present), explanation, evidence quote, "From your notes: page X", quick retry and continue; instant under Reduced_Motion; polite live announcement; focus moves to Retry
    - _Requirements: 9.2, 9.3, 9.4, 14.4, 14.5_
  - [x] 9.3 Show retry rules from the response only
    - Display `is_retry` and `retry_multiplier` effects exactly as received; no local damage or reward computation in real mode; test that real mode never imports mock rules
    - _Requirements: 9.6, 15.1_
  - [x] 9.4 Add Mastery_Bars everywhere
    - Use `MasteryBar` with band label on the Floor_Map nodes, the Scorecard topics and the Dashboard
    - _Requirements: 10.1, 10.2_
  - [x] 9.5 Build the Progress panel and streak calendar
    - Notes conquered percent, memory strength per Topic, 12-week streak calendar (accessible grid), weakest concepts with page refs; each block hidden when its field is absent; mock supplies the PROPOSED fields
    - _Requirements: 10.3, 10.4_
  - [x] 9.6 Add the honest-copy lint test
    - Scan strings in `src/learning`, `src/haunt` and `src/campaign` for a banned-phrase list (for example "guarantee", "never forget", "will remember")
    - _Requirements: 10.5_
  - [x] 9.7 Write example tests for the learning loop
    - Requeue banner and return, scroll with and without `correct_answer`, band labels, panel blocks hidden, retry uses response values
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.6, 10.3, 10.4_
  - [x] 9.8 Run Phase 4 verification and update the log
    - Run typecheck, lint, `npm test`, `npm run test:contract` and `npm run build`; record real output
    - _Requirements: 16.1, 16.2, 16.3_

- [x] 10. STOP: Phase 4 checkpoint, learning loop review
  - Summarize, say how to miss a question and watch it return, wait for approval, then commit Phase 4 separately.

- [x] 11. Phase 5: Game feel and ranks
  - [x] 11.1 Implement the pure effect plan
    - `src/game/fx/effectPlan.ts` with `planHit` (D22); no Phaser import
    - _Requirements: 12.1, 12.3_
  - [x]* 11.2 Write property test for effect plans
    - **Property 16: Effect plans respect reduced motion**
    - **Validates: Requirements 12.1, 12.3**
  - [x] 11.3 Build the Combo_Meter
    - `comboTier` in `src/learning/combo.ts`, HUD `ComboMeter` with five tiers from `combo ?? streak`, additive `set-combo` event for an aura tint
    - _Requirements: 11.1, 11.2_
  - [x]* 11.4 Write property test for combo tiers
    - **Property 14: Combo tier is monotone with fixed boundaries**
    - **Validates: Requirements 11.1, 11.2**
  - [x] 11.5 Add hit-stop, shake, knockback and snappy damage pops
    - Pooled `HitStopSystem` and camera shake driven by `planHit`; knockback tween; faster pop; all softened or off under Reduced_Motion; mute respected
    - _Requirements: 12.1, 12.3, 12.4, 12.5_
  - [x] 11.6 Add the boss death sequence and loot burst
    - `BossDeathSystem` (pooled sparks, at most 60), `LootBurstSystem`, additive `play-boss-death`, `loot-burst` and `boss-death-done` events; fade-only under Reduced_Motion; new sounds follow the sound catalog
    - _Requirements: 12.2, 12.3, 12.4, 12.5_
  - [x] 11.7 Show the Floor_Rank
    - Rank letter on the Scorecard (frontend-07 P5 component) and on the cleared map node, from `floor_rank` only
    - _Requirements: 11.3_
  - [x] 11.8 Build the Chest overlay
    - `ChestOverlay` lists exactly `chest_rewards` after a Floor clear and is skipped when empty or missing; keyboard operable
    - _Requirements: 11.4, 11.5_
  - [x]* 11.9 Write property test for the Chest view model
    - **Property 15: Chest shows exactly the rewards**
    - **Validates: Requirements 11.4, 11.5**
  - [ ]* 11.10 Add optional presentation-only room events
    - Fountain and trap decorations only if the Backend later adds the data; skip otherwise and note in the log
    - _Requirements: 12.5_
  - [x] 11.11 Run the performance pass
    - Extend `DebugOverlay` with a report mode; record fps (average and 1% low over 10 s), active particles and texture memory for the boss room, a full Revenant room and the 25-Floor map; fix any scene below 55 fps average
    - _Requirements: 12.5, 12.6_
  - [x] 11.12 Run Phase 5 verification and update the log
    - Run typecheck, lint, `npm test`, `npm run test:contract` and `npm run build`; record real output and the performance numbers; update `ASSETS_LICENSES.md` if art changed
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

- [x] 12. STOP: Phase 5 checkpoint, game feel review
  - Summarize, say how to view combos, hits, the boss death and the chest (with and without reduced motion), wait for approval, then commit Phase 5 separately. Next in the build order: frontend-07 Phase 7.

- [x] 13. Phase 6: Tutorial, polish and documentation
  - Depends on frontend-07 P7 (intro story, badges, lore) having been completed.
  - [x] 13.1 Implement the tutorial flag and steps
    - `src/tutorial/tutorialFlag.ts` (`sd.tutorialSeen`, `sd.introSeen`) and the five steps (move, engage, answer, memory scroll, Daily Haunt), about 30 seconds in total
    - _Requirements: 13.3, 13.5_
  - [x] 13.2 Build `TutorialFlow` merged with the intro story
    - One first-run flow: intro story from frontend-07 P7, then the interactive steps on a scripted mock encounter; Skip on every step; later visits show nothing
    - _Requirements: 13.1, 13.2, 13.4_
  - [x] 13.3 Polish the title and menu, and add consistent sounds
    - Title and menu polish; sounds for requeue, memory scroll, combo tiers, boss death, chest and Daily Haunt finale through the existing sound manager; mute respected
    - _Requirements: 12.4_
  - [x] 13.4 Run the accessibility pass
    - Keyboard-only play of a Floor, the Daily Haunt and every mode; screen reader labels; contrast checks; reduced motion and mute checks; record findings and fixes
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_
  - [x] 13.5 Run the responsive check
    - Check 1366x768, 1536x864, 1920x1080, 2560x1440 and a tall phone size for the map, play screen, scroll, scorecard and tutorial; fix clipping
    - _Requirements: 14.6_
  - [x] 13.6 Update README, kiro log and licences
    - README: campaign, Daily Haunt, mock versus real, env vars (`VITE_API_BASE`), dev route, honest-copy rule; `docs/kiro-log-frontend.md`: all frontend-08 phases; `ASSETS_LICENSES.md`: new art or sounds
    - _Requirements: 16.3, 16.4_
  - [x]* 13.7 Add the optional equipped-weapon selection in the Armory
    - Build against the PROPOSED `equipped_weapon` field (or the existing `weapon_name` request field validated by the Backend); mock only until Person A confirms; hidden otherwise
    - _Requirements: 15.4_
  - [x] 13.8 Run Phase 6 verification and update the log
    - Run typecheck, lint, `npm test`, `npm run test:contract` and `npm run build`; record real output and the final test count
    - _Requirements: 16.1, 16.2, 16.3_

- [x] 14. STOP: Phase 6 checkpoint, final review
  - Summarize, say how to run the first-run tutorial and the responsive checks, wait for approval, then commit Phase 6 separately.

## Notes

- Task counts: Phase 0 has 3 sub-tasks (done), Phase 1 has 19, Phase 2 has 11, Phase 3 has 8, Phase 4 has 8, Phase 5 has 12, Phase 6 has 8. Total 69 sub-tasks and 7 STOP tasks. Property tests (optional) account for 16 of them.
- Tasks marked with `*` are optional and can be skipped for a faster MVP.
- The cut list in design.md says what to drop first if time runs short.
- Each task references specific requirements for traceability.
- Property tests validate the 16 correctness properties in design.md.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["3.1"] },
    { "id": 1, "tasks": ["3.2", "3.4"] },
    { "id": 2, "tasks": ["3.3", "3.5", "3.6"] },
    { "id": 3, "tasks": ["3.7", "3.8", "3.9"] },
    { "id": 4, "tasks": ["3.10", "3.11", "3.12", "3.13", "3.14", "3.15"] },
    { "id": 5, "tasks": ["3.16", "3.17"] },
    { "id": 6, "tasks": ["3.18"] },
    { "id": 7, "tasks": ["3.19"] },
    { "id": 8, "tasks": ["5.1"] },
    { "id": 9, "tasks": ["5.2", "5.3", "5.4", "5.5"] },
    { "id": 10, "tasks": ["5.6", "5.7"] },
    { "id": 11, "tasks": ["5.8"] },
    { "id": 12, "tasks": ["5.9"] },
    { "id": 13, "tasks": ["5.10"] },
    { "id": 14, "tasks": ["5.11"] },
    { "id": 15, "tasks": ["7.1"] },
    { "id": 16, "tasks": ["7.2", "7.5"] },
    { "id": 17, "tasks": ["7.3", "7.4", "7.6"] },
    { "id": 18, "tasks": ["7.7"] },
    { "id": 19, "tasks": ["7.8"] },
    { "id": 20, "tasks": ["9.1", "9.2"] },
    { "id": 21, "tasks": ["9.3", "9.4", "9.5"] },
    { "id": 22, "tasks": ["9.6"] },
    { "id": 23, "tasks": ["9.7"] },
    { "id": 24, "tasks": ["9.8"] },
    { "id": 25, "tasks": ["11.1", "11.3"] },
    { "id": 26, "tasks": ["11.2", "11.4", "11.5", "11.6", "11.7"] },
    { "id": 27, "tasks": ["11.8", "11.10"] },
    { "id": 28, "tasks": ["11.9", "11.11"] },
    { "id": 29, "tasks": ["11.12"] },
    { "id": 30, "tasks": ["13.1", "13.3"] },
    { "id": 31, "tasks": ["13.2", "13.4"] },
    { "id": 32, "tasks": ["13.5", "13.6", "13.7"] },
    { "id": 33, "tasks": ["13.8"] }
  ]
}
```
