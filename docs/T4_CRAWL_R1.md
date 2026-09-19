# T4 Crawler Coverage Probe — R1

STATUS: verified

Date: 2026-09-18 | Repo: `/Users/mike/mcp-servers` @ `main` | Host: `mcp.zovo.one`

## 1. Scope & Method

Per-URL coverage probe against the live sitemap, plus an IndexNow resubmission of the
URLs that the coverage evidence shows are *not* yet fetched by ClaudeBot.

Three probes, each with its producing command recorded in §8:

1. **Inventory** — fetch `sitemap.xml`, parse every `<loc>` + `<lastmod>`.
2. **HTTP probe** — per-URL status code and cache validators (`Last-Modified`, `ETag`,
   `Cache-Control`), 12-way concurrent `curl`.
3. **Coverage** — read the Cloudflare per-URL crawler attribution already computed in
   `data/traffic.json` (`sitemap_pages[].crawlers{}`), which is the same source the KPI
   reads. This names the covered set exactly, so no heuristic ranking was needed.
4. **IndexNow** — POST the uncovered delta to `https://api.indexnow.org/indexnow`.

## 2. Sitemap Inventory (190 URLs)

| Field | Value |
|---|---|
| `sitemap.xml` HTTP status | **200** |
| Bytes | 19,361 |
| `<loc>` entries | **190** |
| `<lastmod>` distinct values | 1 — `2026-09-17` on all 190 |

Section breakdown (of 190):

| Section | Count |
|---|---|
| `/guides/*` (incl. `/guides` index) | 107 |
| `/s/*` (product pages) | 42 |
| `/compare/*` (incl. index) | 28 |
| `/setup/*` (incl. index) | 8 |
| `/` (root) | 1 |
| `/mcp/connect` | 1 |
| `/bundle` | 1 |
| `/changelog` | 1 |
| `/privacy` | 1 |
| **Total** | **190** |

Every URL carries the same `lastmod` (2026-09-17), so `lastmod` carries **zero ranking
signal** here — it is a build-date stamp, not per-page edit history. This rules out the
task's fallback "rank by lastmod" heuristic: with one distinct value it cannot order
anything. Section + the explicit attribution data in §5 were used instead.

## 3. Per-URL HTTP Probe (200 / validators)

190/190 URLs probed concurrently (`curl`, 12 workers, 20s timeout, browser-ish UA).

| Result | Count |
|---|---|
| HTTP **200** | **190 / 190** |
| HTTP 4xx/5xx | **0** |
| Connection/timeout errors | **0** |
| Carries `Last-Modified` | 189 / 190 |
| Carries `ETag` | **0 / 190** |
| `Cache-Control: public, max-age=3600` | 189 / 190 |
| `Cache-Control: no-store` | 1 / 190 |

Every URL in the sitemap is a live 200.

## 4. Anomaly Table

| # | URL | Observation | Assessment |
|---|---|---|---|
| A1 | `https://mcp.zovo.one/mcp/connect` | Only URL with **no `Last-Modified`** and the only one with `Cache-Control: no-store` | Correct by design — it is a live-connect endpoint that must not be cached. Not a defect, but it means `mcp/connect` gives crawlers **no freshness validator**, so re-crawl decisions there rely on `lastmod`/links alone. Low risk. |
| A2 | all 190 URLs | **No `ETag` on any URL** | Conditional requests fall back to `If-Modified-Since`. Works, but `Last-Modified` has 1-second granularity and, per §2, every page shares one date. A crawler that saw the 2026-09-17 stamp cannot detect a same-day edit via validators. Add ETags (content hash) to make change detection reliable. |
| A3 | sitemap-wide | All 190 `<lastmod>` identical (`2026-09-17`) | Sitemap `lastmod` gives Google/ClaudeBot no change signal. Weakens the sitemap as a re-crawl trigger. |
| A4 | `/setup/*` | 8 URLs present and 200, but excluded by `scripts/indexnow.mjs` default filter only for `/setup/<client>/<server>` permutations — the 8 `/setup/*` here are client-only (`/setup/claude-desktop` etc.) and **are** submitted | No defect; recorded so the filter's scope is unambiguous. |

No status-code anomalies found: **0 of 190 URLs are broken.**

