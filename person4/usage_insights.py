"""Transparent daily usage signals. Flag possible causes, never diagnose devices."""
from datetime import date, timedelta
from statistics import mean, pstdev
from .history import UNITS

ADVICE = {
    "electricity": ["Compare thermostat settings, HVAC runtime and recent EV charging with your previous weeks.",
                    "Where your tariff is cheaper off-peak, move flexible charging or laundry into that window."],
    "water": ["Check irrigation schedules, running toilets and changes in household occupancy.",
              "If usage stays high, inspect fixtures or ask your water provider about a meter check."],
    "gas": ["Compare heating settings, outdoor temperature and hot-water demand with previous weeks.",
            "Consider insulation and draft checks before assuming an appliance fault."],
}


def utility_summary(rows, utility, end=None):
    items = {r["date"]: r for r in rows if r["utility"] == utility}
    if not items:
        return {"utility": utility, "status": "no_data", "unit": UNITS[utility]}
    end = end or max(items)
    last = date.fromisoformat(end)
    dates = [(last - timedelta(days=i)).isoformat() for i in range(28)]
    missing = [d for d in dates if d not in items]
    window = [items[d] for d in dates if d in items]
    sources = sorted({r["source"] for r in window})
    out = {"utility": utility, "unit": UNITS[utility], "endDate": end,
           "source": sources[0] if len(sources) == 1 else "mixed",
           "observationsVerified": False, "daysAvailable": len(window),
           "missingDays": len(missing), "hourlyLeakDetectionAvailable": False}
    if missing or len(sources) != 1:
        return dict(out, status="insufficient_comparable_data",
                    explanation="Need 28 consecutive days from one data source; missing days are not zero usage.")
    recent, baseline = window[:7], window[7:]
    current = mean(r["quantity"] for r in recent)
    normal = mean(r["quantity"] for r in baseline)
    delta = current - normal
    percent = delta / normal * 100 if normal else None
    spread = max(pstdev(r["quantity"] for r in baseline), normal * .1, .001)
    unusual = normal > 0 and delta > normal * .3 and delta / spread > 3
    out.update(status="possible_unusual_increase" if unusual else "no_large_increase_detected",
        recentDailyAverage=current, baselineDailyAverage=normal, changePct=percent,
        recentTotal=sum(r["quantity"] for r in recent), possibleCauses=ADVICE[utility] if unusual else [],
        habitSuggestions=ADVICE[utility],
        method="Last 7 days versus preceding 21 days; flag only when increase exceeds 30% and 3 baseline standard deviations (10% mean floor). Not weather-adjusted.")
    if all(r["unitRateUsd"] is not None for r in window):
        prev_rate = mean(r["unitRateUsd"] for r in baseline)
        recent_variable = sum(r["quantity"] * r["unitRateUsd"] for r in recent)
        expected = mean(r["quantity"] * r["unitRateUsd"] for r in baseline) * 7
        # Exact decomposition: hold the OLD average rate for the usage component.
        usage_effect = sum(r["quantity"] for r in recent) * prev_rate - expected
        out["costInsights"] = {"recentVariableCostUsd": recent_variable,
            "baselineEquivalent7DayCostUsd": expected, "differenceUsd": recent_variable - expected,
            "usageComponentUsd": usage_effect, "rateComponentUsd": recent_variable - expected - usage_effect,
            "note": "Supplied per-unit rates only; excludes fixed fees, taxes, tiered charges and full-bill reconciliation."}
    else:
        out["costInsights"] = {"status": "rate_missing", "note": "No dollar estimate without supplied rates."}
    return out


def peer_comparison(store, target, utility, summary, cache=None):
    if not target["peerOptIn"]:
        return {"status": "not_opted_in"}
    if summary.get("status") in ("no_data", "insufficient_comparable_data"):
        return {"status": "insufficient_data"}
    values = []
    cache = {} if cache is None else cache
    profiles = cache.setdefault("profiles", store.peer_profiles()) if "profiles" not in cache else cache["profiles"]
    for peer in profiles:
        if peer["householdId"] == target["householdId"] or not peer["peerOptIn"]:
            continue
        if peer["region"] != target["region"] or peer["timezone"] != target["timezone"] or abs(peer["occupants"] - target["occupants"]) > 1:
            continue
        if not .75 <= peer["floorAreaSqft"] / target["floorAreaSqft"] <= 1.25:
            continue
        key = peer["householdId"]
        if key not in cache:
            cache[key] = store.readings(key)
        p = utility_summary(cache[key], utility, summary["endDate"])
        if p.get("status") not in ("no_data", "insufficient_comparable_data") and p["source"] == summary["source"]:
            values.append(p["recentDailyAverage"])
    if len(values) < 5:
        return {"status": "insufficient_cohort", "minimumOtherHouseholds": 5,
                "note": "Need five opted-in households with aligned dates/source, similar size and occupancy in the same supplied region."}
    avg = mean(values)
    return {"status": "available", "sampleSize": len(values), "source": summary["source"],
        "peerDailyAverage": avg, "householdDailyAverage": summary["recentDailyAverage"],
        "differencePct": (summary["recentDailyAverage"] / avg - 1) * 100 if avg else None,
        "note": "Aggregate participating sample, not a verified neighborhood average; not adjusted for equipment or weather."}


def household_report(store, ident):
    p = store.get_profile(ident)
    rows = store.readings(ident)
    summaries = []
    peers = {}
    for utility in UNITS:
        s = utility_summary(rows, utility)
        s["peerComparison"] = peer_comparison(store, p, utility, s, peers)
        summaries.append(s)
    return {"householdId": ident, "storage": store.backend, "utilities": summaries,
        "limitations": ["Daily imports are not live smart-meter telemetry.",
            "Unusual use suggests checks; it does not identify an appliance fault or gas leak.",
            "Observed imports are supplied by the user and unverified; simulated data remains labeled."]}
