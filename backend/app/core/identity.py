import re
import secrets
import unicodedata
from typing import Tuple

RESERVED_NAMES = {
    "admin",
    "administrator",
    "mod",
    "moderator",
    "staff",
    "support",
    "system",
    "root",
    "official",
    "studydungeon",
    "kiro",
    "ghostrival",
    "ghost_rival",
    "guest",
    "anonymous",
    "null",
    "undefined",
    "examwarden",
}

PROFANE_WORDS = {
    "fuck",
    "shit",
    "bitch",
    "asshole",
    "cunt",
    "dick",
    "bastard",
    "nigger",
    "faggot",
}

LOOKALIKES = {
    "0": "o",
    "1": "i",
    "3": "e",
    "4": "a",
    "5": "s",
    "7": "t",
    "@": "a",
    "$": "s",
}


def normalize_display_name_for_moderation(name: str) -> str:
    # NFKC normalize and lower
    normalized = unicodedata.normalize("NFKC", name).lower()
    for char, mapped in LOOKALIKES.items():
        normalized = normalized.replace(char, mapped)
    # Remove separators
    cleaned = re.sub(r"[\s_\-]+", "", normalized)
    return cleaned


def validate_display_name(name: str) -> Tuple[bool, str, str]:
    """
    Returns (is_valid, reason, message)
    reason in: 'too_short', 'too_long', 'characters', 'not_allowed', ''
    """
    if not name:
        return False, "too_short", "Name must be at least 3 characters."

    trimmed = name.strip()
    norm = unicodedata.normalize("NFKC", trimmed)

    if len(norm) < 3:
        return False, "too_short", "Name must be at least 3 characters."
    if len(norm) > 16:
        return False, "too_long", "Name must be at most 16 characters."

    # Must start and end with alphanumeric
    if not norm[0].isalnum() or not norm[-1].isalnum():
        return False, "characters", "Name must start and end with a letter or digit."

    # Allowed chars: letters, digits, space, _ and -
    if not re.match(r"^[A-Za-z0-9 _\-]+$", norm):
        return False, "characters", "Allowed characters: letters, digits, spaces, _ and -."

    # No two consecutive spaces
    if "  " in norm:
        return False, "characters", "Consecutive spaces are not allowed."

    # Moderation check: whole word matching / exact normalized equality
    mod_check = normalize_display_name_for_moderation(norm)

    # 1. Exact match against reserved names
    if mod_check in RESERVED_NAMES:
        return False, "not_allowed", "That name is not available. Try another."

    # 2. Tokenized word-boundary match (e.g. "ghost rival" or separate tokens)
    tokens = re.findall(r"[a-z0-9]+", unicodedata.normalize("NFKC", trimmed).lower())
    for token in tokens:
        mapped_token = token
        for char, mapped in LOOKALIKES.items():
            mapped_token = mapped_token.replace(char, mapped)
        if mapped_token in RESERVED_NAMES or mapped_token in PROFANE_WORDS:
            return False, "not_allowed", "That name is not available. Try another."

    # 3. Profanity substring check (strict for slurs/severe profanity, but not blocking words like Dickens)
    for bad in PROFANE_WORDS:
        # Check as whole word token or explicit standalone sequence
        if bad in tokens:
            return False, "not_allowed", "That name is not available. Try another."
        if bad in ("fuck", "cunt", "nigger", "faggot") and bad in mod_check:
            return False, "not_allowed", "That name is not available. Try another."

    return True, "", ""


def generate_public_id() -> str:
    # e.g., "p_8f3k2m"
    return f"p_{secrets.token_hex(4)}"


def generate_guest_tag() -> str:
    # Random 4-digit tag
    return str(secrets.randbelow(9000) + 1000)
