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

## Phase 1B: floors data model and mock campaign (frontend-08, tasks 3.4 to 3.17, rest of 3.18, 3.19)

Branch `feature/frontend-campaign`. Frontend only, mock mode is the target (`VITE_USE_MOCKS=true` in `.env.local`). Not committed.

What changed:

- Domain model and schemas (additive): `Floor`, `FloorStatus`, `FinalBoss`, `TopicInfo`, `RunMode`, `FloorRank`, `MasteryBand`, `StartRunRequest`, `DueReviewsResponse`, `GenerationStatus`, `ChestReward`, plus optional attempt (`requeue_after`, `is_retry`, `retry_multiplier`, `combo`, `correct_answer`), finish (`floor_rank`, `mastery_by_topic`, `chest_rewards`), run (`mode`, `run_seed`, `revenants`) and progress fields.
- ApiClient: `startRun(string | StartRunRequest)` (old callers unchanged), `getDueReviews()` new shape with the old `getDueReviews(dungeonId)` bare array kept as a thin adapter, `getGenerationStatus`, `retryFloor`.
- Http_Client: legacy mapping (no `floors` gives one Floor "The Crypt", D17), capabilities start all off and `floors` turns on only when the backend sends floors (D26), `startRun` still sends only `{dungeon_id}` (D18), `retryFloor` rejects with 501.
- Mock: exactly 2 Floors plus the Final_Boss (D13), floor-scoped runs with mode and seed, floor locking, rank/mastery/chest on finish, second chance (half damage and XP, requeue hint, `correct_answer` after a miss) for runs started with a request only, Daily Haunt summary and run, generation status and `retryFloor`, optional `failedFloorIds` switch.
- Pure modules: `seededRng`, `pool`, `draw`, `requeue`, `mockMastery`, `mockGeneration`, `mockFloors`, `mockHaunt`, `src/learning/{mastery,rank}.ts`, `src/haunt/hauntSelection.ts`.
- Fixtures with 1/3/10/25 floors (test and DEV route only) and the lazy `/dev/floors` route registered only when `import.meta.env.DEV`.
- Tests: property tests for Properties 2 to 10 (100 runs each), mock campaign tests, Http_Client floor tests, contract suite cases (floors, mode start, generation status, new due shape, finish additions), extended import boundary (campaign, learning, haunt, rewards, tutorial), `realModeBoundary.test.ts` (real mode loads no mock module, fixtures unreachable outside the DEV page), dev route test (present with DEV true, absent with false).

Verification (real output, frontend/):

- `npm run typecheck`: clean.
- `npm run lint`: clean.
- `npm test`: 101 files passed, 1 skipped; 703 tests passed, 1 skipped (was 576 before frontend-08).
- `npm run test:contract`: 19 passed, 1 skipped (the HTTP suite, which needs a real backend).
- `npm run build`: succeeded; no DevFloors chunk, and the strings "Sample question", "Floor fixtures" and "/dev/floors" are absent from `dist`.

Deferred: floor map UI, per-floor play wiring and generation polling (Phase 2); migrating the HUD counter off the bare-array due method (Phase 3).

