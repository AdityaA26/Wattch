# Wattch — person 4 backend

This folder is the complete replacement for the earlier person 4 snippets. It imports no code from components/ and includes no HTML, CSS, JavaScript, frontend, forecast service or battery scheduler.

Reviewed against Palmetto Hacks(1).pdf, pages 11–12 and 16. Person 4 owns the Savings Simulator, AI Assistant and Grid Modernization Impact logic. Under your updated team split, person 1 builds the screens, person 2 supplies forecast/tariff/weather/event data, and person 3 supplies battery schedules.

## What is included

- Grid-only, baseline-battery and planned-battery cost comparisons.
- Same demand, solar, rates and ending battery energy for fair battery comparisons.
- Supplied wear allowance; negative savings remain visible.
- Daily differences and monthly/yearly repeat-day projections, with assumptions.
- Separate labels for simulated, forecast and observed inputs; observations remain unverified.
- Essential backup runtime, energy and output-power limits, reserve readiness.
- Grid-event energy avoided; single-asset peak demand.
- Community coincident peak: add assets at each common hour before finding the peak.
- Gemini explanations grounded in costs, schedule, reserve, source metadata and assumptions.
- Labeled local explanations when no key is supplied or a Gemini call fails.
- HTTP routes, sample JSON, 28 automated tests, and a running-server verification command.

## Install from the zip

Upload Wattch_Person4_Backend.zip into your Codespace repo root (/workspaces/Wattch). Stop the previous server with Ctrl+C. Then:

```bash
cd /workspaces/Wattch
python3 -m zipfile -e Wattch_Person4_Backend.zip .
python3 -m unittest -v person4.tests
```

Python 3.10+ and standard library only. No pip/npm install, account connection or missing teammate code is required. The zip extracts a person4/ folder; source files are separate modules, not one generated installer file. It includes no API key.

## Configure Gemini once

```bash
python3 -m person4.configure_key
```

This prints a clear prompt. Paste your authorized Gemini API key and press Enter; characters are hidden. It confirms the save. A blank entry leaves existing configuration alone. The saved file is person4/.env, ignored by person4/.gitignore and restricted to the owner. Never commit or share .env. Saved settings override stale terminal exports. Obtain a key from https://aistudio.google.com/apikey. Setup saves the key; it does not verify a live request.

Optional configuration may be added to .env, one KEY=value per line:

```
GEMINI_MODEL=an-available-model-id
PORT=8080
FRONTEND_ORIGIN=http://localhost:3000
```

Leave GEMINI_MODEL absent/blank for automatic discovery of an available text Flash model. FRONTEND_ORIGIN supports exact origins separated by commas, not a wildcard.

## Start and verify

Terminal A:

```bash
python3 -m person4.api
```

It prints RUNNING, the health URL and whether a key is loaded. Leave this terminal occupied. If port 8080 is busy, stop the previous server with Ctrl+C or put PORT=8081 in person4/.env.

Create Terminal B using the + beside Terminal. Then:

```bash
cd /workspaces/Wattch
python3 -m person4.check
```

The checker submits a sample plan, gets the community report and asks the assistant a question. It prints PASS for the backend flow. If Gemini is working, it explicitly prints LIVE GEMINI CALL SUCCEEDED. With no key it prints that local fallback works. If a key is loaded but the request fails, it prints CHECK NEEDED and exits with code 2. No frontend is used.

GET / returns JSON backend status, so opening the root URL no longer looks like a missing-page error. This is an API status response, not a webpage.

## Source files

