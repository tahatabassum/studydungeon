# Implementation Plan: frontend-06-halloween-visuals

## Overview

Halloween visual overhaul, delivered in the user's phases: Phase 2 sample room (Clockwork Crypt), Phase 3 other four rooms, Phase 4 UI and screens, Phase 5 sound, Phase 6 verification. Phase 1 (this plan) is complete when the user confirms the open decisions D1 to D11 in design.md.

Rules for every task:

- No gameplay, balance, Event_Bridge, API or state change. Phaser code imports nothing from src/api, src/demo or src/state.
- Paths are relative to frontend/. Pure logic goes in Phaser-free modules with tests written in the same phase.
- Implementation continues on branch feature/frontend-rpg-polish, or on a new branch feature/frontend-halloween-visuals created from it (open decision D9, recommended: new branch).
- frontend-04 Phase 7 (polish) is deferred until after this spec.
- Each phase ends with a STOP checkpoint. Do not start the next phase until the user approves.
- Tests marked required are not optional, so none of the sub-tasks below carry the optional marker.

## Tasks

- [x] 1. Phase 2a: Foundations (palette, theme mapping, pure logic)
  - [x] 1.1 Add palette tokens and contrast helper
    - Add pumpkin, ember, ghost, toxic, witch, magenta, indigo, bone, blood tokens (per D1) to `src/index.css` and `src/game/colors.ts`; keep all existing names
    - Create `src/design/contrast.ts` exporting `contrastRatio(fg, bg)`
    - _Requirements: 5.1, 5.2, 5.6, 4.6_

  - [x] 1.2 Write contrast property test and palette parity test
    - **Property 8: Contrast ratio is symmetric and bounded**
    - Create `src/design/contrast.property.test.ts` and `src/design/palette.test.ts` (index.css values equal colors.ts values; required text pairs meet 4.5:1 and UI pairs 3:1)
    - **Validates: Requirements 4.6, 5.6**

  - [x] 1.3 Refactor theme ids and selection
    - Edit `src/game/world/roomTheme.ts`: ids entry, library, witch_lab, clockwork_crypt, pumpkin_workshop, boss_hall; kind mapping per D2; add `palette`, `lights`, `pieces` fields; keep `selectTheme(kind, isBoss)` signature
    - Update `src/game/world/RoomDecorator.ts`, `src/game/world/decorPlacement.ts`, `src/game/world/registries.test.ts` for renamed ids
    - Per D2 decision, optionally rename label "Forgotten Wing" to "Pumpkin Workshop" in `src/demo/demoDungeon.json` and adjust `src/demo/demoDungeon.test.ts` if it asserts labels
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x] 1.4 Update theme property tests
    - **Property 1: Boss rooms always use the boss hall theme**
    - **Property 2: Non-boss theme depends only on the monster kind**
    - Edit `src/game/world/roomTheme.property.test.ts` (100 runs minimum, tag comments)
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6**

  - [x] 1.5 Implement Flicker_Function
    - Create `src/game/systems/flicker.ts` exporting `flicker(timeMs, seed, min, max, reduced)` (pure, no allocation, sum of sines mapped into the bounds)
    - _Requirements: 8.1, 8.2, 8.3, 4.1, 4.3_

  - [x] 1.6 Write flicker property tests
    - **Property 3: Flicker stays within bounds and is deterministic**
    - **Property 4: Flicker is constant under reduced motion**
    - Create `src/game/systems/flicker.property.test.ts`
    - **Validates: Requirements 4.3, 8.1, 8.2, 8.3**

  - [x] 1.7 Implement Keep_Out_Zone and Prop_Placer
    - Create `src/game/world/keepOut.ts` (corridor, monster, spawn and gate-approach rects derived from `RoomLayout.ts` constants)
    - Create `src/game/world/propPlacement.ts` exporting `placeProps(seed, kinds, blocked)` using a seeded RNG, bounded attempts, plain data output
    - _Requirements: 7.5, 9.1, 9.2, 9.3, 9.4_

  - [x] 1.8 Write prop placement property tests
    - **Property 5: Placed props never block**
    - **Property 6: Prop placement is deterministic**
    - Create `src/game/world/propPlacement.property.test.ts`; include an example that the Clockwork Crypt prop list fully places for 200 seeds
    - **Validates: Requirements 7.5, 9.1, 9.2, 9.3**

  - [x] 1.9 Implement theme budgets
    - Create `src/game/world/themeBudget.ts` exporting caps and `themeBudget(theme, reduced)`; link `AMBIENT_CAP` to `MAX_PARTICLES`
    - Use the budget in `src/game/systems/AtmosphereSystem.ts` for the reduced-motion count
    - _Requirements: 2.2, 2.3, 10.1, 10.2, 10.3_

  - [x] 1.10 Write theme budget property test
    - **Property 7: Theme budgets respect the caps**
    - Create `src/game/world/themeBudget.property.test.ts`
    - **Validates: Requirements 2.2, 2.3, 10.1, 10.2, 10.3**

