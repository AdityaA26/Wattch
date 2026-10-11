"""Conservative household scheduling with independently checked energy balances."""
from copy import deepcopy
from datetime import datetime
from .calculations import evaluate, community_report, numeric
from .weather_insights import forecast_fetch, weather_report
from .history import profile as clean_profile


def plan_from_forecast(profile, forecast, daily_kwh, reserve=None, tariff="time_of_use", wear=.02):
    if tariff not in ("time_of_use", "flat"):
        raise ValueError("tariffMode must be time_of_use or flat")
    wear = numeric(wear, 0, 2, "wearUsdPerKwh")
    reserve = numeric(profile["reservePct"] if reserve is None else reserve, 0, 100, "reservePct")
    daily_kwh = numeric(daily_kwh, 0, 1000, "dailyKwh")
    weather = weather_report(dict(profile, reservePct=reserve), forecast)
    if weather["weather"]["status"] == "elevated_weather_risk":
        reserve = max(reserve, 50)
    capacity, power = profile["batteryCapacityKwh"], profile["maxBatteryPowerKw"]
    if not 1 <= capacity <= 100 or power > 50 or profile["essentialLoadKw"] > 20 or profile["backupGoalHours"] > 72:
        return {"status": "battery_not_supported", "weather": weather, "forecast": forecast,
                "note": "Add an owned home battery between 1 and 100 kWh with output at most 50 kW to run this household planner."}
    c = {"capacityKwh": capacity, "initialSocPct": profile["startingSocPct"], "reservePct": reserve,
         "backupHours": profile["backupGoalHours"], "essentialLoadKw": profile["essentialLoadKw"],
         "maxChargeKw": power, "maxDischargeKw": power, "chargeEfficiency": .90,
         "dischargeEfficiency": .90, "wearUsdPerKwh": wear}
    hours = forecast["hours"]
    if len(hours) != 24:
        raise ValueError("Planning requires 24 hourly weather rows")
    # Daily total follows saved household use; intraday shape is an explicit model.
    weights = [1.4 if 17 <= datetime.fromisoformat(r["time"]).hour <= 21 else .7 if datetime.fromisoformat(r["time"]).hour < 7 else 1 for r in hours]
    norm = sum(weights)
    inputs = [{"hour": h, "loadKw": daily_kwh * weights[h] / norm,
               "solarKw": r["solar_estimate_kw"],
               "priceUsdPerKwh": .18 if tariff == "flat" else r["price_usd_kwh"],
               "gridEvent": 17 <= datetime.fromisoformat(r["time"]).hour <= 20} for h, r in enumerate(hours)]
    start = capacity * c["initialSocPct"] / 100
    floor = min(capacity, max(capacity * reserve / 100, c["essentialLoadKw"] * c["backupHours"] / .90))
    target = max(start, floor)
    baseline, stored = [], start
    for item in inputs:
        charge = min(power, max(0, (target - stored) / .90))
        stored += charge * .90
        baseline.append({**item, "chargeKw": charge, "dischargeKw": 0,
                         "gridKw": max(0, item["loadKw"] - item["solarKw"]) + charge, "storedKwh": stored})
    if stored < target - 1e-5:
        return {"status": "reserve_not_reachable", "weather": weather, "forecast": forecast,
                "note": "The supplied battery power cannot restore the required reserve within 24 hours. Increase charge availability or reduce the backup target."}
    schedule = deepcopy(baseline)
    # A soft 10% shaving target; required reserve restoration can prevent it.
    # Report actual achieved peaks, never claim the target as a guaranteed result.
    peak_limit = max(r["gridKw"] for r in baseline) * .90
    pairs = sorted(((inputs[d]["priceUsdPerKwh"] - inputs[ch]["priceUsdPerKwh"] / .81 - wear, ch, d)
                    for ch in range(24) for d in range(24) if ch != d), reverse=True)

    def shift_pair(profit, ch, dis, trim_peak=False):
        if profit <= 1e-8 or schedule[ch]["dischargeKw"] > 1e-8 or schedule[dis]["chargeKw"] > 1e-8:
            return
        interval = schedule[min(ch, dis):max(ch, dis)]
        room = min(capacity - r["storedKwh"] for r in interval) if ch < dis else min(r["storedKwh"] - floor for r in interval)
        discharge_budget = max(0, schedule[dis]["gridKw"] - peak_limit) if trim_peak else max(0, schedule[dis]["gridKw"])
        discharged = min(max(0, room) * .90,
                         max(0, power - schedule[ch]["chargeKw"]) * .81,
                         max(0, peak_limit - schedule[ch]["gridKw"]) * .81,
                         max(0, power - schedule[dis]["dischargeKw"]), discharge_budget)
        if discharged <= 1e-8:
            return
        charged = discharged / .81
        schedule[ch]["chargeKw"] += charged
        schedule[ch]["gridKw"] += charged
        schedule[dis]["dischargeKw"] += discharged
        schedule[dis]["gridKw"] -= discharged
        for h in range(min(ch, dis), max(ch, dis)):
            schedule[h]["storedKwh"] += discharged / .90 * (1 if ch < dis else -1)

    # Trim the highest demand hours using profitable pairs before maximizing savings.
    for pair in sorted(pairs, key=lambda p: (baseline[p[2]]["gridKw"], -inputs[p[1]]["priceUsdPerKwh"]), reverse=True):
        shift_pair(*pair, trim_peak=True)
    for pair in pairs:
        shift_pair(*pair)
    raw = {"assetId": profile["householdId"], "date": hours[0]["time"][:10], "timezone": profile["timezone"],
           "inputType": "forecast" if forecast["data_sources"]["weather"] == "open-meteo" else "simulated",
           "config": c, "baseline": baseline, "schedule": schedule,
           "context": {"weatherSummary": weather["weather"]["status"],
                       "forecastSource": forecast["data_sources"]["weather"],
                       "tariffSource": "Illustrative flat $0.18/kWh" if tariff == "flat" else "Illustrative TOU: $0.14 off-peak, $0.21 shoulder, $0.30 peak",
                       "eventSource": "Illustrative 5–8 pm grid stress window, not a utility dispatch event"}}
    result = evaluate(raw)
    result["timestamps"] = [r["time"] for r in hours]
    result["weatherEvidence"] = weather
    result["comparison"]["baselineBattery"]["label"] = "Hold charge; restore backup reserve if needed"
    result["comparison"]["plannedBattery"]["label"] = "Shift profitable use; protect the same reserve"
    result["planningNotes"] = ["Hourly demand is modeled from the home's saved daily average; it is not hourly meter data. Metered grid purchases may already include solar, so gross demand and PV exports are needed to reconcile a real solar-equipped home.",
                               "The scheduler avoids cycles whose price difference cannot cover losses and the wear allowance.",
                               "The heuristic first tries to trim the full-day peak, then shifts additional profitable use. Cycle charging is capped at 90% of the baseline peak; required reserve restoration may prevent peak reduction."]
    return {"status": "ready", "plan": result, "rawPlan": raw, "weather": weather, "forecast": forecast}


