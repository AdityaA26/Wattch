"""Wattch Forecast & Resilience engine (Person 2).

Real inputs: Open-Meteo hourly weather, NOAA/NWS active US weather alerts.
Illustrative inputs: retail time-of-use prices and customer demand model.
Weather is real only when ``weather_source == 'open-meteo'``.
No API keys or third-party Python dependencies required.

Call ``build_forecast(...)`` from your team's Python API route once one exists.
Run a standalone demo: python -m components.forecast --demo
Run live weather:     python -m components.forecast
"""

from __future__ import annotations

import argparse
import json
import math
import os
from datetime import datetime, timedelta
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
NWS_ALERTS_URL = "https://api.weather.gov/alerts/active"
DEFAULT_LATITUDE = 34.0007  # Columbia, South Carolina demo location
DEFAULT_LONGITUDE = -81.0348
DEFAULT_TIMEZONE = "America/New_York"
WEATHER_VARS = (
    "temperature_2m,precipitation_probability,cloud_cover,"
    "wind_speed_10m,shortwave_radiation,weather_code"
)


def _get_json(url: str, headers: dict[str, str] | None = None) -> dict[str, Any]:
    request = Request(url, headers=headers or {})
    with urlopen(request, timeout=12) as response:
        value = json.load(response)
    if not isinstance(value, dict):
        raise ValueError("API did not return a JSON object")
    return value


def _demo_weather(timezone: str, hours: int = 24) -> list[dict[str, Any]]:
    """Deterministic DEMO data, never represented as observed real weather."""
    start = datetime.now(ZoneInfo(timezone)).replace(minute=0, second=0, microsecond=0)
    output = []
    for offset in range(hours):
        time = start + timedelta(hours=offset)
        h = time.hour
        sun = max(0.0, math.sin((h - 6) * math.pi / 12))
        output.append({
            "time": time.isoformat(timespec="minutes"),
            "temperature_c": round(22 + 7 * math.sin((h - 8) * math.pi / 12), 1),
            "precip_probability_pct": 8 if h < 14 else 18,
            "cloud_cover_pct": 22 if 8 <= h <= 17 else 44,
            "wind_kmh": 12.0,
            "solar_radiation_w_m2": round(800 * sun),
            "weather_code": 1,
        })
    return output


def fetch_hourly_weather(latitude: float, longitude: float, timezone: str) -> list[dict[str, Any]]:
    """Fetch and normalize the next 24 local-clock-hour Open-Meteo forecasts."""
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": WEATHER_VARS,
        "forecast_days": 3,
        "timezone": timezone,
        "wind_speed_unit": "kmh",
    }
    data = _get_json(f"{OPEN_METEO_URL}?{urlencode(params)}")
    hourly = data["hourly"]
    keys = {
        "temperature_c": "temperature_2m",
        "precip_probability_pct": "precipitation_probability",
        "cloud_cover_pct": "cloud_cover",
        "wind_kmh": "wind_speed_10m",
        "solar_radiation_w_m2": "shortwave_radiation",
        "weather_code": "weather_code",
    }
    times = hourly["time"]
    floor = datetime.now(ZoneInfo(timezone)).replace(minute=0, second=0, microsecond=0)
    output = []
    for idx, time_str in enumerate(times):
        stamp = datetime.fromisoformat(time_str).replace(tzinfo=ZoneInfo(timezone))
        if stamp < floor:
            continue
        row = {"time": stamp.isoformat(timespec="minutes")}
        for local_name, api_name in keys.items():
            value = hourly[api_name][idx]
            row[local_name] = float(value) if value is not None else 0.0
        output.append(row)
        if len(output) == 24:
            break
    if len(output) != 24:
        raise ValueError(f"Open-Meteo returned only {len(output)} of 24 requested future hours")
    return output


