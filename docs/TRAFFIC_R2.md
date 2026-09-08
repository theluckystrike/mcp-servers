# Traffic reality, loop 30 (2026-09-08) — measurement

Instrument: `node scripts/traffic.mjs --indexation`. Raw output: `data/traffic.json`,
`data/gsc.json`, `data/indexation.json`. Every figure names the query or file that produced
it. Nothing here is estimated; where a thing could not be measured it says so.

Comparison baseline: `docs/TRAFFIC_R1.md` and `docs/AUDIENCE_REALITY_R1.md`, both 2026-09-07.

Sitemap state at measurement time: **126 URLs**, fetched live at the start of the run
(2026-09-08T08:26Z). Fourteen reference guides shipped minutes later (commits `3869875`,
`3a5b914`, 08:26Z and 08:28Z) and the sitemap is **141 URLs** as this is written. Those
fourteen pages are outside every window below; the next round's coverage will be reported
against both sets automatically, since the script now compares against the previous run's
URL list.

---

## The answer the loop needs: the registry is the channel worth the effort

**The registry is growing, slowly and from a tiny base. The assistant-crawler channel is
saturated and flat, and it cannot grow, because it already takes every page there is.**

| Channel | Measure | R1, 2026-09-07 | R2, 2026-09-08 | Direction |
|---|---|---|---|---|
| Registry | GitHub visitors sent by `registry.modelcontextprotocol.io`, 14d rolling (`gh api repos/theluckystrike/mcp-servers/traffic/popular/referrers`) | 19 views / 9 uniques | **21 views / 10 uniques** | up |
| Registry | Total GitHub repo traffic, 14d (`.../traffic/views`) | 44 views / 22 uniques | **48 views / 25 uniques** | up |
| Registry | Storefront requests with a registry-ecosystem referer (`cf_referer_host`) | 22 (registry 8, mcpindex 8, ahel 6) | **30** (registry 8, mcpindex 8, mcpi.app 6, ahel 6, glama 2) | up, and one new source |
| Assistant crawlers | ClaudeBot share of the sitemap (`cf_path_x_useragent_x_country`) | 311 of 312 = 99.7% | **126 of 126 = 100%** | ceiling reached |
| Assistant crawlers | Fetches a *person* triggered through an assistant: `Claude-User` + `ChatGPT-User` | 1 + 1 = 2 requests | **2 + 1 = 3 requests** | flat at ~0 |
| Assistant crawlers | Requests referred from any assistant surface | 0 | **0** | flat at 0 |

Read the two rows that matter together. ClaudeBot has fetched 100% of the catalogue; there
is no coverage left to win, so nothing done to that channel can raise the number. What the
channel has never produced is a *person*: three user-initiated assistant fetches in six
days, no referrals, and no measurable arrival that can be traced to an assistant answer.
The registry, on the same days, put ten distinguishable humans on the GitHub repo and sent
30 referred requests to the storefront, and both numbers rose over the day.

So: **spend the next loop on registry placement, not on writing for crawlers.** The
namespace result in `docs/NAMESPACE_R1.md` (3rd against 21st on "schedule", 2nd against
26th on "delivery") is the lever that moves the growing channel. The baseline against which
to judge it is recorded below.

One honest limit on that conclusion. If an assistant reads these pages and recommends a
server inside a chat, the visit that follows arrives with no referer and looks like the
92,220 no-referer requests in this window. That path is **unmeasured**, and no free
instrument available here can measure it. The claim above is precise: the crawler channel
delivers no *observable* people, and its observable metric is at its ceiling.

---

## Job 1 — the instrument was down; it is back up, with the guard intact

`node scripts/traffic.mjs` aborted with the saturation guard: the path × userAgent ×
country grouping returned the full 10,000 rows the API will give, so every per-path figure
would have been under-counted. The guard was correct and is unchanged.

