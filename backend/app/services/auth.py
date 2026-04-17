import hashlib
import secrets
from datetime import datetime, timedelta
from app.core.config import SESSION_EXPIRE_SECONDS


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def create_session_id() -> str:
    return secrets.token_hex(32)


def verify_password(plain: str, hashed: str) -> bool:
    return hash_password(plain) == hashed


def make_expires_at() -> datetime:
    return datetime.utcnow() + timedelta(seconds=SESSION_EXPIRE_SECONDS)
