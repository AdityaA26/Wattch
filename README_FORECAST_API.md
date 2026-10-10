# Person 2 — Wattch Forecast HTTP API (development only)

This adds `components/forecast_api.py` and tests. It requires your already-working `components/forecast.py`. It does **not** create a second React project, alter the main dashboard, or affect `components/battery.py`. Zero new Python packages.

## Run from `/workspaces/Wattch`

```bash
python3 -m unittest discover -s tests -v
python3 -m components.forecast_api
```

Leave that terminal running. In a **second** Codespaces terminal run:

```bash
curl -s http://127.0.0.1:8000/health
python3 -c 'import json,urllib.request; u="http://127.0.0.1:8000/api/forecast"; p=json.load(urllib.request.urlopen(u)); print("WEATHER:",p["data_sources"]["weather"], "NWS:",p["data_sources"]["weather_alerts"], "HOURS:",len(p["hours"])); print("SAMPLE:",p["hours"][0])'
```

Also try dynamic reserve adjustment:

```bash
python3 -c 'import json,urllib.request; u="http://127.0.0.1:8000/api/forecast?backup_reserve_pct=50"; p=json.load(urllib.request.urlopen(u)); print("Reserve:",p["effective_backup_reserve_pct"])'
```

## With Person 1's React/Vite frontend

Once `frontend/package.json` exists, Person 1 can configure Vite's dev proxy to send `/api` to `http://127.0.0.1:8000`, then React can call `fetch('/api/forecast')`. Until then, this is a standalone working HTTP API. The included React forecast UI **still displays sample forecasts** until its data mapping is changed.

If using Codespaces Ports UI, forward port 8000 as **Private**. `Access-Control-Allow-Origin: *` is enabled for this local read-only demo. Do not deploy it openly to the Internet as-is.

For NWS, set your actual team's contact User-Agent; the fallback user agent is a placeholder. No API secrets should be committed.

## Data caveats

`data_sources.weather` is `open-meteo` only when live weather worked. `data_sources.weather_alerts` is `live` only when NWS responded. Prices, simulated demand, solar conversion, battery action, and savings remain estimates. `summary.estimated_savings_usd` is an *illustrative 24-hour scenario calculation*, not actual bill savings.
