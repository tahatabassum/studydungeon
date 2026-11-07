# Requirements Document

## Introduction

This spec defines the first playable milestone of StudyDungeon (Person B, game/frontend owner): a single vertical slice that runs Try the Demo, then movement in one room, a monster encounter, an answered question, animated damage and a room clear (plus defeat and retry). It also creates the frontend scaffold that later specs (frontend-01 to frontend-05) build on.

The backend is authoritative for correctness, damage, HP, XP, score and streak. Until Person A publishes `.kiro/steering/api-contract.md`, this slice builds against mock fixtures that match the shapes documented in the master roadmap. Those shapes and the agreed demo balance values (player 100 HP, monster 60 HP, correct-answer damage 20, wrong-answer player damage 10, score 100 and XP 10 per correct answer) are listed in `docs/handoff/B-to-A.md` and must stay consistent with the backend contract.

Out of scope: login, register, dashboard, upload and scorecard screens, multiple rooms, boss, weapon variety, real art and audio, the waking and offline fallback UX, real backend integration, deployment and Kiro hooks.

## Glossary

- **Frontend_App**: The React + TypeScript + Vite application in `frontend/`.
- **Landing_Page**: The route `/` that shows the hero, a three-step explanation, the Try_Demo_Button and the Login_Button.
- **Try_Demo_Button**: The primary one-click control on the Landing_Page that starts a guest demo session.
- **Login_Button**: A secondary control on the Landing_Page that navigates to a placeholder `/login` route.
- **Api_Client**: The typed module in `src/api` that performs requests with `fetch` and `credentials: "include"` against `VITE_API_BASE_URL`.
- **Mock_Adapter**: The module in `src/api/mock` that implements the Api_Client interface from fixtures and the Demo_Rules, enabled when `VITE_USE_MOCKS` is `true`.
- **Demo_Rules**: The deterministic rules module in `src/demo` that computes answer results from the roadmap numbers. Only the Mock_Adapter calls it.
- **Demo_Dungeon**: The bundled placeholder JSON in `src/demo` with one topic room, one monster and its questions.
- **Game_Canvas**: The single React component that mounts and unmounts the Phaser game.
- **Event_Bridge**: The typed event contract in `src/game/events.ts` between React and Phaser.
- **Game_Scene**: The Phaser scene that renders the room, walls, gate, player and monster.
- **Boot_Scene**: The Phaser scene that preloads resources and shows a loading bar.
- **Player**: The controllable character in the Game_Scene, drawn with procedural graphics.
- **Monster**: The enemy in the Game_Scene, drawn with procedural graphics, with an idle animation and an HP bar.
- **Interaction_Range**: The distance, in pixels, within which the Player can start an encounter with the Monster. The value is 64.
- **Question_Panel**: The parchment-styled React dialog that shows a question and its answer options.
- **Answer_Result**: The response object of an attempt submission with fields `correct`, `damage_dealt`, `monster_hp_remaining`, `player_hp_remaining`, `score_delta`, `xp_delta`, `streak`, `source` (`page`, `chunk_id`) and `review_status`.
- **Source_Line**: The text "From your notes: page X" followed by an explanation, shown after an answer.
- **HUD**: The React overlay showing player HP, monster HP and XP.
- **Guest_Banner**: The React banner shown during a guest session.
- **Reduced_Motion**: The state where the user agent reports `prefers-reduced-motion: reduce`.
- **Run_State**: The React state holding the run id, player HP, monster HP, XP, streak and phase (`exploring`, `encounter`, `resolving`, `cleared`, `defeated`, `paused`).
- **Design_Tokens**: The CSS variables for Background #100D18, Panel #1D1728, Parchment #F2E8D5, Purple #7546A8, Blood red #B83D4A, Amber #E9A23B, Mint #68C9A5 and Muted text #A79CB5.

## Requirements

### Requirement 1: Frontend scaffold and tooling

**User Story:** As a developer on a two-person team, I want a modular, verifiable frontend scaffold, so that both of us can extend it without conflicts.

#### Acceptance Criteria

1. THE Frontend_App SHALL organize source code into `src/api`, `src/api/mock`, `src/demo`, `src/game`, `src/pages`, `src/components` and `src/types`.
2. THE Frontend_App SHALL provide the npm scripts `dev`, `build`, `typecheck`, `lint` and `test`.
3. THE Frontend_App SHALL run the `lint` script with ESLint and the `test` script once with Vitest.
4. THE Frontend_App SHALL read only `VITE_API_BASE_URL` and `VITE_USE_MOCKS` from the environment.
5. THE Frontend_App SHALL provide a `.env.example` file in `frontend/` containing placeholder values and no secrets.
6. THE Frontend_App SHALL keep every source file in `src/game` focused on one scene, entity or system.

