"""Run from repo root: python -m unittest discover -s tests -v"""
import unittest
from components.forecast import _demo_weather, make_dispatch_plan, build_forecast


class ForecastTests(unittest.TestCase):
    def test_demo_produces_24_hours_and_discloses_simulation(self):
        result = build_forecast(demo=True)
        self.assertEqual(len(result["hours"]), 24)
        self.assertEqual(result["data_sources"]["weather"], "simulated-demo")
        self.assertIn("illustrative", result["data_sources"]["retail_prices"])

    def test_soc_stays_within_bounds(self):
        result = make_dispatch_plan(_demo_weather("America/New_York"), [], starting_soc_pct=30)
        self.assertTrue(all(0 <= r["battery_soc_pct"] <= 100 for r in result["hours"]))

    def test_storm_retains_at_least_50_percent_reserve(self):
        weather = _demo_weather("America/New_York")
        weather[0]["weather_code"] = 95
        result = make_dispatch_plan(weather, [], starting_soc_pct=65, backup_reserve_pct=20)
        self.assertEqual(result["effective_backup_reserve_pct"], 50)
        self.assertTrue(all(r["battery_soc_pct"] >= 50 - 0.01 for r in result["hours"]))

    def test_zero_capacity_fails(self):
        with self.assertRaises(ValueError):
            make_dispatch_plan(_demo_weather("America/New_York"), [], battery_capacity_kwh=0)


if __name__ == "__main__":
    unittest.main()
