"""Evaluate team-supplied schedules. This module does not schedule batteries."""
import math
from datetime import date
from uuid import uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

DEFAULTS = {
    "capacityKwh": 13.5, "initialSocPct": 60, "reservePct": 20,
    "backupHours": 8, "essentialLoadKw": .55,
    "maxChargeKw": 3, "maxDischargeKw": 3,
    "chargeEfficiency": .95, "dischargeEfficiency": .95,
    "wearUsdPerKwh": .02,
}
BOUNDS = {
    "capacityKwh": (1, 100), "initialSocPct": (0, 100), "reservePct": (0, 100),
    "backupHours": (0, 72), "essentialLoadKw": (.01, 20),
    "maxChargeKw": (.01, 50), "maxDischargeKw": (.01, 50),
    "chargeEfficiency": (.1, 1), "dischargeEfficiency": (.1, 1),
    "wearUsdPerKwh": (0, 2),
}


def numeric(value, lo, hi, label):
    if isinstance(value, bool):
        raise ValueError(f"{label} must be numeric")
    try:
        value = float(value)
    except (ValueError, TypeError):
        raise ValueError(f"{label} must be numeric") from None
    if not math.isfinite(value) or not lo <= value <= hi:
        raise ValueError(f"{label} must be between {lo} and {hi}")
    return value


