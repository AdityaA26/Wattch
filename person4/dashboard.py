"""One stored household history for the dashboard, bills and AI evidence."""
import threading
from datetime import date, timedelta
from .calculations import numeric
from .history import UNITS
from .usage_insights import household_report

_LOCK = threading.Lock()
FIXED_FEES = {"electricity": 26.0, "water": 21.8, "gas": 20.7}


def demo_readings(profile, monthly_kwh, end=None):
    """Deterministic demonstration data; never presented as connected meters."""
    end = end or date.today()
    rows = []
    bases = {"electricity": (monthly_kwh / 30, .18),
             "water": (145 * profile["occupants"] / 3, .006),
             "gas": (1.2 * profile["floorAreaSqft"] / 2100, 1.4)}
    for age in range(186):
        day = (end - timedelta(days=age)).isoformat()
        for utility, (base, rate) in bases.items():
            increase = (1.5 if utility == "water" else 1.35 if utility == "electricity" else 1) if age < 7 else 1
            rows.append({"date": day, "utility": utility, "unit": UNITS[utility],
                         "quantity": round(base * (1 + ((age % 7) - 3) * .015) * increase, 4),
                         "unitRateUsd": rate, "source": "simulated"})
    return rows


def billing(rows):
    result = []
    for utility in UNITS:
        items = [r for r in rows if r["utility"] == utility]
        if not items:
            result.append({"utility": utility, "status": "no_data", "bills": []})
            continue
        end = date.fromisoformat(max(r["date"] for r in items))
        by_day = {r["date"]: r for r in items}
        bills = []
        for offset in reversed(range(6)):
            last = end - timedelta(days=offset * 30)
            first = last - timedelta(days=29)
            window = [by_day[d.isoformat()] for d in (first + timedelta(days=i) for i in range(30)) if d.isoformat() in by_day]
            complete = len(window) == 30
            rates_known = bool(window) and all(r["unitRateUsd"] is not None for r in window)
            variable = sum(r["quantity"] * r["unitRateUsd"] for r in window) if rates_known else None
            sources = {r["source"] for r in window}
            # Fixed fees are sample assumptions, never imported utility invoices.
            bills.append({"startDate": first.isoformat(), "endDate": last.isoformat(),
                          "daysAvailable": len(window), "complete": complete,
                          "source": next(iter(sources)) if len(sources) == 1 else "mixed" if sources else "no_data",
                          "quantity": sum(r["quantity"] for r in window) if window else None,
                          "variableCostUsd": variable, "fixedCostUsd": FIXED_FEES[utility],
                          "totalCostUsd": variable + FIXED_FEES[utility] if complete and variable is not None else None})
        current = bills[-1]
        result.append({"utility": utility, "status": "complete" if current["complete"] else "partial",
                       "unit": UNITS[utility], "bills": bills, **current,
                       "note": "30-day demo bill estimates from saved daily readings and illustrative fixed fees; not provider invoices."})
    return result


def dashboard(store, raw):
    if not isinstance(raw.get("profile"), dict):
        raise ValueError("Supply a household profile")
    initialize = raw.get("initializeDemo", False)
    if type(initialize) is not bool:
        raise ValueError("initializeDemo must be a boolean")
    monthly = numeric(raw.get("monthlyElectricKwh", 624), 0, 20000, "monthlyElectricKwh")
    # Initialize only an empty history. Refreshes and profile edits preserve imports.
    with _LOCK:
        profile = store.save_profile(raw["profile"])
        ident = profile["householdId"]
        rows = store.readings(ident)
        if not rows and initialize:
            store.import_readings(ident, demo_readings(profile, monthly))
            rows = store.readings(ident)
    sources = {r["source"] for r in rows}
    return {"householdId": ident, "profile": profile, "readings": rows,
            "report": household_report(store, ident), "billing": billing(rows),
            "source": "simulated" if sources == {"simulated"} else "user_import" if sources == {"observed"} else "mixed" if sources else "no_data",
            "note": "Demo readings are created only for an empty home. Editing settings does not rewrite saved history."}
