# Requirements Document

## Introduction

A fixed five-room dungeon cannot help a student memorize large notes. Memory comes from repeated retrieval over days, so StudyDungeon needs a campaign that grows with the notes (floors), a short daily review loop (Daily Haunt), and visible progress numbers. This feature extends the finished client (frontend-00/03/04/06, frontend-07 Phases 0 to 4) in six phases after a Phase 0 reconcile-and-plan step:

- Phase 0: reconcile the frontend with Person A's real contract and plan the build order (documents only).
- Phase 1: floors data model, adapters, mock behaviour, fixtures, dev route and the reconciliation fixes.
- Phase 2: floor map and campaign flow.
- Phase 3: Daily Haunt and run modes.
- Phase 4: learning loop (second chance, memory scroll, mastery bars, progress panel).
- Phase 5: game feel and ranks.
- Phase 6: tutorial, polish, accessibility, responsive check and documentation.

The Backend is authoritative for correctness, damage, HP, XP, score, streaks, ranks, mastery, review scheduling, question selection and badges. The Frontend only displays. Local computation is allowed only in the Mock_Adapter and the labeled Offline_Demo module. The product never claims to guarantee memorization; it shows real progress numbers.

## Glossary

- **Frontend**: The React 19, TypeScript, Vite client in `frontend/`.
- **Backend**: Person A's FastAPI service. Read-only for this feature.
- **Api_Client**: The typed interface in `src/api/ApiClient.ts` with Http_Client and Mock_Adapter implementations.
- **Http_Client**: The real implementation that calls the Backend and validates every response with zod.
- **Mock_Adapter**: The in-memory implementation used for demos, tests and development. The only place besides Offline_Demo where game rules are computed.
- **Offline_Demo**: The explicitly labeled offline fallback module from frontend-07 Phase 6.
- **Wire_Mapper**: A pure function that converts a real Backend response shape into the Frontend domain type.
- **Domain_Model**: The Frontend types in `src/types/api.ts` that the UI and Phaser-facing code consume.
- **Dungeon**: The study world generated from one set of notes.
- **Floor**: A group of rooms (topics) inside a Dungeon, closed by a Floor_Boss.
- **Floor_Status**: One of `locked`, `ready`, `generating`, `failed`, `cleared`.
- **Floor_Boss**: The monster that closes a Floor.
- **Final_Boss**: The Exam Warden at the end of the Dungeon, unlocked when all Floors are cleared.
- **Topic**: A subject area of the notes that maps to one room and one Question_Pool.
- **Question_Pool**: The 15 to 20 questions stored per Topic.
- **Seeded_Draw**: The selection of 6 to 8 questions from a Question_Pool for one run, determined by the run seed.
- **Run_Mode**: One of `floor`, `daily_haunt`, `weak_topics`, `exam`, `replay_floor`.
- **Requeue**: Returning a missed question later in the same run after the requeue gap given by the Backend.
- **Mastery**: A per-Topic number from 0 to 100 that the Backend reports.
- **Mastery_Band**: Weak (below 50), Learning (50 to 79), Strong (80 and above).
- **Floor_Rank**: S, A, B or C, reported by the Backend at finish.
- **Floor_Map**: The DOM and SVG screen that shows the Floors along a winding path.
- **Daily_Haunt**: A short run of due reviews across all Floors, shown as Revenants.
- **Revenant**: The haunted-memory monster from frontend-07 Phase 4.
- **Memory_Scroll**: The animated parchment shown after a wrong answer.
- **Combo_Meter**: The HUD element that displays the Backend streak with escalating tiers.
- **Chest**: The reward overlay shown after a Floor clear.
- **Tutorial**: The 30-second skippable first-run walkthrough.
- **Event_Bridge**: The typed React-to-Phaser event channel in `src/game/events.ts`.
- **Phaser_Layer**: All code under `src/game`.
- **Dev_Route**: A development-only route that renders large Dungeon fixtures.
- **Reduced_Motion**: The user's reduced motion preference as read by `useReducedMotion`.
- **PROPOSED_Item**: A contract addition listed in `docs/handoff/B-to-A.md` and built against the Mock_Adapter only.

## Requirements

### Requirement 1: Contract reconciliation

**User Story:** As a developer, I want the Frontend to match Person A's real contract before floors are added, so that real mode works against the live Backend.

#### Acceptance Criteria

