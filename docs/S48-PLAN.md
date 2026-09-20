# S48 — MCP estate sprint plan (2026-09-20, orchestrator-led, multi-hour loop)

## Goal
Maximize organic visibility + monetization-readiness of the 42-server MCP estate
(mcp.zovo.one). Update dashboard + data after each measured unit.

## Measured starting state (data/kpi.json 2026-09-19, data/traffic.json, data/organic.json)
- Registry entries at latest: 42/42. Findable share: 50%. Dist surfaces live: 14.
- Googlebot URL coverage 15/193 (7.8%). GSC impressions: 0. Blind-rec citations: 2.
- Human requests render-proven: 6,959/7d. Checkout: 100% reachable, 0 paid sessions.
- Site: 193 sitemap URLs, lastmod 2026-09-19, validation 1244/1244 green.
- S48 T23 (leave+onboarding site wiring) STATUS: in progress — must close first.
- Platform research (Desktop/platform-analysis-2026): Smithery 11,214 listed, 66% zero-use;
  win = discoverable niche tokens, not head terms. CWS top slot median age 6.6y → new
  surfaces compound slowly; distribution breadth is the lever.

## Wave 1 (parallel, 4 agents)
- T23 finish: leave+onboarding into facts.json/build-pages/manifests, README fixes,
  figures + indexnow, build vs deploy verify, docs/T23_DISTRO_S48.md -> verified-green.
- T24: mcpservers.org free form submissions (all servers, no account) + percall.dev refresh.
  Evidence docs/DIST_R27_S48_T24.md.
- T25: llmstxthub.com PR (llms.txt) + llmstxt.site free form. Evidence docs/DIST_R28_S48_T25.md.
- T26: re-measure organic (registry rank via /v0/servers search), run kpi.mjs + traffic.mjs,
  refresh data/, docs/ORGANIC_R4.md.

## Wave 2 (orchestrator, after wave 1)
- Root dashboard DASHBOARD.html + data refresh; commit; wrangler deploy; sound notify.
- Queue next-win candidates from measured deltas (paid-session funnel, more servers).

## Honesty gate
No invented numbers; blocked = blocked with exact error. Verify child claims before reporting.
