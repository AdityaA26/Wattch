"""No external APIs called in these tests."""
import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import urlopen

from components.forecast_api import ForecastHandler, parse_parameters


class ForecastHTTPTests(unittest.TestCase):
    def setUp(self):
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), ForecastHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=3)

    def test_health(self):
        with urlopen(self.url + "/health") as result:
            self.assertEqual(result.status, 200)
            self.assertEqual(json.load(result)["status"], "ok")

    def test_forecast_returns_engine_output(self):
        with patch("components.forecast_api.build_forecast", return_value={"hours": [{"time": "now"}], "data_sources": {"weather": "simulated-demo"}}) as engine:
            with urlopen(self.url + "/api/forecast?backup_reserve_pct=40") as response:
                self.assertEqual(response.status, 200)
                self.assertEqual(json.load(response)["hours"][0]["time"], "now")
            engine.assert_called_once_with(backup_reserve_pct=40.0)

    def test_invalid_parameter(self):
        with self.assertRaises(HTTPError) as context:
            urlopen(self.url + "/api/forecast?backup_reserve_pct=150")
        self.assertEqual(context.exception.code, 400)

    def test_reject_unknown_keys(self):
        with self.assertRaises(ValueError):
            parse_parameters("latitude=abc")


if __name__ == "__main__":
    unittest.main()
