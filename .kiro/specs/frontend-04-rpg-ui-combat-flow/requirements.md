# Requirements Document

## Introduction

This feature adds a continuous combat flow and a classic dark-fantasy Halloween RPG identity to the Study Dungeon frontend. It builds on the completed baselines `frontend-00-playable-slice` and `frontend-03-phaser-core` (React + TypeScript + Phaser 3, single canvas, typed Event_Bridge, five-room dungeon, backend-authoritative combat, Mock_Adapter).

Two goals drive the work:

1. Continuous combat. After the player presses E once next to a monster, an Encounter starts, the Question_Panel opens, and further questions follow automatically until the monster is defeated or the player is defeated. No further E presses are needed between questions.
2. RPG identity. A new palette, typography, HUD, room progression, question panel, themed rooms, monster visuals, overlays, atmosphere, animations and optional synthesized sound, all original and without licensing risk.

Out of scope: combat math in the frontend, a second game engine, new backend endpoints being implemented, rewriting existing systems, removing existing features.

## Glossary

- **Game_Client**: The React + Phaser frontend application in `frontend/`.
- **Combat_Controller**: The React-side logic (reducer sub-state plus session hook) that owns the Encounter lifecycle.
- **Combat_State**: The sub-state of the Run_State reducer with values `starting`, `question`, `submitting`, `result`, `next`, `monster_defeated`, `player_defeated`, `exited`, or no value while exploring.
- **Encounter**: One continuous fight against one monster, from the first E press until the monster is defeated, the player is defeated, or the player retreats.
- **Question_Panel**: The React panel that shows the current question, answer options and result feedback.
- **Run_Reducer**: The pure reducer in `src/state/runReducer.ts` that copies authoritative values from Answer_Results.
- **Answer_Result**: The `AnswerResult` object returned by the Api_Client for an attempt. The backend or Mock_Adapter is authoritative for all values in it.
- **Api_Client**: The `ApiClient` interface implemented by the real HTTP client and by the Mock_Adapter.
- **Mock_Adapter**: The in-memory implementation of Api_Client containing the only mock game rules.
- **Event_Bridge**: The typed event channel between React and Phaser defined in `src/game/events.ts`.
- **Game_Scene**: The Phaser scene that displays the dungeon, player, monsters and effects.
- **Interaction_System**: The Phaser system that shows the engage prompt and emits `encounter-started`.
- **Effects_System**: The Phaser system that plays result animations and emits `result-animation-done`.
- **Import_Boundary**: The rule that code under `src/game/` does not import from `@/api`, `@/demo` or `@/state`.
- **Read_Delay**: The pause between a settled result and the next question: 1200 ms after a correct answer and 2000 ms after a wrong answer.
- **Reduced_Motion**: The state in which the user prefers reduced motion, from `prefers-reduced-motion` via `useReducedMotion`.
- **Design_Tokens**: The semantic color, font and spacing tokens defined in `src/index.css`.
- **Palette**: The ten RPG colors: background `#100B18`, secondary `#1C1427`, panel `#251A32`, deep purple `#39244F`, magic purple `#9B5DE5`, orange `#FF9F1C`, ghost white `#F5EBDD`, blood red `#C83E4D`, health green `#59C9A5`, gold `#E9B44C`.
- **Pixel_Art_Module**: The pure TypeScript module under `src/art/` containing palette-indexed pixel maps and no Phaser import.
- **Room_Theme**: A named visual set (decorations, lighting, particles) applied to a room.
- **Theme_Selector**: The pure function that chooses a Room_Theme from `monster.kind` and `is_boss`.
- **Hud**: The React heads-up display showing player health, monster health, XP, level, streak and room progression.
- **Room_Progress**: The React component that shows cleared, current, locked and boss rooms.
- **Sfx_Engine**: The synthesized Web Audio sound effect module.
- **Overlay**: A themed React screen for pause, exit confirmation, victory or defeat.
- **Level_Source**: The Api_Client method `getProgress()` that returns `level`, `total_xp` and `xp_to_next`.

## Requirements

### Requirement 1: Single engagement starts one Encounter

