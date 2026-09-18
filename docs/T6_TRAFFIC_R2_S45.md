# S45 T6 — Traffic re-measure (2026-09-18 ~12:35Z)

## Headline: Googlebot 2 -> 16 URLs (+14, 8.3% of 193)
Producing: node scripts/traffic.mjs && node -e "... filter sitemap_pages crawlers.Googlebot"
Googlebot hit: /, /bundle, /guides, /guides/index, /mcp/connect, /s/invoice, /s/job-card,
/s/bill-of-sale, /s/currency, /s/dunning-letters, /s/credit-note, /s/packing-list,
/s/service-agreement, /compare/invoice, /setup/claude-web, /guides/mcp-server-free-vs-pro,
/guides/mcp-server-not-showing-up-in-claude-desktop

## Crawler URL coverage (7d, 193 sitemap URLs)
- Amazonbot 176 (91.2%), Barkrowler 162, SemrushBot 158, DotBot 138, meta-externalagent 101
- YandexBot 59 (30.6%), Applebot 41 (21.2%), ClaudeBot 25 (13%), Googlebot 16 (8.3%), GPTBot 15 (7.8%), bingbot 3 (1.6%) 7d-window
  (bingbot 3 is the 7d slice; S44 T2's 35 was cumulative — different window, not a decline signal)
- NOTE: PerplexityBot low too (9). Assistant/SE crawlers have full catalogue via IndexNow; Google/GPT need links.

## Humans
- render-proven browsers: 125 URLs touched (strict), 175 loose
- data/gsc.json now written by traffic.mjs (GSC channel OK)

## Actions taken
- traffic.json refreshed (2026-09-11 -> 2026-09-18 window)
- mcp.so recheck: issues #4227/#4228 still OPEN, 0 comments, not ingested (11h since filing) — too early