The cause is fixed rather than the guard. That grouping is now pulled **one day at a time**
and summed in-script (`pullPathUASlice` → aggregate by `path |UA| country`). Slice
boundaries are half-open (`datetime_geq` / `datetime_lt`) except the last, which closes
with `datetime_leq`, so the union is exactly the requested window and no request is counted
twice. A slice that still saturates is halved and re-pulled; a sub-hour slice at the cap
still exits 2 rather than write under-counted numbers.

Proof, from `cloudflare.path_ua_day_slices` in `data/traffic.json`:

| Day slice (UTC) | Rows returned | Cap |
|---|---|---|
| 2026-09-01T08:26 → 09-02T08:26 | 0 | 10,000 |
| 2026-09-02T08:26 → 09-03T08:26 | 1,519 | 10,000 |
| 2026-09-03T08:26 → 09-04T08:26 | 2,227 | 10,000 |
| 2026-09-04T08:26 → 09-05T08:26 | 1,857 | 10,000 |
| 2026-09-05T08:26 → 09-06T08:26 | 3,130 | 10,000 |
| 2026-09-06T08:26 → 09-07T08:26 | 3,765 | 10,000 |
| 2026-09-07T08:26 → 09-08T08:26 | 3,634 | 10,000 |

Largest single day: **3,765 of 10,000**, 38% of the cap. 16,132 rows came back across the
slices and aggregated to **11,132 distinct (path, UA, country) combinations** — which is
itself above 10,000, and is the direct proof that the single whole-window query really was
being truncated rather than merely brushing the limit.

Run: `node scripts/traffic.mjs --indexation`, exit 0.

The guard was then control-tested, because a guard that has never been seen to fire is not
known to work. `TRAFFIC_ROW_CAP` lowers the cap for that purpose only:

```
$ TRAFFIC_ROW_CAP=500 node scripts/traffic.mjs --no-gsc
[traffic.mjs] FATAL: cf_path_x_useragent_x_country hit the 500-row cap on the slice
2026-09-07T03:19:46Z → 2026-09-07T04:04:46Z (45 min, already split 5 times) — the grouping
is saturated and every per-path figure would be under-counted.
EXIT=2
```

It halved the day five times on its own, then aborted at 45 minutes, and `data/traffic.json`
was byte-identical before and after (same md5). The guard fires, the recursion works, and a
saturated run writes nothing.

### A second defect the fix exposed: the window is 5.85 days, not 7

The adaptive dataset accepts a start 7 days back and answers, but it holds **no rows for
`mcp.zovo.one` before 2026-09-02T12:00:00Z**, while other hosts on the same zone do return
rows for 09-01 (measured: zone-wide 28,603 requests on 09-01T05:54→09-02T05:54, of which
`mcp.zovo.one` = 0 rows and 0 of the top-15 paths). The script now measures this instead of
assuming it (`cloudflare.effective_window`, query `cf_host_hourly`) and reports
`effective_days: 5.852`. Every absolute count below covers **2026-09-02T12:00Z →
2026-09-08T08:26Z**.

This matters for comparison: R1 reported a nominal 7-day window and did not measure its own
effective window, so R1's per-day rates may be understated by an unknown amount. Where R1
and R2 are compared below on absolute counts, the comparison is stated as such.

### Two other instrument changes

- Crawler coverage is now also reported over the **previous run's URL set**
  (`crawler_url_coverage_previous_set`), read out of the `data/traffic.json` being
  overwritten. Without it the sitemap cut from 312 to 126 would have made every "% of the
  sitemap" figure incomparable between rounds.
- A channel that is DOWN no longer destroys a good extract. The GSC key on iCloud Desktop
  went dataless *during this session*; the run wrote a "DOWN" `data/gsc.json` over a good
  one. `writeChannelFile` now refuses that overwrite and says so on stderr. (The key came
  back after `brctl download` plus a wait, as `docs/TRAFFIC_R1.md` predicted.)

---

## Job 2 — what a day of change did