def fetch_nws_alerts(latitude: float, longitude: float) -> list[dict[str, str]]:
    """Fetch current US NWS alerts for a coordinate. Empty list means no active alerts."""
    params = urlencode({"point": f"{latitude},{longitude}"})
    headers = {
        "Accept": "application/geo+json",
        "User-Agent": os.getenv(
            "WATTCH_NWS_USER_AGENT",
            "WattchStudentHackathon/0.1 (contact: demo@example.com)",
        ),
    }
    data = _get_json(f"{NWS_ALERTS_URL}?{params}", headers=headers)
    return [
        {
            "title": str(feature.get("properties", {}).get("event", "Weather alert")),
            "severity": str(feature.get("properties", {}).get("severity", "Unknown")),
            "headline": str(feature.get("properties", {}).get("headline") or ""),
            "description": str(feature.get("properties", {}).get("description") or "")[:600],
            "source": "NWS",
        }
        for feature in data.get("features", [])
    ]


def illustrative_retail_price(hour: int) -> tuple[float, str]:
    """USD/kWh demo tariff; NEVER claim it is an actual utility rate."""
    if hour < 7:
        return 0.14, "off-peak"
    if 16 <= hour < 21:
        return 0.30, "peak"
    return 0.21, "shoulder"


def make_dispatch_plan(
    weather: list[dict[str, Any]],
    alerts: list[dict[str, str]],
    *,
    battery_capacity_kwh: float = 100.0,
    starting_soc_pct: float = 55.0,
    backup_reserve_pct: float = 25.0,
    solar_capacity_kw: float = 40.0,
    base_load_kw: float = 45.0,
    max_battery_power_kw: float = 20.0,
) -> dict[str, Any]:
    """Calculate an *illustrative* battery plan, hourly savings, and weather risks.

    This is a transparent rule-based baseline, NOT a trained price forecasting AI.
    Assumes one hour per row and 90% per-direction battery efficiency.
    """
    if not 0 <= starting_soc_pct <= 100 or not 0 <= backup_reserve_pct <= 100:
        raise ValueError("Battery percentages must be in [0, 100]")
    if battery_capacity_kwh <= 0 or solar_capacity_kw < 0 or base_load_kw < 0 or max_battery_power_kw <= 0:
        raise ValueError("Battery, solar and demand parameters must be nonnegative and capacity/power positive")

    severe_nws = any(a["severity"].lower() in ("severe", "extreme") for a in alerts)
    storm_probability = any(
        (int(w["weather_code"]) >= 95)
        or (float(w["precip_probability_pct"]) >= 75 and float(w["wind_kmh"]) >= 35)
        for w in weather
    )
    storm_precaution = severe_nws or storm_probability
    effective_reserve = max(backup_reserve_pct, 50.0 if storm_precaution else backup_reserve_pct)
    stored_kwh = battery_capacity_kwh * starting_soc_pct / 100
    efficiency = 0.90
    base_cost = 0.0
    optimized_cost = 0.0
    rows = []
    for i, item in enumerate(weather):
        time = datetime.fromisoformat(item["time"])
        rate, tier = illustrative_retail_price(time.hour)
        radiation = max(0.0, float(item["solar_radiation_w_m2"]))
        solar_kw = solar_capacity_kw * min(1, radiation / 1000) * 0.80
        outdoor_temp = float(item["temperature_c"])
        demand_kw = base_load_kw + 0.40 * abs(outdoor_temp - 22)
        net_load_kw = max(0.0, demand_kw - solar_kw)
        charge_from_grid_kwh = 0.0
        discharge_to_load_kwh = 0.0
        action = "HOLD"
        if tier == "off-peak" and any(
            illustrative_retail_price(datetime.fromisoformat(future["time"]).hour)[1] == "peak"
            for future in weather[i + 1:]
        ):
            charge_from_grid_kwh = min(
                max_battery_power_kw,
                max(0.0, (battery_capacity_kwh - stored_kwh) / efficiency),
            )
            if charge_from_grid_kwh > 0.05:
                stored_kwh += charge_from_grid_kwh * efficiency
                action = "CHARGE"
        elif tier == "peak":
            discharge_to_load_kwh = min(
                max_battery_power_kw,
                net_load_kw,
                max(0.0, (stored_kwh - battery_capacity_kwh * effective_reserve / 100) * efficiency),
            )
            if discharge_to_load_kwh > 0.05:
                stored_kwh -= discharge_to_load_kwh / efficiency
                action = "DISCHARGE"
        stored_kwh = min(battery_capacity_kwh, max(0.0, stored_kwh))
        grid_kw = max(0.0, net_load_kw + charge_from_grid_kwh - discharge_to_load_kwh)
        base_cost += net_load_kw * rate
        optimized_cost += grid_kw * rate
        rows.append({
            **item,
            "price_usd_kwh": rate,
            "price_tier": tier,
            "solar_estimate_kw": round(solar_kw, 2),
            "demand_estimate_kw": round(demand_kw, 2),
            "grid_before_storage_kw": round(net_load_kw, 2),
            "grid_after_storage_kw": round(grid_kw, 2),
            "battery_action": action,
            "battery_soc_pct": round(stored_kwh / battery_capacity_kwh * 100, 1),
        })
    messages = []
    if storm_precaution:
        messages.append({"severity": "warning", "text": f"Potential severe weather: protect at least {effective_reserve:.0f}% battery reserve."})
    if rows:
        lows = [r for r in rows if r["price_tier"] == "off-peak"]
        if lows:
            messages.append({"severity": "info", "text": "Off-peak tariff window available for battery charging (assumed demonstration tariff)."})
    return {
        "hours": rows,
        "weather_risk": "elevated" if storm_precaution else "normal",
        "effective_backup_reserve_pct": effective_reserve,
        "alerts": messages,
        "summary": {
            "baseline_cost_usd": round(base_cost, 2),
            "optimized_cost_usd": round(optimized_cost, 2),
            "estimated_savings_usd": round(base_cost - optimized_cost, 2),
            "estimated_savings_pct": round((base_cost - optimized_cost) / base_cost * 100, 1) if base_cost > 0 else 0.0,
        },
    }


