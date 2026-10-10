# Wattch Forecast Engine — Person 2

This bundle belongs to **Person 2, branch `feature/forecast`**. Add the `components/forecast.py` file to the repository that already has `components/battery.py`; do not overwrite `battery.py` or `components/__init__.py`.

## Run (no npm, no pip dependencies)

From `/workspaces/Wattch`:

```bash
python -m components.forecast --demo
python -m components.forecast --demo --json
python -m unittest discover -s tests -v
python -m components.forecast
```

The last command needs internet access to try Open-Meteo and NOAA/NWS. Failed weather requests fall back to **explicitly labeled simulated weather**. NWS failure is marked **unavailable**, not "no alerts".

For NWS API etiquette, set a descriptive identifying User-Agent that includes real project contact information in the environment (never commit personal keys):

```bash
export WATTCH_NWS_USER_AGENT='WattchStudentHackathon/0.1 (contact: project-email@example.org)'
```

Replace project-email@example.org with an actual team contact email before depending on live alerts.

## Integration contract

```python
from components.forecast import build_forecast
payload = build_forecast(
    latitude=34.0007,
    longitude=-81.0348,
    starting_soc_pct=55,
    backup_reserve_pct=25,
    battery_capacity_kwh=100,
    solar_capacity_kw=40,
    base_load_kw=45,
)
```

- `payload['hours']`: 24 hourly records with weather, illustrative electricity rates, solar/load estimates, battery action, state of charge.
- `payload['nws_alerts']`: current official NWS warnings; `payload['data_sources']['weather_alerts']` differentiates live, unavailable and demo.
- `payload['summary']`: 24h **illustrative** baseline/optimized cost and savings, assuming illustrative rates, inferred loads and a simplified 90%-per-direction battery simulation.
- `payload['data_sources']`: honesty labels for live weather vs simulated pricing, demand, solar, dispatch and any fallbacks.

Frontend owner: ask Person 1 to expose `build_forecast` via their chosen Python backend's `/api/forecast` GET route returning this JSON; do not pick the backend framework independently. If frontend is JS-only, you can port the forecast logic after the team decides architecture. Person 3's battery engine must ultimately replace the illustrative dispatch model. Person 4 should consume `summary` and weather alert risk as inputs rather than calculating incompatible fake data.

## Important limitations

This is a transparent **rule-based** weather-aware proof of concept, not an ML-trained electricity-rate forecast. Open-Meteo is for free *noncommercial* use with attribution, and NOAA/NWS warnings are for US coordinates only. Real grid outage probability and measured customer demand are **not** provided by these APIs. Retail price examples are **not** a utility's actual tariff. The battery simulation is for demo planning and does not control real hardware. Savings can also depend on the value of energy initially stored in the battery and its end-of-day state, so do not present this as a verified utility-bill reduction.

Sources: https://open-meteo.com/en/docs and https://www.weather.gov/documentation/services-web-alerts
