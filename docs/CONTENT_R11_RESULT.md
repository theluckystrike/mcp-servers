# Content round 11: barcode guide, 6+1 setup pages, 1 compare page - 2026-09-04

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

$ curl -s -X POST https://mcp.zovo.one/mcp/barcode -H 'content-type: application/json' -d '{}'   (first check, start of round)
{"error":"not_found","index":"https://mcp.zovo.one/mcp"}

$ curl -s -X POST https://mcp.zovo.one/mcp/barcode -H 'content-type: application/json' -d '{}'   (re-check, end of round)
{"error":"unauthorized","message":"This endpoint needs a token...","forms":[...],"options":[...]}
-> went live mid-round; WEB_ANGLE.barcode added and claude-web page included, not excluded

$ cd billing && PATH="$HOME/.npm-global/bin:$PATH" wrangler deploy
Current Version ID: ee801ef7-fc17-4926-ac51-f7bbfafd7983

$ curl x15 (8 new URLs incl. claude-web + /, /guides, /compare, /setup, /sitemap.xml, /llms.txt) -> 15 x HTTP 200
$ curl https://mcp.zovo.one/setup/claude-web/barcode -> HTTP 200 (route went live mid-round, included)

$ curl -s https://mcp.zovo.one/sitemap.xml | grep -o '<loc>' | wc -l
199 total; 9 contain "barcode" (guide, 6 setup pages, claude-web setup page, compare page)

$ curl -s https://mcp.zovo.one/llms.txt | grep -c "MCP Barcode in Claude.ai and Claude Desktop connectors"
1   (claude-web section carries the barcode entry, confirming the live build)

$ POST https://api.indexnow.org/IndexNow            -> HTTP 200, 9 URLs
$ GET  https://mcp.zovo.one/22fad93b71a88e2e60acae203c4288ae.txt -> HTTP 200 (keyLocation)
```

## What shipped

9 new URLs, all live at mcp.zovo.one:

- 1 guide in `billing/src/content.js`:
  `GUIDES["sepa-payment-qr-codes-on-invoices-from-chat"]`, covering the eleven EPC069-12 record
  fields in order (BCD, version 002 and why not 001, character set, SCT, optional BIC, name, IBAN,
  EUR amount, purpose, reference-or-remittance never both), the ISO 7064 mod-97 IBAN check computed
  digit by digit (stated with the reason: a long IBAN becomes too many digits for `Number()` to
  hold without rounding into a different, still-plausible value), why the code is EUR only (SEPA
  scheme only, both currency and IBAN country code refused outside it), `invoice_payment_qr`
  reading the IBAN and name from the same shared business profile the invoice server's
  `business_set` already wrote, the measured SVG-vs-PNG byte table from `servers/barcode/README.md`
  (128 px through 2048 px, the roughly-200-px crossover), and when to reach for Code 128 versus
  EAN-13/EAN-8/UPC-A. All facts read from `servers/barcode/README.md`, `servers/barcode/SPEC.md`
  and `servers/barcode/src/payloads.ts` (the actual EPC069-12 line order and the mod-97 comment),
  not invented. GUIDE_INDEX description extended.
- `barcode` added to `SETUP_SERVERS` in `billing/src/setup.js` with 6 hand-written `ANGLE`
  sentences (claude-desktop, claude-code, cursor, vscode, windsurf, cline) plus a `WEB_ANGLE`
  sentence, producing 7 setup pages total.
- The claude-web page for barcode: `curl -s -X POST https://mcp.zovo.one/mcp/barcode` returned
  `{"error":"not_found"}` at the start of this round, so barcode was first added to a
  `WEB_EXCLUDED` list (the same pattern used for office-suite, and previously for quotes and
  bank-statement) with `hosted: null`. Re-checking the same curl at the end of the round, as
  instructed, returned `{"error":"unauthorized","message":"This endpoint needs a token"...}`, a
  genuine auth JSON body, meaning `remote/src/index.ts` grew a `/mcp/barcode` route mid-round (a
  concurrent deploy outside this unit's write scope: `git log` shows a `D-R60` invoice commit
  landed between the two checks). Per instructions this flips the outcome: `barcode` was removed
  from `WEB_EXCLUDED`, `hosted` was set to `"barcode"`, and a `WEB_ANGLE.barcode` sentence was
  added (SVG stays inline since it is text, PNG becomes a one-hour download link,
  `invoice_payment_qr` reads the shared profile behind the same token the invoice connector
  already writes). Verified live: `/setup/claude-web/barcode` is HTTP 200, listed in the sitemap
  and present in the claude-web section of llms.txt.
