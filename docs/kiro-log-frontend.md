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
