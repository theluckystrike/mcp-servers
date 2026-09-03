# Content round 4: guides, setup and compare pages for resume, recurring, clauses - 2026-09-03

status: DONE

## What shipped

24 URLs, all live at mcp.zovo.one:

- 3 long-form guides in `billing/src/content.js` (`GUIDES`)
- 18 setup pages, 6 clients x the 3 new servers, from 3 new `SETUP_SERVERS` rows plus 18 hand-written
  `ANGLE` sentences in `billing/src/setup.js`
- 3 comparison pages in `billing/src/compare.js` (`COMPARE`)

`billing/src/index.js` was not edited. Confirmed rather than assumed: `/sitemap.xml` and `/llms.txt`
build their lists from `PAGES`, `GUIDES`, `COMPARE` and `setupUrls()`, and `setupUrls()` is the cross
product of `CLIENT_ORDER` and `SERVER_ORDER`, so all 24 URLs appeared in both from the data objects
alone. The sitemap went from 92 to 116 `<loc>` entries; every one of the 24 was matched in it by exact
string, and all six new guide and compare URLs are in `/llms.txt`. `/s/resume`, `/s/recurring` and
`/s/clauses` were already live from the previous round and now link their six setup pages and their
comparison page through the same existing loops.

## URLs, status, word counts

Word counts are of rendered text with script and style stripped. Meta description length is of the
escaped string that reaches the `<head>`.

| URL | HTTP | Words | Meta |
|---|---|---|---|
| /guides/resume-and-cover-letter-from-chat | 200 | 1388 | 152 |
| /guides/recurring-invoices-on-a-schedule | 200 | 1411 | 151 |
| /guides/contract-clauses-library-assembly | 200 | 1253 | 149 |
| /compare/resume | 200 | 1156 | 153 |
| /compare/recurring | 200 | 1282 | 149 |
| /compare/clauses | 200 | 1428 | 149 |
| /setup/{6 clients}/resume | 200 x6 | 595-646 | 149-155 |
| /setup/{6 clients}/recurring | 200 x6 | 558-609 | 150-154 |
| /setup/{6 clients}/clauses | 200 x6 | 567-614 | 148-152 |

Every title was checked against the expected `<title>` on the live page and matched. The rendered word
counts run higher than the source counts (guides 959-1130 words of `html`) because the rendered page
also carries the FAQ block, the related links and the footer that `index.js` appends.

## Verified competitor facts

Every competitor row was read on 2026-09-03 from that package's npm registry record, the README inside
it, or the project's own published documentation. Nothing came from `data/intel_r4.json`, which holds
demand and supply scores rather than competitor records and names no competitor for any of these three
intents. No competitor was installed or executed, so tool counts are as documented.

| Source read | URL |
|---|---|
| cv-forge | https://registry.npmjs.org/cv-forge |
| @tgapk/mcp-resume | https://registry.npmjs.org/@tgapk/mcp-resume |
| invovate-mcp-server | https://registry.npmjs.org/invovate-mcp-server |
| @paddle/paddle-mcp | https://registry.npmjs.org/@paddle/paddle-mcp |
| @open-agreements/contract-templates-mcp | https://registry.npmjs.org/@open-agreements/contract-templates-mcp |
| OpenAgreements docs and catalog | https://github.com/open-agreements/open-agreements |
| dingdawg-legal-agent | https://registry.npmjs.org/dingdawg-legal-agent |
| download figures | https://api.npmjs.org/downloads/point/last-month/<pkg>, window 2026-07-31 to 2026-08-29 |

Confirmed and used: cv-forge is MIT, 1.0.3 published 2025-10-27, 14 documented tools including
`generate_email_template` and `draft_complete_application`, no API key, 806 downloads in the window.
@tgapk/mcp-resume is ISC, 1.1.6 published 2025-12-09, one tool, Chinese-language only, PDF output,
`repository` null in its npm record, and by default it uploads the rendered file to a hard-coded
third-party endpoint. invovate-mcp-server is MIT, 0.1.3 published 2026-06-07, 4 tools, UBL 2.1 output
and 11 invoice languages, and its README states plainly that the UBL export is not regulated
e-invoicing. @paddle/paddle-mcp is Apache-2.0, 0.1.6 published 2026-04-15, official from PaddleHQ,
requires a merchant account. @open-agreements/contract-templates-mcp is Apache-2.0, 0.9.0 published
2026-08-28, 3 tools, both stdio and a hosted endpoint, DOCX output, and separate content licences per
template. dingdawg-legal-agent is BUSL-1.1, 2.0.12 published 2026-07-15, 4 tools, API key required,
free tier 10 reviews a day, Pro $49 a month, $0.25 a call.

