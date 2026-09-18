# STRATEGY-43 — 2026-09-18 (continuation day, after Sprint 42 close)

## Situation (measured)
- 32 KPIs, 9 met. Biggest open: distribution surfaces 12/51, Googlebot 2/190,
  blind recommendation 0/18, mcp.so ingestion pending (#4227/#4228), MCP Market
  unconfirmed, EDNA email drafted but unsent.
- Sprint 42 ended d9307ee3. Tree clean, synced.

## Thesis
The estate's product metrics are healthy (validation 1192/1192, tenants 801,
checkout 100). The bottleneck is DISTRIBUTION: offsite surfaces and crawler
coverage. Sprint 43 is a distribution-heavy sprint with zero product churn.

## Tasks
- T1 MCP-Market verification: browser-verify whether Free Queue submission
  landed (curl is 403 bot-shield). Deliverable docs/T1_MCPMARKET_VERIFY_R1.md
- T2 EDNA email send: AppleScript/preview the Mac Mail draft, verify send,
  record in docs/T2_EDNA_SEND_R1.md (orchestrator-local, Mac-only).
- T3 Internal-link fan-in: ensure every /s/<slug> page links from >=1 guide or
  compare page (crawl path for Googlebot/ClaudeBot), resubmit sitemap via
  IndexNow. Deliverable docs/T3_LINKFANIN_R1.md
- T4 Crawler coverage probe: recheck ClaudeBot/Googlebot per-URL coverage from
  logs/KPI, list the 50 uncovered URLs, cross-check lastmod, resubmit delta via
  IndexNow. Deliverable docs/T4_CRAWL_R1.md
- T5 New directory sweep: identify and submit to directories not yet touched
  (site: census, absence-before-submission rule). Deliverable docs/T5_DIRS_R2.md
- T6 KPI refresh + dashboard + commit + push (orchestrator tail).

## Rules
- $0, no new accounts, never ping maintainers, no sleep/poll loops.
- Absence-before-submission: positive control before any zero claim.
- Every number carries its producing command.
- Human-gated items escalate (npm publish, GSC/Bing verify, Stars, CF Auto Minify).
