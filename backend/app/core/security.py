import base64
import hashlib
import hmac
import json
import time
from typing import Optional

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.config import settings

ph = PasswordHasher()

# Precomputed dummy hash for constant-time comparison when user is not found
DUMMY_ARGON2_HASH = ph.hash("non_existent_timing_defense_password_dummy")


def hash_password(password: str) -> str:
    return ph.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    try:
        return ph.verify(hashed_password, password)
    except VerifyMismatchError:
        return False
    except Exception:
        return False


def create_session_token(
    user_id: str,
    session_version: int = 1,
    is_guest: bool = False,
    expires_in_seconds: int = 2592000,  # 30 days default
) -> str:
    payload = {
        "sub": user_id,
        "v": session_version,
        "guest": is_guest,
        "exp": int(time.time()) + expires_in_seconds,
    }
    payload_bytes = json.dumps(payload).encode("utf-8")
    payload_b64 = base64.urlsafe_b64encode(payload_bytes).decode("utf-8").rstrip("=")
    signature = hmac.new(settings.SECRET_KEY.encode("utf-8"), payload_b64.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{payload_b64}.{signature}"


def verify_session_token(token: str) -> Optional[dict]:
    try:
        parts = token.split(".")
        if len(parts) != 2:
            return None
        payload_b64, signature = parts
        expected_sig = hmac.new(settings.SECRET_KEY.encode("utf-8"), payload_b64.encode("utf-8"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected_sig):
            return None

        # Add padding back
        padding = "=" * (4 - (len(payload_b64) % 4)) if len(payload_b64) % 4 != 0 else ""
        payload_json = base64.urlsafe_b64decode(payload_b64 + padding).decode("utf-8")
        payload = json.loads(payload_json)

        if payload.get("exp", 0) < time.time():
            return None

        return payload
    except Exception:
        return None