def household_plan(store, raw):
    profile = store.get_profile(raw.get("householdId"))
    if "profile" in raw:
        supplied = clean_profile(raw["profile"])
        if supplied["householdId"] != profile["householdId"]:
            raise ValueError("Plan profile must belong to the requested household")
        # Use this client's validated snapshot; another tab may update stored settings.
        profile = supplied
    rows = [r for r in store.readings(profile["householdId"]) if r["utility"] == "electricity"]
    if not rows:
        raise ValueError("Import daily electricity readings before planning")
    rows = sorted(rows, key=lambda r: r["date"], reverse=True)[:30]
    daily = sum(r["quantity"] for r in rows) / len(rows)
    away_pct = numeric(raw.get("awayUsagePct", 100), 20, 100, "awayUsagePct")
    vacation_reserve = numeric(raw.get("vacationReservePct", 0), 0, 100, "vacationReservePct")
    forecast = forecast_fetch(latitude=profile["latitude"], longitude=profile["longitude"], timezone=profile["timezone"],
                              battery_capacity_kwh=profile["batteryCapacityKwh"], starting_soc_pct=profile["startingSocPct"],
                              backup_reserve_pct=profile["reservePct"], solar_capacity_kw=profile["solarCapacityKw"],
                              base_load_kw=daily / 24, max_battery_power_kw=profile["maxBatteryPowerKw"])
    requested_reserve = numeric(raw.get("reservePct", profile["reservePct"]), 0, 100, "reservePct")
    result = plan_from_forecast(profile, forecast, daily * away_pct / 100, max(requested_reserve, vacation_reserve), raw.get("tariffMode", "time_of_use"), raw.get("wearUsdPerKwh", .02))
    result["householdId"] = profile["householdId"]
    result["historyDaysUsed"] = len(rows)
    result["modeledDailyKwh"] = daily * away_pct / 100
    result["normalDailyKwh"] = daily
    result["awayUsagePct"] = away_pct
    if result["status"] == "ready":
        raw_plan = result.pop("rawPlan")
        # These are scenario copies, explicitly not connected neighborhood assets.
        community_raw = [dict(raw_plan, assetId=f"scenario-home-{i+1}") for i in range(20)]
        community = community_report({"plans": community_raw})
        community["timestamps"] = result["plan"]["timestamps"]
        community["note"] = "Hypothetical 20 similar homes following this home's plan at the same hours. No connected community or utility event."
        result["community"] = community
    return result