**User Story:** As a player, I want to press E once next to a monster to start a fight, so that I engage deliberately and never trigger duplicate fights.

#### Acceptance Criteria

1. WHILE the Game_Client is exploring and the player is within interaction range of a living monster, THE Interaction_System SHALL display the prompt "Press E to engage".
2. WHEN the player presses E while exploring within range of a living monster, THE Interaction_System SHALL emit exactly one `encounter-started` event.
3. WHILE an Encounter is active, THE Interaction_System SHALL ignore E and Space key presses and hide the engage prompt.
4. WHEN the Combat_Controller receives `encounter-started` while Combat_State is empty and the phase is exploring, THE Combat_Controller SHALL set Combat_State to `starting`, select the first question and set Combat_State to `question`.
5. IF the Combat_Controller receives `encounter-started` while an Encounter is active, THEN THE Combat_Controller SHALL ignore the event.
6. WHILE an Encounter is active, THE Game_Scene SHALL lock player movement.
7. WHEN an Encounter ends, THE Interaction_System SHALL re-arm only after the phase has returned to exploring.

### Requirement 2: Continuous question flow

**User Story:** As a player, I want the next question to appear automatically after each answer, so that I stay focused on studying without extra key presses.

#### Acceptance Criteria

1. WHEN a result has settled and both the player and the monster have more than zero health points, THE Combat_Controller SHALL set Combat_State to `next` and present the next question for the same monster without emitting `encounter-started`.
2. WHILE an Encounter is active, THE Question_Panel SHALL remain open between questions.
3. WHEN a result has settled, THE Combat_Controller SHALL wait for both `result-animation-done` and the reducer result to be settled, and then wait for the Read_Delay before presenting the next question.
4. WHEN the player activates the Next control or presses Enter during the Read_Delay, THE Combat_Controller SHALL present the next question immediately.
5. THE Combat_Controller SHALL select each question with the existing Question_Selector so that questions cycle through the monster's question pool.
6. WHILE Reduced_Motion is active, THE Combat_Controller SHALL skip result animations and apply the same Read_Delay values.
7. THE Combat_Controller SHALL end an Encounter exactly when the monster health reaches zero, the player health reaches zero, or the player retreats.

### Requirement 3: Safe answer submission

**User Story:** As a player, I want my answer to be submitted exactly once, so that clicking quickly does not cause errors or double damage.

#### Acceptance Criteria

1. WHEN the player selects an answer while Combat_State is `question`, THE Combat_Controller SHALL set Combat_State to `submitting` and call `submitAttempt` once with a new `attempt_id`.
2. WHILE Combat_State is `submitting`, `result`, `next`, `monster_defeated` or `player_defeated`, THE Question_Panel SHALL disable all answer controls and ignore keys 1 to 4.
3. WHILE a submission is in flight, THE Combat_Controller SHALL ignore additional answer selections.
4. IF `submitAttempt` fails, THEN THE Combat_Controller SHALL set Combat_State back to `question`, display an error message and reuse the same `attempt_id` for the retry.
5. WHILE Combat_State is `submitting`, THE Game_Client SHALL prevent the Encounter from closing, including retreat, Esc and pause.
6. THE Run_Reducer SHALL copy player health, monster health, streak, XP and score only from the Answer_Result and SHALL NOT compute damage or health.

### Requirement 4: Result feedback in the Question_Panel

**User Story:** As a player, I want to see whether I was right, what changed and where the answer is in my notes, so that each answer teaches me something.

#### Acceptance Criteria

1. WHEN a result is displayed, THE Question_Panel SHALL show a "Correct" or "Incorrect" label, with an icon or text in addition to color.
2. WHEN a result is displayed, THE Question_Panel SHALL show the damage dealt and the damage received derived from the Answer_Result and the previous health values.
3. WHEN a result is displayed, THE Question_Panel SHALL show "From your notes: page X" using `source.page`.
4. WHERE the Answer_Result contains an explanation, THE Question_Panel SHALL show the explanation.
5. WHEN a result is displayed, THE Question_Panel SHALL mark the selected option as correct or incorrect.
6. WHEN the Question_Panel changes from one question to the next, THE Question_Panel SHALL play an animated transition, and SHALL show the new question without animation WHILE Reduced_Motion is active.
7. WHEN the next question is presented, THE Question_Panel SHALL move keyboard focus to the first answer option.
8. WHERE the Next control is visible, THE Question_Panel SHALL label it "Next" and SHALL make it reachable by keyboard.