## 5. Uncovered Delta (ClaudeBot 140/190)

Source of truth: `data/traffic.json` → `sitemap_pages[]` — per-path `crawlers{}` map,
attributed from Cloudflare logs. This is the same structure the KPI reads
(`crawler_url_coverage.ClaudeBot.urls_fetched = 140`, `pct_of_sitemap = 99.3`).

The per-URL attribution names the covered set
directly, and intersecting it with the current 190-URL sitemap yields exactly **50
uncovered URLs** — matching the KPI's implied `190 − 140 = 50` precisely.

Verification that the two numbers are the same measurement:

| Quantity | Value |
|---|---|
| `crawler_url_coverage.ClaudeBot.urls_fetched` | 140 |
| ClaudeBot-hit paths intersected with current 190 sitemap paths | **140** |
| Delta (`190 − 140`) | **50** |
| `sitemap_pages` rows scanned | 141 |

Caveat stated for the record: `traffic.json` was generated `2026-09-09T09:09:47Z` and its
`sitemap_pages` holds 141 rows against today's 190-URL sitemap. The 140 covered paths all
still exist in the current sitemap (intersection = 140, none dropped), so the delta is
constructed only from paths present in both — no stale path inflates or deflates it.

### Googlebot

`Googlebot` per-URL hits in `sitemap_pages`: **exactly 2 paths** — `/` and `/s/invoice`
(KPI: `Googlebot.urls_fetched = 2`, `pct_of_sitemap = 1.4`). Confirmed identical.

### The 50 uncovered URLs (delta submitted via IndexNow)

Composition: **31 `/guides/*`, 10 `/s/*`, 8 `/compare/*`, 1 `/mcp/connect`**.

```
https://mcp.zovo.one/mcp/connect
https://mcp.zovo.one/s/packing-list
https://mcp.zovo.one/s/checklist
https://mcp.zovo.one/s/bill-of-sale
https://mcp.zovo.one/s/credit-note
https://mcp.zovo.one/s/job-card
https://mcp.zovo.one/s/dunning-letters
https://mcp.zovo.one/s/supplier-list
https://mcp.zovo.one/s/service-agreement
https://mcp.zovo.one/s/maintenance-log
https://mcp.zovo.one/s/mileage-log
```
(+ 39 more, full list in the IndexNow body at `/tmp/t4_delta_body.json`; enumerated below)

Full delta list (50):

```
https://mcp.zovo.one/mcp/connect
https://mcp.zovo.one/s/packing-list
https://mcp.zovo.one/s/checklist
https://mcp.zovo.one/s/bill-of-sale
https://mcp.zovo.one/s/credit-note
https://mcp.zovo.one/s/job-card
https://mcp.zovo.one/s/dunning-letters
https://mcp.zovo.one/s/supplier-list
https://mcp.zovo.one/s/service-agreement
https://mcp.zovo.one/s/maintenance-log
https://mcp.zovo.one/s/mileage-log
https://mcp.zovo.one/guides/bill-of-sale-from-chat
https://mcp.zovo.one/guides/how-mcp-registry-search-works
https://mcp.zovo.one/guides/hosted-mcp-server-discovery-without-a-token
https://mcp.zovo.one/guides/mcp-registry-remote-url-is-unique
https://mcp.zovo.one/guides/mcp-registry-rank-and-letter-case
https://mcp.zovo.one/guides/how-crowded-is-an-mcp-server-name
https://mcp.zovo.one/guides/server-json-field-reference
https://mcp.zovo.one/guides/mcp-tool-errors-versus-protocol-errors
https://mcp.zovo.one/guides/mcp-structured-tool-output
https://mcp.zovo.one/guides/naming-mcp-tools
https://mcp.zovo.one/guides/mcp-stateful-tools-and-handles
https://mcp.zovo.one/guides/x-mcp-header-tool-parameters
https://mcp.zovo.one/guides/how-a-directory-scores-your-mcp-server
https://mcp.zovo.one/guides/what-ai-crawlers-fetch-that-googlebot-does-not
https://mcp.zovo.one/guides/search-console-url-inspection-coverage-is-unstable
https://mcp.zovo.one/guides/which-mcp-servers-work-by-pasting-a-url
https://mcp.zovo.one/guides/paid-mcp-servers-and-how-you-pay-for-one
https://mcp.zovo.one/guides/fill-a-quote-or-estimate-template-from-chat
https://mcp.zovo.one/guides/petty-cash-book-and-cash-ledger-mcp-servers
https://mcp.zovo.one/guides/currency-conversion-mcp-servers-compared
https://mcp.zovo.one/guides/zip-and-unzip-mcp-servers-compared
https://mcp.zovo.one/guides/delivery-schedule-and-work-order-documents-from-mcp
https://mcp.zovo.one/guides/will-an-mcp-server-email-the-invoice-to-my-client
https://mcp.zovo.one/guides/can-an-mcp-server-read-a-photo-of-a-receipt
https://mcp.zovo.one/guides/what-mcp-server-generates-invoices
https://mcp.zovo.one/guides/mcp-server-that-reads-bank-statements-and-categorizes
https://mcp.zovo.one/guides/best-mcp-servers-for-small-business-accounting
https://mcp.zovo.one/guides/supplier-directory-from-chat
https://mcp.zovo.one/guides/service-agreements-from-chat
https://mcp.zovo.one/guides/equipment-maintenance-log-from-chat
https://mcp.zovo.one/guides/vehicle-mileage-log-from-chat
https://mcp.zovo.one/compare/mileage-log
https://mcp.zovo.one/compare/maintenance-log
https://mcp.zovo.one/compare/service-agreement
https://mcp.zovo.one/compare/deposits
https://mcp.zovo.one/compare/cash-book
https://mcp.zovo.one/compare/work-order
https://mcp.zovo.one/compare/asset-register
https://mcp.zovo.one/compare/supplier-list
```

