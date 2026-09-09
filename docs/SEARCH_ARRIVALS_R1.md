# Real people are arriving from search, at the wrong page (2026-09-09)

## What was found

Cloudflare referer data for mcp.zovo.one over 2026-09-07 to 09-09:

| Referer | Requests |
|---|---|
| (none) | 38,982 |
| mcp.zovo.one | 873 |
| www.google.com | 32 |
| bing.com | 7 |
| gateturbo.com | 3 |
| www.stork.ai | 1 |
| verifymcp.io | 1 |
| zovo.one | 1 |

This is the first time Google has ever appeared as a referer for this host. Search Console
still reports zero impressions, but Search Console lags by a day or two and, more to the
point, these are arrivals rather than impressions.

They are people, not crawlers. The user-agent breakdown on those requests is Chrome, Chrome
Mobile, Edge and Mobile Safari.

## Where they landed, and why it mattered

Almost all of them hit a hosted endpoint URL, `/mcp/<server>`, not a product page:
`/mcp/spreadsheet`, `/mcp/zip`, `/mcp/image`, `/mcp/barcode`, `/mcp/time-tracker`,
`/mcp/token`, `/mcp/calendar`, `/mcp/petty-cash`, `/mcp/work-order`, `/mcp/deposits`.

Those URLs answered with raw JSON. So every person who found this project through a search
engine over the last two days was shown a machine document.

There is a direct cause. Until 2026-09-08 those endpoints answered 401 to anything without a
token, which made them uninteresting to a crawler. The fix that stopped the 401, made for a
different reason (directories were marking the servers dead), also made them indexable. The
traffic is a side effect of that fix, and the JSON was the unhandled half of it.

Two of the referers are worth naming separately: `verifymcp.io`, `www.stork.ai` and
`gateturbo.com` are MCP ecosystem sites nobody here has ever submitted to. They found these
endpoints on their own.

## The fix

`GET /mcp/<server>` now negotiates on content type. A request whose `accept` header includes
`text/html`, which is every browser, gets a real page: what the server does, the two ways to
actually use it, its tool list, its free tier, and a link to the product page where a
purchase can happen. Anything else, which is every MCP client and every directory health
check, gets exactly the JSON document it got before.

Verified live:

    browser accept: text/html   -> 200 text/html, 4,298 bytes, 1,521 characters of prose
    no accept header            -> 200 application/json, unchanged
    POST tools/list, no token   -> 200, unchanged
    POST tools/call, no token   -> 401, unchanged

## Why these pages are not in the sitemap

Measured similarity between endpoint pages is 58 to 67 percent, and each carries about 1,400
characters. That is thinner and more repetitive than the `/s/<server>` product pages, which
are the intended landing surface. This estate has already been penalised once for offering a
crawler a large set of near-duplicates, so these are deliberately left out of the sitemap:
they stay indexable, because search engines are already sending people to them and taking
that away would lose real traffic, but they are not promoted, they carry a self-canonical,
and every one of them links to its richer product page.
