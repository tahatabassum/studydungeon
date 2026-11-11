# Implementation Plan: frontend-10-live-players

## Overview

Real players for StudyDungeon: a named guest entry, a choice between preloaded dungeons and own notes, preloaded packs with accumulating Leaderboard points, a leaderboard of real players with a live "You" panel, a player counter on the title screen, and an upload path for guests. Delivered on branch `feature/frontend-live-players` in Phase 0 (documents) and Phases 1 to 5. Each phase is sized for one sub-agent, phases run sequentially, and each phase ends with a STOP checkpoint. The decisions D1 to D35 in design.md use their stated defaults unless the user changes them at the Phase 0 STOP.

### Build order

1. Phase 0: plan (this: documents only)
2. Phase 1: guest entry and path choice
3. Phase 2: preloaded packs
4. Phase 3: leaderboard with real players
5. Phase 4: player counter
6. Phase 5: upload path for guests

Rules for every task:

- Edit only `frontend/**`, `.kiro/specs/frontend-*`, `.kiro/hooks/frontend-*`, `docs/handoff/B-to-A.md` and `docs/kiro-log-frontend.md`. Never touch `backend/`.
- The Backend is authoritative for points, ranks, names, pack status, quota and counts. The UI only displays. Local computation is allowed only in the Mock_Adapter (`src/api/mock`), the labeled Offline_Demo module and the pure helpers they call.
- Phaser code under `src/game` imports nothing from `src/api`, `src/demo`, `src/state`, `src/offline`, `src/campaign`, `src/learning`, `src/haunt`, `src/rewards`, `src/tutorial`, `src/identity`, `src/packs`, `src/points`, `src/board` or `src/counter`. Keep `importBoundary.test.ts` passing and extend it.
- Do not change the Event_Bridge. Do not change the behavior of `src/touch/*`, `styles/touch.css`, `PauseButton` or the `html[data-touch]` setting.
- New endpoints are PROPOSED until Person A confirms. Build against the mock, zod-validate real responses, extend `npm run test:contract`, and document shapes in `docs/handoff/B-to-A.md` (section "frontend-10 live players"). Follow `docs/handoff/BACKEND_REQUIREMENTS_V2.md` where it exists.
- Use the capability model of design.md D2: REAL-now features start on, PROPOSED features start unproven, a 404, 405 or 501 turns a feature off.
- Real mode never shows Ghost Rivals and never shows the `username` of a guest.
- Use "points" for Leaderboard points and "Dungeon score" for the run value.
- Desktop screens that must fit keep no page scrollbar (PageShell fit variant). On small touch screens natural scrolling is allowed (design.md D26).
- Keep all existing tests passing (last run: 1142 passed, 12 skipped; `test:contract` 31 passed, 1 skipped).
- Paths are relative to `frontend/` unless they start with `docs/` or `.kiro/`.
- Every phase's verification sub-task runs `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:contract` and `npm run build` in `frontend/`, records the real output, and checks 360x740, 768x1024, 1366x650 and 1920x1080 (headless Edge with its own profile, or DevTools device mode).
- Every phase's docs sub-task appends to `docs/handoff/B-to-A.md` and `docs/kiro-log-frontend.md`.
- Each phase ends with a STOP task. Summarize the changes, say how to view and what to check and where, wait for approval, then commit that phase separately. Do not push.
- Sub-tasks marked `*` are optional (property-based tests). Required example, boundary and contract tests carry no marker.
- Property tests use fast-check with at least 100 runs and the tag `Feature: frontend-10-live-players, Property N: <title>`.

## Tasks

- [x] 1. Phase 0: Plan (documents only)
  - [x] 1.1 Write requirements.md, design.md and tasks.md for this spec
    - Decisions D1 to D35, contradictions X1 to X12, assumptions AS1 to AS9, contract suite additions, risks, cut list
    - _Requirements: 19.4_
  - [x] 1.2 Append "frontend-10 live players" to `docs/handoff/B-to-A.md`
    - Proposed contract changes, questions for Person A, findings from the real Backend
    - _Requirements: 18.4_
  - [x] 1.3 Add the dated Phase 0 entry to `docs/kiro-log-frontend.md`
    - _Requirements: 19.3_

- [x] 2. STOP: Phase 0 checkpoint, plan review
  - Summarize the decisions, contradictions, assumptions, cut list and the B-to-A.md section. Say where to read them. Wait for approval, then commit Phase 0 separately.

