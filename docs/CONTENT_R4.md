# CONTENT_R4, writing for the crawler that actually reads this site, 2026-09-10

status: DONE, not deployed. The orchestrator deploys and verifies.

Everything below was verified by rendering `billing/src/index.js` through its real `fetch`
handler, not by grepping the source, and where a claim is about the deployed site it says so.
Nothing here has been pushed.

## What this round changed

| File | Change |
|---|---|
| `scripts/build-figures.mjs` | New. Reads the manifests and writes `billing/src/figures.js`. `--check` fails when it is stale. |
| `billing/src/figures.js` | New, generated. Every count, limit, price and free-tier sentence a page may quote. |
| `billing/src/content.js` | Nine new `GUIDES` entries; `mcp-server-free-vs-pro` corrected; `GUIDE_INDEX` count derived; `HOSTED_IDS` now read from `figures.js` instead of a hand-kept list. |
| `billing/src/index.js` | Home page rewritten to answer; `/bundle` title numeral; `llms.txt` product lines; `/s/` pages state when there is no hosted URL. |
| `billing/src/setup.js` | `/setup` index counts derived. |
| `scripts/build-pages.mjs` | Bundle CTA count and price derived. `billing/src/pages.js` regenerated. |
| `servers/{invoice,price-tracker,spreadsheet,time-tracker}/README.md` | One stale phrase each. |
| `billing/test/figures.test.mjs` | New. 18 gates. |
| `billing/test/{bundle,checkout-r1}.test.mjs` | Assertions updated to the derived counts. |
| `docs/CONTENT_R4.md`, `data/content_r4.json` | This round. |

Guides went from 89 to 98. Sitemap from 154 to 164. Billing suite from 114 tests to
134, with 133 passing.

## Task 1, the llms.txt audit

The two defects a prior round found are fixed and stayed fixed. Counted on the live file
(`curl -s https://mcp.zovo.one/llms.txt`) on 2026-09-10:

    product lines 32, unique /s/ URLs 32, duplicate titles 0, `ls servers/*/README.md | wc -l` 32

office-suite appears once. No line is emitted twice.

Judged as a retrieval artifact it had three further defects, and the first is serious.

1. It sent every assistant crawler to a URL that does not exist. The hosted sentence was
   appended to every product line unconditionally, including `delivery-schedule`, which has
   no endpoint. Measured the same day:

        $ curl -s -o /dev/null -w '%{http_code}\n' -X POST https://mcp.zovo.one/mcp/delivery-schedule \
            -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
            -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{...}}'
        404

   The body is `{"error":"not_found","index":"https://mcp.zovo.one/mcp"}`. The hosted sentence
   is now emitted only for names in the `SERVERS` map read out of `remote/src/index.ts`, and
   the servers without one say so on their own line.
2. A line carried no price and no free-tier limit. Those are exactly what somebody asking
   an assistant "which one do I want" needs, and getting them cost a second fetch. Both are on
   every line now, derived from `PRODUCTS` and `data/facts.json`. The free-tier sentence is
   trimmed to whole sentences up to about 200 characters, which keeps the numbers and drops
   the policy argument.
3. The bundle line spelled its count out, `Thirty-one-server bundle`. Numeral now.

A fourth defect, the bare `/mcp/<server>` URL, was fixed by another agent mid-round and is not
claimed here. The header block now states the token mechanics, the rate limits, the retention
window and the price before the first product line, so an assistant has them in context
whichever line it reads. File grew from 65,045 to 75,533 bytes.

## Task 2, the answer gap

Twenty buyer-intent questions. Eighteen are the frozen set from
`docs/BLIND_RECOMMENDATION_R1.md`, so the market column is measured rather than guessed; two
are mine, found by searching the whole corpus (98 guides, 19 compare pages, 32 product pages)
for the phrasing a buyer would use and getting nothing. `n` is the number of distinct MCP
servers a blind assistant could name for that question on 2026-09-10.

