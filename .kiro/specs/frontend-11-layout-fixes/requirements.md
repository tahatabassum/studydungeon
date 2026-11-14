# Requirements Document

## Introduction

The fit screens of the Frontend (title, floor map, login, register, upload, leaderboard, choose, play-as-guest, settings) still show nested scrollbars inside cards, clipped text, text over borders, a page-level scrollbar and different content widths, even at full desktop size. Step 0 audited the shared PageShell fit variant and each screen; the causes are recorded in design.md ("Root cause findings"). This feature is a presentation-only fix pass in this order: the shared fit shell, the Upload screen (Part B), the Leaderboard screen (Part A), then an audit and fix of the remaining fit screens. Each screen ends with a STOP and its own commit.

HARD RULES: presentation only. No change to data fetching, polling rules, rank logic, upload logic (file validation, quota handling, notice acceptance, status polling), API calls, zod schemas, mock or real adapters, contract tests, the Event_Bridge or `backend/`. All existing tests keep passing (a test may change only where it asserts a copy string that this spec renames). Real mode shows real players only; Ghost_Rivals stay in mock mode. The third-party-AI privacy notice and its required checkbox are not weakened: the wording may be shortened with the same meaning, and the whole text is always visible.

## Glossary

- **Frontend**: The React 19, TypeScript, Vite, Tailwind 4 client in `frontend/`.
- **Fit_Screen**: A screen rendered with `PageShell variant="fit"`: title (`/`), floor map (`/campaign/:id`), `/login`, `/register`, `/upload`, `/leaderboard`, `/choose`, `/play-as-guest`, `/settings`. The Dashboard is not a Fit_Screen and keeps normal page scroll.
- **Fit_Shell**: `PageShell` in fit variant, its CSS in `styles/pages.css`, `styles/haunted.css` and `styles/live.css`.
- **Desktop_Mode**: A viewport at least 1100 px wide that is not a touch device (`html[data-touch]` absent and not `pointer: coarse`).
- **Compact_Mode**: Any other viewport (phones, tablets, narrow windows, touch devices).
- **Nested_Scrollbar**: A scrollbar on an element that is not the page and not the single Designated_Scroller of the screen.
- **Designated_Scroller**: The one element per screen that may scroll, only where a list genuinely needs it in a viewport below about 1100 by 560 px.
- **Container_Width**: The shared content width of all Fit_Screens, set by one CSS custom property.
- **Board_Header_Row**: The leaderboard row with back link, title and subtitle on the left and the board tabs and period toggle on the right.
- **Board_Grid**: The two-column leaderboard area under the caption: left column Podium plus You_Panel, right column ranks 4 to 20.
- **Podium**: The compact top-3 display.
- **You_Panel**: The pinned panel with the live rank of the current player, labelled "Your live rank".
- **Rank_Rows**: Ranks 4 to 20 in compact rows between 36 and 44 px high.
- **Upload_Grid**: The two-column upload area under the stepper: left column about 40 percent, right column about 60 percent.
- **Quota_Chip**: The one-line inline quota display (icon plus text such as "1 upload left today (0 of 1 used)").
- **AI_Notice**: The "Before you upload" privacy notice with its required checkbox.
- **File_Rules_List**: The compact list of formats and limits built from `src/upload/limits.ts`.
- **Drop_Zone**: The upload target that fills the right column.
- **Stepper**: The slim horizontal step strip (Upload, Read, Check relevance, Detect topics, Summon floors).
- **Layout_Check**: The automated browser check described in design.md that measures overflow on every Fit_Screen at fixed window sizes.
- **Test_Sizes**: 1366x650, 1366x768, 1536x864, 1920x960, 1920x1080 and 2560x1440 (Desktop_Mode), plus phone portrait (360x740) and phone landscape (740x360).
- **Limits_Module**: `src/upload/limits.ts`, the only place with upload limit numbers.

## Requirements

### Requirement 1: Shared fit shell without nested scrolling

**User Story:** As a player on a desktop window, I want every fit screen to size to its content inside the window, so that I never meet a scrollbar inside a card.

#### Acceptance Criteria

