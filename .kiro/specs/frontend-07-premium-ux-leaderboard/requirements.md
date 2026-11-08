# Requirements Document

## Introduction

Premium UX overhaul of StudyDungeon for the Kiroween 2026 hackathon. The Game_Client becomes a full-screen Halloween game with a character-led question encounter, weapon and boss-phase presentation, haunted-memory revenants, a leaderboard-driven scorecard and dashboard, themed auth screens, an offline demo fallback, badges, lore and a share card. An optional upload wizard closes the scope.

The feature is delivered on branch feature/frontend-premium-ux in phases 0 to 8. Each phase ends with a STOP checkpoint and the user approves before the next phase starts.

Two principles run through every requirement:

1. The Backend is authoritative for correctness, damage, HP, XP, score, streaks, rank and badges. The UI only displays what it receives. Only the Mock_Adapter and the clearly labeled Offline_Module compute these values locally.
2. Person A has not yet published api-contract.md, game-design.md or docs/handoff/demo_dungeon.sample.json. Until then, src/types/api.ts plus docs/handoff/B-to-A.md are the working contract, the balance values below are the working game rules, and every new backend need is a PROPOSED CONTRACT item built against the Mock_Adapter and marked pending.

Working game rules (verified against src/api/mock/mockAdapter.ts and src/demo/rules.ts): player 100 HP; topic-room monster 60 HP; boss 120 HP (6 correct answers); 20 damage per correct answer; 10 damage to the player per wrong answer in topic rooms; 12 damage to the player per wrong answer from the boss; 100 score and 10 XP per correct answer; 25 XP room clear; 100 XP boss clear.

## Glossary

- **Game_Client**: The frontend application under frontend/ (React 19, TypeScript, Vite, Tailwind 4, Phaser 3.90.0).
- **Backend**: Person A's service under backend/. It owns correctness, damage, HP, XP, score, streaks, rank and badges.
- **Api_Client**: The single typed interface (ApiClient) through which all network access flows. It has the implementations Http_Client, Mock_Adapter and Offline_Adapter.
- **Http_Client**: The real implementation that calls the Backend at VITE_API_BASE_URL with the session cookie.
- **Mock_Adapter**: The in-memory implementation selected when VITE_USE_MOCKS is "true". It computes outcomes for demos only.
- **Offline_Module**: The bundled rules engine, demo dungeon and Ghost Rivals under src/offline/, used only after the player chooses the Offline demo.
- **Offline_Adapter**: The Api_Client implementation backed by the Offline_Module.
- **Schema_Layer**: The zod schemas that validate every Http_Client response at runtime.
- **Contract_Error**: The typed error thrown when a response fails the Schema_Layer, naming the endpoint and the failing field path.
- **Contract_Suite**: The test suite run by npm run test:contract that executes identical assertions against the Mock_Adapter and, later, the Backend.
- **Fixtures**: JSON files under src/api/mock/fixtures that match the contract exactly. Fields not yet confirmed by Person A carry the marker PROPOSED in types and fixtures.
- **Proposed_Contract**: The section of docs/handoff/B-to-A.md listing new backend needs with example JSON, marked PROPOSED CONTRACT.
- **Event_Bridge**: The typed channel between React and Phaser in src/game/events.ts.
- **Scene_Renderer**: The Phaser code under src/game/. It imports nothing from src/api, src/demo, src/state, src/offline or src/leaderboard.
- **App_Shell**: The full-viewport React container that hosts the stage, backdrop, floating HUD and overlays.
- **Stage**: The Phaser canvas region inside the App_Shell.
- **Themed_Backdrop**: The CSS layer behind the Stage (dark gradient, vignette, subtle fog) that fills any area the canvas does not cover.
- **Viewport_Helper**: The pure functions in src/game/viewport.ts that map a viewport size to a camera zoom, a layout class and a HUD mode.
- **Floating_HUD**: The overlay HUD made of a top bar and a bottom controls legend.
- **Design_Tokens**: The spacing, typography, glow and elevation tokens in src/index.css.
- **Encounter_Popup**: The overlay that replaces the side Question_Panel. It dims the scene, slides a Portrait_Character in and shows the Speech_Panel.
- **Portrait_Character**: An original character drawn in code at portrait scale: Ghost, Vampire, Skeleton, Clockwork Golem, Witch or Exam Warden.
- **Pose**: One of idle, talking, hurt, taunt, defeated for a Portrait_Character.
- **Speech_Panel**: The themed parchment panel with a glowing edge and candle accent that shows the question.
- **Answer_Grid**: The 2x2 grid of large answer buttons with number badges.
- **Lines_File**: The data file src/encounter/lines.json holding 3 to 5 taunt lines and reaction lines per monster kind.
- **Typewriter**: The progressive text reveal of the question.
- **Source_Line**: The text "From your notes: page X" shown with the optional explanation.
- **Weapon**: One of rusty_dagger, arcane_staff, hunter_crossbow, spectral_hammer, flame_sigil.
- **Armory**: The panel listing unlocked and locked Weapons.
- **Critical_Hit**: An attempt result flagged is_critical by the Backend.
- **Boss_Phase**: The presentation state of the Exam Warden derived only from monster HP: normal while HP is at least 50 percent of max, enraged while HP is above 0 and below 50 percent, defeated at 0.
- **Revenant**: A ghostly monster built from a question the player previously answered wrong.
- **Due_Review**: A question the Backend marks as due for review; each Revenant is built from one.
- **Scorecard**: The end-of-run screen replacing the Victory_Overlay.
- **Mastery_Band**: Weak (below 50), Learning (50 to 79) or Strong (80 and above) for a topic mastery percentage.
- **Leaderboard**: The ranked list of players for a dungeon and a period.
- **Demo_Board**: The Leaderboard of the shared demo dungeon, the main board because every player gets the same questions.
- **Ghost_Rival**: A seeded, made-up demo player flagged is_seeded_rival and labeled "Ghost Rival - demo".
- **Provisional_Rank**: The rank shown to a guest or an unsaved run, computed against the board but not stored.
- **Dashboard**: The home screen for logged-in players, with a reduced version for guests.
- **Auth_Screens**: The themed login and register screens.
- **Share_Card**: The PNG image rendered on a canvas from the run result.
- **Badge**: One of the eight achievement ids listed in Requirement 15.
- **Reduced_Motion**: The existing flag from the OS preference and the Event_Bridge event set-reduced-motion.
- **Perf_Target**: 60 frames per second on an 8 GB integrated-GPU laptop.
- **Scale_Evidence**: The record in design.md of the Phaser 3.90.0 source lines that justify the Scale Manager choice.