| # | The question a person asks an assistant | n | Answered on this site before? | Verdict |
|---|---|---|---|---|
| 6 | How do I let Claude fill in a quote or estimate template for a customer? | **1** | No. `/guides/quotes-and-estimates-to-invoice-in-claude` answers "send a quote", never "fill my template", and nowhere says we cannot read one. | **GAP, written** |
| 13 | Is there an MCP server for a petty cash book or a cash ledger? | **1** | No. Two pages exist about doing the task; neither answers whether a server exists. | **GAP, written** |
| 8 | MCP server to convert currencies with real exchange rates? | 2 | Partly. The guide exists; it never mentions that a free npm package does the same job better. | **HONESTY GAP, written** |
| 12 | What MCP server can zip and unzip archives for Claude? | 2 | Partly. The guide exists; it never mentions that the competitor ships passwords and we do not. | **HONESTY GAP, written** |
| 14 | Is there an MCP server that produces a delivery schedule or work order document? | 2 | Half. `work-orders-and-job-cards-from-chat` covers one half. `delivery-schedule` had no guide at all; `release-check` reported `guide: no guide mentions this server`. | **GAP, written** |
| 16 | Which MCP servers can I use without installing anything, just by pasting a URL? | 2 | No. `connect-mcp-servers-without-installing` answers "how do I connect these", which is a different question from "which servers work this way". | **WEDGE, written** |
| 18 | Where do I find MCP servers that cost money, and how do I pay for one? | 4 | No. `licensing-a-paid-mcp-server` is written for a builder charging money, not a buyer spending it. | **WEDGE, written** |
| 19 | Will it email the invoice to my client? | not in the blind set | No. Zero matches for `email the invoice`, `sends an email` or `emailing the invoice` across the whole corpus. | **GAP, written** |
| 20 | Can it read a photo of a receipt and log the expense? | not in the blind set | No. One partial match, in a guide about merging receipts into a PDF. Zero for `scanned receipt` or `receipt photo`. | **GAP, written** |
| 4 | Can an assistant read a bank statement PDF and categorise the transactions? | 4 | Half. The CSV half is covered. The PDF half is answered nowhere, and no page says the server takes CSV and not PDF. | **GAP, open** |
| 17 | Best MCP servers for small business accounting and paperwork? | 5 | Partly. Zero matches for `quickbooks`, `xero`, `freshbooks` or `wave accounting` anywhere, so the honest "we do not connect to your accounting software" is unstated. | **GAP, open** |
| 3 | Track my business expenses and mileage? | 3 | Two pages, one each. No single page answers both halves. | Partial |
| 11 | Is there an MCP server that generates barcodes or QR codes? | 4 | Only the SEPA-payment angle has a guide. The plain "make me a QR code" question lands on the product page. | Partial |
| 1 | Generate an invoice PDF for my freelance clients? | 3 | Yes, completely. | OK |
| 2 | Merge and split PDF files? | 4 | Yes. | OK |
| 5 | Create Word documents from a chat? | 4 | Yes. | OK |
| 7 | Time tracking and timesheets? | 5 | Yes. | OK |
| 9 | Schedule a meeting across time zones? | 4 | Yes. | OK |
| 10 | Build a spreadsheet from data in my conversation? | 3 | Yes. | OK |
| 15 | Recurring invoices or subscription billing documents? | 3 | Yes. | OK |

**Size of the gap: 9 of 20 questions had no page that answered them in one place, and two
more were answered without the honest comparison that makes an answer citable.** Nine pages
were written. Two gaps are left open on purpose, Q4 and Q17, because both sit in the saturated
half of the ranking where an incumbent is already named confidently and a new page is unlikely
to displace it. Q20 partly covers Q4 by naming DocuClipper, Bankstatemently and a Stirling-PDF
wrapper as the servers that do read scans.

## Task 3, the pages

### The two wedge pages, written first

Both are written to be the best page on the internet for the question, not product pages. Each
covers what exists including servers that are not ours, gives the mechanics, and carries our
entry as one item with the exact URL.

1. `/guides/which-mcp-servers-work-by-pasting-a-url` (Q16). How to tell a remote server
   from a local one, by reading `packages` against `remotes` in `server.json`. The four things
   the blind run actually found, each with what it is good for. The two conditions that decide
   whether a URL is usable with nothing installed, the second of which most vendor remotes
   fail because they need an OAuth grant to an account you must already have. The independent
   count from registry issue 1626: of 16,305 endpoints declaring a remote, 58.5% answer
   `tools/list` unauthenticated, 25.4% require auth, 8.6% answer HTTP without speaking MCP.
   Then our 30 endpoints, the mint request, the exact URL, a limits table, and seven things a
   remote MCP server cannot do.
