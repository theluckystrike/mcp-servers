# Why Google still will not touch mcp.zovo.one - crawlability audit R2, 2026-09-12

Machine-readable: `data/google_index_r2.json`. Every number below carries the command that produced it.
Context: `docs/GOOGLE_INDEX_R1.md` (loop 33) proved the split is host-level - Googlebot had crawled 1
of 154 URLs ever, all inbound equity lands on `/`, and content could not be the cause because the pages
were never fetched. This round re-audits the crawl surface live and fixes what is actually broken in
source. No deploy (wave C owns that).

---

## Result

The crawl surface is far healthier than the indexing numbers suggest. robots.txt is clean, the sitemap
is valid and every one of its 171 URLs returns 200, canonicals are self-referential, no stray noindex
exists anywhere on a crawlable URL, Googlebot gets the same bytes as Chrome, and the redirect chain is a
single 301. Two real defects were found and fixed in source: the sitemap shipped **zero `<lastmod>`**
(0/171) where the crawled sibling zovo.one ships 407/407, and every page was served twice as a
trailing-slash 200-duplicate where zovo.one 301s the slash form. Neither explains a 99-day zero on its
own; the operative cause remains R1's host-level crawl starvation behind a one-URL inbound link graph.
The brief's thin/duplicate-content hypothesis is refuted with measurements below.

---

## 1. robots.txt - clean

    $ curl -sS -i https://mcp.zovo.one/robots.txt
    HTTP/2 200, content-length 154

    User-agent: *
    Allow: /
    Disallow: /buy/
    Disallow: /success
    Disallow: /recover
    Disallow: /verify
    Disallow: /bound
    Sitemap: https://mcp.zovo.one/sitemap.xml

Full allow, disallows are the transactional/checkout paths only, sitemap line present. Byte-identical to
the literal at `billing/src/index.js` (the `return new Response("User-agent: *...` line in the
`/robots.txt` handler) - no Cloudflare injection.

## 2. sitemap.xml - valid, fully resolvable, but had zero freshness signal

    $ curl -sS https://mcp.zovo.one/sitemap.xml -w '%{http_code} %{size_download}\n' -o /tmp/gi_sitemap.xml
    200 12507
    $ /usr/bin/grep -o '<loc>' /tmp/gi_sitemap.xml | wc -l        -> 171
    $ /usr/bin/grep -o '<lastmod>' /tmp/gi_sitemap.xml | wc -l    -> 0   (defect, fixed in source)

Composition: 100 guides-section, 38 `/s/`, 20 compare-section, 8 setup, and `/`, `/mcp/connect`,
`/bundle`, `/changelog`, `/privacy`. All https, same host, zero query-parameter garbage.

Full status sweep, every URL fetched once (loop over `/tmp/gi35/all_urls.txt`,
`curl -sS -o /dev/null -w '%{http_code}'`):

    171 x HTTP 200, zero non-200

The generator is `billing/src/index.js` (the only file in the repo containing `urlset`; confirmed by
`grep -rln urlset --include=*.js --include=*.ts --include=*.mjs`). Offline count of its URL sources
reproduces 171 exactly: 7 fixed + 38 PAGES + 99 GUIDES + 19 COMPARE + 8 setup <=2-segment.

## 3. Five page probes - no indexation poison anywhere

HEAD requests on all five: **no `x-robots-tag` header on any page**. Body parse:

| URL | Status | meta robots | canonical | title (distinct) | visible words |
|---|---|---|---|---|---|
| `/` | 200 | none | self, https | "MCP servers for Claude: invoices..." | 7,485 |
| `/s/invoice` | 200 | none | self, https | "MCP Invoice for Claude, Cursor..." | 3,893 |
| `/setup/claude-desktop` | 200 | none | self, https | "MCP servers for Claude Desktop..." | 1,055 |
| `/guides/free-mcp-servers-for-freelancers` | 200 | none | self, https | "What these MCP servers actually do..." | 922 |
| `/buy/invoice` | **303 -> /s/invoice** | - | - | - | - |

