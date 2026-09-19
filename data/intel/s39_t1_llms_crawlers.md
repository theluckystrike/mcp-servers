# s39_t1 — AI-crawler surface audit + push

STATUS: complete (2026-09-17T14:05Z)

## 1. llms.txt completeness

Fetched with: `curl -s https://mcp.zovo.one/llms.txt` -> HTTP 200, 89961 bytes.
URLs listed in llms.txt: `grep -c` equivalents over the saved body gave
/s/ 42, /guides/ 102, /compare/ 19.

Source-of-truth sets, extracted from the billing worker source:
- `PAGES` in `billing/src/pages.js` — 42 keys
- `GUIDES` in `billing/src/content.js` — 112 keys
- `COMPARE` in `billing/src/compare.js` — 5 keys

| Set | In source | In llms.txt | Missing | Verdict |
|---|---|---|---|---|
| /s/ (PAGES) | 42 | 42 | 0 | complete |
| /guides/ (GUIDES) | 112 | 102 | 9 apparent, 0 real | complete |
| /compare/ (COMPARE) | 5 | 19 | 0 | complete (lists aliases too) |

### Apparent gaps audited and cleared

Nine GUIDES keys looked absent from llms.txt: `as_at_rule`, `naive_rule`,
`user_config`, `author`, `error`, `repository`, `result`, `server`, `servers`.
Every one returns HTTP 404 on the live host:

    for u in as_at_rule naive_rule user_config server servers result error author repository; do
      curl -s -o /dev/null -w "%{http_code}\n" https://mcp.zovo.one/guides/$u
    done   -> 404 404 404 404 404 404 404 404 404

They are not pages: they are JSON/code-fragment substrings inside `content.js`
(for example the JSON snippets `"author": {...}`, `"server": {...}`,
`"user_config": {...}` embedded in guide prose). The naive regex over
`GUIDES` counted them as keys; they are never routable URLs, so their absence
from llms.txt is correct. No genuine page is missing from llms.txt.

Independent cross-check against the live sitemap:
`curl -s https://mcp.zovo.one/sitemap.xml` -> 178 `<loc>` entries,
103 guides + 42 /s/ + 20 compare + 8 setup + 5 root. The 103rd guide entry is
the `/guides` index itself, so sitemap and llms.txt agree exactly at 102 leaves.

## 2. Header findings — no Last-Modified anywhere

    curl -sI https://mcp.zovo.one/llms.txt
    curl -sI https://mcp.zovo.one/s/invoice

Both return HTTP/2 200 from `server: cloudflare` with no `Last-Modified` header:

- `/llms.txt` — date, content-type (text/plain; charset=utf-8),
  strict-transport-security, x-content-type-options, report-to, nel,
  server, cf-ray. **No Last-Modified, no ETag, no Cache-Control.**
- `/s/invoice` — same set plus `cache-control: public, max-age=3600`.
  HTML pages get a 1h TTL but no
  conditional-request validator.

## 3. ClaudeBot 31-unfetched-URL analysis — NOT MACHINE-READABLE, skipped

The 140/171 figure is real and comes from `data/indexation.json`:

    "crawler_url_coverage": { "ClaudeBot": { "urls_fetched": 140, "requests": 144,
                                            "pct_of_sitemap": 99.3 }, ... }

That file — the Cloudflare adaptive-dataset census for window
2026-09-02T12:00Z to 2026-09-09T09:00Z — stores **only aggregate counts**
per crawler (`urls_fetched`, `requests`, `pct_of_sitemap`). A repo-wide scan
for a per-URL crawler map (keys `urls_fetched_by*`, `crawler_urls`,
`fetched_urls`, `url_list` alongside `ClaudeBot`) returned exactly one file,
`data/indexation.json`, and it contains no URL list.

`data/indexation.json` is also internally inconsistent with the 171 denominator:
top-level `sitemap_urls` is 141 while `entries`/`google.urls` holds 141 entries,
and the 171 figure lives only in the earlier `docs/GOOGLE_INDEX_R2.md` narrative
(171 `<loc>`, before the guides expansion). So even the denominator has drifted.

The 31 specific URLs ClaudeBot has not fetched **cannot be identified** from
any machine-readable source in this repo. The per-URL crawl log required to
produce that list is not present (it is Cloudflare-side, and the repo only kept
the rolled-up counts). Reported as a data gap; per instructions, skipped rather
than fabricated.

## 4. IndexNow re-submission

`scripts/indexnow.mjs` has **no URL-list mode** — its only flags are `--all`
and `--dry`, and it always reads the full sitemap then filters out the
`/setup/<client>/<product>` permutations. To submit *only* /s/ and /guides/ I
reused the script's own contract (same `data/indexnow.json` host/key/keyLocation,
same `https://api.indexnow.org/indexnow` endpoint, one JSON POST) with the
subset extracted from the live sitemap.

    # subset selection
    curl -s https://mcp.zovo.one/sitemap.xml   -> 178 <loc>
    filter /(s|guides)/                       -> 144 URLs (42 /s/, 102 /guides/), 0 duplicates

    # submission
    POST https://api.indexnow.org/indexnow  {"host","key","keyLocation","urlList":[144 urls]}
    -> HTTP 200

Result: **144 URLs accepted (HTTP 200)** — 42 product pages + 102 guides.
The 8 `/setup/<client>/<product>` permutations, the 20 `/compare/` pages and
the 5 root pages were deliberately NOT submitted, so the same URL set was not
re-pinged inside the 24h window. No error body returned.

## 5. Ranked recommendation

**1. Serve a stable `Last-Modified` (and matching `ETag`) on every HTML page and
on `/llms.txt`.**

Both AI-facing surfaces currently answer with no freshness validator at all,
while `/s/invoice` does carry a cache TTL — the estate advertises a 1-hour cache
but gives a crawler no way to ask "has this changed since I last fetched it".
Cloudflare therefore re-serves full bodies, and a crawler budgeting its crawl
against ~178 URLs has no cheap revalidation path. llms.txt is the single most
valuable document for AI legibility here (89 KB describing all 42 servers, all
102 guides and the compare set) yet it is header-indistinguishable from a static
asset. Emitting `Last-Modified` from the newest `CHANGELOG.releases` entry per
page — the exact mechanism already planned in `docs/GOOGLE_INDEX_R2.md` for
sitemap `<lastmod>` — would let ClaudeBot, GPTBot and PerplexityBot revalidate
with a conditional GET instead of a full refetch, which is the cheapest way to
convert the already-good 99.3% ClaudeBot coverage into repeat coverage without
spending more of any crawler's budget.

Secondary (not ranked first because it is blocked on data, not code): persist a
per-URL crawler log so the "31 unfetched URLs" question is answerable at all;
today only counts survive, so this class of audit cannot be repeated.

## Evidence commands

    curl -s -o /tmp/llms.txt -w "HTTP %{http_code} size %{size_download}\n" https://mcp.zovo.one/llms.txt
    curl -sI https://mcp.zovo.one/llms.txt
    curl -sI https://mcp.zovo.one/s/invoice
    curl -s https://mcp.zovo.one/sitemap.xml -o /tmp/sm.xml && grep -o '<loc>' /tmp/sm.xml | wc -l
    node scripts/indexnow.mjs --dry
    POST https://api.indexnow.org/indexnow -> HTTP 200 (144 URLs)
    python/json read of billing/src/{pages,content,compare}.js key sets
    python/json read of data/indexation.json crawler_url_coverage
