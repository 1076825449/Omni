import os

SECRET_KEY = os.getenv("SECRET_KEY", "omni-platform-dev-secret-change-in-prod")
SESSION_COOKIE_NAME = "omni_session"
SESSION_EXPIRE_SECONDS = 7 * 24 * 60 * 60  # 7 days
APP_ENV = os.getenv("APP_ENV", "development").lower()
AUTH_COOKIE_SECURE = os.getenv(
    "AUTH_COOKIE_SECURE",
    "true" if APP_ENV == "production" else "false",
).lower() in {"1", "true", "yes", "on"}
