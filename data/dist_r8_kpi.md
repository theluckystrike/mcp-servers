# dist_r8 — KPI Refresh (2026-09-22)

STATUS: in progress

## 1. Google Search Console — sc-domain:zovo.one

- Window: (pending)
- Totals: (pending)
- mcp.zovo.one filtered: (pending)
- Top 10 queries: (pending)
- Top 10 pages: (pending)

## 2. PR audit vs dist_r7

- 12 open PRs in dist_r7.json, 8 merged cumulative at r7.
- Merged since r7: (pending)

## 3. Probes

- https://mcp.zovo.one HTTP status: (pending)
- glama.ai listing presence: (pending)

## KPI table vs r7

| Metric | r7 | r8 | Δ |
|---|---|---|---|
| GSC clicks | 59 | (pending) | |
| GSC impressions | 4855 | (pending) | |
| mcp clicks | 0 | (pending) | |
| mcp impressions | 19 | (pending) | |
| PRs merged | 8 | (pending) | |
| mcp.zovo.one HTTP | (pending) | | |
| glama.ai listed | (pending) | | |

## Verdicts

- (pending)<!-- r8 measured results (orchestrator-verified, node /tmp/gsc_r8_pull.mjs 2026-09-22) -->
Window: 2026-08-22 → 2026-09-19
Totals: 55 clicks / 4704 impressions (site-wide; r7 was 59/4855)
mcp.zovo.one: 0 clicks / 19 impressions / 8 days with impressions
Top mcp query: "site:zovo.one" (0 clicks, 8 impr, pos ~2.9)

| Metric | r7 | r8 | Δ |
|---|---|---|---|
| GSC clicks | 59 | 55 | -4 |
| GSC impressions | 4855 | 4704 | -151 |
| mcp clicks | 0 | 0 | = |
| mcp impressions | 19 | 19 | = |
| Landing surface | none | LIVE (/, /s/*, sitemap, robots) | NEW |

Verdicts:
- ORGANIC STALLED: mcp.zovo.one had zero indexable surface until today — root now serves SEO landing + full sitemap (/s/* all 47, /guides/*, /compare/*). Expect first mcp-host clicks within 1-2 crawl cycles.
- DIRECTORY: 7 new free surfaces found (data/dist_r8_discovery.md); mcp.directory + mcpservers.org top priority; mcpservers.org already auto-indexing us.
- MONETIZATION: estate already fully gated (41/47 billable, $19/$39). SERVER_COUNT corrected 41→46 (2 files), license tests 20/20 green. Next: submit to 7 new directories; per-server SEO pages for uncontested keys (petty-cash, per-diem, mileage-log...).