Corrected before publishing: invovate-mcp-server's npm description says no signup. Its own README
requires `INVOVATE_API_KEY` for `generate_invoice_pdf` and `generate_invoice_ubl`; only
`calculate_invoice_totals` and `get_invoice_capabilities` are keyless. The compare page says so rather
than repeating the description.

Not used: no total tool count for @paddle/paddle-mcp. Its README groups tools by resource and states no
number, and 27 were confirmed by name in the section read, with the subscription, transaction and report
groups in collapsed sections. The table says the README states no total instead of publishing a figure.
No Paddle fee rate is quoted, because no free public endpoint confirmed one. cv-forge lists `docx` as a
dependency but documents no DOCX tool, so the page says Word output could not be confirmed rather than
claiming it is absent.

Every page has a "when to pick theirs" section naming the capability we do not have: cv-forge writes the
covering email and can produce the whole application in one call; @tgapk/mcp-resume bundles CJK fonts;
invovate-mcp-server emits UBL 2.1 and eleven invoice languages including right-to-left scripts;
@paddle/paddle-mcp actually collects the money; OpenAgreements carries real upstream standard forms with
their licences, 650 CourtListener-linked case excerpts and jurisdiction guides; dingdawg-legal-agent
reviews a contract somebody sent you and scores its clauses. The OpenAgreements page states outright
that it is the stronger choice for an NDA or a SAFE.

Also recorded on the recurring page: no MCP server was found on npm or in the official MCP registry that
keeps recurring billing schedules locally and generates invoices into a store you own. The invoice
servers checked are one-shot generators with no scheduling, and the subscription servers are clients for
a vendor's platform. The page states the search and invites a correction to support@zovo.one rather than
claiming the category is empty forever.

## Numbers measured, not taken on trust

**Profiles are too thin, not too fat.** From `docs/RESUME_AUDIT.md`. Probe P8 stored 300 experience
bullets and asked for one page: 78 bullets kept, 222 dropped, 390 words against a 392-word budget, in
27 ms. That is the case a resume generator is designed for. Scenario s2, driven through the real Claude
CLI against a realistic profile, used **134 of a 361-word budget and dropped zero bullets**, while
`tailor_to_job` in the same session returned 75% coverage with a required keyword missing. The binding
constraint on a real application is evidence, not space, which is why the guide's advice is to add a true
fact to the profile rather than let anything add a false one to the resume.

**The fact-integrity rule holds at 0 of 10.** Ten cover letters were generated against ten postings
stuffed with figures and no posting number reached a letter. Every digit run is checked against the
profile and the passed arguments before the file is written; a number tracing to neither is an error, not
a warning; the job description is deliberately not an allowed source; comparison is on whole numbers so a
profile holding 2012 does not license a letter claiming 12.

**The recurring cap was measured into existence.** From `servers/recurring/src/index.ts:28-42`: before
`MAX_PERIODS_PER_RUN`, a schedule starting 1900-01-01 offered 1,520 due periods and one call with
`as_of: "2126-01-01"` created 1,193 real invoices and 1,193 PDFs, 6.0 MB in 6.8 s, burning 1,193 numbers
out of a series that never reuses one. The run is now bounded at 60, oldest first, with the idempotency
key unchanged.

**The clause prompt prints with spaces for a measured reason.** From
`servers/clauses/src/library.ts:52-57`: the shared docx engine parses inline markdown, so
`[late_fee_percent]` reaches Word as `[latefeepercent]`, the underscore pair being read as an italic
marker and dropped. The printed prompt uses spaces; `unfilled` keeps the real names.

Everything else comes from the three READMEs or the server source: tool counts by `grep -c registerTool`
plus the license pair (resume 8+2, recurring 11+2, clauses 10+2, matching the README tables at 10, 13 and
12), the month-end clamp rule and its 01-31 / 02-28 / 03-31 series, the two-lock ordering, the 25 starter
clauses across 11 categories counted from the README table, and the 450 and 540 word page budgets.

## Quality gate

Run over the 24 live pages concatenated (`/tmp/live_r4.html`, 235 KB) and over the three edited sources:

    grep -c -iE 'seamless|powerful|effortless|unlock|supercharge|game-changer|
                 revolutionary|blazing|cutting-edge|leverage' -> 0 (live and all 3 sources)
    grep -c '\xe2\x80\x94'  (em dash)                          -> 0 (live and all 3 sources)
    grep -cP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' (emoji)   -> 0 (live)
    grep -cP '[^\x00-\x7F]' on content.js, setup.js, compare.js -> 0
    grep -o 'rel="canonical"' | wc -l                           -> 24
    grep -o 'FAQPage' | wc -l                                   -> 24 (every page)
    longest escaped meta description on any of the 24           -> 155
    sitemap.xml <loc>                                           -> 116 (was 92), all 24 matched exactly
    llms.txt lines mentioning the three servers                 -> 15

