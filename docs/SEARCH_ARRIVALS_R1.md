# Traffic arriving at the hosted endpoints, and what it is not (2026-09-09)

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

This is the first time Google has ever appeared as a referer for this host, and the
user-agent breakdown on those requests is Chrome, Chrome Mobile, Edge and Mobile Safari.

**That is not organic search traffic, and the first version of this document said it was.**
The claim was checked against Search Console's URL Inspection API and it does not hold:

    https://mcp.zovo.one/mcp/spreadsheet    URL is unknown to Google, lastCrawl never
    https://mcp.zovo.one/mcp/time-tracker   URL is unknown to Google, lastCrawl never

Google has never crawled these URLs, so it cannot have shown them in a result. A second
tell points the same way: several of the requests are for paths like
`/mcp/spreadsheet&quot`, with an HTML entity fused into the path. No browser constructs a
URL that way. Something is parsing HTML badly and following what it thinks are links, with a
browser user-agent and a google.com referer attached.

So the honest reading is that this is automated traffic of unknown origin, and browser-shaped
user-agents are not evidence of a person. What remains true and useful is the next section:
whatever these clients are, and whenever a real person does arrive, the page they were being
handed was wrong.

## Where they landed, and why it mattered

Almost all of them hit a hosted endpoint URL, `/mcp/<server>`, not a product page:
`/mcp/spreadsheet`, `/mcp/zip`, `/mcp/image`, `/mcp/barcode`, `/mcp/time-tracker`,
`/mcp/token`, `/mcp/calendar`, `/mcp/petty-cash`, `/mcp/work-order`, `/mcp/deposits`.

Those URLs answered with raw JSON. So every person who found this project through a search
engine over the last two days was shown a machine document.

There is a plausible cause for the timing. Until 2026-09-08 those endpoints answered 401 to
anything without a token. The fix that stopped the 401, made for a different reason
(directories were marking the servers dead), also made them fetchable by anything that
wanders in. This traffic appeared immediately afterwards.

Three of the referers are worth naming separately: `verifymcp.io`, `www.stork.ai` and
`gateturbo.com` are MCP ecosystem sites nobody here has ever submitted to. VerifyMCP
describes itself as a trust-score directory for MCP servers and it probed `/mcp/calendar`.
None of the three lists this project by name yet, so the most likely route is that they read
the official registry and verify what they find there. That is the registry working as a
distribution primitive without anyone doing anything, which is the one genuinely encouraging
signal here.

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