### Requirement 5: Retreat from an Encounter

**User Story:** As a player, I want to retreat from a fight between answers, so that I can leave without being forced to finish.

#### Acceptance Criteria

1. WHILE Combat_State is `question`, THE Question_Panel SHALL show a "Retreat from battle" control.
2. WHEN the player activates the retreat control while Combat_State is `question`, THE Combat_Controller SHALL set Combat_State to `exited`, close the Question_Panel and return the phase to exploring.
3. WHEN the player presses Esc while Combat_State is `question`, THE Game_Client SHALL open the pause menu containing a "Retreat from battle" action.
4. IF the player requests retreat while Combat_State is not `question`, THEN THE Combat_Controller SHALL ignore the request.
5. WHEN the player retreats, THE Run_Reducer SHALL keep the monster health that was last reported by an Answer_Result.
6. WHEN the player presses E again within range of the same living monster after a retreat, THE Combat_Controller SHALL start a new Encounter that presents the next question in the monster's cycle.
7. WHILE the game is paused, THE Question_Panel SHALL ignore keys 1 to 4.

### Requirement 6: Monster defeat

**User Story:** As a player, I want a satisfying monster defeat that returns me to exploring, so that clearing a room feels like progress.

#### Acceptance Criteria

1. WHEN an Answer_Result reports `monster_hp_remaining` equal to zero, THE Combat_Controller SHALL set Combat_State to `monster_defeated` after the defeat animation completes.
2. WHEN the Read_Delay after a defeating result has elapsed or the player activates Next, THE Game_Client SHALL show the XP reward, close the Question_Panel and release the Encounter movement lock, and THE Game_Client SHALL return the phase to exploring once the gate for that room has opened.
3. WHEN Combat_State becomes `monster_defeated`, THE Combat_Controller SHALL call `clearRoom` exactly once for that room.
4. WHEN `clearRoom` succeeds for a non-boss room, THE Combat_Controller SHALL send `gate-open` for that room.
5. IF `clearRoom` fails, THEN THE Game_Client SHALL show a retryable error message and keep the gate closed.
6. WHEN `clearRoom` succeeds for the boss room, THE Combat_Controller SHALL call `finishRun` and show the victory Overlay.

### Requirement 7: Player defeat

**User Story:** As a player, I want a clear defeat experience with a retry option, so that failing does not leave me stuck.

#### Acceptance Criteria

1. WHEN an Answer_Result reports `player_hp_remaining` equal to zero, THE Combat_Controller SHALL set Combat_State to `player_defeated` and stop presenting questions.
2. WHEN Combat_State becomes `player_defeated`, THE Game_Client SHALL show the defeat Overlay with a retry action and the final XP and score.
3. WHEN the player activates the retry action, THE Game_Client SHALL start a new run and reset Combat_State, room progress and Game_Scene state.

### Requirement 8: Event_Bridge cleanup

**User Story:** As a maintainer, I want deprecated bridge events removed, so that the bridge contract is small and unambiguous.

#### Acceptance Criteria

1. THE Event_Bridge SHALL NOT define the `load-room` or `room-cleared` events.
2. THE Game_Scene SHALL NOT contain the legacy single-room code path.
3. THE Event_Bridge SHALL keep the existing events `load-dungeon`, `set-phase`, `apply-result`, `gate-open`, `reset`, `set-reduced-motion` and `set-muted`.
4. THE Game_Client SHALL keep the Import_Boundary.

### Requirement 9: RPG design system and palette

**User Story:** As a player, I want a consistent dark-fantasy look, so that the game feels like one world.

#### Acceptance Criteria

