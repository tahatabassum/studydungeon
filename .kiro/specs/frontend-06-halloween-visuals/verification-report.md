# Verification Report: frontend-06-halloween-visuals

Scope: Phase 6 tasks 10.1 to 10.3. Task 11 (performance readings) is left for the user.

Method notes:
- Contrast values come from `src/design/palette.test.ts` and `src/design/tokens.test.ts` (automated, WCAG ratio).
- Reduced-motion rows record the mechanism in code and the test that covers it. Visual confirmation in a browser was not done in this run and is marked "manual check".

## Contrast by screen

| Screen | Text and UI pairs checked | Result |
| --- | --- | --- |
| Landing page | ink and bone on bg (4.5), bg on pumpkin button (4.5), error text danger mixed 45% with ink on bg, witch used only for decorative bats | Pass (error text was raw danger at 3.9:1, now mixed, see Fixes) |
| HUD and RoomProgress | ink, ink-muted, gold, health on panel and surface-2 (4.5), Lv text magic mixed 40% with ink, low-health text danger mixed 45% with ink | Pass (Lv and low-health were raw magic and danger, now mixed) |
| Question panel (spellbook) | bg on ink and bone parchment (4.5), option text ink on panel, wrong-answer and error text danger mixed 45% with ink, correct text health mixed with bg | Pass (danger text fixed) |
| Victory overlay | ink on panel and bg (4.5), gold on panel (4.5), danger icon only (UI, 3.0 on panel) | Pass |
| Defeat overlay | ink on bg and panel (4.5), candle glows decorative | Pass |
| Pause menu and OverlayFrame | ink on panel (4.5), pumpkin and magic borders on panel (3.0) | Pass |
| Room transitions | No text | n/a |

## Contrast by room (Phaser rooms)

Room art is decorative. The only text in the canvas is HUD/DOM text above, so no room has its own text contrast requirement. Each room palette uses tokens whose parity with `src/index.css` is tested.

| Room | Theme id | Text on canvas | Result |
| --- | --- | --- | --- |
| Entry | entry | none | n/a |
| Haunted Library | library | none | n/a |
| Witch's Laboratory | witch_lab | none | n/a |
| Clockwork Crypt | clockwork_crypt | none | n/a |
| Pumpkin Workshop | pumpkin_workshop | none | n/a |
| Boss Hall | boss_hall | none | n/a |

## Reduced motion by screen

| Screen | Mechanism | Covered by | Manual check |
| --- | --- | --- | --- |
| Landing page | Animations stop under prefers-reduced-motion | `LandingPage.test.tsx` | pending |
| HUD | Low-health pulse disabled under reduced motion (global rule and data-reduced flag) | `Hud.test.tsx`, `hudHelpers.test.ts` | pending |
| Question panel | Hover glow only, no motion loops | `QuestionPanel.test.tsx` | pending |
| Victory overlay | Embers and bat confetti static, XP counter shows the final value | `VictoryOverlay.test.tsx` | pending |
| Defeat overlay | Candles static | `DefeatOverlay.test.tsx` | pending |
| Pause menu | Frame is static | `OverlayFrame.test.tsx` | pending |
| Room transitions | `TransitionSystem` is off under reduced motion | code path in `onRoomChange` | pending |

## Reduced motion by room

| Room | Mechanism | Covered by | Manual check |
| --- | --- | --- | --- |
| Entry | Flicker constant, ambient cap 4 | `flicker.property.test.ts`, `themeBudget.property.test.ts` | pending |
| Haunted Library | Static pieces, flicker constant | same | pending |
| Witch's Laboratory | Static bubbles and sparks, flicker constant | same | pending |
| Clockwork Crypt | Static clock hands, pendulum, gears | same | pending |
| Pumpkin Workshop | Static faces, no embers loop | same | pending |
| Boss Hall | Lightning overlay off, flicker constant | same | pending |

## Fixes made in 10.1

Raw `danger` (3.93:1 on bg) and raw `magic` (below 4.5:1 on panel) were used as text colours. Token values are locked by tests, so the components now use `color-mix(in srgb, token, ink N%)`:
- `LandingPage.tsx` error text
- `Hud.tsx` low-health text and level text
- `QuestionPanel.tsx` error text and wrong-answer result text

Icons that use `text-danger` (Skull, AlertTriangle) remain, because icons are UI elements with a 3:1 requirement. Witch is used only as `color` on decorative bat shapes (`.sd-bat*` in `landing.css` and `overlays.css`) and in box-shadow glows. A test now enforces that.

## Performance readings (to be filled in by the user, task 11)

Open each room with `?debug=1`. For the Canvas rows use `?renderer=canvas&debug=1`. Record the values the overlay shows after about 10 seconds in the room.

| Room | WebGL fps | WebGL ambient count | WebGL texture MiB | Canvas fps | Canvas ambient count | Canvas texture MiB |
| --- | --- | --- | --- | --- | --- | --- |
| Entry | | | | | | |
| Haunted Library | | | | | | |
| Witch's Laboratory | | | | | | |
| Clockwork Crypt | | | | | | |
| Pumpkin Workshop | | | | | | |
| Boss Hall | | | | | | |

## Test counts

| Check | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm run test` | 64 files, 402 tests, all pass (baseline requirement: at least 267) |
| `npm run build` | pass (tsc and vite build) |
| `importBoundary.test.ts` | pass |
| `palette.test.ts` | 49 tests (20 parity, 10 palette contrast, 19 component pair and witch checks) |
| `ambient.test.ts` | 9 tests |

## Sound change in this run

The owl was hard to hear. `ONESHOT_GAIN` went from 0.1 to 0.35 of master (about 0.09 absolute). This supersedes the 10% ceiling in design D8. The bed stays at 0.05 of master. The first one-shot now plays 8 to 15 s after start, later ones 20 to 60 s, alternating owl and creak with the owl first.
