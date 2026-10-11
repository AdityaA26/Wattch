# Final Wattch demo handoff

This patch is based on the full working copy at commit `b476323dfa257a3d6c6a916e013e6e0678382f50`, branch `integration/full-demo`. It contains changed/new application files and docs. It excludes `.env`, credentials, runtime databases, dependencies and build output.

## Install in your existing Codespace

1. Stop the old backend terminal with **Ctrl+C**.
2. Upload `Wattch_Final_Demo_Patch.zip` into the Codespace's `/workspaces/Wattch` folder using the file explorer.
3. Run from the repository root:

```bash
cd /workspaces/Wattch
git status --short
git switch -c polish/final-demo
unzip -o Wattch_Final_Demo_Patch.zip -d .
npm ci --prefix frontend
npm run build --prefix frontend
python3 -m person4.server
```

Open **port 8000** in the Codespaces Ports panel. It now opens the entire app, rather than a backend JSON page. Keep this terminal running. Your saved `person4/.env`, working Gemini model and Tiger database connection are left in place. If the branch already exists, switch to it instead of creating it again.

The Vite workflow on port 5173 remains supported for editing. Use port 8000 for the built demo to avoid needing two running servers. After editing the frontend, run the build again and refresh the browser.

## Check the configured demo once

- Home: selected name and five utility estimates appear; the energy summary finishes loading.
- Insights: electricity and water comparisons match that home. Ask one relevant question; confirm **GEMINI + model name** in the reply if the provider is available.
- Search `battery`: choose **Electricity → Home battery**. Current charge is fixed, with no charge slider.
- Energy → Savings: standard time-of-use plan shows its computed result. Switching to flat rate or high wear should skip uneconomic cycles; zero savings is valid.
- Insights → Weather: inspect live source labels. Missing weather is explicitly unknown, not all-clear.
- Add or switch a home: the selected home's readings, equipment, payments and reminders stay scoped to it.

Do not repeatedly run live Gemini checks; identical successful questions can be cached and the model's project quota is shared. Key and quota problems are separately labeled. The app remains usable with a visibly labeled local evidence answer.

## Save the verified version

Run in a second terminal after checking the app:

```bash
cd /workspaces/Wattch
git add frontend person4 tests README.md README_FINAL_DEMO.md
git diff --cached --stat
git commit -m "Polish shared household demo and validated energy planning"
git push -u origin polish/final-demo
```

The repository's ignore rules exclude local `.env` files, runtime data and dependencies. Review the staged file names before committing. Use the pushed branch for team review, then merge your verified version through your usual GitHub workflow.

## A focused 2–3 minute demo

1. **Household problem:** Home shows one home's combined operating cost and two usage checks. Explain that daily readings power every view.
2. **Useful insight:** Ask why water use increased. Show the recent 7 days versus prior 21, distinguish a usage signal from a confirmed leak, and show Gemini's source badge when live.
3. **Preparation:** Open Weather in Insights. Show official alert and live-feed labels. Open the energy plan to inspect the supplied backup goal and required reserve.
4. **Defensible economics:** Energy → Savings shows baseline, planned cost, wear and equal ending battery energy. Show flat-rate or high-wear zero savings, then restore the standard scenario.
5. **Grid fit:** Grid impact models similar homes on the same timeline. Show relief at the baseline peak hour and the planned full-day peak, including charging. Explain that the community is hypothetical.
6. **Complete workflow:** Briefly show subsection search, fixed battery reading, a second home, equipment or CSV import. Finish on Home.

If time is short, prioritize steps 1–5. Test the browser and screen recording before presenting; keep the backend running and avoid last-minute dependency/model changes.

## Honest scope for judging

Wattch demonstrates a working household decision loop and a simulated grid-coordination scenario. Daily data can be persisted in Tiger/TimescaleDB, and Gemini is grounded in computed evidence. Weather uses external live feeds when available. Billing fees, tariffs, appliance circuits and community participation are examples; no physical equipment is controlled.

Based on the supplied track guide, the project fits **Boyd Startup Ready** and **SCRA Grid Modernization**. Dominion's separate utility-pole image-analysis brief is not implemented by this project. Gemini and Tiger bonus claims should use the actual configured live demonstration.

The supplied guide requires a public repository and demo video for submission. A local browser presentation can demonstrate the app; a pushed repository does not itself host the running backend. The single-server build prepares one app port for later hosting, but no public deployment or authentication was added by this patch.

Potential follow-up work: authorized meter integrations, verified tariffs, authentication, actual enrolled grid assets and hardware control. Keep those separate from the MVP's completed capabilities.