1. WHILE the viewport is in Desktop_Mode, THE Fit_Shell SHALL render each Fit_Screen so that the document `scrollHeight` is at most `innerHeight` and `scrollWidth` is at most `innerWidth` at every Test_Size.
2. THE Fit_Shell SHALL give every card, panel and notice a height that follows its content, with no `overflow` of `auto` or `scroll` on the element.
3. THE Fit_Shell SHALL provide at most one Designated_Scroller per Fit_Screen.
4. WHILE a Fit_Screen shows a Designated_Scroller, THE Fit_Shell SHALL show a scrollbar on that element only when its content is taller than its box.
5. THE Fit_Shell SHALL set one Container_Width and one side padding through CSS custom properties used by all Fit_Screens.
6. THE Fit_Shell SHALL keep flex and grid children shrinkable (`min-height: 0` or `min-width: 0`) where they share a row or column with content that can be larger than the space.
7. THE Fit_Shell SHALL keep focus rings and shadows of controls fully visible without clipping.
8. THE Fit_Shell SHALL position the decorative moon so that it does not overlap links, tabs, buttons or inputs.

### Requirement 2: Compact mode uses natural scrolling

**User Story:** As a player on a phone or tablet, I want one column and ordinary page scrolling, so that nothing scrolls inside something else.

#### Acceptance Criteria

1. WHILE the viewport is in Compact_Mode, THE Fit_Shell SHALL release the fixed 100dvh height so that the page grows with its content and the window scrolls.
2. WHILE the viewport is in Compact_Mode, THE Fit_Shell SHALL render every two-column layout as a single column.
3. WHILE the viewport is in Compact_Mode, THE Fit_Screen SHALL show no Nested_Scrollbar and no horizontal overflow at 360x740 and 740x360.
4. THE Fit_Shell SHALL apply the Compact_Mode rules to every Fit_Screen and not only to screens that carry the `sd-live` class.

### Requirement 3: Leaderboard header row and caption

**User Story:** As a player, I want the board selection and the period in one row with the title, so that the board gets the rest of the height.

#### Acceptance Criteria

1. WHILE the viewport is in Desktop_Mode, THE Leaderboard SHALL show the back link, the title "Leaderboard" and the subtitle at the left of Board_Header_Row.
2. WHILE the viewport is in Desktop_Mode, THE Leaderboard SHALL show the board tabs (Preloaded, Own notes, Overall) and the period toggle (All-time, This week) side by side at the right of the same row.
3. THE Leaderboard SHALL show exactly one link to the Dashboard.
4. THE Leaderboard SHALL show one caption line under Board_Header_Row that changes with the selected board and period.
5. WHEN the period "This week" is selected and the API sends the week reset time, THE Leaderboard SHALL show that reset time in the caption.
6. WHERE the caption does not fit on one line, THE Leaderboard SHALL give the full caption as a tooltip and as the accessible description.
7. THE Leaderboard SHALL keep the keyboard focus order: back link, board tabs, period toggle, Podium, You_Panel actions, Rank_Rows.

### Requirement 4: Leaderboard grid without scrolling

**User Story:** As a player on a desktop window, I want the top 20 and my own rank visible at once, so that I do not scroll to compare.

#### Acceptance Criteria

1. WHILE the viewport is in Desktop_Mode, THE Leaderboard SHALL render Board_Grid with the Podium and the You_Panel in the left column and Rank_Rows in the right column, filling the height under the caption.
2. WHILE the viewport is in Desktop_Mode, THE Leaderboard SHALL show no page scrollbar and no Nested_Scrollbar at every Test_Size with 0, 1, 3, 8 and 20 entries.
3. THE Rank_Rows SHALL have a height between 36 and 44 px set by `clamp()` from the available height.
4. IF the Rank_Rows of ranks 4 to 20 do not fit in one column at the available height, THEN THE Leaderboard SHALL split them into two side-by-side columns (ranks 4 to 12 and ranks 13 to 20) and SHALL NOT scroll.
5. WHEN a display name is longer than its cell, THE Leaderboard SHALL truncate it with an ellipsis and SHALL give the full name as a tooltip.
6. THE Leaderboard SHALL keep every Rank_Row, Podium slot and You_Panel line free of text that overlaps a border or another element.
7. WHILE the viewport is in Compact_Mode, THE Leaderboard SHALL show Board_Header_Row, caption, Podium, You_Panel and Rank_Rows in one column in this order, scrolling with the page.

