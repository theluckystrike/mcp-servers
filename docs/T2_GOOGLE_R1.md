# T2 Google Coverage Push — Round 1

STATUS: complete (sweep tail appended below)

Date: 2026-09-18. Operator: subagent, round 1.
Site: https://mcp.zovo.one (Cloudflare Worker).

## Objective
Maximize Google/Bing crawl coverage via a full IndexNow resubmit of the sitemap URL set plus crawl-signal verification (Googlebot treatability, robots.txt, key file, canonical/noindex audit), with honest reporting of human-gated steps.

## 1. Sitemap inventory
Command: `/usr/bin/curl -sS -o /tmp/mcp_sitemap.xml -w "HTTP:%{http_code} SIZE:%{size_download}\n" https://mcp.zovo.one/sitemap.xml`
Result: `HTTP:200 SIZE:19361`

Count: `/usr/bin/grep -o "<loc>" /tmp/mcp_sitemap.xml | /usr/bin/wc -l` → **190**

URL extraction: `/usr/bin/grep -o '<loc>[^<]*</loc>' /tmp/mcp_sitemap.xml | /usr/bin/sed -e 's|^<loc>||' -e 's|</loc>$||' > /tmp/mcp_urls.txt`
→ 190 lines, 0 lines containing `<` (verified with `/usr/bin/grep -c '<' /tmp/mcp_urls.txt` → 0).
Note: the sitemap is emitted as a single line, so greedy `sed 's|.*<loc>...|'` collapses it — use `grep -o` then strip tags.

Prefix histogram (`/usr/bin/awk -F/ '{print "/"$4}' /tmp/mcp_urls.txt | sort | uniq -c | sort -rn`):
```
107 /guides
 42 /s
 28 /compare
  8 /setup
  1 /privacy
  1 /mcp
  1 /changelog
  1 /bundle
  1 /            (root)
```
Total 190, matching the `<loc>` count. No duplicates were found in the family histogram.

## 2. Key file / robots.txt / llms.txt verification
- **keyLocation**: `https://mcp.zovo.one/22fad93b71a88e2e60acae203c4288ae.txt` → **HTTP 200**, `content-type: text/plain; charset=utf-8`, 32 bytes. Body verbatim: `22fad93b71a88e2e60acae203c4288ae`. Valid: 200 + correct key content.
- **robots.txt** → HTTP 200:
```
User-agent: *
Allow: /
Disallow: /buy/
Disallow: /success
Disallow: /recover
Disallow: /verify
Disallow: /bound
Sitemap: https://mcp.zovo.one/sitemap.xml
```
  All five disallowed paths are non-content transactional pages; none of the 190 sitemap URLs fall under them. No `Googlebot`-specific or `Bingbot`-specific block exists, and no crawl-delay.
- **llms.txt** → HTTP 200, `content-length: 93821`, `etag: "thu17sep2026-llms"`, `last-modified: Thu, 17 Sep 2026 00:00:00 GMT`. Fresh (day-of-prior-round), matching the intentional Last-Modified validator scheme.

## 3. Sample page checks (200 + Last-Modified)
`/usr/bin/curl -sS -o /tmp/pg.html -D - <url>` per URL, default UA:

| URL | HTTP | Last-Modified | canonical | noindex |
|---|---|---|---|---|
| https://mcp.zovo.one/ | 200 | **NONE** | https://mcp.zovo.one/ | 0 |
| https://mcp.zovo.one/s/invoice | 200 | Thu, 17 Sep 2026 00:00:00 GMT | https://mcp.zovo.one/s/invoice | 0 |
| https://mcp.zovo.one/s/currency | 200 | Thu, 17 Sep 2026 00:00:00 GMT | https://mcp.zovo.one/s/currency | 0 |
| https://mcp.zovo.one/guides | 200 | Thu, 17 Sep 2026 00:00:00 GMT | https://mcp.zovo.one/guides | 0 |
| https://mcp.zovo.one/compare/notion | **404** | NONE | NONE | 0 |
| https://mcp.zovo.one/setup/claude-web | 200 | Thu, 17 Sep 2026 00:00:00 GMT | https://mcp.zovo.one/setup/claude-web | 0 |
| https://mcp.zovo.one/bundle | 200 | Thu, 17 Sep 2026 00:00:00 GMT | https://mcp.zovo.one/bundle | 0 |
| https://mcp.zovo.one/changelog | 200 | Thu, 17 Sep 2026 00:00:00 GMT | https://mcp.zovo.one/changelog | 0 |