1. THE Game_Client SHALL define the Palette as Design_Tokens with semantic names in `src/index.css`.
2. THE Game_Client SHALL use Design_Tokens for all React colors and SHALL NOT use the removed legacy tokens.
3. THE Game_Client SHALL provide a shared set of styled primitives for panels, buttons, ornate frames, icons and focus rings with consistent spacing and corner radius.
4. THE Game_Client SHALL meet a contrast ratio of at least 4.5:1 for body text and 3:1 for large text and interactive component boundaries against their backgrounds.
5. THE Game_Client SHALL show a visible focus indicator on every interactive element.
6. THE Game_Client SHALL NOT use emoji as interface art.

### Requirement 10: Typography

**User Story:** As a player, I want gothic headings and readable body text, so that the theme is strong without hurting readability.

#### Acceptance Criteria

1. THE Game_Client SHALL load fonts from self-hosted packages with exact pinned versions and SHALL NOT request fonts from external hosts at runtime.
2. THE Game_Client SHALL use one gothic display font for major headings, a serif font for labels and a clean body font for question text.
3. THE Game_Client SHALL load only the Latin subset and at most two weights per family.
4. WHEN the Game_Scene creates text, THE Game_Scene SHALL wait for `document.fonts.ready` or a bounded fallback timeout and SHALL then use a fallback font stack if loading failed.
5. THE Game_Client SHALL list each font with its license and source link in `ASSETS_LICENSES.md`.

### Requirement 11: Heads-up display

**User Story:** As a player, I want a clear and ornate HUD, so that I can read my health, the monster's health, XP, level and streak at a glance.

#### Acceptance Criteria

1. THE Hud SHALL show player health with a heart icon, the current and maximum values, and a smoothly animated bar.
2. WHILE player health is at or below 30 percent of maximum, THE Hud SHALL show a low-health warning that does not rely on color alone.
3. WHILE an Encounter is active or the player stands in a room with a living monster, THE Hud SHALL show monster health with the monster portrait, name, current and maximum values and an animated bar.
4. WHEN XP increases, THE Hud SHALL play an XP gain animation, and SHALL update without animation WHILE Reduced_Motion is active.
5. THE Hud SHALL show the streak copied from the latest Answer_Result.
6. WHERE the Level_Source returns a level, THE Hud SHALL show the level, total XP and XP to next level exactly as returned.
7. THE Game_Client SHALL NOT compute the level or XP thresholds outside the Mock_Adapter.
8. THE Hud SHALL show a compact controls hint listing WASD, E, Esc and keys 1 to 4.
9. THE Game_Client SHALL display the guest banner at reduced visual dominance with a themed "Create Account" action.

### Requirement 12: Room progression display

**User Story:** As a player, I want to see how far I am in the dungeon, so that I know what is cleared, current and locked.

#### Acceptance Criteria

1. THE Room_Progress SHALL show each room as cleared, current or locked using an icon and an accessible text label in addition to color.
2. THE Room_Progress SHALL show a crown marker for the boss room.
3. WHILE a room is the current room, THE Room_Progress SHALL show a glowing marker for that room.
4. WHEN a room becomes cleared or current, THE Room_Progress SHALL animate the change, and SHALL change without animation WHILE Reduced_Motion is active.
5. THE Room_Progress SHALL derive its content from the dungeon data and the Run_Reducer, with no hard-coded room list.

### Requirement 13: Question panel visual design

**User Story:** As a player, I want the question panel to look like an ancient spellbook, so that studying feels part of the world.

#### Acceptance Criteria

1. THE Question_Panel SHALL render with a parchment surface, a dark ornate frame and gothic headings.
2. THE Question_Panel SHALL render the question text in the body font at a size of at least 16 px.
3. THE Question_Panel SHALL render up to four answer options with a number badge, hover state and selected state.
4. WHEN the player presses a key from 1 to 4 while Combat_State is `question`, THE Question_Panel SHALL select the corresponding option.
5. WHEN a correct result is displayed, THE Question_Panel SHALL use green and gold feedback styling.
6. WHEN an incorrect result is displayed, THE Question_Panel SHALL use red feedback styling.
7. THE Question_Panel SHALL be docked to the bottom of the play area and SHALL occupy at most 45 percent of the canvas height, and THE Game_Scene SHALL keep the player and the monster visible above the panel at 1280x720, 1366x768 and 1920x1080.