def evaluate(raw):
    if not isinstance(raw, dict):
        raise ValueError("Plan must be a JSON object")
    config = raw.get("config", {})
    if not isinstance(config, dict):
        raise ValueError("config must be an object")
    c = {k: numeric(config.get(k, DEFAULTS[k]), *BOUNDS[k], k) for k in DEFAULTS}
    asset_id = raw.get("assetId", "sample-home")
    if not isinstance(asset_id, str) or not 1 <= len(asset_id) <= 100:
        raise ValueError("assetId must be 1–100 characters")
    input_type = raw.get("inputType", "simulated")
    if input_type not in ("simulated", "forecast", "observed"):
        raise ValueError("inputType must be simulated, forecast or observed")
    day = raw.get("date")
    if day is not None:
        try:
            day = date.fromisoformat(day).isoformat()
        except (ValueError, TypeError):
            raise ValueError("date must be YYYY-MM-DD") from None
    timezone = raw.get("timezone", "America/New_York")
    if not isinstance(timezone, str):
        raise ValueError("timezone must be an IANA timezone name")
    try:
        ZoneInfo(timezone)
    except (ValueError, ZoneInfoNotFoundError):
        raise ValueError("Unknown timezone") from None
    if raw.get("currency", "USD") != "USD":
        raise ValueError("This backend uses USD only")
    context = raw.get("context", {})
    if not isinstance(context, dict):
        raise ValueError("context must be an object")
    clean_context = {}
    for k in ("weatherSummary", "forecastSource", "tariffSource", "eventSource"):
        text = context.get(k, "Not supplied")
        if not isinstance(text, str) or len(text) > 500:
            raise ValueError(f"context.{k} must be text, at most 500 characters")
        clean_context[k] = text

    start = c["capacityKwh"] * c["initialSocPct"] / 100
    desired = max(c["capacityKwh"] * c["reservePct"] / 100,
                  c["essentialLoadKw"] * c["backupHours"] / c["dischargeEfficiency"])
    floor = min(desired, c["capacityKwh"])
    power_ok = c["essentialLoadKw"] <= c["maxDischargeKw"]
    goal_ok = desired <= c["capacityKwh"] + 1e-5 and power_ok
    series = []
    for name in ("baseline", "schedule"):
        data = raw.get(name)
        if not isinstance(data, list) or len(data) != 24:
            raise ValueError(f"{name} must have exactly 24 one-hour rows")
        previous, rows = start, []
        for h, item in enumerate(data):
            if not isinstance(item, dict) or type(item.get("hour")) is not int or item["hour"] != h:
                raise ValueError(f"{name} rows must use integer hours 0–23 in order")
            event = item.get("gridEvent", False)
            if not isinstance(event, bool):
                raise ValueError("gridEvent must be true or false")
            row = {"hour": h, "gridEvent": event}
            for k in ("loadKw", "solarKw", "priceUsdPerKwh", "gridKw", "chargeKw", "dischargeKw", "storedKwh"):
                row[k] = numeric(item.get(k, 0) if k == "solarKw" else item.get(k), 0, 1000, k)
            ch, dis, stored = row["chargeKw"], row["dischargeKw"], row["storedKwh"]
            if ch > c["maxChargeKw"] + 1e-5 or dis > c["maxDischargeKw"] + 1e-5:
                raise ValueError("Battery power exceeds configured limits")
            if min(ch, dis) > 1e-5:
                raise ValueError("Simultaneous charging and discharging is not supported")
            net = max(0, row["loadKw"] - row["solarKw"])
            if abs(row["gridKw"] + dis - net - ch) > 1e-4:
                raise ValueError("Inconsistent grid energy balance")
            expected = previous + ch * c["chargeEfficiency"] - dis / c["dischargeEfficiency"]
            if abs(stored - expected) > 1e-4 or stored > c["capacityKwh"] + 1e-4:
                raise ValueError("Inconsistent stored battery energy or capacity")
            if previous >= floor - 1e-4 and stored < floor - 1e-4:
                raise ValueError("Schedule violates the required reserve")
            if previous < floor - 1e-4 and dis > 1e-5:
                raise ValueError("Battery discharges before restoring reserve")
            row["socPct"] = stored / c["capacityKwh"] * 100
            row["action"] = "charge" if ch > 1e-5 else "discharge" if dis > 1e-5 else "hold"
            rows.append(row)
            previous = stored
        series.append(rows)
    before, after = series
    for a, b in zip(before, after):
        if any(abs(a[k] - b[k]) > 1e-5 for k in ("loadKw", "solarKw", "priceUsdPerKwh")):
            raise ValueError("Comparison requires identical demand, solar and prices")
        if a["gridEvent"] != b["gridEvent"]:
            raise ValueError("Comparison requires identical event hours")
    if abs(before[-1]["storedKwh"] - after[-1]["storedKwh"]) > 1e-4:
        raise ValueError("Both battery cases must have identical ending energy")
    if after[-1]["storedKwh"] < max(start, floor) - 1e-4:
        raise ValueError("Ending energy must restore starting energy or the higher reserve")

    def cost(rows):
        grid = sum(r["gridKw"] * r["priceUsdPerKwh"] for r in rows)
        wear = sum(r["dischargeKw"] * c["wearUsdPerKwh"] for r in rows)
        return {"gridCostUsd": grid, "wearCostUsd": wear, "totalCostUsd": grid + wear}
    bc, pc = cost(before), cost(after)
    grid_only = sum(max(0, r["loadKw"] - r["solarKw"]) * r["priceUsdPerKwh"] for r in before)
    daily = bc["totalCostUsd"] - pc["totalCostUsd"]
    event_hours = [r["hour"] for r in after if r["gridEvent"]]
    avoided = sum(before[h]["gridKw"] - after[h]["gridKw"] for h in event_hours)
    warnings = ["Inputs are supplied by the team and have not been verified against a meter or utility bill."]
    if input_type == "simulated":
        warnings.append("Simulated data; demand, rates and events are illustrative.")
    if desired > c["capacityKwh"] + 1e-5:
        warnings.append("Backup goal exceeds battery energy capacity; reserve is capped at 100%.")
    if not power_ok:
        warnings.append("Essential load exceeds battery output power; it cannot support that load in an outage.")
    if start < floor - 1e-5:
        warnings.append("Reserve is not ready at the starting charge; charging is required first.")
    metrics = {
        "baselineCostUsd": bc["totalCostUsd"], "plannedCostUsd": pc["totalCostUsd"],
        "gridOnlyCostUsd": grid_only, "savingsVsBaselineUsd": daily,
        "savingsVsGridOnlyUsd": grid_only - pc["totalCostUsd"],
        "plannedGridCostUsd": pc["gridCostUsd"], "estimatedWearUsd": pc["wearCostUsd"],
        "reserveKwh": floor, "reservePct": floor / c["capacityKwh"] * 100,
        "currentBackupHours": start * c["dischargeEfficiency"] / c["essentialLoadKw"] if power_ok else 0,
        "reservedBackupHours": floor * c["dischargeEfficiency"] / c["essentialLoadKw"] if power_ok else 0,
        "backupGoalFeasible": goal_ok, "reserveReadyAtStart": start >= floor - 1e-5,
        "reserveReadyAtEnd": after[-1]["storedKwh"] >= floor - 1e-5,
        "startingStoredKwh": start, "endingStoredKwh": after[-1]["storedKwh"],
    }
    return {
        "planId": str(uuid4()), "assetId": asset_id, "date": day, "timezone": timezone,
        "inputType": input_type, "currency": "USD", "config": c, "context": clean_context,
        "savingsStatus": "calculated_from_supplied_observations" if input_type == "observed" else "projected",
        "metrics": metrics, "comparison": {
            "gridOnly": {"totalCostUsd": grid_only, "label": "Same household, without a battery"},
            "baselineBattery": dict(bc, label="Team-supplied baseline battery strategy"),
            "plannedBattery": dict(pc, label="Team-supplied planned battery strategy"),
        },
        "repeatDayProjection": {"dailyUsd": daily, "monthlyUsd": daily * 30, "annualUsd": daily * 365,
            "assumption": "Repeat this single day for 30/365 identical days. No seasonal forecast or savings guarantee."},
        "gridImpact": {"assetsRepresented": 1, "eventHours": event_hours,
            "eventEnergyAvoidedKwh": avoided,
            "baselinePeakKw": max(r["gridKw"] for r in before),
            "plannedPeakKw": max(r["gridKw"] for r in after),
            "eventBaselinePeakKw": max((before[h]["gridKw"] for h in event_hours), default=0),
            "eventPlannedPeakKw": max((after[h]["gridKw"] for h in event_hours), default=0)},
        "baseline": before, "schedule": after, "warnings": warnings,
        "assumptions": [
            "24 one-hour intervals; power kW, stored energy kWh, tariff USD/kWh.",
            "Both battery cases use the same household inputs and ending stored energy.",
            "No exports or solar-to-battery charging; surplus solar is curtailed.",
            "Costs exclude fixed/demand charges, taxes and battery purchase costs.",
            "Wear is a supplied allowance, not measured battery degradation.",
            "Backup assumes constant essential load and excludes inverter standby losses.",
            "Energy shifted during events does not establish a carbon reduction.",
        ],
    }


