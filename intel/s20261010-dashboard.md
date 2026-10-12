# s20261010-dashboard — main HTML dashboard build

STATUS: complete

## What was built
- `/Users/mike/mcp-servers/index.html` — the single main estate dashboard, regenerated from `data/*.json`.
- `/Users/mike/mcp-servers/scripts/build_dashboard.py` — build script; rerun with `python3 scripts/build_dashboard.py` after any session that refreshes `data/kpi.json`, `distribution.json`, `registry_publish.json`, `organic.json` or `gsc.json`. Static HTML, inline CSS, vanilla JS; all JSON baked in at build time (no fetch calls, works from file:// or any static host).

## What the dashboard shows
1. **Monetization funnel** — storefront human requests (6,181 / 7d) → anonymous hosted tokens minted (119) → hosted tenants with stored data (280) → checkout sessions from humans (97 of last 100) → **paid sessions (0, red)**. The 0-paid step is the broken link in the estate.
2. **Session log 2026-10-10** — what today's sprint did and found (dashboard build, KPI snapshot 10 met / 12 progress / 6 zero / 4 measured of 32, monetization drop-off diagnosis pointer to intel/s20261010-monetization.md, registry version drift 0/149 at release 0.22.5, GSC 57 clicks / 4,435 impressions).
3. **Next levers** — (1) close checkout→paid drop-off, (2) re-publish registry at 0.22.5 after npm token refresh, (3) confirm the 2026-09-28 submitted listings batch + clear 6 open PRs.
4. **KPI table grouped by category** (Discovery 12, Install 3, Activation 4, Value 3, Reliability 4, Monetization 6) with status pills: green=met, amber=progress, red=zero, grey=measured. Notable zeros: registry entries at latest (0/149), Google storefront impressions (0/1), blind-assistant naming (0/18), npm downloads (0/100), paid sessions (0/5), license keys (0/5).
5. **Distribution surfaces (74)** — status buckets: live/published 17, submitted/PR open 18, identified/other 16, blocked 9, dead/closed 7, skipped/n.a. 7; full per-surface table behind a details toggle.
6. **Registry / organic / GSC summary card** — latest publish run (0 published, 119 duplicates (already at version) at version), GSC window totals, storefront host probe (0 clicks / 20 impressions), organic scoring model note.

## Verification
- Build script ran clean: `Wrote index.html (40933 bytes); 32 KPIs, 74 surfaces baked in.`
- Embedded `const D = {...}` payload parses as valid JSON (Python re-extraction + Node parse both OK).
- Session log and funnel data confirmed present in the generated HTML by grep.

## How to update after the next session
1. Refresh the source JSONs in `data/`.
2. Edit the `session` block in `scripts/build_dashboard.py` (date, items, next_levers).
3. `python3 scripts/build_dashboard.py` — index.html regenerates in place.