### Requirement 2: Design tokens and accessibility basics

**User Story:** As a player, I want a consistent dark-fantasy look that respects my accessibility settings, so that the game is readable and comfortable.

#### Acceptance Criteria

1. THE Frontend_App SHALL define the Design_Tokens as CSS variables and expose them as Tailwind theme colors.
2. THE Frontend_App SHALL apply the Background token to the page background and use Parchment-colored surfaces for question text.
3. THE Frontend_App SHALL render a visible focus ring on every focusable control.
4. WHILE Reduced_Motion is active, THE Frontend_App SHALL disable decorative CSS animations and transitions.
5. THE `index.html` body classes SHALL reference color utilities that exist in the Tailwind theme.
6. THE Frontend_App SHALL render without horizontal scrolling at a 1366x768 viewport.

### Requirement 3: Landing page and Try the Demo

**User Story:** As a judge or new visitor, I want to enter the game with one click, so that I can see StudyDungeon without signing up.

#### Acceptance Criteria

1. THE Landing_Page SHALL display a hero, a three-step explanation, the Try_Demo_Button and the Login_Button.
2. THE Landing_Page SHALL render the Try_Demo_Button as the primary action, visually more prominent than the Login_Button.
3. WHEN the user activates the Try_Demo_Button, THE Frontend_App SHALL call the Api_Client demo session operation without showing a form.
4. WHEN the demo session operation succeeds, THE Frontend_App SHALL store the returned user and dungeon id in application state and navigate to `/play`.
5. WHILE the demo session request is pending, THE Landing_Page SHALL disable the Try_Demo_Button and show a loading indicator with an accessible status message.
6. IF the demo session request fails, THEN THE Landing_Page SHALL display an error message and re-enable the Try_Demo_Button.
7. WHEN the user activates the Login_Button, THE Frontend_App SHALL navigate to the placeholder `/login` route.
8. THE Frontend_App SHALL keep session identifiers out of `localStorage` and `sessionStorage`.

### Requirement 4: Typed API client and mock adapter

**User Story:** As the frontend owner, I want a typed client with a mock adapter, so that I can build the game before the backend exists.

#### Acceptance Criteria

1. THE Api_Client SHALL expose typed operations for demo session, load dungeon, start run, submit attempt and clear room, with types defined in `src/types/api.ts`.
2. THE Api_Client SHALL send requests to `VITE_API_BASE_URL` with `credentials: "include"`.
3. WHEN `VITE_USE_MOCKS` equals `true`, THE Frontend_App SHALL use the Mock_Adapter instead of network requests.
4. WHEN the Mock_Adapter receives a demo session request, THE Mock_Adapter SHALL return a user with `is_guest` equal to `true`, a dungeon id and an `expires_at` timestamp.
5. WHEN the Mock_Adapter receives a submit attempt request containing `question_id`, `selected_answer` and `attempt_id`, THE Mock_Adapter SHALL return an Answer_Result computed by the Demo_Rules.
6. WHEN the Mock_Adapter receives a submit attempt request with an `attempt_id` it has already processed, THE Mock_Adapter SHALL return the stored Answer_Result without changing state.
7. IF a request returns a non-success status, THEN THE Api_Client SHALL throw a typed error carrying the status code.
8. THE Api_Client SHALL send only `question_id`, `selected_answer` and `attempt_id` in an attempt request and no damage value.
9. WHILE `VITE_USE_MOCKS` is not `true`, THE Frontend_App SHALL not invoke the Demo_Rules.

### Requirement 5: Demo rules module

**User Story:** As the frontend owner, I want deterministic, roadmap-aligned rules for the mock path, so that the slice is playable and testable offline.

#### Acceptance Criteria

1. THE Demo_Rules SHALL start the player at 100 HP and the Monster at 60 HP with the Rusty Dagger weapon dealing 20 base damage.
2. WHEN the selected answer is correct, THE Demo_Rules SHALL return `correct` true, `damage_dealt` equal to the weapon base damage limited to the remaining monster HP, `score_delta` of 100 and `xp_delta` of 10.
3. WHEN the selected answer is wrong, THE Demo_Rules SHALL return `correct` false, `damage_dealt` of 0, a player damage of 10 limited to the remaining player HP, `score_delta` of 0 and `xp_delta` of 0.
4. THE Demo_Rules SHALL keep player HP and monster HP within 0 to 100 and 0 to 60 respectively.
5. WHEN the selected answer is correct, THE Demo_Rules SHALL increment `streak` by 1.
6. WHEN the selected answer is wrong, THE Demo_Rules SHALL set `streak` to 0.
7. THE Demo_Rules SHALL return identical results for identical initial state and identical answer sequences.
8. THE Demo_Rules SHALL set `review_status` to `"due"` for a wrong answer and `"not_due"` for a correct answer.
9. THE Demo_Rules SHALL document the agreed values (player 100 HP, monster 60 HP, correct-answer damage 20, wrong-answer damage 10) in a code comment stating that the backend remains authoritative.

