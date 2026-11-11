# Requirements Document

## Introduction

StudyDungeon now has a real identity layer on the Backend (backend-07: named guests with a 30-day cookie, account upgrade, account deletion). The product decision behind this feature is that the game becomes a place with real players: a guest picks a display name, chooses between preloaded dungeons and their own notes, earns Leaderboard points that accumulate across preloaded packs, and competes on a leaderboard that lists only real players. This feature builds the Frontend for that, in five phases after a Phase 0 plan:

- Phase 0: read the specs, the mobile work and the handoff documents; write this spec, the PROPOSED contract changes and the cut list (documents only).
- Phase 1: guest entry (name screen, choice screen, session survival, upgrade, delete account, warm-up call).
- Phase 2: preloaded packs (pack progress, next dungeon unlocked, all packs completed, points display and the Dungeon score / Leaderboard points labels).
- Phase 3: leaderboard with real players (tabs, top 20, live "You" panel, freshness countdown).
- Phase 4: player counter on the title screen.
- Phase 5: upload path for guests (quota states, AI notice, type-limit errors, per-floor progress).

The Backend is authoritative for points, ranks, names and counts. The Frontend only displays. Local computation is allowed only in the Mock_Adapter and the labeled Offline_Demo. Endpoints that Person A has not built are PROPOSED_Items: they are built against the Mock_Adapter, validated with zod when real, and hidden in real mode until the Backend proves them.

## Glossary

- **Frontend**: The React 19, TypeScript, Vite client in `frontend/`.
- **Backend**: Person A's FastAPI service. Read-only for this feature.
- **Api_Client**: The typed interface in `src/api/ApiClient.ts` with Http_Client, Mock_Adapter and Offline_Demo implementations.
- **Http_Client**: The real implementation that calls the Backend and validates every response with zod.
- **Mock_Adapter**: The in-memory implementation used for development, tests and demos. The only place besides Offline_Demo where game rules are computed.
- **Offline_Demo**: The labeled offline fallback module in `src/offline`, loaded only through a dynamic import after the player chooses it.
- **Capability**: A flag on the Api_Client that says whether the Backend supports a feature (`ApiCapabilities`).
- **Guest**: A player with a session cookie and `is_guest` true who has not created a login.
- **Display_Name**: The public name a player picks, 3 to 16 characters.
- **Handle**: The public form `Name#1234` returned by the Backend as `handle`.
- **Local_Name_Rules**: The client-side hint rules: after trimming and NFKC normalization, 3 to 16 characters; ASCII letters, digits, space, underscore and hyphen only; first and last character a letter or digit; no two spaces in a row. The Backend remains the validator and also applies a moderation list that the Frontend does not hold.
- **Name_Screen**: The page at `/play-as-guest` where a Guest enters a Display_Name.
- **Path_Choice**: The page at `/choose` (and the same component on the Dashboard) with the two cards "Play preloaded dungeons (try the game)" and "Upload my notes (play from your own material)".
- **Pack**: A hand-reviewed preloaded dungeon in a fixed order, with floors and a final boss.
- **Pack_Status**: One of `locked`, `available`, `in_progress`, `completed`.
- **Dungeon_Score**: The run value (`score`, `current_score`) shown on the HUD and the scorecard.
- **Leaderboard_Points**: The server-only leaderboard currency (`points_*` fields). Separate from Dungeon_Score.
- **Board**: One of `preloaded`, `own_notes`, `overall`.
- **Period**: One of `all` (All-time) or `week` (This week).
- **Snapshot**: The leaderboard top 20 that the Backend recomputes at most once per hour.
- **You_Panel**: The pinned panel that shows the live rank and points of the current player from the `me` block.
- **Player_Counter**: The title-screen line "N explorers have braved the dungeon" (10 or more players) or "Be among the first explorers" (1 to 9 players).
- **Spooky_Name**: A locally generated Display_Name made of an adjective and a creature, such as "Hollow Raven" or "Velvet Wraith".
- **Spooky_Name_Generator**: The pure module `src/identity/spookyNames.ts` that produces Spooky_Names.
- **Waking_Screen**: The "Waking up the dungeon..." screen shown when a guest-creation request takes longer than 8 s.
- **WAKE_MAX_MS**: The constant 60,000 ms, the total time the Waking_Screen keeps waiting after "Keep waiting".
- **Upload_Limits**: The single constants module `src/upload/limits.ts` that holds all upload limits.
- **Demo_Pill**: The "How to play · 30 sec" pill that opens the full tutorial.
- **Quota**: The upload allowance returned by `GET /uploads/quota`.
- **AI_Notice**: The upload notice that the player must tick before the first upload.
- **Ghost_Rival**: A seeded fake player that exists only in the Mock_Adapter and the Offline_Demo.
- **Warm_Up_Call**: One `GET /health` sent without cookies when the title screen loads.
- **Phaser_Layer**: All code under `src/game`.
- **Reduced_Motion**: The user's reduced motion preference as read by `useReducedMotion`.
- **Touch_Mode**: The state set by `useTouchMode` as `html[data-touch]`.
- **PROPOSED_Item**: A contract addition listed in `docs/handoff/B-to-A.md` and built against the Mock_Adapter only.

