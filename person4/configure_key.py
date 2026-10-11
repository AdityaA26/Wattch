"""Run: python3 -m person4.configure_key. Saves a key locally, never prints it."""
import getpass
from .settings import ROOT


def main():
    print("Gemini setup: paste your team's key at the next prompt, then press Enter.")
    print("Characters are hidden while you paste. A blank entry skips this setup.")
    try:
        key = getpass.getpass("Gemini API key: ").strip()
    except (EOFError, KeyboardInterrupt):
        print("\nSetup cancelled; existing configuration kept.")
        return
    if not key:
        print("Skipped. Backend works with labeled local explanations.")
        return
    if any(ch.isspace() for ch in key):
        raise SystemExit("Key contains whitespace. Run setup again and paste only the key.")
    path = ROOT / ".env"
    lines = path.read_text().splitlines() if path.exists() else []
    lines = [line for line in lines if not line.strip().startswith("GEMINI_API_KEY=")]
    lines.append("GEMINI_API_KEY=" + key)
    path.touch(mode=0o600, exist_ok=True)
    path.chmod(0o600)
    path.write_text("\n".join(lines) + "\n")
    print("Key saved in person4/.env (ignored by Git). No key was printed.")
    print("Next: python3 -m person4.api")
    print("Then use a second terminal: python3 -m person4.check")


if __name__ == "__main__":
    main()