Changes made 2026-09-07: sitemap cut 312 → 126, the 216 `/setup/<client>/<product>`
permutations marked `noindex, follow` (commit `8f98983`, 01:27Z), the substantive URLs
submitted to IndexNow (commit `66012a7`, **01:18Z**), the broken `npx` install command
corrected everywhere, and the hosted endpoints changed to answer an unauthenticated GET
with 200.

### Crawler URL coverage, same shape as R1

Over the **same 312-URL universe R1 used**, so the two rounds are directly comparable
(`crawler_url_coverage_previous_set`, query `cf_path_x_useragent_x_country` per day):

| Crawler | R1 URLs (of 312) | R2 URLs (of the same 312) | R2 requests |
|---|---|---|---|
| ClaudeBot | 311 | **311** | 315 |
| meta-externalagent | 33 | **272** | 278 |
| MJ12bot (SEO) | 267 | 267 | 321 |
| Amazonbot | 239 | **261** | 265 |
| SemrushBot (SEO) | 130 | **247** | 248 |
| YandexBot | 170 | **195** | 197 |
| GPTBot | 144 | 144 | 259 |
| bingbot | 102 | **114** | 206 |
| PerplexityBot | 4 | 4 | 11 |
| Applebot | 4 | 4 | 4 |
| **Googlebot** | **2** | **2** | 7 |
| AhrefsBot | 1 | 1 | 2 |
| Claude-User | 1 | 1 | 1 |
| ChatGPT-User | 1 | 1 | 1 |
| DotBot | — | 1 | 1 |

Over the curated 126 that the sitemap now advertises:

| Crawler | URLs (of 126) | % | Requests |
|---|---|---|---|
| ClaudeBot | 126 | **100%** | 130 |
| MJ12bot | 112 | 88.9% | 135 |
| YandexBot | 112 | 88.9% | 118 |
| Amazonbot | 102 | 81.0% | 106 |
| SemrushBot | 82 | 65.1% | 83 |
| meta-externalagent | 66 | 52.4% | 72 |
| GPTBot | 48 | 38.1% | 88 |
| bingbot | 35 | 27.8% | 62 |
| PerplexityBot | 4 | 3.2% | 11 |
| Applebot | 4 | 3.2% | 4 |
| **Googlebot** | **2** | **1.6%** | 7 |

**Googlebot did not move.** It is still exactly two URLs, `/` (5 fetches) and `/s/invoice`
(1), 24 hours after the sitemap was cut to the curated set and the permutations were marked
noindex. In the same window it fetched `/sitemap.xml` 8 times and `/robots.txt` 5 times. It
is reading the file and still declining the pages. One day is far too short to call the
sitemap cut a failure — Google's crawl scheduling on a six-day-old subdomain with no inbound
links works on a longer clock — but the honest reading today is: no movement yet.

### Did IndexNow start Bing or Yandex crawling? Yandex yes, Bing no

IndexNow was submitted at **2026-09-07T01:18Z** and returned HTTP 200; the key file still
serves (`curl -o /dev/null -w "%{http_code} %{size_download}" https://mcp.zovo.one/db6dbf5cfdbc08d1cc9b5365d398145b.txt`
→ `200 32`).

Minute-resolution query (`httpRequestsAdaptiveGroups`, dims `datetimeMinute userAgent`,
09-07T00:00Z → 06:00Z, host-filtered), YandexBot only:

| Minute | Requests |
|---|---|
| 2026-09-07T01:41Z | **40** |
| 2026-09-07T01:42Z | 1 |
| 2026-09-07T03:41Z | 2 |
| 2026-09-07T04:27Z | 22 |

**YandexBot arrived 23 minutes after the ping** and swept the site, having sent nothing in
the preceding six hours. Over 09-07T00:00Z → 09-08T05:58Z it fetched **52 distinct sitemap
URLs in 58 requests** (separate pull, `--start 2026-09-07T00:00:00Z`). Across the whole
window Yandex now covers 112 of the 126 curated URLs, against 170 of 312 in R1. That is the
clearest positive result of the day, and it is what the IndexNow channel exists to do.

