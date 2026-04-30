import hashlib
import hmac
import secrets
from datetime import datetime, timedelta
from app.core.config import SESSION_EXPIRE_SECONDS

PBKDF2_ITERATIONS = 260_000
PBKDF2_ALGORITHM = "sha256"
PBKDF2_PREFIX = "pbkdf2_sha256"


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        PBKDF2_ALGORITHM,
        password.encode(),
        salt.encode(),
        PBKDF2_ITERATIONS,
    ).hex()
    return f"{PBKDF2_PREFIX}${PBKDF2_ITERATIONS}${salt}${digest}"


def create_session_id() -> str:
    return secrets.token_hex(32)


def verify_password(plain: str, hashed: str) -> bool:
    if hashed.startswith(f"{PBKDF2_PREFIX}$"):
        try:
            _, iterations_text, salt, expected = hashed.split("$", 3)
            digest = hashlib.pbkdf2_hmac(
                PBKDF2_ALGORITHM,
                plain.encode(),
                salt.encode(),
                int(iterations_text),
            ).hex()
            return hmac.compare_digest(digest, expected)
        except (ValueError, TypeError):
            return False
    # 兼容早期版本的 SHA-256 存量密码，登录成功后会自动升级。
    legacy_digest = hashlib.sha256(plain.encode()).hexdigest()
    return hmac.compare_digest(legacy_digest, hashed)


def password_needs_rehash(hashed: str) -> bool:
    if not hashed.startswith(f"{PBKDF2_PREFIX}$"):
        return True
    try:
        _, iterations_text, _, _ = hashed.split("$", 3)
        return int(iterations_text) < PBKDF2_ITERATIONS
    except (ValueError, TypeError):
        return True


def make_expires_at() -> datetime:
    return datetime.utcnow() + timedelta(seconds=SESSION_EXPIRE_SECONDS)
