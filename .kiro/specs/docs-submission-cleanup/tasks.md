# Implementation Plan: Docs Submission Cleanup

## Overview

Four sequential steps: remove obsolete docs, verify hackathon requirements, write submission docs from real evidence, then commit and push.

## Tasks

- [x] 1. Remove unnecessary markdown files and relocate planning docs
  - [x] 1.1 Find links to files that will be removed or moved
    - Run `git grep` for each target file name across Kept_Docs and fix any link found
    - _Requirements: 1.3_
  - [x] 1.2 Remove obsolete reports with `git rm`
    - Remove root BACKEND_REMAINING_WORK.md, PERSON_A_BACKEND_TASKS.md, PROJECT_MASTER_REPORT.md
    - Remove docs/FINAL_REPORT.md, FULL_BACKEND_REPORT.md, master-roadmap.md, STATUS.md, SUBMISSION_CHECKLIST.md
    - _Requirements: 1.1, 1.4_
  - [x] 1.3 Move planning files with `git mv` into docs/planning/
    - Move the PRD markdown, the roadmap docx, and the PersonB prompts txt
    - Confirm .env, *.db, vt.log remain untouched
    - _Requirements: 1.2, 1.4_

- [x] 2. Verify hackathon repository requirements
  - [x] 2.1 Check .kiro is tracked and not ignored
    - Run `git check-ignore -v .kiro/specs` (expect no output) and `git ls-files .kiro | measure`
    - _Requirements: 2.1_
  - [x] 2.2 Check LICENSE and record Kiro artifact counts
    - Confirm LICENSE is standard MIT text with copyright holder M Taha Tabassum
    - Count spec folders, hook files, and steering files for the write-up
    - _Requirements: 2.2, 2.3_

- [ ] 3. Write the submission documents from real evidence
  - [x] 3.1 Rewrite README.md
    - Include all sections listed in Requirement 3.3 with `[FILL IN: ...]` placeholders for links and names
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 3.2 Rewrite docs/KIRO_WRITEUP.md
    - Read .kiro/specs, hooks, steering, kiro-log files, and handoff docs; preserve existing user-written content
    - Use the nine judge-question sections with real hooks, specs, steering files, and PBT examples
    - _Requirements: 3.1, 3.2, 3.4_
  - [x] 3.3 Update docs/DEVPOST_DESCRIPTION.md and docs/DEMO_VIDEO_SCRIPT.md
    - Devpost: required seven sections, Supabase, Memories, named guest leaderboard
    - Video script: timestamps under 3 minutes, music and YouTube reminder
    - _Requirements: 3.1, 3.5, 3.6_
  - [-] 3.4 Fix stale Neon mentions in Kept_Docs
    - Run `git grep -i neon` over kept docs and replace with Supabase where accurate
    - _Requirements: 3.7_

- [ ] 4. Commit and push
  - [~] 4.1 Stage by explicit path
    - Add README.md, the four docs files, docs/planning, and .kiro/specs/docs-submission-cleanup
    - _Requirements: 4.1_
  - [~] 4.2 Confirm nothing sensitive is staged
    - Run `git status --short` and unstage any .env or .db file
    - _Requirements: 4.2_
  - [~] 4.3 Commit and push
    - Commit message `docs: submission README, Kiro write-up, cleanup old reports`, then `git push origin feature/frontend-live-players`
    - Final report notes: repo must be public, About shows MIT license, PR merged to default branch
    - _Requirements: 4.3, 4.4_

## Notes

- Execute tasks in order; each top-level task depends on the previous one.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["2.1"] },
    { "id": 4, "tasks": ["2.2"] },
    { "id": 5, "tasks": ["3.1"] },
    { "id": 6, "tasks": ["3.2"] },
    { "id": 7, "tasks": ["3.3"] },
    { "id": 8, "tasks": ["3.4"] },
    { "id": 9, "tasks": ["4.1"] },
    { "id": 10, "tasks": ["4.2"] },
    { "id": 11, "tasks": ["4.3"] }
  ]
}
```