**bingbot shows no step change.** It was already crawling continuously before the ping and
continued at the same rate through it — hourly requests on 09-06 (pre-ping) run 1–9 per
hour, and on 09-07 (post-ping) 1–5 per hour. Coverage over the same 312 universe moved 102
→ 114 URLs, in line with the general drift, not with a submission event.

**Seznam and Naver: zero.** No user-agent matching `seznam|naver|yeti` appears anywhere in
the 361 distinct user-agent strings seen on this host in the window. IndexNow accepted the
URLs for them; neither has fetched anything.

### Render-proven humans

Same discriminator as R1 (`botScore` is Enterprise-only on this zone): a browser-shaped
user agent counts as human only if that exact UA string also fetched `/favicon.ico`,
`/cdn-cgi/**`, `/assets/**` or `/apple-touch-icon` somewhere in the window.

| Measure | R1 (nominal 7d) | R2 (5.85d measured) | R2 per day |
|---|---|---|---|
| Browser-looking UA strings seen | 124 | 165 | — |
| …of which render-proven | 33 (26.6%) | 43 (26.1%) | — |
| Render-proven requests | 512 | **709** | 121 |
| Human page views on sitemap URLs | 218 | **324** | 55 |
| Same, excluding the operator's country | 215 | 321 | 55 |
| Excluding the homepage as well | **64** | **78** | 13 |
| Sitemap URLs with ≥1 human view (ex-homepage) | 49 of 311 | **50 of 125** | — |
| Sitemap URLs touched by a render-proven browser | 51 of 312 | 52 of 126 | — |

