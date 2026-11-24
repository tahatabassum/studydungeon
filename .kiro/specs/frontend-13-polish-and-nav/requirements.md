# Requirements Document

## Introduction

This spec covers three frontend-only changes to StudyDungeon (React 18, TypeScript, Vite, Tailwind). It touches nothing under `backend/**`, no `.env*` files, no steering files and no API contract fields. Phaser stays inside `GameCanvas`; combat and game logic are unchanged.

1. **Back-navigation bug.** After logging in, pressing the browser Back button (or swiping back) lands the player on the landing page, even though the session is live (the Dashboard and Leaderboard still show the player's name).
2. **Dashboard redesign.** The Dashboard (`/dashboard`) gets a stronger first impression for hackathon judges: a hero header, a structured card grid, consistent card styling and decorative touches, in the existing Halloween brand, palette and fonts.
3. **Light page refresh.** Landing, login, register, upload, campaign (floors), scorecard, leaderboard header and settings receive small consistency updates so they match the new Dashboard.

## Glossary

- **App**: The StudyDungeon React frontend in `frontend/`.
- **Session_Provider**: `SessionProvider` in `src/state/SessionContext.tsx`. It holds `user`, `dungeonId` and `restoring`.
- **Restoring_State**: The period in which `restoring` is true, before the first `getMe` check has settled.
- **Authenticated_User**: A user in the Session_Provider, either registered (`is_guest` false) or a guest with a live session (`is_guest` true).
- **Visitor**: A person with no user in the Session_Provider once Restoring_State has ended.
- **Entry_Routes**: The routes `/`, `/login` and `/register`.
- **Entry_Guard**: A route wrapper that decides what an Entry_Route renders based on session state.
- **Replace_Navigation**: A navigation with `replace: true`, so the previous history entry is overwritten.
- **Dashboard**: The page at `/dashboard` (`src/pages/DashboardPage.tsx`) and its cards in `src/dashboard/*`.
- **Hero**: The top section of the Dashboard showing player name, level, XP progress and a primary call to action.
- **Primary_CTA**: The single most prominent button in the Hero (continue, enter dungeon or Daily Haunt).
- **Card_Primitives**: The shared CSS classes and tokens for dashboard cards (surface, border, glow, hover, header).
- **Refreshed_Pages**: Landing (`src/pages/LandingPage.tsx`), Login and Register (`src/auth/*`), Upload (`src/upload/*`), Campaign floors (`src/campaign/CampaignPage.tsx`), Scorecard (`src/scorecard/Scorecard.tsx`), Leaderboard header (`src/leaderboard/LeaderboardPage.tsx`) and Settings (`src/pages/SettingsPage.tsx`).
- **Layout_Check**: The script `frontend/scripts/layout-check.mjs`, run through `node scripts/layout-check.mjs`.
- **Reduced_Motion**: The user setting `prefers-reduced-motion: reduce`.

## Requirements

### Requirement 1: Back-navigation after login keeps the player signed in

**User Story:** As a logged-in player, I want the Back button to keep me inside the app, so that I do not land on the landing, login or register page while I am signed in.

#### Acceptance Criteria

1. WHEN a login succeeds, THE App SHALL navigate to `/dashboard` using Replace_Navigation.
2. WHEN a registration or guest upgrade succeeds, THE App SHALL navigate to `/dashboard` using Replace_Navigation.
3. WHEN a demo session or guest session starts, THE App SHALL navigate to the destination route using Replace_Navigation.
4. WHILE an Authenticated_User is on an Entry_Route, THE Entry_Guard SHALL redirect to `/dashboard` using Replace_Navigation.
5. WHILE the Session_Provider is in Restoring_State, THE Entry_Guard SHALL render a neutral loading placeholder instead of the Entry_Route content.
6. WHEN Restoring_State ends and no user exists, THE Entry_Guard SHALL render the requested Entry_Route.
7. WHEN an Authenticated_User chooses to log out, THE App SHALL clear the session and navigate to `/` using Replace_Navigation, and THE Entry_Guard SHALL render the landing page.
8. WHEN a Visitor selects "Try the Demo" on the landing page, THE App SHALL open the guest name screen and start the demo as before.
9. IF the `getMe` check fails or times out, THEN THE Entry_Guard SHALL treat the user as a Visitor once Restoring_State ends.
10. THE Dashboard SHALL offer a visible way for a guest to leave the session and return to the landing page, replacing the "Title screen" back link that the Entry_Guard would redirect.

### Requirement 2: Dashboard first-impression redesign

**User Story:** As a hackathon judge, I want the Dashboard to look polished at first glance, so that I understand the product and my next action immediately.

#### Acceptance Criteria

1. THE Dashboard SHALL render a Hero containing the player's display name, level, and an XP progress bar with its numeric values.
2. THE Hero SHALL contain exactly one Primary_CTA whose label names the action (continue the dungeon, enter the dungeon, or start the Daily Haunt).
3. WHEN the Dashboard data for the next playable floor is loading, THE Hero SHALL show a skeleton for the Primary_CTA with an accessible loading label.
4. WHERE the viewer is a guest, THE Hero SHALL show the guest name, a "Play the demo" Primary_CTA and a "Create account" secondary action.
5. THE Dashboard SHALL arrange My Notes, Live Top 5, progress and weapons, reviews due and mode links in a grid with one column below 640 px, two columns from 640 px and three columns from 1100 px.
6. THE Dashboard SHALL render every card through the same Card_Primitives (surface, border, glow and header style).
7. WHEN the pointer hovers over or keyboard focus enters an interactive card, THE Dashboard SHALL show a hover or focus state with a border and glow change within 200 ms.
8. THE Dashboard SHALL include decorative fog, a vignette and rune dividers that carry `aria-hidden="true"`.
9. THE Dashboard SHALL keep the existing test ids, headings and texts that the existing tests assert, or update those tests in the same change.
10. WHEN the viewport width is between 360 px and 2560 px, THE Dashboard SHALL render without horizontal page scroll, overlapping elements or clipped text.

### Requirement 3: Accessibility and motion respect

**User Story:** As a player with motion sensitivity or low vision, I want the redesigned screens to respect my settings, so that I can use them comfortably.

#### Acceptance Criteria

1. WHILE Reduced_Motion is active, THE App SHALL render every new Dashboard and page-refresh effect as a static state with no looping animation.
2. THE App SHALL use text and interactive-component colors that meet a contrast ratio of at least 4.5:1 for normal text and 3:1 for large text and component boundaries.
3. THE App SHALL show a visible `:focus-visible` outline on every interactive element on the Dashboard and the Refreshed_Pages.
4. THE App SHALL give every interactive element on the Dashboard and the Refreshed_Pages a touch target of at least 44 px when touch mode is active.
5. THE App SHALL convey card state (loading, error, empty) through text or icon and not through color alone.

### Requirement 4: Consistent light refresh across other pages

**User Story:** As a player, I want every page to feel like part of the same game, so that the app looks consistent.

#### Acceptance Criteria

1. THE Refreshed_Pages SHALL use the shared page header, the Card_Primitives and the shared button styles for their headings, panels and buttons.
2. WHEN a list or panel on a Refreshed_Page has no content, THE Refreshed_Page SHALL show an empty state with an icon, a one-line explanation and a next action.
3. THE Refreshed_Pages SHALL keep their existing routes, test ids, ARIA attributes and visible texts that existing tests assert.
4. THE Refreshed_Pages SHALL use the existing fonts (Pirata One, Cinzel, Inter) and palette tokens from `src/index.css`, with no new font or color family.
5. THE App SHALL add no new runtime dependency with a bundle weight above 10 kB gzip.

### Requirement 5: Automated verification of the polish work

**User Story:** As a maintainer, I want the polish verified by automated checks, so that regressions are caught.

#### Acceptance Criteria

1. WHEN the Layout_Check runs for every changed route at 1366x768 and 360x740, THE Layout_Check SHALL report no findings.
2. WHEN `npm run typecheck` and `npm run lint` run in `frontend/`, THE App SHALL produce no errors.
3. WHEN `npm test` runs in `frontend/` with `VITE_CONTRACT_LIVE`, `VITE_API_BASE`, `VITE_USE_MOCKS` and `VITE_CONTRACT_UPLOADS` unset, THE App SHALL pass all tests.
4. THE App SHALL contain no AI key, token or credential in `frontend/**` and SHALL store no credential in `localStorage` or `sessionStorage`.