### Requirement 14: Original pixel art

**User Story:** As a project owner, I want all art to be original, so that there is no licensing risk.

#### Acceptance Criteria

1. THE Pixel_Art_Module SHALL define sprites as palette-indexed pixel maps with a size between 16 and 32 pixels, using the shared Palette.
2. THE Pixel_Art_Module SHALL NOT import Phaser.
3. WHEN the Pixel_Art_Module receives a pixel map with a row of unequal length or a palette index outside the palette, THE Pixel_Art_Module validator SHALL report an error naming the sprite.
4. WHEN the Game_Scene boots, THE Game_Scene SHALL render pixel maps into Phaser textures and spritesheets with idle, attack, hit and death frames for each monster and idle and walk frames for the player.
5. THE Game_Client SHALL render decorative UI characters (friendly ghost, small vampire, skeleton companion, bat, black cat, haunted portrait) and monster HUD portraits from the same pixel maps as inline SVG or canvas.
6. THE Game_Client SHALL keep decorative characters out of the arena area of the play screen.
7. THE Game_Client SHALL list every art asset as original in `ASSETS_LICENSES.md`.

### Requirement 15: Themed rooms and monsters

**User Story:** As a player, I want each room to look distinct and each monster to feel alive, so that progressing through the dungeon feels varied.

#### Acceptance Criteria

1. THE Theme_Selector SHALL choose a Room_Theme from `monster.kind` and `is_boss` and SHALL NOT use the room index or room label.
2. WHEN the Theme_Selector receives an unknown `monster.kind` and `is_boss` is false, THE Theme_Selector SHALL return a default Room_Theme.
3. WHEN the Theme_Selector receives `is_boss` equal to true, THE Theme_Selector SHALL return the boss Room_Theme regardless of `monster.kind`.
4. THE Game_Scene SHALL render room decorations from the Room_Theme: gothic stone, cobwebs, candles, paintings and lanterns for the entry theme; bookshelves, floating books and ghostly particles for the library theme; potions, puddles, cauldrons and green particles for the slime theme; gears, chains and steam for the golem theme; tombs, purple runes and fog for the memory theme; columns, large gates and red and purple light for the boss theme.
5. THE Game_Scene SHALL render each monster from its pixel-art spritesheet with a kind-specific idle animation and attack, hit and death animations.
6. WHEN the player enters the boss room, THE Game_Scene SHALL play a boss entrance effect, and SHALL skip movement-based effects WHILE Reduced_Motion is active.
7. THE Game_Scene SHALL read all room and monster data from the loaded dungeon and SHALL NOT hard-code room or monster data.

### Requirement 16: Overlays and menus

**User Story:** As a player, I want pause, victory, defeat and exit screens in the same theme, so that the whole experience is consistent.

#### Acceptance Criteria

1. THE Game_Client SHALL render the pause menu, exit confirmation, victory Overlay and defeat Overlay with the shared styled primitives and gothic headings.
2. WHILE an Overlay is open, THE Game_Client SHALL trap keyboard focus inside the Overlay and return focus to the game when it closes.
3. THE pause menu SHALL contain Resume, Restart, mute toggle and Exit actions, and the "Retreat from battle" action WHILE Combat_State is `question`.
4. THE victory Overlay SHALL show the run summary received from `finishRun`.
5. THE defeat Overlay SHALL show the final XP and score and a retry action.
6. THE exit confirmation SHALL require explicit confirmation before leaving the dungeon.

### Requirement 17: Landing page

**User Story:** As a visitor, I want the landing page to match the new identity, so that the first impression matches the game.

#### Acceptance Criteria

1. THE Game_Client SHALL render the landing page with the Palette, gothic headings and original pixel-art decoration.
2. WHEN the visitor activates "Try the Demo", THE Game_Client SHALL start a demo session and navigate to the play screen in one action.

### Requirement 18: Atmosphere and animation

**User Story:** As a player, I want subtle atmosphere and animation, so that the dungeon feels alive without distracting from the questions.