## Requirements

### Requirement 1: Capabilities and fallbacks

**User Story:** As a developer, I want every new feature gated by a Capability with a fallback, so that real mode keeps working against a Backend that has not built the feature.

#### Acceptance Criteria

1. THE Http_Client SHALL start with the Capabilities guestIdentity, accountUpgrade and accountDelete on, because backend-07 is merged to main.
2. THE Http_Client SHALL start with the Capabilities packs, liveBoard, playerCounter, uploadQuota and guestUpload unproven.
3. WHILE a Capability is unproven, THE Frontend SHALL make the first call of that feature and show a loading state until the call answers.
4. WHEN the first call to an endpoint of an unproven Capability answers 2xx with a body that passes its wire schema, THE Http_Client SHALL turn the Capability on for the rest of the page session.
5. WHEN an endpoint answers 404, 405 or 501, THE Http_Client SHALL turn the matching Capability off for the rest of the page session.
6. IF an endpoint answers with any other error, THEN THE Http_Client SHALL keep the matching Capability unchanged and expose the error.
7. WHILE a Capability is off, THE Frontend SHALL show the documented fallback for that feature and call no further endpoint of that feature.
8. THE Mock_Adapter SHALL report every Capability on.
9. THE Offline_Demo SHALL report the Capabilities guestIdentity, accountUpgrade, accountDelete, packs, liveBoard, playerCounter, uploadQuota and guestUpload off.
10. WHEN a guest session receives a 2xx answer from `GET /uploads/quota`, THE Http_Client SHALL turn the Capability guestUpload on.
11. WHEN `POST /documents` answers 403 GUEST_FORBIDDEN, THE Http_Client SHALL turn the Capability guestUpload off.

### Requirement 2: Guest name screen

**User Story:** As a visitor, I want to pick a display name before I play, so that I appear on the leaderboard under a name I chose.

#### Acceptance Criteria