def community_report(raw):
    if not isinstance(raw, dict) or not isinstance(raw.get("plans"), list) or not 1 <= len(raw["plans"]) <= 20:
        raise ValueError("Supply plans: an array of 1–20 raw asset plans")
    plans = [evaluate(p) for p in raw["plans"]]
    first = plans[0]
    if not first["date"]:
        raise ValueError("Community aggregation requires a date for every plan")
    ids = [p["assetId"] for p in plans]
    if len(set(ids)) != len(ids):
        raise ValueError("Community assetIds must be unique")
    for p in plans:
        if any(p[k] != first[k] for k in ("date", "timezone", "inputType")):
            raise ValueError("Community plans must have the same date, timezone and inputType")
        if p["gridImpact"]["eventHours"] != first["gridImpact"]["eventHours"]:
            raise ValueError("Community plans must have the same event hours")
    baseline = [sum(p["baseline"][h]["gridKw"] for p in plans) for h in range(24)]
    planned = [sum(p["schedule"][h]["gridKw"] for p in plans) for h in range(24)]
    peak_hour = max(range(24), key=lambda h: baseline[h])
    return {
        "date": first["date"], "timezone": first["timezone"], "inputType": first["inputType"],
        "assetsRepresented": len(plans), "assetIds": ids,
        "baselineCoincidentPeakKw": baseline[peak_hour], "baselinePeakHour": peak_hour,
        "plannedKwAtBaselinePeakHour": planned[peak_hour],
        "avoidedKwAtBaselinePeakHour": baseline[peak_hour] - planned[peak_hour],
        "plannedCoincidentPeakKw": max(planned),
        "eventEnergyAvoidedKwh": sum(baseline[h] - planned[h] for h in first["gridImpact"]["eventHours"]),
        "backupGoalsMetAtEnd": sum(p["metrics"]["backupGoalFeasible"] and p["metrics"]["reserveReadyAtEnd"] for p in plans),
        "reserveReadyAtStartAssets": sum(p["metrics"]["reserveReadyAtStart"] for p in plans),
        "hourly": [{"hour": h, "baselineGridKw": baseline[h], "plannedGridKw": planned[h]} for h in range(24)],
        "note": "Supplied assets, not connected devices. Sum assets at each common hour BEFORE finding the community peak.",
    }