### Requirement 6: React and Phaser boundary

**User Story:** As a developer, I want a typed event bridge and one canvas component, so that React owns UI and network while Phaser owns the world.

#### Acceptance Criteria

1. THE Game_Canvas SHALL create the Phaser game when mounted and destroy it when unmounted, leaving no orphaned canvas elements.
2. WHEN React strict mode mounts the Game_Canvas twice in development, THE Game_Canvas SHALL end with exactly one Phaser game instance.
3. THE Event_Bridge SHALL define typed inbound events from React to Phaser and typed outbound events from Phaser to React.
4. THE Event_Bridge SHALL deliver the dungeon, room and monster data to the Game_Scene, and THE Game_Scene SHALL not contain hard-coded dungeon, room or monster data.
5. WHEN the Player starts an encounter, THE Game_Scene SHALL emit an `encounter-started` event carrying the monster id.
6. WHEN React sends an Answer_Result to Phaser, THE Game_Scene SHALL animate the values in the result without recalculating them.
7. THE Game_Scene SHALL not import from `src/demo` or `src/api`.

### Requirement 7: Boot scene and room

**User Story:** As a player, I want to see a loading bar and then a single explorable room, so that the game feels like a dungeon.

#### Acceptance Criteria

1. WHEN the Game_Canvas starts, THE Boot_Scene SHALL display a loading bar and then start the Game_Scene.
2. THE Game_Scene SHALL render one room with walls that block the Player, a gate and a camera that follows the Player.
3. WHEN the dungeon data is received, THE Game_Scene SHALL display the room label from the data.
4. THE Game_Scene SHALL draw the Player, Monster, walls and gate with procedural graphics and no external image or audio files.
5. THE Game_Canvas SHALL scale to fit its container while preserving aspect ratio at 1366x768.

### Requirement 8: Player movement and interaction

**User Story:** As a player, I want to move with the keyboard and interact with the monster, so that I control when the fight starts.

#### Acceptance Criteria

1. WHILE the phase is `exploring` and the user holds W, A, S, D or an arrow key, THE Player SHALL move in the corresponding direction.
2. WHILE two direction keys are held, THE Player SHALL move at the same speed as with one direction key.
3. THE Player SHALL remain inside the room walls.
4. WHILE the Player is within the Interaction_Range of the living Monster, THE Game_Scene SHALL display an interaction prompt.
5. WHEN the user presses E or Space while the Player is within the Interaction_Range of the living Monster, THE Game_Scene SHALL emit `encounter-started`.
6. WHILE the phase is not `exploring`, THE Player SHALL not move.

### Requirement 9: Question panel

**User Story:** As a player, I want to read a question and answer it with mouse or keyboard, so that combat is driven by my knowledge.

#### Acceptance Criteria

1. WHEN `encounter-started` is received, THE Frontend_App SHALL open the Question_Panel with the next unanswered question of the Demo_Dungeon.
2. THE Question_Panel SHALL show the question text and between two and four answer options as buttons.
3. WHEN the user presses a key from 1 to 4 matching an option or activates an option button, THE Question_Panel SHALL submit that answer once through the Api_Client.
4. WHEN the Question_Panel opens, THE Question_Panel SHALL move focus to the panel and return focus to the game on close.
5. THE Question_Panel SHALL expose `role="dialog"`, `aria-modal="true"` and an accessible name.
6. WHILE an attempt submission is pending, THE Question_Panel SHALL disable all options.
7. IF the attempt submission fails, THEN THE Question_Panel SHALL show an error message and re-enable the options for retry using the same `attempt_id`.
8. WHERE a question is of type True/False, THE Question_Panel SHALL show exactly two options.

### Requirement 10: Combat presentation

**User Story:** As a player, I want clear animated feedback after each answer, so that I understand what happened.

#### Acceptance Criteria

