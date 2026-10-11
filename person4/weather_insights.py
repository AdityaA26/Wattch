"""Reuse Person 2's weather fetcher; do not add another weather provider."""
import threading
import time
from datetime import datetime, timezone

_CACHE = {}
_LOCK = threading.Lock()


def forecast_fetch(**kwargs):
    try:
        from components.forecast import build_forecast
    except ImportError as exc:
        raise RuntimeError("Missing components/forecast.py. Restore the forecast module from origin/feature/forecast.") from exc
    key = tuple(sorted(kwargs.items()))
    # Bound cache to 50 scenarios; serialize fetches to avoid duplicate upstream calls.
    with _LOCK:
        hit = _CACHE.get(key)
        if hit and hit[0] > time.monotonic():
            return hit[1]
        result = build_forecast(**kwargs)
        result["fetchedAt"] = datetime.now(timezone.utc).isoformat()
        if len(_CACHE) >= 50:
            _CACHE.clear()
        _CACHE[key] = (time.monotonic() + 600, result)
        return result


def weather_report(profile, forecast):
    sources = forecast["data_sources"]
    live_weather = sources["weather"] == "open-meteo"
    live_alerts = sources["weather_alerts"] == "live"
    severe_alert = live_alerts and any(a.get("severity", "").lower() in ("severe", "extreme") for a in forecast["nws_alerts"])
    elevated = (live_weather and forecast["weather_risk"] == "elevated") or severe_alert
    reserve = max(profile["reservePct"], 50 if elevated else profile["reservePct"])
    capacity, eta = profile["batteryCapacityKwh"], .90
    goal_kwh = profile["backupGoalHours"] * profile["essentialLoadKw"] / eta
    goal_pct = goal_kwh / capacity * 100
    target = min(100, max(reserve, goal_pct))
    shortfall = max(0, capacity * (target - profile["startingSocPct"]) / 100)
    hours = shortfall / (profile["maxBatteryPowerKw"] * eta)
    power_feasible = profile["essentialLoadKw"] <= profile["maxBatteryPowerKw"]
    state = "elevated_weather_risk" if elevated else (
        "no_elevated_signal_detected" if live_weather and live_alerts else "live_data_incomplete")
    weather = forecast["hours"]
    return {"householdId": profile["householdId"], "fetchedAt": forecast.get("fetchedAt"),
        "weather": {"status": state, "source": sources["weather"], "alertStatus": sources["weather_alerts"],
            "officialAlerts": forecast["nws_alerts"] if live_alerts else [],
            "maxWindKmh": max(r["wind_kmh"] for r in weather) if live_weather else None,
            "maxPrecipitationProbabilityPct": max(r["precip_probability_pct"] for r in weather) if live_weather else None,
            "outageProbability": None, "outageConfirmed": None,
            "note": "Weather-based precaution, not an outage prediction or utility outage report. Unavailable feeds never mean all-clear."},
        "battery": {"currentSocPct": profile["startingSocPct"], "suggestedTargetSocPct": target,
            "minimumChargeTimeHours": hours, "chargeInputNeededKwh": shortfall / eta,
            "currentEssentialBackupHours": capacity * profile["startingSocPct"] / 100 * eta / profile["essentialLoadKw"] if power_feasible else 0,
            "backupGoalHours": profile["backupGoalHours"], "backupGoalFeasible": goal_pct <= 100 and power_feasible,
            "essentialLoadWithinPowerLimit": power_feasible,
            "action": "consider_charging" if shortfall > .01 else "reserve_target_already_met",
            "note": "Advisory only. Assumes 90% charging/discharging efficiency, constant essential load, and no simultaneous home load or charging restrictions. No hardware control."},
        "solar": {"source": "irradiance_model" if live_weather else "unavailable",
            "estimatedNext24HoursKwh": sum(r["solar_estimate_kw"] for r in weather) if live_weather else None,
            "bestEstimatedGenerationTime": max(weather, key=lambda r: r["solar_estimate_kw"])["time"] if live_weather and profile["solarCapacityKw"] > 0 else None,
            "note": "Weather-derived estimate, not inverter telemetry; orientation, shading and actual panel efficiency are not modeled."},
        "sources": {"weather": "https://open-meteo.com/", "alerts": "https://www.weather.gov/",
                    "attribution": sources.get("weather_attribution")},
        "limitations": ["Forecast dispatch savings are excluded here; they use illustrative tariffs and demand.",
                         "The storm reserve heuristic is precautionary and has not been calibrated to historical outages."]}


def household_weather(profile):
    result = forecast_fetch(latitude=profile["latitude"], longitude=profile["longitude"], timezone=profile["timezone"],
        battery_capacity_kwh=profile["batteryCapacityKwh"], starting_soc_pct=profile["startingSocPct"],
        backup_reserve_pct=profile["reservePct"], solar_capacity_kw=profile["solarCapacityKw"],
        base_load_kw=1.0, max_battery_power_kw=profile["maxBatteryPowerKw"])
    return weather_report(profile, result)
