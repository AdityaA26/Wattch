# Team and development credit

Wattch was built by a four-person team at PalmettoHacks 2026 and won **[MLH] Best Use of Tiger Data**. The award and team roster are recorded in the [Devpost submission](https://devpost.com/software/wattch-3tw1fh).

| Teammate | Work recorded in the development history | Evidence |
| --- | --- | --- |
| [Aditya Anandkumar](https://github.com/AdityaA26) | Battery autopilot and grid-event logic, shared demo scenarios, ESP32 smart-breaker simulation and hardware design documentation | [`feat-battery-grid-mode`](https://github.com/AdityaA26/Wattch/commits/feat-battery-grid-mode), hardware files and documentation |
| [Nihal Katta](https://github.com/NihalK321) | Forecast and resilience backend, React household and utility dashboards, vacation mode, account/equipment views, and final demo snapshot integration | [`feature/forecast`](https://github.com/AdityaA26/Wattch/commits/feature/forecast), final snapshot commit |
| [Neeshan Syed](https://github.com/SYED-NEESHAN) | Initial Streamlit utility dashboard and early presentation of costs, usage insights and storm reserve | [`e68dad9`](https://github.com/AdityaA26/Wattch/commit/e68dad9e21d8521a9983b9749a981b97bb00e70e), retained `legacy/battery-demo/app.py` prototype |
| [Kartikeya Pendem](https://github.com/kartikeya1107) | Python household-analysis backend, TigerData and Gemini integration, savings/grid calculations, shared data integration, and final frontend/backend polish | [`polish/final-demo`](https://github.com/AdityaA26/Wattch/commits/polish/final-demo) |

These areas overlap. The table credits the work visible in the repository; it does not rank effort or imply that one teammate built the complete project alone. Team members also collaborated on debugging, testing, preparation and presentation.

## How the histories are preserved

The final demo was initially copied into `main` as a snapshot. That preserved the working files but left original development commits on side branches.

The attribution update joins `polish/final-demo`, `feature/forecast` and `feat-battery-grid-mode` to the final snapshot as commit parents. It preserves the existing commit IDs and authors. Earlier Streamlit and forecast iterations remain part of the history; the working application uses the final React/Python implementation.

The audit identified 26 original commits across these histories, including 15 that were not reachable from the original final `main`. No original commit is rewritten or reassigned. GitHub may take time to refresh contributor statistics after the histories are joined.

## Future changes

- Use an email linked to your GitHub account when committing.
- Credit shared work accurately in the README and pull request.
- Use a merge commit when preserving a teammate's original development history is the goal.
- Keep API keys, database credentials, local runtime databases and dependency folders out of commits.
