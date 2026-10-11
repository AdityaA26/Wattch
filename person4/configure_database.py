"""Hidden entry for a Tiger Cloud PostgreSQL URI, or switch to free local SQLite."""
from getpass import getpass
from pathlib import Path
from urllib.parse import urlsplit


def main():
    print("Optional Tiger Data setup. Paste the PostgreSQL connection URI at the hidden prompt.")
    print("A blank entry selects local SQLite. This does not migrate existing data.")
    uri = getpass("Tiger Data connection URI: ").strip()
    if uri:
        try:
            p = urlsplit(uri)
            if p.scheme not in ("postgres", "postgresql") or not p.hostname or not p.username or not p.password or not p.path.strip("/"):
                raise ValueError()
            if any(c.isspace() for c in uri):
                raise ValueError()
        except ValueError:
            raise SystemExit("Invalid URI. Copy the PostgreSQL URI from your service's connection details; it was not printed.")
    path = Path(__file__).parent / ".env"
    lines = path.read_text().splitlines() if path.exists() else []
    lines = [s for s in lines if not s.strip().startswith("DATABASE_URL=")]
    lines.append("DATABASE_URL=" + uri)
    path.write_text("\n".join(lines) + "\n")
    path.chmod(0o600)
    print("Configuration saved. Storage:", "Tiger Data" if uri else "SQLite")
    print("Next: python3 -m person4.seed_demo; then python3 -m person4.server")


if __name__ == "__main__":
    main()
