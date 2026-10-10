# Wattch Person 2 — Live Forecast Frontend Integration

This ADDITIVE package introduces `frontend/src/features/forecast/ForecastLivePage.jsx` and `forecastLive.css`. It does **not** overwrite the existing `ForecastPage.jsx`, the forecastEngine.js demo model, or Person 1's dashboard. It expects those existing frontend feature files to be present.

## Installation

From `/workspaces/Wattch` after uploading ZIP:

```bash
python3 -m zipfile -e Wattch_Person2_Live_Forecast_UI.zip .
```

In Person 1's React dashboard, import:

```jsx
import ForecastLivePage from './features/forecast/ForecastLivePage';
```

and render `<ForecastLivePage />` wherever the Forecast screen belongs. Adjust the relative import according to actual dashboard component location.

## VERY IMPORTANT: React frontend must forward `/api` to the backend

Start the Python API from the repository root:

```bash
python3 -m components.forecast_api
```

For a Vite frontend, Person 1 should add a proxy to the existing `vite.config.js` or equivalent, preserving other configuration:

```js
server: { proxy: { '/api': 'http://127.0.0.1:8000' } }
```

This is a partial config snippet, NOT a complete standalone `vite.config.js`. The Vite frontend server must be running in the same Codespace/network where port 8000 is accessible.

For Next.js, use a server-side rewrite/proxy route appropriate to their setup. Do **not** put backend API keys in client-side code.

## Functionality

- Default `Live forecast` fetches `/api/forecast?backup_reserve_pct=30`, refreshes when reserve slider changes or Refresh button is pressed.
- Shows live weather metadata and NWS warnings; rates, demand, solar estimates and battery dispatch remain clearly labeled modeled estimates.
- Correctly labels a rolling 24-hour forecast from the current hour, rather than assuming midnight.
- Clear, Cloudy, Storm demo scenario modes still work offline, using existing `forecastEngine.js`.
- If API fails, explicitly displays a warning and a labeled demo fallback instead of misrepresenting data as live.
- No additional npm dependencies beyond React and existing frontend setup.

## Common errors

- `404` from `/api/forecast`: Person 1 hasn't configured the frontend proxy or it's running on another host.
- Failed to fetch: Python backend isn't running, port routing is different, or frontend proxy is misconfigured.
- `Could not resolve ./forecastEngine`: the existing frontend feature files weren't included on this branch.
- `ENOENT package.json`: Person 1's frontend scaffolding hasn't arrived; don't run npm in an empty folder.
