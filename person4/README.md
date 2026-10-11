# Wattch person 4 backend upgrade

Backend only. No React, HTML, CSS, utility login or hardware control is added.
The package extends your uploaded person4 code and reuses Person 2's forecast modules.

## Start in Codespaces

Upload Wattch_Backend_Upgrade.zip into the /workspaces/Wattch root (beside README.md).
Stop any running old backend with Ctrl+C in its terminal. Keep all ports PRIVATE.

Run each block in order from a shell prompt. The archive updates person4 source files
but contains no .env, database, frontend files or components files. Your saved key stays in place.
Back up any newer person4 edits before extracting this snapshot-based upgrade.

```bash
cd /workspaces/Wattch
git fetch origin
python3 -m zipfile -e Wattch_Backend_Upgrade.zip .
```

Reuse these exact Person 2 modules from their branch; no full branch merge is required.
This updates these three shared files to the fetched forecast branch versions.
If your team has newer versions elsewhere, agree on those versions instead.

```bash
git restore --source=origin/feature/forecast -- components/forecast.py components/forecast_api.py components/local_updates.py
python3 -m person4.prepare_upgrade
python3 -m unittest -v person4.tests person4.tests_upgrade
```

Expect 53 passing tests. prepare_upgrade preserves your key, sets port 8000 and
explicitly selects gemini-2.5-flash. A Gemini project must itself be on the free tier:
selecting a model cannot disable billing on a paid project. If you have no key yet,
run python3 -m person4.configure_key, then continue below. Do not paste keys into chat.

First use local SQLite; no dependency installation or cloud signup is needed:

```bash
python3 -m person4.seed_demo
python3 -m person4.storage_check
python3 -m person4.server
```

Leave the server running. Open a SECOND terminal and run:

```bash
cd /workspaces/Wattch
python3 -m person4.upgrade_check
python3 -m person4.upgrade_check --live-weather
```

The first checks persistent history, insights, old savings routes and a real household
Gemini request. The second also requests live weather/NWS. CHECK NEEDED means a source
is unavailable; local fallback must not be claimed as a Gemini success.
Only this new unified server should occupy port 8000. Do not simultaneously run
components.forecast_api or the old person4.api. The legacy savings endpoints remain
available on the unified server. The old person4.check honors the configured port,
but upgrade_check is the main checker now.

## Optional Tiger Data trial

Tiger Cloud offers a 30-day trial without a credit card (checked October 10, 2026).
It is not permanently free cloud hosting. SQLite remains the option if your rule is
zero paid-service dependency after the hackathon. Use your own Tiger Data account;
no ChatGPT account connection is required and do not send the connection URI here.

1. Open https://www.tigerdata.com/pricing and choose the free trial signup.
2. Create a TimescaleDB service on the available trial plan. Avoid paid upgrades.
3. In its connection details, copy the PostgreSQL URI, including the database name,
   username and password. Choose the URI form rather than a full psql command.
4. Stop the unified server with Ctrl+C, then run:

```bash
python3 -m pip install -r person4/requirements-tiger.txt
python3 -m person4.configure_database
```

Paste ONLY the connection URI at the hidden prompt, then Enter. No characters display.
The URI is saved in ignored person4/.env. SSL is required by the adapter.

```bash
python3 -m person4.seed_demo
python3 -m person4.storage_check
python3 -m person4.server
```

Use a second terminal for upgrade_check again. Claim Tiger Data integration only after
storage_check prints LIVE TIGER DATA CONNECTION and the HTTP health reports tigerdata.
The adapter creates wattch_readings as a hypertable and executes time_bucket queries
for reports; it actually stores and queries the project data. It does not silently
fall back to SQLite when a Tiger connection fails. Changing storage backends does not
migrate existing histories. Seeding adds/replaces only reserved demo-* histories.
To switch back, stop the server, rerun configure_database, press Enter on the blank
prompt, and restart. Your earlier local SQLite data is still there.

## Endpoints for the frontend owner

The frontend is unchanged. Its existing Vite proxy already targets port 8000.
All these routes now live on one backend. If the browser sends an Origin header,
add its exact frontend origin to FRONTEND_ORIGIN in person4/.env. Example local origins:
FRONTEND_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
For Codespaces use the actual forwarded frontend URL, with no trailing slash.
CORS does not provide authentication. Keep this service private and use demo data.

| Method | Path | Function |
| --- | --- | --- |
| GET | /health | Unified server and database status |
| GET | /api/forecast | Existing Person 2 format, cached for 10 minutes |
| GET | /api/water-updates | Existing Columbia Water public RSS reader |
| GET | /api/insights/health | Existing savings API status |
| POST | /api/insights/evaluate | Existing validated savings contract |
| POST | /api/insights/chat | Existing plan-specific Gemini explanation |
| POST | /api/insights/community | Existing coincident community grid impact |
| POST | /api/household/profile | Create/update household profile |
| POST | /api/household/readings | Import validated daily consumption |
| GET | /api/household/report?householdId=demo-home | History, costs, habits, peers |
| GET | /api/household/weather?householdId=demo-home | Weather, battery and solar advice |
| POST | /api/household/chat | Grounded household Gemini explanation |

Profile example (POST body):