`/buy/` is disallowed in robots.txt and absent from the sitemap; the 303 is by design. The deliberate
`noindex,follow` at `billing/src/index.js:1183` fires only on 3-segment `/setup/<client>/<server>` pages,
and the sitemap filter (`setupUrls().filter(... <= 2)`) excludes exactly those - verified: no sitemap URL
carries noindex. Titles: 6 of 6 probed pages distinct. Structured data present everywhere
(SoftwareApplication / TechArticle / FAQPage / ItemList).

Googlebot cloaking check:

    $ curl -sS -A 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' .../s/invoice
    200, 40,136 bytes; Chrome UA: 200, 40,136 bytes; only differing bytes are the CF ray-id/timestamp

## 4. Redirect chains

    $ curl -sS -o /dev/null -w '%{http_code} %{num_redirects} %{url_effective}\n' -L http://mcp.zovo.one/
    200 1 https://mcp.zovo.one/          (single 301 at the HTTP layer)
    $ curl -sSI http://mcp.zovo.one/ | grep -i location
    Location: https://mcp.zovo.one/
    $ curl -sS https://www.mcp.zovo.one/
    curl: (6) Could not resolve host     (www.mcp.zovo.one is NXDOMAIN - no duplicate-host surface)

## 5. Positive control - what zovo.one has that mcp.zovo.one lacked

    $ curl -sS https://zovo.one/sitemap.xml            -> sitemap index, 6 children
    $ curl -sS https://zovo.one/sitemap-01-main.xml
    407 x <loc>, 407 x <lastmod>, plus changefreq + priority on every entry
    $ curl -sS -o /dev/null -w '%{http_code} -> %{redirect_url}\n' https://zovo.one/free-tools/html-entity-encoder/
    301 -> https://zovo.one/free-tools/html-entity-encoder

The two indexation-relevant diffs: **lastmod 407/407 vs our 0/171**, and **trailing-slash 301 vs our
200-duplicate** (`/s/invoice/` served the identical 40,136-byte body pre-fix; canonical pointed to the
bare form, so consolidation relied on the tag alone). zovo.one deep pages also carry og:/twitter: tags
and BreadcrumbList; those are social/rich-result polish with no indexation role - recorded as
recommendations, not fixed.

## 6. What the collected data says (data/gsc.json, data/indexation.json)

- `gsc.json` host_probe, window 2026-08-09..2026-09-06, filter `page contains //mcp.zovo.one/`: 29 daily
  rows, **0 days with impressions, 0 clicks**. fresh_probe (2026-08-30..09-09, dataState all, so the
  ~3-day final lag cannot hide a recent first impression): 10 rows, 0 impressions. Same-call positive
  control zovo.one: 10/10 days with impressions, 1,818 impressions, 17 clicks.
- `indexation.json` urlInspection census 2026-09-09 (141 URLs, 0 API errors): in_google_index **1**,
  ever_crawled_by_google **1** (the homepage, 2026-09-08T17:20:24Z), coverage 51 discovered / 89 unknown
  / 1 indexed. The R1 census on 154 URLs a day later: 115 discovered / 38 unknown / 1 indexed. The
  discovered/unknown split is documented-unstable noise; the stable pair is in_index and ever_crawled.
- `indexation.json` crawl_evidence, 7d Cloudflare adaptive dataset: **Googlebot fetched 2 URLs (8
  requests, 1.4% of the sitemap)** while ClaudeBot fetched 140 (99.3%), Amazonbot 127, bingbot 35.
- Internal linking is not the blocker: the homepage (the one URL Googlebot does crawl) links 148 of the
  171 sitemap URLs (`python3` href parse of `/` vs sitemap set); the remaining 23 are `/compare/*`, one
  hop deeper.

## 7. Verdict on the prime hypothesis - thin/duplicate suppression: REFUTED

8 sampled `/s/` pages, stripped visible text, python3 difflib pairwise:

    mean pairwise similarity 0.443 (n=28 pairs, min 0.379, max 0.508)
    visible words per page 2,707-4,049; unique words 987-1,452

