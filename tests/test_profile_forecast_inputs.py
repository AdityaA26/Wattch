"""My Home profile request parameter regression tests."""
import unittest
from components.forecast_api import parse_parameters

class ProfileInputTests(unittest.TestCase):
    def test_household_forecast_parameters(self):
        got = parse_parameters("latitude=34.0007&longitude=-81.0348&timezone=America%2FNew_York&battery_capacity_kwh=13.5&solar_capacity_kw=5&base_load_kw=0.87")
        self.assertEqual(got["timezone"], "America/New_York")
        self.assertEqual(got["battery_capacity_kwh"], 13.5)
        self.assertEqual(got["latitude"], 34.0007)

    def test_invalid_coordinate_rejected(self):
        with self.assertRaises(ValueError):
            parse_parameters("latitude=108&longitude=-81")

    def test_timezone_allowlist(self):
        with self.assertRaises(ValueError):
            parse_parameters("timezone=../../etc/passwd")

if __name__ == "__main__": unittest.main()