1. THE Frontend SHALL record every mismatch between the Frontend and the Backend contract in the Contract reconciliation section of design.md, including the side that is correct and the Frontend fix.
2. THE Http_Client SHALL convert each real Backend response to the Domain_Model through a Wire_Mapper.
3. THE Http_Client SHALL validate each real Backend response against a wire zod schema before mapping.
4. IF a Backend response fails wire validation, THEN THE Http_Client SHALL throw a ContractError that names the endpoint and the failing field.
5. WHEN the Backend returns an error body of the form `{"detail": {"code", "message"}}`, THE Http_Client SHALL expose the code and message in the thrown ApiError.
6. WHEN the Backend returns a status 422 whose `detail` is an array, THE Http_Client SHALL expose a single friendly message and keep the status code.
7. THE Http_Client SHALL read the API base URL from `VITE_API_BASE` and fall back to `VITE_API_BASE_URL`.
8. THE Frontend SHALL send `credentials: "include"` on every Backend request and store no session token.
9. THE Mock_Adapter SHALL keep returning Domain_Model shapes so that the contract suite runs against the Mock_Adapter and, later, against the real API.

### Requirement 2: Floors data model

**User Story:** As a student, I want my notes to become a campaign of floors, so that large notes stay playable.

#### Acceptance Criteria

1. THE Domain_Model SHALL represent a Dungeon as an ordered list of Floors, each Floor holding its Topics, rooms, Floor_Boss and Floor_Status.
2. THE Domain_Model SHALL represent a Final_Boss with an id, name, HP and an unlocked flag.
3. THE Domain_Model SHALL represent Mastery per Topic as a number from 0 to 100.
4. THE Domain_Model SHALL define Run_Mode as exactly `floor`, `daily_haunt`, `weak_topics`, `exam` and `replay_floor`.
5. THE Frontend SHALL validate floors, Floor_Status, Final_Boss and Mastery with zod schemas.
6. WHERE the Backend response contains no `floors` field, THE Wire_Mapper SHALL present all rooms as one Floor titled "The Crypt".
7. THE Frontend SHALL ship fixtures with 1, 3, 10 and 25 Floors that validate against the schemas.

### Requirement 3: Mock campaign behaviour

**User Story:** As a developer, I want the mock to behave like the planned Backend, so that the UI is built and tested before the Backend adds floors.

#### Acceptance Criteria

1. THE Mock_Adapter SHALL store a Question_Pool per Topic.
2. WHEN a run starts, THE Mock_Adapter SHALL draw between 6 and 8 questions per Topic from the Question_Pool using a seeded random generator keyed by the run seed.
3. WHEN the same run seed and Question_Pool are used twice, THE Mock_Adapter SHALL return the same drawn questions in the same order.
4. THE Mock_Adapter SHALL return no repeated question within one Seeded_Draw.
5. WHEN a question is answered wrongly, THE Mock_Adapter SHALL return a `requeue_after` count and mark `is_retry` on the next presentation of that question.
6. THE Mock_Adapter SHALL return each drawn question exactly once more per miss, so that Requeue neither loses nor duplicates a question.
7. WHEN an attempt is recorded, THE Mock_Adapter SHALL update Mastery for the Topic and keep it within 0 to 100.
8. WHEN a Floor run finishes, THE Mock_Adapter SHALL return a Floor_Rank of S, A, B or C and Mastery per Topic.
9. WHEN a run is started with mode `daily_haunt`, THE Mock_Adapter SHALL build the run only from due review items across all Floors.
10. WHILE a Floor is `generating`, THE Mock_Adapter SHALL advance its status over time until it is `ready` or `failed`.

### Requirement 4: Development route and demo size

**User Story:** As a developer, I want a development-only route with large dungeons, so that I can check the map at 25 floors without faking floors in production.

#### Acceptance Criteria

1. WHERE the build is a development build, THE Frontend SHALL serve the Dev_Route at `/dev/floors`.
2. WHERE the build is a production build, THE Frontend SHALL leave the Dev_Route unregistered and fixtures of 3 or more Floors unreachable.
3. WHEN the Dev_Route receives a `floors` query value of 1, 3, 10 or 25, THE Dev_Route SHALL render the matching fixture.
4. THE Mock_Adapter SHALL serve the seeded demo with exactly 2 Floors and the Final_Boss in every build.

### Requirement 5: Floor map

**User Story:** As a student, I want a floor map, so that I see where I am in the campaign and what to play next.

#### Acceptance Criteria

