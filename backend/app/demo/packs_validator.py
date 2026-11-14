import json
from pathlib import Path

PACKS_DIR = Path(__file__).parent / "packs"


def validate_pack_data(pack: dict) -> None:
    required_keys = ["id", "order", "title", "description", "floors_total", "floors", "final_boss", "final_boss_room"]
    for k in required_keys:
        if k not in pack:
            raise ValueError(f"Pack {pack.get('id', 'unknown')} missing key '{k}'")

    if not isinstance(pack["floors"], list) or len(pack["floors"]) == 0:
        raise ValueError(f"Pack {pack['id']} has no floors")

    seen_q_ids = set()
    for f_idx, floor in enumerate(pack["floors"], start=1):
        if floor.get("index") != f_idx:
            raise ValueError(f"Pack {pack['id']} floor index must be sequential, got {floor.get('index')} expected {f_idx}")
        for room in floor.get("rooms", []):
            for q in room.get("questions", []):
                q_id = q["id"]
                if q_id in seen_q_ids:
                    raise ValueError(f"Duplicate question id {q_id} in pack {pack['id']}")
                seen_q_ids.add(q_id)
                options = q.get("options", [])
                if len(options) < 2:
                    raise ValueError(f"Question {q_id} in pack {pack['id']} must have at least 2 options")
                correct = q.get("correct_option")
                if not isinstance(correct, int) or correct < 0 or correct >= len(options):
                    raise ValueError(f"Question {q_id} in pack {pack['id']} invalid correct_option {correct}")
                if not q.get("evidence_quote") or not q.get("evidence_quote").strip():
                    raise ValueError(f"Question {q_id} in pack {pack['id']} missing evidence_quote")
                if not q.get("explanation") or not q.get("explanation").strip():
                    raise ValueError(f"Question {q_id} in pack {pack['id']} missing explanation")

    final_room = pack.get("final_boss_room", {})
    for q in final_room.get("questions", []):
        q_id = q["id"]
        if q_id in seen_q_ids:
            raise ValueError(f"Duplicate question id {q_id} in pack {pack['id']} final boss room")
        seen_q_ids.add(q_id)
        options = q.get("options", [])
        if len(options) < 2:
            raise ValueError(f"Question {q_id} in final boss room must have at least 2 options")
        correct = q.get("correct_option")
        if not isinstance(correct, int) or correct < 0 or correct >= len(options):
            raise ValueError(f"Question {q_id} invalid correct_option {correct}")
        if not q.get("evidence_quote") or not q.get("evidence_quote").strip():
            raise ValueError(f"Question {q_id} missing evidence_quote")


def load_all_packs() -> list[dict]:
    all_packs = []
    for p_file in sorted(PACKS_DIR.glob("pack-*.json")):
        with open(p_file, "r", encoding="utf-8") as f:
            pack_list = json.load(f)
            for p in pack_list:
                validate_pack_data(p)
                all_packs.append(p)
    all_packs.sort(key=lambda x: x["order"])
    return all_packs


if __name__ == "__main__":
    packs = load_all_packs()
    print(f"Validated {len(packs)} content packs successfully.")