1. WHEN an Answer_Result with `correct` true is received, THE Game_Scene SHALL play a player attack effect, show a floating damage number equal to `damage_dealt`, flash the Monster and animate the Monster HP bar to `monster_hp_remaining`.
2. WHEN an Answer_Result with `correct` false is received, THE Game_Scene SHALL play a monster attack animation and animate the player HP bar to `player_hp_remaining`.
3. WHEN an Answer_Result with `correct` false is received and Reduced_Motion is not active, THE Game_Scene SHALL apply a camera shake of at most 150 ms.
4. WHILE Reduced_Motion is active, THE Game_Scene SHALL skip camera shake and hit flashing and show the HP changes without tweening.
5. WHEN an Answer_Result is displayed, THE Frontend_App SHALL show the Source_Line with the `source.page` value and, WHEN the Answer_Result contains an optional `explanation`, the explanation text, and WHEN the `explanation` is absent, THE Frontend_App SHALL show only the page without an error.
6. THE Frontend_App SHALL take every damage, HP, XP and streak value from the Answer_Result and never compute them in React or Phaser.
7. WHEN the combat animation completes, THE Frontend_App SHALL update the Run_State from the Answer_Result and either close the Question_Panel or advance to the next outcome.

### Requirement 11: HUD and guest banner

**User Story:** As a player, I want to see my HP, the monster's HP and XP at all times, and know I am a guest.

#### Acceptance Criteria

1. THE HUD SHALL display player HP, monster HP and XP from the Run_State.
2. THE HUD SHALL expose HP values to assistive technology through `role="progressbar"` with `aria-valuenow`, `aria-valuemin` and `aria-valuemax`.
3. WHILE the session user has `is_guest` true, THE Guest_Banner SHALL display exactly "Playing as guest. Progress is temporary. Create an account to save."
4. WHILE the session user has `is_guest` true, THE Guest_Banner SHALL provide a "Create account" control that does not interrupt the current run.
5. WHEN the Run_State changes, THE HUD SHALL update within one animation frame of the state update.

### Requirement 12: Room clear and defeat

**User Story:** As a player, I want clear outcomes when I win or lose the fight, so that I can progress or try again.

#### Acceptance Criteria

1. WHEN an Answer_Result has `monster_hp_remaining` of 0, THE Game_Scene SHALL fade the Monster out and open the gate.
2. WHEN the Monster is defeated, THE Frontend_App SHALL call the Api_Client clear room operation and add the returned `xp_delta` to the HUD XP.
3. WHEN the room is cleared, THE Frontend_App SHALL show a room-cleared message.
4. WHEN an Answer_Result has `player_hp_remaining` of 0, THE Frontend_App SHALL show a defeat overlay with a Retry control.
5. WHEN the user activates Retry, THE Frontend_App SHALL start a new run and reset the room, Monster, Player and HUD.
6. WHILE the defeat overlay is visible, THE Retry control SHALL receive focus.

### Requirement 13: Pause and restart

**User Story:** As a player, I want to pause and restart, so that I can control the session.

#### Acceptance Criteria

1. WHEN the user presses Esc during the `exploring` phase, THE Frontend_App SHALL pause the game and show a pause menu with Resume and Restart controls.
2. WHILE the game is paused, THE Game_Scene SHALL stop player input and animations.
3. WHEN the user activates Resume or presses Esc while paused, THE Frontend_App SHALL resume the game and restore focus.
4. WHEN the user activates Restart, THE Frontend_App SHALL start a new run and reset the room.

### Requirement 14: Handoff documentation

**User Story:** As Person B, I want my contract assumptions written down, so that Person A can confirm or correct them.

#### Acceptance Criteria

1. THE Frontend_App repository SHALL contain `docs/handoff/B-to-A.md` listing each finalized request and response shape, the optional `explanation` field, the agreed balance values (player 100 HP, monster 60 HP, correct-answer damage 20, wrong-answer damage 10, score 100, XP 10), and open questions for Person A.
2. THE `docs/handoff/B-to-A.md` file SHALL state that the shapes are replaced by `.kiro/steering/api-contract.md` once published.

### Requirement 15: Automated verification

**User Story:** As a maintainer, I want automated tests and checks, so that the rules and adapters stay correct.

#### Acceptance Criteria

1. THE test suite SHALL include property-based tests, run with fast-check for at least 100 iterations, for the Demo_Rules.
2. THE test suite SHALL include a property-based test for the Run_State reducer that applies Answer_Results.
3. THE test suite SHALL include unit tests that verify the Mock_Adapter responses conform to the types in `src/types/api.ts`.
4. WHEN the final verification task runs, THE Frontend_App SHALL pass `typecheck`, `lint`, `test` and `build` with the real output recorded.
5. FOR ALL valid Answer_Result sequences, applying the Run_State reducer SHALL keep the monster HP non-increasing and player HP within 0 to 100.
6. THE test suite SHALL include an integration smoke test that renders the Frontend_App with the Mock_Adapter and a mocked Game_Canvas bridge, activates the Try_Demo_Button, reaches `/play`, simulates `encounter-started`, submits an answer, verifies that the HUD HP and XP match the Answer_Result and verifies that `apply-result` was sent to the game.
