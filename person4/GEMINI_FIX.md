# Gemini temporary-overload fix

Google returned HTTP 503 UNAVAILABLE (high model demand). This patch retries transient
500/502/503/504 errors once, then tries gemini-3.6-flash only when the selected model
is gemini-3.8-flash. At most three calls, with one second before the retry. Quota/auth
errors (429/401/403) are not retried and other explicitly configured models are never
silently changed. Both plan and household chat return the actual responding model.
If both models fail, the existing explicit local_rules response remains available.
The backup currently has a free tier; the API project's billing tier still applies.

Upload Wattch_Gemini_Reliability_Fix.zip beside the repo README. Stop the backend
with Ctrl+C in its running terminal, then run:

```bash
cd /workspaces/Wattch
python3 -m zipfile -e Wattch_Gemini_Reliability_Fix.zip .
python3 -m unittest -v person4.tests_gemini
python3 -m person4.server
```

In a second terminal:

```bash
cd /workspaces/Wattch
python3 -m person4.upgrade_check --live-weather
```

The patch replaces assistant.py and household_ai.py from the earlier supplied upgrade
and adds the reliability helper/tests. No keys, database settings, or frontend files
are included. It is based on your previously uploaded person4 backend plus the upgrade;
back up subsequent edits to those two modules if you have made any independently.

Validation: 7 retry/backup tests and all 53 earlier tests pass (60 total), using mocks
for external Gemini calls. Live service availability must be checked in your Codespace.
A backup model can also be unavailable; this patch improves resilience, not guarantees
of external API uptime. After a successful live check, commit only person4.

Sources verified October 10, 2026:
https://ai.google.dev/gemini-api/docs/troubleshooting
https://ai.google.dev/gemini-api/docs/pricing