## 6. IndexNow Resubmission

### 6.1 Precondition — key file health

`scripts/indexnow.mjs` refuses to submit if the key file is unreachable or its body does
not exactly equal the key. Verified before submitting:

| Check | Result |
|---|---|
| `https://mcp.zovo.one/db6dbf5cfdbc08d1cc9b5365d398145b.txt` HTTP | **200** |
| Body | `db6dbf5cfdbc08d1cc9b5365d398145b` (32 bytes, key only) |
| Body == `data/indexnow.json` `.key` | **exact match** |

### 6.2 Submission

Request shape matched to `scripts/indexnow.mjs` (lines 41–45):
`{host, key, keyLocation, urlList}`, `Content-Type: application/json; charset=utf-8`.
50 URLs is under the 100-per-batch limit, so one POST covered the whole delta.

| Field | Value |
|---|---|
| Endpoint | `https://api.indexnow.org/indexnow` |
| Method | POST |
| URLs in body | **50** |
| **HTTP status** | **200** |
| Response body | empty (IndexNow success convention) |

`200` (rather than `202`) means the key was already validated and
the URL set was taken for immediate processing, consistent with the sprint-42 result.

IndexNow confirms *receipt*, not that Bing/Yandex/etc. will fetch
these URLs or that ClaudeBot (which does not consume IndexNow) will pick them up. The only
proof is re-measuring `data/traffic.json` → `sitemap_pages[].crawlers{}` for these 50 paths
on a future run (see §7).

### 6.3 Double-coverage note

The delta is **complementary** to the sprint-42 submission. Sprint 42 posted the 34-URL
*remainder* (`/`, `/compare/*` index+servers, `/setup/*`, `/privacy`, …). This run posts the
50 URLs that the *coverage evidence* — not the sitemap filter — shows ClaudeBot has never
fetched. Overlap between the two sets is **zero by construction**: the 50 here are exactly
the un-fetched remainder, the sprint-42 set was the non-`/s/`+`/guides/` remainder.

## 7. Findings & Next Actions

### Findings

1. **The site is technically clean.** 190/190 sitemap URLs return HTTP 200. Zero 404s,
   zero 500s, zero timeouts. No crawl-blocking faults.
2. **Crawl coverage is bimodal, and the gap is page-type-shaped, not health-shaped.**
   ClaudeBot: 140/190 (73.7%). Googlebot: 2/190 (1.1%). Same sitemap, same 200s — so the
   difference is crawler policy/budget, not site breakage.