```json
{"householdId":"my-home","occupants":3,"floorAreaSqft":1600,
 "latitude":34.0007,"longitude":-81.0348,"timezone":"America/New_York",
 "region":"Columbia-SC","peerOptIn":false,"batteryCapacityKwh":13.5,
 "startingSocPct":60,"reservePct":20,"essentialLoadKw":0.55,
 "backupGoalHours":8,"maxBatteryPowerKw":3,"solarCapacityKw":5}
```

Reading import example (POST body):

```json
{"householdId":"my-home","readings":[
 {"date":"2026-10-10","utility":"electricity","quantity":24,
 "unit":"kWh","unitRateUsd":0.18,"source":"observed"}]}
```

Dates describe complete local calendar days in the household's declared timezone.
For storage only, a local day's label is encoded as midnight UTC; it is NOT an actual
meter measurement instant. Imports must be daily consumption amounts, not cumulative
meter counters. Supported units: kWh, US gallons (gal), therms. Rates are optional.
Do not upload incomplete current-day totals as complete days. Duplicate dates replace
previous entries. A mixed observed/simulated 28-day window is not compared.

CSV import after saving the household profile:

```bash
python3 -m person4.import_history my-home /path/to/daily-usage.csv
```

Columns: date,utility,quantity,unit,unitRateUsd,source. Example file in fixtures.
JSON can contain a readings list or {"readings":[...]}. Batch max 1500 records/1 MB.

Household chat (POST body):

```json
{"householdId":"demo-home","question":"Why did my water costs increase?",
 "includeWeather":true}
```

includeWeather defaults false to avoid unnecessary upstream calls. Asking a weather
question with false does not give Gemini live weather. Use true or retrieve /weather
first. A combined report supports ?householdId=demo-home&includeWeather=true.
Every response distinguishes gemini from local_rules and carries its computed evidence.

## Analysis and honest limits

- A full comparison needs 28 consecutive daily observations: latest 7 versus previous 21.
- An increase is flagged only above 30% and 3 baseline standard deviations, with a 10%
  baseline-mean floor. This is a transparent heuristic, not trained anomaly detection.
- Costs decompose differences into usage and rates, from supplied linear unit rates.
  Full bills, fixed fees, tax, sewer formulas and tiered tariffs are not reconciled yet.
- Peer comparisons require explicit opt-in and at least FIVE other eligible profiles:
  same region/timezone, occupancy within one person, area within 25%, aligned source/dates.
  Only aggregate statistics are returned, not peer IDs or individual readings. Household
  equipment differences and weather normalization are not accounted for yet.
- Daily data cannot identify overnight continuous flow or confirm an appliance/gas leak.
- Weather and NWS are reused from Person 2, with cache/source labels and no invented outage
  probability. Weather failures never turn synthetic solar output into a live estimate.
- Battery advice uses supplied current SOC/capacity and a constant essential load at 90%
  efficiency. It checks capacity AND output-power feasibility. No physical control exists.
- Solar estimates are irradiance based; panel orientation and shading are not calibrated.
- six demo households and 756 readings are synthetic, not actual neighbors or real meters.
- This is a private hackathon server: no authentication, accounts, tenant isolation or
  production deployment yet. Peer queries scan at most 100 profiles; household history
  reads at most 1500 records. Savings plan IDs still expire on process restart.

## Remaining backend work

The existing forecast's rolling 24-hour dispatch is NOT automatically passed into the
single-calendar-day savings evaluator. It uses different efficiency/terminal-energy
assumptions and rounded values; do not claim its demo savings are the validated savings.
Next build one timestamped schedule contract with duration, exact charge/discharge and
ending energy, then adapt Person 3's battery decisions to it. MW/MWh must convert to
kW/kWh. Keep the authoritative costs in calculations.py. Hourly usage/leak checks,
weather-normalized comparisons, full bill parsing and actual utility connections are
future additions, not implemented by this package. See SAVINGS_CONTRACT.md for the
unchanged legacy plan schema and fixtures.

## Validation

53 tests pass: 28 original plus 25 upgrade tests. Local child-server checks verified
persistent SQLite, history reports and existing savings routes. Gemini request shapes,
weather failure handling and Tiger SQL/adapter behavior are tested with mocks. A live
Tiger Cloud instance and live household Gemini/weather calls need your credentials /
network and MUST be verified with the provided commands before claiming success.

## File ownership and commits

All new implementation is under person4. No frontend or Person 3 battery code is edited.
The three shared forecast files are restored verbatim from Person 2's branch during setup.
Commit only your backend after successful checks:

```bash
git add person4
git commit --only -m "Add household insights and optional Tiger Data backend" -- person4
git push origin feature/insights
```

Do not commit database files, .env, connection URIs or review ZIPs. Coordinate the shared
forecast file merge with your frontend/forecast teammate; those paths may show separate
local changes after restore and are intentionally not included in the commit above.

## Sources checked October 10, 2026

- https://www.tigerdata.com/pricing
- https://docs.snowflake.com/en/user-guide/admin-trial-account
- https://ai.google.dev/gemini-api/docs/pricing
- https://www.tigerdata.com/docs/learn/hypertables/creating-and-configuring-hypertables
- https://open-meteo.com/en/pricing
- https://www.weather.gov/documentation/services-web-api

Recommendation: optional Tiger Data for genuine utility-history storage plus Gemini
for explanation. Snowflake adds warehouse/account setup without a necessary role in
this small operational demo, so it is not included. Trial eligibility is not permanent
free hosting or a guarantee of sponsor-prize eligibility.
