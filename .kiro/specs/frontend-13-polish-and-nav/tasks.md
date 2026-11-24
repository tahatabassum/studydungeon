# Implementation Plan: frontend-13-polish-and-nav

## Overview

Convert the design into incremental frontend-only changes: fix back-navigation after login, redesign the Dashboard, lightly refresh the other pages, verify with the layout check and the full test suite, then commit and push. All work is under `frontend/**` and this spec folder; nothing under `backend/**`, no `.env*`, no steering files, no API contract changes.

## Tasks

- [x] 1. Fix back-navigation after login
  - [x] 1.1 Add `RouteSkeleton` and `RequireVisitor` to `src/App.tsx`
    - Create `src/components/RouteSkeleton.tsx`: a minimal `aria-hidden="true"` placeholder with no interactive content.
    - Add `RequireVisitor({ children })` in `src/App.tsx`: render `RouteSkeleton` while `restoring` is true, `<Navigate to="/dashboard" replace />` when `user` is set, otherwise `children`.
    - Wrap the `/`, `/login` and `/register` routes with `RequireVisitor`.
    - _Requirements: 1.4, 1.5, 1.6, 1.9_
  - [x] 1.2 Switch navigation call sites to `replace: true`
    - `src/auth/AuthForm.tsx`: change `navigate('/dashboard')` to `navigate('/dashboard', { replace: true })`.
    - `src/state/useStartDemo.ts`: change the `onSuccess` navigate call to pass `{ replace: true }`.
    - `src/state/useLogout.ts`: change `navigate('/')` to `navigate('/', { replace: true })`.
    - _Requirements: 1.1, 1.2, 1.3, 1.7_
  - [x] 1.3 Add `useLeaveSession` and wire the Dashboard's exit link
    - Create `src/state/useLeaveSession.ts` per the design (calls `api.logout()` when a user exists, always clears session and navigates to `/` with `replace: true`).
    - In `src/pages/DashboardPage.tsx`, replace the `back: { to: '/', label: 'Title screen' }` prop with a `back` action that calls `useLeaveSession().leave()` (keep the same visual position/label, e.g. "Leave session").
    - _Requirements: 1.10_
  - [ ]* 1.4 Write property tests for the Entry_Guard
    - **Property 1: Authenticated users never see an Entry_Route** — **Validates: Requirements 1.4**
    - **Property 2: Restoring state shows a neutral placeholder on every Entry_Route** — **Validates: Requirements 1.5**
    - **Property 3: A settled Visitor sees the requested Entry_Route** — **Validates: Requirements 1.6, 1.9**
    - Place in a new `src/RequireVisitor.property.test.tsx` (or alongside `App.tsx` tests), generating random user objects (registered/guest), random `restoring` values and all three Entry_Route paths.
  - [ ]* 1.5 Write unit tests for navigation and leave-session behavior
    - Login success navigates with `replace: true` (extend `src/auth/AuthPages.test.tsx`).
    - Register and upgrade success navigate with `replace: true` (extend `src/auth/AuthPages.test.tsx` / `RegisterUpgrade.test.tsx`).
    - Demo start navigates with `replace: true` (extend `src/state/useStartDemo.test.tsx`).
    - Logout clears session and navigates to `/` with `replace: true` (new or extended test near `useLogout.ts`).
    - Landing page "Try the Demo" still opens the guest name screen for a Visitor (regression check in `src/pages/LandingPage.test.tsx`).
    - Dashboard "Leave session" action clears session and returns to `/` for both guest and signed-in views (extend `src/pages/DashboardPage.test.tsx`).
    - _Requirements: 1.1, 1.2, 1.3, 1.7, 1.8, 1.10_

