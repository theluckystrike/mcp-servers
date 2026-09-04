# Content round 9: quotes guide, 6 setup pages, 1 compare page - 2026-09-04

status: DONE

evidence:

```
$ node --check billing/src/content.js && node --check billing/src/setup.js && node --check billing/src/compare.js
(no output from all three: syntax OK)

$ cd billing && npm test
# tests 25
# pass 25
# fail 0

$ grep -c -iE 'seamless|powerful|effortless|unlock|supercharge|game-changer|revolutionary|blazing|cutting-edge|leverage' \
    billing/src/content.js billing/src/setup.js billing/src/compare.js
0  0  0

$ grep -cP '\xe2\x80\x94' billing/src/content.js billing/src/setup.js billing/src/compare.js   # em dash
0  0  0

$ grep -cP '[^\x00-\x7F]' billing/src/content.js billing/src/setup.js billing/src/compare.js   # non-ASCII
0  0  0

$ curl -s -X POST https://mcp.zovo.one/mcp/quotes -H 'content-type: application/json' -d '{}'
{"error":"not_found","index":"https://mcp.zovo.one/mcp"}
(no /mcp/quotes route -> quotes excluded from claude-web, the bank-statement pattern)

$ cd billing && wrangler deploy
Current Version ID: 663b7535-9213-4bd0-bafa-a8b8de74dfcc

$ curl x14 (8 new URLs + /, /guides, /compare, /setup, /sitemap.xml, /llms.txt) -> 14 x HTTP 200
$ curl https://mcp.zovo.one/setup/claude-web/quotes -> HTTP 404 (deliberate, see below)

$ curl -s https://mcp.zovo.one/sitemap.xml | grep -o '<loc>[^<]*</loc>' | grep -c quotes
9   (/s/quotes was already live before this round; 8 new this round)

$ curl -s https://mcp.zovo.one/llms.txt | grep -n claude-web | grep -c quotes
0   (claude-web section has no quotes entry, confirming the exclusion took effect on the live build)

$ POST https://api.indexnow.org/IndexNow            -> HTTP 200, 8 URLs
$ GET  https://mcp.zovo.one/22fad93b71a88e2e60acae203c4288ae.txt -> HTTP 200 (keyLocation)
```

## What shipped

8 new URLs, all live at mcp.zovo.one:

- 1 guide in `billing/src/content.js`: `GUIDES["quotes-and-estimates-to-invoice-in-claude"]`,
  covering the quote lifecycle (open, sent as text, accepted or declined, or expired on its own),
  `quote_send_text` and the `quote_followup` chase prompt, validity computed in the shared business
  profile's own `timezone` rather than the host machine's clock, how `quote_accept` writes the
  invoice through the shared engine (and bypasses the invoice server's own 3-invoices-a-month cap,
  the quotes cap applying instead), and `quote_report`'s win rate, which excludes expired quotes on
  purpose because a slow client and a lost one are different problems. The centrepiece is the
  measured insight from `servers/quotes/README.md` and `docs/QUOTES_RESULT.md`, stated with the
  exact numbers: a quote issued at a 23% default VAT rate reads EUR 1,230.00; the profile's default
  rate is then changed to 8% before the client answers; recomputing at acceptance would invoice
  EUR 1,080.00, EUR 150.00 below the document the client agreed to; `quote_accept` copies the
  quote's own stored lines instead and the accepted invoice still carries EUR 1,230.00 and
  `tax_lines[0].rate === 23`. GUIDE_INDEX description extended.
- `quotes` added to `SETUP_SERVERS` in `billing/src/setup.js` with 6 hand-written `ANGLE` sentences
  (claude-desktop, claude-code, cursor, vscode, windsurf, cline), producing 6 setup pages.
- No claude-web page and no `WEB_ANGLE` entry for quotes: `curl -s -X POST
  https://mcp.zovo.one/mcp/quotes -H 'content-type: application/json' -d '{}'` returned
  `{"error":"not_found","index":"https://mcp.zovo.one/mcp"}`, not a JSON-RPC or auth body, meaning
  `remote/src/index.ts` (out of this round's write scope) has no `/mcp/quotes` route and there is
  nothing for a claude.ai connector to point at. `serversFor()` now excludes `quotes` from
  claude-web the same way it already excludes `office-suite` (and the same way bank-statement was
  excluded in round 8, before its own hosted route shipped), and `setupPage()` returns null for
  that pair; verified live, the URL 404s and neither the sitemap nor the claude-web section of
  llms.txt lists it.
- 1 comparison page in `billing/src/compare.js`: `COMPARE["quotes"]` vs SendQuoteNow
  (`com.sendquotenow/quote-engine`) and estimate-invoice (`net.sodatsu-mitsumori/estimate-invoice`).
  `COMPARE_INDEX` description updated from "Sixteen" to "Seventeen".

`servers/quotes`, its README and `docs/QUOTES_RESULT.md` already existed, `/s/quotes` already
existed in generated `PAGES`, and `quotes` already had a `per_server` row in
`data/distribution.json` before this round started. `data/distribution.json` was read but not
edited this round: its `per_server.quotes` fields (`github`, `registry`, `docker-mcp-catalog`,
`cline-marketplace`) all describe package-distribution status the orchestrator owns, not the billing
content shipped here, and no other server's row carries a field for that; adding one would invent a
schema rather than record a fact, so it was left as found.

## Competitor research, verified before writing

Every competitor fact was read from the official MCP registry search
(`registry.modelcontextprotocol.io/v0/servers?search=<term>`) for the terms `quote`, `quotation`,
`estimate`, `proposal` and `invoicing`, cross-checked against each project's own website (neither
publishes a GitHub repo or README; both are closed-source SaaS reached only through the registry's
hosted `remotes[]` entry), all on 2026-09-04. Nothing was installed; no paid API calls.

