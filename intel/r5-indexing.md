# R5 indexing check — 2026-09-26

Method: GSC sitemaps API (sc-domain:zovo.one, SA JWT). Bing SERP scrape bot-blocked (junk results) — used GSC + IndexNow receipts instead.

## Findings
- https://mcp.zovo.one/sitemap.xml : submitted 225, **indexed 0**, pending=false, errors=0. Google has NOT indexed any mcp.zovo.one URL yet.
- Bing: IndexNow accepted 228 URLs earlier today (R4 run, scripts/indexnow.mjs). Bing pipeline fed; wait for Bingbot.
- Sitemap freshly re-fetched by Google 2026-09-26 (zovo.one ones show lastDownloaded today) — sitemaps are being read, pages not indexed. Crawl budget/quality signal gap, not discovery gap.
- Cloudflare bot data (scripts/traffic.mjs): 226/228 sitemap URLs crawled by search/AI bot in last 7d — crawlers ARE visiting. Indexing is the bottleneck, not crawling.

## Crawl-gap action taken
1. IndexNow 228 URLs submitted (done in R4, accepted).
2. Discovery gap ruled out; next lever = internal-link depth from indexed domains (tg.zovo.one guides cross-links) + fresh content. 3 new buyer-intent guides live (R4).
3. No further autonomous lever for Google indexing (URL Inspection API is quota-limited to ~12/day; reserve for money pages).

## Verdict
Indexed: 0/225 (mcp.zovo.one, Google). Bing: submissions accepted, count not yet observable. Organic window: crawling healthy, indexing lagging — continue content cadence, do NOT re-submit already-accepted IndexNow URLs.
