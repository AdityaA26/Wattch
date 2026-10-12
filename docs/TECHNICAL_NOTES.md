# Wattch technical notes

Wattch is a household utility and energy-planning MVP for PalmettoHacks 2026. It brings saved daily consumption, bill estimates, weather precautions, battery planning and a grounded Gemini assistant into one household workflow.

Choose a home once. Home, utility pages, Insights and Energy use that home's stored history and equipment. Empty demo homes receive labeled sample readings; CSV imports replace matching dates without silently rewriting other history.

## Run the complete demo

Requires Python 3.10+ and Node 18+.

```bash
npm ci --prefix frontend
npm run build --prefix frontend
python3 -m person4.server
```

Open **port 8000**. The Python server serves the built frontend and the API on the same host. In Codespaces, use the Ports panel to open port 8000 in a browser. Keep the server terminal running. If `PORT` is configured, use the printed port instead.

For frontend development, leave the backend running and use another terminal:

```bash
cd frontend
npm run dev -- --port 5173
```

Open port 5173 for Vite development. After frontend edits, rebuild before opening the single-server version again.

## Configuration

Local server settings are read from the ignored `person4/.env`. Do not commit keys or database credentials. Existing settings are preserved by the final demo patch.

- `GEMINI_API_KEY`: enables live assistant calls.
- `GEMINI_MODEL`: the model available to your project. Preserve a previously verified working model.
- `DATABASE_URL`: optional Tiger Cloud PostgreSQL/TimescaleDB connection. Install `python3 -m pip install -r person4/requirements-tiger.txt` when using it.
- `WATTCH_DB_PATH`: optional SQLite path. Without `DATABASE_URL`, daily history persists in `person4/runtime/wattch.db`.
- `PORT`: defaults to 8000.
- `FRONTEND_ORIGIN`: explicit additional permitted browser origins when needed. The built UI's own host is accepted; Vite uses its same-origin API proxy.

Tiger storage executes `create_hypertable` and daily `time_bucket` queries. It does not silently fall back to SQLite after a Tiger connection failure. Browser profiles, equipment, roles, reminders and demo payment state are browser-local; daily consumption and backend profile fields are stored on the server. Listed roles are a demo organization feature, not authentication.

## Main workflow

| Page | Purpose |
| --- | --- |
| Home | Shared household cost estimate, actionable usage checks, energy summary and bill outlook |
| Utilities | Five services, cost ledger, previous reading windows, projections and CSV reports |
| Electricity | Usage scenarios, tariff explanation, fixed battery charge reading, simulated circuits and solar equipment |
| Water | Conservation estimate, daily usage checks, consented peer comparison when available, official Columbia Water updates |
| Gas | Heating sensitivity and saved daily/seasonal history |
| Internet | Subscription scenarios, promotion dates, in-app reminders and provider links; no invented router telemetry |
| Waste | Cost scenarios and a household-specific pickup schedule |
| Insights | One household usage report, topic-focused AI questions, weather and official alerts |
| Energy | Validated 24-hour plan, fair savings comparison, hypothetical community grid impact and weather-based solar forecast |
| Import readings | Validated daily consumption CSV import for the selected home |
| Vacation | Active trips reduce modeled demand and protect the trip's reserve in the shared energy plan |
| Equipment / Settings / Account | Per-home equipment, location and backup goals; browser-local member organization |

Search finds specific subsections, including battery, circuit breaker, weather, savings and grid impact. Deep links use routes such as `#/electricity/battery`, `#/insights/weather` and `#/energy/grid`.

## Data import

Use this exact header, then one consumption row per day:

```csv
date,quantity,unitRateUsd
2026-10-10,21.5,0.18
2026-10-09,18.0,0.18
```

Choose electricity (kWh), water (gallons) or gas (therms) in Import readings. Rates are dollars per unit and may be blank. Use daily consumption, not cumulative meter counters. Files are limited to 1 MB / 1,500 rows. The complete batch is validated before storage. Imported observations remain user-supplied and unverified.

Anomaly comparison requires 28 consecutive comparable days with the same source: last 7 days versus preceding 21 days. Missing dates stay missing. Mixed sample/import windows are not diagnosed as anomalies. Peer comparisons require opt-in and at least five other matched households; there is no fabricated neighborhood average.

## Energy calculation

The new household scheduler derives a modeled hourly load shape from the home's saved daily average, combines it with weather-derived solar and an illustrative tariff, and passes every schedule through the independent savings evaluator.

The baseline holds charge and restores a higher required backup reserve. The proposed plan shifts use only when tariff differences cover round-trip losses and the wear allowance. Both cases use identical load, solar and rates, protect the same reserve, and end with the same stored energy. The heuristic first tries to trim the full-day peak with profitable charge/discharge pairs, then shifts additional profitable use. Additional cycle charging is capped at 90% of the baseline peak; required reserve restoration may prevent peak reduction. Reported grid metrics are the actual computed result, not a promised 10% reduction. The scheduler is a conservative heuristic, not an optimality claim.

Battery current charge is a fixed demo reading. Charge and discharge efficiencies are 90% per direction. The protected reserve includes the supplied essential-load backup goal; elevated live weather raises the minimum reserve to 50%. Infeasible power/energy goals and unavailable data are explicit.

Saved daily kWh is a load proxy in this model. Metered grid purchases can already reflect solar; gross demand and PV exports are needed to reconcile a real solar-equipped home.

Savings are projected operating costs, excluding fixed charges, taxes, demand charges and battery purchase cost. The 30-day savings figure repeats one 24-hour plan for 30 identical days. Grid scenarios represent 1, 5 or 20 hypothetical copies of this home, sum demand at common hours before finding peaks, and include charging hours. No physical devices, community enrollment or utility dispatch events are claimed.

## Gemini and weather behavior

Gemini explains computed evidence rather than inventing measurements or calculating unsupported savings. Exact repeated questions with unchanged evidence can reuse successful answers for 10 minutes. Quota and authentication failures are not retried. Overload retries remain bounded. Local fallback answers follow the requested topic and are visibly labeled.

Weather comes from Open-Meteo and official US NWS alerts. An unavailable feed does not imply all-clear. Solar estimates do not model roof orientation or shading. Columbia Water RSS updates are regional published information, not address-specific water-quality confirmation.

## Verification

```bash
python3 -m unittest person4.tests person4.tests_upgrade person4.tests_gemini person4.tests_dashboard person4.tests_demo_api
python3 -m unittest discover -s tests
node --test tests/test_wattch_ui_analytics.mjs tests/test_insights_bridge.mjs tests/test_dashboard_data.mjs
npm run build --prefix frontend
```

Automated tests use isolated storage and mocked providers; they do not spend Gemini quota. Browser verification covers the actual app in development and built-server modes, utility navigation, household isolation, CSV import, focused fallback responses, unavailable weather, flat/high-wear scenarios and mobile routes.

A **Gemini provider badge in a real reply** verifies a live call. A configured key or a local fallback does not. The final patch was tested without your private Gemini or Tiger credentials; verify one live reply on your configured Codespace after installation.

See [README_FINAL_DEMO.md](../README_FINAL_DEMO.md) for patch installation, the demo sequence and final handoff steps.
