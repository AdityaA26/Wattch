"""Insert explicitly synthetic household histories; safe to repeat.

Uses reserved demo-* IDs. Do not import personal data into those IDs.
"""
from datetime import date, timedelta
from .storage import Store


def demo_data(index, end=None):
    end = end or date.today()
    profile = {"householdId": "demo-home" if index == 0 else f"demo-peer-{index}",
               "occupants": 3, "floorAreaSqft": 1600, "peerOptIn": True,
               "region": "Columbia-SC", "startingSocPct": 30}
    readings = []
    for age in range(42):
        day = (end - timedelta(days=age)).isoformat()
        for utility, unit, base, rate in (("electricity", "kWh", 24, .18),
                ("water", "gal", 145, .006), ("gas", "therms", 1.2, 1.40)):
            value = base * (1 + index * .025 + ((age % 7) - 3) * .015)
            if index == 0 and age < 7:
                value *= 1.50 if utility == "water" else 1.35 if utility == "electricity" else 1
            readings.append({"date": day, "utility": utility, "unit": unit,
                "quantity": round(value, 4), "unitRateUsd": rate, "source": "simulated"})
    return profile, readings


def seed(store):
    for i in range(6):
        p, rows = demo_data(i)
        store.save_profile(p)
        store.import_readings(p["householdId"], rows)
    return store.status()


def main():
    try:
        s = seed(Store())
    except Exception as exc:
        raise SystemExit(f"Demo setup failed ({type(exc).__name__}). Check storage setup; credentials were not printed.")
    print(f"Saved six synthetic household histories. Storage={s['backend']}; total readings={s['readingCount']}.")
    print("No real meters, neighbors or utility accounts are connected. Demo IDs are reserved.")


if __name__ == "__main__":
    main()