- **SendQuoteNow** (`com.sendquotenow/quote-engine` on the registry, one `streamable-http` remote at
  `sendquotenow.com/mcp` behind a required `X-API-Key` header): website read directly at
  sendquotenow.com. Free tier $0/month, 5 documents a month shared across quotes, invoices and
  purchase orders, no card required; Premium $4.99/month for unlimited documents, a custom logo and
  email delivery; a separate pay-per-call route priced in x402 USDC on Base, $0.10 per quote
  generation and $0.01-$0.02 for preview/email/share/fetch. Multi-currency across USD, CAD, EUR, GBP
  and AUD. No public repository; proprietary.
- **estimate-invoice** (`net.sodatsu-mitsumori/estimate-invoice` on the registry, one
  `streamable-http` remote at `app.sodatsu-mitsumori.net/api/mcp`, marketed in Japan under a name
  that translates as "a quote that grows"): its feature page at
  sodatsu-mitsumori.net/features/external-ai-mcp/ read directly. Remote MCP over OAuth 2.0, enabled
  from inside the product's own settings rather than added as a config block. Covers estimates,
  invoices, delivery notes and purchase orders together, with PDF generation, shareable URLs, an
  item master and optional sync to freee accounting software. The MCP connection is gated to a paid
  plan and above; the free plan cannot use it at all, and the feature page states no separate price
  for the MCP feature itself. No public repository; proprietary.
- Both were reached through registry search rather than a curated "billing" category; QuoteFirst
  (`ai.quotefirst/quotefirst`, dollar quotes for LLM inference cost, not a client-facing quote) and
  several regional insurance "quote-exchange" servers also matched `quote` but quote unrelated
  products and were excluded as poor comparisons rather than padding the count.

## Guide content

`quotes-and-estimates-to-invoice-in-claude` covers install, the four closing states of a quote
(accepted, declined, expired on its own, or still open), `quote_send_text` and `quote_followup`,
the timezone-aware validity computation (`servers/quotes/README.md`'s own stated reason: a quote
issued at 00:30 in Warsaw from a machine still on US time would otherwise date to the wrong day and
lapse early), how `quote_accept` either writes directly into the invoice store or hands back
`invoice_create`-ready arguments depending on whether that store already exists, the bypass of the
invoice server's own monthly cap, and the win-rate definition from `quote_report`. The tax-rate
insight is quoted with its exact figures from `docs/QUOTES_RESULT.md`'s "Measured insight" section
and cross-checked against the same numbers in the README's own worked section, not restated from
memory.

## Quality gate

    grep -c -iE 'seamless|powerful|effortless|unlock|supercharge|game-changer|
                 revolutionary|blazing|cutting-edge|leverage'  -> 0 (content.js, setup.js, compare.js)
    grep -cP em-dash (\xe2\x80\x94)                              -> 0 (all 3 sources)
    grep -cP non-ASCII on content.js, setup.js, compare.js      -> 0 (fixed 3 hits in compare.js:
                                                                      a Japanese product name, a
                                                                      curly-quote pair, and one more
                                                                      Japanese label, all reworded to
                                                                      plain ASCII; also fixed 1 hype
                                                                      hit, "unlocks" matching the
                                                                      unlock stem, reworded to "opens")
    node --check on all 3 edited sources                         -> pass
    npm test (billing)                                            -> 25 pass, 0 fail

