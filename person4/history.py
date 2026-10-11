"""Validate daily consumption, not cumulative meter readings."""
import math
import re
from datetime import date
from zoneinfo import ZoneInfo

UNITS = {"electricity": "kWh", "water": "gal", "gas": "therms"}


def number(value, low, high, label):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not low <= value <= high:
        raise ValueError(f"{label} must be a finite number from {low} to {high}")
    return float(value)


def household_id(value):
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,60}", value):
        raise ValueError("householdId must contain 1-60 letters, digits, underscores or hyphens")
    return value


def profile(raw):
    if not isinstance(raw, dict):
        raise ValueError("profile must be an object")
    result = dict(raw)
    result["householdId"] = household_id(raw.get("householdId"))
    result["occupants"] = number(raw.get("occupants", 2), 1, 20, "occupants")
    if result["occupants"] % 1:
        raise ValueError("occupants must be a whole number")
    result["floorAreaSqft"] = number(raw.get("floorAreaSqft", 1500), 100, 20000, "floorAreaSqft")
    result["latitude"] = number(raw.get("latitude", 34.0007), -90, 90, "latitude")
    result["longitude"] = number(raw.get("longitude", -81.0348), -180, 180, "longitude")
    result["timezone"] = str(raw.get("timezone", "America/New_York"))
    try:
        ZoneInfo(result["timezone"])
    except Exception as exc:
        raise ValueError("Use a valid IANA timezone") from exc
    result["region"] = raw.get("region", "Columbia-SC")
    if not isinstance(result["region"], str) or not 1 <= len(result["region"]) <= 80:
        raise ValueError("region must be 1-80 characters")
    if type(raw.get("peerOptIn", False)) is not bool:
        raise ValueError("peerOptIn must be a boolean")
    result["peerOptIn"] = raw.get("peerOptIn", False)
    for key, default, low, high in (("batteryCapacityKwh", 13.5, .01, 10000),
        ("startingSocPct", 60, 0, 100), ("reservePct", 20, 0, 100),
        ("maxBatteryPowerKw", 3, .01, 1000), ("solarCapacityKw", 5, 0, 1000),
        ("essentialLoadKw", .55, .01, 100), ("backupGoalHours", 8, 0, 168)):
        result[key] = number(raw.get(key, default), low, high, key)
    # Only store supported fields; do not accumulate arbitrary sensitive account data.
    keys = {"householdId", "occupants", "floorAreaSqft", "latitude", "longitude", "timezone", "region", "peerOptIn",
            "batteryCapacityKwh", "startingSocPct", "reservePct", "maxBatteryPowerKw", "solarCapacityKw", "essentialLoadKw", "backupGoalHours"}
    return {k: result[k] for k in keys}


def records(raw):
    if not isinstance(raw, list) or not 1 <= len(raw) <= 1500:
        raise ValueError("readings must contain 1-1500 daily records")
    output, seen = [], set()
    for row in raw:
        if not isinstance(row, dict):
            raise ValueError("Each reading must be an object")
        day = row.get("date")
        if not isinstance(day, str) or date.fromisoformat(day).isoformat() != day:
            raise ValueError("date must be YYYY-MM-DD")
        utility = row.get("utility")
        if utility not in UNITS or row.get("unit") != UNITS[utility]:
            raise ValueError("Use electricity/kWh, water/gal or gas/therms")
        source = row.get("source")
        if source not in ("simulated", "observed"):
            raise ValueError("source must be simulated or observed")
        key = (day, utility)
        if key in seen:
            raise ValueError("Duplicate utility/date inside this import")
        seen.add(key)
        rate = row.get("unitRateUsd")
        output.append({"date": day, "utility": utility, "unit": UNITS[utility], "source": source,
            "quantity": number(row.get("quantity"), 0, 1_000_000, "quantity"),
            "unitRateUsd": None if rate is None else number(rate, 0, 10000, "unitRateUsd")})
    return output
