"""
부모 PIN 암호화 공용 모듈

- 평문 저장 금지: pbkdf2(sha256, 100k회) + 랜덤 salt
- 저장 형식: "salt_hex$hash_hex"
- 프로필별 PIN(profiles.parent_pin)에 사용 — 멀티테넌시(가정별 격리)
"""

import os
import hmac
import hashlib

from fastapi import HTTPException

_ITERATIONS = 100_000


def hash_pin(pin: str, salt: "bytes | None" = None) -> str:
    if salt is None:
        salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", pin.encode(), salt, _ITERATIONS)
    return f"{salt.hex()}${dk.hex()}"


def verify_pin(pin: str, stored: str) -> bool:
    try:
        salt_hex, hash_hex = stored.split("$", 1)
        dk = hashlib.pbkdf2_hmac("sha256", pin.encode(), bytes.fromhex(salt_hex), _ITERATIONS)
        return hmac.compare_digest(dk.hex(), hash_hex)
    except Exception:
        return False


def validate_pin(pin: str) -> None:
    if not (isinstance(pin, str) and len(pin) == 4 and pin.isdigit()):
        raise HTTPException(status_code=400, detail="PIN은 숫자 4자리여야 해요.")
