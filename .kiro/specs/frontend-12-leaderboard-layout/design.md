# Design Document

## Overview

The leaderboard redesign is already implemented in the working tree. This design describes the existing structure and the verification flow. No new components are introduced.

## Architecture

- `frontend/src/board/boardView.ts` builds the view model. It now exposes `all`, the full ordered entry list, alongside the top-three list.
- `frontend/src/board/LiveBoard.tsx` renders two columns: the Podium_Card (left) and the Standings_Card (right).
- `frontend/src/styles/leaderboard.css` holds the "Live board layout" block with the `sd-lb__*` and `sd-podium` classes.
- `frontend/scripts/layout-check.mjs` drives headless Edge/Chrome and reports clipping and overlap.

## Components and Interfaces

```typescript
const STAGE_ORDER: Record<number, readonly number[]> = { 1: [0], 2: [1, 0], 3: [1, 0, 2] }
// Podium: <ol data-count={min(3, n)}> renders places in STAGE_ORDER[count]
// Table:  <table aria-label="Rankings" data-many={all.length > 10 ? 'true' : undefined}
//          style={{'--lb-half': ...}}>
```

- The Badges column renders only when some entry has badges.
- Two-column split uses `--lb-half` (10 for 20 entries) when `data-many` is set.

## Known layout fixes under verification

- `.sd-lb__podiumcard { overflow: visible }` removes the 232>224 clip at 360x740.
- `.sd-lb__standings .sd-lb__thead { position: static; width: auto; height: auto; overflow: visible; clip: auto }` removes the thead 19>1 clip caused by a visually-hidden style on the header.

## Data Models

No data model changes. `BoardEntry` is unchanged.

## Error Handling

An empty board renders no Podium_Card places and an empty-state message in the Standings_Card. Layout defects are fixed in CSS first and in TSX only when markup must change.

## Testing Strategy

- Existing unit tests in `board.test.ts` and `LeaderboardLayout.test.tsx` cover podium order, `all`, `data-many` and row counts.
- Layout_Check runs at 1366x768 and 360x740 with fixtures for 1, 3, 8 and 20 entries, with screenshots reviewed visually.
- Frontend_Checks run with the `VITE_*` environment overrides cleared.
- Property-based tests are not applicable: the work is CSS layout and rendering, so example-based and screenshot checks are used.
