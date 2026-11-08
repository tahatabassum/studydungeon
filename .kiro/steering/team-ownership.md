# StudyDungeon — Team Ownership & Handoff Agreement

## 1. Ownership Matrix
- **Person A (AI / Backend Owner):**
  - Owns `backend/**`
  - Owns `.kiro/specs/backend-*/**`
  - Owns `.kiro/hooks/backend-*.json`
  - Owns `docs/handoff/A-to-B.md`
  - Owns backend deployment & database configuration.
- **Person B (Frontend / Game Owner):**
  - Owns `frontend/**`
  - Owns Phaser scenes, canvas components, animations, sound, sprites, and Tailwind styling.
  - Owns `.kiro/specs/frontend-*/**`
  - Owns `docs/handoff/B-to-A.md`
  - Owns frontend deployment (Vercel).

## 2. Shared Steering Protocols
- Files in `.kiro/steering/*` represent the immutable contract between Person A and Person B.
- Neither person may modify steering files without mutual agreement.
- Changes are proposed as markdown diffs inside `docs/handoff/A-to-B.md` or `B-to-A.md` and committed only after agreement.

