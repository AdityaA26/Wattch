"""Unified backend, without frontend code. Start: python3 -m person4.server"""
import json
from http.server import ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit
from .api import Handler as SavingsHandler
from .storage import Store
from .settings import settings
from .usage_insights import household_report
from .weather_insights import forecast_fetch, household_weather
from .household_ai import household_explain


def flag(value):
    if type(value) is not bool:
        raise ValueError("includeWeather must be a boolean")
    return value


def report(store, ident, weather=False):
    result = household_report(store, ident)
    if weather:
        result["weatherInsights"] = household_weather(store.get_profile(ident))
    return result


class Handler(SavingsHandler):
    store = None

    def do_GET(self):
        if not self.allowed():
            return self.respond(403, {"error": "Configure FRONTEND_ORIGIN for this browser origin"})
        parts = urlsplit(self.path)
        try:
            if parts.path == "/health":
                return self.respond(200, {"ok": True, "service": "Wattch unified backend", "storage": self.store.status()})
            if parts.path == "/api/forecast":
                try:
                    from components.forecast_api import parse_parameters
                except ImportError as exc:
                    raise RuntimeError("Restore components/forecast_api.py from origin/feature/forecast") from exc
                return self.respond(200, forecast_fetch(**parse_parameters(parts.query)))
            if parts.path == "/api/water-updates":
                try:
                    from components.local_updates import get_water_updates
                except ImportError as exc:
                    raise RuntimeError("Restore components/local_updates.py from origin/feature/forecast") from exc
                return self.respond(200, get_water_updates())
            if parts.path in ("/api/household/report", "/api/household/weather"):
                q = parse_qs(parts.query, keep_blank_values=True)
                if set(q) - {"householdId", "includeWeather"} or len(q.get("householdId", [])) != 1:
                    raise ValueError("Supply one householdId")
                if "includeWeather" in q and q["includeWeather"] not in (["true"], ["false"]):
                    raise ValueError("includeWeather must be true or false")
                ident = q["householdId"][0]
                if parts.path.endswith("/weather"):
                    result = household_weather(self.store.get_profile(ident))
                else:
                    result = report(self.store, ident, q.get("includeWeather", ["false"])[0] == "true")
                return self.respond(200, result)
            return super().do_GET()
        except ValueError as exc:
            self.respond(400, {"error": str(exc)})
        except KeyError:
            self.respond(404, {"error": "Household missing; save its profile first"})
        except RuntimeError as exc:
            self.respond(503, {"error": str(exc)})
        except Exception:
            self.respond(503, {"error": "Backend data source unavailable; no all-clear or diagnosis can be inferred"})

    def do_POST(self):
        path = urlsplit(self.path).path
        if not path.startswith("/api/household/"):
            return super().do_POST()
        if not self.allowed():
            return self.respond(403, {"error": "Configure FRONTEND_ORIGIN for this browser origin"})
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 1_000_000:
                raise ValueError("JSON body must be 1-1000000 bytes")
            raw = json.loads(self.rfile.read(size))
            if not isinstance(raw, dict):
                raise ValueError("Body must be an object")
            if path == "/api/household/profile":
                return self.respond(200, self.store.save_profile(raw))
            if path == "/api/household/readings":
                return self.respond(200, self.store.import_readings(raw.get("householdId"), raw.get("readings")))
            if path == "/api/household/chat":
                result = report(self.store, raw.get("householdId"), flag(raw.get("includeWeather", False)))
                return self.respond(200, household_explain(result, raw.get("question")))
            return self.respond(404, {"error": "Unknown household endpoint"})
        except (ValueError, TypeError) as exc:
            self.respond(400, {"error": str(exc)})
        except KeyError:
            self.respond(404, {"error": "Household missing; save its profile first"})
        except Exception:
            self.respond(503, {"error": "Storage or analysis unavailable"})


def main():
    cfg = settings()
    try:
        Handler.store = Store()
    except Exception as exc:
        # Do not expose credentials in connection exception text.
        raise SystemExit(f"Storage initialization failed ({type(exc).__name__}). Check local setup or DATABASE_URL; credentials were not printed.")
    port = int(cfg["PORT"] or 8000)
    try:
        server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    except OSError:
        raise SystemExit(f"Port {port} is occupied. Stop the previous forecast/server process with Ctrl+C.")
    print(f"RUNNING: unified Wattch backend on port {port}; storage={Handler.store.backend}", flush=True)
    print("Leave this terminal running. In a SECOND terminal: python3 -m person4.upgrade_check", flush=True)
    print("Forecast, water updates, savings, community and household endpoints share this server.", flush=True)
    print("Keep the Codespaces port private: this hackathon service has no user authentication.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.", flush=True)
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
