# Kiro log: frontend

## frontend-06 Halloween visuals (phases 2 to 6)

Branch: feature/frontend-halloween-visuals (from feature/frontend-rpg-polish). No gameplay, balance, Event_Bridge, API or state changes. Phaser code imports nothing from api, demo or state.

### What was built

- Phase 2 (sample room): new palette tokens, contrast helper, theme ids, pure flicker function, keep-out zones and seeded prop placement, theme budgets. Procedural floor and wall generators, baked per-room CanvasTexture (RoomBaker, lazy current and next room), glow and vignette textures, LightSystem, animated Clockwork Crypt pieces, gate and character polish, debug overlay (`?debug=1` or F3) and `?renderer=canvas`.
- Phase 3 (other rooms): Haunted Library, Witch's Laboratory, Pumpkin Workshop and the Boss Hall of the Exam Warden on the shared lighting system, with all-theme budget and placement tests.
- Phase 4 (UI): stone-frame HUD with low-health state, spellbook question panel, answer feedback effects, landing page, victory, defeat and pause screens, room transitions. All pure CSS or inline SVG, static under reduced motion.
- Phase 5 (sound): synthesized ambient wind bed with creaks and a distant owl, new 'miss' and 'boss' stingers, wiring from the React side only.
- Phase 6 (verification): contrast and witch-not-text tests, verification report, licence and log updates, full checks. Task 11 (user fps readings) is open.

### Decisions D1 to D11 (as implemented)

- D1 Palette: kept existing semantic tokens and added pumpkin, ember, ghost, toxic, witch, magenta, indigo, bone and blood-red.
- D2 Room mapping: gear_golem is the Clockwork Crypt, paper_wraith the Library, toxic_slime the Witch's Laboratory, memory_eater the Pumpkin Workshop, is_boss the Boss Hall.
- D3 Camera: follow camera kept, zoom 1.0 as a named constant.
- D4 Art source: code-drawn only.
- D5 Lighting: baked radial-glow textures with ADD blend and a baked vignette, one path for WebGL and Canvas.
- D6 Baking: one CanvasTexture per room.
- D7 Debug overlay: dev-only, `?debug=1` or F3.
- D8 Sound default: quiet, unmuted, master 0.25, bed at most 5% of master.
- D9 Branch: new branch from feature/frontend-rpg-polish.
- D10 Baking cadence: lazy, current and next room only.
- D11 Lightning: pooled overlay, peak alpha 0.25, at most once per 8 s, off under reduced motion.

### Deviations

- D8 one-shot ceiling: design said creak and owl at most 10% of master. The owl was inaudible in use, so `ONESHOT_GAIN` is now 0.35 (about 0.09 absolute). The first one-shot plays 8 to 15 s after start, later ones 20 to 60 s, alternating owl and creak with the owl first. A suspended AudioContext is resumed again on the next key or pointer press.
- Phase 6 contrast: raw danger and magic tokens were below 4.5:1 as text. Token values were left alone and the components (LandingPage, Hud, QuestionPanel) now mix them with ink for text.
- Reduced-motion rows in the verification report are code and test based; browser checks are pending.

### Commits

- fcd6da6
- 86f256b
- 6202b78
- c824c3a
- Phase 6 and the owl fix are uncommitted at the time of writing.

### Test counts

- Before this run: at least 267 tests required as the baseline.
- After Phase 6: 64 files, 402 tests passing. Typecheck, lint and production build pass.

## Specs used so far

Spec folders under `.kiro/specs/` (all exist): frontend-00-playable-slice, frontend-03-phaser-core, frontend-04-rpg-ui-combat-flow, frontend-06-halloween-visuals, frontend-07-premium-ux-leaderboard. There are no frontend-01, 02 or 05 spec folders.

