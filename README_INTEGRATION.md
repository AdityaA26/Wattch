# Wattch integrated demo

This additive package connects the existing React dashboard to the unified Person 4 backend.
It was prepared from these exact uploaded Git snapshots:

| Branch | Commit |
| --- | --- |
| main | 0ec4086b28d8b480ee702262d36e13d21565c06e |
| feature/insights | 3b558f46b5ab26606b755939b003d09bae9ad7f1 |
| feature/forecast | 42079075c3c09719e5fe3721bdb239f1a1f2a0aa |
| feat-battery-grid-mode | e68dad9e21d8521a9983b9749a981b97bb00e70e |

## What is connected

- The dashboard's Insights route now shows stored household usage reports, the grounded household assistant, weather/backup advice, validated savings reference scenarios, and coincident community grid impact.
- The default analysis displays the existing `demo-home` seed. It is labeled as a separate synthetic household, not as the selected home's actual history or sample bills.
- Selected-home analysis maps browser profile fields to a separate backend ID. A home without readings displays missing data. Its explicit sample-import button creates 42 days of labeled synthetic history; it is hidden once any history exists.
- Assistant replies identify actual Gemini responses or local-rule fallback. API errors and unavailable weather are visible.
- Savings compares fixed reference plans using the existing Python evaluator, including wear and equal ending stored energy. Monthly numbers repeat one day and are not forecasts. These reference scenarios are not dynamically generated for the selected home's equipment.
- Community demand is summed at common hours before finding the peak. The page displays the two supplied reference assets, not connected houses.
- The shared forecast API is the newer version from `feature/forecast`; it accepts latitude, longitude and timezone that the React dashboard sends.
- Vite forwards `/api` to the backend on port 8000. Same-origin frontend requests become server-to-server proxy requests; the browser Origin header is removed at that proxy boundary. The backend's direct browser-origin checks remain intact.
- The older battery branch's Streamlit source is preserved under `legacy/battery-demo/`. Its MW/MWh building-scale prototype is not used for the React household's kW/kWh savings calculations. The React Energy Optimization and forecast dispatch remain the household battery view.

## Apply to the current insights branch

Start from your clean `feature/insights` checkout at the uploaded commit. The provided package contains the entire uploaded frontend snapshot plus the new integration files. If your teammate has made newer frontend edits since commit `4207907`, keep those edits and reconcile the app import and Insights route instead of overwriting their work.

Upload `Wattch_Integration_Patch.zip` to the repository root. In the backend terminal press Control+C once. In the bash terminal:

```bash
cd /workspaces/Wattch
git switch -c integration/full-demo
python3 -m zipfile -e Wattch_Integration_Patch.zip .
cd frontend
npm ci
```

The ZIP contains no `person4/.env`, backend source replacements, database, node_modules or build output. Your existing Gemini/Tiger Data settings and the verified prompt/reliability code stay in the checkout.

Restart the backend in its original terminal:

```bash
cd /workspaces/Wattch
python3 -m person4.server
```

Leave it running. In the bash terminal:

```bash
cd /workspaces/Wattch/frontend
npm run dev -- --port 5173
```

Open the Ports panel and open port 5173 in the browser. Keep both ports private. This demo has no real authentication or hardware control. The frontend and Python backend must run in the same Codespace for the proxy to reach port 8000.

## Demo walkthrough

1. Open Insights > Usage & AI. Read the explicitly synthetic electricity/water changes. Ask why water usage rose and inspect the actual provider label.
2. Select Selected home. A new home has no readings; use Load synthetic readings to populate a labeled sample. Switching homes keeps their backend IDs and histories separate.
3. Check weather & backup. The existing backend uses live feeds when available and reports incomplete data when a feed fails. Sample-home context uses the seeded profile; Selected-home context uses the browser profile with an assumed 0.55 kW essential load and 8-hour goal.
4. Open Savings simulator. Compare peak-shifting, flat-price and high-wear references. The high-wear stress test supplies a $0.50/kWh wear allowance so the same dispatch has a negative cost difference. It does not claim measured degradation. Inspect fair ending energy and daily differences.
5. Open Grid impact. Explain the baseline versus planned coincident peaks and event energy avoided for two synthetic assets.
6. Open Energy Optimization. Its existing personalized rolling weather/dispatch view now accepts location parameters on the unified server.

## Verify in Codespaces

The prepared package passed 73 existing Python tests, 9 JavaScript tests, and a production frontend build. Headless-browser checks exercised seeded usage, local-rule fallback, profile mapping, sample import, switching homes without sharing history, incomplete weather, positive/zero/negative reference savings, community aggregation, the location-aware forecast, and mobile layout. No API request failed in that walkthrough.

Use a third terminal while the two servers are running:

```bash
cd /workspaces/Wattch
python3 -m unittest person4.tests person4.tests_upgrade person4.tests_gemini
python3 -m unittest discover -s tests -p 'test_*.py'
node --test tests/*.mjs
cd frontend
npm run build
```

This environment can verify the original configured live integrations with:

```bash
cd /workspaces/Wattch
python3 -m person4.upgrade_check --live-weather
```

Local review used isolated SQLite and offline weather to exercise fallback behavior; no personal Gemini key or Tiger Data URI was provided to the reviewer. Your earlier Codespace live checks verified those services. Recheck the displayed provider/storage/source labels when demonstrating the integrated browser flow.

## Commit after browser review

```bash
cd /workspaces/Wattch
git add frontend components/forecast.py components/forecast_api.py components/local_updates.py tests legacy README_INTEGRATION.md .gitignore
git commit -m "Connect dashboard to household AI savings and grid impact"
git push -u origin integration/full-demo
```

The uploaded ZIP itself is not staged by those commands. Coordinate the final integration branch with teammates before merging newer work into main.
