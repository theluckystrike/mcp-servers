# RATING-S45 — Organic Traffic Disruption + MCP Visibility

STATUS: complete
Closed: 2026-09-19 (wave 1 + wave 2)

## Score: 8.5/10

## What landed (all verified)
- **MCP Playground: 42/42 estate submitted.** Wave-1 6 + wave-2 36, every one
  double-confirmed (200 success:true + 409 already-submitted). Resumable script
  docs/submit_w2.mjs; 120s backoff rode out sustained 429 rate limiting. Zero failures.
- **Search-crawler fan-in (T6 w2):** rotating 8-sibling "More servers" block on all 42 /s
  pages — 336 new internal links seeded from the 16 URLs Googlebot demonstrably crawls.
  Deploy 588c5be4, live-verified (block renders, sibling links correct), IndexNow 193/193.
- **Wave 1:** T1 /compare+/setup fan-in, T3 sitemap/OG, T4 GitHub README fix, T5 guide
  mesh (109 guides, 13 clusters, symmetric), T6 measurement hardening.
- **KPI 10/32 met** (baseline 9). GSC first-ever 10 impressions. 193/193 sitemap URLs
  crawled by some client; 192 by search/AI crawlers.
- **Outreach (held):** 5 drafts awaiting user green-light — R1 3, R2 3 replies with S45
  proof points, w2 3 new (Reddit/HN value post, modelcontextprotocol/registry
  Discussions post, R2 addendum).
- Dashboard session #96, 875 commits, 27 loops.

## Why not 9+
- Googlebot still 16/193 (8.3%) and bingbot 3/193 — fan-in waves shipped but the
  re-crawl response is unmeasured until next window. GSC/Bing verification still
  human-gated. Outreach still frozen (0 posted). 0 paid sessions.

## Measured deltas (7d window, data/traffic.json)
- Googlebot 2 → 16 URLs (+700%). Humans 6,396 render-proven requests.
- Tenants 815 (+16). GitHub 3,596 clones/14d, 0 stars. Paid 0.
- Amazonbot 91.2%, Barkrowler 83.9%, Semrush 80.3% coverage — the estate is crawlable;
  the gap is specifically search-engine discovery (GSC gate).

## Platform recheck (T3 w2)
- Glama: 13 theluckystrike servers listed; invoice/spreadsheet/bank-statement NOT under
  expected slugs (404 on slug probes) — targeted follow-up next sprint.
- mcp.so #4227/#4228 OPEN 0 comments; listings 404 (control passed, not-listed).
- mcpmux PR #300 OPEN, mergeable, 0 comments.
- Bing site: operator broken via curl AND browser (control also fails) — phrase search
  shows 73 indexed references instead. Treat site: counts as unmeasurable.
