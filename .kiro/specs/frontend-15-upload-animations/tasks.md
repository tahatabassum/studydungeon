# Implementation Plan: Upload Page Animations

## Overview

Restyle `/upload` with a balanced layout and CSS-only animation, then verify and commit.

## Tasks

- [x] 1. Redesign and animate the upload page
  - [x] 1.1 Balance the layout
    - Make the Result_Panel height fit its content and give the Rules_Card larger padding and type
    - Edit `frontend/src/styles/upload.css` and `frontend/src/styles/upload-polish.css`
    - Make the layout responsive from 360px to 1440px
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 1.2 Animate the step list
    - Add the progress line, the checkmark pop on done steps and the pulsing ring on the active step
    - Edit `frontend/src/upload/StepList.tsx` (markup only) and `upload-polish.css`
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 1.3 Animate the dropzone and result panel
    - Add the animated dashed border, the hover and drag glow, and the floating rune
    - Add the result panel entrance, the sparkle burst and the breathing CTA glow
    - Edit `Dropzone.tsx`, `SummonResult.tsx` (markup only) and `upload-polish.css`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.2, 4.4_
  - [x] 1.4 Add background embers and reduced motion
    - Add the aria-hidden Ember_Layer in `UploadPage.tsx` and its CSS
    - Disable all new animations under `prefers-reduced-motion` and `[data-reduced='true']`
    - _Requirements: 4.1, 4.2, 4.3, 4.5_

- [ ] 2. Verify and commit
  - [-] 2.1 Run the checks
    - Clear `VITE_CONTRACT_LIVE`, `VITE_API_BASE`, `VITE_USE_MOCKS` and `VITE_CONTRACT_UPLOADS` in the shell
    - Run `npx vitest run src/upload`, `npm run typecheck` and `npm run lint` in `frontend`
    - Run `node scripts/layout-check.mjs --routes "/upload" --sizes "1366x768,360x740" | Out-File -Encoding utf8 <file>`, and never use port 8000
    - _Requirements: 1.3, 1.4, 4.2_
  - [~] 2.2 Commit and push
    - Stage the changed files by explicit path
    - Commit with the message "style(upload): balanced layout and animated steps"
    - Push to `origin feature/frontend-live-players`
    - _Requirements: 1.4_

## Notes

- Each task references the requirements it covers.
- No optional tasks. Styling work has no correctness properties.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["1.4"] },
    { "id": 4, "tasks": ["2.1"] },
    { "id": 5, "tasks": ["2.2"] }
  ]
}
```
