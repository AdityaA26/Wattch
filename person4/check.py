"""Run in a second terminal: python3 -m person4.check"""
import json
import sys
import urllib.error
import urllib.request
from .settings import ROOT, settings


def main():
    port = settings()["PORT"] or "8080"
    base = f"http://127.0.0.1:{port}/api/insights"
    client = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    def call(path, data=None):
        req = urllib.request.Request(base + path, data=None if data is None else json.dumps(data).encode(), headers={"Content-Type": "application/json"})
        with client.open(req, timeout=60) as response:
            return json.load(response)
    try:
        health = call("/health")
        print("PASS: API is running.")
        plan = call("/evaluate", json.loads((ROOT / "fixtures/sample_plan.json").read_text()))
        print(f"PASS: Sample costs: baseline ${plan['metrics']['baselineCostUsd']:.2f}, planned ${plan['metrics']['plannedCostUsd']:.2f}.")
        print(f"PASS: Sample daily difference: ${plan['metrics']['savingsVsBaselineUsd']:.2f} (simulated).")
        community = call("/community", json.loads((ROOT / "fixtures/sample_community.json").read_text()))
        print(f"PASS: Community report for {community['assetsRepresented']} supplied assets.")
        reply = call("/chat", {"planId": plan["planId"], "question": "Why does this plan save money, and is my backup goal protected?"})
        if reply["provider"] == "gemini":
            print("PASS: LIVE GEMINI CALL SUCCEEDED. Model:", reply["model"])
        elif not health["geminiConfigured"]:
            print("PASS: Local fallback works. Gemini not enabled; run python3 -m person4.configure_key.")
        else:
            print("CHECK NEEDED: Key is loaded, but Gemini did not succeed.")
            print(reply.get("warning", "Local rules are active."))
        print("Answer:", reply["answer"])
        print("Backend flow complete. No frontend was used.")
        return 2 if health["geminiConfigured"] and reply["provider"] != "gemini" else 0
    except urllib.error.HTTPError as exc:
        print("FAIL: API returned HTTP", exc.code)
        return 1
    except (urllib.error.URLError, TimeoutError):
        print("FAIL: Cannot reach the API. Start python3 -m person4.api in another terminal.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
