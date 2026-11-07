# Requirements Document

## Introduction

This spec extends the completed single-room slice (`frontend-00-playable-slice`) into a multi-room dungeon: four topic rooms and one boss room connected by gates, with camera follow across the whole dungeon, one monster per room, a boss encounter, a victory screen, and pause, mute, restart and exit controls. It corresponds to Prompt B5 (Phaser core) plus the boss and victory parts of Prompt B6.

The backend is authoritative for correctness, damage, HP, XP, score and accuracy. Phaser animates what it is told. Demo rules exist only in the Mock_Adapter path. Real art, audio, weapon variety, critical hits, the scorecard screen, dashboard, upload and backend integration are out of scope.

## Glossary

- **Game**: The Phaser 3.90.0 application mounted inside the Game_Canvas.
- **Game_Canvas**: The single React component that mounts and destroys the Game.
- **Game_Scene**: The Phaser scene that renders the Dungeon_Layout, entities and effects.
- **Event_Bridge**: The typed event channel in `src/game/events.ts`, the only coupling between React and the Game.
- **Dungeon_Data**: The `Dungeon` object (rooms, monsters, questions) delivered to the Game through the Event_Bridge.
- **Topic_Room**: A room with `is_boss` false that contains one Room_Monster.
- **Boss_Room**: The single room with `is_boss` true and the highest `order`, containing the Boss.
- **Room_Monster**: The monster of a Topic_Room.
- **Boss**: The monster of the Boss_Room.
- **Dungeon_Layout**: The deterministic arrangement of room bounds, Gates, spawn point and world bounds produced by the Layout_Builder.
- **Layout_Builder**: The pure function in `src/game/world` that maps an ordered list of rooms to a Dungeon_Layout.
- **Gate**: A barrier in the wall between two adjacent rooms that is closed until the Api_Client confirms the clear of the room that precedes it.
- **Current_Room**: The room whose bounds contain the Player.
- **Run_State**: The state held by the pure Run_Reducer.
- **Run_Reducer**: The pure reducer in `src/state/runReducer.ts`.
- **Api_Client**: The `ApiClient` interface and its implementations.
- **Mock_Adapter**: The in-memory `ApiClient` implementation used when `VITE_USE_MOCKS` is true.
- **Demo_Rules**: The pure rules module in `src/demo/rules.ts`, imported only by the Mock_Adapter.
- **Run_Summary**: The object `{ score, xp, correct, total, accuracy }` returned by `finishRun`, where `accuracy` is a ratio from 0 to 1.
- **Room_Progress**: The React HUD element showing rooms cleared and the Current_Room.
- **Question_Pool**: The questions whose ids are listed in a monster's `question_ids`.
- **Play_Page**: The React page `PlayPage` that renders the HUD, overlays and Game_Canvas.
- **Play_Session**: The `usePlaySession` hook that owns API calls and dispatches to the Run_Reducer.
- **Question_Selector**: The pure function that picks the next question from a Question_Pool by an ask count.
- **Answer_Result**: The `AnswerResult` object returned by an attempt.
- **Demo_Dungeon**: The bundled `demoDungeon.json` used by the Mock_Adapter.
- **Handoff_Doc**: `docs/handoff/B-to-A.md`.
- **Player**: The player-controlled character.

## Requirements

### Requirement 1: Multi-room dungeon rendering

**User Story:** As a player, I want to explore a connected dungeon of several rooms, so that the game feels like a dungeon crawl rather than a single arena.

#### Acceptance Criteria

1. WHEN Dungeon_Data containing N rooms is loaded, THE Game_Scene SHALL render N rooms arranged by the Dungeon_Layout in ascending `order`.
2. THE Game_Scene SHALL take room count, order, labels and monster definitions exclusively from the Dungeon_Data received through the Event_Bridge.
3. THE Game_Scene SHALL render each room label from the `label` field of the corresponding room.
4. WHILE the Player moves, THE Game_Scene SHALL keep the camera centered on the Player within the world bounds of the Dungeon_Layout.
5. THE Game_Scene SHALL restrict Player movement and camera movement to the world bounds of the Dungeon_Layout.
6. WHEN the Demo_Dungeon is loaded, THE Game_Scene SHALL render four Topic_Rooms followed by one Boss_Room.

### Requirement 2: Deterministic layout builder

**User Story:** As a developer, I want the dungeon layout computed by a pure deterministic function, so that it is testable and predictable.

#### Acceptance Criteria

