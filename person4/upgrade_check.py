"""Check the running unified server; optionally retrieve live weather."""
import argparse
import json
import urllib.request
from pathlib import Path
from .settings import settings


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--live-weather", action="store_true")
    args = parser.parse_args()
    port = int(settings()["PORT"] or 8000)
    base = f"http://127.0.0.1:{port}"

    def call(path, data=None):
        req = urllib.request.Request(base + path, data=None if data is None else json.dumps(data).encode(),
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=90) as r:
            return json.load(r)

    try:
        h = call("/health")
        print("PASS: unified server; storage=" + h["storage"]["backend"])
        report = call("/api/household/report?householdId=demo-home")
        for utility in report["utilities"]:
            print(f"PASS: {utility['utility']} analysis; status={utility['status']}; source={utility['source']}; peers={utility['peerComparison'].get('sampleSize', 0)}")
        plan = json.loads((Path(__file__).parent / "fixtures" / "sample_plan.json").read_text())
        result = call("/api/insights/evaluate", plan)
        print(f"PASS: existing savings endpoint; simulated daily difference=${result['metrics']['savingsVsBaselineUsd']:.2f}")
        ai = call("/api/household/chat", {"householdId": "demo-home", "question": "Explain my water usage change and give two practical checks."})
        if ai["provider"] == "gemini":
            print("PASS: LIVE HOUSEHOLD GEMINI CALL SUCCEEDED; model=" + ai["model"])
        else:
            print("CHECK NEEDED: Gemini used local fallback. " + ai.get("warning", ""))
        print("Answer:", ai["answer"])
        failed = ai["provider"] != "gemini"
        if args.live_weather:
            w = call("/api/household/weather?householdId=demo-home")
            print("WEATHER:", w["weather"]["source"], "NWS:", w["weather"]["alertStatus"])
            print("BATTERY: suggested target", round(w["battery"]["suggestedTargetSocPct"], 1), "%")
            if w["weather"]["source"] != "open-meteo" or w["weather"]["alertStatus"] != "live":
                print("CHECK NEEDED: at least one live weather feed is unavailable; no all-clear inferred.")
                failed = True
        raise SystemExit(2 if failed else 0)
    except (OSError, ValueError, KeyError):
        raise SystemExit("CHECK FAILED: start python3 -m person4.server in the first terminal and seed the demo first. Verify the configured port and forecast files.")


if __name__ == "__main__":
    main()
