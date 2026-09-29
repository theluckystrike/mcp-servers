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

## Verification (2026-09-29, orchestrator fact-check of distribution subagent claims)

Commands: gh api repos/abordage/awesome-mcp/contents/repositories.yaml / README.md (base64 decode, grep); gh compare 899f1dd5...31296b4c; gh api commits?path=README.md; star histogram from README text.

1. **REGRESSION claim ("abordage entry GONE post-merge") = WRONG.**
   - repositories.yaml on main RIGHT NOW contains all 6 theluckystrike entries
     (grep -c theluckystrike = 6). The 09-14 merge ab41f5ff (PR #106) is intact,
     nothing removed it. Commits?path=README.md show daily "Update README [auto]".
   - The subagent grep'd README.md only and concluded deletion. Actually the README
     is an auto-generated RANKED render that only shows ~1419 of 2136 yaml URLs and
     filters low-star repos (min star rendered = 16). Our 0-star repos are kept in
     yaml (the machine-readable source) but cut from the README render.
   - Actionable lever, NOT a regression: stars >= ~16 would re-include us in the
     rendered README. Real fix = organic stars, never bought (conventions).
2. Other claims spot-checked OK: PR 72 mcpHQ merged 09-23; Albertchamberlain PR 52
   merged 09-18 (3 zovo hits); Glama 8 real badges / 4 not listed.