- frontend-00-playable-slice: React and Phaser scaffold, mock API, combat loop (commit 71ba32c, branch feature/game-engine, PR #1).
- frontend-03-phaser-core: five-room Phaser dungeon expansion (commit 198a482, PR #2).
- frontend-04-rpg-ui-combat-flow: continuous combat question flow and the RPG HUD and spellbook work on feature/frontend-rpg-polish (commits 847ab0a to 402f83b). The commit messages do not name the spec, so this mapping is by topic.
- frontend-06-halloween-visuals: see the entry above (commits fcd6da6 to 7184308, PR #3).
- frontend-07-premium-ux-leaderboard: spec added on feature/frontend-premium-ux. Phase 0 (housekeeping) run on this branch; later phases not started.

Sub-agents: spec-task-execution sub-agents are used, one per phase, for frontend-07.

## Property-based testing used

fast-check property test files that exist (11):

- src/api/mock/progress.property.test.ts
- src/art/pixelMap.property.test.ts
- src/audio/sfx.property.test.ts
- src/design/contrast.property.test.ts
- src/game/systems/flicker.property.test.ts
- src/game/systems/interaction.property.test.ts
- src/game/systems/objectPool.property.test.ts
- src/game/world/propPlacement.property.test.ts
- src/game/world/roomTheme.property.test.ts
- src/game/world/themeBudget.property.test.ts
- src/state/combatMachine.property.test.ts

## Hooks used so far

- `.kiro/hooks/frontend-lint-test-on-save.json` (frontend-07 Phase 0). This is the first hook in this project. No hook existed before it.
- Trigger `PostFileSave`, matcher regex on `frontend/src/**/*.ts|tsx`, command `cd frontend && npm run lint && npm run typecheck && npm test`, timeout 300 s.
- Format source: a web search of kiro.dev ("What's new in 1.0" hooks page) states hooks are standalone JSON files at `.kiro/hooks/*.json` replacing the old IDE `.kiro.hook` format, so no `.kiro.hook` copy was added. The docs page text itself did not render through the fetch tool (the hooks types page returned only a title). The exact field names (`version: "v1"`, `hooks[]` with `name`, `trigger`, `matcher`, `action {type: "command", command}`, `timeout`) come from the Kiro hook tool schema in this session and match an example hook file in a public gist found by the same search. There was no cwd field known, so the command uses `cd frontend &&`. The `&&` chaining needs a shell that supports it (cmd, bash, PowerShell 7). Not verified inside Kiro that the hook fires.
- Verified here: the JSON parses and the matcher regex matches `frontend/src/a/b.tsx` and an absolute Windows path, and does not match `backend/x.ts`.

## frontend-07 Phase 0 baseline (run in frontend/, before any frontend-07 code)

- `npm run typecheck`: pass.
- `npm run lint`: pass, no output.
- `npm test`: first run 64 files, 402 tests, 1 failed: `src/audio/sfx.property.test.ts` "Property 16: Sound mute gating" (seed -2109931452, counterexample ops unlock, play boss, play boss). Re-running that file alone passed (5 of 5), so the property test is flaky, with a rare random sequence failing (probably the boss cue under a random mute state). Not fixed here (no application or test code changes in Phase 0). Baseline: 402 tests in 64 files, 401 pass on the first run and 402 on a re-run of the file.
- `npm run build`: pass (tsc and vite build; main chunk 552 kB, phaser chunk 1194 kB).
- Other Phase 0 files: `.kiro/steering/frontend-ui-standards.md` (proposal, `inclusion: fileMatch` on `frontend/**`), and the PROPOSED CONTRACT section appended to `docs/handoff/B-to-A.md`.

## frontend-07 Phase 1: full-screen layout, premium shell and API foundation
- Flaky test fixed: `src/audio/sfx.property.test.ts` Property 16 stepped its fake clock by 1000 ms per play, but the `boss` cue has a 1500 ms rate limit, so two back-to-back boss plays were rate limited (seed -2109931452). The clock now steps 2000 ms (above every per-cue gap) and the counterexample is pinned as a fast-check `examples` regression. Mute gating assertions are unchanged.
- D1 RESIZE with a transparent canvas, D2 quarter-step zoom (`src/game/viewport.ts`), D3 full-viewport canvas with `set-view-inset` 0, D16 `zod@4.6.7` (exact, the only new runtime dependency), D17 shared contract suite, D25 API foundation in this phase.
- New `set-viewport` ToGameEvent is additive; `events.test.ts` lists every pre-existing event shape.
- Screen-space overlays (vignette, lightning, mist wipe, debug text) are refit on resize with `overlayRect` so they cover the viewport at any zoom.

### Phase 1 viewport verification
Zoom comes from `zoomForViewport` (run by `viewport.property.test.ts`). HUD mode is `hudMode(width)`. Frame rate, "bars visible" and visual checks were not measured here (no browser was driven); those cells are left for the user to read from `/play?debug=1`, which now shows viewport size, zoom, canvas size and HUD mode.

| Viewport | Zoom | World shown (w/zoom x h/zoom) | HUD mode | Letterbox bars | fps |
|----------|------|-------------------------------|----------|----------------|-----|
| 1366x768 | 1.5 | 911x512 | full | none (canvas = viewport) | to be read by the user |
| 1536x864 | 1.5 | 1024x576 | full | none | to be read by the user |
| 1920x1080 | 2.0 | 960x540 | full | none | to be read by the user |
| 2560x1440 | 2.75 | 931x524 | full | none | to be read by the user |
| 390x844 | 0.75 | 520x1125 | compact | none | to be read by the user |

## Phase 2: character-led encounter (frontend-07)
- `EncounterPopup` replaces the bottom `QuestionPanel` sheet. Scrim about 55 percent, original code-drawn portraits (Ghost, Vampire, Skeleton, Clockwork Golem, Witch, Exam Warden; 5 poses each) in `src/art/portraits/`, parchment speech panel, 2x2 `AnswerGrid`, 45 chars/s typewriter (full text exposed to assistive tech from the first frame; instant under Reduced_Motion).
- Mapping: paper_wraith to Ghost, toxic_slime to Witch, gear_golem to Golem, memory_eater to Vampire, exam_warden to Warden, anything else to Skeleton. Side alternates by room order parity (D5), boss from the right.
- `combatMachine` is unchanged. New additive ToGameEvents `encounter-open` and `encounter-close`; `set-view-inset` stays 0. Damage text comes only from `result.damage_dealt` and `player_hp_remaining`.
- `EncounterFxSystem` (light dim ack, static hit marker under Reduced_Motion, pools of one each) and a once-latch for `result-animation-done`. The wisp burst, curse flash and strike stay in the existing pooled `EffectsSystem` (24 sparks, unchanged budget).
- `QuestionPanel.tsx` and its test were deleted after the assertions moved to `EncounterPopup.test.tsx`.
- Not measured here: fps and particle counts from `?debug=1` for the encounter-open and result states (no browser session was driven for gameplay). Portraits were rendered once in headless Edge to check the art.

## Phase 3: weapons, criticals and boss phases (frontend-07)

Presentation only. `combatMachine`, damage values and the Event_Bridge boundary are unchanged; Phaser still imports nothing from api, demo, state, offline or leaderboard.

- 7.1 `src/weapons/weapons.ts` (`WEAPONS`, `resolveWeapon`, `weaponForLevel`, `armoryEntries`). `weapon_id` and `is_critical` were already on the schema, types and fixtures from Phase 1; the contract suite now checks them (well-formed, critical only after a correct answer) plus mock-specific checks (crit on streak 3, weapon by level, weapon list in progress). The mock sends the best weapon for the level (dagger L1, staff L2, crossbow L3, hammer L5, sigil L8), sets `is_critical` on streak multiples of 3 and keeps damage at 20. Dev-only `?mockLevel=N` (`src/api/mock/mockLevel.ts`) sets the mock level and is ignored outside dev builds.
- 7.3 `src/game/fx/weapons.ts` (pure descriptors) and `WeaponFxSystem` (pool of 16 Graphics, drawn once per acquire, only transforms tweened, additive blend so the strike reads through the 55 percent scrim): dagger X slash, staff violet bolt with ring, crossbow arrow with impact star, hammer ground shockwave with cracks (and a 90 ms shake), sigil floor glyph with six flame tongues. Reduced_Motion shows a static weapon-shaped marker. `EffectsSystem` plays the strike on a correct answer in place of the old spark projectile when the system is present.
- 7.4 Critical hit: the popup shows the backend `damage_dealt` as a damage number at 1.25rem, 1.875rem (1.5x) when critical, with a "Critical hit!" label (also the static marker for assistive tech). The scene adds a pooled white flash at alpha 0.35 plus a star pop, or a static star under Reduced_Motion.
- 7.5 `src/game/bossPhase.ts` and `src/game/lightning.ts` (`nextLightningAt`, spacing 8000 ms, peak 0.25, Infinity under Reduced_Motion). The existing frontend-06 boss lightning overlay in `AnimatedPieces` now schedules through `nextLightningAt`; no second overlay was created.
- 7.7 `BossPhaseSystem`: phase from the HP the backend sent, event `boss-phase-changed` (additive FromGameEvent). Enraged: red sprite tint, red aura and eyes, faint red screen tint, heavier lunge and roar (`Monster.roar`), two extra fog blobs and thicker base fog (not counted as particles), more frequent lightning (8 to 11 s apart instead of 8 to 20 s), stronger shake on a wrong answer. Reduced_Motion: tint only. `usePlaySession` switches `ambient.setEnraged` on that event: darker bed, quiet 55 Hz sub-drone at gain 0.03 (below the 0.05 bed ceiling), creaks only, still silenced by mute. Reverts on defeat, restart, victory or leaving the page.
- 7.8 `src/weapons/Armory.tsx` mounted in `PauseMenu` (lucide icons, lock icon plus text for locked). Mock progress now returns `weapons`.

### Phase 3 deviations

- Two existing assertions on `getProgress` used strict `toEqual` on `{ level, total_xp, xp_to_next }`; they now use `toMatchObject` because progress also carries the PROPOSED `weapons` list.
- The Exam Warden portrait intensity switch (optional) was not done.

### Phase 3 performance notes (no browser was driven here)

- Frame rate was not measured. Pooled object counts per effect, from the code: dagger 3, staff 3, crossbow 3, hammer 4, sigil 8 Graphics (pool max 16, plus 1 for a critical star, plus 1 flash rectangle). Enraged boss adds 2 fog ellipses and 1 tint rectangle, no sparks; ambient particles stay within `MAX_PARTICLES` 24. Read fps from `/play?debug=1` for each weapon with `?mockLevel=1,2,3,5,8` and for the enraged boss.

### Phase 3 test counts

- Typecheck, lint, build and `test:contract` pass. Full suite: 81 files, 541 tests (540 passed, 1 skipped).

## Phase 4: haunted memories / revenants (frontend-07)

Optional, display-first feature. `combatMachine` transitions, damage rules and the gate-open flow are unchanged; Phaser still imports nothing from api, demo, state, offline or leaderboard.

- 9.1 Contract: `DueReview` (PROPOSED), `ApiClient.getDueReviews(dungeonId)` over `GET /reviews/due?dungeon_id=` (bare array), zod `dueReviewsSchema`, fixture `dueReviews.json`, contract case (no answers in questions, known rooms, `due_review_count` agrees). `src/api/mock/mockReviews.ts` keeps a pure store: a question is due while its latest answer was wrong; with `VITE_MOCK_SEED_REVENANTS=true` the first 3 questions of every non-boss room are also due. The mock accepts an attempt on a due question after its room monster is dead: no damage, monster stays at 0, wrong costs 10 HP, correct clears the review.
- 9.3 Events (additive): `spawn-revenants` (ToGame), `revenant-engaged` and `revenant-rested` (FromGame), `RevenantSpawn` defined in `events.ts`. `RevenantSystem`: pool of 3 ghosts (code-drawn texture `revenant`: hooded translucent wisp-wraith, ragged hem, hollow face with two glowing eyes, question-mark rune, torn page; additive cyan glow under it, bob and pulse in `update` with no allocation), spawn only after the room monster is defeated, no collider so the gate is never blocked. Rest effect: the ghost rises and fades, 6 pooled sparks, soft `rest` chime (new cue, quieter than the others, respects mute); Reduced_Motion shows a pale ghost and one static marker. A wrong answer makes the ghost lunge; the scene routes `apply-result` to the system while a Revenant is engaged, so the room monster and its HP bar are never touched.
- 9.4 `usePlaySession`: after a non-boss room clear it fetches due reviews and sends up to 3 for that room (failures ignored). `revenant-engaged` opens the same encounter with the due review's own question; the popup (portrait `revenant`, 5 poses) speaks "The ghost of a question you forgot..." first. Answers use `submitAttempt`. The reducer gained `revenantActive`: a Revenant result copies only player HP, streak, XP and score, and `result-settled` never turns it into `monster_defeated`; `revenant-finished` returns to exploring. Counter drops locally on a correct answer, then progress is refetched.
- 9.5 `HauntedCounter` ("Haunted memories due", polite live region, icon only plus sr-only label in compact mode) is in the Hud and exported for the Dashboard.

### Phase 4 performance notes (no browser was driven here)

- Pooled objects with 3 Revenants present, from the code: 3 ghosts x 2 images (body, glow), 1 prompt text; during a rest at most 6 sparks plus 1 marker (Reduced_Motion). Ambient particles are unchanged (within `MAX_PARTICLES` 24). `/play?debug=1` now also prints `revenants N ghosts, M fx`. Frame rate was not measured; read fps from the debug line with `VITE_MOCK_SEED_REVENANTS=true`.

### Phase 4 test counts

- Typecheck, lint, build and `test:contract` pass. Full suite: 85 files, 567 passed, 1 skipped (the HTTP contract case needs a backend).

## Phase 1A: real-backend matching (frontend-08, tasks 3.1, 3.2, 3.3 and the wire/contract part of 3.18)

Scope set by the user: make the existing 5-room game playable against Person A's real backend. Floors, pools, fixtures for 1/3/10/25 floors and the `/dev/floors` route (3.4 to 3.17) are Phase 1B and were not started. Nothing under `backend/` was changed; backend code was read only. No commit, no push, no new dependency.

### What was built

- **Wire layer (3.1, D15).** `src/api/wire/{kinds,dungeon,run,attempt,progress,reviews,auth,index}.ts`: wire zod schemas plus pure mappers for dungeon (C2 to C6), run start and `GET /runs/{id}` (C8, C21), attempt (C10), room clear (C17), finish (C15), progress (C14), due reviews (C20) and the auth bodies (C22). `kindFromMonsterType` (C5) matches keywords, a boss is always `exam_warden`, an unknown name gets the default look. Questions are flattened from `rooms[].questions[]`; `type` is derived from the options; the monster id is `monster-<room id>`.
- **Http_Client (`src/api/client.ts`).** Validates every body with the wire schemas, returns domain values, and keeps `ContractError` naming the endpoint and field (for example `rooms[0].monster_hp`). It remembers what the wire does not repeat: monster HP per room (the backend's attempt response always sends `monster_hp_remaining: 0`, so the client computes HP minus `damage_dealt`), the last score (for `score_delta`), and the first response per `attempt_id` (so a retry returns the same value). `ApiClient.getRun(runId)` added (also in the mock). `ApiClient.capabilities` added (D26); the Http_Client reports `roomRevenants`, `floors`, `modes`, `dailyHaunt` all false.
- **Errors (`src/api/errors.ts`).** `ApiError.code`, `parseErrorBody` for `{detail:"text"}`, `{detail:{code,message,errors?}}` and the 422 array form, and `friendlyMessage` for `BOSS_NOT_CLEARED`, `MONSTER_ALIVE`, `RUN_FINISHED`, `OUT_OF_ORDER_ROOM`, `ROOM_ALREADY_CLEARED`, `UNKNOWN_WEAPON`, `WEAPON_LOCKED`, `QUESTION_NOT_FOUND`, `GUEST_FORBIDDEN`, `VALIDATION_ERROR`, plus 401 (guest session expired) and 429. `describeError` uses it, so the existing UI messages become friendly with no UI change.
- **Optional fields.** `xp_delta`, `source`, `review_status` (attempt), `xp_to_next` (progress) are optional in types and schemas; new optional `evidence_quote`, `mastery_band`, `difficulty`, `unlocked_weapons`, `Run.score/streak`, `AttemptRequest.weapon_id`, `ClearRoomResponse.is_boss`. The reducer adds `xp_delta ?? 0`. `SourceLine` shows `From your notes: "<evidence_quote>"` when there is no page and renders nothing when there is nothing to cite. The HUD shows `Total N XP` when `xp_to_next` is absent.
- **Config.** `readFlags()` reads `VITE_API_BASE`, falling back to `VITE_API_BASE_URL` (the first non-empty one). `frontend/vercel.json` has the Day 3 rewrite (`/api/:path*` to `https://studydungeon-api.onrender.com/:path*`) plus a catch-all to `/index.html` for deep links. `.env.example` documents both names.
- **Real-mode gameplay.** Weapon names map to our ids (`weaponIdFromName`); the client sends `weapon_name` (the best weapon listed in `unlocked_weapons` from `GET /progress`, the Rusty Dagger otherwise, and a one-time fall back to the dagger on `WEAPON_LOCKED`/`UNKNOWN_WEAPON`). The result carries the sent weapon as `weapon_id`, so the strike animation matches. Room Revenants: `usePlaySession` skips `spawn-revenants` when `capabilities.roomRevenants === false` and still loads the due count from `GET /reviews/due` (at run start and after each clear). The Armory uses the real unlock rules as text (`Locked: Earn 100 XP`). The question cycling (`questionSelector`) is unchanged: in real mode the question set and its order are the backend's `rooms[].questions[]`.
- **HP never hard-coded.** Checked `src/game` and the UI: Phaser reads `max_hp` from the room data (`Monster.maxHp`), `bossPhase(hp, maxHp)` uses the received maximum (the comment that mentioned 60 and 120 was fixed), the HUD and reducer take the values they are given. `demo/rules.ts` kept `MAX_MONSTER_HP = 60` only as the legacy default of `INITIAL_STATE`; no room uses it.
- **Guest flow.** `POST /demo/session` then the public demo dungeon id from the response; `GUEST_FORBIDDEN` and 401 map to friendly messages.

### Mock and demo balance (3.2): numbers that changed

| Item | Before | After |
|------|--------|-------|
| Demo monster HP (rooms 1 to 4) | 60, 60, 60, 60 | 80, 90, 85, 85 |
| Exam Warden HP | 120 | 220 |
| Weapon damage | 20 for every weapon | Dagger 20, Staff 25, Crossbow 30, Hammer 35, Sigil 40 |
| Hard questions (mock: b2, b4, b6, b8) | no multiplier | x1.25 |
| Critical hit | flag only on streak 3, 6, 9; damage unchanged | x1.5 from the third correct answer in a row (streak before >= 2), like the backend; rounding half to even |
| Weapon unlock | by level (L1, L2, L3, L5, L8) | Staff at 100 XP, Crossbow after clearing 2 rooms, Hammer at level 3, Sigil after a boss clear |
| Weapon the mock strikes with | best for the level | best unlocked by the real rules |
| Mock progress weapons list | `unlock_level` 1, 2, 3, 5, 8 | unlocked: 1; locked: level + 1; plus `requirement` text and `unlocked_weapons` |

Presentation kept working: the boss enrage line is half of the boss's own max HP (110 of 220); `showMonster`, the HUD bars and the Phaser bars read the data.

### Existing tests whose expected numbers changed because of the contract

- `src/demo/demoDungeon.test.ts`: HP list `[60,60,60,60,120]` to `[80,90,85,85,220]`.
- `src/api/mock/mockAdapter.test.ts`: Property 5 max monster HP bound 120 to 220; `startRun` monster HP 60 to 80; the "owning room" test 40 and 40 to 70 and 60 (room 2: 90 minus 20; room 1: 80 minus 20); `clearRoom` tests, finish, playthrough and the boss test now kill a room by answering until `monster_hp_remaining` is 0 (damage varies with crits, hard questions and weapons) instead of `ceil(hp / 20)` hits; finish test expects `correct = hits`, `total = hits + 1`, `score = 100 * hits`, `xp = 10 * hits + 100`; "boss 120 HP, 6th hit" became "boss 220 HP: each strike lowers it by the damage dealt".
- `src/api/mock/mockRun.boss.test.ts`: setup 120 to 220; "falls after exactly 6 correct answers" to "falls when the damage adds up to 220" (at least 3 hits, the strongest strike is 75).
- `src/api/mock/mockRun.invariants.test.ts`: the HP drop is the reported `damage_dealt` instead of a fixed 20.
- `src/api/mock/mockReviews.property.test.ts`: the room-1 monster now needs 4 correct answers (20, 20, 30, 30) instead of 3.
- `src/contract/mock.contract.test.ts`: crit test now `[false,false,true,true]` with damage `[20,20,30,10]`; unlock-by-level test replaced by the real rules (hammer at level 3, staff at 100 XP, crossbow after 2 clears); progress weapon list test updated.
- `src/pages/PlayFlow.smoke.test.tsx`: monster bar 60 to 80, first hit 40 to 60, room 1 needs 4 answers instead of 3 (two tests plus the "clears room 1" test).
- `src/pages/PlayFlow.revenant.test.tsx`: the fight is correct x3, miss the fourth, correct once more (80 HP); the missed question is `q4`, so the test advances 500 ms before engaging the Revenant so the pop-up has unmounted and shows the intro line (the intro shows only on a fresh mount; a pre-existing quirk, the old test passed because the missed question was the popup's first one).
- `src/api/client.test.ts`: rewritten against real wire bodies (the Http_Client no longer accepts domain-shaped bodies); the attempt body now has `weapon_name`.
- `src/api/schemas.property.test.ts`: Property 22 keeps the domain round trip and field failure, and no longer goes through the Http_Client (that part moved to `wire.property.test.ts`).
- Type-only edits (`?? 0` / `?.`) in `mockAdapter.test.ts`, `mockRun.summary.test.ts`, `combatMachine.property.test.ts`, `runReducer.test.ts`, `runReducer.victory.test.ts` because `xp_delta` and `source` are now optional.

### New tests

- `src/api/wire/wire.test.ts`: mapper tests on `docs/handoff/demo_dungeon.sample.json` (HP 80, 90, 85, 220; kinds; no answer leakage), on the real-shape samples in `wire.fixtures.ts`, the auth bodies, error bodies, and a check that every `required` property of the matching `docs/openapi.json` component is present in our samples.
- `src/api/wire/wire.property.test.ts` (3.3, Property 1, validates Requirements 1.2, 1.3, 1.4): mapped values pass the domain schemas; HP and ids come from the data; removing or retyping a required field makes the client throw a `ContractError` naming the endpoint and path.
- `src/contract/suite.ts` asserts domain shapes (HP from the data, boss toughest, `getRun`, optional `xp_to_next`, `room_id` may be empty for another dungeon's review). `http.contract.test.ts` runs it against the real API when `VITE_API_BASE` (or `VITE_API_BASE_URL`) is set and `VITE_USE_MOCKS` is not `true`.
- Smaller: `SourceLine.test.tsx`, Hud tests (no `xp_to_next`, 220 HP boss), `bossPhase.hp.test.ts`, and a PlayFlow test that real-mode capabilities spawn no Revenants but keep the counter.

### Real backend check

`GET http://localhost:8000/health` was tried once: not reachable. The contract suite was therefore not run against a real backend. The mock contract suite and the mapper tests pass.

### Test counts

- Typecheck, lint and build pass. `test:contract`: 1 file passed (14 tests) and 1 skipped (the real-backend file). Full suite: 90 files passed, 1 skipped; 654 tests passed, 1 skipped.
- Not verified: any run against Person A's backend (no backend was reachable), and no browser was driven.
