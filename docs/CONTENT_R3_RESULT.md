# Content round 3: guides, setup and compare pages for currency, docx, timezone - 2026-09-03

status: DONE

## What shipped

27 URLs, all live at mcp.zovo.one:

- 3 long-form guides in `billing/src/content.js` (`GUIDES`)
- 18 setup pages, 6 clients x the 3 new servers, from 3 new `SETUP_SERVERS` rows plus 18 hand-written
  `ANGLE` sentences in `billing/src/setup.js`
- 3 comparison pages in `billing/src/compare.js` (`COMPARE`)
- 3 product pages, `/s/currency`, `/s/docx`, `/s/timezone`, which were already in the generated
  `billing/src/pages.js` but had never been deployed, so they were returning 404 in production

No route code was added. `/sitemap.xml` and `/llms.txt` derive from `GUIDES`, `COMPARE`, `PAGES` and
`setupUrls()`, so all 27 URLs appeared in both from the data objects alone; `billing/src/index.js` was
not edited. The sitemap went from 56 to 89 `<loc>` entries. Every `/s/<id>` page links its six client
setup pages and its comparison page through the same existing loops.

## URLs, status, word counts

Word counts are of rendered text with script and style stripped. Meta description length is of the
escaped string that reaches the `<head>`.

| URL | HTTP | Words | Meta |
|---|---|---|---|
| /guides/currency-conversion-ecb-rates-in-claude | 200 | 1161 | 137 |
| /guides/word-documents-proposals-from-chat | 200 | 1204 | 141 |
| /guides/meeting-slots-across-time-zones | 200 | 1221 | 139 |
| /compare/currency | 200 | 1022 | 139 |
| /compare/docx | 200 | 1038 | 139 |
| /compare/timezone | 200 | 1047 | 153 |
| /s/currency | 200 | 1147 | 155 |
| /s/docx | 200 | 1964 | 155 |
| /s/timezone | 200 | 2093 | 155 |
| /setup/{6 clients}/currency | 200 x6 | 529-581 | 151-155 |
| /setup/{6 clients}/docx | 200 x6 | 533-590 | 137-155 |
| /setup/{6 clients}/timezone | 200 x6 | 560-617 | 149-155 |

Titles were checked on every URL and matched the expected `<title>`. The three guides are longer than
the 600-1100 band of round 1 because each carries one long measured section; the comparison pages sit in
the same 1000-1050 band as the five existing ones.

## Verified competitor facts

Every competitor row was read on 2026-09-03 from that project's own registry entry or npm record, not
from `data/intel_r3.json`, and one intel claim did not survive the check.

| Source read | URL |
|---|---|
| stockvibes07/exchange-mcp | https://registry.smithery.ai/servers/stockvibes07/exchange-mcp |
| ofurkanuygur/tcmb_mcp | https://registry.smithery.ai/servers/ofurkanuygur/tcmb_mcp |
| stockvibes07/meeting-mcp | https://registry.smithery.ai/servers/stockvibes07/meeting-mcp |
| @docx-mcp/docx-mcp | https://registry.npmjs.org/@docx-mcp/docx-mcp (README + version record) |
| @usejunior/docx-mcp | https://registry.npmjs.org/@usejunior/docx-mcp |
| @iflow-mcp/timezone-toolkit | https://registry.npmjs.org/@iflow-mcp/timezone-toolkit |

Confirmed and used: exchange-mcp has 4 tools (get_rate, convert, historical, currencies) over ECB data;
tcmb_mcp has 6 tools over the Turkish central bank series back to 1996; meeting-mcp has 6 tools
including get_holidays for 100+ countries and Google Calendar event creation; @docx-mcp/docx-mcp is MIT,
0.5.0 published 2025-08-26, with image embedding and syntax-highlighted code blocks;
@usejunior/docx-mcp is Apache-2.0, 0.19.1 published 2026-07-24, with tracked changes, comments,
footnotes, document comparison and .odt; @iflow-mcp/timezone-toolkit is ISC, 1.0.1 published
2025-08-08, 9 tools including sunrise, sunset, twilight and moon phase, with no slot finder and no ics.

Corrected before publishing: `data/intel_r3.json` records exchange-mcp as "keyless" and describes both
stockvibes07 servers only as hosted. Their live registry entries state x402 pricing: 0.001 USDC per call
on Base for exchange-mcp and $0.01 per call for meeting-mcp. "No signup" is true; "free" is not. The
compare pages carry the per-call price in the table and in the FAQ rather than the intel wording.

Not used: the Smithery useCounts in `data/intel_r3.json`. The per-server detail endpoint returns no
useCount, so the numbers could not be re-verified today and no page cites a popularity figure.

Every page has a "When to pick theirs" section that names the capability we do not have: Amazon-style
depth is not relevant here, but tcmb_mcp reaches back to 1996 and compares several pairs in one table,
@docx-mcp/docx-mcp embeds images and highlights code, @usejunior/docx-mcp is the only one of the three
that can accept a counterparty's redlines, and meeting-mcp has the holiday dataset and writes the
calendar event. All four gaps are stated as reasons to choose the other server.

## Numbers measured, not taken on trust

Two claims were measured rather than repeated.

**ECB: 29.9% of dates have no rate.** Counted directly from `eurofxref-hist.csv`, downloaded from
www.ecb.europa.eu. The series runs 1999-01-04 to 2026-09-02: 10,104 calendar days, 7,084 published
dates, so 29.9% carry no rate. Single years: 2025 published 255 of 365 and 2024 published 256 of 366,
both 30.1% missing. This is the fact the nearest-previous-business-day rule exists for, and it is the
lead section of the currency guide and a row on the compare page.