1. WHEN the player activates Try the Demo, THE Frontend SHALL open the Name_Screen directly, with no intro story, tutorial or other step before it.
2. WHEN a session already exists on arrival at the Name_Screen, THE Frontend SHALL redirect to the Path_Choice without showing the form.
3. THE Name_Screen SHALL show an editable Display_Name field prefilled with a Spooky_Name, a "Roll another" button, the notice "Your name and points appear on the public leaderboard." directly above the primary button, and the primary button labelled "Accept and continue".
4. THE Spooky_Name_Generator SHALL produce, locally and without a network call, only names that satisfy the Local_Name_Rules, are at most 16 characters long and contain no reserved or profane word.
5. WHEN the player activates "Roll another", THE Name_Screen SHALL replace the Display_Name with a Spooky_Name that differs from the current Display_Name.
6. WHILE the Display_Name breaks the Local_Name_Rules, THE Name_Screen SHALL show a hint that names the broken rule and keep the primary button disabled.
7. WHEN the Display_Name satisfies the Local_Name_Rules and stays unchanged for 500 ms, THE Name_Screen SHALL send one name check for that value.
8. WHEN the name check answers `ok: false`, THE Name_Screen SHALL show a friendly message for the returned reason and keep the primary button disabled.
9. IF a name check answers 429, THEN THE Name_Screen SHALL send no further name checks and rely on the submit response.
10. WHEN the player activates "Accept and continue" or presses Enter in the Display_Name field, THE Name_Screen SHALL treat that action as the acceptance of the public notice, send the Display_Name with `accept_public_notice` true exactly once and ignore repeated submits while the request is pending.
11. IF the Backend answers NAME_INVALID, THEN THE Name_Screen SHALL show the message for the returned reason and keep the entered values.
12. IF the Backend answers 429, THEN THE Name_Screen SHALL show the wait time taken from the `Retry-After` header.
13. IF the Backend answers 503 GUEST_CREATION_PAUSED, THEN THE Name_Screen SHALL show a friendly message and offer the Offline_Demo.
14. IF the Backend answers 409 SESSION_EXISTS, THEN THE Frontend SHALL read the current user from `GET /auth/me` and continue to the Path_Choice.
15. WHEN the create request (or the legacy `POST /demo/session` request) has been pending for 8 s, THE Frontend SHALL show the Waking_Screen with the two choices "Keep waiting" and "Play offline demo".
16. WHEN the player chooses "Keep waiting", THE Frontend SHALL keep the request alive, keep rotating the tips and wait until WAKE_MAX_MS (60,000 ms) have passed since the request started.
17. IF the request is still pending after WAKE_MAX_MS, THEN THE Frontend SHALL show a friendly error with a Retry button and the choice "Play offline demo".
18. THE Frontend SHALL start the Offline_Demo for a real session only when the player chooses "Play offline demo", and SHALL start it on no timeout, error or capability change.
19. WHEN the request succeeds while the Waking_Screen choices are shown and the player has not chosen the Offline_Demo, THE Frontend SHALL continue normally to the Path_Choice.
20. WHERE the Capability guestIdentity is off, THE Frontend SHALL start the Guest through `POST /demo/session` and open the returned dungeon.

### Requirement 3: Guest identity display and persistence

**User Story:** As a guest, I want my name to stay with me and to be shown, so that I recognize myself in the game and on the board.

#### Acceptance Criteria

1. WHEN a Guest is created, THE Frontend SHALL keep the returned user in memory and write no user data to localStorage or sessionStorage.
2. WHEN the page reloads while the cookie is valid, THE Frontend SHALL restore the Guest through `GET /auth/me`.
3. THE Frontend SHALL show the Handle of a Guest in the HUD, the GuestBanner and the Dashboard.
4. THE Frontend SHALL show no login `username` of a Guest on any screen.
5. WHEN a registered user has no `handle` in the response, THE Frontend SHALL show the username of that registered user.
6. THE wire user schema SHALL accept the additive optional fields `public_id`, `display_name`, `tag` and `handle` and a null `username`.

### Requirement 4: Account upgrade

**User Story:** As a guest, I want to create an account without losing my name and points, so that my progress is kept.

#### Acceptance Criteria

1. WHILE the signed-in user is a Guest and the Capability accountUpgrade is on, THE GuestBanner, the Dashboard and the Scorecard SHALL offer "Create an account to keep your name and points".
2. WHEN a Guest submits the account form, THE Frontend SHALL call `POST /auth/upgrade` instead of `POST /auth/register`.
3. WHEN the upgrade succeeds, THE Frontend SHALL replace the session user with the response and show the unchanged Handle.
4. IF the Backend answers USERNAME_TAKEN or NOT_A_GUEST, THEN THE Frontend SHALL show a friendly message for that code.
5. WHEN `POST /auth/upgrade` answers 404, 405 or 501, THE Http_Client SHALL turn the Capability accountUpgrade off.
6. WHILE the Capability accountUpgrade is off, THE Frontend SHALL hide the offer "Create an account to keep your name and points".

### Requirement 5: Path choice

**User Story:** As a player, I want to choose between preloaded dungeons and my own notes, so that I can start playing in the way I prefer.

#### Acceptance Criteria