## Phase 2: floor map and campaign flow (frontend-08, tasks 5.1 to 5.11)
Branch `feature/frontend-campaign`. Frontend only, mock mode is the target. Not committed.
What changed:
- Pure logic `src/campaign/floorLayout.ts` (`layoutFloors`, `visibleRange`, `nextFocus`, `nextPlayable`, path segments and chunks) and `floorRooms.ts` (`floorDungeon`: one Floor's rooms, renumbered 1..n, last room is the boss, ids unchanged).
- UI, DOM and SVG only: `FloorMap` (winding glowing path in 5-segment chunks, windowing above 12 nodes, roving tabindex with arrows/Home/End/PageUp/PageDown/Enter, Continue, header "Your notes became N floors", empty state, live region), `FloorNode` (stone seal with `MasteryBar` ring, boss icon, rank seal, status chip, spinner, Retry), `FinalBossNode`, `FogOverlay` (gradient layers, CSS transform drift, static under Reduced_Motion), `src/learning/MasteryBar.tsx`, `src/styles/campaign.css`.
- `useGenerationStatus`: polls every 2.5 s only while a floor is generating, pauses on hidden tabs, stops at terminal status, gives up after 10 minutes with a Retry; polite announcements.
- Flow: landing "Try the Demo" goes to `/campaign/:dungeonId` (`CampaignPage`, refetches on every visit). A floor opens `/campaign/:dungeonId/play/:floorId`, which runs the existing `PlayPage` with `usePlaySession({dungeonId, floorId})`: `startRun({dungeon_id, floor_id, mode:'floor'})`, only that Floor's rooms go to Phaser (no `src/game` change needed; the layout already accepts any room subset), the Floor_Boss is the boss room, "Room X of Y" counts inside the floor. Boss cleared finishes the run, shows the victory overlay (title and buttons set for the floor), "Back to the map" refetches. Final_Boss uses the same path. A rejected start returns to the map with the Backend or mock message. `/play` still plays the whole dungeon.
- Real mode: single legacy Floor "The Crypt"; header, mastery ring and Final_Boss are hidden when `capabilities.floors` is false.
- `/dev/floors` now renders the real FloorMap on fixtures (1/3/10/25), with simulated generation and `fail=1` to force a failure and try Retry.
- Tests: Properties 11 to 13 (100+ runs), FloorMap examples (status rendering, fog, Retry, Continue, keyboard, windowing, poller), campaign flow with the mock, floorRooms and layout subset tests, contrast checks for the new map text, dev route test updated. Tests of the play experience itself now enter through `OpenLegacyPlay` (`/play`) because the landing page leads to the map.
Visual check (headless Edge over CDP, temp files deleted): `/dev/floors?floors=3`, `?floors=25` (top, middle, end) and the demo map at 1366x768, 1920x1080 and 390x844. Fixed after inspection: hard-edged square in the fog (removed the tiled noise image) and overflowing plates for summoning/failed floors on narrow screens (shorter text, Retry beside the chip).
Verification (real output, frontend/): typecheck clean; lint clean; `npm test` 105 files passed, 1 skipped, 740 tests passed, 1 skipped (was 703); `npm run test:contract` 19 passed, 1 skipped; `npm run build` succeeded.
Measured map fps at 25 floors: not measured (no GPU profiling in headless mode). At most about 8 nodes and 2 path chunks render at once; motion is CSS transform/opacity only.
Deferred: floor bosses use the Exam Warden look in Phaser (boss style is keyed on the boss flag); a real legacy floor never shows "cleared" because the Backend has no floor status; scorecard redesign (frontend-07 P5).

## frontend-07 Phase 5: scorecard, leaderboard, dashboard (tasks 11.1 to 11.10)

Resumed after two cancelled runs. Most files already existed and were uncommitted; nothing was restarted or duplicated. Audit of the tree: all Phase 5 modules were present and complete, so no source change was needed. Frontend only, mock mode, no new dependency, no commit or push.

What exists, by route:
- Scorecard (`src/scorecard`, replaces the VictoryOverlay content after a floor, the final boss or a /play run; sample at `/dev/scorecard` in development only): score count-up, accuracy ring, XP bar with level-up effect, weapon unlocked, badges earned (catalog and icons), mastery bars, S/A/B/C floor rank reveal, weak concepts with source, chest rewards, buttons (Back to the map, Play again, View leaderboard, Share card disabled with a tooltip until Phase 7, Create account for guests), error state with Retry, instant under reduced motion, aria-live announcements.
- `/leaderboard` (`src/leaderboard`): readable by guests, All-time and This week tabs, top-3 podium, rows, pinned "me" row, provisional guest rank with a call to action, 8 "Ghost Rival - demo" entries, 30 s poll only while mounted and visible, skeleton, empty and error states, honest "coming soon" in real mode. Comparator, provisional insert and view are pure functions with property tests.
- `/dashboard` (`src/pages/DashboardPage.tsx`, `src/dashboard`): level and XP, Continue to the next playable floor, Play Demo, top-5 preview, recent runs, HauntedCounter, badges grid, Armory, mastery bars, upload and settings placeholders, Daily Haunt slot, guest variant, skeletons, error cards with Retry. Linked from the landing page and the campaign map header.
- Contract cases for the leaderboard are in `src/contract/suite.ts` and run in `mock.contract.test.ts`.

Verification (all green): typecheck, lint, `test:contract` (20 passed, 1 skipped real-HTTP), build.
Grouped runs: api+contract 187 passed 1 skipped; game 158; components/encounter/art/audio/design/weapons/shell/demo/config 299; leaderboard/scorecard/dashboard/badges/learning/haunt 56; pages/campaign/state 115.
Full `npm test`: 115 files passed, 1 skipped, 815 tests passed, 55.6 s. It completes.

Hang finding: the full suite did not hang in this run and no file stalled. Every file creates its own jsdom (116 environments, about 400 s of summed worker time, 75% of the run), so the run looks stalled when the output is a long wall of progress lines or when it is run from a slow terminal. No real-timer leak was found in the leaderboard poll or the generation poll: both tests use fake timers and the hooks clear their intervals on unmount. Possible mitigation (not applied, config change): `pool: 'vmThreads'` or sharing the jsdom environment.

Deferred: Share card (Phase 7). No screenshot checks were done.

## frontend-07 Phase 6: auth and offline demo fallback (tasks 13.1 to 13.9)

Frontend only, mock mode is the target, real mode compiles with the real auth shapes. No new dependency, no commit or push. Built on the uncommitted Phase 5 and frontend-08 P1-P2 tree (floors, map, scorecard, leaderboard, dashboard); none of that was redone.

Auth (13.1 to 13.4):
- `ApiClient` gained `register`, `login`, `logout`, `getMe` (types `Credentials`, `AuthMe`). Http_Client uses the real bodies (C22): register 201 bare user, login 200 bare user, logout 200 `{success:true}`, `GET /auth/me` bare user with `expires_at` (401 gives null). Wire schemas are in `src/api/wire` (`WIRE_ENDPOINTS` register, login, logout, getMe); domain schemas and fixtures (`user.json`, `me.json`) added.
- `ApiError` now carries `retryAfter` (raw header) and `fields` (the FastAPI 422 array, C24). One existing assertion in `wire.test.ts` was extended for `fields`.
- `src/api/mock/mockAuth.ts`: in-memory user table with the Backend rules; 401, 409, 422 (array detail), 429 with Retry-After (5 wrong passwords, or the name `ratelimit`), 500 (`servererror`). A demo session counts as a session for `getMe`.
- `src/auth/`: `validation.ts` (C23: username 3-32, letters/digits/underscore, lowercased, not `guest_` or `system` prefixes; register password 8-128; login non-empty), `errors.ts` (`mapAuthError`, friendly text for 401/409/422/429/5xx/network), `retryAfter.ts` (default 10 s), `useRetryAfter.ts`, `AuthForm.tsx`, `LoginPage.tsx`, `RegisterPage.tsx` (replace and delete `LoginPlaceholder`). Two fields, show/hide toggle, field messages, status area, submit disabled and counting down during Retry-After, success goes to `/dashboard`. Cookie session only: tests assert localStorage and sessionStorage stay empty after login and register.
- `SessionContext` calls `getMe` on load (a session set meanwhile wins; failures leave the user signed out) and has `setUser`, `restoring`.
- "Create account" calls to action now go to `/register` (guest banner link, scorecard, leaderboard, dashboard). Two existing tests were updated for this (DashboardPage, LeaderboardPage: `/login` became `/register`). Dashboard has a Log out button for signed-in players.
- Contract: auth cases added to `src/contract/suite.ts` (register, 409, 422, login 401/200, me, logout); run for the mock and, with a backend, for the real client.

Waking up and Offline demo (13.5, 13.6):
- `src/pages/WakingUp.tsx` (title "Waking up the dungeon...", 8 rotating tips) is shown on the landing page and the dashboard while `POST /demo/session` is pending.
- `useStartDemo.ts` was extended (not duplicated; `useDemoStart.ts` re-exports it): after 8 s it sets `offerOffline` while the request continues; `chooseOffline` does the only dynamic `import('@/offline')`, installs the adapter with the new `setApiOverride` in `src/api/index.ts`, and opens the map. A late success or failure after that is ignored.
- `OfflineLabel` (in `App`) shows "Offline demo - progress is not saved" while an override is installed. Guest banner text unchanged.
- Dev-only `VITE_MOCK_DELAY_MS` delays only the mock `startDemoSession` (documented in `.env.example`).
- `src/offline/`: `index.ts` (`createOfflineAdapter`, injectable clock and ids), `adapter.ts`, `rules.ts` (wraps `src/demo/rules.ts`), `rivals.ts` (8 Ghost Rivals), `demoDungeon.json` (from `docs/handoff/demo_dungeon.sample.json`: Floor 1 = CPU and Storage, Floor 2 = Networking, Final_Boss = The Exam Warden 220 HP). It serves the floors surface (floors, scoped `startRun`, requeue, `floor_rank`, `mastery_by_topic`, chest rewards) and works on the campaign map.
- To avoid duplicating rules and keep the offline chunk free of mock code, the pure helpers moved from `src/api/mock` to `src/learning`: `seededRng`, `draw`, `requeue`, `masteryStore` (was mockMastery), `floors` (was mockFloors), plus a new `level.ts` (level formula, was inline in the mock). Imports and their tests were updated; `buildFloors` takes an optional `finalBossRoomId`.

Tests (13.3, 13.7, 13.8): `auth.property.test.ts` (Property 17), `offline.property.test.ts` (Property 18 against an independent reference model, Property 19 determinism with `Math.random` forbidden), `src/test/boundary.test.ts` (no static import of `src/offline`; the single dynamic import sits in `chooseOffline`; offline imports no mock; no `Math.random`; real mode loads no mock or offline; no browser storage in auth/api/session), `importBoundary.test.ts` extended (`auth`, `pages`; `offline` and `leaderboard` were already forbidden), palette contrast pairs for the new text, plus unit tests for the forms, mock auth, Http_Client auth, the loader, the 8 s offer and the offline adapter (contract suite and campaign map).

Verification (all green): typecheck; lint (needed `.shots/**` and `tmp-shot.mjs`, leftover screenshot artifacts from an earlier session, added to the ESLint ignores because `eslint .` was reading a 34k-error browser profile); `test:contract` 25 passed, 1 skipped (real HTTP); build (separate `offline-*.js` chunk, 14 kB, loaded only from the choice handler). Full `npm test`: 125 files passed, 1 skipped; 909 tests passed, 6 skipped (the real-HTTP contract and the offline suite's auth cases), about 80 s.

Deferred: offline weak concepts use the room number as the "page" (the sample has no page numbers); offline plays with the Rusty Dagger only and has no reviews or Daily Haunt (capabilities off); a real-backend run of the auth contract cases was not done; no browser check was done.

## Phase 3: Daily Haunt and run modes (frontend-08, tasks 7.1 to 7.8)

Frontend only, mock mode is the target. No new dependency, no commit or push. A previous attempt failed on a network error; its partial files under `src/haunt` were audited and continued, not duplicated.
- 7.1: `getDueReviews()` returns `{due_count, next_due_at, daily_streak, items}` in the Http_Client mapper, the mock and the offline adapter. The HUD `HauntedCounter` and `usePlaySession` read the summary. A thin adapter stays only where it is still needed: the `getDueReviews(dungeonId)` overload that returns the bare array for the per-room Revenant spawn mapping.
- 7.2: `/haunt/:dungeonId` (`HauntPage`) starts `startRun({dungeon_id, floor_id: null, mode: 'daily_haunt'})` and reuses the play flow. `hauntHall.ts` builds the Haunted Hall (display-only room id, one Revenant per due item) through `spawn-revenants`, with `revenantLook`, `RevenantSystem`, the portrait, intro line and rest effect. The player walks up to each ghost and answers in the EncounterPopup. The exit opens when every ghost is laid to rest. New events are additive, and Phaser imports no api or state. The mock accepts attempts in `daily_haunt` runs and serves at most 8 items; the UI shows whatever arrives. Real mode and the offline demo hide it through capabilities with an honest "coming soon".
- 7.3: `HauntFinale` shows "N memories laid to rest" and the backend `daily_streak`, with celebration effects that are static under reduced motion. Buttons go to the dashboard and the map.
- 7.4: `DailyHauntButton` (due count and streak) sits in the Dashboard slot (`DashboardHaunt`) and the `CampaignPage` header. When nothing is due, `HauntCelebration` shows the next due time, worded honestly.
- 7.5 and 7.6: `ModePicker` (Weak Topics, Exam, Replay Floor) maps to `startRun` bodies through `modes.ts`, reachable from the map and the dashboard (`ModePickerButton`). `ExamTimer` is off by default with 10, 20 and 30 minute options, polite announcements at 5 and 1 minute, no pulse under reduced motion, and `finishRun` at zero. Replay lists only cleared floors. All modes reuse the campaign play flow (`ModePlayPage`) and return to the map with the scorecard. The mock supports each mode: `weak_topics` picks the lowest-mastery topics, `exam` covers every topic.
- 7.7: tests in `src/haunt` (`haunt.test.ts`, `HauntFlow.test.tsx`, `ModesFlow.test.tsx`, `motion.test.tsx`, `hauntSelection.property.test.ts`) and `mockModes.test.ts`: only due items, empty state with next due time, finale text, mode bodies, timer off by default, keyboard-only completion.
- Test stability: the full suite showed 1 to 3 timeouts per run, a different test each time, all in the first test of a file with a cold lazy chunk. Each passed alone. Fixed with `maxWorkers: 4` and a new `src/setupTests.ts` (RTL `asyncUtilTimeout` 8 s and a longer default for `vi.waitFor`).
Verification (all green): typecheck; lint; `test:contract` 25 passed, 1 skipped (real HTTP); build; full `npm test`: 130 files passed, 1 skipped; 943 tests passed, 6 skipped.
Deferred: no browser check was done; the real Backend has no Daily Haunt or run-mode support, so those stay behind capabilities.

## Phase 4: learning loop (frontend-08, tasks 9.1 to 9.8)

Frontend only, mock mode is the target. No new dependency, no commit or push. The tree held no partial Phase 4 files (`git status` showed none of MemoryScroll, RequeueNotice, ProgressPanel, StreakCalendar or an honest-copy test), so everything below is new. Floors, mastery, scorecard, dashboard, haunt and the EncounterPopup were reused.

What changed:
- 9.1 Second chance. `runReducer` gains `pendingRequeue` (pure helpers in `src/state/pendingRequeue.ts`). A wrong result with a numeric `requeue_after` adds `{questionId, remaining}`; each ordinary question presented counts every entry down by one; an entry at 0 is presented next, through the same `usePlaySession` selection (`chooseQuestion`), with the "Second chance" tag. The gap is only copied from the response, never computed. `RequeueNotice` ("The question returns...", with "After N more questions." or "It is the next one.") shows on later questions and inside the scroll. `combatMachine` transitions are untouched.
- Decision: if the room monster dies before the return is due, the pending question is dropped (the reducer clears it on `room-cleared` and on entering another room). It is not carried to the next room: the monster that asks it is gone, and a question from another topic would confuse the mastery shown. Several misses can wait at once (an array, not one slot) so none is lost.
- 9.2 `MemoryScroll` (`src/learning`): CSS parchment between two rods, unrolled top to bottom in 450 ms (instant under Reduced_Motion, in-app and OS). It shows `correct_answer` when present, the explanation, the quote and "From your notes: page X" (reusing `SourceLine`; the quote gets its own line when a page exists), then Quick retry and Continue. A polite live region is filled after mount; focus goes to Quick retry (to Continue when no retry is possible, for example when the player has fallen). It lives inside `.sd-speech__scroll`, which already keeps clear of the portrait. Quick retry (`quickRetry` in `usePlaySession`) asks the same question again with a new attempt id and cancels its pending return.
- Behaviour change, deliberate: a wrong answer no longer auto-advances after 2000 ms. A timed dismissal would take the scroll away before it can be read (WCAG 2.2.1), so the player chooses Quick retry or Continue (Enter/Space on the focused button). Correct answers still auto-advance after 1200 ms. Two existing tests encoded the old wrong-answer timer and were updated: `PlayFlow.smoke` (wrong answer) and `PlayFlow.revenant` (clicks Continue after the miss).
- 9.3 Retry rules: `src/learning/retryRules.ts` words `retry_multiplier` ("Retry: half damage" for 0.5, "full damage" for 1, "N percent damage" otherwise; "Second chance" when `is_retry` has no multiplier). Damage and XP are shown as received. `realModeBoundary.test.ts` now also proves that no screen, hook or reducer imports `offline/rules`, `demo/rules` or the learning requeue/draw/mastery/seed/rank modules, and that the display files contain no retry constants or multiplication.
- 9.4 Mastery bars: the Scorecard topics and the Dashboard topics already used `MasteryBar` with band labels; the gap was the floor map. Ready and cleared nodes now show per-topic bars with band labels in a tooltip on hover or focus (`aria-hidden`; the seal label already speaks the average).
- 9.5 Progress panel: `ProgressPanel` and `StreakCalendar` (a table, weekdays down, 12 weeks across; each day has a text label, reviewed days also carry a check mark). Four blocks (notes conquered, memory strength, review streak, weakest concepts with page refs) each hide when their field is absent; the panel itself disappears when none is present. It is a card on the Dashboard (player and guest views). The mock supplies the PROPOSED fields (`src/api/mock/mockProgress.ts` plus `getProgress`); memory strength follows the mock EMA mastery, the calendar follows the Daily Haunt streak.
- 9.6 `src/learning/honestCopy.test.ts` scans `learning`, `haunt`, `campaign`, `scorecard`, `dashboard` and `tutorial` (no tutorial folder exists yet) for banned phrases (guarantee, never forget, will remember, 100% memor, remember forever and a few close variants). No copy failed.
- 9.7 Tests: `learningLoop.test.tsx` (scroll with and without `correct_answer`, whisper, pending-return helpers and reducer, retry wording, band labels, panel blocks hidden, scroll inside the panel scroller, four viewports with the existing `stageLayout` math), `LearningLoop.flow.test.tsx` (miss, scroll, focus on Retry, polite announcement, whisper, return after 3 questions with the Second chance tag, "Retry: half damage" from the response, Quick retry, keyboard Tab/Enter), `FloorTopics.test.tsx`, `mockProgress.test.ts`, a Dashboard test for the panel, and palette checks (scroll text on every parchment tone, whisper, tag, calendar, tooltip).

Real mode: `requeue_after`, `is_retry`, `retry_multiplier` and `correct_answer` are all optional; absent fields hide their line, and no reward or gap is computed locally.

Results (run in `frontend/`):
- `npm run typecheck`: pass. `npm run lint`: pass.
- `npm test`: 135 files passed, 1 skipped; 990 tests passed, 6 skipped (HTTP contract cases that need a backend).
- `npm run test:contract`: 25 passed, 1 skipped.
- `npm run build`: pass.

Not verified: no browser was driven, so the scroll's look and the portrait clearance at 1024x635, 1366x768, 1920x1080 and 390x844 were checked with the `stageLayout` geometry and the CSS rules, not on screen. No real-backend run.
Deferred: a `/progress` route (the Dashboard card is the entry point); carrying a pending question to the next room; a tutorial step for the Memory scroll (Phase 6).

## Phase 5: game feel and ranks (frontend-08, tasks 11.1 to 11.12)
Frontend only, mock mode is the target. No new dependency, no commit or push. A previous attempt died on a network error; `git status` showed it had already written most of Phase 5 (effectPlan, comboTier, ComboMeter, HitStopSystem, BossDeathSystem, LootBurstSystem, frameStats, ChestOverlay, chestView and their tests, plus wiring in GameScene, EffectsSystem, Monster, Player, usePlaySession, Hud, Scorecard, FloorNode, sfx). This run reviewed that work, did not duplicate it, and filled the gaps.
What exists:
- 11.1 `src/game/fx/effectPlan.ts` `planHit` (pure, no Phaser import, returns shared frozen plans so a hit allocates nothing). Reduced motion gives all zeros. Hit-stop 60 ms and shake 140 ms only on criticals and boss kills; flash is a single flash, alpha capped by `FLASH_ALPHA_MAX` 0.35.
- 11.3 `comboTier` (tiers at 3/5/8/12: Combo, Hot, Blazing, Legendary) in `src/game/fx/comboTier.ts`, re-exported from `src/learning/combo.ts`. HUD `ComboMeter` shows `combo ?? streak`, escalates by border, glow, pips and name, has an aria-label, and is static under reduced motion. Additive `set-combo` event tints the player aura.
- 11.5 `HitStopSystem` (one reusable slot, tween and anim time scale, restored on the wall clock), camera shake, monster knockback and snappier damage pops, all from `planHit`.
- 11.6 `BossDeathSystem` (pooled sparks, max 60; one shake, one flash at 0.35 max; dissolve; about 900 ms; 200 ms fade under reduced motion) and `LootBurstSystem` (pool of 24). Additive events `play-boss-death`, `loot-burst`, `boss-death-done`. The Scorecard and Chest wait for `boss-death-done` with a fallback timeout. New synthesized cues `bossfall` and `loot` in `sfx`, quiet, respecting mute.
- 11.7 Floor rank letter on the Scorecard seal and the cleared map node, from `floor_rank` only; hidden when absent.
- 11.8 `ChestOverlay` (framer-motion, lists exactly `chest_rewards`, skipped when empty or missing, Collect focused, focus trapped, Esc closes, static under reduced motion).
- 11.2, 11.4, 11.9 property tests: Property 16 and Property 14 in `src/game/fx/effectPlan.test.ts`, Property 15 in `src/rewards/ChestOverlay.test.tsx`.
- 11.10 SKIPPED (optional presentation-only room events).
Changed this run: the debug report (fps average and 1% low over 10 s, particles, pooled objects, texture MiB) now comes with `?debug=1` alone; `?report=0` turns it off (was `&report=1`). `rendererQuery.test` updated.
Real mode: rank and chest are hidden when `floor_rank` or `chest_rewards` are absent; nothing is computed locally.
### Phase 5 performance notes (no browser was driven here; fps cells are for you to fill in)
Budget math from the code (objects alive at the peak, not counting the room's static sprites):
| Scene | Pooled or animated objects | Notes | Avg fps | 1% low |
| --- | --- | --- | --- | --- |
| Boss room, death sequence | up to 60 sparks + 1 flash rect + up to 24 loot pieces + 1 weapon fx (pool max 16) + ambient (max 24 particles) | about 125 objects at the very peak, all pooled; one-shot tweens, no per-frame work except the existing systems | ____ | ____ |
| Full revenant room | 3 ghosts x 2 images + 1 prompt text + up to 6 rest sparks + ambient (max 24) | about 40 objects | ____ | ____ |
| 25-floor map (DOM) | 25 nodes, one SVG path set, no canvas; windowed rendering by scroll position; no animation under reduced motion | DOM only, Phaser is not running | ____ | ____ |
- Texture memory is unchanged: sparks and loot reuse the one 12 px `spark` texture. Read it from `/play?debug=1`.
- Per-frame allocation: `planHit` returns frozen shared plans, `HitStopSystem` stores two numbers, `FrameStats` uses preallocated Float32Arrays, bursts use pools and deterministic angles from the index (no random objects). No remaining per-frame allocation found in the Phase 5 code.

## Phase 7: badges, lore, share card (frontend-07, tasks 15.1 to 15.7)
Frontend only, mock mode is the target. No new dependency, no commit or push. Earlier runs had already written most of Phase 7; this run reviewed it, did not duplicate it, and fixed the gaps.
What exists:
- 15.1 `src/badges/rules.ts` `evaluateBadges` (pure). Badges: first_blood, streak_5, perfect_room, no_damage, boss_slayer, memory_keeper (3 revenants, Daily Haunt rests included), speed_reader (off unless `VITE_BADGE_SPEED_READER`), dungeon_master (all floors plus the Final_Boss cleared, and the finishing run was clean: boss_slayer and no_damage). Only the mock finishRun, the offline adapter and tests import it. Scorecard shows earned badges with a flourish (static under reduced motion); the Dashboard shows the grid. Real mode shows `badges_earned` as received and hides what is absent.
- 15.2 Property 19 in `rules.property.test.ts`.
- 15.3 `src/lore`: `IntroStory` (skippable, 3 to 5 original funny-spooky cards, code-drawn art, keyboard and screen-reader friendly), shown once via `sd.introSeen` from the landing page. Hook for frontend-08 P6: `hasSeenIntro`/`markIntroSeen` and `TUTORIAL_FLAG_KEY` (`sd.tutorialSeen`) in `intro.ts`. Every portrait kind, revenant included, has at least 3 taunts (tested).
- 15.4 `src/share`: `renderShareCard` (1200x630 canvas, awaits `document.fonts.load`), `buildPostText` (starts with `#KiroweenHackathon26`), `ShareDialog` (preview, Download via toBlob, Copy with readonly textarea fallback, "Could not create the image" on a null blob). The Scorecard Share card button is enabled.
- 15.5 Property 21 in `postText.property.test.ts`. 15.6 share and lore tests, plus a scan that src/share has no http, fetch( or remote image src.
Fixed this run: two share tests failed because `userEvent.setup()` replaced the stubbed clipboard; the stub is now set after setup.
ASSETS_LICENSES.md updated (code-drawn art, self-hosted OFL fonts).
## Phase 6: tutorial, polish, a11y, responsive, docs (frontend-08, tasks 13.1 to 13.8)
Frontend only, mock mode is the target, no new dependency, no commit or push.

### What exists
- 13.1 `src/tutorial/tutorialFlag.ts` (`hasSeenTutorial`, `markTutorialSeen`, `needsFirstRun`). `markTutorialSeen` writes `sd.tutorialSeen` and `sd.introSeen`; both hold "1" (UI state only). `steps.ts` holds the five steps (move, engage, answer, memory scroll, Daily Haunt).
- 13.2 `TutorialFlow` merges the intro story and the steps into one first-run flow, mounted from the landing page's Try the Demo. Choice: a scripted, self-contained practice encounter (DOM corridor, one sample question, the real `MemoryScroll`) rather than coach-marks over the real first floor. It needs no API, run or generated content, so it behaves the same in mock, real and offline mode. Skip is on every step (button or Esc) and also covers the intro cards (the existing lore test expects Skip intro to go straight in). Later visits show nothing; "How to play" on the title screen replays it without starting a run. `setupTests.ts` now sets both flags so existing flows start as returning visitors.
- 13.3 Title polish (How to play link), Dashboard and Leaderboard top links are now a labelled `nav`. Five new synthesized cues in `sfx.ts` (requeue, scroll, combo, finale, chest) wired to: a wrong answer with `requeue_after`, the memory scroll opening, a combo tier rising, the Daily Haunt finale, the chest opening. Boss death (`bossfall`) and loot already existed. Mute is handled in the engine (Property 16 covers all cues); the cue count test is now 19.
- 13.7 Equip: `src/weapons/equipped.ts` (in-memory store), `Armory equippable` (pause menu and dashboard card) with Equip/Unequip toggle buttons for unlocked weapons only. Attempts send `weapon_id`; the mock rejects a locked weapon with `WEAPON_LOCKED`; the real client already maps it to `weapon_name` and falls back to the dagger. `usePlaySession` clears the choice on WEAPON_LOCKED/UNKNOWN_WEAPON so the friendly message shows once. `equipped_weapon` was already noted as PROPOSED in `docs/handoff/B-to-A.md`, so nothing was added there.

### Accessibility findings and fixes (13.4)
- Keyboard: the tutorial plays fully by keyboard (arrows or WASD, E, number keys, Enter, Esc), tested. Floor, Daily Haunt and mode flows already had keyboard tests (CampaignFlow, HauntFlow, ModesFlow, LearningLoop.flow); they still pass. Equip buttons work with Enter (tested).
- Labels: floor and Final Boss nodes already carry `aria-label`; the new equip buttons have "Equip/Unequip <weapon>" labels and `aria-pressed`; the tutorial dialog is labelled and its instruction is the description, with a polite live region for feedback.
- Contrast: Phase 6 pairs added to `palette.test.ts` (all pass).
- Reduced motion: tutorial hero pop is off under reduced motion (class and media query); chest and finale unchanged. Mute: all new cues go through the muted engine.
- Fixed: Dashboard/Leaderboard action links had no landmark; they are now `nav aria-label="Page links"`.
- Not verified: real screen reader output, a manual full-floor playthrough in a browser.

### Responsive check (13.5)
- Headless Edge screenshots of /, /dashboard and /leaderboard at 1366x768 and 2560x1440 (landing and dashboard viewed): no clipping; content centres at 2560. Headless Edge cannot go below about 500px wide, so the 390px captures were cropped by the tool, not by the page; those were not used as evidence. 390 and the in-game screens (play with popup, scroll, chest, share dialog, tutorial) rely on CSS reasoning: the tutorial uses `max-w-xl`, a flex corridor with `min-width: 0` cells, and `max-height: calc(100dvh - 8rem)` with scroll; the play layout is covered by the existing stageLayout and viewport math tests. 1536x864 and 1920x1080 were not captured separately (between the sizes checked).
- Side effect to note: my screenshot clean-up ended all running Edge processes once, which can close the user's own Edge windows. Temp files were removed.

### Verification (13.8)
- `npm run typecheck`: clean. `npm run lint`: clean. `npm run build`: built (the PLUGIN_TIMINGS lines are warnings only).
- `npm run test:contract`: 2 files passed, 1 skipped, 25 tests passed, 1 skipped.
- Full `vitest --run`: first run after the tutorial landed had 18 failures (flows that click Try the Demo met the new tutorial; fixed in `setupTests.ts`) and 2 storage tests that needed the new flag removed (fixed; `client.auth.test.ts`, `mockAuth.test.ts`).
- Final full run (mock mode, after all fixes): 145 files passed, 1 skipped (146); 1065 tests passed, 6 skipped (1071); 334.6 s. No failures.
- Final checks, same session: typecheck clean; lint clean (also with the `.shots/**` and `tmp-shot.mjs` ESLint ignores removed); `test:contract` 2 files passed, 1 skipped, 25 tests passed, 1 skipped; build succeeded.
- Clean-up: `frontend/.shots/` and `frontend/tmp-shot.mjs` deleted, and their ESLint ignore entries removed.

### frontend-08 summary by phase
- P0 baseline; P1A real-backend matching (wire and contract); P1B floors data model and mock campaign; P2 floor map and campaign flow; P3 Daily Haunt and run modes; P4 learning loop (memory scroll, requeue, combo, honest copy); P5 game feel, ranks, boss death and Chest; P6 tutorial, polish, equip, docs.
- Specs: frontend-08-campaign-learning-loop (requirements, design D1 to D26, tasks), with frontend-07 as its base.
- Hooks: steering and the honest-copy scan (`honestCopy.test.ts` now covers `src/tutorial`), the importBoundary, events, scans, tokens, colors and palette tests act as guard rails.
- PBT: floor layout, floor mapping, haunt selection, learning loop, combat machine, sfx mute gating (Property 16, now 19 cues), weapons and effect plans.
- Sub-agents: none used in this phase.

## frontend-07 Phase 8: Upload wizard (17.1 to 17.4)
- Contract: the earlier PROPOSED `POST /uploads` and `uploadNotes` idea is superseded by the real document endpoints (frontend-08 C29). New ApiClient methods: `uploadDocument` (`POST /documents`, multipart, 202), `getDocumentStatus` (processing, accepted, rejected, failed, with `chunks_count`), `getDocumentTopics`, `generateDungeon` (201, returns the mapped dungeon) and `retryDocument`. Wire schemas and mappers are in `src/api/wire/documents.ts`; domain schemas are in `schemas.ts`. The Http_Client sends a `FormData` body without a JSON content type. `B-to-A.md` was not changed: no new need appeared.
- Mock: `src/api/mock/mockUpload.ts`. Status moves from processing to accepted, rejected (with a reason) or failed after a delay. Triggers: a name with meme, receipt or invoice is rejected; a .txt under 500 bytes is rejected; a name with "broken" fails (Retry works). Errors use the real codes: 413 FILE_TOO_LARGE, 415 UNSUPPORTED_FILE_TYPE, 400 QUOTA_EXCEEDED (5 documents), 403 GUEST_FORBIDDEN, 401 without a session. `generateDungeon` creates a dungeon (two topics per floor, plus a final boss) that `getDungeon`, `getGenerationStatus` and `retryFloor` of the mock adapter serve, so its floors show on the campaign map and move from Summoning to Ready every 4 s.
- Offline demo: the document methods reject with 501 and `capabilities.uploads` is false, so the page says uploading needs the server.
- UI: `src/upload/*`, route `/upload`, linked from the Dashboard "Upload notes" button (it was a disabled placeholder). Drag and drop plus a real file input in a label (Tab, then Enter or Space). Browser checks (type, 15 MB, empty file) are hints only; the server decides. Steps: Upload, Read, Check relevance, Detect topics, Summon floors; they move on the server's verdict, never on a timer. A rejection stops "Check relevance" and shows the server's reason; a failure stops "Read". Topics are listed, "Summon dungeon" leads to "Your notes became N floors" and "Open the campaign map". The result reuses `useGenerationStatus` and the `StatusChip` floor status UI. Polite live region for each phase; the rune seal and the spinner are code-drawn and static under reduced motion (OS setting and the in-app flag).
- Guests: `/upload` shows "Create an account to upload your own notes" with a link to `/register`; the wizard is not rendered.
- Tests: `src/upload/Upload.test.tsx` (flow, drag and drop, rejection reason, failed read and retry, type and size hints, oversize, quota, offline, guest gate, keyboard, reduced motion, pure steps), `client.documents.test.ts`, the contract suite (6 document cases on the mock), and upload contrast pairs in `palette.test.ts`. The dashboard link test was updated.
- Real mode: compiles and uses only the real endpoints (no mock import). Not exercised against the live backend (needs a registered account, real files and an AI provider).
- Deferred: running a floor of an uploaded dungeon (the mock `startRun` only knows the demo dungeon; real mode plays through the existing run flow); deleting or listing documents (`GET /documents`, `DELETE /documents/{id}`) has no UI; real PDF page counting is server side only.
### Verification (17.4)
- `npm run typecheck`: clean. `npm run lint`: clean. `npm run build`: built.
- `npm run test:contract`: 2 files passed, 1 skipped, 31 tests passed, 1 skipped.
- Full `npm test` (mock mode): 148 files, 147 passed and 1 skipped; 1096 tests passed, 12 skipped (1108); 255 s. The 6 extra skips are the document contract cases on the offline and real-HTTP suites, which do not run them.

## Layout pass: one screen, no page scrollbar (steps 1 to 4)
Goal: every main screen fits the viewport (1366x650 up to 2560x1440) with no page scrollbar, vertical or horizontal, using the full width. Presentation only; the API, types, routes, mock switch, game code and backend were not touched.
- Step 1, root cause: the title screen, login, register and upload used `min-height: 100dvh` or `min-h-screen` with stacked blocks and padding, so at about 650 px the content grew past the viewport. `overflow-hidden` on the root could not clip a box that grows. The campaign map was already 100dvh; its header was capped at 55dvh and scrolled inside. No 100vw cause existed.
- Step 1, fix: `PageShell variant="fit"` (exactly 100dvh, flex column, fixed clipped decorations, only the body may scroll). The default `scroll` variant stays, so the Dashboard and Leaderboard are unchanged.
- Step 2: the title screen uses a 100dvh layout with its own classes.
- Step 3: login, register and the upload wizard use the fit shell.
- Step 4: the campaign map is now a horizontal winding map (see "Layout pass: horizontal floor map" in the frontend-08 design). Header row plus toolbar row across the screen, floor cards with topics in normal flow (the hidden "Entry Hall / Alchemist's Lab" rows are fixed), "+N more" popover, horizontal scroll inside the map only with snapping, arrows, pointer drag, wheel and keyboard, horizontal virtualization.
- Verification of step 4 (headless Edge with its own profile, document scroll size against the window): demo map at 1366x650, 1366x768, 1536x864, 1920x1080 (and 2560x1440): no page scrollbar either way; `/dev/floors?floors=25` at 1366x650 and 1920x1080: none; cards never overlapped. At 1000x540 the screen scrolls inside itself (allowed). The Dashboard, Leaderboard and game files hash the same before and after.
- Lesson: when a screen must fit, give the root a fixed height and let one region flex (`flex: 1; min-height: 0`); `min-height` hides the problem until a short window.
## Browser-testing fixes (pause, map, dashboard upload, upload flow, leaderboard)
Presentation and UX only; the API, types, routes, mock switch, game code and backend were not touched.
- Pause menu: the root cause was `OverlayFrame` (`fixed inset-0 overflow-y-auto`), which scrolled the whole overlay when the dialog was taller than the window. The overlay is now `overflow-hidden`, the dialog is a flex column capped at the viewport, and only `.sd-overlay-body` scrolls (thin themed bar). All OverlayFrame users (defeat, victory, chest, share, tutorial, intro, mode picker) get this. The pause dialog is two columns (actions, Armory) from 640 px with clamp/vh spacing.
- Campaign map: the scroller had `overflow-y: auto`, and a `max-width: 1100px` media rule made the whole screen scroll with a 29rem stage. The scroller is now `overflow-y: hidden`, the media rule only applies under 480 px tall.
- Dashboard: "Upload notes" moved into the Dungeon card next to Continue and Play Demo (guests get a link to /register with a short note). The More card keeps Settings.
- Upload: choosing or dropping a file starts the upload (`start(file)`); a file with a browser hint is not sent on its own and keeps the manual button; "Choose another file" shows after a failure.
- Upload spacing: cards are centred in the free height with a max width, roomier rows and gaps, a larger subtitle.
- Leaderboard: now the `fit` shell; the podium uses clamp/vh; the rows scroll inside the table box with a sticky header; the pinned row and guest call to action stay visible.
- Verified with headless Edge (own profile) at 1024x580, 1366x650, 1366x768, 1920x1080: no page scrollbar on the map, the paused play page, upload (initial, hint, topics, result) and the leaderboard. The Dashboard may still scroll.
- Lesson: a fixed overlay with `overflow-y: auto` shows a scrollbar for any tall dialog; cap the dialog and scroll its body instead.

## Mobile play (touch controls, phone layout, playable uploads)
Frontend only. Backend, the real Http_Client, wire schemas, contract tests and routes are unchanged.
- Touch mode: `useTouchMode` (coarse pointer, first `touchstart`, or `?touch=1`, remembered for the tab). It also sets `html[data-touch]` so every screen gets 44px targets. Desktop is untouched.
- Event_Bridge, additive and typed: `set-move-input {x,y}`, `engage-request`, `set-touch-mode` (to Phaser), `engage-available {kind, name?}` (from Phaser, only on change).
- Phaser: `MovementSystem.setTouchVector` (keyboard wins, otherwise the stick; clamped to length 1, same `PLAYER_SPEED`, same footstep limit, exploring only). `InteractionSystem.requestEngage` feeds the same `shouldEngage` path as E/Space; `RevenantSystem.requestEngage` calls `tryEngage`. No per-frame allocation; `src/game` imports nothing new from the app (importBoundary passes).
- React: `VirtualJoystick` (pointer events, capture, dead zone, analog, sends on change; zero on release, cancel, lost capture, blur, hide, unmount), `EngageButton` ("Fight <name>" / "Face the memory"), `PauseButton` (same as Esc via `togglePause`), `RotateHint` (portrait, dismissible). Controls hide while the popup, pause or any overlay is open. Touch legend: "Use the stick to move, tap Engage". Fullscreen button hidden on touch when the API is missing (iOS).
- Layout: `touch-action: none` only on the game area and stick, `manipulation` on controls, `overscroll-behavior: none` on the play shell, viewport meta has `viewport-fit=cover` (zoom is not disabled). Short landscape phones use the compact HUD. Map drag-to-scroll is mouse only, so touch keeps native scroll and snap.
- Upload: accept list adds the six MIME types next to the extensions; touch shows "Tap to choose a file"; "You can also take a photo of your notes (PNG or JPEG)."
- Mock: an uploaded dungeon is playable (getDungeon, startRun by floor, submitAttempt, clearRoom, finishRun, getRun, generation status). The adapter now resolves a `DungeonCtx` (demo or generated) and reuses `applyAnswer`, floors, requeue and draw. Generated rooms use existing monster kinds, "Sample question" content with a private key, and the Exam Warden as final boss.
- Found by the joystick property test: re-rounding after a clamp could give length 1.001; the clamp now truncates.
- Verified with headless Edge (own profile, CDP touch emulation, `?touch=1`) at 390x844 and 844x390: title, intro, map, play (stick moved the hero, Engage lit up "Fight Paper Wraith", started the encounter), popup, pause from the HUD, dashboard, upload, leaderboard. No horizontal overflow on any. Found and fixed: the touch legend sat over the popup answers.
## frontend-10 live players: Phase 0 (plan, documents only), 2026-11-11
Branch `feature/frontend-live-players` (from the latest `origin/main`). Spec: `.kiro/specs/frontend-10-live-players/` (requirements.md, design.md, tasks.md). No application code, config, test or `backend/` file was changed.
- Read: frontend-07 and frontend-08 specs (format, D26 capabilities, authority rules), `FRONTEND_STATE_AND_CHANGES.md` (Sections 6, 9, 10), `BACKEND_REQUIREMENTS_V2.md` (A to E, G, I), `B-to-A.md`, the real `backend/app/api/auth.py`, `schemas/auth.py`, `core/identity.py`, `core/deps.py` (partly), `api/dungeons.py` (list route), and the frontend files named in design.md. The mobile pass is already on the base branch (`git status` clean), and I did not touch `src/touch`, `styles/touch.css` or `PauseButton`.
- Plan: 5 phases (guest entry and path choice; preloaded packs; leaderboard with real players; player counter; guest upload), 19 requirements, 30 decisions (D1 to D30), 17 correctness properties, 12 contradictions or findings (X1 to X12), 9 assumptions (AS1 to AS9), an ordered cut list with a never-cut list.
- Key decisions: capability state `on | off | unproven` with the first call as the probe (REAL features start on, PROPOSED start unproven); name screen at `/play-as-guest`, choice screen at `/choose`; preloaded dungeon resolved from packs, then `GET /dungeons`, and `POST /demo/session` only when no session exists; new `getBoard` next to the legacy `getLeaderboard` so the offline rivals board stays; poll policy with a 60 s minimum interval; counter cache of 300 s that hides itself on failure or zero.
- Findings from the real backend that change the plan: `POST /guests` returns no `dungeon_id`; names are not unique so there is no "taken" error; registered users get `handle = username` until V2 A-R10 is built; no write to `last_active_at` found, so no sliding renewal; the moderation list matches substrings and refuses names such as "Nomad".
- State doc Section 9 items assigned: 9.6 Phase 5, 9.7 and 9.9 Phase 2, 9.8 and 9.10 Phase 1.
- Docs: "frontend-10 live players" appended to `docs/handoff/B-to-A.md` (REAL shapes used, findings, PROPOSED shapes for packs, points, leaderboard, counter, guest upload and `GET /meta`, contract tests, 10 questions).
- Validation: `validate_spec_format` reported no issues for the three spec files.
- Lesson: the existing capability model (all PROPOSED features off) never makes the first call, so a third state (`unproven`) is needed.
- Next: STOP for review. No implementation started.

## frontend-10 live players: Phase 1 (guest entry and path choice), 2026-11-11
Frontend only. Documents were edited in this task; no backend file was touched.
- Spec-driven: Phase 1 ran as 19 tasks dispatched to sub-agents through the Kiro task tools, with waves of 3 to 5 tasks in parallel.
- Built: name screen `/play-as-guest` (prefilled spooky name, "Roll another", Enter to submit, a notice above "Accept and continue", no checkbox); waking screen with "Keep waiting" up to 60 s and "Play offline demo" (never automatic); `/choose` path choice (preloaded card highlighted and focused; first-time players go straight into the first floor run); handle shown in the HUD; guest banner; Dashboard and leaderboard; guest upgrade through `/register`; `/settings` with "Delete my account and data" (type DELETE); warm-up `GET /health` on the title screen; the tutorial no longer opens automatically.
- Property-based tests: 5 new fast-check properties (local name rules vs a reference model, friendly reason messages, handle never leaks a guest username, preloaded dungeon choice, spooky names pass local and backend moderation). Property 4 caught a real bug: `pickPreloaded` chose the first open pack by array position instead of by `order`, so the choice depended on input order. Fixed in `src/identity/resolvePreloaded.ts`.
- Tests changed because behaviour changed: `src/tutorial/tutorial.test.tsx` and `src/lore/lore.test.tsx` (intro and tutorial no longer open automatically); `src/pages/LandingPage.test.tsx` (Try the Demo goes to `/play-as-guest`); `src/pages/WakingUp.test.tsx` (two choices); `src/pages/DashboardPage.test.tsx` (compact path choice, Settings link); `src/campaign/CampaignFlow.test.tsx`; `src/pages/PlayFlow.smoke.test.tsx` (guest banner names the handle); `src/haunt/HauntFlow.test.tsx`; `src/haunt/ModesFlow.test.tsx`; `src/learning/LearningLoop.flow.test.tsx`; `src/offline/offline.campaign.test.tsx` (all now enter through the name screen via the shared helper `src/test/enterDemo.tsx`; the offline test chooses "Play offline demo" after 8 s); `src/api/client.test.ts` and `client.floors.test.ts` (`HTTP_CAPABILITIES` `toEqual` became `toMatchObject`).
- New key test: `src/pages/FirstFight.threeClicks.test.tsx` proves Try the Demo, Accept and continue, Play preloaded dungeons = 3 clicks to a running floor, then E (or the touch Engage button) starts the first fight.
- Verification: typecheck and lint clean; `npm test` 1335 passed, 19 skipped, 0 failed (was 1142 passed); `test:contract` 38 passed, 1 skipped (was 31); build OK. Layout checked with headless Edge at 360x740, 768x1024, 1366x650, 1920x1080.
- Lesson: one dispatch failed on server load but had already written files; the retry reviewed them instead of rewriting. Parallel agents reported typecheck and lint errors from each other's half-written files, so the verification task must always run last on the combined tree.

## frontend-10 live players: Phase 2 (preloaded packs and points), 2026-11-11
Frontend only; no backend file, `src/game`, `src/touch` or `styles/touch.css` touched.
- Built: `/packs` (numbered packs, status chips, floors cleared, points, locked text, Play, "Sample content" chip in mock) linked from the Path_Choice card when `packs` is on; `/packs/unlocked/:packId` and `/packs/complete` (Daily Haunt button only with the `dailyHaunt` capability); Scorecard Continue after a final boss (`pack_progress` first, else refetch diff via `unlockedBetween`); "Pack N of M" and pack points on the floor map header; `PACK_LOCKED` on a run start opens `/packs`; `PointsPop` next to the damage number; labels "Dungeon score" (victory and defeat overlays, Scorecard, share card and post text; the HUD shows no score) and "Leaderboard points" with a one-line explanation on the Scorecard. Haunted look, celebration off under reduced motion.
- Tests changed by 5.1 to 5.7: `src/api/mock/mockAdapter.test.ts` (3 places) and `src/api/mock/mockRun.boss.test.ts` (`toEqual` became `toMatchObject` for `clearRoom`, which now carries points fields).
- Tests changed by 5.10: `src/scorecard/Scorecard.test.tsx` ("Score 2400" became "Dungeon score 2400") and `src/share/postText.property.test.ts` ("Score 1200, rank #3." became "Dungeon score 1200, rank #3."). The leaderboard "Score" column is unchanged.
- New tests: `src/packs/packs.test.tsx`; 3 pack/points cases in `src/contract/suite.ts` (packs shape, PACK_LOCKED, pack clear with points).
- Verification: typecheck and lint clean; `npm test` 1385 passed, 22 skipped, 0 failed (was 1335 passed); `test:contract` 41 passed, 1 skipped (was 38); build OK. Visual size checks (360x740 to 1920x1080) were not run in this pass.

## frontend-10 live players: Phase 3 (live leaderboard), 2026-11-11
Frontend only; no backend file, `src/game`, `src/touch` or `styles/touch.css` touched.
- Built: `GET /leaderboard?board=&period=` through the stack (`getBoard`, `liveBoard` capability, wire mapper, mock with Ghost Rivals flagged mock-only); `src/board/` (pure view, You panel, countdown and poll scheduler modules, `useBoard` with one timer, 60 s minimum gap, Retry-After wait, refetch on visible, stale rows kept, late responses ignored; `useNow`); `BoardTabs` (Preloaded, Own notes, Overall; All-time, This week; arrow keys; selection in `?board=&period=`), `LiveBoard` (podium, scrolling table, tie-break note, skeleton, empty "Be the first to enter", error with Retry, stale line, "Updated at ..., refreshes hourly" with countdown, weekly reset text) and `YouPanel`. `LeaderboardPage` picks live, legacy or coming soon with `useLeaderboardView`; the legacy page is unchanged and used when `liveBoard` is off.
- "Ghost Rival - demo" shows only for `is_seeded_rival` (mock and Offline demo). Boundary test now limits that wording and the flag to the mock, offline, and a small allow-list.
- Tests changed: `LeaderboardPage.test.tsx` fake client now sets `liveBoard: false` (legacy path); `client.board.test.ts` lint fix. New: `src/board/LiveBoard.test.tsx`, boundary cases, 2 contract cases for the live board.
- Name clash note: the pure module is `youPanel.ts`, so the component is `YouPanelView.tsx` (Windows is case-insensitive).
- Verification: typecheck and lint clean; `npm test` 1423 passed, 24 skipped; `test:contract` 43 passed, 1 skipped; build OK. Visual size checks were not run in this pass.

## frontend-10 live players: Phase 4 (player counter), 2026-11-11
Frontend only; no backend file, `src/game`, `src/touch` or `styles/touch.css` touched.
- Built: `GET /stats/players` through the stack (`PlayerStats`, `getPlayerStats`, `playerCounter` capability, wire `stats.ts`, mock `mockStats.ts` returning `VITE_MOCK_PLAYER_COUNT` or 0; the Offline demo has no counter). `src/counter/`: `formatExplorerLine`, `explorerCountText`, `countUpValue` (800 ms), `shouldRefetch` and `fetchPlayerCount` (memory cache, `cache_seconds` or 300 s, failures not cached, one in-flight, reset with `resetClientCaches`), and `PlayerCounterLine` under the tagline on the title screen. It renders nothing without a valid count, sits in a zero-height box (no layout shift) and fades in; the animated span is `aria-hidden` and an `sr-only` span holds the final text.
- Tests: `counter.property.test.ts` (Properties 13 to 15, 100 runs each), `counter.test.tsx`, one contract case.
- To view: set `VITE_MOCK_PLAYER_COUNT=128` in `.env.local` and open the title screen.
- Verification: typecheck and lint clean; `npm test` 1435 passed, 25 skipped; `test:contract` 44 passed, 1 skipped; build OK. Bug found while testing: the count-up used `performance.now()` as its start, which does not share a clock with the rAF timestamp in jsdom; it now takes the first frame time.
## frontend-10 live players: Phase 5 (upload path for guests), 2026-11-11
Frontend only; no backend file, `src/game`, `src/touch` or `styles/touch.css` touched.
- Built: `GET /uploads/quota` through the stack (`UploadQuota`, `QuotaReason`, `getUploadQuota`, `uploadQuota` and `guestUpload` capabilities, wire `quota.ts`, optional `counts_for_ranking`, `ranking_note`, `dungeon_id`, `floors[]` on the document status); `uploadDocument(file, {acceptAiNotice})`; friendly messages for the new error codes. Mock: `mockQuota.ts` (guest 1 per day, stored limit 2; dev switches `?mockQuota=<reason>` / `VITE_MOCK_QUOTA` and `?mockAiBusy=1` / `VITE_MOCK_AI_BUSY`; notice required, 422 otherwise; guests may upload; short notes do not count for the ranking; per-floor `floors[]`). Offline demo: quota and guest upload off.
- `src/upload`: `limits.ts` is the single constants module (+ `rulesText()`, TODO to read limits from the server, DOCX limit marked UNCONFIRMED), `quotaView.ts`, `limitErrors.ts` ("This PDF has 42 pages; the limit is 30."), `AiNotice`, `QuotaPanel`, `PreloadedFallback`, `FloorProgressList`. `UploadPage` opens the wizard to guests when guest upload is not off and the quota answers; the sign-up gate stays for visitors, guest upload off and a failed quota request. The drop zone is disabled until the notice is ticked and while the quota blocks. The path choice shows the quota line on the upload card.
- Tests: Properties 9, 16 and 17 (100 runs each), `limits.test.ts` (no literal limit numbers in `src/upload/*.tsx`, copy lint), `client.quota.test.ts`, new `Upload.test.tsx` cases, 2 contract cases. Changed tests: `Upload.test.tsx` (tick the notice first, rules text, guest gate cases rewritten, the 5-document case now checks the blocked quota panel), `mockGenerated.play.test.ts` and the contract documents cases (pass `{acceptAiNotice: true}`; the guest case accepts 403 or an accepted upload).
- Bug found by Property 17: `describeLimitError` looked the code up in a plain object, so a code such as `constructor` returned garbage; it now uses `Object.hasOwn`.
- Verification: typecheck and lint clean; `npm test` 1473 passed, 27 skipped; `test:contract` 46 passed, 1 skipped; build OK. Visual size checks were not run in this pass.
## frontend-11 layout fixes: Step 0 (audit, documents only), 2026-11-12
Documents only; no code, no `backend/`, `src/game`, `src/touch` or `styles/touch.css` touched. Spec in `.kiro/specs/frontend-11-layout-fixes/`.
- Root causes (details in design.md, RC1 to RC36): `.sd-page__body` is always a scroll container (`pages.css`); `.sd-page--fit .sd-page__inner { max-width: 1600px }` beats `--wide`, while children cap at 32 to 52 rem; only `.sd-live` screens on touch release the 100dvh box (`live.css`), so phones and tablets get nested scrolling on upload and leaderboard; `.sd-haunted` forces a centred 52 rem column and an absolute back link (`haunted.css`), which blocks any two-column layout on upload; `.sd-up > .sd-card { overflow-y: auto }` and `.sd-up__drop { overflow-y: auto }` give the notice and the drop zone their own scrollbars; `.sd-up__notice-check` has no CSS; `.sd-lb__tablewrap` scrolls inside the page and rows are about 52 px so 17 rows never fit; the leaderboard stacks tabs, podium, table, You panel and footer in one column; two Dashboard links; moon under the top-right controls; skeletons use fixed pixel heights.
- Open questions for the user: Q1 "file chosen with remove" conflicts with auto-start (proposal: keep auto-start), Q2 layout test tooling (proposal: Node script over Edge CDP, no dependency; Playwright is not installed), Q3 renamed copy changes a few test assertions, Q4 to Q7 breakpoint, short windows, container width, map popover.
- Verification: not applicable (documents only). Baseline from the last log entry: `npm test` 1473 passed, 27 skipped; `test:contract` 46 passed, 1 skipped.
## frontend-11 layout fixes: Upload screen (tasks 4.1 to 4.7), 2026-11-14
Frontend only; no backend, `src/game`, `src/touch` or `styles/touch.css` touched. Resumed after a cancelled run.
- Upload is a two-column grid on desktop (quota chip, full AI notice with a 20 px checkbox, new `FileRules` on the left; a full-height drop zone on the right), a slim one-row stepper with progress, and a single column on phones and tablets. Upload, quota and notice logic and the API are unchanged.
- Copy: notice text and label ('I understand and want to continue'), 'Try another file', drop zone hint. Changed tests in `Upload.test.tsx` (exact text only): the rules assertions now read `file-rules` lines, and 'Choose another file' became 'Try another file'.
- Layout_Check `/upload` (plus guest and registered, locked, topics, success, quota used up, busy): 72/72 ok at 8 sizes.
- Handoff: asked Person A whether rejected or failed uploads use the daily quota (`docs/handoff/B-to-A.md`).

## frontend-11 layout fixes: Leaderboard (tasks 6.1 to 6.6), 2026-11-15
Frontend only; no backend, src/game, src/touch or styles/touch.css touched. Resumed after a cancelled run.
- Leaderboard (live and legacy): header row with tabs and period toggle on the right, one caption line, podium and 'Your live rank' panel on the left, ranks 4-20 as compact rows on the right (two columns when short), no scrollbars, '1 point' plurals, grid-shaped skeleton, error with Retry. Polling, rank logic, API and schemas unchanged. \plural\ in quotaView.ts is now exported; PageShell got an optional \ctionsLabel\.
- Dev-only mock switch \?mockBoard=<0..20>|error|slow\ for the Layout_Check.
- Changed tests in \LiveBoard.test.tsx\ (exact text only): \lb-foot\ became \lb-refresh\; the panel text is now 'Updates instantly. The table refreshes hourly.'.
- Layout_Check /leaderboard and /upload: 160/160 ok at 8 sizes.
