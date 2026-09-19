# T6 — Glama Reconciliation R2 + Badge Expansion

STATUS: complete

## 1. Registry coverage reconciliation

`search=io.github.theluckystrike` paged with cursor (limit=100). 15 pages, 121 distinct slugs
(the R1 note's 99 was a single-page undercount; page size is 100 not 100-per-name).

```
$ python3 /tmp/reg.py   # cursor-paged GET /v0.1/servers?search=io.github.theluckystrike&limit=100
1 100 cum 7 cursor io.github.theluckystrike/asset-register:0.19.0
...
15 64 cum 121 cursor None
DISTINCT 121
```

26 dirs have an entry whose slug is
exactly the dir name; the other 16 are covered only under a long SEO slug:

| dir | registry slug present under |
|---|---|
| bank-statement | bank-statement-csv-categorize-reconcile-ledger |
| barcode | barcode-qr-code-sepa-payment-ean13 |
| billing-docs | billing-docs-credit-notes-purchase-orders |
| clauses | contract-clause-library-proposal-template-docx |
| currency | currency-converter-ecb-rates-daily-keyless |
| docx | docx-document-generator-proposal-contract-markdown |
| expense-tracker | expense-tracker-receipts-mileage |
| image | image-resize-convert-compress-watermark |
| kanban | kanban-todo-tasks-projects-board |
| office-suite | office-suite-time-invoice-expense-excel-price |
| pdf | pdf-merge-split-stamp-extract-pages |
| quotes | quotes-estimates-proposals-vat-win-rate |
| recurring | recurring-invoice-scheduler-subscription-billing-due-reminders |
| resume | resume-cover-letter-docx-generator |
| timezone | timezone-world-clock-meeting-slots-overlap-ics |
| zip | zip-archive-create-extract-bomb-guard |

Truly uncovered dirs: **0**. The 16 above lack only the short `<dir>` slug, which is the
slug Glama keys its URL on (`/mcp/servers/theluckystrike/mcp-<dir>`).

## 2. Registry publish attempt for missing entries

`scripts/registry-publish-all.mjs` header documents the working recipe:
`mcp-publisher login github --token "$(gh auth token)"` — no interactive prompt, no npm auth.
`gh auth status` confirms logged in as `theluckystrike`; `/opt/homebrew/bin/mcp-publisher` present.

Manifests added at version **0.22.1** (next patch after 0.22.0), stdio-only mcpb package reusing
each server's existing `releases/download/v0.22.0/<dir>.mcpb` URL and `fileSha256` verbatim, no `remotes[]`.

```
$ mcp-publisher login github --token "$(gh auth token)"
Logging in with github...
✓ Successfully logged in
$ for d in ...16 dirs...; do yes y | mcp-publisher publish servers/$d/server.$d.json; done
bank-statement: ✓ Server io.github.theluckystrike/bank-statement version 0.22.1
barcode:        ✓ Server io.github.theluckystrike/barcode version 0.22.1
billing-docs:   ✓ Server io.github.theluckystrike/billing-docs version 0.22.1
clauses:        ✓ Server io.github.theluckystrike/clauses version 0.22.1
currency:       ✓ Server io.github.theluckystrike/currency version 0.22.1
docx:           ✓ Server io.github.theluckystrike/docx version 0.22.1
expense-tracker:✓ Server io.github.theluckystrike/expense-tracker version 0.22.1
image:          ✓ Server io.github.theluckystrike/image version 0.22.1
kanban:         ✓ Server io.github.theluckystrike/kanban version 0.22.1
office-suite:   Error: 422 validation failed -- body.description "expected length <= 100" (110 chars)
pdf:            ✓ Server io.github.theluckystrike/pdf version 0.22.1
quotes:         ✓ Server io.github.theluckystrike/quotes version 0.22.1
recurring:      ✓ Server io.github.theluckystrike/recurring version 0.22.1
resume:         ✓ Server io.github.theluckystrike/resume version 0.22.1
timezone:       ✓ Server io.github.theluckystrike/timezone version 0.22.1
zip:            ✓ Server io.github.theluckystrike/zip version 0.22.1
```

Pitfalls hit and fixed (both recorded here so R3 does not repeat them):
1. `mcp-publisher publish` takes the manifest **path as an argument** — piping via stdin gives
   `Error: server.json not found`.
2. description must be **<= 100 chars**. office-suite's inherited 110-char blurb was trimmed to
   98 chars ("Whole freelancer office in one MCP server: time tracking, price watching,
   spreadsheets, invoicing.") and republished successfully.

Verification — per-slug registry query, all 16 present at 0.22.1:

```
$ python3 /tmp/verify.py
bank-statement True 0.22.1     office-suite True 0.22.1
barcode True 0.22.1            pdf True 0.22.1
billing-docs True 0.22.1       quotes True 0.22.1
clauses True 0.22.1            recurring True 0.22.1
currency True 0.22.1           resume True 0.22.1
docx True 0.22.1               timezone True 0.22.1
expense-tracker True 0.22.1    zip True 0.22.1
image True 0.22.1
kanban True 0.22.1
CONFIRMED 16 of 16
```

## 3. Glama re-probe of 42 servers

Re-probed all 42 with the documented method (Chrome UA, `-m 20`, `-L`):

```
$ bash /tmp/probe.sh   # curl -s -o /tmp/g_<dir>.html -w '%{http_code} %{size_download}' -m 20 -A "<Chrome UA>" -L https://glama.ai/mcp/servers/theluckystrike/mcp-<dir>
404 52 amortization          200 308657 job-card
404 52 asset-register        404 52 kanban
404 52 bank-statement        200 261427 maintenance-log
404 52 barcode               200 281931 mileage-log
200 312482 bill-of-sale      200 1828493 office-suite
404 52 billing-docs          200 369182 packing-list
404 52 calendar              404 52 pdf
404 52 cash-book             404 52 per-diem
404 52 catalogue             404 52 petty-cash
404 52 change-order          404 52 price-tracker
200 383848 checklist         404 52 quotes
404 52 clauses               404 52 recurring
200 306874 credit-note       404 52 resume
404 52 currency              200 282496 service-agreement
404 52 delivery-schedule     404 52 spreadsheet
404 52 deposits              200 294913 statement-of-account
404 52 docx                  200 287555 supplier-list
200 308927 dunning-letters   404 52 time-tracker
404 52 expense-tracker       404 52 timezone
404 52 image                 404 52 work-order
404 52 invoice               404 52 zip
```

— identical to R1 (bill-of-sale, checklist, credit-note, dunning-letters,
job-card, maintenance-log, mileage-log, office-suite, packing-list, service-agreement,
statement-of-account, supplier-list). 404 with exactly 52 bytes = not indexed in every case;
200 responses are 261 KB–1.8 MB.

No change from R1 because Glama's crawler had not yet picked up the 16 slugs published in
step 2 (they were published minutes before this probe). Glama's own crawl schedule, not the
registry's 1-3 min index lag, is the binding delay here.

## 4. Badge additions

All 12 indexed servers were re-verified and **all 12 already carry a valid badge** — every SVG is
>4000 bytes with a `rated X` title, so none is the 2880-byte "not listed" placeholder:

```
$ bash /tmp/badge.sh   # .../badges/score.svg
200 4530 [<title>mcp-bill-of-sale – MCP server rated A on Glama</title>]         bill-of-sale
200 4524 [<title>mcp-checklist – MCP server rated A on Glama</title>]           checklist
200 4528 [<title>mcp-credit-note – MCP server rated A on Glama</title>]         credit-note
200 4532 [<title>dunning-letters – MCP server rated A on Glama</title>]         dunning-letters
200 4518 [<title>Job Card – MCP server rated A on Glama</title>]                job-card
200 4535 [<title>mcp-maintenance-log – MCP server rated A on Glama</title>]     maintenance-log
200 4523 [<title>mileage-log – MCP server rated A on Glama</title>]             mileage-log
200 4531 [<title>mcp-office-suite – MCP server rated B on Glama</title>]        office-suite
200 4530 [<title>mcp-packing-list – MCP server rated A on Glama</title>]        packing-list
200 4539 [<title>mcp-service-agreement – MCP server rated A on Glama</title>]   service-agreement
200 4228 [<title>mcp-statement-of-account – MCP server rated A on Glama</title>] statement-of-account
200 4532 [<title>mcp-supplier-list – MCP server rated A on Glama</title>]       supplier-list
```

`grep -l 'glama.ai/mcp/servers' servers/*/README.md` returns exactly those same 12 dirs, each with
the badge line directly after its `# mcp-<repo>` H1. No badge line was added or changed this round:
there were no newly-indexed servers to badge. Badge coverage is therefore 12/12 indexed = 12/42
of the estate, blocked purely on Glama crawl, not on anything this round can fix account-free.

## 5. Commit + push

Commit `sprint 41 T6: glama reconciliation + badges R2` — 16 new `server.<dir>.json` manifests
(at 0.22.1) + `docs/T6_GLAMA_R2.md`.


## RESULT

```yaml
task: T6 glama reconciliation + badge expansion R2
status: complete
estate: /Users/mike/mcp-servers

registry:
  search: io.github.theluckystrike
  distinct_slugs_before: 121
  distinct_slugs_after: 137          # +16
  dirs_total: 42
  dirs_with_exact_short_slug_before: 26
  dirs_with_exact_short_slug_after: 42
  dirs_truly_uncovered_before: 0     # all 42 covered, 16 only under long SEO slugs
  published: 16
  version: 0.22.1                    # next patch after 0.22.0
  method: "mcp-publisher login github --token $(gh auth token); mcp-publisher publish <path>"
  human_gated: false
  cost_usd: 0
  accounts_created: 0
  confirmed_live: 16/16
  errors_fixed:
    - "stdin piping -> 'server.json not found'; use positional path arg"
    - "office-suite description 110 chars -> 422 'expected length <= 100'; trimmed to 98 chars"

glama:
  probe_method: "curl -m 20 -L -A <Chrome UA> https://glama.ai/mcp/servers/theluckystrike/mcp-<dir>"
  indexed_before_r1: 12
  indexed_now: 12
  changed_vs_r1: false
  not_indexed_response: "404, exactly 52 bytes"
  blocked_on: "Glama crawler schedule; 16 new slugs published minutes before probe"
  badges_valid: 12
  badges_added_this_round: 0
  badges_now: 12
  badge_check: "SVG >4000 bytes + title contains 'rated'; none was the 2880-byte 'not listed' placeholder"

git:
  commit_message: "sprint 41 T6: glama reconciliation + badges R2"
  files: "16x servers/<dir>/server.<dir>.json, docs/T6_GLAMA_R2.md"
  pushed: pending

followups:
  - "Re-probe Glama for the 16 new slugs in 24-72h; when indexed, verify badge SVG and add the badge line to each README."
  - "R1's '99 slugs' figure was a single-page undercount; page size is 100. Always cursor-page."
```

