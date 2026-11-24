# Implementation Plan: Leaderboard Layout

## Overview

Verify the already-implemented leaderboard redesign, fix any remaining layout defects, run all frontend checks, then commit and push.

## Tasks

- [x] 1. Verify and fix the leaderboard layout
  - [x] 1.1 Kill leftover headless browsers
    - From `frontend/`, stop msedge/chrome processes whose command line contains `remote-debugging-port`
    - _Requirements: 3.1, 3.2_
  - [x] 1.2 Run the layout check
    - Run `node scripts/layout-check.mjs --routes "/leaderboard" --sizes "1366x768,360x740" --screenshots "C:\Users\User\AppData\Local\Temp\sd-lbs"`
    - Redirect output to a file with `Out-File -Encoding utf8` and read the file back
    - _Requirements: 3.1, 3.2_
  - [x] 1.3 Review screenshots
    - View leaderboard_one, leaderboard_three, leaderboard_eight and leaderboard_twenty at both sizes
    - _Requirements: 3.3, 1.1, 2.4_
  - [x] 1.4 Fix defects and rerun
    - Fix clipping, overlap or visual problems in `leaderboard.css` or `LiveBoard.tsx`
    - Rerun 1.1 to 1.3 until the check reports no findings
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 2. Run the full frontend checks
  - [x] 2.1 Clear environment overrides
    - In PowerShell run `Remove-Item Env:VITE_CONTRACT_LIVE,Env:VITE_API_BASE,Env:VITE_USE_MOCKS,Env:VITE_CONTRACT_UPLOADS -ErrorAction SilentlyContinue`
    - _Requirements: 4.1_
  - [x] 2.2 Run typecheck, lint and tests
    - In `frontend/` run `npm run typecheck`, `npm run lint`, `npm test`
    - Fix any failures and rerun until all pass
    - _Requirements: 4.1_

- [x] 3. Commit and push
  - [x] 3.1 Stage specific files
    - Stage by name: `frontend/src/board/LiveBoard.tsx`, `frontend/src/board/boardView.ts`, `frontend/src/styles/leaderboard.css`, `frontend/src/board/board.test.ts`, `frontend/src/board/LeaderboardLayout.test.tsx`, and `.kiro/specs/frontend-12-leaderboard-layout/`
    - Do not use `git add -A`; do not stage `backend/.env` or local.db files
    - _Requirements: 5.1, 5.3_
  - [x] 3.2 Commit and push
    - Commit with message "style(leaderboard): Top 3 card + full Standings table"
    - Push to origin `feature/frontend-live-players`
    - _Requirements: 5.2, 5.4_

## Notes

- All tasks are required; no optional test tasks.
- Task 1 may modify files that task 3 stages; stage any additional leaderboard files changed by fixes.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["1.4"] },
    { "id": 4, "tasks": ["2.1"] },
    { "id": 5, "tasks": ["2.2"] },
    { "id": 6, "tasks": ["3.1"] },
    { "id": 7, "tasks": ["3.2"] }
  ]
}
```