1. WHEN a session exists after the Name_Screen, THE Frontend SHALL open the Path_Choice at `/choose`.
2. THE Path_Choice SHALL show two cards titled "Play preloaded dungeons (try the game)" and "Upload my notes (play from your own material)".
3. WHEN a registered user opens the Dashboard, THE Dashboard SHALL show the same Path_Choice cards.
4. WHEN a returning player (one who has cleared at least one room of the resolved preloaded dungeon) activates the preloaded card, THE Frontend SHALL open the floor map of the first playable preloaded dungeon, resolved from the packs, then from the public demo dungeon in `GET /dungeons`.
5. WHILE a session exists, THE Frontend SHALL NOT call `POST /demo/session`, because that call replaces the cookie with a new anonymous Guest.
6. IF no preloaded dungeon can be resolved, THEN THE Frontend SHALL show a friendly message with a Retry button and the Offline_Demo offer.
7. WHEN the player activates the upload card, THE Frontend SHALL open `/upload`.
8. WHILE the Capability uploadQuota is not off, THE upload card SHALL show the Quota state from the Backend.
9. THE Path_Choice SHALL highlight the card "Play preloaded dungeons (try the game)" as the default and give that card initial keyboard focus, so that pressing Enter activates it.
10. WHEN a first-time player (one for whom the resolved preloaded dungeon shows no cleared room) activates the preloaded card, THE Frontend SHALL open the first playable floor run at `/campaign/{id}/play/{firstPlayableFloorId}` instead of the floor map, and WHERE the Backend is a legacy single-floor Backend, THE Frontend SHALL use the existing floor-1 route mapping.
11. THE Frontend SHALL decide "first time" only from data returned by the Backend (the Pack_Status and cleared counts of `GET /packs`, or the cleared rooms in the dungeon or progress data), SHALL write no progress to localStorage or sessionStorage, and SHALL open the floor map when the data is missing or the request fails.

### Requirement 6: Delete my account and data

**User Story:** As a player, I want to delete my account and data, so that my name and study material are removed when I choose.

#### Acceptance Criteria

1. THE Settings page at `/settings` SHALL replace the "coming soon" placeholder and contain the action "Delete my account and data".
2. WHEN the player opens the action, THE Frontend SHALL list what is removed and ask the player to type DELETE.
3. WHILE the typed text differs from DELETE, THE confirmation dialog SHALL keep the confirm button disabled.
4. WHEN the player confirms, THE Frontend SHALL send `DELETE /auth/me` with the body `{"confirm":"DELETE"}`.
5. WHEN the deletion succeeds, THE Frontend SHALL clear the session and every in-memory cache and open the title screen.
6. IF the Backend answers 403 SYSTEM_USER_PROTECTED or 422 CONFIRMATION_REQUIRED, THEN THE Frontend SHALL show the message and keep the session.
7. IF the Backend answers 401, THEN THE Frontend SHALL treat the player as signed out and open the title screen.

### Requirement 7: Warm-up call

**User Story:** As a player on a sleeping free-tier server, I want the server to start waking while I read the title screen, so that my first request is faster.

#### Acceptance Criteria

1. WHEN the title screen loads while the Http_Client is active, THE Frontend SHALL send one `GET /health` without cookies and ignore the result.
2. THE Frontend SHALL send at most one Warm_Up_Call per page load.
3. WHILE the Mock_Adapter or the Offline_Demo is active, THE Frontend SHALL send no Warm_Up_Call.
4. IF the Warm_Up_Call fails, THEN THE Frontend SHALL show no message and continue.

### Requirement 8: Preloaded packs

**User Story:** As a player, I want to see my progress through the preloaded dungeons, so that I know what to play next.

#### Acceptance Criteria

