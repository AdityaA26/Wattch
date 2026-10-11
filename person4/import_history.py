"""Import daily consumption from JSON or CSV: HOUSEHOLD_ID PATH."""
import argparse
import csv
import json
from pathlib import Path
from .storage import Store


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("household_id")
    parser.add_argument("path", type=Path)
    args = parser.parse_args()
    try:
        if args.path.stat().st_size > 1_000_000:
            raise ValueError("File exceeds 1 MB")
        if args.path.suffix.lower() == ".csv":
            with args.path.open(newline="") as f:
                rows = list(csv.DictReader(f))
            for r in rows:
                r["quantity"] = float(r["quantity"])
                r["unitRateUsd"] = float(r["unitRateUsd"]) if r.get("unitRateUsd") else None
        else:
            rows = json.loads(args.path.read_text())
            if isinstance(rows, dict): rows = rows["readings"]
        result = Store().import_readings(args.household_id, rows)
    except (ValueError, KeyError, OSError) as exc:
        # File errors are described without printing imported content.
        raise SystemExit(f"Import failed ({type(exc).__name__}). Check profile, column names, numeric values, units and dates.")
    except Exception as exc:
        raise SystemExit(f"Storage unavailable ({type(exc).__name__}). Credentials were not printed.")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
