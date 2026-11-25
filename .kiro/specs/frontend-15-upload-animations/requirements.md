# Requirements Document

## Introduction

Visual polish for the `/upload` page. The result panel is a large, mostly empty box, the File rules card is cramped, and the step list is a flat bar. This feature rebalances the layout and adds CSS-only animation. Scope is frontend only, with no new dependencies and no behaviour changes.

## Glossary

- **Upload_Page**: The `/upload` route rendered by `UploadPage.tsx`.
- **Step_List**: The five-step indicator (Upload, Read, Check relevance, Detect topics, Summon floors).
- **Dropzone**: The file drop and picker area.
- **Result_Panel**: The right-hand panel showing the check outcome and the "Summon dungeon" button.
- **Rules_Card**: The "File rules" card.
- **Ember_Layer**: A decorative background layer of floating particles.
- **Reduced_Motion**: The state where `prefers-reduced-motion: reduce` matches or `[data-reduced='true']` is set on an ancestor.

## Requirements

### Requirement 1: Balanced layout

**User Story:** As a student, I want a balanced upload page, so that no panel looks empty or cramped.

#### Acceptance Criteria

1. THE Result_Panel SHALL size its height to its content, with no fixed or stretched minimum height.
2. THE Rules_Card SHALL render its text at a minimum of 14px with a line height of at least 1.5 and a padding of at least 16px.
3. THE Upload_Page SHALL render without horizontal scrolling at viewport widths from 360px to 1440px.
4. THE Upload_Page SHALL keep all existing test ids, copy, ARIA attributes and behaviour.

### Requirement 2: Animated step list

**User Story:** As a student, I want an animated step list, so that I can see progress at a glance.

#### Acceptance Criteria

1. WHILE a step is done, THE Step_List SHALL show a progress line filled up to that step.
2. WHEN a step becomes done, THE Step_List SHALL play a checkmark pop animation on that step.
3. WHILE a step is active, THE Step_List SHALL show a pulsing ring around that step.

### Requirement 3: Animated dropzone and result panel

**User Story:** As a student, I want a lively dropzone and result panel, so that the page feels rewarding.

#### Acceptance Criteria

1. THE Dropzone SHALL show an animated dashed border.
2. WHEN the pointer hovers over the Dropzone or a file is dragged over it, THE Dropzone SHALL show a glow and a floating rune icon.
3. WHEN the Result_Panel appears, THE Result_Panel SHALL fade in and rise into place within 600ms.
4. WHEN the check passes, THE Result_Panel SHALL play a sparkle burst around the "Summon dungeon" button.
5. WHILE the check has passed, THE "Summon dungeon" button SHALL show a breathing glow.

### Requirement 4: Safe atmospheric motion

**User Story:** As a student, I want atmospheric but safe motion, so that the page stays readable and accessible.

#### Acceptance Criteria

1. THE Ember_Layer SHALL render floating particles using CSS only and carry `aria-hidden="true"`.
2. THE Upload_Page SHALL animate only `transform` and `opacity`.
3. WHILE Reduced_Motion is active, THE Upload_Page SHALL disable all new animations and show static final states.
4. THE Upload_Page SHALL keep text and control contrast at WCAG AA (4.5:1 for text, 3:1 for UI components).
5. THE Upload_Page SHALL add no new package dependencies.