1. THE Layout_Builder SHALL accept a list of rooms with `id`, `order` and `is_boss` and return a Dungeon_Layout containing the bounds of each room, the Gates, the Player spawn point and the world bounds.
2. THE Layout_Builder SHALL produce room bounds whose interiors do not overlap.
3. THE Layout_Builder SHALL place consecutive rooms, by ascending `order`, adjacent to each other with one Gate connecting each such pair.
4. THE Layout_Builder SHALL produce a Dungeon_Layout in which every room is reachable from the first room through the Gates.
5. WHEN the Layout_Builder is called twice with the same list of rooms in any input order, THE Layout_Builder SHALL return equal Dungeon_Layouts.
6. THE Layout_Builder SHALL place the Player spawn point inside the room with the lowest `order`.
7. IF the list of rooms is empty, THEN THE Layout_Builder SHALL return a typed error result.
8. THE Layout_Builder SHALL import no Phaser module.

### Requirement 3: Gates

**User Story:** As a player, I want gates that stay closed until I defeat the monster, so that I must study my way forward.

#### Acceptance Criteria

1. WHEN Dungeon_Data is loaded, THE Game_Scene SHALL render every Gate in the closed state and block Player movement through it.
2. WHEN the Game_Scene receives a `gate-open` event for a room id, THE Game_Scene SHALL animate the Gate after that room open and allow Player movement through it.
3. WHEN a Gate finishes opening, THE Game_Scene SHALL emit a `gate-opened` event with the room id.
4. THE Game_Scene SHALL open a Gate only in response to a `gate-open` event.
5. WHEN the Player enters a different room, THE Game_Scene SHALL emit a `room-entered` event with the id of the new Current_Room.
6. WHERE the Boss_Room has no following room, THE Game_Scene SHALL render the Boss_Room without an exit Gate.

### Requirement 4: Room monsters and boss visuals

**User Story:** As a player, I want a distinct monster in each room and a bigger boss, so that every room feels different.

#### Acceptance Criteria

1. THE Game_Scene SHALL render exactly one monster per room, positioned inside that room.
2. THE Game_Scene SHALL select the procedural shape and tint of a monster from its `kind` field.
3. IF a monster `kind` is not recognized, THEN THE Game_Scene SHALL render a default monster style.
4. THE Game_Scene SHALL render the Boss with a larger scale and a visual style distinct from every Room_Monster style.
5. THE Game_Scene SHALL render an HP bar above each living monster, using `max_hp` from the Dungeon_Data and the remaining HP from the latest Answer_Result.
6. WHEN a monster HP reaches 0 and the result animation finishes, THE Game_Scene SHALL remove that monster from the room.

### Requirement 5: Encounter routing

**User Story:** As a player, I want to fight the monster in the room I am standing in, so that each room has its own topic questions.

#### Acceptance Criteria

1. WHILE the phase is `exploring` and the Player is within 64 pixels of the living monster of the Current_Room, THE Game_Scene SHALL show an interaction prompt.
2. WHEN the Player presses E or Space within 64 pixels of the living monster of the Current_Room, THE Game_Scene SHALL emit `encounter-started` with the id of that monster.
3. THE Game_Scene SHALL ignore monsters of rooms other than the Current_Room for interaction.
4. WHEN `encounter-started` is received, THE Question_Selector SHALL choose the next question from the Question_Pool of the monster identified in the event.
5. THE Question_Selector SHALL choose questions from the Question_Pool in a deterministic cycling order.
6. WHEN the Question_Pool of the Boss lists questions drawn from several topics, THE Question_Selector SHALL cycle through all listed questions.

### Requirement 6: Run-wide player HP and per-room monster HP

**User Story:** As a player, I want my health to carry across rooms, so that earlier mistakes matter.

#### Acceptance Criteria

1. WHEN a run starts, THE Mock_Adapter SHALL set player HP to 100 for the whole run.
2. WHILE a run is active, THE Mock_Adapter SHALL keep player HP unchanged by room changes and reduce it only through wrong answers.
3. THE Mock_Adapter SHALL track monster HP separately for each room, initialized from each monster's `max_hp`.
4. WHEN an attempt is submitted for a question belonging to a monster, THE Mock_Adapter SHALL change only the HP of that monster.
5. THE Mock_Adapter SHALL keep player HP between 0 and 100 and keep each monster HP between 0 and its `max_hp` and non-increasing.
6. WHEN a correct answer is submitted for a Room_Monster, THE Demo_Rules SHALL deal damage equal to the lesser of 20 and the monster HP.
7. WHEN a wrong answer is submitted for a Room_Monster, THE Demo_Rules SHALL reduce player HP by the lesser of 10 and the player HP.
8. WHEN a correct answer is submitted for the Boss, THE Demo_Rules SHALL deal damage equal to the lesser of 20 and the Boss HP.
9. WHEN a wrong answer is submitted for the Boss, THE Demo_Rules SHALL reduce player HP by the lesser of 12 and the player HP.
10. THE Demo_Dungeon SHALL define the Boss `max_hp` as 120.
11. IF an attempt is submitted for a monster whose HP is 0, THEN THE Mock_Adapter SHALL reject the attempt with an `ApiError` of status 409.
12. WHEN 6 correct answers are submitted for the Boss starting from full HP, THE Mock_Adapter SHALL report the Boss HP as 0.