- 1 comparison page in `billing/src/compare.js`: `COMPARE["barcode"]` vs
  `io.github.pipeworx-io/qrcode` (one pack of the Pipeworx gateway, wrapping the free public
  `api.qrserver.com`) and `io.github.Br0ski777/barcode-generator` (pay-per-call x402 USDC linear
  barcode generator on the klymax402 marketplace). `COMPARE_INDEX` description updated from
  "Seventeen" to "Eighteen".

`servers/barcode`, its README and `docs/BARCODE_RESULT.md` already existed (built and audited this
same date, before this round started), `/s/barcode` already existed in generated `PAGES`, and the
$19 barcode product and bundle text already existed in a prior commit
(`billing: barcode product ($19), eighteen-server bundle text`). This round only added the
guide, setup pages and compare page.

## Competitor research, verified before writing

Every competitor fact was read from the official MCP registry search
(`registry.modelcontextprotocol.io/v0/servers?search=<term>`) for the terms `qr`, `barcode` and
`qrcode`, cross-checked against each project's own public README on GitHub (both publish one,
unlike the two competitors in round 9), all on 2026-09-04. Nothing was installed; no paid API
calls; the only paid-feeling call in the comparison is the competitor's own x402 per-call price,
quoted from its README, never invoked.

- **qrcode** (`io.github.pipeworx-io/qrcode` on the registry, `streamable-http` remote at
  `gateway.pipeworx.io/qrcode/mcp`, no auth): README read directly at
  github.com/pipeworx-io/mcp-qrcode. Two tools of its own, `create_qr` and `read_qr`, wrapping the
  free public `api.qrserver.com`. The README states plainly that the same endpoint also lists
  roughly 30 shared Pipeworx gateway meta-tools (`ask_pipeworx`, `discover_tools`, `search_within`,
  `remember`/`recall` and more) alongside the pack's own two, since it is one pack of a larger
  1,476+-source gateway. MIT licence. No SEPA, WiFi, vCard or barcode symbology support.
- **Barcode Generator API** (`io.github.Br0ski777/barcode-generator` on the registry, `sse` remote
  at `barcode-generator.api.klymax402.com/mcp`): README read directly at
  github.com/Br0ski777/barcode-generator-x402. One tool, `utility_generate_barcode`, covering
  EAN-13, UPC-A, Code128 and Code39, base64 SVG output, $0.003 per call via x402 (USDC on Base L2,
  Coinbase CDP facilitator), no API key, no signup, no free tier. Part of the klymax402 marketplace
  of 100 x402 micropayment APIs. Its own docs state the boundary: "Not for: QR codes." MIT licence.
