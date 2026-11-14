# Implementation Plan: frontend-11-layout-fixes

## Overview

Presentation-only layout fix pass for the Fit_Screens on branch `feature/frontend-live-players`. Step 0 (documents and audit) is done. Then: the shared fit shell with the Layout_Check, the Upload screen, the Leaderboard screen, and one audit-and-fix task for each remaining fit screen. Every screen ends with a STOP task: say which URL and window sizes to check, wait for approval, then commit that screen separately. Never push.

Rules for every task:

- Edit only `frontend/**`, `.kiro/specs/frontend-11-layout-fixes/**` and `docs/kiro-log-frontend.md`. Never touch `backend/`, `src/game`, `src/touch`, `styles/touch.css` or the Event_Bridge.
- Presentation only. Do not change data fetching, polling, rank logic, upload logic (file validation, quota handling, notice acceptance, status polling), API calls, zod schemas, the mock or real adapters, or the contract tests.
- Fix causes (RC ids in design.md). Do not hide scrollbars with `overflow: hidden`.
- Real mode shows real players only; Ghost_Rivals stay in mock mode.
- Do not weaken the AI notice or its required checkbox; the whole text stays visible.
- Keep all tests passing. A test may change only where it asserts a copy string this spec renames (design.md Q3).
- Do not add Playwright or any dependency (design.md Q2) unless the user approves.
- Each screen task ends with: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:contract`, `npm run build` in `frontend/` (real output recorded), the Layout_Check for that route at all Test_Sizes, and the manual checklist from design.md.
- Each screen task appends a short dated entry to `docs/kiro-log-frontend.md`.
- Paths are relative to `frontend/` unless they start with `docs/` or `.kiro/`.
- Sub-tasks marked `*` are optional tests. Property-based tests do not apply (design.md, Testing Strategy).

## Tasks

- [x] 1. Step 0: audit and plan (documents only)
  - [x] 1.1 Write requirements.md, design.md and tasks.md with the root cause findings RC1 to RC36 and the open questions Q1 to Q10
    - _Requirements: 13.1_
  - [x] 1.2 Append the dated Step 0 entry to `docs/kiro-log-frontend.md`
    - _Requirements: 13.1_

- [x] 2. STOP: Step 0 checkpoint
  - Report the root causes (file, selector, effect), the contradictions and open questions Q1 to Q10 (especially Q1 auto-start, Q2 Layout_Check tooling, Q6 container width). Wait for the user's answers. Nothing is committed for Step 0 unless the user asks.

- [x] 3. Shared fit shell and Layout_Check
  - [x] 3.1 Write the Layout_Check script `scripts/layout-check.mjs` (per Q2 answer)
    - Option A: Node 24 script, Edge headless over CDP, temp `--user-data-dir`, Test_Sizes and all Fit_Screen routes, mock mode, guest and registered, output table, exit code 1 on failure, allow-list of Designated_Scrollers, optional screenshots to a temp folder. Add one `layout:check` entry to `package.json` `scripts` only (no dependency).
    - First run it on the unchanged code and save the "before" table in the log entry (confirms the "verify" items of the audit).
    - _Requirements: 12.1, 12.2, 12.3_
  - [x] 3.2 Rewrite the fit shell CSS and `PageShell` (RC1, RC2, RC3, RC4, RC5, RC6, RC7, RC8)
    - `styles/pages.css`: tokens `--sd-fit-width`, `--sd-fit-pad`, grid rows, `.sd-page__body` without overflow, `.sd-scroll`, moon position, Compact_Mode release for every Fit_Screen.
    - `styles/haunted.css`: scope centring to `.sd-fit--center`; replace the three width rules (RC5) by one; in-flow header row.
    - `styles/live.css`: remove the `sd-live`-only release rule (moved to the shell).
    - `components/PageShell.tsx`: optional `center` prop; `wide` kept and ignored on fit. Add `sd-fit--center` to login, register, choose, play-as-guest and settings.
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7, 1.8, 2.1, 2.2, 2.4_
  - [ ]* 3.3 Write component tests for `PageShell`
    - fit variant adds `sd-page--fit`; `center` adds `sd-fit--center`; back link renders once; body exists.
    - _Requirements: 1.5, 2.4_

- [ ] 4. Upload screen (Part B)
  - [x] 4.1 Regroup the upload markup and write the grid CSS (RC10, RC11, RC12, RC13, RC18)
    - `upload/UploadPage.tsx`, `upload/UploadWizard.tsx`, `styles/upload.css`: header row, `StepList`, `.sd-up__grid` with `.sd-up__aside` (about 40 percent) and `.sd-up__main` (about 60 percent); remove `overflow`, `max-width: 42rem`, `margin-block: auto` from cards; `intro` stays a prop and renders in the aside; Compact_Mode order: quota, notice, drop zone, rules, stepper strip.
    - _Requirements: 7.1, 7.5, 8.1, 9.1, 10.6, 2.2_
  - [ ] 4.2 Slim stepper (RC15)
    - `upload/StepList.tsx`, `styles/upload.css`: one row, mark and label inline, state text `sr-only`, active step shows progress, icon shape for each state, compact strip in Compact_Mode.
    - _Requirements: 7.2, 7.3, 7.4_
  - [ ] 4.3 Quota chip, AI notice and file rules (RC16, RC17)
    - `upload/QuotaPanel.tsx`: inline chip, same text from `quotaView`. `upload/AiNotice.tsx`: shortened text with the same meaning, label "I understand and want to continue", styled checkbox (20 px box, focus ring, clickable label). New `upload/FileRules.tsx` built from `limits.ts` (no number literals), shown in the aside. Update the tests that assert the old label and text.
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_
  - [ ] 4.4 Drop zone locked, active and disabled states (RC11, RC14)
    - `upload/Dropzone.tsx`, `styles/upload.css`: icon, "Drop your notes here", "or", "Choose a file", one-line hint, locked state with the message centred inside, `aria-disabled`, quota-used-up state with "Play preloaded dungeons instead", fills the right column.
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  - [ ] 4.5 Upload states inside the grid (RC10, RC12)
    - `upload/UploadWizard.tsx`, `upload/SummonResult.tsx`, `upload/FloorProgressList.tsx`, `styles/upload.css`: chosen file (name, size) while uploading and processing, rejected with reason and "Try another file", busy message with fallback, topics, success with the map link; floors as a responsive grid; no `overflow` on cards. Keep auto-start (Q1 unless the user decides otherwise).
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_
  - [ ]* 4.6 Write component tests for the upload layout
    - FileRules text from limits, notice label click toggles the box, locked message, five steps with `aria-current`, guest and registered render the same grid, plural quota chip.
    - _Requirements: 8.3, 8.5, 9.3, 7.2, 10.5_
  - [ ] 4.7 Verify the upload screen
    - Typecheck, lint, test, test:contract, build; Layout_Check `/upload` (guest, registered, quota used up, busy, rejected, success) at all Test_Sizes plus phone portrait and landscape; manual checklist; append the log entry.
    - _Requirements: 12.1, 12.2, 12.4, 12.5, 7.3, 2.3_

- [ ] 5. STOP: Upload screen checkpoint
  - Give the URL (`/upload`, mock mode, guest and registered; `?mockQuota=<reason>` and `?mockAiBusy=1` for the other states) and the window sizes (1366x650, 1366x768, 1920x1080, 2560x1440, 1099x700, phone portrait and landscape). Wait for approval, then commit this screen separately. Do not push.

- [ ] 6. Leaderboard screen (Part A)
  - [x] 6.1 Header row, toolbar and caption (RC9, RC22)
    - `leaderboard/LeaderboardPage.tsx`, `board/BoardTabs.tsx`, `styles/leaderboard.css`: back link, title and subtitle left; tabs and period toggle in one row at the right; single Dashboard link; one caption line that changes with selection, reset time from `data.week` for "This week", tooltip when tight; keep `data-testid="lb-hint"` and the tab roles and keyboard handling.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
  - [ ] 6.2 Board grid, compact podium and rank rows (RC19, RC20, RC21, RC24, RC25, RC27)
    - `board/LiveBoard.tsx`, `leaderboard/Podium.tsx`, `styles/leaderboard.css`: `.sd-lb__grid` left Podium and You panel, right Rank_Rows with `--sd-row-h` between 36 and 44 px via `clamp()`; two columns (ranks 4 to 12 and 13 to 20) when 17 rows do not fit; no `overflow`, no minimum heights, no hidden information; truncate names with an ellipsis and `title`; Compact_Mode single column.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 1.2_
  - [ ] 6.3 Your live rank panel and plurals (RC23)
    - `board/YouPanelView.tsx`, `styles/leaderboard.css`: label "Your live rank", note "Updates instantly. The table refreshes hourly.", rank, points, pass line, enter line, updated-at and next refresh, guest "Create account" CTA, not-on-board message; use the existing `plural()` for "1 point"; no change to `youPanelView` logic. Update tests that assert the old label.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  - [ ] 6.4 Loading, empty, error and legacy board (RC26, RC28)
    - `board/LiveBoard.tsx`, `leaderboard/LeaderboardPage.tsx`, `styles/leaderboard.css`: skeleton in the grid shape without inline pixel heights, error card with Retry, "Be the first to enter" for 0 entries, 1 and 3 entries, reduced-motion skeleton, legacy board uses the same toolbar, grid and compact rows.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - [ ]* 6.5 Write component tests for the leaderboard layout
    - "Your live rank" label and note, "1 point" and "2 points", one Dashboard link, truncated long name has `title`, 0 / 1 / 3 / 8 / 20 entries render without error, ranks 4 to 12 and 13 to 20 split, skeleton has no inline height style.
    - _Requirements: 3.3, 4.4, 4.5, 5.1, 5.5, 6.1_
  - [ ] 6.6 Verify the leaderboard screen
    - Typecheck, lint, test, test:contract, build; Layout_Check `/leaderboard` with 0, 1, 3, 8 and 20 entries, guest and registered, all board and period combinations, loading and error, at all Test_Sizes plus phones and 1100x560; manual checklist (focus order, reduced motion, AA contrast); append the log entry.
    - _Requirements: 12.1, 12.2, 12.4, 12.5, 4.2, 6.6_

- [ ] 7. STOP: Leaderboard screen checkpoint
  - Give the URL (`/leaderboard`, `?board=overall&period=week`, mock mode with 0, 1, 3, 8, 20 entries) and the window sizes. Wait for approval, then commit this screen separately. Do not push.

- [ ] 8. Title screen audit and fix (RC29)
  - [x] 8.1 Measure and fix `/`
    - `styles/landing.css`, `pages/LandingPage.tsx` markup only: Layout_Check at all Test_Sizes; remove any Nested_Scrollbar except `.sd-landing__main` below 1100x560; keep the player counter zero-height box; shared padding token.
    - _Requirements: 11.1, 11.2, 1.1_
  - [ ] 8.2 Verify the title screen
    - Full verification commands, Layout_Check, manual checklist, log entry.
    - _Requirements: 12.1, 12.2, 12.4, 12.5_

- [ ] 9. STOP: Title screen checkpoint
  - URL `/`, sizes as above. Wait for approval, then commit separately.

- [ ] 10. Floor map audit and fix (RC30, RC31, RC32, RC33)
  - [ ] 10.1 Measure and fix `/campaign/:id`
    - `styles/campaign.css` and floor card markup only: horizontal map scroller allow-listed; floor cards not clipped at 1366x650; popover and ellipsis per Q7; the `max-height: 480px` page scroll replaced by the shared Compact_Mode release. No change to the map data, node order or Event_Bridge.
    - _Requirements: 11.1, 11.2, 11.3_
  - [ ] 10.2 Verify the floor map
    - Full verification commands, Layout_Check (preloaded and generated dungeon), manual checklist, log entry.
    - _Requirements: 12.1, 12.2, 12.4, 12.5_

- [ ] 11. STOP: Floor map checkpoint
  - URL `/campaign/<id>` from the dashboard, sizes as above. Wait for approval, then commit separately.

- [ ] 12. Login and register audit and fix (RC34)
  - [ ] 12.1 Measure and fix `/login` and `/register`
    - `styles/auth.css`, `styles/haunted.css`, `auth/*` markup only: vertical centring through the grid, card height at 1366x650 with an error line, shared width token, no `overflow`.
    - _Requirements: 11.1, 11.2_
  - [ ] 12.2 Verify login and register
    - Full verification commands, Layout_Check for both routes, manual checklist, log entry.
    - _Requirements: 12.1, 12.2, 12.4, 12.5_

- [ ] 13. STOP: Login and register checkpoint
  - URLs `/login` and `/register`, sizes as above. Wait for approval, then commit separately.

- [ ] 14. Choose, play-as-guest and settings audit and fix (RC5, RC35, RC36)
  - [ ] 14.1 Measure and fix `/choose`
    - `styles/live.css`, `styles/haunted.css`, `identity/PathChoice.tsx` markup only: cards grow with content, shared width, quota line and error row inside the area.
    - _Requirements: 11.1, 11.2_
  - [ ] 14.2 Measure and fix `/play-as-guest`
    - `styles/live.css`, `identity/NameScreen.tsx` markup only: form card at the shared form width, hint and notice fully visible.
    - _Requirements: 11.1, 11.2_
  - [ ] 14.3 Measure and fix `/settings`
    - `pages/SettingsPage.tsx` markup and `styles/live.css`: cards side by side in Desktop_Mode, one column in Compact_Mode, no use of `.sd-live__notice` as a layout class.
    - _Requirements: 11.1, 11.2_
  - [ ] 14.4 Verify the three screens
    - Full verification commands, Layout_Check for the three routes, manual checklist, log entry.
    - _Requirements: 12.1, 12.2, 12.4, 12.5_

- [ ] 15. STOP: Choose, play-as-guest and settings checkpoint
  - URLs `/choose`, `/play-as-guest`, `/settings`, sizes as above. Wait for approval, then commit separately.

- [ ] 16. Final regression
  - [ ] 16.1 Run the Layout_Check for every Fit_Screen route at all Test_Sizes and the Dashboard for regressions
    - Record the final table in `docs/kiro-log-frontend.md` with the full verification command output.
    - _Requirements: 12.1, 12.2, 12.4, 13.1_

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster pass.
- Every task references the requirements it satisfies and the RC ids it fixes (design.md).
- The Layout_Check is the main safety net; jsdom tests cannot measure layout.
- Each STOP is a hard stop: no next screen starts before approval and a separate commit.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["3.1"] },
    { "id": 1, "tasks": ["3.2"] },
    { "id": 2, "tasks": ["3.3"] },
    { "id": 3, "tasks": ["4.1"] },
    { "id": 4, "tasks": ["4.2"] },
    { "id": 5, "tasks": ["4.3"] },
    { "id": 6, "tasks": ["4.4"] },
    { "id": 7, "tasks": ["4.5"] },
    { "id": 8, "tasks": ["4.6"] },
    { "id": 9, "tasks": ["4.7"] },
    { "id": 10, "tasks": ["6.1"] },
    { "id": 11, "tasks": ["6.2"] },
    { "id": 12, "tasks": ["6.3"] },
    { "id": 13, "tasks": ["6.4"] },
    { "id": 14, "tasks": ["6.5"] },
    { "id": 15, "tasks": ["6.6"] },
    { "id": 16, "tasks": ["8.1"] },
    { "id": 17, "tasks": ["8.2"] },
    { "id": 18, "tasks": ["10.1"] },
    { "id": 19, "tasks": ["10.2"] },
    { "id": 20, "tasks": ["12.1"] },
    { "id": 21, "tasks": ["12.2"] },
    { "id": 22, "tasks": ["14.1"] },
    { "id": 23, "tasks": ["14.2"] },
    { "id": 24, "tasks": ["14.3"] },
    { "id": 25, "tasks": ["14.4"] },
    { "id": 26, "tasks": ["16.1"] }
  ]
}
```
