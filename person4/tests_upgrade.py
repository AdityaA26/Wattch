import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path
from unittest.mock import patch, MagicMock
from http.server import ThreadingHTTPServer
from .storage import Store
from .history import records, profile
from .seed_demo import seed, demo_data
from .usage_insights import household_report, utility_summary
from . import household_ai, weather_insights, prepare_upgrade
from .server import Handler


class HistoryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "db.sqlite"
        self.store = Store(self.path, database_url="")
        seed(self.store)

    def test_history_persists_and_duplicate_import_does_not_double_count(self):
        before = self.store.status()["readingCount"]
        seed(self.store)
        other = Store(self.path, database_url="")
        self.assertEqual(other.status()["readingCount"], before)
        self.assertEqual(before, 756)

    def test_water_anomaly_and_simulated_label(self):
        result = household_report(self.store, "demo-home")
        water = result["utilities"][1]
        self.assertEqual(water["status"], "possible_unusual_increase")
        self.assertAlmostEqual(water["changePct"], 50, places=2)
        self.assertEqual(water["source"], "simulated")
        self.assertFalse(water["hourlyLeakDetectionAvailable"])
        self.assertEqual(water["peerComparison"]["sampleSize"], 5)

    def test_cost_decomposition_reconciles(self):
        water = household_report(self.store, "demo-home")["utilities"][1]
        c = water["costInsights"]
        self.assertAlmostEqual(c["differenceUsd"], c["usageComponentUsd"] + c["rateComponentUsd"])

    def test_rate_increase_is_separated(self):
        p, rows = demo_data(1, date(2026, 10, 10))
        subset = [r for r in rows if r["utility"] == "water"]
        for r in subset:
            r["quantity"] = 100
            r["unitRateUsd"] = .02 if r["date"] >= "2026-10-04" else .01
        s = utility_summary(subset, "water")
        self.assertAlmostEqual(s["costInsights"]["usageComponentUsd"], 0)
        self.assertAlmostEqual(s["costInsights"]["rateComponentUsd"], 7)

    def test_missing_day_is_not_zero(self):
        _, rows = demo_data(0)
        rows = [r for r in rows if r["date"] != date.today().isoformat()]
        # Remove an interior day too, so the shifted trailing window still has a gap.
        rows.pop(12)
        s = utility_summary(rows, "electricity")
        self.assertEqual(s["status"], "insufficient_comparable_data")

    def test_mixed_sources_not_compared(self):
        _, rows = demo_data(0)
        rows[0]["source"] = "observed"
        s = utility_summary(rows, "electricity")
        self.assertEqual(s["source"], "mixed")
        self.assertEqual(s["status"], "insufficient_comparable_data")

    def test_no_rate_no_cost_guess(self):
        _, rows = demo_data(0)
        rows[0]["unitRateUsd"] = None
        self.assertEqual(utility_summary(rows, "electricity")["costInsights"]["status"], "rate_missing")

    def test_peer_opt_out_and_minimum_sample(self):
        p = self.store.get_profile("demo-peer-1")
        p["peerOptIn"] = False
        self.store.save_profile(p)
        self.assertEqual(household_report(self.store, "demo-home")["utilities"][0]["peerComparison"]["status"], "insufficient_cohort")
        self.assertEqual(household_report(self.store, p["householdId"])["utilities"][0]["peerComparison"]["status"], "not_opted_in")

    def test_bad_batch_does_not_partially_save(self):
        _, rows = demo_data(0)
        rows[1]["quantity"] = float("nan")
        before = self.store.status()["readingCount"]
        with self.assertRaises(ValueError):
            self.store.import_readings("demo-home", rows)
        self.assertEqual(self.store.status()["readingCount"], before)

    def test_wrong_unit_duplicate_boolean_and_invalid_timezone(self):
        _, rows = demo_data(0)
        for mutate in (lambda r: r.update(unit="liters"), lambda r: r.update(quantity=True)):
            r = dict(rows[0]); mutate(r)
            with self.assertRaises(ValueError): records([r])
        with self.assertRaises(ValueError): records([rows[0], rows[0]])
        with self.assertRaises(ValueError): profile({"householdId": "a", "timezone": "Bad/Zone"})

    def test_zero_baseline_no_infinite_change(self):
        _, rows = demo_data(0)
        for r in rows: r["quantity"] = 0
        result = utility_summary(rows, "water")
        self.assertIsNone(result["changePct"])
        json.dumps(result, allow_nan=False)

    def test_sql_parameterization_handles_region_quotes(self):
        p = self.store.get_profile("demo-home")
        p["region"] = "Columbia'; DROP TABLE wattch_readings; --"
        self.store.save_profile(p)
        self.assertEqual(self.store.get_profile("demo-home")["region"], p["region"])
        self.assertEqual(self.store.status()["readingCount"], 756)


