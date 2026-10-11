"""Explicit live database check. It neither prints nor records a connection URI."""
from .storage import Store


def main():
    try:
        store = Store()
        status = store.status()
        rows = store.readings("demo-home")
        if not rows:
            raise ValueError("Seed demo first")
        print(f"PASS: storage={status['backend']}; total readings={status['readingCount']}; demo records={len(rows)}")
        if store.backend == "tigerdata":
            print("PASS: LIVE TIGER DATA CONNECTION; hypertable initialization and time_bucket history query succeeded.")
        else:
            print("Local SQLite is active. Tiger Data is not connected and should not be claimed in your submission.")
    except Exception as exc:
        raise SystemExit(f"Database check failed ({type(exc).__name__}). Check configuration and seed demo first. Connection credentials were not printed.")


if __name__ == "__main__":
    main()