- [x] 3. Phase 1: Guest entry and path choice
  - [x] 3.1 Add the identity types, capability state and wire schemas
    - In `src/types/api.ts` extend `User` (optional `public_id`, `display_name`, `tag`, `handle`), add `NameReason`, `NameCheckResult`, `CreateGuestRequest`, `CreateGuestResponse`, `DungeonSummary`, `CapabilityState`
    - In `src/api/ApiClient.ts` add the optional capability fields `guestIdentity`, `accountUpgrade`, `accountDelete`, `packs`, `liveBoard`, `playerCounter`, `uploadQuota`, `guestUpload` (type `CapabilityState`), the helper `capabilityOf(api, key)`, and the new method signatures `checkGuestName`, `createGuest`, `upgradeGuest`, `deleteAccount`, `listDungeons`, `warmUp?`
    - In `src/api/wire/auth.ts` make `username` nullish, accept the new optional user fields, add schemas and mappers for name check, create guest, upgrade, delete and the dungeon list; register them in `src/api/wire/index.ts` and `src/api/schemas.ts`
    - _Requirements: 1.1, 1.2, 3.6_
  - [x] 3.2 Implement the new calls and the capability transitions in the Http_Client
    - In `src/api/client.ts` add the calls, allow the `DELETE` method in `request`, set `guestIdentity`, `accountUpgrade` and `accountDelete` on in `HTTP_CAPABILITIES`, turn a capability off on 404, 405 or 501 and leave it unchanged on other errors, and add `warmUp()` (`GET /health`, `credentials: 'omit'`, errors swallowed, once per page)
    - In `src/api/errors.ts` keep `detail` extras (`reason`, `retry_after_seconds`, `limit`, `found`, `offer_packs`) on `ApiError` and map NAME_INVALID, NOTICE_NOT_ACCEPTED, SESSION_EXISTS, GUEST_CREATION_PAUSED, NOT_A_GUEST, USERNAME_TAKEN, CONFIRMATION_REQUIRED and SYSTEM_USER_PROTECTED
    - _Requirements: 1.1, 1.5, 1.6, 7.1, 7.2, 18.5_
  - [x] 3.3 Implement the guest identity in the Mock_Adapter and flag the Offline_Demo
    - Create `src/api/mock/mockGuests.ts` (local name rules plus a small mock reserved list, random tag, `public_id`, handle, same-name different-tag, upgrade keeping id and handle, delete) and wire it into `mockAdapter.ts` and `mockAuth.ts`
    - In `src/offline` set the new capabilities to `false` (flags only)
    - _Requirements: 1.8, 1.9, 4.3, 6.5_
  - [x] 3.4 Build the pure identity modules
    - Create `src/identity/nameRules.ts` (`checkLocalName`), `spookyNames.ts` (`randomSpookyName(rng, exclude?)`, adjective and creature lists, every combination at most 16 characters, no reserved or profane substring), `wakeConstants.ts` (`OFFLINE_OFFER_MS = 8_000`, `WAKE_MAX_MS = 60_000`), `guestMessages.ts` (`reasonMessage`, `describeGuestError`), `handle.ts` (`displayHandle`), `resolvePreloaded.ts` (`pickPreloaded`, `isFirstTime`, `firstPlayableFloorId` pure parts; locate the cleared-room fields of the pack, dungeon and progress types first)
    - _Requirements: 2.4, 2.5, 2.6, 2.8, 2.11, 2.16, 3.3, 3.4, 3.5, 5.4, 5.10, 5.11_
  - [x]* 3.5 Write property test for the local name hints
    - **Property 1: Local name hints match the rule model**
    - **Validates: Requirements 2.6**
  - [x]* 3.6 Write property test for the reason messages
    - **Property 2: Server name reasons always map to a friendly message**
    - **Validates: Requirements 2.8, 2.11, 2.12**
  - [x]* 3.7 Write property test for the handle display
    - **Property 3: Handle display never leaks a guest username**
    - **Validates: Requirements 3.3, 3.4, 3.5**
  - [x]* 3.8 Write property test for the preloaded dungeon choice
    - **Property 4: Preloaded dungeon choice is deterministic and valid**
    - **Validates: Requirements 5.4**
  - [x]* 3.9 Write property test for the spooky names
    - **Property 18: Spooky names always pass the local rules**
    - **Validates: Requirements 2.4, 2.5**
  - [x] 3.10 Add the warm-up call and make Try the Demo open the Name_Screen directly
    - In `src/pages/LandingPage.tsx` call `api.warmUp?.()` once on mount (Http_Client only); change `tryDemo` to navigate straight to `/play-as-guest` with no intro story, tutorial or `firstRunDone` step; stop opening the intro story and the tutorial automatically on the first visit
    - Keep the "How to play · 30 sec" pill opening the full tutorial, skippable with one action (Skip button and Escape) and never blocking navigation; keep `sd.introSeen` and `sd.tutorialSeen` as UI-only flags that gate nothing
    - Show the existing `ControlsHint` / `ControlsLegend` (touch legend in Touch_Mode) in the first room of a run as the in-room tutorial (locate the run screen first)
    - _Requirements: 2.1, 7.1, 7.2, 7.3, 7.4, 20.1, 20.2, 20.3, 20.4, 20.5_
  - [x] 3.11 Build the Name_Screen
    - Create `src/identity/useCreateGuest.ts` (submit once, `OFFLINE_OFFER_MS` waking timer, two choices "Keep waiting" and "Play offline demo", keep the request alive until `WAKE_MAX_MS`, then error with Retry and the offline choice, never start the Offline_Demo without the player's choice, continue normally when the request succeeds while the choices are shown, 409 recovery with `getMe`, capability-off fallback through `useStartDemo` with the same waking flow) and `src/identity/NameScreen.tsx` (PageShell fit, field prefilled with `randomSpookyName()`, "Roll another" button, hints, notice text directly above the primary button "Accept and continue", Enter submits, no confirmation checkbox, debounced check at 500 ms, error states) plus `src/styles/live.css`
    - Register the route `/play-as-guest` in `src/App.tsx`; redirect to `/choose` when a session exists
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16, 2.17, 2.18, 2.19, 2.20, 3.1, 17.1, 17.2, 17.6_
  - [x] 3.12 Build the Path_Choice and the preloaded resolver
    - Create `src/identity/PathChoice.tsx` (two cards, compact variant; the preloaded card highlighted as the default and focused on mount so Enter activates it), complete `resolvePreloadedDungeon(api)` (packs when not off, then `listDungeons`, then the demo session only without a session) with the first-time decision of D31 (Backend data only, never localStorage; floor map when unknown), open `/campaign/{id}/play/{firstPlayableFloorId}` for a first-time player (legacy single-floor Backends use the existing floor-1 route mapping) and the floor map for a returning player, register `/choose` in `src/App.tsx`, and render the component on the Dashboard in `src/dashboard/CampaignCards.tsx` and `src/pages/DashboardPage.tsx`
    - Show the error with Retry and the Offline_Demo offer when nothing resolves; show the quota line on the upload card when `uploadQuota` is not off
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11_
  - [x] 3.13 Show the guest identity and the upgrade offer
    - Use `displayHandle` in `src/components/Hud.tsx` (non-compact), `src/components/GuestBanner.tsx`, the Dashboard header and guest card; replace `user?.username` in `src/leaderboard/LeaderboardPage.tsx`
    - Create `src/identity/UpgradeOffer.tsx`; make `src/auth/RegisterPage.tsx` call `upgradeGuest` for a Guest when `accountUpgrade` is not off and hide the offers when it is off
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - [x] 3.14 Build the Settings page and Delete my account and data
    - Create `src/pages/SettingsPage.tsx` and `src/identity/DeleteAccountDialog.tsx` (typed DELETE, list of what goes, error states), add `resetClientCaches()`, register `/settings` in `src/App.tsx`, and point the Settings button of `LinksCard` to it
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_
  - [x] 3.15 Write example tests for Phase 1
    - Try the Demo opens the Name_Screen directly (no intro or tutorial opens, none is a step before the Name_Screen); the tutorial opens from the pill, is skippable with one action and does not block navigation; ControlsHint shows in the first room
    - Name_Screen: prefilled spooky name passing the local rules, Roll another gives a different name, Enter and the button each submit once with `accept_public_notice` true, no checkbox exists, notice sits directly above the button, states and each error, 409 recovery, capability-off fallback, offline choice only on click, session restore with a fake `getMe`
    - Waking (fake timers): choices appear at 8 s; Keep waiting keeps the request pending and rotates tips until `WAKE_MAX_MS`; after 60 s the error shows Retry and the offline choice; no offline start without the click for any timeout or error (a real session never goes offline silently); a success while the choices are shown continues to `/choose`; the same flow for the legacy `POST /demo/session`
    - Path_Choice: preloaded card highlighted and focused, Enter activates it, sources and failure, first-time player opens the first floor run, returning player opens the floor map, unknown progress opens the floor map, no localStorage progress write, no `POST /demo/session` while a session exists; upgrade flow and hidden offer, delete flow and errors, warm-up once and none in mock or offline
    - Update the existing landing tests that assumed the intro or tutorial opens automatically or that `tryDemo` runs the first-run flow, and list each changed test in `docs/kiro-log-frontend.md`
    - _Requirements: 1.5, 2.1, 2.2, 2.3, 2.5, 2.10, 2.13, 2.14, 2.15, 2.16, 2.17, 2.18, 2.19, 2.20, 3.2, 4.2, 4.6, 5.5, 5.6, 5.9, 5.10, 5.11, 6.4, 6.5, 6.7, 7.2, 7.3, 20.1, 20.2, 20.3, 20.4_
  - [x] 3.16 Write the 3-click first fight test
    - In mock mode, drive the app from the title screen with a click counter: Try the Demo (1), Accept and continue (2), Play preloaded dungeons (3); assert exactly three clicks, a running floor and that the first monster can be engaged with the E key and with the Engage touch button (Touch_Mode) without any other click; document the same manual check for real mode against a local Backend
    - _Requirements: 20.6, 5.9, 5.10, 2.1, 2.10_
  - [x] 3.17 Extend the contract suite and the boundary tests for Phase 1
    - Add the identity cases of the design table to `src/contract/suite.ts` (with `makeFreshClient` and `provedOrSkip`), enable them in `mock.contract.test.ts` and `http.contract.test.ts`
    - Extend `importBoundary.test.ts` with the new directories and add a test that no screen renders a guest `username`
    - _Requirements: 1.5, 18.2, 18.6, 18.8_
  - [x] 3.18 Run Phase 1 verification
    - Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:contract`, `npm run build`; check the sizes 360x740, 768x1024, 1366x650, 1920x1080 for `/`, `/play-as-guest`, `/choose`, `/dashboard`, `/settings`; confirm the existing counts
    - _Requirements: 17.1, 17.5, 19.1, 19.2_
  - [x] 3.19 Update the docs for Phase 1
    - Append the Phase 1 results to `docs/kiro-log-frontend.md` and the confirmed or changed shapes to `docs/handoff/B-to-A.md`
    - _Requirements: 19.3_

- [x] 4. STOP: Phase 1 checkpoint, guest entry and path choice review
  - Summarize the changes, say how to view `/`, `/play-as-guest`, `/choose`, `/dashboard` and `/settings` (mock mode, then real mode against a local Backend) and what to check. Wait for approval, then commit Phase 1 separately.

- [ ] 5. Phase 2: Preloaded packs
  - [~] 5.1 Add the pack and points types and wire schemas
    - In `src/types/api.ts` add `PackStatus`, `Pack`, `PacksResponse`, `PackProgress`, `PointsReason`, `PlayerPoints` and the optional points and `pack_progress` fields on `AnswerResult`, `ClearRoomResponse` and `RunSummary`
    - Create `src/api/wire/packs.ts` and extend the attempt, clear and finish wire schemas and mappers with the optional fields; register in `src/api/schemas.ts`
    - _Requirements: 8.2, 10.7, 18.5_
  - [~] 5.2 Add `getPacks` and the pack lock handling to the Http_Client
    - In `src/api/ApiClient.ts` and `src/api/client.ts` add `getPacks()` with the `packs` capability transitions; in `src/api/errors.ts` map 403 PACK_LOCKED
    - _Requirements: 1.4, 1.5, 8.2, 8.8, 8.9_
  - [~] 5.3 Build the mock packs and mock points
    - Create `src/api/mock/mockPacks.ts` (three packs, Pack 1 the demo, Packs 2 and 3 from the generated-dungeon context builder, `sample: true`, `applyPackClear`, 403 PACK_LOCKED on a locked pack) and `mockPoints.ts` (simplified V2 C.2 table, per-attempt idempotence), and wire both into `mockAdapter.ts` including `pack_progress`, `points_earned` and `player_points` on finish
    - _Requirements: 8.6, 8.7, 8.10, 10.7_
  - [~] 5.4 Build the pure pack and points modules
    - Create `src/packs/packView.ts` (`currentPack`, `unlockedBetween`, `packLabel`) and `src/points/pointsText.ts`; complete `resolvePreloadedDungeon` for the pack source
    - _Requirements: 8.2, 8.5, 9.5, 10.3, 10.4, 10.5_
  - [ ]* 5.5 Write property test for the pack view
    - **Property 5: Pack view reports exactly the newly unlocked packs**
    - **Validates: Requirements 8.2, 9.5**
  - [ ]* 5.6 Write property test for the mock pack unlock
    - **Property 6: Mock pack unlock follows the final boss**
    - **Validates: Requirements 8.7**
  - [ ]* 5.7 Write property test for the points text
    - **Property 7: Points text is total and hides what it cannot explain**
    - **Validates: Requirements 10.3, 10.4, 10.5**
  - [~] 5.8 Build the pack page
    - Create `src/packs/PacksPage.tsx` and `PackChip.tsx` (status chips, floors cleared, points, locked text, "Sample content" chip on Packs 2 and 3 in mock mode, also on the floor map header and the unlock screen), register `/packs` in `src/App.tsx`, link it from the Path_Choice preloaded card when `packs` is on, and open `/packs` after `PACK_LOCKED`
    - _Requirements: 8.1, 8.3, 8.4, 8.8, 8.9, 8.10, 17.1, 17.2, 17.3_
  - [~] 5.9 Build the unlock and completion screens and the pack header
    - Create `src/packs/PackUnlockedPage.tsx` and `AllPacksCompletePage.tsx` (routes `/packs/unlocked/:packId` and `/packs/complete`), wire the Scorecard Continue action in `src/scorecard/*` (`pack_progress` first, then the refetch diff), and add the "Pack N of M" header with pack points to `src/campaign/CampaignPage.tsx`
    - _Requirements: 8.5, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_
  - [~] 5.10 Show points and rename the score labels
    - Locate the damage readout in `src/encounter` and add `PointsPop` using `pointsText`; show "Dungeon score" on the HUD, victory and defeat overlays, Scorecard and share card; show "Leaderboard points" and the one-line explanation on the Scorecard; update tests that assert the old label and list each change in the kiro log
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_
  - [~] 5.11 Write example tests for Phase 2
    - Pack page statuses and Play, locked text, "Sample content" label on Packs 2 and 3 in mock mode (pack page, floor map, unlock screen), `PACK_LOCKED`, single-dungeon fallback when `packs` is off, unlock and completion screens (with `pack_progress` and with the refetch diff), Daily Haunt button only with the capability, points pop and reasons, label text, reduced motion
    - _Requirements: 8.3, 8.4, 8.8, 8.9, 8.10, 9.1, 9.2, 9.3, 9.4, 9.5, 9.7, 10.1, 10.2, 10.3, 10.5, 10.6_
  - [~] 5.12 Extend the contract suite for Phase 2
    - Add the packs, `PACK_LOCKED`, pack clear and points cases of the design table
    - _Requirements: 18.6_
  - [~] 5.13 Run Phase 2 verification
    - Run the five commands; check the sizes for `/packs`, the unlock screens and the campaign header; confirm the counts
    - _Requirements: 17.1, 17.5, 19.1, 19.2_
  - [~] 5.14 Update the docs for Phase 2
    - Append to `docs/kiro-log-frontend.md` and `docs/handoff/B-to-A.md`
    - _Requirements: 19.3_

- [~] 6. STOP: Phase 2 checkpoint, preloaded packs review
  - Summarize the changes, say how to play pack 1 to the unlock screen in mock mode and what to check. Wait for approval, then commit Phase 2 separately.

- [ ] 7. Phase 3: Leaderboard with real players
  - [~] 7.1 Add the board types and wire schema
    - In `src/types/api.ts` add `BoardKind`, `BoardQuery`, `BoardEntry`, `BoardMe`, `BoardResponse`; create `src/api/wire/board.ts` (drops unknown keys, no username or internal id, no rival field); register in `src/api/schemas.ts`
    - _Requirements: 11.7, 18.5_
  - [~] 7.2 Add `getBoard` to the Http_Client and extend the support hook
    - In `ApiClient.ts` and `client.ts` add `getBoard(query)` with `liveBoard` transitions and `Retry-After` kept on 429; extend `src/state/useLeaderboardSupport.ts` to report the live view, the legacy view or "coming soon"
    - _Requirements: 1.4, 1.5, 11.1, 11.13_
  - [~] 7.3 Build the mock board
    - Create `src/api/mock/mockBoard.ts` (real-player-shaped entries built from the mock points and run history, the seeded Ghost Rivals marked `is_seeded_rival`, a live `me` block with rank, `next_above` and `top20`, `updated_at` and `next_refresh_at` one hour apart, week window) and wire it into `mockAdapter.ts`
    - _Requirements: 11.8, 12.10_
  - [~] 7.4 Build the pure board modules
    - Create `src/board/boardView.ts`, `youPanel.ts`, `countdown.ts` (`formatCountdown`, `formatWeekReset`) and `pollScheduler.ts` (`nextPollDelay`, constants `MIN_BOARD_INTERVAL_MS`)
    - _Requirements: 11.4, 11.5, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 13.2, 13.3, 13.5, 13.7_
  - [ ]* 7.5 Write property test for the board view
    - **Property 8: The board view keeps the server order**
    - **Validates: Requirements 11.5**
  - [ ]* 7.6 Write property test for the You panel
    - **Property 10: The You panel shows exactly the numbers from the Backend**
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.10**
  - [ ]* 7.7 Write property test for the countdown
    - **Property 11: Countdown text is monotone and clamped**
    - **Validates: Requirements 13.2**
  - [ ]* 7.8 Write property test for the poll scheduler
    - **Property 12: Poll scheduling never polls too early**
    - **Validates: Requirements 13.3, 13.4, 13.5, 13.6, 13.7**
  - [~] 7.9 Build the board hooks
    - Create `src/board/useBoard.ts` (one timer from `nextPollDelay`, refetch on visible after 60 s, Retry-After wait, cancel on unmount, keeps stale rows, ignores late responses) and `useNow.ts` (1 s tick while visible)
    - _Requirements: 13.3, 13.4, 13.5, 13.6, 13.7, 13.8_
  - [~] 7.10 Build the live leaderboard view
    - Create `src/board/BoardTabs.tsx` (Preloaded, Own notes, Overall, All-time, This week, keyboard arrows, one-line explanations), `LiveBoard.tsx` (podium, table, tie-break note, skeleton, empty "Be the first to enter", error with Retry, stale line, "Updated at ..., refreshes hourly", countdown, week reset text) and `YouPanel.tsx`; make `src/leaderboard/LeaderboardPage.tsx` choose the live view, the legacy view or "coming soon"; add styles to `live.css`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.8, 11.9, 11.10, 11.11, 11.12, 11.13, 12.1, 12.7, 12.8, 12.9, 13.1, 17.1, 17.2, 17.3, 17.6, 17.7_
  - [~] 7.11 Write example tests and extend the boundary tests for Phase 3
    - Tabs and URL params, week reset text, countdown ticking with fake timers, one request per allowed window, tab visibility refetch, Retry-After wait, empty, skeleton, error, stale, guest and null `me` panels, mock rivals labeled, no rival wording or `is_seeded_rival` read outside the allowed files
    - _Requirements: 11.7, 11.8, 11.9, 11.10, 11.11, 11.12, 12.7, 12.8, 13.3, 13.4, 13.5, 13.6, 13.7, 18.7_
  - [~] 7.12 Extend the contract suite for Phase 3
    - Add the `GET /leaderboard` cases of the design table
    - _Requirements: 18.6_
  - [~] 7.13 Run Phase 3 verification
    - Run the five commands; check the sizes for `/leaderboard` with each tab; confirm the counts
    - _Requirements: 17.1, 17.5, 19.1, 19.2_
  - [~] 7.14 Update the docs for Phase 3
    - Append to `docs/kiro-log-frontend.md` and `docs/handoff/B-to-A.md`
    - _Requirements: 19.3_

- [~] 8. STOP: Phase 3 checkpoint, leaderboard review
  - Summarize the changes, say how to view `/leaderboard` in mock mode and what to check. Wait for approval, then commit Phase 3 separately.

- [ ] 9. Phase 4: Player counter
  - [~] 9.1 Add the player stats endpoint through the stack
    - Add `PlayerStats` to `src/types/api.ts`, `src/api/wire/stats.ts`, `getPlayerStats()` in `ApiClient.ts` and `client.ts` (`playerCounter` transitions), and the mock in `src/api/mock/mockStats.ts` (`VITE_MOCK_PLAYER_COUNT`, default 0); the Offline_Demo has no counter
    - _Requirements: 1.4, 14.9, 18.5_
  - [~] 9.2 Build the pure counter modules
    - Create `src/counter/format.ts` (`formatExplorerLine`: null, "Be among the first explorers" for 1 to 9, "N explorers have braved the dungeon" with `Intl.NumberFormat` for 10 or more; `explorerCountText`: singular only for 1), `countUp.ts` (`countUpValue`) and `cache.ts` (`shouldRefetch`, `fetchPlayerCount` with a module cache and one in-flight request, `resetCounterCache`)
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.12_
  - [ ]* 9.3 Write property test for the cache decision
    - **Property 13: Counter cache refetches only after expiry**
    - **Validates: Requirements 14.1, 14.4**
  - [ ]* 9.4 Write property test for the counter line
    - **Property 14: The counter line shows the exact received number or nothing**
    - **Validates: Requirements 14.2, 14.3, 14.5, 14.8, 14.12**
  - [ ]* 9.5 Write property test for the count-up
    - **Property 15: Count-up is bounded, monotone and exact at the end**
    - **Validates: Requirements 14.6, 14.7**
  - [~] 9.6 Build the counter line on the title screen
    - Create `src/counter/PlayerCounterLine.tsx` (renders nothing on null, `requestAnimationFrame` count-up, `aria-hidden` animated span plus `sr-only` final text, wraps at 360 px) and add it under the tagline in `src/pages/LandingPage.tsx` without delaying any control; add styles to `src/styles/landing.css` or `live.css`
    - _Requirements: 14.1, 14.2, 14.3, 14.5, 14.6, 14.7, 14.10, 14.11, 17.7_
  - [~] 9.7 Write example tests for Phase 4
    - Hidden on failure, zero, negative and non-integer; 1 to 9 players show "Be among the first explorers" with no number; 10 or more show the plural line with `Intl.NumberFormat`; `explorerCountText` singular for 1; cache hit within the window; reduced motion; Offline_Demo shows none; mock default shows none; layout class at 360 px; the line never blocks the Try the Demo button
    - _Requirements: 14.2, 14.3, 14.4, 14.5, 14.7, 14.9, 14.10, 14.11, 14.12_
  - [~] 9.8 Extend the contract suite for Phase 4
    - Add the `GET /stats/players` case of the design table
    - _Requirements: 18.6_
  - [~] 9.9 Run Phase 4 verification
    - Run the five commands; check the title screen at the four sizes; confirm the counts
    - _Requirements: 17.1, 17.5, 19.1, 19.2_
  - [~] 9.10 Update the docs for Phase 4
    - Append to `docs/kiro-log-frontend.md` and `docs/handoff/B-to-A.md`
    - _Requirements: 19.3_

- [~] 10. STOP: Phase 4 checkpoint, player counter review
  - Summarize the changes, say how to view the title screen with `VITE_MOCK_PLAYER_COUNT=128` and what to check. Wait for approval, then commit Phase 4 separately.

- [ ] 11. Phase 5: Upload path for guests
  - [~] 11.1 Add the quota types and wire schemas
    - Add `QuotaReason`, `UploadQuota` and the optional `counts_for_ranking`, `ranking_note`, `dungeon_id` and `floors` fields on the document status in `src/types/api.ts`; create `src/api/wire/quota.ts` and extend the document status wire schema; register in `src/api/schemas.ts`
    - _Requirements: 15.3, 15.8, 15.9, 18.5_
  - [~] 11.2 Add `getUploadQuota`, the notice field and the guest capability rules to the Http_Client
    - In `ApiClient.ts` and `client.ts` add `getUploadQuota()` (turns `uploadQuota` and, for a guest, `guestUpload` on; 403 GUEST_FORBIDDEN on `POST /documents` turns `guestUpload` off) and the `{acceptAiNotice}` option that sends `accept_ai_notice=true`; in `src/api/errors.ts` map AI_BUSY, UPLOADS_PAUSED_TODAY, UPLOAD_LIMIT_PLAYER, UPLOAD_LIMIT_IP, QUOTA_EXCEEDED, AI_NOTICE_NOT_ACCEPTED, TOO_MANY_PAGES, TOO_MANY_SLIDES, TOO_MUCH_TEXT
    - _Requirements: 1.4, 1.10, 1.11, 15.5, 15.6, 15.7, 16.3, 16.5, 16.6_
  - [~] 11.3 Build the mock quota and guest upload
    - Create `src/api/mock/mockQuota.ts` (guest limit 1 per day, stored limit 2, forced states through a dev switch, AI_BUSY switch, `accept_ai_notice` required, `counts_for_ranking` false below 3000 characters, per-floor `floors[]` on status); allow guests in the mock `uploadDocument`
    - _Requirements: 15.1, 15.3, 15.5, 15.9, 16.5_
  - [~] 11.4 Build the pure upload modules and the file rules
    - Create `src/upload/quotaView.ts` and `limitErrors.ts`; extend the single constants module `src/upload/limits.ts` with `MAX_SLIDES`, `MAX_DOCX_CHARS`, the minimum characters, the stored document limits (hints) and a `rulesText()` built from the constants (design.md D23), with a TODO comment to read the limits from the server later (`GET /uploads/quota` or a future `GET /meta`); mark `MAX_DOCX_CHARS` as unconfirmed in a comment
    - _Requirements: 15.3, 15.4, 16.6, 16.7, 16.9_
  - [ ]* 11.5 Write property test for the quota view
    - **Property 16: The quota view never offers a blocked upload**
    - **Validates: Requirements 15.3, 15.4**
  - [ ]* 11.6 Write property test for the limit errors
    - **Property 17: Limit errors state both numbers**
    - **Validates: Requirements 16.6**
  - [ ]* 11.7 Write property test for the wire mapping of all new shapes
    - **Property 9: Wire mapping of the new shapes is valid, private-free and loud**
    - **Validates: Requirements 3.6, 11.7, 18.5**
  - [~] 11.8 Open the upload page to guests and add the quota panel, notice and fallback
    - Update `src/upload/UploadPage.tsx` (gate only when there is no session or the guest capability is off), create `QuotaPanel.tsx` and `AiNotice.tsx` (draft text, checkbox, no retention promise), disable the drop zone until the box is ticked and while blocked, add "Play preloaded dungeons instead" using the resolver, and the create-account offer for a guest at the limit
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.10, 15.11, 16.1, 16.2, 16.4, 17.1, 17.2, 17.3, 17.6_
  - [~] 11.9 Add per-floor progress and the error states to the wizard
    - Create `src/upload/FloorProgressList.tsx` reusing the generation status UI; update `UploadWizard.tsx`, `useUploadFlow.ts` and `SummonResult.tsx` to send the notice flag, show AI_BUSY, limit, stored-limit, AI notice and type-limit messages, the ranking note and the rules text, all rule text and error hints built from the constants of `src/upload/limits.ts` (no literal limit number in the components)
    - _Requirements: 15.5, 15.6, 15.7, 15.8, 15.9, 16.3, 16.5, 16.6, 16.7, 16.8, 16.9_
  - [~] 11.10 Write example tests for Phase 5
    - Guest wizard shown when proven and gate when off, each quota state, disabled drop zone, notice checkbox and field, AI_BUSY and limit messages with Retry-After, type-limit messages, per-floor rows, ranking note, fallback button target, copy lint for banned promises, rules text equals `rulesText()` and no literal limit number in `src/upload/*.tsx`
    - _Requirements: 15.1, 15.2, 15.4, 15.5, 15.6, 15.8, 15.9, 15.11, 16.1, 16.2, 16.3, 16.4, 16.6, 16.7, 16.9_
  - [~] 11.11 Extend the contract suite for Phase 5
    - Add the quota and notice cases of the design table
    - _Requirements: 18.6_
  - [~] 11.12 Run Phase 5 verification
    - Run the five commands; check `/upload` in each state at the four sizes; confirm the counts
    - _Requirements: 17.1, 17.5, 19.1, 19.2_
  - [~] 11.13 Update the docs for Phase 5
    - Append to `docs/kiro-log-frontend.md` and `docs/handoff/B-to-A.md`
    - _Requirements: 19.3_

- [~] 12. STOP: Phase 5 checkpoint, guest upload review
  - Summarize the changes, say how to view `/upload` as a guest in each quota state in mock mode and what to check. Wait for approval, then commit Phase 5 separately.

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for a faster MVP, but the pure modules they cover are still built.
- Each task references specific requirements for traceability.
- The cut list in design.md says what to drop first if time runs short and what must never be cut.
- Items assigned from state doc Section 9: 9.6 to Phase 5, 9.7 and 9.9 to Phase 2, 9.8 and 9.10 to Phase 1.
- Files named in "locate first" steps (mock adapter internals, encounter, scorecard, offline) were not opened during Phase 0.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["3.1"] },
    { "id": 1, "tasks": ["3.2", "3.3", "3.4"] },
    { "id": 2, "tasks": ["3.5", "3.6", "3.7", "3.8", "3.9", "3.10", "3.11"] },
    { "id": 3, "tasks": ["3.12"] },
    { "id": 4, "tasks": ["3.13"] },
    { "id": 5, "tasks": ["3.14"] },
    { "id": 6, "tasks": ["3.15", "3.16", "3.17"] },
    { "id": 7, "tasks": ["3.18"] },
    { "id": 8, "tasks": ["3.19"] },
    { "id": 9, "tasks": ["5.1"] },
    { "id": 10, "tasks": ["5.2", "5.3", "5.4"] },
    { "id": 11, "tasks": ["5.5", "5.6", "5.7", "5.8"] },
    { "id": 12, "tasks": ["5.9"] },
    { "id": 13, "tasks": ["5.10"] },
    { "id": 14, "tasks": ["5.11", "5.12"] },
    { "id": 15, "tasks": ["5.13"] },
    { "id": 16, "tasks": ["5.14"] },
    { "id": 17, "tasks": ["7.1"] },
    { "id": 18, "tasks": ["7.2", "7.3", "7.4"] },
    { "id": 19, "tasks": ["7.5", "7.6", "7.7", "7.8", "7.9"] },
    { "id": 20, "tasks": ["7.10"] },
    { "id": 21, "tasks": ["7.11", "7.12"] },
    { "id": 22, "tasks": ["7.13"] },
    { "id": 23, "tasks": ["7.14"] },
    { "id": 24, "tasks": ["9.1", "9.2"] },
    { "id": 25, "tasks": ["9.3", "9.4", "9.5", "9.6"] },
    { "id": 26, "tasks": ["9.7", "9.8"] },
    { "id": 27, "tasks": ["9.9"] },
    { "id": 28, "tasks": ["9.10"] },
    { "id": 29, "tasks": ["11.1"] },
    { "id": 30, "tasks": ["11.2", "11.3", "11.4"] },
    { "id": 31, "tasks": ["11.5", "11.6", "11.7", "11.8"] },
    { "id": 32, "tasks": ["11.9"] },
    { "id": 33, "tasks": ["11.10", "11.11"] },
    { "id": 34, "tasks": ["11.12"] },
    { "id": 35, "tasks": ["11.13"] }
  ]
}
```