2. `/guides/paid-mcp-servers-and-how-you-pay-for-one` (Q18). Opens on the fact that the
   MCP specification has no billing layer, which is why the answer is fragmented. The four
   marketplaces the blind run found, each with what you are actually agreeing to, attributed
   to that run and dated. A fifth model they missed, a licence key sold directly. Why the
   model matters more than the price when an agent is the thing making the calls. How offline
   Ed25519 verification works and the two consequences, including the one that costs us: a
   leaked key cannot be revoked. Then five honest limits on buying this way.

### The five uncontested pages, in the ranked order

3. `/guides/fill-a-quote-or-estimate-template-from-chat` (Q6, n=1). Names r-long's MCP
   Quoting System and says plainly that a machine shop pricing a part should use that instead.
   Explains why a filled template is a dead file. States outright that this server will not
   read your template.
4. `/guides/petty-cash-book-and-cash-ledger-mcp-servers` (Q13, n=1). Opens by saying the
   thin market may mean low demand rather than opportunity, and that three cash receipts a
   month belong in a spreadsheet. Names minhyeoky's mcp-server-ledger and says it is the
   better fit for anyone on plain-text accounting. Then the imprest arithmetic.
5. `/guides/currency-conversion-mcp-servers-compared` (Q8, n=2). The first paragraph
   recommends wesbos's currency-conversion-mcp, and the "where the other server is better"
   section says it installs with npx today and ours does not. Our case is `fx_rates_for` for
   rebilling and dated rates, which a spot converter gets wrong.
6. `/guides/zip-and-unzip-mcp-servers-compared` (Q12, n=2). Recommends loscolmebrothers's
   zip-mcp for anyone who needs passwords, which we do not have. Ours is about the extraction
   guards and reading text out of an archive without unpacking it. Records that the hosted
   endpoint has three more tools than the local build.
7. `/guides/delivery-schedule-and-work-order-documents-from-mcp` (Q14, n=2). Records that
   the blind run found nothing, and that the two hits were a promise-date API and a cron
   scheduler with a name collision. Says in the limits that delivery-schedule has no hosted
   endpoint and that no measured round has ever exercised it.

### The two remaining gap-table pages

8. `/guides/will-an-mcp-server-email-the-invoice-to-my-client` (Q19). The answer is no, in
   the first line. Names Invco as the category that does send. Then the three things that
   follow from an invoice server with no outbound path, and the cost of that choice stated
   plainly.
9. `/guides/can-an-mcp-server-read-a-photo-of-a-receipt` (Q20). The answer is no, and the
   PDF server's own tool description says so rather than failing quietly. Names four servers
   that do OCR. Says the thing most product pages would not: the model can usually read the
   photo you paste into the chat, and for a handful of receipts a month that needs no MCP
   server at all.

Every page carries the exact paste-in URL, the exact stdio config through the shared
`install()` helper, the free tier in numbers, the price, and a section saying what the thing
cannot do. Two gates enforce the last two.

## The home page

The orchestrator's grep on the live site returned three different counts of one catalogue:

    $ curl -s https://mcp.zovo.one/ | /usr/bin/grep -o "Thirty-[a-z]*\|3[0-9] servers"
    Thirty-one   Thirty-one   Thirty-one   32 servers   31 servers

`Thirty-one` was `countWord()`, the number of separately-priced products. `32 servers` was
`VALIDATION.servers`, the number of directories validated. `31 servers` was a table heading.
All three were "true" of different quantities and the page never said which.

What changed. The headline count is now `LISTED_COUNT`, the number of servers the storefront
actually builds a page for, printed as a numeral. The lead is no longer a category
description that defers to `/bundle`; it is the mint request, then a table of every server
with its one-line description, the exact URL to paste, and its price. Rendering the worker
locally: h1 `32 MCP servers for Claude, for freelancers and small businesses`, 30 paste-in
URLs in the table, no spelled-out count anywhere on the page.

The counts that remain are `32` (servers listed, and the validation line, which a gate now
forces to agree) and `31` (what office-suite spawns, and what is sold singly). They are
different quantities and each is labelled.

