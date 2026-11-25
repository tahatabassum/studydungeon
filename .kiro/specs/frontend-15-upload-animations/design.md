# Design Document

## Overview

Pure CSS polish on the existing upload components. TSX changes are limited to small markup tweaks, such as an extra decorative element or a wrapper class. Styles go in `frontend/src/styles/upload-polish.css`, with `upload.css` adjusted only where layout rules live. Language: TypeScript and CSS.

## Architecture

The change is CSS-only and sits on top of the existing React components. The sections below describe each area.

## Components and Interfaces

- **Layout:** The grid in `upload.css` uses `align-items: start` so the Result_Panel sizes to its content. The Rules_Card gets larger padding and type. Columns collapse to one below about 900px.
- **Step_List:** `.sd-up__steps` already receives `--sd-up-progress`. A `::before` track and an `::after` fill scaled with `transform: scaleX()` give the animated line. Each `[data-state='done']` mark plays a `sd-pop` keyframe. Each `[data-state='active']` mark has a `::after` ring that pulses via `transform: scale` and `opacity`.
- **Dropzone:** The dashed border animates with a rotating pseudo-element or a `background-position` shift on a masked layer. The glow is an `opacity` transition on `:hover` and `[data-over='true']`. The `.sd-up__seal` icon floats with a `translateY` keyframe.
- **Result_Panel:** An entrance keyframe (`opacity` 0 to 1, `translateY` 12px to 0, 450ms). Success state adds a sparkle burst from pseudo-elements and a breathing glow on the CTA. The glow is a pseudo-element whose `opacity` and `transform` animate, not `box-shadow`.
- **Ember_Layer:** A decorative `<div aria-hidden="true" className="sd-up__embers">` in `UploadPage.tsx` with a few child spans. Each span has its own `--x`, `--delay` and `--dur` custom properties, and floats up with `transform` and `opacity`. `pointer-events: none`, placed behind the content.
- **Reduced motion:** One block, `@media (prefers-reduced-motion: reduce)`, and a mirrored `[data-reduced='true'] ...` block. Both set `animation: none; transition: none` on all new selectors. The Ember_Layer is hidden, and the progress line and done marks are shown in their final static state.
- **Contrast:** Reuse existing theme tokens. New glows are decorative and never carry text.

## Data Models

No new data models. The only data input is the existing `--sd-up-progress` custom property and the `data-state` and `data-over` attributes.

## Error Handling

The `stopped` step state keeps its existing icon and screen-reader text. The animation rules do not apply to it.

## Correctness Properties

Styling work has no meaningful universal properties. The one invariant worth stating is below, and it is verified by the existing tests.

### Property 1: Behaviour preservation

For any upload flow state, the rendered test ids, copy and ARIA attributes SHALL equal those before the restyle.

**Validates: Requirements 1.4**

## Testing Strategy

Existing tests in `src/upload` must pass unchanged. Typecheck and lint must pass. `scripts/layout-check.mjs` verifies no overflow at 1366x768 and 360x740. No property-based tests apply, because this is styling work.
