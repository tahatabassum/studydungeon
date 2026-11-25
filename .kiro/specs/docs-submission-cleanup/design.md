# Design Document

## Overview

This is a documentation and git-hygiene change with no application code. Work is done with git commands and markdown edits, in four sequential steps: cleanup, verification, writing, commit and push. Pseudocode (shell commands) is used for examples.

## Architecture

```mermaid
flowchart LR
    A[Cleanup git rm / git mv] --> B[Verify .kiro and LICENSE]
    B --> C[Write submission docs]
    C --> D[Commit and push]
```

## Components and Interfaces

- **Cleanup**: `git grep` for links to each target file, fix links, then `git rm` the eight files and `git mv` the three planning files into docs/planning/.
- **Verification**: `git check-ignore -v .kiro/specs` must print nothing; `git ls-files .kiro | measure` gives tracked count; LICENSE first lines are compared with MIT text; counts of spec folders, hook files, and steering files are taken from the directory listings.
- **Docs writer**: reads .kiro/specs, .kiro/hooks, .kiro/steering, docs/kiro-log-*.md, docs/handoff/*, and `git log --oneline | measure`. Test counts come from the user brief: 165 backend pytest, 1554 frontend vitest. Unknown facts become `[FILL IN: hint]`.
- **Publish**: `git add <explicit paths>`, `git status --short` check, `git commit`, `git push origin feature/frontend-live-players`.

## Data Models

None. Placeholders use the literal form `[FILL IN: hint]`.

## Error Handling

- If a link to a removed file exists in a kept doc, fix it before running `git rm`.
- If `.kiro` is matched by an ignore rule, remove the rule and report it.
- If a .env or .db file appears in staged changes, run `git restore --staged <path>`.
- If PowerShell returns no output, run the command through `cmd /c` with output redirected to a temp file.

## Testing Strategy

Verification uses command checks only: `git grep` for removed file names and "Neon" in kept docs, `git status --short`, and `validate_spec_format` for the spec. No property tests apply.