- [x] 2. Phase 2b: Sample room, Clockwork Crypt
  - [x] 2.1 Procedural floor and wall generators
    - Create `src/art/room/rng.ts`, `src/art/room/floor.ts` (varied tones, cracks, moss, stains, seams, worn edges), `src/art/room/walls.ts` (top face, shaded inner face, arched doorways); all draw into a 2D context from a seed and palette
    - Add a smoke test `src/art/room/generators.test.ts` (runs in jsdom or node canvas stub, no exceptions, deterministic output hash)
    - _Requirements: 7.1, 7.2, 5.5_

  - [x] 2.2 Glow, vignette and shadow textures
    - Create `src/game/textures/registerGlow.ts` (glow_warm, glow_cool, glow_green, glow_purple, glow_red, vignette, shadow_soft, beam, fog_blob) and register in `src/game/scenes/BootScene.ts`
    - Verify `textures.createCanvas` and blend mode usage against the design.md capability table before coding
    - _Requirements: 3.2, 3.3, 7.6_

  - [x] 2.3 RoomBaker and GameScene integration
    - Create `src/game/systems/RoomBaker.ts` (CanvasTexture per room, lazy current plus next room, release beyond one step, `estimatedBytes()`)
    - Edit `src/game/scenes/GameScene.ts`: replace `drawFloor` with baked texture, hide `wall-tile` sprites with setVisible(false) while keeping bodies, call release in `teardown`
    - Fallback to the old Graphics floor if the canvas context is unavailable
    - _Requirements: 2.6, 2.7, 2.8, 7.1, 7.2, 1.1_

  - [x] 2.4 Write RoomBaker unit tests
    - Create `src/game/systems/RoomBaker.test.ts` (estimatedBytes for 1 and 3 rooms, release lowers the total)
    - _Requirements: 2.7, 2.8_

  - [x] 2.5 LightSystem
    - Create `src/game/systems/LightSystem.ts` (flickering warm pools from theme lights, indigo MULTIPLY tint, vignette at depth 100, monster glow ring, player aura, contact shadows)
    - Edit `src/game/scenes/GameScene.ts` to create, update and destroy it; reduced motion uses constant intensity; reduce light count to 6 on the Canvas renderer
    - _Requirements: 7.6, 8.3, 4.1, 3.1, 3.2_

  - [x] 2.6 Clockwork Crypt dressing and animated pieces
    - Create `src/art/room/clockworkCrypt.ts` (baked wall dressing: clock face, pipes, cobwebs, chains, coffins, scatter props from `placeProps`)
    - Create `src/game/systems/AnimatedPieces.ts` (clock hands, pendulum, gears, steam from pool, bats from pool), static pose under reduced motion
    - Edit the crypt theme data in `src/game/world/roomTheme.ts` and wire in `src/game/scenes/GameScene.ts`
    - _Requirements: 7.4, 7.5, 4.2, 2.4, 2.5, 10.2_

  - [x] 2.7 Gate glow and character polish
    - Edit `src/game/entities/Gate.ts` (iron bands, glow when openable, derived only from existing events)
    - Edit `src/game/entities/Monster.ts` (idle breathing, glowing eyes, wind-up, hit flash, spark-poof defeat) and `src/game/entities/Player.ts` (outline, cape and hat sway, small shadow)
    - Read these files first; keep attack timing and combat flow unchanged
    - _Requirements: 7.3, 7.7, 7.8, 7.9, 7.10, 7.11, 4.2, 1.1_

  - [x] 2.8 Debug_Overlay and canvas renderer switch
    - Create `src/game/systems/DebugOverlay.ts` (fps, ambient count, tween count, renderer type, texture MiB; enabled by `?debug=1` or F3; no work when off)
    - Edit `src/game/config.ts` and `src/game/GameCanvas.tsx` to support `?renderer=canvas` for fallback checks
    - Edit `src/game/scenes/GameScene.ts` to create and update it
    - _Requirements: 2.9, 2.10, 3.1_

- [x] 3. STOP: Phase 2 checkpoint, sample room review
  - Ensure typecheck, lint and all tests pass. Present screenshots or run instructions for the Clockwork Crypt (normal and reduced motion, WebGL and `?renderer=canvas`, `?debug=1`). Ask the user to approve or request changes. Do not start Phase 3 until approved.
  - _Requirements: 7.12_

