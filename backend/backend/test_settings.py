from .settings import *  # noqa: F401,F403

# Use SQLite for faster, container-friendly test runs.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "test_db.sqlite3",
    }
}