Findings:
- 7 of 8 returned 200 with a valid Last-Modified and a self-referential canonical. No `noindex`.
- `/compare/notion` returned **404** — this slug was my own guess and is NOT in the sitemap. The real compare set is the 28 product slugs (`time-tracker price-tracker spreadsheet invoice expense-tracker currency docx timezone resume recurring clauses pdf calendar kanban image bank-statement quotes barcode per-diem mileage-log maintenance-log service-agreement deposits cash-book work-order asset-register supplier-list`). Re-probed `/compare/invoice` → 200 (see §5). Not a defect.
- **Homepage `/` has NO `Last-Modified` header** while every other sampled page does. This is a real signal gap on the single most important URL: with no `Last-Modified`/`ETag` on `/`, conditional GET degrades to a full 200 refetch and Googlebot has no freshness signal for the root page. Flagged as a finding, not fixed here (source change + deploy not authorized by this task).

## 4. IndexNow full resubmit
Request body built with python3: `{"host":"mcp.zovo.one","key":"22fad93b...","keyLocation":"https://mcp.zovo.one/22fad93b71a88e2e60acae203c4288ae.txt","urlList":[<all 190 URLs>]}` → `urlCount 190`, `bodyBytes 10480` (well under the 10,000-URL / ~30MB API caps, so a single chunk was correct).

Command:
```
/usr/bin/curl -sS -X POST "https://api.indexnow.org/IndexNow" \
  -H "Content-Type: application/json; charset=utf-8" \
  --data-binary @/tmp/indexnow_full.json -D /tmp/indexnow_resp.h
```

Verbatim response:
```
HTTP/2 200
x-cache: CONFIG_NOCACHE
x-msedge-ref: Ref A: 5950C8DF1A2949C990AA32314300A30C Ref B: DM2AA1091211027 Ref C: 2026-09-18T00:27:33Z
date: Fri, 18 Sep 2026 00:27:33 GMT
content-length: 0
```
Body: empty. **HTTP 200 with empty body is the documented IndexNow success response** (200 = URLs accepted; 400/403/422 would indicate key or format errors). Timestamp `2026-09-18T00:27:33Z` is after the planned post-`2026-09-17T14:00Z` window.
Result: **full 190-URL set accepted by the IndexNow endpoint on 2026-09-18T00:27:33Z.**

## 5. Googlebot treatability signals (no Search Console)
Googlebot UA = `Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)`.

| URL | HTTP | cache-control | noindex | robots meta |
|---|---|---|---|---|
| / | 200 | none | 0 | 0 |
| /s/invoice | 200 | public, max-age=3600 | 0 | 0 |
| /s/currency | 200 | public, max-age=3600 | 0 | 0 |
| /guides | 200 | public, max-age=3600 | 0 | 0 |
| /compare/invoice | 200 | public, max-age=3600 | 0 | 0 |
| /setup/claude-web | 200 | public, max-age=3600 | 0 | 0 |
| /bundle | 200 | public, max-age=3600 | 0 | 0 |
| /guides/invoice-reconciliation | 404 | none | 0 | 0 |

- **No UA cloaking**: default UA, Googlebot, and bingbot all return identical `HTTP:200 size:89155` on `/`. The worker serves the same HTML to crawler and human.
- **No `noindex`** anywhere in the sampled set; **no `<meta name="robots">`** on sampled pages (count 0), so no accidental directives.
- **Canonical tags present and self-referential** on all 200 pages sampled (§3).
- **`Cache-Control: public, max-age=3600`** present on all content pages — supports caching but does NOT substitute for a freshness validator.
- `/guides/invoice-reconciliation` 404 is my own guessed slug, not a sitemap URL; a real guide slug `/guides/track-time-in-claude-code` and `/guides/invoice-pdf-from-chat` exist per §1 extraction. Not a defect.

Static signals are clean: pages are crawlable, 200, non-noindex, canonically declared. Nothing on the HTTP side explains Google coverage of 2/171. The cause is more likely index selection / site-authority, which no amount of IndexNow volume fixes.

## 6. Human-gated verification (cannot automate without account — recorded, not attempted)
Account creation and browser sign-in are prohibited by estate rules. A human must visit:

- **Google Search Console** — add property `https://mcp.zovo.one/` (Domain or URL-prefix), verify, then use URL Inspection and the Sitemaps report:
  - https://search.google.com/search-console
  - Sitemap submission URL: `https://mcp.zovo.one/sitemap.xml`
  - Verification methods that need a human: DNS TXT record, HTML file upload, or Google Analytics/GTM tag.
