# Traffic reality, loop 29 (2026-09-07) — agent B, measurement

Instrument: `node scripts/traffic.mjs`. Raw output: `data/traffic.json`, `data/gsc.json`.
Every figure below names the query that produced it. Nothing here is estimated.

**Both measurement channels are now working.** Cloudflare GraphQL Analytics works on the
env token `CLOUDFLARE_API_TOKEN`. Google Search Console was recovered: the
service-account key at `~/Desktop/keys/gsc-sa-key.json` was iCloud-dataless, and a
`brctl download` on it did materialise, on a delay of a few minutes rather than
immediately. It is live again as of this run.

---

## The finding that matters

**Of the 312 sitemap URLs, all 312 were fetched by a search or AI crawler in the last
7 days, and 50 were fetched by a browser that provably rendered the page. Excluding the
homepage, real humans made 64 page views across 49 of the other 311 URLs in 7 days.**

But "all 312 crawled" hides the number that decides everything. Broken out by crawler
(query `cf_path_x_useragent_x_country`, 2026-08-31T01:11Z → 2026-09-07T01:11Z):

| Crawler | Sitemap URLs fetched | % of 312 | Requests |
|---|---|---|---|
| ClaudeBot | 311 | 99.7% | 315 |
| MJ12bot (SEO, Majestic) | 267 | 85.6% | 319 |
| Amazonbot | 239 | 76.6% | 240 |
| YandexBot | 170 | 54.5% | 171 |
| GPTBot | 144 | 46.2% | 259 |
| SemrushBot (SEO) | 130 | 41.7% | 130 |
| bingbot | 102 | 32.7% | 138 |
| meta-externalagent | 33 | 10.6% | 35 |
| PerplexityBot | 4 | 1.3% | 10 |
| Applebot | 4 | 1.3% | 4 |
| **Googlebot** | **2** | **0.6%** | **6** |
| AhrefsBot | 1 | 0.3% | 2 |
| ChatGPT-User | 1 | 0.3% | 1 |
| Claude-User | 1 | 0.3% | 1 |

**Googlebot has fetched 2 of the 312 pages: `/` and `/s/invoice`.** It fetched
`/robots.txt` 4 times and `/sitemap.xml` 7 times in the same window, so it knows the
sitemap exists and is choosing not to crawl it. This is a crawl-budget / discovery
problem on a domain with no inbound links, not a technical block — the orchestrator
independently confirmed that served `robots.txt` allows all agents, carries the sitemap
line, and that Googlebot receives HTTP 200 with 20,101 characters of visible text on
`/s/invoice` (`docs/AUDIENCE_REALITY_R1.md`).

That number predicted the Search Console result exactly. See "Channel 2" below: **zero
Google impressions, ever.**

---

## Channel 1 — Cloudflare GraphQL Analytics: WORKING

- Endpoint `POST https://api.cloudflare.com/client/v4/graphql`, auth = env
  `CLOUDFLARE_API_TOKEN` (verified active via `/client/v4/user/tokens/verify`).
- Zone `zovo.one`, id `f16be0fc9bae2ff3786d91eb7a90c023`, plan **Pro Website**,
  account `dd3f2a29b7707e21a87f26a622c0bb9d`. Free API, no paid tier used.
- Window: 7 days, `2026-08-31T01:11:30Z` → `2026-09-07T01:11:30Z`, filtered
  `clientRequestHTTPHost: "mcp.zovo.one"`.

### Hard retention limit (measured, not assumed)

A 30-day per-path pull is **impossible on this plan**. Querying
`httpRequestsAdaptiveGroups` at −14d returns
`extensions.code = "quota"`, `"zone ... cannot request data older than 1w1d"`.
`httpRequests1dGroups` does retain 30 days but has **no host dimension**, so it cannot
separate `mcp.zovo.one` from `zovo.one`. Seven days is the maximum honest per-URL window.

Sampling: `avg { sampleInterval } = 1.283`. `count` is the sample-adjusted request
estimate the adaptive dataset returns.

### The three populations (query `cf_path_x_useragent_x_country`)

`botScore` is **not available on this zone** — measured error:
`zone 'f16be0fc9bae2ff3786d91eb7a90c023' does not have access to the field 'botscore'`
(Bot Management is Enterprise-only). So there is no verified-bot flag to lean on. The
split below is built from the `userAgent` dimension plus a render-engine test, both
stated explicitly so they can be audited.