| File | Purpose |
| --- | --- |
| calculations.py | Validation, savings, backup, grid and community calculations |
| assistant.py | Gemini requests and deterministic fallback |
| api.py | JSON HTTP API |
| settings.py | Local and environment configuration |
| configure_key.py | Hidden key prompt and local save |
| check.py | Verify the running API and real Gemini status |
| tests.py | Automated unit and HTTP tests; Gemini responses are mocked |
| fixtures/*.json | Labeled sample data for person 4 testing |

## API contract for persons 1, 2 and 3

| Method | Endpoint | Request |
| --- | --- | --- |
| GET | /api/insights/health | None |
| POST | /api/insights/evaluate | One raw plan in the sample_plan.json format |
| POST | /api/insights/chat | {"planId":"returned by evaluate","question":"Explain my backup"} |
| POST | /api/insights/community | {"plans":[raw asset plan, raw asset plan]} |

All responses are JSON. Evaluate returns planId, metrics, comparison, repeatDayProjection, gridImpact, warnings and validated hourly rows. Chat returns answer, provider, model, calculation facts and warning when applicable. Show provider=gemini only for actual successful model responses.

Plan IDs are in memory, capped at 100 and reset on restart. Evaluate again after a restart. Bad inputs return 400, unknown plan IDs/routes return 404, unconfigured browser origins return 403.

Person 1 should proxy these routes in the main backend or set FRONTEND_ORIGIN to the frontend's exact browser origin. If the frontend proxy forwards an Origin header, configure that origin too. If the main app uses Python, it can directly import:

```python
from person4.calculations import evaluate, community_report
from person4.assistant import explain

report = evaluate(raw_plan_from_person_3)
answer = explain(report, "Why these savings?")
```

## Input format

fixtures/sample_plan.json is a full working example; person 3 should adapt its format rather than invent a second schema.

Top-level fields:

- assetId: unique name for this supplied battery/home, not proof of a connected device.
- date: optional YYYY-MM-DD for individual plans, required for community plans.
- timezone: defaults to America/New_York; valid IANA name.
- currency: USD.
- inputType: simulated, forecast or observed. This is team-supplied provenance, not verification.
- context: optional weatherSummary, forecastSource, tariffSource and eventSource strings, each up to 500 characters. Person 2 supplies these. Missing values say Not supplied.
- config: capacityKwh, initialSocPct, reservePct, backupHours, essentialLoadKw, maxChargeKw, maxDischargeKw, chargeEfficiency, dischargeEfficiency, wearUsdPerKwh.
- baseline and schedule: 24 one-hour rows each, ordered by integer hour 0 through 23.

Each row requires loadKw, priceUsdPerKwh, gridKw, chargeKw, dischargeKw and storedKwh. solarKw defaults to zero; gridEvent defaults to false and must be a boolean. storedKwh is energy at the END of the hour, starting from capacity × initial SOC. Grid-event hours must match across comparison cases.

Both battery strategies must respect the required reserve, except an initially low battery may charge toward it; it may not discharge before reserve is restored. Both strategies must end at the same stored energy and restore at least the initial energy or the higher reserve. If reserve requirements change, person 3 regenerates the schedules. Person 4 does not generate or control the dispatch plan.

Community plans must have unique asset IDs and matching date, timezone, inputType and event hours. Up to 20 supplied assets are accepted. Return fields include baselineCoincidentPeakKw, plannedCoincidentPeakKw, plannedKwAtBaselinePeakHour, eventEnergyAvoidedKwh and backupGoalsMetAtEnd. Do not call these assets connected homes unless you have an actual integration.

## Assumptions and limits

Costs include imported energy and the supplied wear allowance. Fixed charges, demand charges, taxes, incentives and battery purchase costs are excluded. Grid-only has no battery; the two battery cases retain identical ending energy. Monthly/yearly projection repeats one supplied day for 30/365 days, not a seasonal forecast or guarantee. Observed inputs get a separate savingsStatus but remain unverified; uploading observed data does not establish an actual utility bill credit.

This is a fixed 24-interval model, with no DST-day adjustment, exports or solar-to-battery charging. Solar offsets demand; surplus is curtailed. Backup assumes constant essential load and excludes inverter standby losses. An essential load above max discharge power cannot be supported during an outage. Event energy shifting does not establish carbon reduction.

The HTTP server is a single-process hackathon service with no user accounts or persistent database. Keep its Codespaces port private. Persistent storage, real telemetry and production hosting belong with the team's shared backend integration.

## Push only this work

```bash
git add person4
git commit --only -m "Complete person 4 savings AI and grid-impact backend" -- person4
git push origin feature/insights
```

The earlier components/insights.py, insights_api.py, insights_demo.py and insights.html are not dependencies of this version. Hand teammates this folder and README; use person4's commands going forward.

## 30-second demo explanation

Our backend receives the same household demand and tariff for the baseline and planned battery strategies. It checks the energy balance and compares costs while preserving the same ending battery energy, so it cannot manufacture savings by draining the battery. It reports whether essential backup is feasible and how much grid energy is avoided during an event. For multiple supplied homes, it calculates the community peak at common hours. Gemini explains these calculated facts and the forecast sources, with a clear fallback when the API is unavailable.