### Requirement 7: Room clear and XP

**User Story:** As a player, I want clearing a room to open the next gate and award XP, so that I see progress.

#### Acceptance Criteria

1. WHEN the HP of a monster reaches 0 and the result animation finishes, THE Play_Session SHALL call `clearRoom` for that room.
2. IF `clearRoom` is called for a room whose monster HP is greater than 0, THEN THE Mock_Adapter SHALL reject the call with an `ApiError` of status 409.
3. WHEN `clearRoom` succeeds for a Topic_Room, THE Play_Session SHALL add the returned `xp_delta` to the Run_State XP and send `gate-open` for that room to the Game.
4. WHEN `clearRoom` succeeds for the Boss_Room, THE Play_Session SHALL add the returned `xp_delta` to the Run_State XP and call `finishRun`.
5. WHEN `gate-opened` is received, THE Run_Reducer SHALL return the phase to `exploring`.
6. IF `clearRoom` fails, THEN THE Play_Session SHALL show a retry option and keep the Gate closed.
7. WHEN `clearRoom` is called a second time for the same room, THE Mock_Adapter SHALL return the same `xp_delta` without awarding additional state changes.

### Requirement 8: Victory screen

**User Story:** As a player, I want to see a victory screen after defeating the boss, so that finishing the dungeon feels rewarding.

#### Acceptance Criteria

1. THE Api_Client SHALL provide a `finishRun(runId)` operation that returns a Run_Summary and maps to `POST /runs/{id}/finish`.
2. WHEN `finishRun` succeeds, THE Run_Reducer SHALL store the Run_Summary and set the phase to `victory`.
3. WHILE the phase is `victory`, THE Play_Page SHALL show a victory overlay displaying score, XP, correct count, total count and accuracy from the Run_Summary.
4. THE Play_Page SHALL display the values of the Run_Summary without recomputing them.
5. IF `finishRun` is called before the Boss is defeated, THEN THE Mock_Adapter SHALL reject the call with an `ApiError` of status 409.
6. THE Mock_Adapter SHALL return a Run_Summary in which `accuracy` equals `correct` divided by `total`, and equals 0 when `total` is 0.
7. THE victory overlay SHALL provide a button that starts a new run from the first room.
8. THE victory overlay SHALL provide a button that exits to the landing page.
9. IF `finishRun` fails, THEN THE Play_Page SHALL show an error with a retry button.

### Requirement 9: Defeat and retry

**User Story:** As a player, I want to retry after losing, so that failure does not end my session.

#### Acceptance Criteria

1. WHEN player HP reaches 0, THE Run_Reducer SHALL set the phase to `defeated`.
2. WHILE the phase is `defeated`, THE Play_Page SHALL show the defeat overlay with a Retry button.
3. WHEN the player activates Retry, THE Play_Session SHALL start a new run, reset Run_State, reload the Dungeon_Data into the Game and place the Player in the first room.
4. WHEN a new run starts, THE Game_Scene SHALL close every Gate and restore every monster.

### Requirement 10: Pause, mute, restart and exit

**User Story:** As a player, I want pause, mute, restart and exit controls, so that I can control my session.

#### Acceptance Criteria

1. WHEN the player presses Esc while the phase is `exploring`, THE Play_Page SHALL open the pause menu and set the phase to `paused`.
2. THE pause menu SHALL provide Resume, Mute toggle, Restart and Exit buttons.
3. WHEN the player toggles mute, THE Play_Page SHALL store the muted flag in its state and send `set-muted` to the Game.
4. WHEN the player activates Restart, THE Play_Session SHALL start a new run from the first room.
5. WHEN the player activates Exit, THE Play_Page SHALL show a confirmation dialog before leaving.
6. WHEN the player confirms Exit, THE Play_Page SHALL navigate to the landing page.
7. WHEN the player cancels Exit, THE Play_Page SHALL return to the pause menu.
8. THE confirmation dialog SHALL have `role="alertdialog"` and move focus to its cancel button when opened.
9. WHILE the phase is `paused`, THE Game SHALL not move the Player.

### Requirement 11: Room progress indicator

**User Story:** As a player, I want to see how far I am in the dungeon, so that I know what is left.