class WeatherTests(unittest.TestCase):
    def forecast(self):
        return {"data_sources": {"weather": "open-meteo", "weather_alerts": "live"},
            "weather_risk": "elevated", "effective_backup_reserve_pct": 50, "nws_alerts": [],
            "hours": [{"wind_kmh": 50, "precip_probability_pct": 80, "solar_estimate_kw": 2, "time": "2026-10-10T12:00:00-04:00"}] * 24}

    def test_outage_not_invented_and_backup_shortfall(self):
        p = profile({"householdId": "a", "startingSocPct": 10})
        result = weather_insights.weather_report(p, self.forecast())
        self.assertIsNone(result["weather"]["outageProbability"])
        self.assertIsNone(result["weather"]["outageConfirmed"])
        self.assertGreater(result["battery"]["minimumChargeTimeHours"], 0)
        self.assertEqual(result["solar"]["estimatedNext24HoursKwh"], 48)

    def test_failed_weather_never_uses_fake_solar(self):
        f = self.forecast()
        f["data_sources"] = {"weather": "simulated-fallback", "weather_alerts": "unavailable"}
        result = weather_insights.weather_report(profile({"householdId": "a"}), f)
        self.assertEqual(result["weather"]["status"], "live_data_incomplete")
        self.assertIsNone(result["solar"]["estimatedNext24HoursKwh"])

    def test_unfeasible_goal_is_flagged(self):
        p = profile({"householdId": "a", "batteryCapacityKwh": 1, "backupGoalHours": 20})
        r = weather_insights.weather_report(p, self.forecast())
        self.assertFalse(r["battery"]["backupGoalFeasible"])
        self.assertEqual(r["battery"]["suggestedTargetSocPct"], 100)

    def test_essential_load_over_power_limit(self):
        p = profile({"householdId": "a", "essentialLoadKw": 4, "maxBatteryPowerKw": 3})
        r = weather_insights.weather_report(p, self.forecast())
        self.assertFalse(r["battery"]["backupGoalFeasible"])
        self.assertEqual(r["battery"]["currentEssentialBackupHours"], 0)


class TigerAdapterTests(unittest.TestCase):
    def test_tiger_initializes_real_hypertable_and_uses_time_bucket(self):
        # Exercises adapter SQL and parameters, not a live Tiger Cloud claim.
        conn = MagicMock()
        conn.__enter__.return_value = conn
        cursor = MagicMock()
        conn.execute.return_value = cursor
        cursor.fetchone.return_value = (json.dumps(profile({"householdId": "a"})),)
        cursor.fetchall.return_value = []
        pg = MagicMock()
        pg.connect.return_value = conn
        with patch.dict("sys.modules", {"psycopg": pg}):
            s = Store(database_url="postgresql://test:test@host/database")
            s.readings("a")
        statements = [c.args[0] for c in conn.execute.call_args_list]
        self.assertTrue(any("create_hypertable" in q for q in statements))
        self.assertTrue(any("time_bucket" in q for q in statements))
        self.assertTrue(any("household_id=%s" in q for q in statements))
        self.assertEqual(pg.connect.call_args.kwargs["sslmode"], "require")

    def test_tiger_connection_failure_does_not_fallback(self):
        pg = MagicMock()
        pg.connect.side_effect = OSError("connection failed")
        with patch.dict("sys.modules", {"psycopg": pg}):
            with self.assertRaises(OSError): Store(database_url="postgresql://test:test@host/database")


