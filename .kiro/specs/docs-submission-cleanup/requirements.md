# Requirements Document

## Introduction

Prepare the StudyDungeon repository for hackathon submission. Remove obsolete report files, verify that Kiro artifacts and the license are visible to judges, write evidence-based submission documents, and publish the changes to the feature branch.

## Glossary

- **Repository**: The StudyDungeon git repository at the workspace root.
- **Cleanup_Script**: The set of git commands that remove or move documentation files.
- **Kept_Docs**: README.md, LICENSE, docs/DEPLOY_CHECKLIST.md, docs/KIRO_WRITEUP.md, docs/DEVPOST_DESCRIPTION.md, docs/DEMO_VIDEO_SCRIPT.md, docs/kiro-log-backend.md, docs/kiro-log-frontend.md, docs/handoff/**, docs/openapi.json, .kiro/**, and the backend and frontend READMEs.
- **Submission_Docs**: README.md, docs/KIRO_WRITEUP.md, docs/DEVPOST_DESCRIPTION.md, and docs/DEMO_VIDEO_SCRIPT.md.
- **Placeholder**: A marked text of the form `[FILL IN: hint]` for facts only the user knows.

## Requirements

### Requirement 1: Repository cleanup

**User Story:** As a judge, I want a tidy repository, so that I can find the relevant documentation quickly.

#### Acceptance Criteria

1. WHEN the cleanup runs, THE Cleanup_Script SHALL remove BACKEND_REMAINING_WORK.md, PERSON_A_BACKEND_TASKS.md, PROJECT_MASTER_REPORT.md, docs/FINAL_REPORT.md, docs/FULL_BACKEND_REPORT.md, docs/master-roadmap.md, docs/STATUS.md, and docs/SUBMISSION_CHECKLIST.md using `git rm`.
2. WHEN the cleanup runs, THE Cleanup_Script SHALL move the three planning files in docs/ (the PRD markdown, the roadmap docx, and the PersonB prompts txt) into docs/planning/ using `git mv`.
3. WHEN a Kept_Docs file links to a removed or moved file, THE Cleanup_Script SHALL update that link before the removal is committed.
4. THE Cleanup_Script SHALL leave .env files, *.db files, and untracked local files unmodified.

### Requirement 2: Hackathon repository rules

**User Story:** As a hackathon organizer, I want the repository to meet submission rules, so that the entry is eligible.

#### Acceptance Criteria

1. THE Repository SHALL track the .kiro directory and SHALL NOT match any .kiro path against a .gitignore rule.
2. THE Repository SHALL contain a LICENSE file with the standard MIT license text.
3. WHEN verification completes, THE Repository documentation SHALL record the counts of specs, hooks, and steering files.

### Requirement 3: Submission documents

**User Story:** As a judge, I want accurate submission documents, so that I can evaluate the project and its use of Kiro.

#### Acceptance Criteria

1. THE Submission_Docs SHALL state only facts supported by repository files or git history.
2. WHERE a fact is known only to the user, THE Submission_Docs SHALL contain a Placeholder with a hint.
3. THE README.md SHALL contain the pitch, problem and audience, feature list, screenshots placeholder, links placeholders, tech stack, mermaid architecture diagram, repository layout, local run instructions for PowerShell and macOS/Linux using ports 8000 and 5173, deploy summary, Kiro section, team, and MIT license.
4. THE docs/KIRO_WRITEUP.md SHALL contain sections for Kiro apps, custom agents, agent hooks, spec-driven development, steering docs, MCP, property-based testing, Kiro powers, and challenges and lessons, preserving existing user-written content.
5. THE docs/DEVPOST_DESCRIPTION.md SHALL use the sections Inspiration, What it does, How we built it, Challenges, Accomplishments, What we learned, and What's next, and SHALL reference Supabase instead of Neon.
6. THE docs/DEMO_VIDEO_SCRIPT.md SHALL describe a timestamped script of less than three minutes and SHALL remind the author to avoid copyrighted music and set the video public on YouTube.
7. THE Kept_Docs SHALL contain no stale Neon references.

### Requirement 4: Commit and push

**User Story:** As a team member, I want the changes pushed, so that the branch is ready for review.

#### Acceptance Criteria

1. WHEN committing, THE Cleanup_Script SHALL stage the rewritten docs and the spec folder by explicit path.
2. IF a .env or .db file is staged, THEN THE Cleanup_Script SHALL unstage the file before committing.
3. WHEN staging is verified, THE Cleanup_Script SHALL commit with the message `docs: submission README, Kiro write-up, cleanup old reports` and push to origin feature/frontend-live-players.
4. WHEN the push completes, THE final report SHALL state that the GitHub repository must be public, the About section should show the MIT license, and the pull request must be merged to the default branch.
