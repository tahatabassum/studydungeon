# Requirements Document

## Introduction

The leaderboard page previously showed a small podium in the left column, and the right column displayed only "No one else has points on this board yet." The page is redesigned so that the left column holds a "Top 3" podium card and the right column holds a "Standings" card listing every entry. The redesign is implemented but uncommitted. This spec covers verifying the layout, keeping all checks green, and committing the result.

## Glossary

- **Leaderboard_Page**: The frontend route `/leaderboard`, rendered by `LiveBoard.tsx`.
- **Podium_Card**: The left-column "Top 3" card showing only the places that exist.
- **Standings_Card**: The right-column card containing the Rankings table of all entries.
- **Rankings_Table**: The table inside the Standings_Card with headings Rank, Player, Level, Points, Rooms.
- **Layout_Check**: The command `node scripts/layout-check.mjs` run from `frontend/`, which reports clipping and overlap.
- **Frontend_Checks**: The commands `npm run typecheck`, `npm run lint` and `npm test` run in `frontend/`.

## Requirements

### Requirement 1: Podium

**User Story:** As a student, I want to see the top three players on a clear podium, so that I can see who leads.

#### Acceptance Criteria

1. WHEN the board has 1, 2 or 3 entries, THE Podium_Card SHALL display exactly that many places and no empty places.
2. WHEN the board has 3 entries, THE Podium_Card SHALL order the places 2nd, 1st, 3rd.
3. THE Podium_Card SHALL display the heading "Top 3".

### Requirement 2: Standings

**User Story:** As a student, I want to see every player's standing, so that I can find my own rank.

#### Acceptance Criteria

1. THE Standings_Card SHALL list every board entry in the Rankings_Table.
2. THE Rankings_Table SHALL display the visible headings Rank, Player, Level, Points and Rooms.
3. WHERE at least one entry has badges, THE Rankings_Table SHALL display a Badges column.
4. WHEN the board has more than 10 entries, THE Rankings_Table SHALL split the rows into two columns.

### Requirement 3: Layout

**User Story:** As a student, I want the page to render cleanly on desktop and phone, so that nothing is cut off or overlapping.

#### Acceptance Criteria

1. WHEN the Layout_Check runs at 1366x768, THE Leaderboard_Page SHALL produce zero clipping and zero overlap findings.
2. WHEN the Layout_Check runs at 360x740, THE Leaderboard_Page SHALL produce zero clipping and zero overlap findings.
3. WHEN the board has 1, 3, 8 or 20 entries, THE Leaderboard_Page SHALL render without clipping or overlap at both sizes.

### Requirement 4: Checks

**User Story:** As a maintainer, I want existing checks to stay green, so that the redesign introduces no regressions.

#### Acceptance Criteria

1. WHEN the Frontend_Checks run, THE Leaderboard_Page code SHALL pass typecheck, lint and all existing tests.

### Requirement 5: Commit

**User Story:** As a maintainer, I want the change committed and pushed cleanly, so that the branch contains only intended files.

#### Acceptance Criteria

1. WHEN the commit is created, THE commit SHALL include only the named changed frontend files and the spec folder.
2. WHEN the commit is created, THE commit SHALL use the message "style(leaderboard): Top 3 card + full Standings table".
3. WHEN the commit is created, THE commit SHALL exclude `backend/.env` and local.db files.
4. WHEN the commit is created, THE commit SHALL be pushed to origin on branch `feature/frontend-live-players`.