- [~] 2. Checkpoint — back-navigation fix
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Redesign the Dashboard
  - [x] 3.1 Add shared card primitives and hero styling to `src/styles/dashboard.css`
    - Add the 1/2/3-column grid breakpoints (640px, 1100px), the `.sd-card` hover/focus-within border-and-glow transition, the `[data-reduced='true']` override, and base `.sd-hero` / `.sd-rune-divider` rules, reusing existing tokens only (`--sd-elev-*`, `--color-gold`, `--sd-dur-*`, `--sd-space-*`, `--sd-text-*`).
    - _Requirements: 2.5, 2.6, 2.7, 3.1, 4.4_
  - [x] 3.2 Implement `chooseHeroCta` pure function
    - Create `src/dashboard/heroCta.ts` exporting the `HeroCta` union type and `chooseHeroCta(...)` per the design, deriving exactly one CTA from `isGuest`, `demo.pending`, next-floor presence and `dailyHauntSlot` presence.
    - _Requirements: 2.2, 2.3, 2.4_
  - [ ]* 3.3 Write property test for `chooseHeroCta`
    - **Property 5: The Hero exposes exactly one Primary_CTA** — **Validates: Requirements 2.2**
    - Generate random combinations of `isGuest`, `demo.pending`, next-floor presence and `dailyHauntSlot` presence and assert the function always returns exactly one `HeroCta` value of a valid kind.
  - [x] 3.4 Implement the `Hero` component
    - Create `src/dashboard/Hero.tsx` per the design: display name, level, `ProgressBar`-based XP text, the CTA slot driven by `chooseHeroCta`, a loading skeleton branch (`aria-busy`, accessible label "Loading your next room"), and the `aria-hidden` fog/vignette/rune-divider decoration gated on `useReducedMotion()` via `data-reduced`.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.8, 3.1_
  - [ ]* 3.5 Write property tests for the Hero
    - **Property 4: The Hero always shows the current name, level and numeric XP** — **Validates: Requirements 2.1**
    - **Property 6: Guest Hero always offers demo and account-creation actions** — **Validates: Requirements 2.4**
    - **Property 8: Reduced motion disables animation on every new decorative element** — **Validates: Requirements 3.1**
    - Add to `src/dashboard/Hero.property.test.tsx`, generating random `ProgressInfo` values, display names, and `useReducedMotion()` mock results.
  - [ ]* 3.6 Write unit test for the Hero loading skeleton
    - When the next-floor lookup is loading, the Hero renders the CTA skeleton with `aria-busy="true"` and the "Loading your next room" accessible label.
    - _Requirements: 2.3_
  - [x] 3.7 Wire the Hero into `DashboardPage.tsx` and tighten the card grid
    - Render `<Hero .../>` above the existing `sd-dash` grid for both the player and guest branches, passing the already-computed `progress`, `progressState.status`, `dungeon`, `dailyHauntSlot`, `demo`, `isGuest`, and `toRegister`.
    - Confirm every existing card section (`LevelCard`, `ContinueCard`, `MyNotesCard`, `LiveTopFiveCard`/`LeaderboardPreviewCard`, `RecentRunsCard`, `HauntCard`, `BadgesCard`, `ArmoryCard`, `LinksCard`, `MasteryCard`, guest cards) renders inside an element carrying the `sd-card` class (adjust any section wrapper that does not).
    - _Requirements: 2.5, 2.6, 2.9_
  - [ ]* 3.8 Write property test for card-primitive consistency
    - **Property 7: Every dashboard card section shares the card primitive** — **Validates: Requirements 2.6**
    - Render the Dashboard in randomly generated player/guest and loading/ready/error data states and assert every top-level card section element carries the `sd-card` class.
  - [x] 3.9 Convert dashboard empty/error/loading states to use `EmptyState`
    - Create `src/components/EmptyState.tsx` per the design.
    - Apply it to the reviews-due empty state in `src/dashboard/ProgressCards.tsx` (`HauntCard`) and the empty My Notes state in `src/dashboard/MyNotesCard.tsx`, preserving existing test ids and copy where `MyNotesCard.test.tsx` asserts them.
    - _Requirements: 3.5, 4.2_
  - [ ]* 3.10 Write property test for descriptive card state text
    - **Property 9: Card state is always conveyed through descriptive text** — **Validates: Requirements 3.5**
    - Render `EmptyState` and the Dashboard's loading/error card variants (`CardSkeleton`, `ProgressErrorCard`) with randomized labels/errors and assert rendered text is non-empty and includes a state-describing word.
  - [ ]* 3.11 Update `DashboardPage.test.tsx` for any changed markup
    - Adjust assertions only where the Hero or `EmptyState` changes intentionally alter markup; keep all previously-asserted test ids, headings and texts that are unaffected.
    - _Requirements: 2.9_