### The same defect elsewhere, found and fixed

- `the nineteen-server bundle for $39` on all 32 generated product pages. These are the
  pages most registry rows and every mirror repo link to. The string was typed once in
  `scripts/build-pages.mjs`; it now reads the priced-server list and `data/facts.json`, and
  renders `the 31-server bundle for $39`.
- `/guides/mcp-server-free-vs-pro` said `$39 once for all four, lifetime. Saves $37`. The
  saving is $550. That is a material misstatement of the offer on a page a buyer reads before
  paying. Now derived.
- `/setup` said `twelve MCP servers` and `Twelve servers, six clients` while listing 31
  servers across 7 clients. Derived.
- `/bundle` title spelled its count out. Numeral.
- Four server READMEs said `all four servers behind one install`. Rewritten to carry no
  count.

Two spelled-out counts survive in generated product pages and are correct: `nine servers` and
`twenty-three-server`, both inside dated release records where changing them would falsify the
record.

## The per-server pages

Audited all 32 by rendering them, against the five things a page must answer. Result: **30 of
32 complete on all five**. The two exceptions were `delivery-schedule` and `office-suite`,
both missing a hosted URL, which is correct because neither has one. Their pages did not
*say* so, which is the citability failure in miniature: a reader who has just been told most
of these servers connect by URL will assume this one does. Both pages now state it, and say
why.

The token form of the hosted URL was added to the product-page hero by another agent
mid-round.

## Task 4, the honesty gate

`billing/test/figures.test.mjs`, 18 gates. The mechanism is `scripts/build-figures.mjs`, which
reads the manifests and writes `billing/src/figures.js`:

    $ node scripts/build-figures.mjs --check
    figures OK: 34 server dirs, 32 listed, 32 children, 30 hosted, 290 own tools + 2 license tools each

Sources: `servers/*/src/index.ts` for tool counts, `packages/mcp-license/src/index.ts` for the
shared pair, `remote/src/index.ts` for the hosted list and the rate limits,
`servers/*/server.json` for the version, `data/facts.json` for prices and free tiers, and the
`ids` array in `scripts/build-pages.mjs` for what the site lists.

The tool-count derivation was checked against the running endpoints on 2026-09-10:

| Server | `registerTool` + 2 | live `tools/list` |
|---|---|---|
| invoice | 13 | 13 |
| kanban | 17 | 17 |
| petty-cash | 9 | 9 |
| barcode | 10 | 10 |
| price-tracker | 10 | 10 |
| zip | 9 | **12** |

zip disagrees because the hosted wrapper adds three file-transfer tools. So `TOOLS` is the
stdio count and every page that quotes it says stdio. `OWN_TOOLS_TOTAL` 290 plus the licence
pair reconciles exactly with the independently measured `OFFICE_SUITE_TOOLS = 292` in
`billing/src/index.js`, taken over stdio from the running bundle on 2026-09-07.

Deriving the counts from `ls servers/` was wrong twice in one afternoon: `servers/packing-list`
appeared with source and no README, then with a README and still no product page, and the
directory count reached 34 while the site listed 32. Site-facing counts read the page-builder
list instead.

### What the gates check

- `figures.js` matches a fresh regeneration.
- `SINGLE_PRODUCT_IDS.length === LISTED_CHILD_COUNT`, `HOSTED_COUNT <= LISTED_COUNT`,
  `VALIDATION.servers === LISTED_COUNT`.
- No numeral in front of "servers" on the rendered home page that the repo cannot derive, and
  no English number word in front of "servers" at all.
- The home page prints one paste-in URL per hosted server and the request that mints a token.
- Every figure on each of the nine pages resolves to `billing/src/figures.js`,
  `data/facts.json`, `docs/BLIND_RECOMMENDATION_R1.md` or `docs/CONTENT_R3.md`. One exception
  is listed with its reason, `0.21` against the three-part version string.
- Every one of the nine has a section saying what the thing cannot do.
- Every one gives a paste-in URL or says why there is none.
- No guide, and no rendered page, spells a count of servers out. Five phrases are allowlisted
  with the reason each is a measurement or a subset rather than a catalogue claim.