1. WHILE the Capability packs is not off, THE Frontend SHALL request `GET /packs` and show a pack page at `/packs` that lists every Pack in order with its number, title, Pack_Status, floors cleared out of floors total and points earned.
2. THE Frontend SHALL show the Pack_Status exactly as returned and compute no unlock in real mode.
3. WHILE a Pack is `locked`, THE pack page SHALL show the text "Clear the previous dungeon's final boss to unlock" and no Play button.
4. WHEN the player activates Play on a Pack that is `available` or `in_progress`, THE Frontend SHALL open the floor map of that Pack's dungeon.
5. WHILE the floor map shows a dungeon that belongs to a Pack, THE floor map SHALL show "Pack N of M" and the points earned in that Pack.
6. THE Mock_Adapter SHALL serve at least three Packs, where Pack 1 is the existing demo dungeon and Packs 2 and 3 are labeled sample content.
7. WHEN the final boss of Pack N is cleared in the Mock_Adapter, THE Mock_Adapter SHALL set Pack N to `completed` and Pack N+1 to `available`.
8. IF a run start answers 403 PACK_LOCKED, THEN THE Frontend SHALL show the message and open the pack page.
9. WHILE the Capability packs is off, THE Frontend SHALL open the single preloaded dungeon resolved from `GET /dungeons` and show no pack page.
10. WHILE the Mock_Adapter is active, THE pack page, the floor map and the "Next dungeon unlocked" screen SHALL show the label "Sample content" for Pack 2 and Pack 3.

### Requirement 9: Next dungeon unlocked and all packs completed

**User Story:** As a player, I want a clear reward when I finish a pack, so that I feel progress and know what comes next.

#### Acceptance Criteria

1. WHEN a finish response contains `pack_progress.unlocked_pack_id`, THE Scorecard Continue action SHALL open a "Next dungeon unlocked" screen that names the unlocked Pack.
2. WHEN the player activates Continue on the "Next dungeon unlocked" screen, THE Frontend SHALL open the floor map of the unlocked Pack.
3. WHEN a finish response contains `pack_progress.all_completed` true, THE Scorecard Continue action SHALL open an "All dungeons conquered" screen.
4. THE "All dungeons conquered" screen SHALL offer "Upload my notes" and, WHERE the Capability dailyHaunt is on, a Daily Haunt button.
5. WHEN a finish response contains no `pack_progress` and the Capability packs is on, THE Frontend SHALL refetch the packs and show the "Next dungeon unlocked" screen for a Pack that changed from `locked` to `available`.
6. THE screens SHALL show the accumulated Leaderboard_Points from `player_points.preloaded` as received.
7. WHILE Reduced_Motion is on, THE celebration screens SHALL show no animation.

### Requirement 10: Points display and labels

**User Story:** As a player, I want to see the points I earn and to tell them apart from my dungeon score, so that I understand the leaderboard.

#### Acceptance Criteria

1. THE Frontend SHALL label the run value "Dungeon score" on the HUD, the victory and defeat overlays, the Scorecard and the share card.
2. THE Frontend SHALL label the leaderboard value "Leaderboard points" on the leaderboard, the You_Panel, the points pop-up and the Scorecard.
3. WHEN an attempt response contains `points_awarded` greater than 0, THE encounter popup SHALL show "+N" next to the damage number.
4. WHEN an attempt response contains a reduced `points_reason`, THE encounter popup SHALL show a short reason text next to the points.
5. WHEN an attempt response contains no `points_awarded`, THE encounter popup SHALL show no points text.
6. THE Scorecard SHALL show Dungeon score and Leaderboard points on separate lines with a one-line explanation of the difference.
7. THE Frontend SHALL show `points_awarded`, `points_earned` and `player_points` as received and compute none of them in real mode.

### Requirement 11: Leaderboard with real players

**User Story:** As a player, I want a leaderboard of real players, so that my rank means something.

#### Acceptance Criteria

1. WHILE the Capability liveBoard is not off, THE leaderboard page SHALL request `GET /leaderboard` with the selected Board and Period and show only the entries returned.
2. THE leaderboard page SHALL offer the tabs Preloaded, Own notes and Overall and one line of explanation for the selected tab.
3. THE leaderboard page SHALL offer the Period tabs All-time and This week.
4. WHILE the This week tab is selected, THE leaderboard page SHALL show the reset time and the timezone returned in `week`.
5. THE leaderboard page SHALL show at most 20 entries, a podium for the first three and a table for the rest, in the order and with the ranks returned by the Backend.
6. THE leaderboard page SHALL show the Handle, level and Leaderboard points of each entry and mark Guest entries.
7. WHILE the Http_Client is active, THE leaderboard page SHALL show no Ghost_Rival entry and no Ghost_Rival wording.
8. WHERE the Mock_Adapter or the Offline_Demo is active, THE leaderboard page SHALL label each Ghost_Rival "Ghost Rival - demo".
9. WHEN the response contains no entries, THE leaderboard page SHALL show "Be the first to enter" with a button to start playing.
10. WHILE the first response is pending, THE leaderboard page SHALL show loading skeletons.
11. IF the first request fails, THEN THE leaderboard page SHALL show an error state with a Retry button.
12. IF a later request fails, THEN THE leaderboard page SHALL keep the last entries and show that the data could not be refreshed.
13. WHILE both the Capability liveBoard and the legacy leaderboard Capability are off, THE leaderboard page SHALL show the "coming soon" state.

