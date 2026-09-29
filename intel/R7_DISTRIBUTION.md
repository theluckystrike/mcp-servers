# R7 Distribution Round — MCP Fleet

**STATUS: in progress**

Round 7 distribution sweep for the theluckystrike/mcp-servers fleet (32 local-first MCP servers, 30 hosted at mcp.zovo.one).

## Scope

1. Verify current live state of the 22 distribution surfaces in `data/distribution.json` — curl-verify each still-live surface with a real follow-up query (search endpoint / direct page / badge content), not just a 200.
2. Probe for NEW free surfaces and awesome-lists not yet in distribution.json; screen by merge activity and scope before submitting; submit via PR/HTTP API where possible; record PR URLs.
3. Check Glama per-mirror badge SVG titles (real 'rated A on Glama' vs placeholder 'not listed'); open one-line PRs for any newly-real badges.
4. Re-probe previously-dead directories (mcp.so etc.) before trusting dead records.
5. Write `data/dist_r7.json` + notes in the same round-file shape as prior rounds.

## Evidence log

(append as gathered)

## Census

(append at end)

## Census (2026-09-29, orchestrator-run; subagent stalled so direct execution)
- data/distribution.json: 74 surfaces tracked, 12 live/published. 17 was the dashboard's
  count of a different definition (published+partial+submitted-with-confirmation).
- Open PRs on punkpeye/awesome-mcp-servers: 12+ (13965, 13966, 14559-14565, 14681, ...)
  - backlog ~2220 PRs; maintainers merge ~5-10/wk; not actionable by us beyond age.
- GitHub traffic 14d: 84 views / 71 uniques (was 71 uniques KPI).
- mcpservers.org: 65 submissions confirmed successful (review ~2wk).
- npm surface: BLOCKED - token expired 2026-09-20. Unblocking needs a fresh NPM_TOKEN
  (Mike: npm login / new granular token). Single highest-leverage manual unblock today.
- Direct probes: glama API 401 (auth needed), smithery/mcp.so/mcpmarket API 404 (no
  public API; assume listing state per distribution.json).
