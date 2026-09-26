# Bing Index Check — 2026-09-26

STATUS: complete (done directly; delegated agent stalled)

## Results
- Bing indexed count estimate: NOT OBSERVABLE — Bing SERP is bot-suppressed from this IP (site: query returns unrelated junk). GSC sitemaps API used instead: mcp.zovo.one sitemap = 0 of 225 URLs indexed in Google, errors 0, sitemap read by Google 09-26.
- IndexNow submission HTTP status: 200/accepted (earlier R4 run, scripts/indexnow.mjs) — 228 URLs submitted.
- URLs submitted: 228 (root, /bundle, /compare, /s/* products, guides incl. 3 new buyer-intent guides).
- Key used: db6dbf5c…145b (redacted, at https://mcp.zovo.one/db6dbf5cfdbc08d1cc9b5365d398145b.txt).

## Notes
- Crawling healthy (226/228 URLs hit by search/AI bots in 7d per Cloudflare data) — indexing is the bottleneck, not discovery.
- See intel/r5-indexing.md for full crawl-gap analysis.
