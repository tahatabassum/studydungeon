import json
import os
import sys
from pathlib import Path

# Ensure backend root is on sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.demo.seed import DEMO_DATA

# Target output path: docs/handoff/demo_dungeon.sample.json
ROOT_DIR = BACKEND_DIR.parent
OUTPUT_FILE = ROOT_DIR / "docs" / "handoff" / "demo_dungeon.sample.json"

sample_export = {
    "title": DEMO_DATA["title"],
    "version": "1.0",
    "theme": "haunted_library",
    "rooms": [
        {
            "order": idx,
            "topic": t["name"],
            "monster": t["monster_type"],
            "hp": t["monster_hp"],
            "questions": t["questions"],
        }
        for idx, t in enumerate(DEMO_DATA["topics"])
    ],
}

os.makedirs(OUTPUT_FILE.parent, exist_ok=True)
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(sample_export, f, indent=2)

print(f"Sample demo dungeon successfully written to: {OUTPUT_FILE}")