### Requirement 5: Your live rank panel

**User Story:** As a player, I want my rank and what I need to climb in one pinned panel, so that I know where I stand without reading a table.

#### Acceptance Criteria

1. THE You_Panel SHALL be labelled "Your live rank" with the note "Updates instantly. The table refreshes hourly."
2. THE You_Panel SHALL show the rank, the points, the points needed to pass the next player and the points needed to enter the top 20 when the API sends them.
3. THE You_Panel SHALL show the time of the last table update and the time of the next refresh.
4. WHERE the current player is a guest, THE You_Panel SHALL show the "Create account" call to action.
5. THE Leaderboard SHALL write every count of points with the singular form for 1 ("1 point") and the plural form for any other number.
6. IF the current player is not on the board, THEN THE You_Panel SHALL show the existing "not on the board yet" message and its call to action inside the same panel.

### Requirement 6: Leaderboard states

**User Story:** As a player, I want loading, empty and error states in the same layout, so that the screen does not jump or clip.

#### Acceptance Criteria

1. WHILE the board loads, THE Leaderboard SHALL show a skeleton that has the same Board_Grid shape and no fixed pixel heights that exceed the available height.
2. IF the board fails to load, THEN THE Leaderboard SHALL show the error with a Retry button inside Board_Grid without a Nested_Scrollbar.
3. WHEN the board has 0 entries, THE Leaderboard SHALL show the "Be the first to enter" message inside Board_Grid.
4. WHEN the board has 1 or 3 entries, THE Leaderboard SHALL render the Podium for those entries and an empty-state line for the Rank_Rows.
5. WHILE reduced motion is on, THE Leaderboard SHALL show no animation, including the skeleton shimmer.
6. THE Leaderboard SHALL keep text contrast at WCAG 2.2 level AA.

### Requirement 7: Upload header and stepper

**User Story:** As a player, I want a clear header and a slim stepper, so that the form below gets the height.

#### Acceptance Criteria

1. WHILE the viewport is in Desktop_Mode, THE Upload_Page SHALL show the back link at the left and the title with the subtitle in one header row.
2. THE Upload_Page SHALL show the Stepper on one row with the five steps Upload, Read, Check relevance, Detect topics and Summon floors.
3. WHILE an upload is processing, THE Stepper SHALL highlight the active step and SHALL show its progress.
4. THE Stepper SHALL convey the state of each step by icon shape and text, not by colour alone.
5. WHILE the viewport is in Compact_Mode, THE Stepper SHALL be a compact strip placed after the Drop_Zone and the File_Rules_List.

### Requirement 8: Upload left column

**User Story:** As a player, I want the quota, the privacy notice and the file rules together, so that I know the terms before I pick a file.

#### Acceptance Criteria

1. THE Upload_Page SHALL show the Quota_Chip as one inline row with an icon and the existing quota text.
2. THE Upload_Page SHALL show the AI_Notice with its full text visible, never clipped and never scrolling inside the notice.
3. THE AI_Notice SHALL contain the checkbox labelled "I understand and want to continue" with a visible box of at least 20 px, a visible keyboard focus ring and a label that toggles the box when clicked.
4. THE AI_Notice text SHALL keep the meaning that the notes go to third-party AI providers (Google Gemini, with OpenRouter models as a fallback), that free tiers may keep or use the content under their own terms, and that personal or confidential information must not be uploaded.
5. THE Upload_Page SHALL show the File_Rules_List with the formats, the size limit, the page, slide and character limits, the minimum text length and the photo hint, all built from the Limits_Module.
6. THE Upload_Page SHALL contain no limit number outside the Limits_Module.

### Requirement 9: Upload right column

**User Story:** As a player, I want a large drop zone that makes clear whether it is locked, so that I know what to do next.

#### Acceptance Criteria