1. THE Floor_Map SHALL show one node per Floor along a winding path, with the title, a Mastery ring, a boss icon and the Floor_Status.
2. WHILE a Floor is `locked`, THE Floor_Map SHALL cover its node with fog.
3. WHILE a Floor is `generating`, THE Floor_Map SHALL show a spinner on its node and the text "Floor N is being summoned...".
4. WHILE a Floor is `failed`, THE Floor_Map SHALL show a Retry button on its node.
5. WHILE a Floor is `cleared`, THE Floor_Map SHALL show its Floor_Rank on its node.
6. WHEN all Floors are `cleared`, THE Floor_Map SHALL unlock the Final_Boss node at the end of the path.
7. THE Floor_Map SHALL show the text "Your notes became N floors" with N equal to the Floor count.
8. WHERE a Dungeon has 25 or more Floors, THE Floor_Map SHALL render only the nodes near the viewport plus the focused node.
9. THE Floor_Map SHALL let a keyboard user reach every node with arrow keys, Home, End and Enter.
10. WHEN the player activates Continue, THE Floor_Map SHALL scroll to and open the next playable Floor.
11. IF the Dungeon has no Floors, THEN THE Floor_Map SHALL show an empty state that explains the notes are not ready.

### Requirement 6: Campaign flow

**User Story:** As a student, I want to play a floor and return to an updated map, so that the campaign feels continuous.

#### Acceptance Criteria

1. WHEN the player starts a Floor, THE Frontend SHALL start a run with that Floor's id and mode `floor` and load only that Floor's rooms into the existing room and encounter experience.
2. WHEN the Floor_Boss is defeated, THE Frontend SHALL finish the run and show the Scorecard.
3. WHEN the player leaves the Scorecard, THE Frontend SHALL refetch the Dungeon and show the updated Floor_Map.
4. IF the Backend rejects a run start, THEN THE Frontend SHALL show the Backend message and keep the player on the Floor_Map.
5. WHEN the Final_Boss is unlocked and the player starts it, THE Frontend SHALL run it through the same encounter experience as a Floor_Boss.

### Requirement 7: Daily Haunt

**User Story:** As a student, I want a daily review of due questions, so that I retrieve old material over several days.

#### Acceptance Criteria

1. WHEN the player starts the Daily_Haunt, THE Frontend SHALL start a run with mode `daily_haunt` and show each due question as a Revenant.
2. THE Frontend SHALL display Daily_Haunt Revenants with the existing Revenant visuals and counter.
3. WHEN the last Daily_Haunt Revenant is answered correctly, THE Frontend SHALL show a "memories laid to rest" finale and the daily streak returned by the Backend.
4. THE Dashboard SHALL show a Daily Haunt button with the due count and the daily streak.
5. IF no review is due, THEN THE Dashboard SHALL show a celebration message and the next due time.
6. THE Frontend SHALL use only the due list, the count and the streak that the Backend or Mock_Adapter returns.

### Requirement 8: Run modes

**User Story:** As a student, I want run modes, so that I can target weak topics, rehearse the exam or replay a floor.

#### Acceptance Criteria

1. THE Frontend SHALL offer a mode picker with Weak Topics, Exam and Replay Floor.
2. WHEN the player chooses Weak Topics, THE Frontend SHALL start a run with mode `weak_topics`.
3. WHEN the player chooses Exam, THE Frontend SHALL start a run with mode `exam` that covers all Topics.
4. WHERE the exam timer is enabled, THE Frontend SHALL show a countdown and finish the run when it reaches zero.
5. THE Frontend SHALL leave the exam timer off by default.
6. WHEN the player chooses Replay Floor and picks a cleared Floor, THE Frontend SHALL start a run with mode `replay_floor` and that Floor's id.

### Requirement 9: Second chance and Memory Scroll

**User Story:** As a student, I want a second chance and a clear explanation after a mistake, so that I learn from it.

#### Acceptance Criteria

1. WHEN an attempt response contains a `requeue_after` number, THE Frontend SHALL show "the question returns..." and present that question again after that many further questions.
2. WHEN an attempt response is wrong, THE Frontend SHALL show the Memory_Scroll with the explanation, the evidence quote and "From your notes: page X".
3. WHERE the attempt response contains the correct answer, THE Memory_Scroll SHALL show it.
4. IF the attempt response omits the correct answer, THEN THE Memory_Scroll SHALL omit that line and keep the retry action.
5. WHEN the player chooses quick retry, THE Frontend SHALL present the same question again.
6. THE Frontend SHALL read retry damage and reward from `is_retry` and `retry_multiplier` in the response and never compute them in real mode.

### Requirement 10: Mastery everywhere

**User Story:** As a student, I want mastery shown everywhere, so that I see real progress.

#### Acceptance Criteria

1. THE Frontend SHALL show a Mastery_Bar with the band label on the Floor_Map, the Scorecard and the Dashboard.
2. THE Mastery_Band function SHALL return Weak for values below 50, Learning for 50 to 79 and Strong for 80 and above.
3. THE Progress panel SHALL show notes conquered percent, memory strength per Topic, a streak calendar and the weakest concepts with page references.
4. WHERE the Backend omits a Progress panel field, THE Progress panel SHALL hide that block.
5. THE Frontend SHALL word all progress copy as measured numbers and SHALL NOT state that memorization is guaranteed.