- Both were reached through registry search across `qr`, `barcode` and `qrcode` rather than a
  curated category. Other registry hits for these terms were excluded as poor comparisons: multiple
  `com.qretro/retro` (team retrospectives, "QR" is the product's name not its function),
  `com.qronoplay` (QR marketing games/contests), `com.jojapi/product-barcode-api` (a product lookup
  API keyed by barcode, not a code generator) and `io.github.chromium-style-qrcode/mcp` (a
  novelty Chromium-dinosaur-logo QR generator, no README beyond its one-line description, no
  business use case comparable to ours).

## Guide content

`sepa-payment-qr-codes-on-invoices-from-chat` covers install, the eleven EPC069-12 fields in their
exact line order (quoted from `servers/barcode/src/payloads.ts`'s own `lines = ["BCD", "002", "1",
"SCT", bic, name, iban, amountField, purpose, reference, remittance]` and its comment on why version
002 over 001), the ISO 7064 mod-97 IBAN check computed digit by digit rather than as one large
number (quoted from the same file's comment: a long IBAN becomes too many digits for `Number()` to
hold without rounding), why the code is EUR-only (SEPA scheme membership checked on both the
currency and the IBAN's country code), `invoice_payment_qr` reading the IBAN and name from the
shared business profile and the amount/currency/reference from the invoice store (quoted from
`servers/barcode/src/index.ts`'s actual tool logic, including the refusal on a non-EUR invoice and
the non-silent-correction behaviour when a given amount disagrees with the invoice total), the exact
SVG-vs-PNG byte table from `servers/barcode/README.md`'s "Measured: SVG is flat, PNG grows 14x"
section, and a Code 128 vs EAN-13/EAN-8/UPC-A decision rule grounded in the check-digit-refused
behaviour and the fixed-length-vs-full-ASCII distinction between the symbologies.

## Quality gate

    grep -c -iE 'seamless|powerful|effortless|unlock|supercharge|game-changer|
                 revolutionary|blazing|cutting-edge|leverage'  -> 0 (content.js, setup.js, compare.js)
    grep -cP em-dash (\xe2\x80\x94)                              -> 0 (all 3 sources)
    grep -cP non-ASCII on content.js, setup.js, compare.js      -> 0 (none introduced)
    node --check on all 3 edited sources                         -> pass
    npm test (billing)                                            -> 25 pass, 0 fail

## Deploy and verification

    cd billing && wrangler deploy   -> mcp-billing, version ee801ef7-fc17-4926-ac51-f7bbfafd7983
    curl x15 (9 new URLs incl. claude-web/barcode + /, /guides, /compare, /setup, /sitemap.xml,
              /llms.txt) -> 15 x HTTP 200
    sitemap.xml <loc>                                              -> 199 total, 9 containing
                                                                       "barcode"
    llms.txt                                                       -> carries the product, guide
                                                                       and compare lines and all 7
                                                                       new setup lines
                                                                       (claude-desktop through
                                                                       claude-web)
    POST https://api.indexnow.org/IndexNow                        -> HTTP 200, 9 URLs in one request
    GET  https://mcp.zovo.one/22fad93b71a88e2e60acae203c4288ae.txt -> HTTP 200 (keyLocation)

Zero paid API calls. Outbound requests were the MCP registry search endpoint, two competitor GitHub
README fetches (pipeworx-io/mcp-qrcode, Br0ski777/barcode-generator-x402), two probes of
mcp.zovo.one/mcp/barcode (start and end of round), IndexNow, and the Cloudflare deploy.

## RESULT.md

```
status: DONE
evidence:
  9 new URLs live, all HTTP 200: 1 guide, 7 setup pages (barcode across claude-desktop,
  claude-code, cursor, vscode, windsurf, cline, and claude-web), 1 compare page (barcode vs qrcode
  and Barcode Generator API). The claude-web page was initially planned as excluded: curl -X POST
  https://mcp.zovo.one/mcp/barcode returned {"error":"not_found"} when this round started. Per
  instructions the endpoint was re-checked at the end and had gone live
  ({"error":"unauthorized",...}, a genuine auth JSON body) from a concurrent deploy outside this
  unit's write scope, so the claude-web page and its WEB_ANGLE sentence were included instead of
  excluded, hosted was set from null to "barcode", and WEB_EXCLUDED was left holding only
  office-suite; verified live at HTTP 200 and present in both the sitemap and the claude-web
  section of llms.txt.
  competitor facts for the compare page read from the official MCP registry search across qr,
  barcode and qrcode, then each competitor's own public GitHub README (both publish one, unlike
  round 9's two closed-source competitors): qrcode's two tools plus roughly 30 shared Pipeworx
  gateway meta-tools on the same endpoint, and Barcode Generator API's single $0.003-per-call x402
  tool covering four linear symbologies with no QR support, are quoted from source rather than
  inferred.
  guide states the eleven EPC069-12 record fields in their exact line order and the ISO 7064 mod-97
  IBAN check exactly as implemented in servers/barcode/src/payloads.ts (including why version 002
  over 001, and why the check runs digit by digit rather than as one large number), why the code is
  EUR-only, invoice_payment_qr's read from the shared business profile and its non-silent-correction
  behaviour on a mismatched amount, the measured SVG-vs-PNG byte table from
  servers/barcode/README.md, and a Code 128 vs EAN-13/EAN-8/UPC-A decision rule, all read from the
  README, SPEC.md and src rather than invented.
  sitemap.xml and llms.txt confirmed to derive from GUIDES/COMPARE/SETUP_SERVERS/setupUrls() with no
  separate list to maintain; sitemap now 199 <loc> entries, 9 containing "barcode".
  quality gate: hype 0, em dash 0, non-ASCII 0 across all 3 edited sources; npm test 25 pass 0 fail.
  wrangler deploy ee801ef7-fc17-4926-ac51-f7bbfafd7983; 15 curls all HTTP 200.
  IndexNow POST 200 for 9 URLs, keyLocation 200
artifacts:
  billing/src/content.js (1 guide, GUIDE_INDEX description extended)
  billing/src/setup.js (barcode SETUP_SERVERS row with hosted: "barcode", 6 ANGLE sentences, 1
    WEB_ANGLE sentence, WEB_EXCLUDED reduced back to just office-suite)
  billing/src/compare.js (1 comparison page, COMPARE_INDEX description updated to Eighteen)
  docs/CONTENT_R11_RESULT.md
cost: 25 wall minutes.
failures: none.
follow-ups for the orchestrator (outside this unit's write scope):
  none specific to barcode: the /mcp/barcode route that round 9's equivalent guide flagged as
  missing for quotes shipped mid-round here, on its own, from a concurrent deploy.
```
