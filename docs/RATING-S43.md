# RATING-S43 — 2026-09-18

STATUS: closed (agent work 100% harvested)

## Score: 8.5/10

## Wins (verified)
1. T3 fan-in (biggest on-site lever): 15 slugs at 0-1 inbound -> 0 slugs at 0 inbound; 192 total internal links to 42 /s pages. Commits e419f5b0, 06d24445, 0fe4e237. Deploys 45b1beba, c91086cc. 152/152 tests.
2. T1+T6 MCPmarket: 12/42 listings CONFIRMED live (browser-verified; curl 403). Honest caveat: zero link equity (JSON-LD only, no dofollow); submit is repo-level only.
3. T5: mcpmux PR #300 OPEN + mergeable (new surface -> distribution 13/53).
4. T4: exact crawler sets recovered from data/traffic.json; 50-URL delta IndexNow 200.
5. T7: honest zero - Glama 12/42 flat; Glama public APIs now auth-gated (probing method documented).

## Misses
- mcp.so #4227/#4228 still not ingested (404 at reprobe).
- Googlebot 2/190 unchanged (human-gated GSC is the unlock).
- EDNA delivery unconfirmable locally (sent via AppleScript; watch for listing ~a week).

## Method learnings
- data/traffic.json sitemap_pages[].crawlers{} = exact per-URL crawler attribution; compute deltas from it, never estimate.
- mcpmux-style PR head refs: `<owner>:<branch>`, not `owner:repo:branch`.
- mcpmarket/mcp.so slugs are per-server, not per-repo.

## Human-gated backlog (unlocks real traffic)
GSC/Bing verification > CF Auto Minify toggle (ETag) > MCPmarket claim + source-repo links > npm publish > Stars > outreach posts (docs/outreach/R1+R2 drafts ready).

## KPI deltas this sprint
- Distribution surfaces: 12/52 -> 13/53.
- Internal fan-in: 0-inbound /s pages 15 -> 0.
- No regression in any of the 32 KPIs (9 met, unchanged).
