# Content round 8: bank-statement guide, 6 setup pages, 1 compare page - 2026-09-04

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

$ cd billing && wrangler deploy
Current Version ID: ac9e8fd2-f375-4501-895a-7629fef66b10

$ curl (14 URLs, 8 new + 6 index/sitemap/home) -> 14 x HTTP 200
$ curl https://mcp.zovo.one/setup/claude-web/bank-statement -> HTTP 404 (deliberate, see below)

$ curl -s https://mcp.zovo.one/sitemap.xml | grep -o '<loc>' | wc -l
178   (170 before this round + 8 new URLs)

$ curl -s https://mcp.zovo.one/llms.txt | grep -c bank-statement
9   (product line, guide line, compare line, 6 setup lines; claude-web section has no
     bank-statement entry, confirming the exclusion took effect on the live build)

$ POST https://api.indexnow.org/IndexNow            -> HTTP 200, 13 URLs
$ GET  https://mcp.zovo.one/22fad93b71a88e2e60acae203c4288ae.txt -> HTTP 200 (keyLocation)
```

## What shipped

8 new URLs, all live at mcp.zovo.one:

- 1 guide in `billing/src/content.js`: `GUIDES["bank-statement-csv-categorize-reconcile"]`, covering
  the seven bank profiles (Revolut, Wise, mBank, PKO BP, ING, N26, generic), locale-aware amount
  parsing, category rules, per-currency summaries, `reconcile_expenses` against
  `mcp-expense-tracker`, and `recurring_detect`. The centrepiece is the occurrence-index dedupe
  insight taken verbatim from `servers/bank-statement/RESULT.md`'s own "insight" section: a key of
  date+amount+description alone collapses two identical same-day purchases into one row, a plain row
  index breaks on a reordered or late-settling export, and the fix that actually works is
  date+amount+currency+account+description plus the count of identical rows seen so far, compared
  against the count already stored, read inside the same file lock as the write. GUIDE_INDEX
  description extended.
- `bank-statement` added to `SETUP_SERVERS` in `billing/src/setup.js` with 6 hand-written `ANGLE`
  sentences (claude-desktop, claude-code, cursor, vscode, windsurf, cline), producing 6 setup pages.
  No claude-web page and no `WEB_ANGLE` entry: `remote/src/index.ts` (out of this round's write
  scope) has no `/mcp/bank-statement` route, so there is nothing for a claude.ai connector to point
  at. `serversFor()` now excludes `bank-statement` from claude-web the same way it already excludes
  `office-suite`, and `setupPage()` returns null for that pair; verified live, the URL 404s and
  neither the sitemap nor the claude-web section of llms.txt lists it.
- 1 comparison page in `billing/src/compare.js`: `COMPARE["bank-statement"]` vs MainBook Bank
  Statement Converter and bankstatementparser-mcp. `COMPARE_INDEX` description updated from "Fifteen"
  to "Sixteen".

`servers.bank-statement` already existed in `data/facts.json`, `/s/bank-statement` already existed
in generated `PAGES` (from the README), and `bank-statement` already had a product entry in
`billing/src/index.js` before this round started, so no part of the build started from an absent
spec. `/s/bank-statement` was not a new URL this round.

## Competitor research, verified before writing

Every competitor fact was read from the official MCP registry search
(`registry.modelcontextprotocol.io/v0/servers?search=<term>`) for the terms `bank`, `statement`,
`transactions` and `budget`, cross-checked against each project's own README fetched via
raw.githubusercontent.com, all on 2026-09-04. Nothing was installed; no paid API calls.

- **MainBook Bank Statement Converter** (`ai.mainbook/bank-statement-converter` on the registry,
  github.com/human-beyond/mainbook-mcp, pypi `mainbook-mcp`, hosted at `mcp.mainbook.ai/mcp`):
  README read directly. 5 tools counted by name (`convert_bank_statement`, `get_conversion`,
  `list_conversions`, `get_balance`, `output_folder`). Converts PDF statements only, checks
  `opening balance + credits - debits` against the closing balance and flags rows that do not fit,
  read verbatim from its own worked example (63 transactions, 4 pages, 4 credits). Requires a
  MainBook account and spends metered "page credits" per conversion; its README never states a
  price per page, so the compare table says exactly that rather than inventing a number. MIT
  licence confirmed from the README's own badge.
- **bankstatementparser-mcp** (`io.github.sebastienrousseau/bankstatementparser-mcp` matched under
  the `statement` search term, github.com/sebastienrousseau/bankstatementparser-mcp, pypi
  `bankstatementparser-mcp`): README read directly. 5 tools plus 1 resource and 1 prompt, all
  counted by name from its own "Tools" section. Stateless: every call takes statement content inline
  and a filename hint, materialises a private temp file for the call, and returns JSON; nothing
  persists between calls, confirmed from its own architecture table. Reads CSV, OFX/QFX, SWIFT
  MT940 and ISO 20022 CAMT.053/pain.001, read from its own "Supported formats" line. Apache-2.0
  licence confirmed from its own "## License" section (the file header's dual SPDX line is not what
  the project itself declares as the operative licence). It is explicitly the "ingestion layer" of
  an 8-server ISO 20022 suite by the same author; that context is quoted, not treated as ours to
  compete against server-by-server.

## Guide content

`bank-statement-csv-categorize-reconcile` covers install, the seven bank profiles and the specific
quirk of each read from `servers/bank-statement/README.md`'s own tools table and
`servers/bank-statement/RESULT.md`'s measured section (Revolut's `State: REVERTED` drop, Wise's
day-first dates and merchant column, mBank's 3-line preamble with `;` and an in-cell currency code,
PKO BP's sign taken from a separate `Typ transakcji` column, ING's `Kwota transakcji (waluta
rachunku)` header, N26's currency-in-header-only convention, and the generic fallback), locale-aware
amount parsing, `category_rules` with its backtracking-regex refusal, per-currency
`statement_summary`, `reconcile_expenses` against the expense tracker (the seeded-store result of 1
match one day apart and 1 unmatched expense, taken from RESULT.md), and `recurring_detect` (the
SPOTIFY monthly / EUR 9.99 / EUR 119.88 annualised result, also taken from RESULT.md). Free vs Pro
limits are quoted from the README's own table.

## Quality gate

    grep -c -iE 'seamless|powerful|effortless|unlock|supercharge|game-changer|
                 revolutionary|blazing|cutting-edge|leverage'  -> 0 (content.js, setup.js, compare.js)
    grep -cP em-dash (\xe2\x80\x94)                              -> 0 (all 3 sources)
    grep -cP non-ASCII on content.js, setup.js, compare.js      -> 0
    node --check on all 3 edited sources                         -> pass
    npm test (billing)                                            -> 25 pass, 0 fail

## Deploy and verification

    cd billing && wrangler deploy   -> mcp-billing, version ac9e8fd2-f375-4501-895a-7629fef66b10
    curl x14 (8 new URLs + /guides, /compare, /setup, /sitemap.xml, /llms.txt, /) -> 14 x HTTP 200
    curl /setup/claude-web/bank-statement                          -> HTTP 404, deliberate (no
                                                                       /mcp/bank-statement route in
                                                                       remote/src/index.ts, which is
                                                                       outside this round's write
                                                                       scope; serversFor() and
                                                                       setupPage() both exclude it,
                                                                       the same pattern already used
                                                                       for office-suite)
    sitemap.xml <loc>                                              -> 178 total (170 before this
                                                                       round + 1 guide, 1 compare,
                                                                       6 setup pages; confirmed no
                                                                       claude-web/bank-statement entry)
    llms.txt                                                       -> carries the product, guide and
                                                                       compare lines and all 6 new
                                                                       setup lines (claude-desktop
                                                                       through cline); the claude-web
                                                                       section has no bank-statement
                                                                       entry, verified by grep
    POST https://api.indexnow.org/IndexNow                        -> HTTP 200, 13 URLs in one request
                                                                       (8 new pages + /guides,
                                                                       /compare, /setup, /sitemap.xml,
                                                                       /)
    GET  https://mcp.zovo.one/22fad93b71a88e2e60acae203c4288ae.txt -> HTTP 200 (keyLocation)

Zero paid API calls. Outbound requests were the MCP registry search endpoint and two
raw.githubusercontent.com README fetches, IndexNow, and the Cloudflare deploy.

## RESULT.md

```
status: DONE
evidence:
  8 new URLs live, all HTTP 200: 1 guide, 6 setup pages (bank-statement across claude-desktop,
  claude-code, cursor, vscode, windsurf, cline), 1 compare page (bank-statement vs MainBook Bank
  Statement Converter and bankstatementparser-mcp). No claude-web setup page for bank-statement:
  there is no /mcp/bank-statement route in remote/src/index.ts (out of this round's write scope), so
  serversFor() and setupPage() in billing/src/setup.js now exclude it the same way office-suite was
  already excluded; verified live at HTTP 404 and absent from both the sitemap and the claude-web
  section of llms.txt.
  competitor facts for the compare page read from the official MCP registry search plus each
  project's own README, fetched on 2026-09-04; MainBook's PDF-only input, account-and-page-credit
  model and its own balance-reconciliation check, and bankstatementparser-mcp's stateless per-call
  design and its role as the ingestion layer of an 8-server ISO 20022 suite, are quoted from source,
  not inferred
  guide states the occurrence-index dedupe insight exactly as documented in
  servers/bank-statement/RESULT.md: date+amount+currency+account+description plus the count of
  identical rows seen so far in the file, compared against the count already stored, because a plain
  key collapses same-day duplicates and a plain row index breaks on a reordered export; also states
  the seven bank-profile quirks, category_rules' backtracking-regex refusal, reconcile_expenses and
  recurring_detect results, all read from the README and RESULT.md rather than invented
  sitemap.xml and llms.txt confirmed to derive from GUIDES/COMPARE/PAGES/setupUrls() with no separate
  list to maintain; sitemap now 178 <loc> entries, all 8 new URLs matched, bank-statement correctly
  absent from the claude-web section; /s/bank-statement was not new, already live before this round
  quality gate: hype 0, em dash 0, non-ASCII 0 across all 3 edited sources; npm test 25 pass 0 fail
  wrangler deploy ac9e8fd2-f375-4501-895a-7629fef66b10; 14 curls all HTTP 200 (plus 1 deliberate 404)
  IndexNow POST 200 for 13 URLs, keyLocation 200
artifacts:
  billing/src/content.js (1 guide, GUIDE_INDEX description extended)
  billing/src/setup.js (bank-statement SETUP_SERVERS row, 6 ANGLE sentences, serversFor() and
    setupPage() extended to exclude bank-statement from claude-web)
  billing/src/compare.js (1 comparison page, COMPARE_INDEX description updated to Sixteen)
  docs/CONTENT_R8_RESULT.md
  data/distribution.json (guides surface note extended for round 8)
cost: 24 wall minutes.
failures: none.
follow-ups for the orchestrator (outside this unit's write scope):
  remote/src/index.ts has no /mcp/bank-statement route; adding one would let this round's claude-web
  page and WEB_ANGLE sentence be written honestly instead of excluded.
```