class HouseholdAITests(unittest.TestCase):
    def test_prompt_contains_sources_and_no_training_claim(self):
        data = {"householdId": "a", "utilities": [], "weatherInsights": {"weather": {"status": "live_data_incomplete"}}}
        cfg = {"GEMINI_API_KEY": "fake", "GEMINI_MODEL": "test-flash"}
        def fake(url, key, body):
            self.assertIn("live_data_incomplete", json.dumps(body))
            self.assertIn("not a verified neighborhood", body["systemInstruction"]["parts"][0]["text"])
            return {"candidates": [{"content": {"parts": [{"text": "Answer"}]}}]}
        with patch.object(household_ai, "settings", return_value=cfg), patch.object(household_ai, "request_json", side_effect=fake):
            self.assertEqual(household_ai.household_explain(data, "Why?")["provider"], "gemini")

    def test_failure_does_not_hide_fallback(self):
        with patch.object(household_ai, "settings", return_value={"GEMINI_API_KEY": "fake", "GEMINI_MODEL": "test-flash"}), patch.object(household_ai, "request_json", side_effect=TimeoutError()):
            r = household_ai.household_explain({"householdId": "a", "utilities": []}, "Why?")
            self.assertEqual(r["provider"], "local_rules")
            self.assertIn("warning", r)


class UnifiedAPITests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.store = Store(Path(self.temp.name) / "db", database_url="")
        seed(self.store)
        self.handler = type("TestHandler", (Handler,), {"store": self.store})
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), self.handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.stop)
        self.base = f"http://127.0.0.1:{self.server.server_port}"

    def stop(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join()

    def call(self, path, data=None):
        req = urllib.request.Request(self.base + path, data=None if data is None else json.dumps(data).encode(), headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req) as r: return json.load(r)

    def test_health_and_report_share_server(self):
        self.assertEqual(self.call("/health")["storage"]["backend"], "sqlite")
        self.assertEqual(self.call("/api/household/report?householdId=demo-home")["householdId"], "demo-home")
        self.assertTrue(self.call("/api/insights/health")["ok"])

    def test_profile_and_reading_import_roundtrip(self):
        p = self.call("/api/household/profile", {"householdId": "new-home"})
        _, r = demo_data(0)
        self.assertEqual(self.call("/api/household/readings", {"householdId": p["householdId"], "readings": r})["imported"], 126)

    def test_unknown_household_and_bad_query(self):
        for path, status in (("/api/household/report?householdId=missing", 404),
                ("/api/household/report?householdId=demo-home&includeWeather=wrong", 400)):
            with self.assertRaises(urllib.error.HTTPError) as e: self.call(path)
            self.assertEqual(e.exception.code, status)

    def test_forecast_endpoint_reuses_adapter(self):
        # Tests require Person 2's file (setup instructions restore it).
        with patch("person4.server.forecast_fetch", return_value={"data_sources": {"weather": "test"}}) as fetch:
            self.assertEqual(self.call("/api/forecast?backup_reserve_pct=40")["data_sources"]["weather"], "test")
            fetch.assert_called_once_with(backup_reserve_pct=40.0)

    def test_storage_failure_never_prints_connection_secrets(self):
        with patch.object(self.store, "get_profile", side_effect=Exception("secret-db-password")):
            with self.assertRaises(urllib.error.HTTPError) as e: self.call("/api/household/report?householdId=demo-home")
            self.assertNotIn("secret", e.exception.read().decode())


if __name__ == "__main__":
    unittest.main()