| Population | Requests, 7d | Share |
|---|---|---|
| Scripted clients (`node`, `claude-code/*`, `python-httpx`, `curl`, `Go-http-client`, …) | 45,397 | 62.4% |
| Other bots / registry & uptime probes (`mcpbeat`, `verifymcp`, `rokmcp-collector`, …) | 19,502 | 26.8% |
| Unclassified | 2,684 | 3.7% |
| **Search & AI crawlers** (Googlebot, bingbot, GPTBot, ClaudeBot, PerplexityBot, Amazonbot, Yandex, meta) | **1,740** | **2.4%** |
| Browser user-agent, loose (upper bound on humans) | 1,470 | 2.0% |
| Empty user-agent | 1,379 | 1.9% |
| SEO crawlers (MJ12bot, SemrushBot, AhrefsBot) | 547 | 0.8% |
| **Total** | **72,711** | |

### Why the loose human number is wrong, and what the strict one is

The loose browser-UA bucket is contaminated. Its single biggest contributor is
`Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 …) Version/13.0.3 Safari/604.1` — 312
requests across **220 distinct paths**, an iOS version seven years stale, fetching zero
assets. That is a sitemap-walking scraper wearing a browser UA.

Discriminator used, in place of the unavailable `botScore`: a **render-engine proof** —
did that exact UA string ever fetch `/favicon.ico`, `/cdn-cgi/**`, `/assets/**` or
`/apple-touch-icon`? A real browser does this automatically; a scraper does not.

- 124 distinct browser-looking UA strings seen.
- **33 of them (26.6%) ever fetched such a resource.** The other 91 never did.
- Requests from render-proven UAs: **512**. From asset-less browser UAs: 958.

Cross-check on origin: render-proven browser HTML hits by country are
US 107, FR 58, CN 28, IE 19, VN 16, CH 12, DE 10, CA 7, GB 5, **PL 4**. The operator's
own machine is in Poland and PL is the largest single source of requests to this zone
(24,177), yet only 4 render-proven page views are PL. **The human traffic is not
self-traffic.**

### Human page views on the sitemap, 7d

| Measure | Value |
|---|---|
| Sitemap URLs | 312 |
| Fetched by any client | 312 |
| Fetched by a search or AI crawler | 312 |
| Fetched by a browser UA (loose) | 203 |
| **Fetched by a render-proven browser (strict)** | **51** |
| Same, excluding the operator's country | 50 |
| Human page views, render-proven | 218 |
| Human page views excluding `/` and the operator | **64** |
| Non-homepage sitemap URLs with ≥1 human page view | **49 of 311** |
| Sitemap URLs with zero human hits even on the loose definition | **109** |

Read that as: outside the homepage, the entire 311-page catalogue drew **64 human page
views in a week**, and 262 of the 311 pages drew none.

### By section

| Section | URLs | Requests | Search/AI crawler hits | Human page views (strict) | URLs with ≥1 human |
|---|---|---|---|---|---|
| `/` (homepage) | 1 | 678 | 22 | 153 | 1 |
| `/setup/**` | 224 | 2,435 | 804 | **8** | **7 of 224** |
| `/guides/**` | 35 | 741 | 144 | 30 | 23 of 35 |
| `/s/**` | 30 | 952 | 113 | 27 | 20 of 30 |
| `/compare/**` | 20 | 300 | 85 | **0** | **0 of 20** |
| `/bundle` | 1 | 35 | 6 | 0 | 0 |
| `/changelog` | 1 | 19 | 6 | 0 | 0 |

`/setup/**` is **72% of the sitemap and 2.6% of the human page views**. `/compare/**`
has never been rendered by a verified browser at all.

### The ten best pages, ranked by human hits