Human page views are up on a per-day basis (13.3/day off the homepage against 9.1/day in
R1's nominal window), but the shape is unchanged: the homepage takes 243 of the 321, and
the rest of the catalogue splits 78 views across 50 pages.

The ten best pages barely moved: nine of R1's ten are still in R2's top eleven, and the
only page to drop out, `/guides/expense-tracking-in-claude`, is twelfth. The ceiling below
the homepage rose from 3 views to 5.

| Path | Human views (strict, ex-operator) | Browser-UA (loose) | Crawler hits | Total requests |
|---|---|---|---|---|
| `/` | 243 | 414 | 26 | 1,048 |
| `/s/expense-tracker` | 5 | 17 | 10 | 79 |
| `/s/invoice` | 4 | 23 | 12 | 115 |
| `/guides/track-time-in-claude-code` | 4 | 9 | 5 | 74 |
| `/guides` | 3 | 9 | 10 | 77 |
| `/guides/price-drop-alerts-with-claude` | 3 | 8 | 4 | 81 |
| `/guides/mcp-server-free-vs-pro` | 3 | 8 | 5 | 69 |
| `/s/time-tracker` | 2 | 15 | 9 | 89 |
| `/guides/read-excel-in-cursor` | 2 | 11 | 5 | 80 |
| `/guides/invoice-pdf-from-chat` | 2 | 10 | 7 | 82 |
| `/setup` | 2 | 10 | 4 | 59 |

By section (`cloudflare.section_rollup`), with the permutations now out of the sitemap:

| Section | URLs | Requests | Crawler hits | Human views | URLs with a human |
|---|---|---|---|---|---|
| `/` | 1 | 1,048 | 26 | 243 | 1 of 1 |
| `/guides/**` | 63 | 2,357 | 248 | 38 | 23 of 63 |
| `/s/**` | 32 | 1,667 | 151 | 31 | 19 of 32 |
| `/compare/**` | 20 | 531 | 102 | **1** | **1 of 20** |
| `/setup` (8 client index pages) | 8 | 306 | 55 | 8 | 7 of 8 |
| `/bundle`, `/changelog` | 2 | 94 | 18 | 0 | 0 of 2 |

`/compare/**` has now produced one human page view in two rounds of measurement. It is 16%
of the curated sitemap and 0.3% of the human traffic.

### Status codes: the 401 fix did not reduce 401s, and there is a new 504 spike

Window totals (`cf_status`): 200 → 36,620; **401 → 34,791**; **404 → 9,981**; 303 → 5,204;
**504 → 3,600**; 400 → 1,062.

| Status | R1, 7d nominal | R2, 5.85d | R1 per day | R2 per day |
|---|---|---|---|---|
| 401 | 24,330 | **34,791** | 3,476 | **5,945** |
| 404 | 7,963 | **9,981** | 1,138 | **1,706** |

Per calendar day (`cf_status_x_date`, new this round; 09-02 and 09-08 are partial days):

| Date | 200 | 401 | 404 | 504 |
|---|---|---|---|---|
| 2026-09-03 | 4,444 | 2,268 | 1,212 | 373 |
| 2026-09-04 | 8,428 | 4,190 | 1,213 | 264 |
| 2026-09-05 | 10,526 | 8,332 | 3,151 | 337 |
| 2026-09-06 | 6,616 | 8,816 | 2,013 | 313 |
| **2026-09-07** (the change) | 3,998 | **8,361** | 1,455 | **1,794** |
| 2026-09-08 (to 08:26Z) | 1,590 | 2,479 | 611 | 243 |

**The 401 count did not fall on the day of the fix**, and it is higher per day than in R1.
The reason is visible in the data rather than a guess: every one of the top 25 paths
returning 401 is a **POST** to `/mcp/<server>` — `POST /mcp/invoice` 1,876,
`POST /mcp/time-tracker` 1,590, `POST /mcp/spreadsheet` 1,587, and so on down the estate
(query: `httpRequestsAdaptiveGroups` dims `clientRequestPath clientRequestHTTPMethodName`,
filter `edgeResponseStatus: 401`). Verified live:
`GET /mcp/invoice` → **200**, unauthenticated `POST /mcp/invoice` (JSON-RPC `tools/list`)
→ **401**. The fix did what it claimed — the *GET* probe now succeeds — but the traffic
that generates the 401s is POST-shaped, and by design still requires auth. Nothing is
broken; the metric simply does not measure what the change touched.

**404s are dominated by discovery files that do not exist.** Top paths:
`/.well-known/oauth-protected-resource` 1,359, `/.well-known/oauth-authorization-server`
919, `/favicon.ico` 560, `/.well-known/glama.json` 488,
`/.well-known/mcp/server-card.json` 303, `/.well-known/openid-configuration` 293,
`/.well-known/agent-card.json` 234, `/buy/nope` 206, `/.well-known/agent.json` 204. These
are MCP clients and directory crawlers asking the standard questions and being told the
resource does not exist. That is 3,800 failed discovery attempts in 5.85 days from software that
was actively trying to describe or connect to this estate — the cheapest surface on the
list for whoever owns the worker.

**New, and worth the worker owner's attention today: 504s spiked 5.7x on 2026-09-07**, from
~320/day to 1,794, and they are concentrated on checkout. 504s on 09-07 by path:
`/buy/bundle` 119, `/health` 23, `/buy/expense-tracker` 23, `/buy/invoice` 23,
`/buy/work-order` 22, `/buy/currency` 21, `/buy/spreadsheet` 21, `/` 21,
`/buy/time-tracker` 20, `/buy/price-tracker` 20, `/buy/barcode` 20, `/buy/docx` 19. Every
`/buy/` route timed out repeatedly on the day of the change. This is not measurement's file
to fix, and it is reported, not diagnosed.

---

## Job 3 — indexation, measured directly for the first time

Crawled is not indexed, and until now only crawling had been measured. Written to
`data/indexation.json`.

### Google: 0 of 126, and the API says why

Method: the Search Console **URL Inspection API**, one call per sitemap URL —
`POST https://searchconsole.googleapis.com/v1/urlInspection/index:inspect`
with `{inspectionUrl, siteUrl: "sc-domain:zovo.one"}`, service-account auth, free, quota
2,000 URLs/day. This states Google's own index verdict for a URL, which impressions cannot.

| Result | URLs |
|---|---|
| `verdict: PASS` (in the index) | **0 of 126** |
| `Discovered - currently not indexed` | 66 |
| `URL is unknown to Google` | 60 |
| Ever crawled (`lastCrawlTime` present) | **0 of 126** |
| API errors | 0 |

Three separate runs today agree on the two numbers that matter — 0 indexed, 0 with a crawl
time — while the split between "discovered" and "unknown" moved between runs (59/67, 57/68,
66/60), so treat that split as approximate and the headline as solid.

"Discovered - currently not indexed" is Google's own phrase for *we know this URL exists,
from your sitemap, and we have chosen not to fetch it*. That is the same finding the
Cloudflare log gives from the other side (Googlebot: 2 URLs fetched, sitemap.xml read 8
times), arrived at independently, from Google's records rather than ours.

### Google impressions: zero, over 480 days, with a working control

`POST .../webmasters/v3/sites/sc-domain:zovo.one/searchAnalytics/query`, `dataState: final`:

| Query | Result |
|---|---|
| Property total, 28d (2026-08-08 → 09-05) | 60 clicks, 4,565 impressions, 427 page rows |
| Pages on `mcp.zovo.one`, 28d, filter `page contains "//mcp.zovo.one/"` | **0 rows, 0 impressions** |
| Daily rows for that filter, 28d | 29 rows returned, **0 with any impression** |
| Same filter over **480 days** (2025-05-16 → 2026-09-05) | **0 page rows, 0 impressions** |
| Positive control, `//zovo.one/`, 480 days | **2,579 pages, 80,002 impressions** |
| Positive control, `//zovo.one/`, 28 days | 60 clicks, 4,465 impressions |

The control proves the filter and the API work, so the zero is a real zero. **Not one of
the 126 URLs has ever had a Google impression.**

### Bing, Yandex and the rest: UNMEASURED, and here is exactly why

There is no free, keyless index-status API for Bing or Yandex. A scripted `site:` query is
not an acceptable substitute, and this round proves it rather than asserting it. Each probe
ran with a **positive control** on `modelcontextprotocol.io`, a site that is certainly in
every index:

| Probe | HTTP | Results on the target domain | Control result |
|---|---|---|---|
| `bing.com/search?q=site:mcp.zovo.one&format=rss` | 200 | 0 | control returned Wikipedia pages, 0 on `modelcontextprotocol.io` |
| `bing.com` control run | 200 | — | `site:` operator not honoured; earlier manual runs returned Dubai hotels and Tata Motors share prices |
| `mojeek.com/search?q=site:...` | 200 | 0 | control also 0 |
| `html.duckduckgo.com/html/?q=site:...` | 202 | 0 | control also 0 (anomaly/CAPTCHA page) |

Every control failed, so **every one of these probes is blind, and a zero from them is a
broken instrument, not an absent site.** Recorded as `UNMEASURED` in
`data/indexation.json`, never as zero.

The honest routes both need a human step and neither key exists in this repo:
Bing Webmaster Tools (sign in, mint an API key, then `GetUrlTrafficInfo`) and Yandex
Webmaster (OAuth app and token, then `search-urls/in-search`). Both are free. Until one of
them exists, **Bing and Yandex indexation of this host is unmeasured** — although the
Cloudflare log does prove both are *crawling* it (bingbot 35 of 126 URLs, YandexBot 112 of
126), which is a necessary but not sufficient condition.

---

## The registry referral baseline, stamped today

Recorded in `data/traffic.json` under `registry_referral_baseline`, both sides on
2026-09-08, so that a week from now the namespace experiment in `docs/NAMESPACE_R1.md` can
be judged on visits rather than on rank.

**Baseline, 2026-09-08:**

| Side | Measure | Value |
|---|---|---|
| GitHub (`gh api .../traffic/popular/referrers`, 14d rolling) | Views from `registry.modelcontextprotocol.io` | **21** |
| | Unique visitors from it | **10** |
| | All repo views / uniques | 48 / 25 |
| | Stars / forks | 0 / 0 |
| Storefront (`cf_referer_host`, 5.85d) | `registry.modelcontextprotocol.io` | 8 requests |
| | `mcpindex.ai` | 8 |
| | `www.mcpi.app` | 6 |
| | `mcp.ahel.io` | 6 |
| | `glama.ai` | 2 |
| | **Registry-ecosystem total** | **30 requests** |
| Assistant side, same window | `Claude-User` / `ChatGPT-User` requests | 2 / 1 |

**What would count as the experiment succeeding.** The registry rows all point at `/s/`
product pages, so a placement gain should show up in both places. Re-run
`node scripts/traffic.mjs` on or after 2026-09-15 and compare:

1. `registry_referral_baseline.github_side.registry_referrer_unique_visitors_14d` rises
   above 10 — a real improvement is ≥ 15, since the 14-day window will by then be fully
   inside the post-change period.
2. `registry_referral_baseline.storefront_side.requests_from_registry_ecosystem` rises
   above 30 for a comparable window, and specifically
   `registry.modelcontextprotocol.io` rises above 8.
3. The `/s/` pages named by the `com.bestremotetools` server pick up human page views in
   `sitemap_pages` where they had none.

A rank improvement with none of these three moving means better placement does not convert,
and the finding is then that the registry's search surface has too little traffic for rank
to matter — which is itself worth knowing before the whole catalogue is migrated. Note the
sample is small enough that a single scanner could move the storefront number; the GitHub
`uniques` figure is the more trustworthy of the two because GitHub de-duplicates visitors.

---

## What is unmeasured, and why

- **Assistant answers.** Whether ClaudeBot's 100% coverage results in this catalogue being
  recommended inside a conversation. No log records it; nothing free measures it.
- **Bing / Yandex / Seznam / Naver index membership.** All scripted probes are blind
  (controls above). Needs a Bing Webmaster or Yandex Webmaster key, a human step.
- **Which humans came from where.** Cloudflare's referer and userAgent dimensions are
  separate groupings on this plan, so "render-proven humans referred by the registry"
  cannot be computed; only the two numbers separately.
- **Anything before 2026-09-02T12:00Z on this host.** The adaptive dataset no longer holds
  it, and `httpRequests1dGroups` — the only 30-day dataset on this plan — has no host
  dimension, so it cannot separate `mcp.zovo.one` from `zovo.one`.
- **Bot verification.** `botScore` is Enterprise-only on this zone (measured error:
  `zone ... does not have access to the field 'botscore'`), so the human count rests on the
  render-engine test, which is stated in full in `classification_rules`.

## Re-running this

```
node scripts/traffic.mjs                       # 7d request window, both channels
node scripts/traffic.mjs --indexation          # + URL Inspection on all 126 URLs (~5 min)
node scripts/traffic.mjs --start 2026-09-07T00:00:00Z --out /tmp/since.json --no-gsc
```

It refuses to run without `CLOUDFLARE_API_TOKEN`, exits 2 rather than write zeros for a
missing credential, exits 2 if a sub-hour slice still saturates the row cap, and now
refuses to overwrite a good `data/gsc.json` or `data/indexation.json` with a DOWN one.
Every GraphQL query it sent is stored verbatim under `queries` in `data/traffic.json`.

**Durable risk, unchanged and hit again this session:** the GSC key at
`~/Desktop/keys/gsc-sa-key.json` is on iCloud Desktop and went dataless mid-run. Recovery
was `brctl download` plus several minutes of waiting. See `docs/HUMAN_GATED_PACK.md`.