## Requirements

### Requirement 1: Authority, scope and boundaries

**User Story:** As a maintainer, I want strict authority and import boundaries, so that the UI can never disagree with the Backend and Person A's code stays untouched.

#### Acceptance Criteria

1. THE Game_Client SHALL display damage, HP, XP, score, streak, rank, level and Badge values exactly as received from the active Api_Client implementation.
2. THE Game_Client SHALL compute damage, HP, XP, score, streak, rank and Badge values only inside the Mock_Adapter and the Offline_Module.
3. THE Game_Client SHALL confine all file edits to frontend/**, .kiro/specs/frontend-*, .kiro/hooks/frontend-*, .kiro/steering/frontend-*, docs/handoff/B-to-A.md and docs/kiro-log-frontend.md.
4. THE Scene_Renderer SHALL import nothing from src/api, src/demo, src/state, src/offline or src/leaderboard.
5. THE Event_Bridge SHALL keep every existing event type and payload shape unchanged, and SHALL add new events only as typed additions.
6. THE Game_Client SHALL call no live endpoint that is absent from docs/handoff/B-to-A.md.
7. WHEN a new Backend need arises, THE Game_Client SHALL record the need in the Proposed_Contract and build against it in the Mock_Adapter, marked pending until Person A confirms.
8. THE Game_Client SHALL keep every test that passes at the start of this feature passing at the end of every phase.
9. THE Game_Client SHALL record in the Proposed_Contract that Person A must supply api-contract.md, game-design.md and docs/handoff/demo_dungeon.sample.json.

### Requirement 2: Full-screen shell and scaling

**User Story:** As a player, I want the game to fill my whole window, so that characters have a strong presence at any screen size.

#### Acceptance Criteria

1. THE App_Shell SHALL occupy the full viewport using 100dvh, 100dvw and the safe-area insets.
2. THE Stage SHALL scale the Phaser canvas to fill the App_Shell using the scale mode recorded in Scale_Evidence.
3. WHEN the window is resized or the fullscreen state changes, THE Stage SHALL refit the canvas within 250 ms.
4. THE Themed_Backdrop SHALL fill every viewport area the canvas does not cover, so that no black bars appear.
5. THE Viewport_Helper SHALL return a camera zoom between 0.75 and 3.0 for every viewport size from 320x480 to 3840x2160.
6. WHEN the viewport size changes, THE Scene_Renderer SHALL apply the camera zoom returned by the Viewport_Helper for the new size.
7. WHEN the player presses the F key or activates the fullscreen button, THE App_Shell SHALL toggle browser fullscreen.
8. IF the browser rejects a fullscreen request, THEN THE App_Shell SHALL keep the current layout and show a short message.
9. THE Game_Client SHALL be verified at 1366x768, 1536x864, 1920x1080, 2560x1440 and a tall phone-sized window, with one result recorded per size.

### Requirement 3: Floating HUD and design tokens

**User Story:** As a player, I want a HUD that floats over the game without hiding the action, so that I can see the player and the monster at all times.

#### Acceptance Criteria

1. THE Floating_HUD SHALL render as an overlay with a top bar and a bottom controls legend above the Stage.
2. THE Floating_HUD SHALL keep its elements outside the rectangle that contains the player and the active monster.
3. WHILE the viewport width is below 640 px, THE Floating_HUD SHALL collapse to a compact bar with the controls legend behind a toggle.
4. THE Design_Tokens SHALL define a spacing scale, a typography scale, glow tokens and elevation tokens.
5. THE Game_Client SHALL give every interactive control visible hover, focus and pressed states.
6. THE Game_Client SHALL keep text contrast at or above 4.5:1 and interface-component contrast at or above 3:1.
7. WHILE Reduced_Motion is active, THE Game_Client SHALL replace HUD motion with instant state changes.

### Requirement 4: Character-led encounter pop-up

**User Story:** As a player, I want the monster to speak the question to me, so that each encounter feels like a duel with a character.

#### Acceptance Criteria

1. WHEN the player engages a monster with the E key, THE Encounter_Popup SHALL dim the scene and slide the Portrait_Character in from the left or the right.
2. THE Encounter_Popup SHALL choose the entry side by alternating on room order, so that consecutive rooms use opposite sides.
3. THE Speech_Panel SHALL show the question text in a parchment panel with a glowing edge and a candle accent.
4. THE Answer_Grid SHALL show every option as a large button with a number badge and a hover glow, in a 2x2 layout for four options.
5. WHEN the player presses a key from 1 to 4, THE Encounter_Popup SHALL submit the option with that number.
6. WHEN the player presses Enter after an answer result is shown, THE Encounter_Popup SHALL continue to the next step.
7. THE Encounter_Popup SHALL keep a Retreat button available while a question is open.
8. WHEN a question closes between questions, THE Encounter_Popup SHALL slide the Portrait_Character out within 300 ms.
9. WHILE the Encounter_Popup is open, THE Encounter_Popup SHALL move keyboard focus into the Speech_Panel and keep focus inside it until it closes.
10. WHILE Reduced_Motion is active, THE Encounter_Popup SHALL appear and disappear without slide animation.
11. THE Encounter_Popup SHALL replace the side Question_Panel, and THE Game_Client SHALL keep the continuous combat flow of the current combatMachine unchanged.

### Requirement 5: Characters, lines and typewriter

**User Story:** As a player, I want distinctive characters with personality, so that studying feels playful.

#### Acceptance Criteria

1. THE Game_Client SHALL draw the Ghost, Vampire, Skeleton, Clockwork Golem, Witch and Exam Warden Portrait_Characters in code, with original shapes, names and styling.
2. THE Game_Client SHALL provide the Poses idle, talking, hurt, taunt and defeated for every Portrait_Character.
3. WHEN a monster kind has no mapped Portrait_Character, THE Encounter_Popup SHALL show the Skeleton Portrait_Character.
4. THE Lines_File SHALL hold between 3 and 5 taunt lines and between 3 and 5 reaction lines per monster kind, all non-gory.
5. WHEN an encounter question opens, THE Speech_Panel SHALL show one taunt line from the Lines_File before the question.
6. WHEN an answer result is shown, THE Speech_Panel SHALL show one reaction line chosen from the Lines_File for the result.
7. THE Typewriter SHALL reveal the question text at a fixed character rate and SHALL complete the reveal when the player presses Space, Enter or clicks the Speech_Panel.
8. WHILE Reduced_Motion is active, THE Typewriter SHALL show the full question text immediately.
9. THE Typewriter SHALL expose the full question text to assistive technology from the first frame.

### Requirement 6: Answer feedback and sources

**User Story:** As a player, I want clear feedback on every answer, so that I learn from my mistakes.

#### Acceptance Criteria

1. WHEN a correct result is received, THE Encounter_Popup SHALL show the hurt Pose, the Scene_Renderer SHALL show a ghost-wisp burst and a weapon strike on the monster, and THE Encounter_Popup SHALL show the damage_dealt value from the result.
2. WHEN a wrong result is received, THE Encounter_Popup SHALL show a purple-red curse flash and the taunt Pose, and THE Floating_HUD SHALL show the player HP bar drop to player_hp_remaining.
3. WHEN a result is received, THE Encounter_Popup SHALL show the Source_Line, and SHALL append the explanation only when the result carries one.
4. THE Game_Client SHALL take every displayed damage number from the response and SHALL compute no damage locally.
5. WHEN the Scene_Renderer plays a result animation, THE Scene_Renderer SHALL emit result-animation-done exactly once for that result.
6. WHILE Reduced_Motion is active, THE Scene_Renderer SHALL replace bursts, shakes and flashes with a static hit marker.

### Requirement 7: Weapons and critical hits

**User Story:** As a player, I want each weapon to look different when I strike, so that progress feels rewarding.

#### Acceptance Criteria

1. THE Scene_Renderer SHALL draw a distinct strike effect for each Weapon: Rusty Dagger slash, Arcane Staff bolt, Hunter Crossbow arrow, Spectral Hammer shockwave and Flame Sigil fire burst.
2. WHEN a result carries weapon_id, THE Scene_Renderer SHALL play the strike effect for that Weapon.
3. IF a result carries an unknown or absent weapon_id, THEN THE Scene_Renderer SHALL play the Rusty Dagger effect.
4. WHEN a result carries is_critical true, THE Encounter_Popup SHALL show a larger damage number and the Scene_Renderer SHALL show a flash.
5. THE Armory SHALL list every Weapon from the progress response as unlocked or locked with its unlock level, on the Dashboard and in the pause menu.
6. WHILE Reduced_Motion is active, THE Scene_Renderer SHALL show a static strike marker for a Critical_Hit instead of a flash.

### Requirement 8: Boss phases

**User Story:** As a player, I want the boss to feel more dangerous as it weakens, so that the final fight builds tension.

#### Acceptance Criteria

1. THE Game_Client SHALL derive the Boss_Phase only from the monster HP and the monster max HP.
2. WHILE the Boss_Phase is enraged, THE Scene_Renderer SHALL apply a shifted screen tint and the new attack animation.
3. WHILE the Boss_Phase is enraged and Reduced_Motion is inactive, THE Scene_Renderer SHALL add extra fog and lightning within the existing particle budget.
4. WHEN the Boss_Phase changes to enraged, THE Game_Client SHALL switch the ambient audio to its enraged variant.
5. WHILE Reduced_Motion is active, THE Scene_Renderer SHALL apply the enraged tint without lightning or extra fog.
6. THE Scene_Renderer SHALL limit lightning to one flash per 8 seconds at a peak overlay alpha of 0.25.

### Requirement 9: Haunted memories (revenants)

**User Story:** As a learner, I want questions I got wrong to come back as ghosts, so that I review what I forgot.

#### Acceptance Criteria

1. WHEN the Api_Client returns Due_Reviews for a run, THE Game_Client SHALL show one Revenant for each Due_Review, up to 3 per room.
2. THE Scene_Renderer SHALL draw a Revenant with a glowing translucent look distinct from every normal monster.
3. WHEN the player engages a Revenant, THE Encounter_Popup SHALL show the intro line "The ghost of a question you forgot..." and then the question.
4. THE Floating_HUD and the Dashboard SHALL show a "Haunted memories due" counter equal to the due_review_count received.
5. WHEN a correct result for a Revenant is received, THE Scene_Renderer SHALL play a "memory laid to rest" effect and THE Game_Client SHALL decrement the displayed counter.
6. WHEN the Revenant list is empty, THE Game_Client SHALL show the counter as 0 and spawn no Revenant.
7. THE Event_Bridge SHALL carry Revenant spawn and rest events as typed additions.
8. WHILE the room monster is alive, THE Scene_Renderer SHALL hold Revenants back, so that the gate-open flow of the room stays unchanged.
9. THE Mock_Adapter SHALL return Due_Reviews built from questions the player answered wrong, plus a seeded set when VITE_MOCK_SEED_REVENANTS is "true".

### Requirement 10: Scorecard

**User Story:** As a player, I want a rewarding end-of-run screen, so that I can see how I did and where I rank.

#### Acceptance Criteria

1. WHEN finishRun returns, THE Scorecard SHALL count the score up from 0 to the received value.
2. THE Scorecard SHALL show an accuracy ring, an XP bar, the weapon unlocked, the Badges earned and per-topic mastery bars.
3. THE Scorecard SHALL classify each topic mastery percentage into the Mastery_Band: Weak below 50, Learning from 50 to 79, Strong from 80.
4. THE Scorecard SHALL list weak concepts with the Source_Line for each.
5. WHEN the response carries level_up, THE Scorecard SHALL play a level-up effect on the XP bar.
6. THE Scorecard SHALL reveal the leaderboard position with an animated rank reveal.
7. THE Scorecard SHALL offer the buttons Play again, View leaderboard and Share card.
8. WHILE the player is a guest, THE Scorecard SHALL offer the button Create account to save progress.
9. WHILE Reduced_Motion is active, THE Scorecard SHALL show final values without count-up or reveal animation.
10. IF finishRun fails, THEN THE Scorecard SHALL show the error with a Retry button and keep the run values already received.

### Requirement 11: Leaderboard screen

**User Story:** As a player, I want to see how I rank against others, so that I feel motivated to improve.

#### Acceptance Criteria

1. THE Leaderboard screen SHALL be readable by guests and by logged-in players.
2. THE Leaderboard screen SHALL show the Demo_Board as the main board, and SHALL show only the player's own best runs for personal uploaded dungeons.
3. THE Leaderboard screen SHALL offer the tabs All-time and This week.
4. THE Leaderboard screen SHALL show a top-3 podium followed by a scrolling list with rank, themed avatar, display name, level, score, accuracy, best streak and Badge icons per row.
5. THE ranking function SHALL order entries by score descending, then accuracy descending, then best streak descending, then display name ascending, then entry id ascending.
6. THE Leaderboard screen SHALL pin the current player's row and highlight it.
7. WHEN the current player has no stored entry, THE Leaderboard screen SHALL show the Provisional_Rank computed by inserting the player's run into the entries.
8. WHILE the player is a guest, THE Leaderboard screen SHALL show the call to action "Create an account to claim your spot".
9. THE Leaderboard screen SHALL label every entry with is_seeded_rival true as "Ghost Rival - demo".
10. WHILE the Leaderboard screen is open, THE Game_Client SHALL refetch the board every 30 seconds, and SHALL stop refetching when the screen closes.
11. WHILE the board loads, THE Leaderboard screen SHALL show a skeleton; WHEN the board is empty, it SHALL show an empty state; IF the fetch fails, THEN it SHALL show an error state with a Retry button.
12. THE Game_Client SHALL use no websockets.

### Requirement 12: Dashboard

**User Story:** As a returning player, I want a home screen that shows my progress and next steps, so that I can jump straight back in.

#### Acceptance Criteria

1. WHILE the player is logged in, THE Dashboard SHALL show level, XP bar, Continue Dungeon, Play Demo, a top-5 leaderboard preview with the player highlighted, recent runs, the Haunted memories due counter, a Badge grid, the Armory, and links to upload and settings.
2. WHILE the player is a guest, THE Dashboard SHALL show the demo dungeon card, provisional stats and a Create account call to action.
3. WHEN the player activates Play Demo, THE Dashboard SHALL start the demo session.
4. IF the progress request fails, THEN THE Dashboard SHALL show an error state with a Retry button and keep the other cards usable.
5. WHILE the progress request is pending, THE Dashboard SHALL show skeleton placeholders.

### Requirement 13: Auth screens

**User Story:** As a visitor, I want to create an account or log in with a simple form, so that I can save my progress.

#### Acceptance Criteria

1. THE Auth_Screens SHALL provide exactly two input fields: username and password.
2. THE Auth_Screens SHALL provide a show/hide password control.
3. WHEN a field value breaks a validation rule, THE Auth_Screens SHALL show a specific message next to that field.
4. THE Auth_Screens SHALL show a friendly message for each of the statuses 401, 409, 422, 429 and 5xx.
5. THE Auth_Screens SHALL rely on the cookie session only and SHALL store no token in localStorage or sessionStorage.
6. WHEN the Api_Client reports a successful login or registration, THE Game_Client SHALL navigate to the Dashboard.
7. WHEN the Api_Client returns 429, THE Auth_Screens SHALL disable submit for the number of seconds in the Retry-After header, or 10 seconds when the header is absent.

### Requirement 14: Loading state and offline demo

**User Story:** As a player at a demo table, I want the game to start even when the server is asleep, so that I am never stuck on a loading screen.

#### Acceptance Criteria

1. WHILE POST /demo/session is pending, THE Game_Client SHALL show the "Waking up the dungeon..." screen with rotating tips.
2. IF POST /demo/session does not complete within 8 seconds, THEN THE Game_Client SHALL offer the Offline demo while continuing to wait for the server.
3. WHEN the player chooses the Offline demo, THE Game_Client SHALL switch the Api_Client to the Offline_Adapter.
4. WHILE the Offline_Adapter is active, THE Game_Client SHALL show the label "Offline demo - progress is not saved".
5. THE Offline_Module SHALL apply the working game rules deterministically, so that the same answer sequence always yields the same results.
6. THE Offline_Module SHALL bundle a demo dungeon and Ghost_Rivals, using docs/handoff/demo_dungeon.sample.json when Person A has supplied it and the placeholder demoDungeon.json otherwise.
7. WHILE the Game_Client runs in normal mode, THE Game_Client SHALL load no code from the Offline_Module except through the explicit Offline demo choice.
8. WHILE the player is a guest, THE Game_Client SHALL show the banner "Playing as guest. Progress is temporary. Create an account to save."

### Requirement 15: Badges, lore and share card

**User Story:** As a player, I want achievements and a shareable result, so that I can show off my run.

#### Acceptance Criteria

1. THE Game_Client SHALL support these Badge ids: perfect_room, no_damage, streak_5, boss_slayer, first_blood, memory_keeper, speed_reader, dungeon_master.
2. WHILE VITE_USE_MOCKS is "true" or the Offline_Adapter is active, THE Mock_Adapter and the Offline_Module SHALL compute Badges for demos; WHILE the Http_Client is active, THE Game_Client SHALL display the badges_earned list from the Backend.
3. THE Mock_Adapter and the Offline_Module SHALL award memory_keeper after 3 Revenants are cleared, and SHALL leave speed_reader off by default.
4. THE Game_Client SHALL show a skippable intro story once per browser, followed by each monster's taunt lines in encounters.
5. WHEN the player activates Share card, THE Game_Client SHALL render a PNG on a canvas with score, rank, Badges and the dungeon name.
6. THE Game_Client SHALL offer a Download button for the PNG.
7. THE Game_Client SHALL offer a Copy post text button whose text starts with #KiroweenHackathon26.
8. THE Share_Card renderer SHALL make no external image request and SHALL use only self-hosted fonts.
9. IF the clipboard write is rejected, THEN THE Game_Client SHALL show the post text in a selectable field.

### Requirement 16: Upload wizard (optional)

**User Story:** As a logged-in player, I want to upload my notes, so that I can play a dungeon built from my own material.

#### Acceptance Criteria

1. WHERE the upload wizard is enabled, THE Game_Client SHALL accept files by drag and drop and by a file picker.
2. WHERE the upload wizard is enabled, THE Game_Client SHALL list accepted formats exactly as api-contract.md states them, and SHALL show the format list as pending until Person A publishes api-contract.md.
3. WHERE the upload wizard is enabled, THE Game_Client SHALL show progress steps, the relevance result with the reason when rejected, and the detected topics.
4. WHILE the player is a guest, THE Game_Client SHALL hide the upload wizard and show "Create an account to upload your own notes".

### Requirement 17: Backend-ready API layer

**User Story:** As Person B, I want a typed, validated and testable API layer, so that switching to Person A's backend needs only configuration plus the fixes the tests reveal.

#### Acceptance Criteria

1. THE Game_Client SHALL route all network access through the Api_Client interface, and no component SHALL call fetch directly.
2. THE Game_Client SHALL select the Mock_Adapter or the Http_Client with VITE_USE_MOCKS.
3. THE Schema_Layer SHALL validate every Http_Client response with zod at the pinned version 4.6.7.
4. IF a response fails validation, THEN THE Schema_Layer SHALL throw a Contract_Error naming the endpoint and the field path, and THE Game_Client SHALL show a clear error instead of rendering partial data.
5. THE Contract_Suite SHALL run through npm run test:contract and SHALL cover demo session, dungeon, run, attempt, room clear, finish, progress and leaderboard.
6. WHEN VITE_API_BASE_URL is set and VITE_USE_MOCKS is not "true", THE Contract_Suite SHALL run the same assertions against the Backend.
7. THE Fixtures SHALL validate against the Schema_Layer.
8. THE Fixtures SHALL mark every field that is not yet confirmed by Person A with PROPOSED.
9. THE Proposed_Contract SHALL describe GET /leaderboard, the finishRun additions, the progress additions, the attempt additions, the Due_Review delivery and the note on scoring changes, each with example JSON.
10. THE Game_Client SHALL work end to end on the Mock_Adapter without waiting for Person A.

### Requirement 18: Phase 0 housekeeping

**User Story:** As a maintainer, I want tooling and documentation in place before feature work, so that every later phase is checked automatically and documented honestly.

#### Acceptance Criteria

1. THE Game_Client repository SHALL contain .kiro/hooks/frontend-lint-test-on-save.json that runs lint, typecheck and tests when a frontend source file is saved, in the format given by the current Kiro hooks documentation.
2. THE docs/kiro-log-frontend.md file SHALL record the specs, property-based testing and hooks used so far, drawn only from work that happened.
3. THE .kiro/steering/frontend-ui-standards.md file SHALL hold design tokens, motion rules, accessibility rules and adapter rules, marked as a PROPOSAL for Person A's review.
4. THE docs/handoff/B-to-A.md file SHALL contain the Proposed_Contract section.
5. THE Phase 0 checkpoint SHALL show the plan to the user before Phase 1 starts.

### Requirement 19: Performance, accessibility and art

**User Story:** As a player on a modest laptop, I want smooth motion and readable screens, so that the game is comfortable to play.

#### Acceptance Criteria

1. THE Scene_Renderer SHALL sustain the Perf_Target in every new scene state.
2. THE Scene_Renderer SHALL allocate no objects per frame in new systems and SHALL reuse pooled objects.
3. THE Game_Client SHALL respect Reduced_Motion and the mute setting in every new effect and sound.
4. THE Game_Client SHALL meet WCAG AA contrast for all new text and components.
5. THE Game_Client SHALL draw all art in code or use licensed assets recorded in ASSETS_LICENSES.md.
6. THE Game_Client SHALL copy no art, names or style from the commercial game that inspired the Encounter_Popup layout, and SHALL use that game only as a layout idea.
7. THE Game_Client SHALL provide keyboard access and visible focus for every new control.
8. THE Game_Client SHALL announce answer results and rank changes through an aria-live region.

### Requirement 20: Testing and process

**User Story:** As a maintainer, I want every phase verified and reviewed, so that regressions are caught early and the user stays in control.

#### Acceptance Criteria

1. THE Game_Client SHALL run typecheck, lint, the full test suite and a production build at the end of every phase and report the real output.
2. THE Game_Client SHALL report measured fps and particle counts for each new scene state at the end of the phase that adds it.
3. THE Game_Client SHALL include property-based tests for leaderboard ordering and tie-breaking, Provisional_Rank insertion, the pinned me row, Ghost_Rival labeling, Offline_Module rules, Badge rules, Boss_Phase thresholds and Viewport_Helper results.
4. THE Game_Client SHALL include a test that fails when a normal-mode module statically imports the Offline_Module.
5. THE Game_Client SHALL keep the Scene_Renderer import-boundary test passing and extend it to cover src/offline and src/leaderboard.
6. WHEN a phase completes, THE Game_Client SHALL commit that phase separately on branch feature/frontend-premium-ux.
7. WHEN a phase completes, THE Game_Client SHALL update docs/kiro-log-frontend.md, and ASSETS_LICENSES.md when assets change.
8. WHEN a phase checkpoint is reached, THE Game_Client SHALL summarize what changed, how to view it and what to check, and SHALL wait for user approval before the next phase.
