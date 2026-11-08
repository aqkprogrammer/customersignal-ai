"""Password hashing, JWT issuing/verification, opaque tokens and credential encryption."""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import jwt
from cryptography.fernet import Fernet, InvalidToken
from pwdlib import PasswordHash

from app.core.config import settings

_hasher = PasswordHash.recommended()
JWT_ALG = "HS256"
Audience = Literal["user", "admin"]


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, hashed: str | None) -> bool:
    if not hashed:
        # Constant-ish time: still run a hash to avoid user enumeration through timing.
        _hasher.verify(password, _DUMMY_HASH)
        return False
    try:
        return _hasher.verify(password, hashed)
    except Exception:
        return False


_DUMMY_HASH = _hasher.hash("dummy-password-for-timing")


def utcnow() -> datetime:
    return datetime.now(UTC)


def create_access_token(subject: str, audience: Audience, extra: dict[str, Any] | None = None,
                        ttl: timedelta | None = None) -> str:
    now = utcnow()
    payload: dict[str, Any] = {
        "sub": subject,
        "aud": audience,
        "iat": int(now.timestamp()),
        "exp": int((now + (ttl or timedelta(minutes=settings.access_token_ttl_minutes))).timestamp()),
        "jti": secrets.token_hex(8),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.app_secret_key, algorithm=JWT_ALG)


def decode_access_token(token: str, audience: Audience) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, settings.app_secret_key, algorithms=[JWT_ALG], audience=audience)
    except jwt.PyJWTError:
        return None


def generate_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def hash_token(token: str) -> str:
    """Opaque tokens (refresh, reset, verification, invitations, API keys) are stored as HMAC digests."""
    return hmac.new(settings.app_secret_key.encode(), token.encode(), hashlib.sha256).hexdigest()


def sign_value(value: str) -> str:
    sig = hmac.new(settings.app_secret_key.encode(), value.encode(), hashlib.sha256).hexdigest()[:32]
    return f"{value}.{sig}"


def unsign_value(signed: str) -> str | None:
    value, _, sig = signed.rpartition(".")
    if not value:
        return None
    expected = hmac.new(settings.app_secret_key.encode(), value.encode(), hashlib.sha256).hexdigest()[:32]
    return value if hmac.compare_digest(sig, expected) else None


def _fernet() -> Fernet:
    key = base64.urlsafe_b64encode(hashlib.sha256(("enc:" + settings.app_secret_key).encode()).digest())
    return Fernet(key)


def encrypt_secret(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt_secret(ciphertext: str) -> str | None:
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken:
        return None


def password_strength_errors(password: str) -> list[str]:
    errors = []
    if len(password) < 10:
        errors.append("Password must be at least 10 characters.")
    if not any(c.isalpha() for c in password) or not any(c.isdigit() for c in password):
        errors.append("Password must contain letters and numbers.")
    return errors
