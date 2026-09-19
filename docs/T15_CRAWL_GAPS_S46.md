# T15 CRAWL GAPS S46

STATUS: complete

Internal-link + crawl-budget audit. Read-only plus this one data file. billing/src untouched. No em-dashes.

## 1. Sitemap classification (193 URLs)

Source: `curl -s https://mcp.zovo.one/sitemap.xml` -> 193 `<loc>` entries.

| Section | Count |
|---------|-------|
| /guides/ | 109 |
| /s/ | 42 |
| /compare/ | 28 |
| /setup/ | 8 |
| other (/, /mcp/connect, /bundle, /changelog, /privacy, /guides) | 6 |
| **Total** | **193** |

Note: context said 110 guides; actual sitemap has 109 `/guides/` URLs.

## 2. Crawler coverage per section

Per-URL fetch data taken from `data/traffic.json` -> `sitemap_pages[].crawlers` (the per-URL crawler hit map). A URL counts as "fetched" for a crawler if that crawler appears in the URL's `crawlers` dict.

Coverage = fetched / total per section:

| Section | Googlebot | ClaudeBot | GPTBot | bingbot |
|---------|-----------|-----------|--------|---------|
| /guides/ (109) | 2 (1.8%) | 11 (10.1%) | 7 (6.4%) | 0 (0.0%) |
| /s/ (42) | 8 (19.0%) | 9 (21.4%) | 5 (11.9%) | 0 (0.0%) |
| /setup/ (8) | 1 (12.5%) | 0 (0.0%) | 0 (0.0%) | 2 (25.0%) |
| /compare/ (28) | 1 (3.6%) | 8 (28.6%) | 2 (7.1%) | 0 (0.0%) |
| other (6) | 3 (50.0%) | 0 (0.0%) | 1 (16.7%) | 1 (16.7%) |

Aggregate (from `crawler_url_coverage`):

| Crawler | urls_fetched | requests | pct_of_sitemap |
|---------|--------------|----------|----------------|
| Googlebot | 15 | 26 | 7.8% |
| ClaudeBot | 28 | 28 | 14.5% |
| GPTBot | 15 | 21 | 7.8% |
| bingbot | 3 | 32 | 1.6% |

**Never-fetched by ANY of the 4 crawlers, per section:**
- /guides/: 95 of 109
- /s/: 30 of 42
- /setup/: 5 of 8
- /compare/: 19 of 28
- other: 2 of 6

Only 14 of 109 guides were ever fetched by at least one of the 4 crawlers.

## 3. Orphan analysis (never-crawled guides with zero inbound internal links)

Method: fetched homepage (`/`) and `/guides` hub (2 pages, within the 5-page surgical budget). Counted distinct `/guides/` links on each.

Evidence:
- Homepage contains **109** distinct `/guides/` links.
- `/guides` hub contains **109** distinct `/guides/` links.
- Sample visible link on homepage: `<a href="/guides/work-orders-and-job-cards-from-chat">Work orders and job cards from chat...`

Cross-reference: all 95 never-crawled guides appear in BOTH the homepage link set and the /guides hub link set.

**Result: ZERO orphans.** Every never-crawled guide has at least one inbound internal link from the homepage and from the /guides hub. The crawl gap is NOT caused by missing internal links. It is a crawl-budget / prioritization problem: crawlers are not spending their limited budget on the long tail of guides, even though all are linked.

## 4. Ranked top-5 fixes (for orchestrator next session)

1. **Add a "popular / priority" guide block to the homepage and /guides hub.** All 109 guides are already linked, but they are buried in one long flat list. Promote the 14 already-crawled guides' cluster siblings and the highest-value never-crawled guides (e.g. `/guides/mcp-server-logs-and-what-they-say`, `/guides/mcp-server-security-review`, `/guides/where-is-claude-desktop-config-json`) into a short curated "start here" list near the top so crawlers discover them earlier in the DOM.

2. **Add cross-links between cluster siblings.** Guides in the same topic cluster (e.g. invoicing, PDF, bank-statement) currently only get a link from the flat hub. Add "related guides" links inside each guide body so crawlers can hop between siblings without returning to the hub. This directly addresses the "cluster siblings" gap.

3. **Add /setup/ and /compare/ hub links from the homepage.** /setup/ (0% for ClaudeBot and GPTBot) and /compare/ (0% for bingbot) are under-linked from the homepage. Add explicit nav links to `/setup` and `/compare` hubs in the site header/footer.

4. **Prioritize /s/ server pages.** 30 of 42 /s/ pages never fetched. These are the commercial core. Add a "featured servers" block on the homepage linking the top /s/ pages, and ensure each /s/ page links to its related guide(s) and vice versa.

5. **Re-submit sitemap and add lastmod.** The sitemap has 193 URLs but crawlers fetch only 3-28. Ensure sitemap has accurate `<lastmod>` so crawlers re-crawl changed pages, and consider splitting into a sitemap index (guides, servers, compare) so each section gets its own crawl budget signal.

## Evidence (real curl output excerpts)

```
$ curl -s https://mcp.zovo.one/sitemap.xml | grep -o '<loc>[^<]*</loc>' | wc -l
193

$ curl -s https://mcp.zovo.one/sitemap.xml | grep -o '<loc>[^<]*</loc>' | sed 's/<loc>//;s/<\/loc>//' | head -8
https://mcp.zovo.one/
https://mcp.zovo.one/mcp/connect
https://mcp.zovo.one/bundle
https://mcp.zovo.one/changelog
https://mcp.zovo.one/guides
https://mcp.zovo.one/compare
https://mcp.zovo.one/privacy
https://mcp.zovo.one/s/time-tracker
```

```
$ python3 -c "...crawler_url_coverage..."
Googlebot: urls_fetched=15, requests=26, pct=7.8%
ClaudeBot: urls_fetched=28, requests=28, pct=14.5%
GPTBot: urls_fetched=15, requests=21, pct=7.8%
bingbot: urls_fetched=3, requests=32, pct=1.6%
```

```
$ python3 -c "...homepage /guides links..."
distinct /guides/ links on homepage: 109
distinct /guides/ links on /guides hub: 109
```

```
Homepage visible link excerpt:
...<a href="/guides/loan-and-lease-schedules-from-chat">Loan and lease schedules from chat...</a> &middot;
<a href="/guides/work-orders-and-job-cards-from-chat">Work orders and job cards from chat...</a>
```
