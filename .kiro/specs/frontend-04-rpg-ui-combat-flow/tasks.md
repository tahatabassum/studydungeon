# Implementation Plan: frontend-04-rpg-ui-combat-flow

## Overview

Language: TypeScript (React 19, Phaser 3.90, Vitest, fast-check). All paths are relative to `frontend/` unless noted. The plan follows the design's defaults for decisions D1 to D20.

Git precondition (D11, not a coding task, done by the user before task 1.1): commit the completed frontend-03 work on `feature/frontend-phaser-core`, push it, open a pull request, merge it to `main`, then create `feature/frontend-rpg-polish` from the updated `main` and work there.

Working rules for every task:

- After each task run the relevant tests, `npm run typecheck` and `npm run build`. Fix failures before moving on.
- Keep the Import_Boundary: nothing under `src/game/` imports `@/api`, `@/demo` or `@/state`. `src/art/` and `src/audio/` import none of those either and never import Phaser (`src/art/`).
- No hard-coded room or monster data in scenes. No combat math in Phaser or in the reducer. No second engine. New dependencies are exact-pinned (`npm install --save-exact`).
- Do not modify `docs/` except `docs/handoff/B-to-A.md`. Do not modify `backend/`, `.kiro/steering/` or other specs.
- Test tasks are required in this spec (not optional). Each phase ends with a checkpoint that includes a short manual browser checklist for the user at 1366x768, 1920x1080 and 1280x720.

## Tasks