#### Acceptance Criteria

1. THE Game_Scene SHALL render dust, torch flicker, fog and magic particles using a capped number of active particles.
2. THE Game_Scene SHALL animate room transitions, door opening, monster intro, player movement, attack, damage, monster death and boss entrance.
3. WHILE Reduced_Motion is active, THE Game_Scene, THE CSS animations and THE Framer Motion animations SHALL be disabled or replaced by instant state changes.
4. THE Effects_System SHALL reuse pooled objects for damage numbers and SHALL NOT create display objects on every frame.
5. THE Effects_System SHALL play effects using only values from the Answer_Result and SHALL NOT compute combat outcomes.
6. THE Effects_System SHALL emit `result-animation-done` exactly once per applied result.

### Requirement 19: Synthesized sound

**User Story:** As a player, I want optional original sound effects with a working mute, so that fights feel punchy but never intrusive.

#### Acceptance Criteria

1. THE Sfx_Engine SHALL synthesize all sounds with the Web Audio API and SHALL NOT load audio files.
2. THE Sfx_Engine SHALL create the AudioContext only after the first user gesture.
3. THE Sfx_Engine SHALL provide footstep, growl, attack and hit, correct chime, wrong thud, gate open, victory stinger and defeat stinger sounds.
4. WHILE the mute control is on, THE Sfx_Engine SHALL play no sound.
5. THE Sfx_Engine SHALL use a quiet default volume.
6. THE Game_Client SHALL keep the Import_Boundary when triggering sounds.
7. IF the AudioContext cannot be created, THEN THE Sfx_Engine SHALL continue without sound and without throwing.

### Requirement 20: Level source

**User Story:** As a player, I want to see my level, so that I feel long-term progress.

#### Acceptance Criteria

1. THE Api_Client SHALL provide `getProgress()` returning `level`, `total_xp` and `xp_to_next`.
2. THE Mock_Adapter SHALL compute `getProgress()` values, and no other module SHALL compute them.
3. IF `getProgress()` fails, THEN THE Hud SHALL omit the level display and SHALL continue to work.
4. THE handoff file `docs/handoff/B-to-A.md` SHALL document `getProgress()` as not yet implemented by Person A.

### Requirement 21: Responsive layout and performance

**User Story:** As a player on different screens, I want the game to fit my window and run smoothly.

#### Acceptance Criteria

1. THE Game_Client SHALL fit the Hud, canvas and Question_Panel without horizontal scrolling at 1280x720, 1366x768 and 1920x1080.
2. THE Game_Client SHALL scale the canvas to the available area while keeping its aspect ratio.
3. THE Game_Client SHALL support keyboard-only and mouse-only play of the full flow.
4. THE Game_Client SHALL NOT create new objects every frame in the Phaser update loop.

### Requirement 22: Regression safety and tests

**User Story:** As a maintainer, I want automated tests, so that the new flow stays correct.

#### Acceptance Criteria

1. THE Game_Client SHALL keep all existing tests passing, and any test updated for intentionally changed behavior SHALL be listed in the task that changes it.
2. THE Game_Client SHALL include fast-check property tests with at least 100 runs for the combat sub-state machine.
3. THE Game_Client SHALL include a smoke test covering Try the Demo, one `encounter-started`, three consecutive answers without further `encounter-started`, monster defeat, `gate-open` and panel close.
4. THE Game_Client SHALL include a smoke test of the wrong-answer path that advances automatically and a test of duplicate-click protection.
5. THE Game_Client SHALL include pure tests for the engage rule, pixel-map validation, theme selection and sound mute gating.
6. THE Game_Client SHALL pass typecheck, lint, test and build at the end of each phase.

### Requirement 23: Dependencies and licensing

**User Story:** As a maintainer, I want minimal, pinned dependencies and clear licensing.

#### Acceptance Criteria

1. THE Game_Client SHALL add only the font packages required by Requirement 10 and SHALL pin them to exact versions.
2. THE Game_Client SHALL include `ASSETS_LICENSES.md` stating that all art and audio are original and listing font licenses with links.
3. THE Game_Client SHALL NOT add a second game engine or audio library.