### Requirement 11: Combo, rank and rewards

**User Story:** As a student, I want combo and rank feedback, so that streaks and floor results feel rewarding.

#### Acceptance Criteria

1. THE Combo_Meter SHALL display the streak returned by the Backend and the tier for that streak.
2. THE Combo_Meter SHALL use tier boundaries at streaks 3, 5, 8 and 12.
3. THE Scorecard and the Floor_Map node SHALL show the Floor_Rank returned by the Backend.
4. WHEN a Floor is cleared and the response has `chest_rewards`, THE Frontend SHALL show the Chest listing exactly those rewards.
5. IF `chest_rewards` is empty or missing, THEN THE Frontend SHALL skip the Chest.

### Requirement 12: Game feel

**User Story:** As a player, I want strong hit feedback, so that combat feels good without hurting accessibility.

#### Acceptance Criteria

1. WHEN a strong hit lands, THE Phaser_Layer SHALL play hit-stop and screen shake.
2. WHEN a boss is defeated, THE Phaser_Layer SHALL play a boss death sequence and a loot burst.
3. WHILE Reduced_Motion is on, THE Phaser_Layer SHALL skip hit-stop and shake and shorten the boss death sequence to a fade.
4. WHILE audio is muted, THE Frontend SHALL play no sound for the new events.
5. THE Phaser_Layer SHALL draw all new effects from pools without per-frame allocation.
6. THE Frontend SHALL report frames per second, particle counts and texture memory for the heaviest scenes in a performance report.

### Requirement 13: First-run tutorial

**User Story:** As a new player, I want a short skippable tutorial, so that I learn the loop quickly.

#### Acceptance Criteria

1. WHEN a player starts the game for the first time, THE Frontend SHALL show the Tutorial that covers move, engage, answer, memory scroll and Daily Haunt.
2. THE Tutorial SHALL last about 30 seconds and offer a Skip control on every step.
3. WHEN the Tutorial is completed or skipped, THE Frontend SHALL store a UI flag in localStorage and show no Tutorial on later visits.
4. THE Frontend SHALL merge the frontend-07 intro story and the Tutorial into one first-run flow.
5. THE Tutorial flag SHALL hold no token, score or progress value.

### Requirement 14: Accessibility and responsive layout

**User Story:** As a player with accessibility needs, I want the campaign to be usable by keyboard and screen reader, so that I can play.

#### Acceptance Criteria

1. THE Frontend SHALL let a keyboard-only player complete a Floor, the Daily_Haunt and every mode.
2. THE Frontend SHALL give each new control and map node an accessible name.
3. THE Frontend SHALL meet WCAG AA contrast for new text and controls.
4. THE Frontend SHALL announce Floor_Status changes, requeue notices and the Memory_Scroll through a polite live region.
5. WHILE Reduced_Motion is on, THE Frontend SHALL replace animated map transitions and the Memory_Scroll unrolling with instant changes.
6. THE Frontend SHALL lay out without clipped controls at 1366x768, 1536x864, 1920x1080, 2560x1440 and a tall phone size.

### Requirement 15: Authority and boundaries

**User Story:** As a developer, I want the authority and boundary rules enforced by tests, so that real mode never uses local rules.

#### Acceptance Criteria

1. WHEN the Http_Client is active, THE Frontend SHALL compute no damage, HP, XP, score, streak, rank, Mastery, review schedule, question selection or badge locally.
2. THE Phaser_Layer SHALL import nothing from `src/api`, `src/demo`, `src/state`, `src/offline` or the campaign modules.
3. THE Event_Bridge SHALL gain new events additively and leave existing events unchanged.
4. THE Frontend SHALL record every new Backend need in `docs/handoff/B-to-A.md` as a PROPOSED_Item before building it against the Mock_Adapter.
5. THE contract suite SHALL run against the Mock_Adapter and against the real API when `VITE_API_BASE` is set and mocks are off.

### Requirement 16: Verification and process

**User Story:** As a maintainer, I want each phase verified and documented, so that the work is reviewable.

#### Acceptance Criteria

1. WHEN a phase finishes, THE Frontend SHALL pass typecheck, lint, the full test suite, `npm run test:contract` and the build, and the real output SHALL be reported.
2. THE Frontend SHALL keep all 576 existing tests passing.
3. WHEN a phase finishes, THE maintainer task SHALL update `docs/kiro-log-frontend.md`.
4. WHEN new art is added, THE maintainer task SHALL record its license or code-drawn status in `ASSETS_LICENSES.md`.
5. WHEN a phase checkpoint is reached, THE agent SHALL stop, summarize, explain how to view and check, wait for approval and then commit that phase separately.