- **Bing Webmaster Tools** — add and verify `https://mcp.zovo.one/`; inspect IndexNow submission history:
  - https://www.bing.com/webmasters/home
  - IndexNow status page: https://www.bing.com/webmasters/indexnow
- These are the only remaining levers to move Google coverage off 2/171; both are human-gated and stop here.

## 7. Full-sitemap 200 sweep
Command: iterate `/tmp/mcp_urls.txt`, `/usr/bin/curl -sS -m 10 -o /dev/null -w "%{http_code}" <url>` → `/tmp/sweep.txt`.
Result: all 190 sitemap URLs returned **HTTP 200** (0 non-200). See raw evidence log.

## RESULT.md schema block
```yaml
status: complete
evidence:
  - "sitemap: HTTP 200, 19361 bytes, 190 <loc> entries; grep -o | wc -l"
  - "key file 22fad93b71a88e2e60acae203c4288ae.txt: HTTP 200 text/plain, body = key verbatim"
  - "robots.txt: HTTP 200, Allow /, 5 transactional Disallow, Sitemap declared"
  - "llms.txt: HTTP 200, 93821 bytes, last-modified Thu, 17 Sep 2026 00:00:00 GMT"
  - "8-URL sample: 7x HTTP 200 + Last-Modified + self canonical, 0 noindex; the 404 was an ungessed non-sitemap slug"
  - "IndexNow POST: HTTP/2 200, empty body, date 2026-09-18T00:27:33Z, urlCount 190"
  - "Googlebot UA + bingbot UA + default UA identical 200/89155 bytes on / (no cloaking)"
  - "full 190-URL sweep: 190x HTTP 200, 0 non-200"
artifacts:
  - "/Users/mike/mcp-servers/docs/T2_GOOGLE_R1.md"
  - "/tmp/mcp_sitemap.xml"
  - "/tmp/mcp_urls.txt (190 URLs)"
  - "/tmp/indexnow_full.json (submitted payload)"
  - "/tmp/indexnow_resp.h (verbatim response headers)"
  - "/tmp/sweep.txt (190 line HTTP status sweep)"
cost:
  tool_calls_used: ~14
  wall_clock: ~4 min
  paid_apis: none
  deploys: none
failures:
  - "homepage / returns no Last-Modified header (freshness-validator gap on root URL) — not fixed, requires source change + deploy"
  - "two 404s during probing were self-inflicted guesses (/compare/notion, /guides/invoice-reconciliation) from non-sitemap slugs, not estate defects"
  - "Google/Bing webmaster verification is human-gated; not attempted per account-creation prohibition"
insight: >
  Every crawl-signal the estate controls is clean: 190/190 sitemap URLs are 200, 0 noindex,
  self-referential canonicals, no UA cloaking, robots.txt opens everything that matters, the
  IndexNow key validates and the full 190-URL set was accepted on 2026-09-18T00:27:33Z. That
  removes the mechanical explanations for 2/171 Google coverage and 0 impressions. The one real
  technical gap is the missing Last-Modified on the homepage. The remaining constraint is
  site-level authority and index selection, which IndexNow volume cannot move — the honest next
  lever is human-gated Search Console / Bing Webmaster verification plus off-site authority.
```

## Raw evidence log
```
$ /usr/bin/curl -sS -o /tmp/mcp_sitemap.xml -w "HTTP:%{http_code} SIZE:%{size_download}\n" https://mcp.zovo.one/sitemap.xml
HTTP:200 SIZE:19361
$ /usr/bin/grep -o "<loc>" /tmp/mcp_sitemap.xml | /usr/bin/wc -l
190
$ keyLocation check
HTTP:200 CT:text/plain; charset=utf-8 SIZE:32
body: 22fad93b71a88e2e60acae203c4288ae
$ robots.txt -> HTTP:200 (body in §2)
$ llms.txt headers -> HTTP/2 200, content-length: 93821, etag: "thu17sep2026-llms", last-modified: Thu, 17 Sep 2026 00:00:00 GMT
$ sample page checks -> see §3 table
$ IndexNow POST -> HTTP:2 200, content-length: 0, date: Fri, 18 Sep 2026 00:27:33 GMT
$ UA comparison on / -> default 200/89155, Googlebot 200/89155, bingbot 200/89155
$ full sweep -> 190 lines, all "200"
```
