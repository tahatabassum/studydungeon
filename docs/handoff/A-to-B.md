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
---

## [Day 2] - End-to-End Integration & Architectural Answers for Person B

### Clarifications & Answers to Core Integration Topics:
1. **Explanation & Evidence Behavior:**
   - During room combat, `GET /dungeons/{id}` strictly redacts correct answers and explanations so students cannot inspect browser network responses to cheat.
   - Upon submitting an attempt via `POST /runs/{id}/attempts`, the server calculates correctness and returns `{is_correct, damage_dealt, explanation, evidence_quote}`.
2. **Clear-Room & Run Finish Responses:**
   - `POST /runs/{id}/finish` calculates accuracy (`0.0 - 1.0` ratio), total XP earned, and mastery bands (`Weak <50`, `Learning 50-79`, `Strong >=80`).
3. **Selected Answer Payload:**
   - In `POST /runs/{id}/attempts`, send `selected_answer` as the string text of the option chosen (e.g. `"Arithmetic Logic Unit (ALU)"` or for T/F `["True", "False"]`).
4. **Cookie & CORS Architecture:**
   - SameSite=Lax (or None with Secure over HTTPS). We recommend Vercel proxy rewrite `/api/* -> Render backend` for seamless zero-config same-origin cookie transport.
   - `TRUSTED_PROXY_COUNT=1` is configured to protect rate limits against spoofed proxy hops.
5. **Guest Lifetime & Expiry Mid-Run:**
   - Demo guests have 24-hour TTL (`DEMO_GUEST_TTL_HOURS=24`). If a guest expires mid-run, `POST /runs/{id}/attempts` returns 401, prompting session refresh.
6. **Balance Table Parity (steering vs handoff):**
   - Source of truth is `.kiro/steering/game-design.md`:
     - Normal monsters deal 10 HP counter-damage; Boss deals 12 HP counter-damage.
     - Starter weapon (Rusty Dagger) deals 20 base damage; critical streak deals 1.5x damage; hard questions deal 1.25x damage.
7. **Offline Demo Fallback Sample JSON:**
   - `docs/handoff/demo_dungeon.sample.json` has been refreshed and validated. Note: For the offline fallback demo only, correct answers are bundled in the fixture so Phaser can evaluate gameplay completely offline.

8. **Source Preview Endpoint (`GET /documents/{id}/source-preview`):**
   - **Purpose:** Surfaces citations ("From your notes: page N") for questions during run review.
   - **Access:** Owner-scoped; demo guests may access preview only for the seeded public demo document.
   - **Response Format:**
     ```json
     {
       "document_id": "doc-uuid",
       "title": "Operating Systems Lecture",
       "chunks": [
         {
           "chunk_id": "chunk-uuid",
           "chunk_index": 0,
           "page_number": 1,
           "text": "Verbatim text extracted from page 1..."
         }
       ]
     }
     ```

*Please review these answers in `docs/handoff/B-to-A.md`.*


---

## [Day 3] - Deploy and Proxy Runbook (Person B Frontend Action Items)

### 1. `vercel.json` Rewrite Configuration
To route frontend API requests seamlessly to the Render backend without CORS cookie issues or cross-site blocking, configure `vercel.json` in your frontend root:
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://studydungeon-api.onrender.com/:path*"
    }
  ]
}
```
*(Replace `https://studydungeon-api.onrender.com` with the actual deployed Render backend URL).*

### 2. Frontend Environment Variables
Set the following environment variables in your Vercel deployment dashboard:
- `VITE_API_BASE=/api` (or `/` if using direct proxy rewrites)
- `VITE_USE_MOCKS=false` (switches from local mocks to real live backend calls)

### 3. Free-Host Cold-Start Handling
Render free-tier web services spin down after 15 minutes of inactivity:
- When the player visits the app or clicks "Try Demo", ping `GET /health` with a lightweight 5-second polling retry loop and exponential backoff.
- Display a gothic retro *"Waking the Dungeon..."* splash screen with a loading spinner.
- As soon as `GET /health` returns `{ "status": "healthy" }`, call `POST /demo/session` to obtain a guest session cookie, then transition into the game view.