Why the existing gates missed three contradictory counts on the front page.
`release-check.mjs` checks manifests, lists and files. `guide-figures.test.mjs` checks one
guide against one round file. `build-readme --check` checks the README. Not one of them ever
rendered a page and read a number off it, so a number could be wrong on the deployed HTML
while every gate stayed green. Two of the new gates render the page through the worker's own
`fetch` handler and read the output. That is the class of check that was missing.

### Counts

    $ cd billing && node --test test/*.test.mjs
    # tests 134   # pass 133   # fail 1

    $ node scripts/release-check.mjs
    34 servers at 0.21.0, 29 checks each
    3 estate FAILs, 2 servers with per-server FAILs (delivery-schedule, packing-list)

    $ node scripts/build-readme.mjs --check
    README drifted in: table, counts

    $ npm test          (repository root)
    exit 0

One more number was corrected on the way through. `VALIDATION` in `billing/src/index.js` said
`951 of 951` while `data/validation.json` had moved to 950 of 951 after a re-run during this
round, so the home page would have claimed a clean sweep it no longer had. It now reads
`950 of 951`, and the median from the same run, 435 ms rather than 469.

The one failing billing test, the README drift and both estate FAILs all trace to
`servers/packing-list`, a server directory another agent was building during this round. It
has source and a README and no entry in `PRODUCTS`, `facts.json`, `tools.json`, the page ids
or the setup map, so every check that compares the directory listing to the catalogue reports
it. None of them is caused by this round's changes, and none of them will survive that server
being finished. `delivery-schedule` also carries three pre-existing per-server FAILs, for a
missing setup page, a missing compare page and no measured round; its `guide` FAIL is now
closed by page 7.

## Task 5, humanize

The scanner the standing rule names is broken, exactly as warned. `~/Desktop/humanize/scan.py`
is iCloud-evicted:

    $ ls -lO ~/Desktop/humanize/scan.py
    -rwxr-xr-x@ 1 mike staff compressed,dataless 8968 Aug 31 17:30

Running it on deliberately terrible text does not fail, it hangs and is killed:

    $ timeout 25 python3 ~/Desktop/humanize/scan.py known_bad.md
    exit=124

`wc -l` on the same file prints nothing. Do not trust a pass from that path.

A working copy exists off iCloud at `/Users/mike/content-pipeline/voice/humanize-scan.py`,
same size, not dataless, and it passes both controls:

    $ python3 /Users/mike/content-pipeline/voice/humanize-scan.py --strict known_bad.md
    FAIL  known_bad.md  [1 hard, 3 soft]   [HARD] tier1: delve ... exit=1

    $ python3 /Users/mike/content-pipeline/voice/humanize-scan.py --strict control_good.html
    CLEAN  control_good.html   exit=0

The known-bad control is the orchestrator's own string. The scanner flags it, so a pass from
this binary means something.

Note on method: the scanner reads `<pre>` as prose, so CLI flags such as `--scope` register as
em dashes. `HUMANIZE.md` exempts code, so the scan runs on each page with `<pre>` and `<code>`
stripped, which is the prose the rule actually governs.

    $ python3 /Users/mike/content-pipeline/voice/humanize-scan.py --strict prose/
    SCANNED 9 file(s): 9 clean, 0 with HARD fails, 0 hard / 0 soft violations total.
    RESULT: PASS   exit=0

The first pass found 0 hard and 7 soft, six "there is" sentence openers and one banned word,
`harness`. All were rewritten and the second pass is clean. The home page lead, the llms.txt
header and the new no-hosted-URL sentence were scanned separately and are also clean. One
pre-existing soft warning remains on `/guides/mcp-server-free-vs-pro`, two "there is" openers
in sentences this round did not write.

No emoji anywhere in any file this round touched.

## What a reader should do with this

The wedge pages are the only two things here with a chance of changing the 0-of-18 number, and
they will do it only if a general assistant retrieves them. Neither is a product page and
neither should be edited into one; the reason they can be cited is that they answer the
question for somebody who ends up installing a competitor.

The measurable follow-up is a re-run of `docs/BLIND_RECOMMENDATION_PROCEDURE.md` by a fresh
agent after deployment, with the same 18 questions, watching Q16 and Q18. Anything short of
being named in the answer text is not a result.
