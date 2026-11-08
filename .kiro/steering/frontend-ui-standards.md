---
inclusion: fileMatch
fileMatchPattern: "frontend/**"
---

> **PROPOSAL for Person A's review, not yet merged.** Written by Person B (frontend) during frontend-07 Phase 0. It applies only when files under `frontend/**` are in context, so it does not affect backend work. Nothing here changes the API contract.

# Frontend UI standards

## Design tokens

Existing tokens (from `frontend/src/index.css`, `@theme`):

- Colors: `bg #100b18`, `surface-2`, `panel`, `deep`, `magic`, `accent`, `ink`, `ink-muted`, `danger`, `health`, `gold`, plus Halloween accents `pumpkin`, `ember`, `ghost`, `toxic`, `witch`, `magenta`, `indigo`, `bone`, `blood-red`.
- Fonts: `--font-display` (Pirata One), `--font-label` (Cinzel), `--font-body` (Inter). All self-hosted.
- Witch purple is for fills and glows only (about 2.9:1 on bg). Raw `danger` and `magic` are mixed with ink when used as text.

Planned scales (proposed, added in later phases; use these instead of ad hoc values):

- Spacing: 4, 8, 12, 16, 24, 32, 48 px.
- Type: 12, 14, 16, 20, 28, 40 px; display font for headings, label font for small caps labels, body font for reading text.
- Glow: `sm` (4 px), `md` (12 px), `lg` (24 px) blur, using a palette color at 35 to 60 percent alpha.
- Elevation: 0 flat, 1 panel, 2 popup, 3 modal, each a shadow plus a stone-frame border.

## Motion rules

- Durations: micro feedback 100 to 150 ms, UI transitions 200 to 300 ms, popups and screens up to 400 ms. Nothing blocks input longer than 400 ms.
- Respect `prefers-reduced-motion` in every new effect: replace motion with a static state, no looping animation, no flashes (lightning off).
- Respect mute: every new sound goes through the existing audio module, which honors the mute flag.
- Phaser effects use object pools. No allocation per frame (no new objects, arrays or closures in `update`).
- Pure logic lives in Phaser-free modules with unit tests.

## Accessibility rules

- Contrast: 4.5:1 for normal text, 3:1 for large text and UI component boundaries, checked with the existing contrast helper.
- Every interactive element is reachable by keyboard and shows the `:focus-visible` ring (3 px accent outline).
- Dialogs and overlays trap focus and restore it on close (reuse `OverlayFrame`).
- Results, rank changes and errors are announced through one `aria-live="polite"` region. Errors that block use are `role="alert"`.
- Answer options are also selectable by number keys 1 to 4.
- Meaning is never carried by color alone.

## Adapter rules

- All network access goes through `ApiClient` (`src/api`). Components, hooks and Phaser never call `fetch` directly.
- The backend is authoritative for correctness, damage, HP, XP, score, streak, rank and badges. Only the Mock_Adapter and the Offline_Module compute them. The UI displays values exactly as received.
- Any field or endpoint the backend does not provide yet is marked `PROPOSED`, documented in `docs/handoff/B-to-A.md`, built against the mock and treated as pending.
- The Offline_Module is loaded only by dynamic `import()` from the Offline handler, never statically.
- Phaser code under `src/game` imports nothing from `src/api`, `src/demo`, `src/state`, `src/offline` or `src/leaderboard`. `importBoundary.test.ts` enforces this.
- No credentials or tokens in localStorage or sessionStorage. The cookie session is the only credential.
- Event_Bridge changes are additive; existing events and payloads stay unchanged.