## Deploy and verification

    cd billing && wrangler deploy   -> mcp-billing, version 663b7535-9213-4bd0-bafa-a8b8de74dfcc
    curl x14 (8 new URLs + /, /guides, /compare, /setup, /sitemap.xml, /llms.txt) -> 14 x HTTP 200
    curl /setup/claude-web/quotes                                  -> HTTP 404, deliberate (no
                                                                       /mcp/quotes route in
                                                                       remote/src/index.ts, which is
                                                                       outside this round's write
                                                                       scope, confirmed live with
                                                                       curl -X POST
                                                                       https://mcp.zovo.one/mcp/quotes
                                                                       returning {"error":"not_found"};
                                                                       serversFor() and setupPage()
                                                                       both exclude it, the same
                                                                       pattern used for office-suite
                                                                       and for bank-statement in
                                                                       round 8)
    sitemap.xml <loc>                                              -> 188 total, 9 containing
                                                                       "quotes" (/s/quotes was
                                                                       already live; 8 new this
                                                                       round; confirmed no
                                                                       claude-web/quotes entry)
    llms.txt                                                       -> carries the product, guide and
                                                                       compare lines and all 6 new
                                                                       setup lines (claude-desktop
                                                                       through cline); the claude-web
                                                                       section has no quotes entry,
                                                                       verified by grep
    POST https://api.indexnow.org/IndexNow                        -> HTTP 200, 8 URLs in one request
    GET  https://mcp.zovo.one/22fad93b71a88e2e60acae203c4288ae.txt -> HTTP 200 (keyLocation)

Zero paid API calls. Outbound requests were the MCP registry search endpoint, two competitor website
fetches (sendquotenow.com, sodatsu-mitsumori.net), one probe of mcp.zovo.one/mcp/quotes, IndexNow,
and the Cloudflare deploy.

## RESULT.md

```
status: DONE
evidence:
  8 new URLs live, all HTTP 200: 1 guide, 6 setup pages (quotes across claude-desktop, claude-code,
  cursor, vscode, windsurf, cline), 1 compare page (quotes vs SendQuoteNow and estimate-invoice). No
  claude-web setup page for quotes: curl -X POST https://mcp.zovo.one/mcp/quotes returned
  {"error":"not_found"}, not a JSON-RPC or auth body, so there is no route for a claude.ai connector
  to point at; serversFor() and setupPage() in billing/src/setup.js now exclude quotes the same way
  office-suite (and bank-statement in round 8) were already excluded; verified live at HTTP 404 and
  absent from both the sitemap and the claude-web section of llms.txt.
  competitor facts for the compare page read from the official MCP registry search across quote,
  quotation, estimate, proposal and invoicing, then each competitor's own website (neither publishes
  a repo or README); SendQuoteNow's document-capped free tier, $4.99/month premium and x402
  pay-per-call pricing, and estimate-invoice's OAuth-gated, paid-plan-only MCP feature with no
  published price of its own, are quoted from source rather than inferred.
  guide states the tax-rate insight exactly as documented in servers/quotes/README.md and
  docs/QUOTES_RESULT.md: a quote issued at a 23% default rate reads EUR 1,230.00; the profile's
  default rate is then changed to 8% before the client answers; recomputing at acceptance would read
  EUR 1,080.00, EUR 150.00 under the agreed total; quote_accept copies the quote's stored lines
  instead, so the accepted invoice still carries EUR 1,230.00 and tax_lines[0].rate === 23; also
  states the lifecycle, timezone-aware validity, the invoice-cap bypass and the win-rate exclusion
  of expired quotes, all read from the README and QUOTES_RESULT.md rather than invented.
  sitemap.xml and llms.txt confirmed to derive from GUIDES/COMPARE/PAGES/setupUrls() with no separate
  list to maintain; sitemap now 188 <loc> entries, 9 containing "quotes" (/s/quotes was already live,
  8 new this round), quotes correctly absent from the claude-web section.
  quality gate found and fixed 3 non-ASCII characters and 1 hype-word hit in compare.js (a Japanese
  product name and label, a curly-quote pair, and "unlocks" matching the unlock stem); all four
  reworded to plain ASCII; final gate: hype 0, em dash 0, non-ASCII 0 across all 3 edited sources;
  npm test 25 pass 0 fail.
  wrangler deploy 663b7535-9213-4bd0-bafa-a8b8de74dfcc; 14 curls all HTTP 200 (plus 1 deliberate 404)
  IndexNow POST 200 for 8 URLs, keyLocation 200
artifacts:
  billing/src/content.js (1 guide, GUIDE_INDEX description extended)
  billing/src/setup.js (quotes SETUP_SERVERS row, 6 ANGLE sentences, serversFor() and setupPage()
    extended to exclude quotes from claude-web)
  billing/src/compare.js (1 comparison page, COMPARE_INDEX description updated to Seventeen)
  docs/CONTENT_R9_RESULT.md
cost: 25 wall minutes.
failures: none.
follow-ups for the orchestrator (outside this unit's write scope):
  remote/src/index.ts has no /mcp/quotes route; adding one would let a future round write this
  round's claude-web page and WEB_ANGLE sentence honestly instead of excluding it.
  data/distribution.json's per_server.quotes row has no field describing billing-content status
  (no other server's row does either); this round did not invent one rather than guess at a schema
  the orchestrator did not define.
```
