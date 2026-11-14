# Spec Backend-08: Packs 1 to 3, Floors on Dungeons, and Unlock Flow

## 1. Overview & Goals
Implement preloaded content packs (Packs 1, 2, 3), dungeon floor representation, `GET /packs` endpoint, pack unlock mechanics, `PACK_LOCKED` 403 enforcement on `POST /runs`, and `pack_progress` on `POST /runs/{id}/finish`.

## 2. Requirements & API Contract
### 2.1 Content Packs (JSON & Idempotent Seeding)
- Pack 1: Computer Systems Crypt (Demo dungeon with 2 floors + Final Boss).
- Pack 2: Networking Catacombs (2 floors + Final Boss).
- Pack 3: Database Ossuary (2-3 floors + Final Boss).
- Seeded via versioned JSON files in `backend/app/demo/packs/pack-{1,2,3}.json`.
- Startup seed only overwrites if version updated or rows missing.
- Validator ensures question options >= 2, correct option in options, explanation and non-empty evidence quote present.
- NO AI CALLS to seed, serve, or play packs.

### 2.2 `GET /dungeons/{id}` Additions
- `rooms[].floor_id`: string or null.
- `rooms[].monster_kind`: string (e.g. `paper_wraith`, `memory_eater`, `gear_golem`, `exam_warden`).
- `floors`: array of `{ id, index, title, status, topics, boss, rank, room_ids }`.
- `final_boss`: `{ id, name, hp, unlocked }`.

### 2.3 `GET /packs`
- Public endpoint.
- Without session: pack 1 `available`, rest `locked`, 0 progress.
- With session: progress based on player's cleared rooms & boss clears.
- Response shape:
  ```json
  {
    "packs": [
      {
        "id": "pack-1",
        "order": 1,
        "title": "Computer Systems Crypt",
        "description": "CPU, memory and storage basics.",
        "dungeon_id": "...",
        "floors_total": 2,
        "floors_cleared": 0,
        "final_boss_cleared": false,
        "status": "available",
        "points_earned": 0
      }
    ],
    "next_pack_id": "pack-2",
    "all_completed": false
  }
  ```

### 2.4 Run Creation & Unlock Rules (`POST /runs`)
- If `dungeon_id` belongs to a preloaded pack, check if the pack is unlocked for the user.
- Pack N+1 requires pack N's final boss cleared.
- If locked, answer 403 with `{"detail": {"code": "PACK_LOCKED", "message": "Clear the previous dungeon's final boss to unlock it."}}`.

### 2.5 Run Finish (`POST /runs/{id}/finish`)
- When run belongs to a pack dungeon, include `pack_progress`:
  ```json
  {
    "pack_progress": {
      "pack_id": "pack-1",
      "status": "completed",
      "unlocked_pack_id": "pack-2",
      "all_completed": false
    }
  }
  ```

