"""Unified backend, without frontend code. Start: python3 -m person4.server"""
import json
import mimetypes
from pathlib import Path
from http.server import ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit, unquote
from .api import Handler as SavingsHandler
from .storage import Store
from .settings import settings
from .usage_insights import household_report
from .weather_insights import forecast_fetch, household_weather
from .household_ai import household_explain
from .dashboard import dashboard, billing
from .planning import household_plan
from .api import PLANS, LOCK


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
    frontend_root = Path(__file__).resolve().parents[1] / "frontend" / "dist"

    def allowed(self):
        if super().allowed():
            return True
        # The built UI and API share a host. Vite continues to use its proxy.
        origin = urlsplit(self.headers.get("Origin", ""))
        return origin.scheme in ("http", "https") and not origin.username and origin.netloc.lower() == self.headers.get("Host", "").lower()

    def serve_frontend(self, path):
        if path.startswith(("/api/", "/health")):
            return False
        root = self.frontend_root.resolve()
        file = (root / ("index.html" if path == "/" else unquote(path).lstrip("/"))).resolve()
        if not file.is_relative_to(root) or not file.is_file():
            return False
        body = file.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(file.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-cache" if file.name == "index.html" else "public, max-age=3600")
        self.end_headers()
        self.wfile.write(body)
        return True

    def do_GET(self):
        if not self.allowed():
            return self.respond(403, {"error": "Configure FRONTEND_ORIGIN for this browser origin"})
        parts = urlsplit(self.path)
        try:
            if self.serve_frontend(parts.path):
                return
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
            if path == "/api/household/dashboard":
                return self.respond(200, dashboard(self.store, raw))
            if path == "/api/household/plan":
                result = household_plan(self.store, raw)
                if result.get("plan"):
                    with LOCK:
                        PLANS[result["plan"]["planId"]] = result["plan"]
                        while len(PLANS) > 100:
                            PLANS.popitem(last=False)
                return self.respond(200, result)
            if path == "/api/household/readings":
                return self.respond(200, self.store.import_readings(raw.get("householdId"), raw.get("readings")))
            if path == "/api/household/chat":
                include_weather = flag(raw.get("includeWeather", False))
                result = report(self.store, raw.get("householdId"))
                result["billing"] = billing(self.store.readings(result["householdId"]))
                plan = None
                if raw.get("planId"):
                    if not isinstance(raw["planId"], str):
                        raise ValueError("planId must be text")
                    with LOCK:
                        plan = PLANS.get(raw["planId"])
                    if not plan or plan["assetId"] != result["householdId"]:
                        raise ValueError("Energy plan missing or belongs to another household; refresh this home's plan")
                    result["energyPlan"] = {"metrics": plan["metrics"], "config": plan["config"], "inputType": plan["inputType"], "context": plan["context"]}
                if include_weather:
                    result["weatherInsights"] = plan["weatherEvidence"] if plan and plan.get("weatherEvidence") else household_weather(self.store.get_profile(result["householdId"]))
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
    print(f"If frontend/dist is built, open port {port} for the complete app. Build first: npm run build --prefix frontend", flush=True)
    print("For frontend development, run Vite separately on port 5173. Leave this backend terminal running.", flush=True)
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
