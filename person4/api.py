"""Backend-only HTTP API. Run from repository root: python3 -m person4.api"""
import json
import threading
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit
from .assistant import explain
from .calculations import evaluate, community_report
from .settings import settings

PLANS = OrderedDict()
LOCK = threading.Lock()
PREFIX = "/api/insights"


def origins():
    return {s.strip().rstrip("/") for s in settings()["FRONTEND_ORIGIN"].split(",") if s.strip()}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def allowed(self):
        origin = self.headers.get("Origin")
        return not origin or origin in origins()

    def respond(self, status, data):
        body = json.dumps(data, allow_nan=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        origin = self.headers.get("Origin")
        if origin in origins():
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        if not self.allowed():
            return self.respond(403, {"error": "Configure FRONTEND_ORIGIN for this browser origin"})
        self.send_response(204)
        origin = self.headers.get("Origin")
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if not self.allowed():
            return self.respond(403, {"error": "Configure FRONTEND_ORIGIN for this browser origin"})
        path = urlsplit(self.path).path
        if path in ("/", PREFIX + "/health"):
            cfg = settings()
            return self.respond(200, {
                "ok": True, "service": "Wattch person 4 backend", "frontendIncluded": False,
                "geminiConfigured": bool(cfg["GEMINI_API_KEY"]),
                "endpoints": {"evaluate": PREFIX + "/evaluate", "chat": PREFIX + "/chat", "community": PREFIX + "/community"},
                "note": "Gemini is verified only when a chat reply has provider=gemini.",
            })
        return self.respond(404, {"error": "Unknown endpoint"})

    def do_POST(self):
        if not self.allowed():
            return self.respond(403, {"error": "Configure FRONTEND_ORIGIN for this browser origin"})
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 1_000_000:
                raise ValueError("JSON body must be 1–1000000 bytes")
            raw = json.loads(self.rfile.read(size))
            if not isinstance(raw, dict):
                raise ValueError("Body must be a JSON object")
            path = urlsplit(self.path).path
            if path == PREFIX + "/evaluate":
                plan = evaluate(raw)
                with LOCK:
                    PLANS[plan["planId"]] = plan
                    while len(PLANS) > 100:
                        PLANS.popitem(last=False)
                return self.respond(200, plan)
            if path == PREFIX + "/community":
                return self.respond(200, community_report(raw))
            if path == PREFIX + "/chat":
                plan_id = raw.get("planId")
                if not isinstance(plan_id, str):
                    raise ValueError("planId must be a string returned by evaluate")
                with LOCK:
                    plan = PLANS.get(plan_id)
                if not plan:
                    return self.respond(404, {"error": "Plan missing/expired. Evaluate it again."})
                return self.respond(200, explain(plan, raw.get("question", "")))
            return self.respond(404, {"error": "Unknown endpoint"})
        except (ValueError, TypeError, KeyError) as exc:
            self.respond(400, {"error": str(exc)})
        except Exception:
            self.respond(500, {"error": "Unexpected server error"})


def main():
    cfg = settings()
    port = int(cfg["PORT"] or "8080")
    try:
        server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    except OSError:
        raise SystemExit(f"Port {port} is occupied. Stop the old server with Ctrl+C, or set PORT=8081.")
    print(f"RUNNING: Wattch person 4 backend on port {port}", flush=True)
    print(f"Health: http://localhost:{port}{PREFIX}/health", flush=True)
    print("Gemini key loaded:", bool(cfg["GEMINI_API_KEY"]), flush=True)
    print("Leave this terminal running. In a SECOND terminal: python3 -m person4.check", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.", flush=True)
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