### Requirement 12: You panel

**User Story:** As a player, I want to see my live rank and what it takes to climb, so that I know my next goal.

#### Acceptance Criteria

1. WHEN the response contains a `me` block, THE You_Panel SHALL be pinned below the table and show the rank and the Leaderboard points from that block.
2. WHEN `me.next_above` is present, THE You_Panel SHALL show the points needed to pass that player, using the Handle and the `points_needed` value returned.
3. WHEN `me.rank` is 1, THE You_Panel SHALL show that the player leads and no pass line.
4. WHILE `me.top20.in_top20` is false, THE You_Panel SHALL show the points needed to enter the top 20 using the `points_needed` value returned.
5. WHILE `me.top20.in_top20` is true, THE You_Panel SHALL show no enter line.
6. WHEN `me.rank` is null or `me.reason` is `no_points_yet`, THE You_Panel SHALL show "Earn your first points to join the board".
7. WHILE the player is a Guest, THE You_Panel SHALL be shown and SHALL include the offer to create an account when the Capability accountUpgrade is on.
8. WHEN the response contains `me` null, THE You_Panel SHALL show "Pick a name and play to join" with a button to the Name_Screen.
9. THE You_Panel SHALL be labeled live and SHALL state that it can be ahead of the table.
10. THE You_Panel SHALL show only numbers returned by the Backend or the Mock_Adapter.

### Requirement 13: Freshness and polling

**User Story:** As a player, I want to know how fresh the board is without the app hammering the server, so that the page is honest and cheap.

#### Acceptance Criteria

1. THE leaderboard page SHALL show "Updated at <time>, refreshes hourly" with the time taken from `updated_at`.
2. THE leaderboard page SHALL show a countdown to `next_refresh_at` that updates every second from the local clock without a network call.
3. WHEN the countdown reaches zero, THE leaderboard page SHALL request the board once, subject to the minimum interval.
4. THE Frontend SHALL poll the leaderboard only while the leaderboard page is mounted and the tab is visible.
5. THE Frontend SHALL send no two requests for the same Board and Period less than 60 seconds apart, except the first request after the page mounts or the Board or Period changes.
6. WHEN the tab becomes visible and the last request for the selected Board and Period is older than 60 seconds, THE Frontend SHALL request the board once.
7. IF a request answers 429, THEN THE Frontend SHALL wait at least the `Retry-After` time before the next request.
8. WHEN the page unmounts, THE Frontend SHALL cancel its timers and ignore late responses.

### Requirement 14: Player counter

**User Story:** As a visitor, I want to see how many players have tried the game, so that the game feels alive.

#### Acceptance Criteria

1. WHEN the title screen loads, THE Frontend SHALL request `GET /stats/players` unless a cached value is still valid.
2. WHEN the response contains an integer `players` of 10 or more, THE title screen SHALL show one line "N explorers have braved the dungeon" with N formatted by `Intl.NumberFormat`.
3. WHEN the response contains an integer `players` from 1 to 9, THE title screen SHALL show the line "Be among the first explorers" without a number.
4. THE Frontend SHALL cache a successful response in memory for the `cache_seconds` value returned, and for 300 seconds when it is missing.
5. IF the request fails or `players` is missing, negative, not an integer or 0, THEN THE title screen SHALL render no counter line.
6. WHILE Reduced_Motion is off, THE title screen SHALL count up to N over at most 800 ms and end exactly at N.
7. WHILE Reduced_Motion is on, THE title screen SHALL show N at once.
8. THE Frontend SHALL show no number that it did not receive, with no minimum, offset or rounding.
9. THE Mock_Adapter SHALL return 0 players unless a development value is configured, and THE Offline_Demo SHALL show no counter.
10. THE counter line SHALL wrap without horizontal overflow at 360 px width.
11. THE counter line SHALL never delay the Try the Demo button or any other title screen control.
12. WHEN any secondary text shows an explorer count, THE Frontend SHALL use the singular "explorer" exactly when the count is 1 and the plural "explorers" otherwise.