1. WHILE the viewport is in Desktop_Mode, THE Drop_Zone SHALL fill the full height of the right column of the Upload_Grid without a Nested_Scrollbar.
2. THE Drop_Zone SHALL show an icon, the text "Drop your notes here", the word "or", a "Choose a file" button and a one-line hint.
3. WHILE the AI_Notice is not ticked, THE Drop_Zone SHALL show a locked state with a message centred inside the zone that overlaps no other element.
4. WHEN the AI_Notice is ticked and the quota allows an upload, THE Drop_Zone SHALL become active.
5. WHILE the quota is used up, THE Drop_Zone SHALL be disabled and SHALL show the "Play preloaded dungeons instead" action.

### Requirement 10: Upload states inside the same layout

**User Story:** As a player, I want every upload state to fit the same layout, so that nothing is clipped while I wait.

#### Acceptance Criteria

1. WHILE a file is uploading or processing, THE Upload_Page SHALL show the file name and size and the active Stepper step inside the right column.
2. IF a file is rejected, THEN THE Upload_Page SHALL show the reason and a "Try another file" button inside the right column.
3. IF the summoning circle is busy, THEN THE Upload_Page SHALL show the busy message and the preloaded fallback inside the right column.
4. WHEN the upload succeeded, THE Upload_Page SHALL show the result and the link to the campaign map inside the right column.
5. THE Upload_Page SHALL render the guest and the registered variants in the same layout.
6. THE Upload_Page SHALL show no Nested_Scrollbar in any state at the Test_Sizes in Desktop_Mode.
7. THE Upload_Page SHALL keep the existing behaviour that a valid file starts uploading as soon as it is chosen (see design.md, open question Q1).

### Requirement 11: Remaining fit screens

**User Story:** As a player, I want the same consistent layout on all fit screens, so that the game looks like one product.

#### Acceptance Criteria

1. WHEN the audit of a Fit_Screen finds a Nested_Scrollbar, clipped text, text over a border or a width that differs from the Container_Width, THE Frontend SHALL fix the cause named in design.md and SHALL NOT hide the scrollbar.
2. THE title screen, floor map, login, register, choose, play-as-guest and settings screens SHALL meet Requirement 1 at every Test_Size in Desktop_Mode, with the floor map's horizontal map scroller as its one Designated_Scroller.
3. WHERE the floor map shortens text with an ellipsis or a line clamp, THE floor map SHALL give the full text as a tooltip and in the DOM.

### Requirement 12: Verification

**User Story:** As a maintainer, I want an automated layout check and a manual checklist, so that the fixes do not regress.

#### Acceptance Criteria

1. THE Layout_Check SHALL, for each Fit_Screen route and each Test_Size, assert `scrollHeight <= innerHeight` and `scrollWidth <= innerWidth` on the document.
2. THE Layout_Check SHALL assert for each Fit_Screen that no element other than an allow-listed Designated_Scroller has a computed `overflow` of `auto` or `scroll` with `scrollHeight > clientHeight` or `scrollWidth > clientWidth`.
3. THE Layout_Check SHALL run without adding a dependency to `frontend/package.json`, unless the user approves Playwright (design.md, open question Q2).
4. WHEN a screen is finished, THE Frontend SHALL pass `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:contract` and `npm run build` in `frontend/`.
5. THE Frontend SHALL provide a manual checklist for reduced motion, keyboard focus order and contrast for each finished screen.

### Requirement 13: Process and constraints

**User Story:** As the product owner, I want small reviewed steps, so that I can approve each screen on its own.

#### Acceptance Criteria

1. THE Frontend SHALL be changed only under `frontend/**`, `.kiro/specs/frontend-11-layout-fixes/**` and `docs/kiro-log-frontend.md`.
2. WHEN a screen is finished, THE agent SHALL stop, give the URL and the window sizes to check, wait for approval and then commit that screen separately without pushing.
3. THE agent SHALL stay on branch `feature/frontend-live-players`.
4. THE Frontend SHALL leave `src/game`, `src/touch`, `styles/touch.css`, the Event_Bridge and `backend/` unchanged.