def build_forecast(
    latitude: float = DEFAULT_LATITUDE,
    longitude: float = DEFAULT_LONGITUDE,
    timezone: str = DEFAULT_TIMEZONE,
    *,
    demo: bool = False,
    **battery_parameters: Any,
) -> dict[str, Any]:
    """Single integration contract for frontend / Person 3 / Person 4."""
    weather_error = None
    if demo:
        weather = _demo_weather(timezone)
        weather_source = "simulated-demo"
    else:
        try:
            weather = fetch_hourly_weather(latitude, longitude, timezone)
            weather_source = "open-meteo"
        except Exception as exc:
            weather = _demo_weather(timezone)
            weather_source = "simulated-fallback"
            weather_error = str(exc)

    nws_error = None
    if demo:
        nws = []
        nws_status = "not-queried-demo"
    else:
        try:
            nws = fetch_nws_alerts(latitude, longitude)
            nws_status = "live"
        except Exception as exc:
            nws = []
            nws_status = "unavailable"
            nws_error = str(exc)

    plan = make_dispatch_plan(weather, nws, **battery_parameters)
    return {
        "location": {"latitude": latitude, "longitude": longitude, "timezone": timezone},
        "data_sources": {
            "weather": weather_source,
            "weather_error": weather_error,
            "weather_attribution": "Weather data by Open-Meteo.com (CC BY 4.0)" if weather_source == "open-meteo" else None,
            "weather_alerts": nws_status,
            "weather_alerts_error": nws_error,
            "retail_prices": "illustrative time-of-use pricing, not a live retail tariff",
            "demand": "illustrative model, not metered site usage",
            "solar": "irradiance-derived approximation, not a measured PV output",
            "dispatch": "rule-based simulation, no control of actual battery hardware",
        },
        "nws_alerts": nws,
        **plan,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Wattch weather-aware energy forecast")
    parser.add_argument("--demo", action="store_true", help="Use labeled demo weather, no live API calls")
    parser.add_argument("--json", action="store_true", help="Print full JSON API contract")
    args = parser.parse_args()
    result = build_forecast(demo=args.demo)
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print("Weather source:", result["data_sources"]["weather"])
        print("NWS alerts:", result["data_sources"]["weather_alerts"])
        print("Hourly rows:", len(result["hours"]))
        print("Risk:", result["weather_risk"])
        print("Illustrative cost estimates:", result["summary"])
        print("First three recommendations:")
        for row in result["hours"][:3]:
            print(" -", row["time"], row["battery_action"], f'${row["price_usd_kwh"]:.2f}/kWh')