| Path | Human views (strict, ex-operator) | Browser-UA views (loose) | Search/AI crawler hits | Total requests |
|---|---|---|---|---|
| `/` | 151 | 280 | 22 | 678 |
| `/s/invoice` | 3 | 13 | 11 | 83 |
| `/s/expense-tracker` | 3 | 9 | 9 | 53 |
| `/guides/track-time-in-claude-code` | 3 | 6 | 5 | 45 |
| `/guides/price-drop-alerts-with-claude` | 3 | 5 | 4 | 38 |
| `/s/time-tracker` | 2 | 9 | 8 | 65 |
| `/setup` | 2 | 6 | 4 | 48 |
| `/guides/expense-tracking-in-claude` | 2 | 6 | 3 | 45 |
| `/guides/read-excel-in-cursor` | 2 | 6 | 5 | 42 |
| `/guides/invoice-pdf-from-chat` | 2 | 5 | 7 | 43 |

The ceiling below the homepage is 3 views per page per week. Ranking further down is
noise: 49 pages sit at 1–3 and the rest at 0.

### The ten deadest pages

109 sitemap URLs got zero hits from any browser UA, loose or strict. The ten with the
least traffic of any kind:

| Path | Total requests | Search/AI crawler | SEO crawler | Scripted |
|---|---|---|---|---|
| `/setup/claude-code/work-order` | 1 | 1 | 0 | 0 |
| `/setup/cursor/petty-cash` | 1 | 1 | 0 | 0 |
| `/setup/vscode/petty-cash` | 1 | 1 | 0 | 0 |
| `/setup/cline/statement-of-account` | 1 | 1 | 0 | 0 |
| `/setup/cline/petty-cash` | 1 | 1 | 0 | 0 |
| `/setup/claude-code/catalogue` | 2 | 1 | 1 | 0 |
| `/setup/claude-code/change-order` | 2 | 1 | 1 | 0 |
| `/setup/cursor/catalogue` | 2 | 1 | 1 | 0 |
| `/setup/cursor/change-order` | 2 | 1 | 1 | 0 |
| `/setup/vscode/catalogue` | 2 | 1 | 1 | 0 |

Every one of the ten is in the `/setup/<client>/<product>` matrix. All 109 zero-human
URLs are `/setup/**` or `/compare/**`.

### Referers, countries, status codes

Referers, 7d (query `cf_referer_host`): 72,076 requests with **no referer at all**;
`mcp.zovo.one` 531 (internal); `www.google.com` **17**;
`registry.modelcontextprotocol.io` 8; `mcpindex.ai` 8; `mcp.ahel.io` 6;
`www.statewage.com` 4; `www.baidu.com` 2. Seventeen inbound clicks from Google in a
week, against 4,498 impressions the property earned on *other* hosts.

Countries (query `cf_country`): PL 24,177, US 14,314, VN 11,013, FI 8,202, DE 5,708,
FR 3,494, GB 3,228, SG 548.

Status codes (query `cf_status`): 200 → 31,137; **401 → 24,330**; **404 → 7,963**;
303 → 4,315; **504 → 1,795**; 400 → 1,059. A third of all traffic to this host is
unauthenticated MCP probes bouncing off 401, and 7,963 404s in a week is worth a
separate look by whoever owns the worker.

### Crawler fetches of the discovery files (query `cf_path_x_useragent_x_country`)

| File | Requests | Search/AI crawler hits | Notable |
|---|---|---|---|
| `/robots.txt` | 475 | 145 | ClaudeBot 66, YandexBot 37, MJ12bot 35, SemrushBot 19, OAI-SearchBot 13, bingbot 10, AhrefsBot 6, PerplexityBot 5, meta 5, **Googlebot 4**, Applebot 3 |
| `/sitemap.xml` | 233 | 77 | ClaudeBot 65, **Googlebot 7**, GPTBot 5 |
| `/llms.txt` | 48 | 1 | bingbot 1 |

Googlebot read the sitemap 7 times and then crawled 2 URLs from it. The file is being
delivered and ignored.

### Traffic not in the sitemap

The busiest paths on the host are not pages at all — they are the MCP endpoints:
`/mcp/invoice` 3,154, `/mcp/time-tracker` 2,368, `/mcp/spreadsheet` 2,303,
`/mcp/expense-tracker` 2,019, `/mcp/pdf` 1,940. Zero render-proven human hits on any of
them. These are the 401-heavy machine population, not an audience.

---

## Channel 2 — Google Search Console: WORKING, and the answer is zero

