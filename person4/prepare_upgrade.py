"""Configure the unified server without re-entering or printing the existing key."""
from pathlib import Path


def main():
    path = Path(__file__).parent / ".env"
    lines = path.read_text().splitlines() if path.exists() else []
    # Explicit free-tier-eligible model; billing status remains a project setting.
    lines = [s for s in lines if not s.strip().startswith(("PORT=", "GEMINI_MODEL="))]
    lines += ["PORT=8000", "GEMINI_MODEL=gemini-3.8-flash"]
    path.write_text("\n".join(lines) + "\n")
    path.chmod(0o600)
    print("Unified port set to 8000; Gemini model set to gemini-3.8-flash. Existing key preserved.")
    print("Use a Gemini project on the free tier; configuring a model cannot turn off paid-project billing.")


if __name__ == "__main__":
    main()
