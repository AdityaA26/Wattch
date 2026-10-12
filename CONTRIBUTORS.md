# Team and development credit

Wattch was built by a four-person team at PalmettoHacks 2026 and won **[MLH] Best Use of Tiger Data**. The [Devpost submission](https://devpost.com/software/wattch-3tw1fh) records the award and team roster.

| Teammate | Contribution areas | Development evidence |
| --- | --- | --- |
| [Aditya Anandkumar](https://github.com/AdityaA26) | Battery autopilot and grid-event logic, shared demo scenarios, ESP32 smart-breaker simulation and hardware design documentation | [Battery and grid development](https://github.com/AdityaA26/Wattch/commits/48bf199356af960a8a8cf0f7d8f36d2ed1e5d80e), [hardware source submission](https://github.com/AdityaA26/Wattch/commit/3cc50b22aa7a33ac178a0796b86b1fc16251d901), [design diagram](https://github.com/AdityaA26/Wattch/commit/a9628c319bf09455b3c00cc7adccf71f47d9cdee); [current hardware source and documentation](hardware/smart-breaker/README.md) |
| [Nihal Katta](https://github.com/NihalK321) | Forecast and resilience backend, React household and utility dashboards, vacation mode, account/equipment views, and final demo snapshot integration | [Forecast backend](https://github.com/AdityaA26/Wattch/commit/ce881a16fd2ae9faf51652642b0a682f0f7af65d), [dashboard development](https://github.com/AdityaA26/Wattch/commits/42079075c3c09719e5fe3721bdb239f1a1f2a0aa), [final app integration](https://github.com/AdityaA26/Wattch/commit/475483c211387b07e517da7ff9e751e7f6cd7491) |
| [Neeshan Syed](https://github.com/SYED-NEESHAN) | Frontend/backend feature planning and requirements, initial Streamlit utility dashboard and early presentation of costs, usage insights and storm reserve, and Devpost hackathon submission preparation | [Streamlit dashboard](https://github.com/AdityaA26/Wattch/commit/e68dad9e21d8521a9983b9749a981b97bb00e70e), [retained prototype](legacy/battery-demo/app.py); feature planning and submission preparation reported by the team, with the [completed submission](https://devpost.com/software/wattch-3tw1fh) |
| [Kartikeya Pendem](https://github.com/kartikeya1107) | Python household-analysis backend, TigerData and Gemini integration, savings/grid calculations, shared data integration, and final frontend/backend polish | [Household AI and backend development](https://github.com/AdityaA26/Wattch/commits/3b558f46b5ab26606b755939b003d09bae9ad7f1), [dashboard/backend integration](https://github.com/AdityaA26/Wattch/commit/b476323dfa257a3d6c6a916e013e6e0678382f50), [final demo and polish](https://github.com/AdityaA26/Wattch/commits/07c5a78c5961c4702611dcf5fe3ac2a90308472e) |

These areas overlap, and the team also collaborated on debugging, testing, demo preparation and presentation. The links show representative development milestones; commit counts do not measure each person's overall contribution. Planning and submission work is credited alongside code.

## Preserved development history

The original battery/grid, forecast/interface, household-analysis, integration and final-polish commits are all included in `main`. [The history-preservation merge](https://github.com/AdityaA26/Wattch/commit/ae105facf7d434dc06c7415bd4a7c2d603d9b675) retained the original commit IDs and authors while keeping the finished application. Earlier iterations remain available in the history; the current app uses the final React/Python implementation.

## AI-tool attribution

The human project team is the four people above. GitHub also lists Copilot because [an original battery-integration commit](https://github.com/AdityaA26/Wattch/commit/48bf199356af960a8a8cf0f7d8f36d2ed1e5d80e) includes a `Co-authored-by: Copilot` trailer.
