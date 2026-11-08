# Design: Backend 05 — Demo Dungeon Seed & "Try the Demo" Backend

## 1. Modules & Structure
- `app/demo/seed.py`: Idempotent seeding routine for the public demo dungeon.
- `app/api/auth.py`: `POST /demo/session` guest creation and lazy purge hook.
- `scripts/purge_guests.py`: CLI command for automated or manual expired guest cleanup.
- `scripts/export_sample.py`: Offline fallback generator writing `docs/handoff/demo_dungeon.sample.json`.

## 2. Seed Data Architecture (Zero AI Costs)
- Subject: *"Computer Systems & Architecture"*
- Topic 1: Central Processing Unit (CPU) vs *Silicon Golem* (80 HP)
- Topic 2: Primary & Secondary Storage vs *Memory Wraith* (90 HP)
- Topic 3: Computer Networking & Protocols vs *Packet Spectre* (85 HP)
- Topic 4: Von Neumann Architecture vs *The Exam Warden (Boss)* (220 HP)
- Every question includes pre-verified source chunk text and exact verbatim `evidence_quote`.
- Flagged with `is_public_demo = True`.

## 3. Guest Lifecycle & Expiration Strategy
1. **Public Creation:**
   - Unauthenticated `POST /demo/session` creates a user with `is_guest=true` and `expires_at = now() + 24 hours`.
   - Rate limited to 60 requests/hour per IP (using `X-Forwarded-For`).
2. **Access Isolation:**
   - Demo dungeon is globally readable by all authenticated users and guests.
   - All `GameRun`, `Attempt`, and `UserProgress` records remain privately scoped to the guest's `user_id`.
3. **Three-Tier Guest Purge (No Host Cron Dependency):**
   - **Tier 1 (Lazy Purge):** `POST /demo/session` triggers an asynchronous cleanup deleting expired guests (`expires_at < now()`) and cascading their runs.
   - **Tier 2 (CLI Utility):** `python -m scripts.purge_guests` executes transactional cleanup.
   - **Tier 3 (GitHub Actions):** Daily cron workflow calls cleanup endpoint with an admin bearer token.

## 4. Implementation Status
- **Implemented:**
  - Seed function `seed_demo_dungeon` in `app/demo/seed.py`.
  - `POST /demo/session` endpoint creating guest and returning `dungeon_id`.
  - Sample export script `backend/scripts/export_sample.py` generating `docs/handoff/demo_dungeon.sample.json`.
  - Unit tests in `tests/test_demo.py`.
- **Missing / Pending:**
  - Automated invocation of `seed_demo_dungeon` on deployment / startup.
  - Dedicated `scripts/purge_guests.py` CLI script.
  - Lazy purge execution inside `POST /demo/session`.
  - GitHub Actions scheduled workflow for daily purge.

## 5. Test Strategy
- Unit tests verifying guest session creation, expiry timestamp setting, and demo dungeon resolution.
- Integration tests ensuring guest runs and attempts cannot be read by another guest or registered user.

