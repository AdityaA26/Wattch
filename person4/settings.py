"""Read terminal configuration and the locally saved person4/.env file."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ALLOWED = {"GEMINI_API_KEY", "GEMINI_MODEL", "PORT", "FRONTEND_ORIGIN", "DATABASE_URL", "WATTCH_DB_PATH"}


def settings():
    result = {k: os.getenv(k, "") for k in ALLOWED}
    path = ROOT / ".env"
    if path.exists():
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            if key.strip() in ALLOWED:
                result[key.strip()] = value.strip().strip('\"\'')
    return result