### Requirement 15: Upload path for guests

**User Story:** As a guest, I want to upload my own notes within fair limits, so that I can play from my own material.

#### Acceptance Criteria

1. WHERE the Capability guestUpload is on, THE upload page SHALL show the wizard to a Guest.
2. WHILE the Capability guestUpload is off or the Quota request has failed for a Guest, THE upload page SHALL show the existing "Create an account to upload your own notes" gate to a Guest.
3. WHILE the Capability uploadQuota is not off, THE upload page SHALL request `GET /uploads/quota` before the drop zone and show the allowed state with the remaining count or the blocked reason.
4. WHEN the Quota says `can_upload` is false, THE upload page SHALL disable the drop zone and show the button "Play preloaded dungeons instead".
5. IF an upload or a dungeon generation answers AI_BUSY or UPLOADS_PAUSED_TODAY, THEN THE wizard SHALL show "The summoning circle is busy" and the button "Play preloaded dungeons instead".
6. IF an upload answers UPLOAD_LIMIT_PLAYER or UPLOAD_LIMIT_IP, THEN THE wizard SHALL show the limit message with the wait time from `Retry-After` and the button "Play preloaded dungeons instead".
7. IF an upload answers QUOTA_EXCEEDED, THEN THE wizard SHALL show that the stored notes limit is reached.
8. WHILE floors of an uploaded dungeon are generating, THE wizard SHALL list each floor with its status.
9. WHEN the document status has `counts_for_ranking` false, THE wizard SHALL show the ranking note returned or the default note.
10. WHEN a Guest reaches a Quota limit and the Capability accountUpgrade is on, THE wizard SHALL offer to create an account.
11. WHEN the player activates "Play preloaded dungeons instead", THE Frontend SHALL open the preloaded dungeon resolved as in Requirement 5.

### Requirement 16: AI notice and file rules

**User Story:** As a player, I want to know where my notes go and what files are accepted, so that I can decide before I upload.

#### Acceptance Criteria

1. THE wizard SHALL show the AI_Notice and a confirmation checkbox before the drop zone accepts a file.
2. WHILE the AI_Notice checkbox is not ticked, THE wizard SHALL keep the drop zone disabled.
3. WHEN a file is uploaded, THE Frontend SHALL send the form field `accept_ai_notice` with the value true.
4. THE AI_Notice text SHALL make no promise about retention, deletion or training at an AI provider.
5. IF the Backend answers 422 AI_NOTICE_NOT_ACCEPTED, THEN THE wizard SHALL ask the player to tick the checkbox.
6. IF the Backend answers TOO_MANY_PAGES, TOO_MANY_SLIDES or TOO_MUCH_TEXT, THEN THE wizard SHALL show a message that contains the `limit` and `found` values returned.
7. THE wizard SHALL state the file rules as accepted formats, 15 MB, 30 pages for a PDF, 30 slides for a PPTX, 60,000 characters for a DOCX and at least 500 characters of text, with every value and the sentence built from the Upload_Limits module.
8. THE Frontend SHALL treat browser file checks as hints and show the Backend answer when the two differ.
9. THE Frontend SHALL define every upload limit (accepted formats, 15 MB, 30 PDF pages, 30 PPTX slides, 60,000 DOCX characters, 500 minimum characters and the stored document limits shown as hints) in the single Upload_Limits module and build all UI text about the rules from those constants.

### Requirement 17: Layout, accessibility and touch

**User Story:** As a player on any device, I want the new screens to fit and be usable, so that I can play on a phone, a tablet or a desktop.

#### Acceptance Criteria