Recovered this session. `ls -lO ~/Desktop/keys/gsc-sa-key.json` showed
`compressed,dataless` and a bounded `cat` timed out (`wc -c` cannot detect this — it
answers from `stat()`). `brctl download` on the file returned 0 immediately without
materialising it, but the file became readable a few minutes later. It is readable now
and `scripts/traffic.mjs` mints a JWT from it directly.

- Property: **`sc-domain:zovo.one` exists and is verified.** It is a *domain* property,
  so it covers `mcp.zovo.one` automatically. Nothing needed to be added.
- Query: `POST https://www.googleapis.com/webmasters/v3/sites/sc-domain:zovo.one/searchAnalytics/query`,
  `dataState: "final"`, `rowLimit: 25000`, window **2026-08-07 → 2026-09-04** (28 days).

| Measure | Value |
|---|---|
| Property total, 28d | 63 clicks, 4,498 impressions, 418 page rows |
| Page rows on `mcp.zovo.one` | **0 of 418** |
| Query×page rows on `mcp.zovo.one` | **0 of 395** |
| Direct host probe, filter `page contains "//mcp.zovo.one/"` | 29 daily rows returned, **0 with any impression, 0 clicks, 0 impressions** |
| Positive control, same query shape, filter `//zovo.one/` | 29 daily rows, **63 clicks, 4,392 impressions** |

The control proves the filter syntax works and that a zero is a real zero, not a broken
query or a row-limit artefact. It is also not a new-data artefact: the prior extract in
`~/gsc-analysis/gsc.sqlite` (pulled 2026-08-31, covering 2026-05-31 → 2026-08-28) holds
828 page rows for `sc-domain:zovo.one` — 783 on `zovo.one`, 45 on `www.zovo.one`,
**0 on `mcp.zovo.one`**.

**`mcp.zovo.one` has never received a single Google impression.** Not a low number — zero,
over at least the last 99 days. The 312-page storefront does not exist in Google's index.

---

## What this means, folded in with `docs/AUDIENCE_REALITY_R1.md`

The orchestrator measured GitHub at 44 views from 22 unique visitors in 14 days, and
showed the 5,105 "bundle downloads" KPI to be a uniform automated sweep. The storefront
is the same story, measured independently and from a different vendor's data:

- 72,711 requests to `mcp.zovo.one` in 7 days, of which **512 (0.70%)** came from
  something that provably rendered a page, and **64** were human page views on a
  catalogue page other than the homepage.
- The audience is roughly the same order as GitHub's 22. Neither surface is
  conversion-poor; both are audience-poor. Supply is not the constraint.
- **The `/setup/**` matrix — 224 of 312 URLs, 72% of the sitemap — earned 8 human page
  views on 7 pages in a week. `/compare/**` earned zero on all 20.** Content effort
  spent adding more `/setup/<client>/<product>` permutations buys nothing. If anything
  earns effort it is `/guides/**` (23 of 35 pages have a human, best in the estate per
  page) and `/s/**` (20 of 30).
- Indexation is not technically blocked — robots.txt is clean, the pages render, and
  Googlebot gets HTTP 200. The block is **discovery**: Googlebot has crawled 2 of 312
  pages and issued 0 impressions. Anthropic's ClaudeBot has crawled 311 of 312. The only
  index this catalogue currently lives in is an LLM's, not Google's.
- The one referer channel that sends humans is the MCP registry ecosystem
  (`registry.modelcontextprotocol.io` 8, `mcpindex.ai` 8, `mcp.ahel.io` 6) — the same
  channel that sent 9 of GitHub's 22. Google sent 17 clicks and 0 impressions from
  its own index.

## Re-running this

```
node scripts/traffic.mjs            # 7d, both channels, rewrites data/traffic.json + data/gsc.json
node scripts/traffic.mjs --days 3
node scripts/traffic.mjs --no-gsc
```

It refuses to run without `CLOUDFLARE_API_TOKEN` and exits 2 rather than writing zeros.
It also aborts if the path×UA×country grouping saturates the 10,000-row API cap, so a
per-path figure can never be silently under-counted. Every GraphQL query it sent is
stored verbatim under `queries` in `data/traffic.json`, and the classification regexes
under `classification_rules`.

**Durable risk:** the GSC key lives at `~/Desktop/keys/gsc-sa-key.json`, on iCloud
Desktop, and will go dataless again. See `docs/HUMAN_GATED_PACK.md`.