Pages share template chrome and carry substantive unique bodies; doorway-grade duplication reads >0.9.
And the decisive fact is independent of content entirely: **Googlebot has fetched 2 of 171 URLs in 7
days and has never fetched 170 of them** - a crawler that has never fetched a page cannot have declined
it on content. The genuinely repetitive surface (216 client x product setup permutations, measured
73.6-77.5% similar in loop 29) is already `noindex,follow` and outside the sitemap.

## Root causes, ranked

1. **Host-level crawl starvation behind a degenerate inbound link graph (R1's verdict, stands).** Every
   external link to the subdomain resolves to `/`; Googlebot spends the new-host allowance there (2 URLs
   in 7d); the Discovered queue has not drained since sitemap submission 2026-09-04. Lever: distinct deep
   inbound links from already-indexed pages - R1 staged five in `extension-insiders/api/render.ts`,
   awaiting deploy; judge on `ever_crawled_by_google` at the next census.
2. **Sitemap shipped 0/171 lastmod** - the one crawl-scheduling hint the protocol offers, removed.
   FIXED IN SOURCE (below).
3. **Trailing-slash 200-duplicates of every page** - doubled the URL space a starved crawler must
   dedupe. FIXED IN SOURCE (below).

## What I changed (source only, no deploy - wave C deploys)

File: `/Users/mike/mcp-servers/billing/src/index.js` (sole generator of robots.txt, sitemap.xml and all
non-`/mcp` page markup; `build-vendor.mjs` carries 0 patches against it, so hard rule 9 is not triggered).

1. **Sitemap `<lastmod>` on all 171 URLs.** The date is the newest `CHANGELOG.releases` entry carrying a
   valid ISO date (currently v0.21.0, 2026-09-07). Every release re-bundles and redeploys every page from
   this same source and the catalog pages enumerate the fleet the release changed, so the date is honest
   at site granularity, and it moves on its own each release instead of going stale like a constant. If
   no dated release exists, lastmod is omitted rather than fabricated.
2. **Trailing-slash canonicalization.** GET/HEAD to a slash-terminated path now 301s to the bare form
   with the query string preserved (`cache-control: public, max-age=86400`). Routing already stripped
   trailing slashes, so the redirect target always resolves; POST and other methods fall through
   unchanged (`/verify`, `/bound`, `/buy` unaffected).

Verification (offline harness: import the worker, call `fetch` with a stub env):

    node --check billing/src/index.js                    -> SYNTAX_OK
    GET /sitemap.xml   -> 200, 171 <loc>, 171 <lastmod>, all 2026-09-07
    GET /s/invoice/    -> 301 https://mcp.zovo.one/s/invoice      (HEAD identical)
    GET /s/invoice     -> 200, 39,198 bytes, canonical intact
    GET /              -> 200
    POST /verify/      -> no redirect, unchanged fall-through

## Human-gated items

1. **Search Console owner upgrade** (carried from R1, still the one free unlock): the Indexing API
   returns 403 PERMISSION_DENIED because the service account is `siteFullUser`, not Owner.
   https://search.google.com/search-console -> `sc-domain:zovo.one` -> Settings -> Users and permissions
   -> Add user `zovo-gsc-cleanup@zovo-extensions.iam.gserviceaccount.com` -> permission **Owner**.
   ~30 seconds, free.
2. **After wave C deploys**, resubmit the sitemap once to force a re-download carrying lastmod:
   https://search.google.com/search-console/sitemaps?resource_id=sc-domain:zovo.one - one click, free.
3. Deploy of the two fixes above is wave-C orchestrator work (LOOP35_BRIEF rule 6: no wrangler deploy by
   this agent).

## Recommendations for the operator pack (not implemented - content strategy, not defects)

- og:/twitter: meta tags on mcp.zovo.one pages (social-share cards; zero indexation impact).
- BreadcrumbList structured data on `/s/` and `/guides/` pages, matching zovo.one deep pages.
- Do not trim the sitemap further or rewrite product pages "for thinness": the measured similarity is
  0.44, not doorway-grade, and Google has never fetched the pages to evaluate them. The binding
  constraint is the inbound link graph and crawl allowance, not the text.