1. THE Name_Screen, Path_Choice, pack page, unlock screens and leaderboard page SHALL show no page scrollbar at 1366x650 and 1920x1080.
2. WHILE Touch_Mode is on and the viewport is narrower than 640 px or shorter than 520 px, THE new screens SHALL allow natural page scrolling.
3. WHILE Touch_Mode is on, THE new controls SHALL have a touch target of at least 44 px.
4. THE Frontend SHALL leave `src/touch`, `styles/touch.css`, the PauseButton and the `html[data-touch]` setting unchanged in behavior.
5. THE Frontend SHALL be checked at 360x740, 768x1024, 1366x650 and 1920x1080 in each phase.
6. THE Frontend SHALL give each new control an accessible name, announce state changes through a polite live region and expose errors with role alert.
7. WHILE Reduced_Motion is on, THE Frontend SHALL replace the count-up, the podium entrance and the celebration animations with instant changes.
8. THE Frontend SHALL meet WCAG AA contrast for new text and controls.

### Requirement 18: Authority and boundaries

**User Story:** As a developer, I want the authority and boundary rules enforced by tests, so that real mode never uses local rules.

#### Acceptance Criteria

1. WHEN the Http_Client is active, THE Frontend SHALL compute no points, rank, points to the next rank, pack unlock, quota or player count locally.
2. THE Phaser_Layer SHALL import nothing from `src/api`, `src/demo`, `src/state`, `src/offline` or any of the new modules `src/identity`, `src/packs`, `src/points`, `src/board` and `src/counter`.
3. THE Event_Bridge SHALL stay unchanged.
4. THE Frontend SHALL record every new Backend need in `docs/handoff/B-to-A.md` as a PROPOSED_Item before building it against the Mock_Adapter.
5. THE Http_Client SHALL validate each new real response with a wire zod schema and throw a ContractError that names the endpoint and the failing field.
6. THE contract suite SHALL run every new case against the Mock_Adapter and against the real API when `VITE_API_BASE` is set and mocks are off, and skip a case when its Capability is off.
7. THE boundary tests SHALL assert that real mode loads no mock module and shows no Ghost_Rival.
8. THE boundary tests SHALL assert that no screen renders the `username` of a Guest.

### Requirement 19: Verification and process

**User Story:** As a maintainer, I want each phase verified and documented, so that the work is reviewable.

#### Acceptance Criteria

1. WHEN a phase finishes, THE Frontend SHALL pass typecheck, lint, the full test suite, `npm run test:contract` and the production build, and the real output SHALL be reported.
2. THE Frontend SHALL keep all 1142 passing tests passing and the contract baseline of 31 passed and 1 skipped.
3. WHEN a phase finishes, THE maintainer task SHALL update `docs/handoff/B-to-A.md` and `docs/kiro-log-frontend.md`.
4. WHEN a phase checkpoint is reached, THE agent SHALL stop, summarize, explain how to view and check the phase, wait for approval and then commit that phase separately.
5. THE property tests SHALL use fast-check with at least 100 runs and the tag `Feature: frontend-10-live-players, Property N: <title>`.
6. THE Frontend work SHALL edit only `frontend/**`, frontend specs and hooks, `docs/handoff/B-to-A.md` and `docs/kiro-log-frontend.md`, and never `backend/`.

### Requirement 20: First-run path and non-blocking tutorial

**User Story:** As a new visitor, I want to reach my first fight in three clicks without a forced tutorial, so that I start playing right away.

#### Acceptance Criteria

1. WHEN the title screen loads for a first visit, THE Frontend SHALL NOT open the intro story or the tutorial automatically.
2. THE Frontend SHALL keep the full tutorial available from the Demo_Pill and make it skippable with one action.
3. WHILE the tutorial is open, THE Frontend SHALL NOT prevent the player from leaving it to continue to the Name_Screen or to play.
4. WHEN the first room of a floor run opens, THE Frontend SHALL show the existing ControlsHint and ControlsLegend as the in-room tutorial, with the touch legend in Touch_Mode.
5. THE Frontend SHALL keep the flags `sd.introSeen` and `sd.tutorialSeen` as UI-only values that never gate the Name_Screen, the Path_Choice or a run.
6. WHEN the player takes exactly three clicks from the title screen (Try the Demo, Accept and continue, the preloaded card), THE Frontend SHALL reach a running floor in which the first monster can be engaged with the E key or the Engage touch button, with no other click, in mock mode and in real mode.