**Warsaw and New York share 2 hours in September and 3 in March.** Computed with `Intl` longOffset
formatting for both zones on both dates, against 09:00-17:00 working days. On 2026-09-10 Warsaw is UTC+2
and New York UTC-4, giving 13:00-15:00 UTC, 2 hours. On 2026-03-16 Warsaw is still UTC+1 while New York
is already UTC-4, giving 13:00-16:00 UTC, 3 hours. The cause is the gap between the US change on
8 March and the European change on 29 March. A recurring call booked at the edge of the March window
falls outside somebody's working day at the end of the month.

Everything else comes from the three READMEs or the server source: tool counts by `grep -c registerTool`
plus the license pair (currency 10, docx 10, timezone 11), the joined-paragraph-text template
substitution and the `word/numbering.xml` resolution in docx, the worst-participant fairness rule and
the deliberate absence of a `VTIMEZONE` block in timezone, the 6-decimal cross-rate rounding and ISO 4217
minor units in currency.

## Quality gate

Run over the 27 live pages concatenated (`live_r3.html`, 287 KB) and over the three edited sources:

    grep -c -iE 'seamless|powerful|effortless|unlock|supercharge|game-changer|
                 revolutionary|blazing|cutting-edge|leverage' -> 0 (live and all 3 sources)
    grep -c '\xe2\x80\x94'  (em dash)                          -> 0 (live and all 3 sources)
    grep -cP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' (emoji)   -> 0
    grep -nP '[^\x00-\x7F]' on content.js, setup.js, compare.js -> no match
    grep -o 'rel="canonical"' live_r3.html | wc -l              -> 27
    grep -o 'FAQPage' live_r3.html | wc -l                      -> 24 (all but the 3 /s/ pages)
    sitemap.xml <loc>                                           -> 89
    llms.txt lines mentioning the three servers                 -> 14

One defect was found by the gate and fixed. Five of the six new guide and compare meta descriptions were
161-166 characters and the injector slices at 155, so they shipped truncated mid-word on the first
deploy. They were rewritten to 137-153 and redeployed. The same slice also truncated 9 setup pages,
because `setupPage` capped the raw string at 154 but HTML-escaping `"` to `&quot;` pushed the escaped
string past 155. A `fitDesc` helper now trims at a word boundary until the escaped length fits, which
fixed the 9 new pages and the pre-existing Cursor, VS Code and Cline pages at the same time.

Still truncated and out of scope: the three `/s/` descriptions come from `data/facts.json`, which this
run was not allowed to edit. Their `does` strings are 300+ characters and are cut at 155.

## Deploy and submission

    cd billing && npm test                 -> 18 pass, 0 fail (run 3 times)
    wrangler deploy                        -> 231a61d4 (first), ef799c90 (meta fix),
                                              244209c8 (setup meta fix), 349.73 KiB
    curl x27                               -> 27 x HTTP 200, titles as expected
    POST https://api.indexnow.org/IndexNow -> HTTP 200, all 27 URLs in one request
    GET  /22fad93b71a88e2e60acae203c4288ae.txt -> HTTP 200

Zero paid API calls. The only outbound requests were the ECB history file, three Smithery registry
entries, six npm registry records and the Cloudflare deploy.

## RESULT.md

```
status: DONE
evidence:
  27 new URLs live, all HTTP 200 with expected titles: 3 guides, 3 compare, 18 setup, 3 /s/ pages
  guides 1161-1221 words, compare 1022-1047, setup 529-617, /s/ 1147-2093
  sitemap.xml 89 <loc> (was 56); llms.txt covers all 27; every /s/<id> links its 6 setup + 1 compare page
  every competitor row re-read from the Smithery registry entry or the npm record on 2026-09-03
  intel_r3 "keyless" corrected: exchange-mcp is x402 0.001 USDC/call, meeting-mcp $0.01/call
  ECB gap measured from eurofxref-hist.csv: 7,084 of 10,104 dates published, 29.9% have no rate
  Warsaw/New York overlap measured via Intl: 2h on 2026-09-10, 3h on 2026-03-16
  quality gate over 287 KB live: hype 0, em dash 0, emoji 0, non-ASCII in the 3 sources 0
  27 canonicals, 24 FAQPage blocks
  npm test 18 pass 0 fail; wrangler deploy 244209c8-bc3c-4f91-9083-16b018f64b97
  IndexNow POST 200 for all 27 URLs in one request; keyLocation 200
artifacts:
  billing/src/content.js (3 guides, index description)
  billing/src/setup.js (3 SETUP_SERVERS rows, 18 ANGLE sentences, fitDesc, hosted-null branch)
  billing/src/compare.js (3 comparison pages, index description)
  docs/CONTENT_R3_RESULT.md
  data/distribution.json (guides surface note)
cost: 38 wall minutes
failures:
  /s/currency, /s/docx and /s/timezone were 404 in production before this run. The pages had been
  generated into billing/src/pages.js by an earlier commit but no deploy had followed, so three
  product pages the sitemap did not yet list had been dead since the servers were wired.
  Five of six new meta descriptions shipped truncated on the first deploy and needed a second one.
  The 155-char slice runs on the escaped string, which nobody had accounted for; 9 setup pages
  were being cut mid-entity before this run and are fixed now.
  intel_r3.json calls exchange-mcp keyless. It is keyless and paid, at 0.001 USDC per call.
insight:
  Three of the three new servers had no hosted endpoint, and the setup builder had exactly one
  branch for that case: text about the office suite's five child processes. Any server with
  hosted:null would have published a paragraph about a different product. A default that is
  correct for one row is a bug the moment a second row takes it, and nothing in the page output
  looks wrong enough to catch by eye. Adding a row to a table generator is not a data change.
```
