# Handoff Log: Person A (Backend/AI) to Person B (Frontend/Game)

## [Day 1] - Project Kickoff & Shared Architecture Agreement
- **Status:** Backend Stage 1 Completed.
- **Steering Documents Published:**
  - `.kiro/steering/product.md`
  - `.kiro/steering/tech.md`
  - `.kiro/steering/architecture.md` (Newly added comprehensive system architecture)
  - `.kiro/steering/api-contract.md`
  - `.kiro/steering/game-design.md`
  - `.kiro/steering/security-and-uploads.md`
  - `.kiro/steering/coding-standards.md`
  - `.kiro/steering/team-ownership.md`

---

## ⚠️ PROPOSED API CONTRACT CHANGES (For Person B Review & Agreement)

Per the project protocol, `.kiro/steering/api-contract.md` is our immutable source of truth and is not modified directly. Person A proposes the following contract additions and refinements for Person B to review and approve:

### 1. Same-Origin Cookie Proxy via Vercel Rewrite
- **Proposal:** Session tokens are stored **exclusively in HttpOnly cookies** (no Bearer tokens in `localStorage`).
- **Frontend Impact:** In your `vercel.json`, configure a proxy rewrite so that all `/api/*` calls from the frontend domain point to the Render backend:
  ```json
  {
    "rewrites": [
      { "source": "/api/:path*", "destination": "https://studydungeon-api.onrender.com/api/:path*" }
    ]
  }
  ```
  This guarantees that session cookies are treated as first-party Same-Origin cookies, avoiding cross-domain browser blocking.

### 2. New Endpoint: `GET /documents`
- **Purpose:** Allows the dashboard to list all documents uploaded by the authenticated user.
- **Method:** `GET /documents`
- **Auth:** Registered users only (guests receive `403 Forbidden`).
- **Response (200):**
  ```json
  [
    {
      "id": "uuid",
      "title": "Computer Organization Lecture 3",
      "original_filename": "lecture3.pdf",
      "file_type": "pdf",
      "status": "accepted",
      "created_at": "2026-11-08T10:00:00Z"
    }
  ]
  ```

### 3. New Endpoint: `GET /runs/{id}` (Resume Active Run)
- **Purpose:** If the player refreshes the browser or loses connection mid-run, this endpoint returns the active combat state to restore Phaser without restarting.
- **Method:** `GET /runs/{id}`
- **Auth:** Run owner (or the guest who owns this demo run).
- **Response (200):**
  ```json
  {
    "id": "run-uuid",
    "dungeon_id": "dungeon-uuid",
    "current_hp": 80,
    "current_score": 350,
    "current_streak": 2,
    "status": "active",
    "started_at": "2026-11-08T10:15:00Z"
  }
  ```

### 4. New Endpoint: `DELETE /auth/me` (Account & Data Deletion)
- **Purpose:** GDPR / user privacy compliance to delete account and cascade delete all user-owned documents, dungeons, runs, and attempts.
- **Method:** `DELETE /auth/me`
- **Auth:** Registered user only.
- **Response (200):** `{"success": true, "message": "Account and all associated study data deleted."}`

### 5. Guest Run Restrictions
- **Clarification:** Guest sessions created via `POST /demo/session` may call `POST /runs` ONLY for the dungeon with `is_public_demo == true`. Attempting to start a run on another dungeon returns `403 Forbidden`.

---
*Please review these proposed additions in `docs/handoff/B-to-A.md`. Once agreed, we will merge these into `.kiro/steering/api-contract.md`.*