- [~] 4. Checkpoint — Dashboard redesign
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Refresh the other pages
  - [x] 5.1 Refresh Landing and Auth pages
    - `src/pages/LandingPage.tsx`: tighten header/hero spacing to the `--sd-space-*` scale; no structural, route or copy change beyond spacing/sizing classes.
    - `src/auth/AuthForm.tsx` (shared by `LoginPage.tsx` and `RegisterPage.tsx`): align `StoneFrame` padding and heading sizes to the `--sd-text-*` scale; keep all field ids, labels, and error/status text unchanged.
    - _Requirements: 4.1, 4.3, 4.4_
  - [x] 5.2 Refresh Upload page
    - `src/upload/UploadPage.tsx`: wrap the empty/initial-state branch in the new `EmptyState` component; leave `Dropzone`, `StepList` and `FileRules` structurally unchanged.
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 5.3 Refresh Campaign (floors) page
    - `src/campaign/CampaignPage.tsx`: align page header padding/spacing with `PageShell`/`.sd-card` conventions; leave `FloorMap` and `TopicList` structurally unchanged.
    - _Requirements: 4.1, 4.3_
  - [x] 5.4 Refresh Scorecard and Leaderboard header
    - `src/scorecard/Scorecard.tsx`: align section spacing/headings to `.sd-card` conventions.
    - `src/leaderboard/LeaderboardPage.tsx`: align the header area (title/subtitle/back link) with `PageShell` conventions used elsewhere; wrap its empty-board state in `EmptyState`, preserving existing test ids asserted by `LeaderboardPage.test.tsx`.
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 5.5 Refresh Settings page
    - `src/pages/SettingsPage.tsx`: align section spacing to the shared scale; leave `DeleteAccountDialog` structurally unchanged.
    - _Requirements: 4.1, 4.3_
  - [ ]* 5.6 Update existing page tests for intentionally changed markup
    - Review and, where needed, adjust `LandingPage.test.tsx`, `AuthPages.test.tsx`, `Upload.test.tsx`, `UploadLayout.test.tsx`, `CampaignFlow.test.tsx`, `Scorecard.test.tsx`, `LeaderboardPage.test.tsx`, `SettingsPage.test.tsx` so they keep passing against the refreshed markup.
    - _Requirements: 4.3_

- [~] 6. Checkpoint — page refresh
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Verify layout, type safety, lint and full test suite
  - [x] 7.1 Run the layout check over all changed routes
    - Kill any leftover headless `msedge`/`chrome` process using a `--remote-debugging-port` (never port 8000) before starting.
    - Run `node scripts/layout-check.mjs --routes /,/login,/register,/upload,/leaderboard,/dashboard,/campaign/demo-dungeon,/settings --sizes 1366x768,360x740 --screenshots .layout-shots | Out-File -Encoding utf8 layout-check.out.txt` from `frontend/`.
    - View the resulting screenshots in `.layout-shots`, read `layout-check.out.txt` for findings, and fix any reported issue in the corresponding page/style file from Tasks 3 or 5.
    - Re-run until the check reports no findings for every changed route at both sizes.
    - _Requirements: 5.1_
  - [x] 7.2 Run typecheck, lint and the full test suite, and fix failures
    - In `frontend/`, clear `Env:VITE_CONTRACT_LIVE`, `Env:VITE_API_BASE`, `Env:VITE_USE_MOCKS` and `Env:VITE_CONTRACT_UPLOADS` for the session.
    - Run `npm run typecheck`, `npm run lint`, and `npm test -- --run`; fix any failure introduced by this change set before proceeding.
    - _Requirements: 5.2, 5.3, 5.4_

- [~] 8. Checkpoint — full verification
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Commit and push
  - [-] 9.1 Stage and commit the changed frontend files and this spec folder
    - Stage changed files by explicit name only (never `git add -A` or `git add .`; never stage `.env*` or `*.db` files): the edited files under `frontend/src/**`, `frontend/scripts/**` (if touched), and `.kiro/specs/frontend-13-polish-and-nav/**`.
    - Commit with message `feat(ui): polished dashboard + page refresh, fix back-nav after login`.
    - _Requirements: 1.1, 1.4, 2.1, 4.1, 5.1_
  - [~] 9.2 Push the branch
    - Push to `origin feature/frontend-live-players`.
    - _Requirements: 5.1, 5.2, 5.3_

## Notes

- Tasks marked with `*` are optional (property/unit tests) and can be skipped for a faster pass, but Property tasks (3.3, 3.5, 3.8, 3.10, 1.4) are the primary verification for the design's Correctness Properties and are strongly recommended.
- No task touches `backend/**`, `.env*`, `*.db`, or any `.kiro/steering/**` file.
- No task changes `src/game/**` (Phaser) or any API contract field.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "3.1", "3.2"] },
    { "id": 1, "tasks": ["1.4", "1.5", "3.4", "3.9"] },
    { "id": 2, "tasks": ["3.3", "3.5", "3.6", "3.7", "3.10", "5.1", "5.2", "5.3", "5.4", "5.5"] },
    { "id": 3, "tasks": ["3.8", "3.11", "5.6"] },
    { "id": 4, "tasks": ["7.1"] },
    { "id": 5, "tasks": ["7.2"] },
    { "id": 6, "tasks": ["9.1"] },
    { "id": 7, "tasks": ["9.2"] }
  ]
}
```
