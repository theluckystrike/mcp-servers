# S40 T2 — IndexNow Remainder Submission

STATUS: complete
Date: 2026-09-17
Host: mcp.zovo.one
Key: db6dbf5cfdbc08d1cc9b5365d398145b
Endpoint: https://api.indexnow.org/indexnow

## 1. Sitemap inventory

Command: `curl -s -o /tmp/sitemap.xml -w "%{http_code}" https://mcp.zovo.one/sitemap.xml`
-> HTTP 200

Command: `/usr/bin/grep -o '<loc>[^<]*</loc>' /tmp/sitemap.xml | sed 's/<[^>]*>//g' | wc -l`
-> 182 total URLs in sitemap

Breakdown (single-line XML, so `grep -o | wc -l`, not `grep -c`):

| Segment | Count |
|---|---|
| `/s/` product pages | 42 |
| `/guides/` pages | 106 |
| `/s/` + `/guides/` subtotal (already submitted 2026-09-17 ~14:00Z) | 148 |
| **Remainder submitted this task** | **34** |

Note: the prior-submitted set was described as 144 URLs in the task brief; the current
sitemap yields 148 URLs matching `/s/` or `/guides/`. Those 4 extra URLs are live in the
sitemap now and were NOT resubmitted here (rule: no resubmit of a set pinged within 24h).
A follow-up should submit the 4 newly-appeared URLs after the 24h window closes.

## 2. Remainder URL set (34 URLs)

```
https://mcp.zovo.one/
https://mcp.zovo.one/mcp/connect
https://mcp.zovo.one/bundle
https://mcp.zovo.one/changelog
https://mcp.zovo.one/guides
https://mcp.zovo.one/compare
https://mcp.zovo.one/privacy
https://mcp.zovo.one/compare/time-tracker
https://mcp.zovo.one/compare/price-tracker
https://mcp.zovo.one/compare/spreadsheet
https://mcp.zovo.one/compare/invoice
https://mcp.zovo.one/compare/expense-tracker
https://mcp.zovo.one/compare/currency
https://mcp.zovo.one/compare/docx
https://mcp.zovo.one/compare/timezone
https://mcp.zovo.one/compare/resume
https://mcp.zovo.one/compare/recurring
https://mcp.zovo.one/compare/clauses
https://mcp.zovo.one/compare/pdf
https://mcp.zovo.one/compare/calendar
https://mcp.zovo.one/compare/kanban
https://mcp.zovo.one/compare/image
https://mcp.zovo.one/compare/bank-statement
https://mcp.zovo.one/compare/quotes
https://mcp.zovo.one/compare/barcode
https://mcp.zovo.one/compare/per-diem
https://mcp.zovo.one/setup
https://mcp.zovo.one/setup/claude-desktop
https://mcp.zovo.one/setup/claude-code
https://mcp.zovo.one/setup/cursor
https://mcp.zovo.one/setup/vscode
https://mcp.zovo.one/setup/windsurf
https://mcp.zovo.one/setup/cline
https://mcp.zovo.one/setup/claude-web
```

Composition: 1 root, 1 `/mcp/connect`, 1 `/bundle`, 1 `/changelog`, 1 `/guides` (index),
1 `/compare` (index) + 19 `/compare/<server>`, 1 `/privacy`, 1 `/setup` (index) +
7 `/setup/<client>`.

## 3. Submission result

One JSON POST, request shape matched to `scripts/indexnow.mjs` lines 41-45
(`{host, key, keyLocation, urlList}`), batch limit 100 so this fit in a single request.

Command:
```
curl -s -o /tmp/ix_resp.txt -w "HTTP_STATUS:%{http_code}\n" -X POST \
  https://api.indexnow.org/indexnow \
  -H "Content-Type: application/json; charset=utf-8" --data @/tmp/ix_body.json
```

Result:

| Field | Value |
|---|---|
| HTTP status | **200** |
| URLs in POST body | **34** |
| Response body | empty (IndexNow success convention) |

200 (not 202) means the key was already validated and the URL set was accepted for
immediate processing. No failures, no partial batch.

## 4. Key file verification

Command: `curl -s -w "\nSTATUS:%{http_code}\n" https://mcp.zovo.one/db6dbf5cfdbc08d1cc9b5365d398145b.txt`

| Check | Result |
|---|---|
| HTTP status | **200** |
| Body | `db6dbf5cfdbc08d1cc9b5365d398145b` |
| Body == key in data/indexnow.json | yes, exact match |
| Body is key only, no extra content | yes |

Key file is healthy; this is the precondition `scripts/indexnow.mjs` probes before every
run, and it passes.

## 5. robots.txt state

Command: `curl -s -o /tmp/robots.txt -w "%{http_code}" https://mcp.zovo.one/robots.txt`
-> HTTP 200

Contents:
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

| Question | Answer |
|---|---|
| Does robots.txt exist? | Yes, HTTP 200 |
| Does it reference the sitemap? | **Yes** — `Sitemap: https://mcp.zovo.one/sitemap.xml` |
| Anything to report? | No gap. Sitemap line present and correct. |

The monitisation/secret paths (`/buy/`, `/success`, `/recover`, `/verify`, `/bound`) are
correctly disallowed and none of them appear in the 34-URL submission set, so there is no
conflict between the robots directives and this submission.

## 6. Recommendation (one)

Re-run `node scripts/indexnow.mjs` (no flags, 24h after 2026-09-17T14:00Z) so the
`/s/` + `/guides/` set is refreshed and picks up the 4 newly-appeared URLs that pushed that
segment from 144 to 148 — the remainder set submitted here is now excluded from future runs
only by the 24h rule, not by any code, so a single unflagged run closes the loop across the
whole 182-URL sitemap.

## Summary

- Remainder URLs submitted: **34 of 34**, one POST, HTTP **200**.
- Key file: HTTP **200**, body exactly the key.
- robots.txt: HTTP **200**, sitemap line present, no action needed.
- Still outstanding: 4 `/s/` or `/guides/` URLs that appeared after the 144-URL batch and
  must wait out the 24h no-resubmit window.