- [x] 1. Phase 1: Continuous question flow (no visual changes)
  - [x] 1.1 Remove deprecated bridge events and the legacy scene path
    - Remove `load-room` and `room-cleared` from `src/game/events.ts`; remove the `legacy` flag, `legacyGate` and their handlers from `src/game/scenes/GameScene.ts`; update `src/game/events.test.ts`
    - Search `src/` for remaining uses and fix them
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [x] 1.2 Create combat helpers `src/state/combatMachine.ts`
    - Export `CombatState`, `READ_DELAY_CORRECT_MS` (1200), `READ_DELAY_WRONG_MS` (2000), `readDelayMs`, `isCombatActive`, `canRetreat`, `canAnswer`, `damageReceived`
    - Add `src/state/combatMachine.test.ts` with unit tests for each helper
    - _Requirements: 2.3, 2.6, 3.2, 4.2, 5.1_
  - [x] 1.3 Add the combat sub-state to `src/state/runReducer.ts`
    - Add `combat` and `prevPlayerHp` to `RunState`; add actions `question-presented`, `answer-submitted`, `answer-failed`, `advance`, `retreat`; apply the guards and phase mapping from the design
    - `result-received` accepts only from `submitting`; `result-settled` moves `result` to `next`, `monster_defeated` or `player_defeated` and keeps phase `resolving`; `advance` closes terminals (phase `cleared` or `defeated`) and moves `next` to `question`
    - `pause` is accepted from `exploring` or from `encounter` with `combat === 'question'`
    - Update `src/state/runReducer.test.ts`, `runReducer.rooms.test.ts` and `runReducer.victory.test.ts` deliberately, listing each changed expectation in the commit message
    - _Requirements: 1.4, 1.5, 1.6, 2.1, 2.7, 3.1, 3.3, 3.4, 3.5, 3.6, 5.2, 5.4, 5.5, 6.1, 7.1_
  - [x] 1.4 Write property test for one encounter per engagement
    - Create `src/state/combatMachine.property.test.ts` with a shared action-sequence generator
    - **Property 2: One encounter per engagement**
    - **Validates: Requirements 1.4, 1.5, 1.6**
  - [x] 1.5 Write property test for continuous question flow
    - **Property 3: Continuous question flow**
    - **Validates: Requirements 2.1, 2.2**
  - [x] 1.6 Write property test for at most one submission in flight
    - **Property 4: At most one submission in flight**
    - **Validates: Requirements 3.1, 3.2, 3.3**
  - [x] 1.7 Write property test for next question never before the result settles
    - **Property 5: Next question never before the result settles**
    - **Validates: Requirements 2.3**
  - [x] 1.8 Write property test for encounter ends exactly at zero HP
    - Generate results with the pure `applyAnswer` from `src/demo/rules.ts` (check its signature first)
    - **Property 6: Encounter ends exactly at zero HP**
    - **Validates: Requirements 2.7, 6.1, 7.1**
  - [x] 1.9 Write property test for retreat and pause only from the question state
    - **Property 7: Retreat and pause only from the question state**
    - **Validates: Requirements 3.5, 5.1, 5.2, 5.4, 5.5**
  - [x] 1.10 Write property test for reducer copies values from the result
    - Use arbitrary `AnswerResult` values, not rule-derived ones
    - **Property 8: Reducer copies values from the result**
    - **Validates: Requirements 3.6**
  - [x] 1.11 Add the pure engage rule and update the Interaction_System
    - Add `shouldEngage` to `src/game/systems/interaction.ts`; use it in `src/game/systems/InteractionSystem.ts`; change the prompt to "Press E to engage"; keep Space as an alias; re-arm when the phase is not `exploring` or no engage key is held
    - Add example tests to `src/game/systems/interaction.test.ts` (E ignored while not exploring)
    - _Requirements: 1.1, 1.2, 1.3, 1.7_
  - [x] 1.12 Write property test for the engage rule
    - Create `src/game/systems/interaction.property.test.ts`
    - **Property 1: Engage rule**
    - **Validates: Requirements 1.2, 1.3, 1.7**
  - [x] 1.13 Rework encounter start and submission in `src/pages/usePlaySession.ts`
    - On `encounter-started`: guard with reducer state, dispatch `encounter-started`, pick the question (counter per monster id), dispatch `question-presented`
    - `onAnswer`: return unless `canAnswer(combat)`; dispatch `answer-submitted` before the request; keep one `attempt_id` per presented question and reuse it on retry; dispatch `answer-failed` on error
    - `result-animation-done` dispatches `result-settled`
    - _Requirements: 1.4, 1.5, 3.1, 3.3, 3.4_
  - [x] 1.14 Add auto-advance to `src/pages/usePlaySession.ts`
    - Effect on `combat` in `next`, `monster_defeated`, `player_defeated`: timer of `readDelayMs(lastResult.correct)` dispatching `advance`; clear on change and unmount; export `skipWait` for the Next control and Enter
    - On `advance` from `next` present the next question; from `monster_defeated` close the panel and call `clear(roomId)` exactly once; from `player_defeated` close the panel
    - Remove the old `onContinue` Continue flow
    - _Requirements: 2.1, 2.3, 2.4, 2.6, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1, 7.2_
  - [x] 1.15 Add retreat and pause rules and the pause-menu retreat action
    - In `src/pages/usePlaySession.ts`: `retreat()` only when `canRetreat`; Esc pauses from `exploring` and from `question`, ignored otherwise
    - Add an optional `onRetreat` prop to `src/components/PauseMenu.tsx` that shows "Retreat from battle"
    - _Requirements: 3.5, 5.2, 5.3, 5.4, 5.5, 5.6, 16.3_
  - [x] 1.16 Keep the Question_Panel open through the encounter
    - `src/components/QuestionPanel.tsx`: new props `combat`, `damageReceived`, `onNext`, `onRetreat`, `keysEnabled`; disable options unless `canAnswer`; ignore 1 to 4 when `keysEnabled` is false; replace "Continue" with "Next" (Enter triggers it); focus the first option on each new question; Retreat control only in `question`; animated question change keyed by `question.id`
    - `src/pages/PlayPage.tsx`: show the panel while combat is active, pass the new props, show "From your notes" and damage lines
    - _Requirements: 2.2, 3.2, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 5.1, 5.7_
  - [x] 1.17 Update and extend `src/pages/PlayFlow.smoke.test.tsx`
    - Try the Demo, one `encounter-started`, three correct answers with fake timers and no further `encounter-started`, monster defeated, `clearRoom` once, `gate-open` sent, panel closed
    - Wrong-answer path auto-advances; two rapid clicks produce one `submitAttempt`; failing then succeeding submit reuses the `attempt_id`; Esc in `question` opens pause with "Retreat from battle"; retreat then a new `encounter-started` shows the next question; existing room-2 test updated for the new flow
    - _Requirements: 22.3, 22.4, 22.1_
  - [x] 1.18 Checkpoint - Phase 1
    - Ensure all tests pass, ask the user if questions arise.
    - Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`
    - Browser checklist: press E once, three questions follow with no E, wrong answer auto-advances, Esc in a question shows Retreat, retreat then E resumes, monster defeat opens the gate, HP 0 shows defeat

- [x] 2. Phase 2: Design system and typography
  - [x] 2.1 Install and wire self-hosted fonts
    - `npm install --save-exact @fontsource/pirata-one @fontsource/cinzel @fontsource/inter`; import `latin-400` (Pirata One), `latin-400` and `latin-700` (Cinzel), `latin-400` and `latin-600` (Inter) CSS in `src/main.tsx`
    - Add `--font-display`, `--font-label`, `--font-body` with fallbacks to `src/index.css`
    - Create `ASSETS_LICENSES.md` (in `frontend/`) with the three fonts, OFL license and source links
    - _Requirements: 10.1, 10.2, 10.3, 10.5, 23.1, 23.2_
  - [x] 2.2 Replace color tokens in `src/index.css` and add token tests
    - Define the ten palette colors with semantic names (`--color-bg`, `--color-surface-2`, `--color-panel`, `--color-deep`, `--color-magic`, `--color-accent`, `--color-ink`, `--color-danger`, `--color-health`, `--color-gold`) and remove the legacy tokens
    - Add `src/design/tokens.test.ts` that parses `index.css`: palette values present and AA contrast (4.5:1 body, 3:1 large and borders) for the declared text and background pairs
    - _Requirements: 9.1, 9.2, 9.4_
  - [x] 2.3 Migrate component class names to the new tokens
    - Update every file in `src/components/` that uses `bg-background`, `text-parchment`, `text-amber`, `text-mint`, `text-purple`, `text-muted`, `border-blood`, `bg-panel` and similar
    - _Requirements: 9.2_
  - [x] 2.4 Migrate pages and app shell to the new tokens
    - Update `src/pages/PlayPage.tsx`, `LandingPage.tsx`, `LoginPlaceholder.tsx`, `src/App.tsx`, `src/game/GameCanvas.tsx` class names
    - _Requirements: 9.2_
  - [x] 2.5 Share palette colors with Phaser code
    - Create `src/game/colors.ts` (numeric palette values mirroring `index.css`) and replace hard-coded hex values in `src/game/scenes/`, `src/game/entities/` and `src/game/systems/EffectsSystem.ts`; add a test that the numeric values equal the `index.css` palette
    - _Requirements: 9.1, 9.2_
  - [x] 2.6 Create shared UI primitives
    - Add `src/components/Panel.tsx` and `src/components/Frame.tsx` (ornate border, consistent radius and spacing); restyle `src/components/Button.tsx` with variants and a visible focus ring
    - _Requirements: 9.3, 9.5_
  - [x] 2.7 Add source scan tests
    - Create `src/design/scans.test.ts`: no emoji in `src`, no legacy token class names, `@fontsource/*` versions in `package.json` are exact, `main.tsx` imports only `latin-*` files
    - _Requirements: 9.2, 9.6, 10.1, 10.3, 23.1_
  - [x] 2.8 Make Phaser text wait for fonts
    - Create `src/game/fonts.ts` with `waitForFonts(ready, timeoutMs)` and a unit test with fake promises; call it in `BootScene` before starting `GameScene`; use the font tokens (with fallback stack) for Phaser text
    - _Requirements: 10.4_
  - [x] 2.9 Checkpoint - Phase 2
    - Ensure all tests pass, ask the user if questions arise.
    - Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`
    - Browser checklist: new colors everywhere, gothic headings, readable body text, focus rings visible, no horizontal scroll

- [x] 3. Phase 3: HUD, room progression and question panel
  - [x] 3.1 Create the pixel-art core in `src/art/`
    - `src/art/palette.ts` (shared palette), `src/art/pixelMap.ts` (`PixelMap`, `validatePixelMap`, `pixelMapToRgba`, `pixelMapToRuns`); no Phaser import
    - _Requirements: 14.1, 14.2, 14.3, 14.4_
  - [x] 3.2 Write property test for pixel map validation and rendering
    - Create `src/art/pixelMap.property.test.ts`
    - **Property 12: Pixel map validation and rendering**
    - **Validates: Requirements 14.1, 14.3, 14.4**
  - [x] 3.3 Create the React `PixelSprite` and HUD icon maps
    - `src/components/PixelSprite.tsx` (inline SVG from runs, `shape-rendering="crispEdges"`, accessible label or `aria-hidden`); `src/art/sprites/icons.ts` (heart, crown, lock, check)
    - Add `src/components/PixelSprite.test.tsx`
    - _Requirements: 14.5, 9.6_
  - [x] 3.4 Author the original monster and player base sprites
    - `src/art/sprites/monsters.ts` (paper wraith, toxic slime, gear golem, memory eater, exam warden, 32x32 or smaller) and `src/art/sprites/player.ts`; add a registry export and a test that every map validates
    - _Requirements: 14.1, 14.7, 15.5_
  - [x] 3.5 Add `getProgress()` to the API contract
    - `src/types/api.ts` (`ProgressInfo`), `src/api/ApiClient.ts`, `src/api/client.ts` (`GET /progress`), `src/api/mock/mockAdapter.ts` (level and `xp_to_next` computed only here, from run XP); update `src/api/client.test.ts`, `src/api/index.test.ts`, `src/api/mock/mockAdapter.test.ts`
    - _Requirements: 20.1, 20.2_
  - [x] 3.6 Write property test for mock progress
    - Create `src/api/mock/progress.property.test.ts`
    - **Property 17: Mock progress is monotonic**
    - **Validates: Requirements 20.2**
  - [x] 3.7 Create HUD helpers
    - `src/components/hudHelpers.ts` with `isLowHealth` and `roomMarkerState`
    - _Requirements: 11.2, 12.1_
  - [x] 3.8 Write property test for the low-health predicate
    - Create `src/components/hudHelpers.test.ts`
    - **Property 10: Low-health predicate**
    - **Validates: Requirements 11.2**
  - [x] 3.9 Write property test for room marker state
    - Same file as 3.8
    - **Property 11: Room marker state**
    - **Validates: Requirements 12.1, 12.2**
  - [x] 3.10 Rebuild the HUD player and XP blocks
    - `src/components/Hud.tsx`, `src/components/ProgressBar.tsx`: heart icon, current and maximum, smooth bar, low-health warning with icon and text, magical XP bar with gain animation (instant under reduced motion), streak
    - _Requirements: 11.1, 11.2, 11.4, 11.5_
  - [x] 3.11 Rebuild the HUD monster block
    - `src/components/Hud.tsx`: portrait from the monster pixel map, name, current and maximum, animated bar, shown during an encounter or in a room with a living monster
    - _Requirements: 11.3_
  - [x] 3.12 Wire the level display
    - `src/pages/usePlaySession.ts`: call `getProgress()` after run start and after each monster defeat, ignore errors; `src/components/Hud.tsx`: show level, total XP and XP to next exactly as returned, hidden when absent; add a hook or component test for the failure case
    - _Requirements: 11.6, 11.7, 20.3_
  - [x] 3.13 Restyle the guest banner and add the controls hint
    - `src/components/GuestBanner.tsx` (less dominant, themed "Create Account"); new `src/components/ControlsHint.tsx` listing WASD, E, Esc and 1 to 4; update the banner's existing test if present
    - _Requirements: 11.8, 11.9_
  - [x] 3.14 Redesign `src/components/RoomProgress.tsx`
    - Use `roomMarkerState`; cleared, glowing current, locked, crown for boss; icon plus accessible text; subtle transitions disabled by reduced motion; keep the "Room N of M: label" text used by tests
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_
  - [x] 3.15 Style the Question_Panel as a spellbook
    - `src/components/QuestionPanel.tsx` and `src/components/SourceLine.tsx`: parchment surface, dark ornate frame, gothic heading, body font at least 16 px, 2x2 option grid with number badges, hover and selected states, green and gold correct styling, red incorrect styling, damage dealt and received chips
    - Add `src/components/QuestionPanel.test.tsx` (keys 1 to 4, disabled states, labels, `keysEnabled` false ignores keys)
    - _Requirements: 4.1, 4.2, 4.5, 5.7, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_
  - [x] 3.16 Add the view inset to the bridge and scene
    - `src/game/events.ts`: `{ type: 'set-view-inset'; bottomFraction: number }`; `src/game/scenes/GameScene.ts`: clamp to 0 to 0.45 and call `cameras.main.setFollowOffset`; extend `src/game/events.test.ts`
    - _Requirements: 13.7_
  - [x] 3.17 Dock the panel and rebuild the play screen layout
    - `src/pages/PlayPage.tsx`: panel docked at the bottom of the play area (at most 45 percent of canvas height), Hud, Room_Progress, guest banner and controls hint arranged; `src/pages/usePlaySession.ts`: send `set-view-inset` with 0.45 while the panel is open and 0 otherwise
    - _Requirements: 13.7, 11.8, 21.1_
  - [x] 3.18 Checkpoint - Phase 3
    - Ensure all tests pass, ask the user if questions arise.
    - Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`
    - Browser checklist at the three resolutions: HUD fits, panel docked, player and monster visible above the panel, level shows or is hidden, room progress states, keys 1 to 4

- [x] 4. Phase 4: Environments and monster visuals
  - [x] 4.1 Create the theme selector
    - `src/game/world/roomTheme.ts`: `ThemeId`, `RoomTheme`, `selectTheme(kind, isBoss)`, theme registry (floor palette, decor specs, particle spec within the global cap, light); the `entry` decor is layered onto `library` near the entrance (D1)
    - _Requirements: 15.1, 15.2, 15.3, 15.4_
  - [x] 4.2 Write property test for theme selection
    - Create `src/game/world/roomTheme.property.test.ts`
    - **Property 13: Theme selection is data-driven**
    - **Validates: Requirements 15.1, 15.2, 15.3**
  - [x] 4.3 Add frame derivation
    - `src/art/frames.ts`: `deriveFrames(base, kind)` for idle, attack, hit and death frames by offsets, recoloring and erosion; unit tests that every derived frame validates
    - _Requirements: 14.1, 14.4, 15.5_
  - [x] 4.4 Author decor sprites and player frames
    - `src/art/sprites/decor.ts` (bookshelf, floating book, cauldron, potion, puddle, gear, chain, tomb, rune, column, gate, cobweb, candle, painting, lantern, steam puff) and walk frames in `src/art/sprites/player.ts`
    - _Requirements: 14.1, 14.7, 15.4_
  - [x] 4.5 Render pixel maps into Phaser textures at boot
    - `src/game/textures/registerArt.ts` (uses `pixelMapToRgba`, adds spritesheets and frames, logs and uses a placeholder for invalid maps); call it from `src/game/scenes/BootScene.ts`, replacing the procedural monster and player textures; set `pixelArt: true` in `src/game/config.ts` (D18)
    - _Requirements: 14.4, 14.1_
  - [x] 4.6 Switch monsters to spritesheets
    - `src/game/entities/monsterStyles.ts` (texture keys, animation names, scale per kind) and `src/game/entities/Monster.ts` (idle loop, `playAttack`, `playHit`, `playDeath`); update `src/game/entities/monsterStyles.test.ts`
    - _Requirements: 15.5_
  - [x] 4.7 Switch the player to a sprite with idle and walk animation
    - `src/game/entities/Player.ts`; animation stops when movement stops; static frame under reduced motion
    - _Requirements: 14.4, 18.2_
  - [x] 4.8 Add the room decorator and themed floors
    - `src/game/world/RoomDecorator.ts` draws decor from `selectTheme` in a non-colliding depth layer; update `src/game/scenes/GameScene.ts` to use theme floor palettes and the decorator; no hard-coded room ids or labels
    - _Requirements: 15.1, 15.4, 15.7_
  - [x] 4.9 Write registry consistency test
    - Create `src/game/world/registries.test.ts`
    - **Property 14: Registries are consistent**
    - **Validates: Requirements 14.1, 15.4, 18.1**
  - [x] 4.10 Boss visuals
    - Larger exam warden with glowing eyes using `getMonsterStyle`; keep the boss scale; update `monsterStyles.test.ts` if values change
    - _Requirements: 15.5, 15.6_
  - [x] 4.11 Hook monster animations into the Effects_System
    - `src/game/systems/EffectsSystem.ts` and `combatPlan.ts` (step names only): call `playAttack` on a wrong answer, `playHit` on a correct answer, `playDeath` on defeat; `combatPlan.test.ts` keeps passing and gains cases for the new steps
    - _Requirements: 15.5, 18.5, 18.6_
  - [x] 4.12 Checkpoint - Phase 4
    - Ensure all tests pass, ask the user if questions arise.
    - Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`
    - Browser checklist: five visibly different rooms, crisp pixel art, monsters animate in idle, attack, hit and death, boss looks larger, movement still collides correctly

- [ ] 5. Phase 5: Pause, victory, defeat and menus
  - [~] 5.1 Create a shared Overlay shell
    - `src/components/OverlayFrame.tsx`: modal container with focus trap, Esc handling where allowed, focus return, gothic heading; add `src/components/OverlayFrame.test.tsx` (Tab cycle, focus return)
    - _Requirements: 16.1, 16.2_
  - [~] 5.2 Restyle the pause menu and exit confirmation
    - `src/components/PauseMenu.tsx` and `src/components/ConfirmDialog.tsx` on `OverlayFrame`; keep Resume, Restart, mute, Exit and "Retreat from battle"; exit still needs confirmation
    - _Requirements: 16.1, 16.3, 16.6_
  - [~] 5.3 Restyle victory and defeat overlays
    - `src/components/VictoryOverlay.tsx` (run summary, retry on error) and `src/components/DefeatOverlay.tsx` (final XP, score, retry); update their existing tests
    - _Requirements: 16.1, 16.4, 16.5, 7.2_
  - [~] 5.4 Author the decorative UI character sprites
    - `src/art/sprites/characters.ts`: friendly ghost, small vampire, skeleton companion, bat, black cat, haunted portrait; add them to the validation registry test
    - _Requirements: 14.5, 14.7_
  - [~] 5.5 Restyle the landing page
    - `src/pages/LandingPage.tsx` and `src/pages/LoginPlaceholder.tsx`: palette, gothic headings and `PixelSprite` characters placed outside the arena; "Try the Demo" remains one click; update the existing landing test
    - _Requirements: 17.1, 17.2, 14.6_
  - [~] 5.6 Checkpoint - Phase 5
    - Ensure all tests pass, ask the user if questions arise.
    - Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`
    - Browser checklist: pause, exit confirmation, victory, defeat, landing page themed; Tab stays inside overlays; Esc behavior correct

- [ ] 6. Phase 6: Atmosphere, animations and optional sound
  - [~] 6.1 Create the object pool
    - `src/game/systems/objectPool.ts` (`ObjectPool<T>` with create, reset, max)
    - _Requirements: 18.4_
  - [~] 6.2 Write property test for pool reuse
    - Create `src/game/systems/objectPool.property.test.ts`
    - **Property 15: Pool reuse**
    - **Validates: Requirements 18.4**
  - [~] 6.3 Add the atmosphere system
    - `src/game/systems/AtmosphereSystem.ts`: dust, fog, torch flicker, theme magic particles from the room theme, capped by the global particle cap, disabled or static under reduced motion; created and destroyed by `GameScene`
    - _Requirements: 18.1, 18.3_
  - [~] 6.4 Pool damage numbers and effects
    - `src/game/systems/EffectsSystem.ts`: use `ObjectPool` for floating text and spark images, no per-frame allocation, values only from `AnswerResult`; keep exactly one `result-animation-done`
    - _Requirements: 18.4, 18.5, 18.6_
  - [~] 6.5 Add transitions and entrances
    - `src/game/scenes/GameScene.ts`, `src/game/entities/Gate.ts`, `src/game/entities/Monster.ts`: door opening, room transition fade, monster intro, boss entrance (movement effects skipped under reduced motion)
    - _Requirements: 15.6, 18.2, 18.3_
  - [~] 6.6 Create the sound engine
    - `src/audio/sfx.ts`: Web Audio synthesis for footstep, growl, attack, hit, correct, wrong, gate, victory, defeat; `unlock()` creates the context, injectable context factory, quiet master gain (at most 0.3), no audio files, no failures when the context cannot be created
    - _Requirements: 19.1, 19.2, 19.3, 19.5, 19.7_
  - [~] 6.7 Write property test and unit tests for the sound engine
    - Create `src/audio/sfx.property.test.ts` plus unit tests for cues, default volume and the throwing factory
    - **Property 16: Sound mute gating**
    - **Validates: Requirements 19.2, 19.4, 19.7**
  - [~] 6.8 Wire sound
    - React: `src/pages/usePlaySession.ts` plays correct, wrong, victory and defeat cues and calls `sfx.setMuted` with the mute state; call `sfx.unlock()` on the first key or pointer event in `PlayPage`; Phaser: footstep in `MovementSystem.ts`, growl on engage, attack and hit in `EffectsSystem.ts`, gate in `Gate.ts`
    - Keep the Import_Boundary test green
    - _Requirements: 19.3, 19.4, 19.6_
  - [~] 6.9 Audit reduced motion across CSS, Framer Motion and Phaser
    - Search `src/` for `animate`, `transition`, `tweens.add`, `particles` and keyframes; make each respect `useReducedMotion`, the CSS media query and the `set-reduced-motion` event; add a test for any new helper
    - _Requirements: 18.3, 2.6, 4.6_
  - [~] 6.10 Checkpoint - Phase 6
    - Ensure all tests pass, ask the user if questions arise.
    - Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`
    - Browser checklist: dust, fog, torches, particles; damage numbers; door and boss entrance; sounds on first key press; mute silences everything; enabling "reduce motion" in the OS removes movement effects

- [ ] 7. Phase 7: Responsive layout, regression and polish
  - [~] 7.1 Make the play screen responsive
    - `src/pages/PlayPage.tsx`, `src/index.css`: canvas scales with aspect ratio; HUD, panel and controls hint fit with no horizontal scroll at 1280x720, 1366x768 and 1920x1080; keyboard and mouse both complete the flow
    - _Requirements: 21.1, 21.2, 21.3_
  - [~] 7.2 Review per-frame allocations
    - Inspect `update()` paths in `src/game/` (`GameScene`, `MovementSystem`, `InteractionSystem`, `RoomTracker`, `AtmosphereSystem`); remove object creation per frame; document findings in the commit message
    - _Requirements: 21.4, 18.4_
  - [~] 7.3 Accessibility pass
    - Add `aria-live` announcements for results and level changes, labels for icons and controls, verify focus order in the panel and overlays; extend component tests
    - _Requirements: 4.1, 9.5, 12.1, 16.2_
  - [~] 7.4 Finalize `ASSETS_LICENSES.md`
    - List every art set (monsters, player, decor, icons, characters) as original, audio as original synthesis, fonts with OFL links; add `src/design/licenses.test.ts` checking that every registered art set name appears in the file
    - _Requirements: 14.7, 10.5, 23.2, 23.3_
  - [~] 7.5 Update `docs/handoff/B-to-A.md`
    - Add the `getProgress()` section (`GET /progress`, marked NEW and not yet implemented by Person A), note that `AnswerResult` is unchanged, and note the removed bridge events are frontend-internal
    - _Requirements: 20.4_
  - [~] 7.6 Final checkpoint - full regression
    - Ensure all tests pass, ask the user if questions arise.
    - Run `npm run typecheck`, `npm run lint`, `npm test` (all prior tests plus new ones), `npm run build`
    - Manual checklist at 1366x768, 1920x1080 and 1280x720: full demo run (5 rooms, boss, victory), a defeat run, retreat and re-engage, pause and exit, mute, reduced motion

## Notes

- Test tasks are required in this spec and are not marked optional.
- Each task references granular requirement clauses for traceability.
- Property tests use fast-check with at least 100 runs and a comment tag `Feature: frontend-04-rpg-ui-combat-flow, Property N: <title>`.
- Visual checks are manual by the user; automated tests run in jsdom with Phaser mocked at the bridge.
- This workflow produces planning artifacts only. To start, open this file and click "Start task" next to a task item.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.11"] },
    { "id": 2, "tasks": ["1.4", "1.12", "1.13"] },
    { "id": 3, "tasks": ["1.5", "1.14"] },
    { "id": 4, "tasks": ["1.6", "1.15"] },
    { "id": 5, "tasks": ["1.7", "1.16"] },
    { "id": 6, "tasks": ["1.8", "1.17"] },
    { "id": 7, "tasks": ["1.9"] },
    { "id": 8, "tasks": ["1.10"] },
    { "id": 9, "tasks": ["2.1"] },
    { "id": 10, "tasks": ["2.2"] },
    { "id": 11, "tasks": ["2.3", "2.4", "2.5"] },
    { "id": 12, "tasks": ["2.6", "2.7", "2.8"] },
    { "id": 13, "tasks": ["3.1", "3.5", "3.7"] },
    { "id": 14, "tasks": ["3.2", "3.3", "3.4", "3.6", "3.8"] },
    { "id": 15, "tasks": ["3.9", "3.10", "3.14", "3.15", "3.16"] },
    { "id": 16, "tasks": ["3.11", "3.13"] },
    { "id": 17, "tasks": ["3.12"] },
    { "id": 18, "tasks": ["3.17"] },
    { "id": 19, "tasks": ["4.1", "4.3"] },
    { "id": 20, "tasks": ["4.2", "4.4"] },
    { "id": 21, "tasks": ["4.5"] },
    { "id": 22, "tasks": ["4.6", "4.7", "4.8"] },
    { "id": 23, "tasks": ["4.9", "4.10"] },
    { "id": 24, "tasks": ["4.11"] },
    { "id": 25, "tasks": ["5.1", "5.4"] },
    { "id": 26, "tasks": ["5.2", "5.3"] },
    { "id": 27, "tasks": ["5.5"] },
    { "id": 28, "tasks": ["6.1", "6.6"] },
    { "id": 29, "tasks": ["6.2", "6.3", "6.4", "6.7"] },
    { "id": 30, "tasks": ["6.5"] },
    { "id": 31, "tasks": ["6.8"] },
    { "id": 32, "tasks": ["6.9"] },
    { "id": 33, "tasks": ["7.1", "7.4", "7.5"] },
    { "id": 34, "tasks": ["7.2", "7.3"] }
  ]
}
```