#### Acceptance Criteria

1. THE Room_Progress SHALL display one marker per room in ascending `order`.
2. THE Room_Progress SHALL mark each cleared room, the Current_Room and each remaining room with distinct states.
3. THE Room_Progress SHALL mark the Boss_Room with a distinct marker.
4. THE Room_Progress SHALL expose a text label of the form "Room X of N" together with the Current_Room label.
5. WHEN the Run_State changes the Current_Room or the set of cleared rooms, THE Room_Progress SHALL update.

### Requirement 12: Run reducer room ordering

**User Story:** As a developer, I want the Run_Reducer to enforce room order, so that the UI cannot skip rooms.

#### Acceptance Criteria

1. WHEN a run starts, THE Run_Reducer SHALL store the room order and set the Current_Room to the room with the lowest `order`.
2. WHEN `room-entered` is received for a room, THE Run_Reducer SHALL change the Current_Room only if that room is the first room or the room before it has been cleared.
3. WHEN `room-entered` is accepted, THE Run_Reducer SHALL set the displayed monster HP to the remembered HP of that room.
4. WHEN a result is received, THE Run_Reducer SHALL copy player HP, monster HP, streak, XP and score from the Answer_Result and record the monster HP for the Current_Room.
5. THE Run_Reducer SHALL set the phase to `victory` only after the Boss_Room has been cleared and a Run_Summary has been received.
6. THE Run_Reducer SHALL record a room as cleared only when the remembered monster HP of that room is 0.
7. THE Run_Reducer SHALL derive no damage, HP, XP or score value of its own.

### Requirement 13: Contract extension and handoff

**User Story:** As a developer, I want the contract extended minimally and documented, so that Person A can confirm it.

#### Acceptance Criteria

1. THE `Room` type SHALL include `order` as a number and `is_boss` as a boolean.
2. THE `Monster` type SHALL include `kind` as a string identifying the visual type.
3. THE `Run` type SHALL include `current_room_id` as a string.
4. THE Api_Client SHALL provide `finishRun(runId)` returning a Run_Summary.
5. THE AnswerResult type SHALL remain unchanged.
6. THE Handoff_Doc SHALL list every new or changed field, the boss balance values, the `finishRun` endpoint and the open questions for Person A.
7. THE Handoff_Doc SHALL state that the backend remains authoritative for the boss balance values.

### Requirement 14: Five-room mock dungeon

**User Story:** As a developer, I want the mock dungeon to contain five rooms of original content, so that the whole loop is playable offline.

#### Acceptance Criteria

1. THE Demo_Dungeon SHALL contain the rooms "Entry Hall", "Alchemist's Lab", "Clockwork Crypt", "Forgotten Wing" and "Boss Room" with `order` 1 to 5.
2. THE Demo_Dungeon SHALL assign the monsters Paper Wraith, Toxic Slime, Gear Golem, Memory Eater and The Exam Warden to the rooms in that order, each with 60 HP except The Exam Warden, which has 120 HP.
3. THE Demo_Dungeon SHALL provide between 3 and 5 placeholder questions of original content for each Topic_Room.
4. THE Demo_Dungeon SHALL provide a Boss Question_Pool that includes at least one question from each Topic_Room topic.
5. THE answer key SHALL contain the correct answer, page and chunk id for every question in the Demo_Dungeon.
6. THE Dungeon type SHALL continue to omit correct answers.

### Requirement 15: Module boundaries

**User Story:** As a maintainer, I want module boundaries kept, so that the game stays testable and the backend authoritative.

#### Acceptance Criteria

1. THE `src/game` modules SHALL import nothing from `@/api` or `@/demo`.
2. THE Game SHALL compute no damage, HP, XP, score or accuracy value.
3. THE Demo_Rules SHALL be imported only by the Mock_Adapter.
4. THE Game_Canvas SHALL keep exactly one Game instance across React strict-mode double mounting.
5. THE frontend SHALL contain no secrets and no AI provider calls.
6. WHEN the reduced-motion setting is active, THE Game SHALL skip camera shake and hit flash for all new effects.

### Requirement 16: Verification

**User Story:** As a maintainer, I want verification evidence, so that the spec is trustworthy.

#### Acceptance Criteria

1. THE frontend SHALL pass `npm run typecheck`, `npm run lint`, `npm run test` and `npm run build` with the output recorded.
2. THE integration smoke test SHALL clear room 1, receive `room-entered` for room 2 and assert that the Current_Room changes, with Phaser mocked at the Event_Bridge.
3. THE verification task SHALL record a manual browser walkthrough covering movement across all rooms, each gate, the boss, victory, defeat with retry, pause, mute, restart and exit confirmation.