- [x] 4. Phase 3: Other four rooms with the shared lighting system
  - [x] 4.1 Haunted Library (library, paper_wraith)
    - Create `src/art/room/library.ts`; edit library theme data in `src/game/world/roomTheme.ts`; extend `src/game/systems/AnimatedPieces.ts` (floating candles, drifting pages, ghost books) and moon window beams
    - _Requirements: 11.1, 11.2, 10.2_

  - [x] 4.2 Witch's Laboratory (witch_lab, toxic_slime)
    - Create `src/art/room/witchLab.ts`; edit theme data; extend `AnimatedPieces.ts` (cauldron bubbles and glow, jar eyes and sparks), purple and green lights
    - _Requirements: 11.1, 11.3, 10.2_

  - [x] 4.3 Pumpkin Workshop (pumpkin_workshop, memory_eater)
    - Create `src/art/room/pumpkinWorkshop.ts`; edit theme data; extend `AnimatedPieces.ts` (jack-o'-lantern faces, embers), warm orange lights
    - _Requirements: 11.1, 11.4, 10.2_

  - [x] 4.4 Boss Hall of the Exam Warden (boss_hall)
    - Create `src/art/room/bossHall.ts`; edit theme data; extend `AnimatedPieces.ts` (purple-fire chandelier, lightning overlay at most once per 8 s, alpha at most 0.25, off under reduced motion)
    - Edit `src/game/entities/Monster.ts` and `src/game/scenes/GameScene.ts` for the larger boss, aura and dramatic intro using existing events only; heavier fog in `src/game/systems/AtmosphereSystem.ts`
    - _Requirements: 11.1, 11.5, 11.6, 11.7, 4.1_

  - [x] 4.5 All-theme coverage tests
    - Edit `src/game/world/themeBudget.property.test.ts` and `src/game/world/propPlacement.property.test.ts` to iterate every theme in THEME_IDS (Properties 5 and 7 on all five rooms plus entry)
    - **Property 5: Placed props never block**
    - **Property 7: Theme budgets respect the caps**
    - **Validates: Requirements 9.1, 9.2, 10.1, 10.2, 10.3**

- [x] 5. STOP: Phase 3 checkpoint, rooms review
  - Ensure all tests pass. Ask the user to review each room with `?debug=1` and approve before Phase 4.
  - _Requirements: 11.8_

- [x] 6. Phase 4: UI and screens
  - [x] 6.1 HUD and stone frame
    - Create `src/components/StoneFrame.tsx` and `src/styles/hud.css`; edit `src/components/Hud.tsx`, `src/components/RoomProgress.tsx`, `src/components/hudHelpers.ts` (low-health state helper at 25 percent)
    - Low-health pulse disabled under reduced motion
    - _Requirements: 12.1, 12.2, 4.4, 4.6_

  - [x] 6.2 Spellbook question panel
    - Edit `src/components/QuestionPanel.tsx`; create `src/styles/spellbook.css` (parchment, corner candle, ink options with hover glow); keep behaviour and keyboard handling unchanged
    - _Requirements: 12.3, 12.4, 12.5, 4.6_

  - [x] 6.3 Answer feedback effects
    - Edit `src/game/systems/EffectsSystem.ts` (ghost-wisp burst on correct, curse flash on wrong with non-flashing tint under reduced motion, pooled floating damage numbers)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 2.4_

  - [x] 6.4 Landing page
    - Edit `src/pages/LandingPage.tsx`; create `src/styles/landing.css` and inline SVG bats (CSS-only sky, moon, fog, flickering title, pumpkin button); static under prefers-reduced-motion
    - _Requirements: 14.1, 14.2, 4.5_

  - [x] 6.5 Victory, defeat and pause screens
    - Edit `src/components/VictoryOverlay.tsx` (embers, bat confetti at most 24 elements, XP counter), `src/components/DefeatOverlay.tsx` (fading candles), `src/components/PauseMenu.tsx` and `src/components/OverlayFrame.tsx` (stone frame)
    - _Requirements: 14.3, 14.4, 14.5, 4.5_

  - [x] 6.6 Room transitions
    - Create `src/game/systems/TransitionSystem.ts` (mist wipe or bat swarm, at most 600 ms, skippable by any key or pointer, off under reduced motion); edit `src/game/scenes/GameScene.ts` `onRoomChange`
    - _Requirements: 14.6, 14.7, 4.1_

  - [x] 6.7 Component tests for screens
    - Edit `src/components/hudHelpers.test.ts`, `src/components/QuestionPanel.test.tsx`, `src/components/OverlayFrame.test.tsx`; create `src/components/VictoryOverlay.test.tsx`, `src/components/DefeatOverlay.test.tsx`, `src/pages/LandingPage.test.tsx` covering reduced-motion variants, low-health threshold and unchanged question behaviour
    - _Requirements: 12.2, 12.4, 12.5, 14.3, 14.4, 4.4, 4.5_

- [x] 7. STOP: Phase 4 checkpoint, UI review
  - Ensure all tests pass. Ask the user to review HUD, panel, landing, victory, defeat, pause and transitions in normal and reduced motion. Do not start Phase 5 until approved.

- [x] 8. Phase 5: Sound
  - [x] 8.1 Ambient bed and creaks
    - Create `src/audio/ambient.ts` (low wind drone at most 5 percent of master, creaks and distant owl at random 20 to 60 s intervals, Web Audio only, injectable context)
    - _Requirements: 15.1, 15.2, 15.3, 15.5, 15.7_

  - [x] 8.2 Stingers
    - Edit `src/audio/sfx.ts` to add 'miss' and 'boss' cues (reuse 'hit', 'gate' for door, 'victory'); update `src/audio/sfx.property.test.ts` for the new cue list
    - _Requirements: 15.4, 15.1_

  - [x] 8.3 Wiring, defaults and tests
    - Wire ambient start, mute and stingers from React side (`src/pages/PlayPage.tsx`, `src/pages/usePlaySession.ts` or the existing audio hook) using existing events only; apply D8 default
    - Create `src/audio/ambient.test.ts` (muted gives no output, gain ceiling, missing context does not throw)
    - _Requirements: 15.4, 15.5, 15.6, 15.7, 1.2_

- [x] 9. STOP: Phase 5 checkpoint, sound review
  - Ensure all tests pass. Ask the user to listen with sound on and off and approve before Phase 6.

- [ ] 10. Phase 6: Verification and documentation
  - [ ] 10.1 Contrast and reduced-motion verification
    - Add example tests for the required text pairs in `src/design/palette.test.ts`; fix any failing token use in changed components
    - Create `.kiro/specs/frontend-06-halloween-visuals/verification-report.md` with a contrast and reduced-motion row for each changed screen
    - _Requirements: 16.4, 4.6_

  - [ ] 10.2 Licences and log
    - Update `ASSETS_LICENSES.md` (all art code-drawn, fonts unchanged, any pack if D4 changes) and `docs/kiro-log-frontend.md`
    - _Requirements: 16.5, 1.6_

  - [ ] 10.3 Full verification run
    - Run `npm run typecheck`, lint, the full test suite and the production build in `frontend/`; fix failures; confirm `importBoundary.test.ts` passes and the test count is at least 267 plus the new tests
    - _Requirements: 16.1, 16.2, 1.3, 1.4, 1.8_

- [ ] 11. Final checkpoint: performance readings by the user
  - Ensure all tests pass. Give the user the exact steps to open each room with `?debug=1`, ask for fps, ambient particle count and texture MiB per room (and one pass with `?renderer=canvas`), record the readings in the verification report, and ask the user to approve the merge.
  - _Requirements: 16.3, 2.1, 2.9_

## Notes

- Each task references specific requirements for traceability.
- Checkpoints ensure incremental validation and user approval between phases.
- Property tests validate universal correctness properties from design.md.
- Task counts: Phase 2 has 18 sub-tasks plus 1 checkpoint (tasks 1 and 2, then 3); Phase 3 has 5 sub-tasks plus 1 checkpoint; Phase 4 has 7 sub-tasks plus 1 checkpoint; Phase 5 has 3 sub-tasks plus 1 checkpoint; Phase 6 has 3 sub-tasks plus 1 final checkpoint.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3", "1.5", "1.7"] },
    { "id": 1, "tasks": ["1.2", "1.4", "1.6", "1.8", "1.9", "2.1", "2.2"] },
    { "id": 2, "tasks": ["1.10", "2.3"] },
    { "id": 3, "tasks": ["2.4", "2.5", "2.7"] },
    { "id": 4, "tasks": ["2.6"] },
    { "id": 5, "tasks": ["2.8"] },
    { "id": 6, "tasks": ["4.1"] },
    { "id": 7, "tasks": ["4.2"] },
    { "id": 8, "tasks": ["4.3"] },
    { "id": 9, "tasks": ["4.4"] },
    { "id": 10, "tasks": ["4.5"] },
    { "id": 11, "tasks": ["6.1", "6.2", "6.3", "6.4"] },
    { "id": 12, "tasks": ["6.5", "6.6"] },
    { "id": 13, "tasks": ["6.7"] },
    { "id": 14, "tasks": ["8.1", "8.2"] },
    { "id": 15, "tasks": ["8.3"] },
    { "id": 16, "tasks": ["10.1", "10.2"] },
    { "id": 17, "tasks": ["10.3"] }
  ]
}
```