Meta descriptions were fitted before the first deploy this time rather than after it, so no page shipped
truncated. Two written descriptions were 161 characters when escaped and were rewritten to 149 and 151
before deploying. The `fitDesc` helper added in round 3 trims at a word boundary until the escaped string
fits 155, and it did the rest: nine of the eighteen setup descriptions are trimmed, all at a word
boundary, because the template plus a long `caveatShort` exceeds the slice. That is the same behaviour
the existing 54 setup pages have.

Still truncated and out of scope: the three `/s/` descriptions come from `data/facts.json`, which this
run was not allowed to edit.

## Deploy and submission

    cd billing && npm test                 -> 18 pass, 0 fail (run twice)
    wrangler deploy                        -> 2579455e (guides + setup), 4901c591 (compare), 435 KiB
    curl x24                               -> 24 x HTTP 200, titles as expected
    POST https://api.indexnow.org/IndexNow -> HTTP 200, 28 URLs in one request
                                              (the 24 new ones plus /guides, /compare, /setup, /sitemap.xml)
    GET  /22fad93b71a88e2e60acae203c4288ae.txt -> HTTP 200

Zero paid API calls. The only outbound requests were seven npm registry records, the npm downloads API,
two raw.githubusercontent.com README fetches, the MCP and Smithery registry search endpoints, and the
Cloudflare deploy.

## RESULT.md

```
status: DONE
evidence:
  24 new URLs live, all HTTP 200 with expected titles: 3 guides, 3 compare, 18 setup
  guides 1253-1411 rendered words, compare 1156-1428, setup 558-646
  sitemap.xml 116 <loc> (was 92); all 24 matched by exact string; llms.txt carries all 6 guide+compare URLs
  index.js untouched: sitemap and llms.txt derive from GUIDES, COMPARE, PAGES and setupUrls()
  every competitor row re-read from the npm record, its README or the project's own docs on 2026-09-03
  invovate npm "no signup" corrected: INVOVATE_API_KEY is required for PDF and UBL rendering
  no total tool count published for paddle-mcp and no Paddle fee rate: neither could be verified
  no local recurring-invoice MCP server found on npm or the official registry; the page states the search
  measured: realistic profile used 134 of a 361-word budget, 0 bullets dropped, 75% posting coverage
  measured: 10 letters against 10 numeric postings leaked 0 posting numbers
  measured: before the 60-period cap, one mistyped as_of created 1,193 invoices and PDFs, 6.0 MB in 6.8 s
  quality gate over 235 KB live: hype 0, em dash 0, emoji 0, non-ASCII in the 3 sources 0
  24 canonicals, 24 FAQPage blocks, longest escaped meta description 155
  npm test 18 pass 0 fail; wrangler deploy 4901c591-6c57-472a-9c3f-f77297692947
  IndexNow POST 200 for 28 URLs in one request; keyLocation 200
artifacts:
  billing/src/content.js (3 guides, guide index description)
  billing/src/setup.js (3 SETUP_SERVERS rows, 18 ANGLE sentences, hub and index copy nine -> twelve)
  billing/src/compare.js (3 comparison pages, compare index description)
  docs/CONTENT_R4_RESULT.md
  data/distribution.json (guides and setup surface notes)
cost: 47 wall minutes
failures:
  data/intel_r4.json has no competitor records at all. It scores intents by demand over supply and its
  only competitor-shaped fields are Smithery top-use attributions, two of which it marks itself as
  weak or unrelated overlap. Every competitor on these three pages had to be found and verified from
  scratch, which is the whole cost overrun on this run.
  A first pass at data/distribution.json rewrote the file with a different JSON indent, showing 303
  changed lines for a two-line edit. Reverted and reapplied as a string replacement.
  Two of the six written meta descriptions were over the 155-char slice when escaped and had to be
  rewritten, though this time before the deploy rather than after it.
insight:
  The strongest page on this site is the one that tells you to use a competitor. /compare/clauses says
  outright that OpenAgreements is the better choice for an NDA or a SAFE, because it carries real
  upstream standard forms with their licences and 650 CourtListener-linked case excerpts, and that is
  true. Writing it that way forced the honest question about our own server, which turned out to have a
  good answer: a form filler cannot hold the late fee you actually charge. A comparison page that
  cannot recommend the other server is not a comparison, it is a claim, and the reader can tell the
  difference faster than we can write around it.
```
