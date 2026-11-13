"""Password hashing with scrypt and conservative input limits.

The format is self-describing so the parameters can be upgraded without
invalidating existing hashes: ``scrypt$n$r$p$salt$digest``.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets

ALGORITHM = "scrypt"
N = 2**14
R = 8
P = 1
DKLEN = 32
SALT_BYTES = 16
MIN_PASSWORD = 8
MAX_PASSWORD = 128


class PasswordPolicyError(ValueError):
    pass


def validate_password(password: str) -> None:
    if not isinstance(password, str):
        raise PasswordPolicyError("Enter a password.")
    if len(password) < MIN_PASSWORD:
        raise PasswordPolicyError(f"Password must be at least {MIN_PASSWORD} characters.")
    if len(password) > MAX_PASSWORD:
        raise PasswordPolicyError(f"Password must be at most {MAX_PASSWORD} characters.")
    if "\x00" in password:
        raise PasswordPolicyError("Password contains an unsupported character.")
    if password.strip() == "":
        raise PasswordPolicyError("Password cannot be only whitespace.")


def _b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii")


def _unb64(value: str) -> bytes:
    return base64.b64decode(value.encode("ascii"), validate=True)


def hash_password(password: str) -> str:
    validate_password(password)
    salt = secrets.token_bytes(SALT_BYTES)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=N, r=R, p=P, dklen=DKLEN)
    return f"{ALGORITHM}${N}${R}${P}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, encoded: str | None) -> bool:
    """Constant-time verification; malformed hashes fail closed."""
    if not encoded or not isinstance(password, str) or len(password) > MAX_PASSWORD:
        return False
    try:
        algorithm, n, r, p, salt, digest = encoded.split("$")
        if algorithm != ALGORITHM:
            return False
        expected = _unb64(digest)
        actual = hashlib.scrypt(
            password.encode("utf-8"),
            salt=_unb64(salt),
            n=int(n),
            r=int(r),
            p=int(p),
            dklen=len(expected),
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)
