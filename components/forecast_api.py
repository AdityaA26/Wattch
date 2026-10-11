"""Local development HTTP bridge for Wattch's weather-aware forecast engine.

Run from the repository root: python3 -m components.forecast_api
Then open http://127.0.0.1:8000/api/forecast

This is a zero-dependency READ-ONLY demo API. Not a production server.
"""
from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

from components.forecast import build_forecast


PARAMS = {
    "battery_capacity_kwh": (0.001, 1_000_000),
    "starting_soc_pct": (0, 100),
    "backup_reserve_pct": (0, 100),
    "solar_capacity_kw": (0, 1_000_000),
    "base_load_kw": (0, 1_000_000),
    "max_battery_power_kw": (0.001, 1_000_000),
}


LOCATION_PARAMS = {"latitude": (-90, 90), "longitude": (-180, 180)}
VALID_TIMEZONES = {"America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu"}

def parse_parameters(raw_query: str) -> dict[str, float]:
    query = parse_qs(raw_query, keep_blank_values=True)
    unknown = set(query) - set(PARAMS) - set(LOCATION_PARAMS) - {"timezone"}
    if unknown:
        raise ValueError(f"Unknown query parameter(s): {', '.join(sorted(unknown))}")
    values = {}
    for name, strings in query.items():
        if len(strings) != 1:
            raise ValueError(f"Exactly one value is required for {name}")
        if name == "timezone":
            if strings[0] not in VALID_TIMEZONES:
                raise ValueError("Unsupported US timezone")
            values[name] = strings[0]
            continue
        try:
            number = float(strings[0])
        except ValueError as exc:
            raise ValueError(f"{name} must be a number") from exc
        minimum, maximum = {**PARAMS, **LOCATION_PARAMS}[name]
        if not minimum <= number <= maximum:
            raise ValueError(f"{name} must be between {minimum} and {maximum}")
        values[name] = number
    return values


class ForecastHandler(BaseHTTPRequestHandler):
    def send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, allow_nan=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        # Read-only demo endpoint for local Codespaces development only.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self) -> None:
        request = urlsplit(self.path)
        if request.path == "/health":
            self.send_json(200, {"status": "ok", "service": "wattch-forecast-api"})
            return
        if request.path == "/api/water-updates":
            try:
                from components.local_updates import get_water_updates
                self.send_json(200, get_water_updates())
            except Exception:
                self.send_json(503, {"status": "unavailable", "posts": []})
            return
        if request.path != "/api/forecast":
            self.send_json(404, {"error": "Not found", "paths": ["/health", "/api/forecast"]})
            return
        try:
            kwargs = parse_parameters(request.query)
            result = build_forecast(**kwargs)
        except ValueError as exc:
            self.send_json(400, {"error": str(exc)})
            return
        except Exception:
            self.log_exception()
            self.send_json(500, {"error": "Could not generate forecast; check server terminal."})
            return
        self.send_json(200, result)

    def log_exception(self) -> None:
        import traceback
        traceback.print_exc()


def main() -> None:
    host = os.getenv("WATTCH_API_HOST", "0.0.0.0")
    port = int(os.getenv("WATTCH_API_PORT", "8000"))
    with ThreadingHTTPServer((host, port), ForecastHandler) as server:
        print(f"Wattch demo API listening on http://127.0.0.1:{port}", flush=True)
        print("Endpoints: /health and /api/forecast", flush=True)
        print("Use Codespaces Ports tab for browser access. Keep port PRIVATE.", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")


if __name__ == "__main__":
    main()
