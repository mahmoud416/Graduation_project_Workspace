"""
Credential registry — writes plaintext login credentials to a local file
whenever a new account is created (seed data, registration, or admin create).
"""
import os
from datetime import datetime, timezone
from pathlib import Path


CREDENTIALS_DIR = Path(__file__).resolve().parents[3] / "credentials"
CREDENTIALS_FILE = CREDENTIALS_DIR / "credentials.txt"


def _ensure_file() -> None:
    CREDENTIALS_DIR.mkdir(parents=True, exist_ok=True)
    if not CREDENTIALS_FILE.exists():
        CREDENTIALS_FILE.write_text(
            "# Orbit Workspace — Account Credentials Registry\n"
            "# DO NOT COMMIT THIS FILE\n"
            "# Generated automatically on account creation\n\n",
            encoding="utf-8",
        )


def append_credential(
    name: str,
    email: str,
    role: str,
    password: str,
    created_at: datetime | None = None,
) -> None:
    """Append one account's plain-text credentials to the registry file."""
    _ensure_file()
    ts = (created_at or datetime.now(timezone.utc)).strftime("%Y-%m-%d %H:%M UTC")
    entry = (
        f"---\n"
        f"Name: {name}\n"
        f"Email: {email}\n"
        f"Role: {role}\n"
        f"Password: {password}\n"
        f"Created At: {ts}\n"
        f"----------------\n\n"
    )
    with CREDENTIALS_FILE.open("a", encoding="utf-8") as fh:
        fh.write(entry)


def read_credentials() -> str:
    """Return the full credentials file as a string, or empty string if missing."""
    _ensure_file()
    return CREDENTIALS_FILE.read_text(encoding="utf-8")