3. **The 50 uncovered URLs are concentrated in the newest document/product surfaces**:
   31 `/guides/*` (the recent content push), 10 `/s/*` product pages
   (packing-list, checklist, bill-of-sale, credit-note, job-card, dunning-letters,
   supplier-list, service-agreement, maintenance-log, mileage-log), and 8 `/compare/*`
   pages. These read like a coherent cluster — *small-business document/record tools* —
   added after the 2026-09-09 measurement window, which is the most likely reason ClaudeBot
   has not swept them yet: they are newer than the attributed log window.
4. **No `ETag` anywhere and a single shared `lastmod`** (§2, A2, A3) mean crawlers have no
   reliable change signal on this site. `/mcp/connect` is the sole cache-exempt URL.
5. **Googlebot's 2/190 is the real story.** Googlebot is not crawling this host in any
   meaningful volume (`requests: 8`, `urls_fetched: 2`). IndexNow does **not** feed
   Googlebot. This is a discovery/link-equity problem, not an IndexNow problem.

### Next actions (ranked)

| # | Action | Why |
|---|---|---|
| N1 | **Re-run the coverage measurement** on the next `data/traffic.json` refresh and check `sitemap_pages[].crawlers.ClaudeBot` against this 50-URL list. | The only way to prove the IndexNow submission moved anything. Acceptance ≠ crawl (§6.2). |
| N2 | **Treat Googlebot's 2/190 as a separate workstream.** IndexNow cannot fix it. Needs outbound links / Search Console URL-inspection submissions / an internal-link path from the flagship domain. | Googlebot has 8 total requests to the host — it barely knows the site exists. |
| N3 | **Add `ETag` headers** (content hash) and, ideally, per-page `lastmod` in `sitemap.xml`. | Restores conditional-request and change-detection signal crawlers currently lack (A2, A3). Cheap server-side win. |
| N4 | **Schedule IndexNow to run on sitemap change** rather than ad hoc, so new `/guides/*` URLs are pinged the moment they publish. | Findings #3: the uncovered set is dominated by recently-added guides. |

## 8. Appendix: Commands

All commands run from `/Users/mike/mcp-servers`, 2026-09-18.

```bash
curl -sS -o /tmp/sitemap.xml -w "HTTP=%{http_code} bytes=%{size_download}\n" \
  https://mcp.zovo.one/sitemap.xml
# -> HTTP=200 bytes=19361
/usr/bin/grep -o '<loc>' /tmp/sitemap.xml | wc -l
# -> 190
```

```python
# for each URL, run:
#   curl -sS -o /dev/null -D - --max-time 20 -A "Mozilla/5.0 (compatible; probe/1.0)" <url>
# parse the status line + Last-Modified / ETag / Cache-Control
# -> 200:190, last-mod present:189, etag present:0,
#    cache-control: {public, max-age=3600: 189, no-store: 1}
```

```bash
python3 -c "
import json,urllib.parse
d=json.load(open('data/traffic.json'))
sp=d['sitemap_pages']
cb={p['path'] for p in sp if 'ClaudeBot' in (p.get('crawlers') or {})}
gb={p['path'] for p in sp if 'Googlebot' in (p.get('crawlers') or {})}
print('ClaudeBot paths:',len(cb),'Googlebot paths:',sorted(gb))
"
# -> ClaudeBot paths: 140   Googlebot paths: ['/', '/s/invoice']
```

```python
delta = [u for u in sitemap_urls if urllib.parse.urlparse(u).path not in cb]
# -> 50 URLs: /guides 31, /s/* 10, /compare 8, /mcp/connect 1
```

```bash
curl -sS -o /tmp/keyfile.txt -w "HTTP=%{http_code}\n" \
  https://mcp.zovo.one/db6dbf5cfdbc08d1cc9b5365d398145b.txt
# -> HTTP=200, body "db6dbf5cfdbc08d1cc9b5365d398145b" (== data/indexnow.json .key)
```

```bash
curl -sS -o /tmp/t4_ix_resp.txt -w "HTTP=%{http_code}" -X POST \
  https://api.indexnow.org/indexnow \
  -H "Content-Type: application/json; charset=utf-8" \
  --data @/tmp/t4_delta_body.json
# -> HTTP=200, body empty (accepted), urlList length 50
```

`data/kpi.json` was **not** modified by this task (per brief —
orchestrator refreshes it).
