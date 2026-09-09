# Tool description quality, loop 31 (2026-09-09)

Every claim below names the command or file it came from. Scores are this project's own,
from the reproducible heuristic recorded in `data/tool_quality_r1.json`; they are not
Glama's. The heuristic is calibrated against the one number Glama publishes for us: on
mcp-statement-of-account it reproduces the published minimum of 2.9 exactly, and puts the
mean at 3.29 against Glama's published 3.7, so it grades harder than the real thing.

## Why the minimum is the whole game

Glama computes Tool Definition Quality as 60 percent of the MEAN tool score plus 40 percent
of the MINIMUM. One tool caps the server. On 19 of the 31 servers the pre-loop minimum was
the same pair of tools, `license_status` and `license_activate`, registered once in
`packages/mcp-license/src/index.ts` and inherited by every server. Both scored 2.90 here and
both are now 3.85 or better, at 207 and 209 characters. Fixing that one file moved 31 servers
at once; fixing a per-server tool moves one. On the other 12 the floor was a one-line tool of
that server's own, the worst being kanban's `task_done` and time-tracker's `entry_edit` at 2.35.

They were also over the estate's own 220-character contract ceiling before this loop, at 534
and 674 characters, so that pair was failing the description assertion on every server in the
estate. A separate measurement of the Glama connector scores, made by another agent this loop,
found `license_activate` was the minimum-scoring tool on 20 of 20 connectors at a mean of 2.26.

## What changed

- 159 tool descriptions rewritten across 31 servers, plus the 2 shared licence tools and
  office-suite's own 2, so 163 distinct registrations. Counted from `data/tool_quality_r1.json`
  (`own_server_tools_rewritten`, and the 221 figure there counts the shared pair once per server).
- 0 tool NAMES changed, 0 parameter names, 0 schemas, 0 behaviour. Proved by a real
  initialize + tools/list handshake against every `dist/index.js` before and after:
  352 tools on 31 servers both times, and 644 including office-suite's proxy view both times,
  with an identical name set on every server (`tool_names_identical` is true for all 31).
- Two factual defects in existing descriptions were found by reading the code and fixed:
  `clause_list` claimed "newest categories first" when `orderByCategory` in
  `servers/clauses/src/library.ts` sorts by `categoryRank` (contract order) then title; and
  office-suite's `license_status` named 5 servers in a bundle that proxies 31
  (`CHILDREN` in `servers/office-suite/src/index.ts`).
- The disambiguation Glama named on the indexed server is now explicit in both directions:
  `statement_aging` says it is the free per-invoice view and points at `statements_report`,
  which says it is the Pro whole-book roll-up with no invoice rows.

## Estate scores, before and after

| server | tools | mean before | min before | worst before | mean after | min after | worst after | definition score |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| amortization         | 9 | 3.41 | 2.90 | license_status         | 3.77 | 3.50 | loans_report           | 3.21 -> 3.66 |
| asset-register       | 9 | 3.44 | 2.90 | license_status         | 3.84 | 3.40 | asset_schedule         | 3.22 -> 3.66 |
| bank-statement       | 12 | 3.34 | 2.75 | accounts_list          | 3.63 | 3.30 | recurring_detect       | 3.10 -> 3.50 |
| barcode              | 10 | 3.42 | 2.90 | license_status         | 3.76 | 3.50 | qr_payment_sepa        | 3.21 -> 3.66 |
| billing-docs         | 16 | 3.28 | 2.85 | credit_note_list       | 3.63 | 3.15 | billing_docs_report    | 3.11 -> 3.44 |
| calendar             | 12 | 3.20 | 2.55 | calendars_list         | 3.65 | 3.25 | conflicts              | 2.94 -> 3.49 |
| cash-book            | 9 | 3.47 | 2.90 | license_status         | 3.75 | 3.35 | ledger_build           | 3.24 -> 3.59 |
| catalogue            | 12 | 3.51 | 2.90 | license_status         | 3.76 | 3.45 | sku_delete             | 3.27 -> 3.64 |
| change-order         | 11 | 3.34 | 2.90 | license_status         | 3.67 | 3.40 | change_order_status    | 3.16 -> 3.56 |
| clauses              | 12 | 3.18 | 2.55 | clause_delete          | 3.76 | 3.40 | clause_import          | 2.93 -> 3.62 |
| currency             | 10 | 3.42 | 2.90 | license_status         | 3.66 | 3.20 | cache_status           | 3.21 -> 3.48 |
| delivery-schedule    | 12 | 3.33 | 2.90 | license_status         | 3.80 | 3.40 | deliverable_delete     | 3.16 -> 3.64 |
| deposits             | 11 | 3.36 | 2.90 | license_status         | 3.68 | 3.45 | deposit_list           | 3.18 -> 3.59 |
| docx                 | 11 | 3.48 | 2.90 | license_status         | 3.68 | 3.30 | business_set           | 3.25 -> 3.53 |
| expense-tracker      | 14 | 3.56 | 2.50 | expense_delete         | 3.86 | 3.50 | expense_list           | 3.14 -> 3.72 |
| image                | 12 | 3.55 | 2.90 | license_status         | 3.72 | 3.45 | image_dominant_colors  | 3.29 -> 3.61 |
| invoice              | 13 | 3.36 | 2.75 | invoice_list           | 3.74 | 3.30 | invoice_list           | 3.12 -> 3.56 |
| kanban               | 17 | 2.81 | 2.35 | task_done              | 3.71 | 3.30 | task_update            | 2.63 -> 3.55 |
| pdf                  | 12 | 3.55 | 2.90 | license_status         | 3.71 | 3.55 | pdf_watermark_business | 3.29 -> 3.65 |
| per-diem             | 9 | 3.64 | 2.90 | license_status         | 3.92 | 3.75 | perdiem_rates          | 3.34 -> 3.85 |
| petty-cash           | 9 | 3.45 | 2.90 | license_status         | 3.71 | 3.30 | reconcile              | 3.23 -> 3.55 |
| price-tracker        | 10 | 3.26 | 2.80 | alerts_pending         | 3.62 | 3.30 | alerts_pending         | 3.08 -> 3.49 |
| quotes               | 12 | 3.31 | 2.85 | quote_list             | 3.65 | 3.30 | quote_list             | 3.13 -> 3.51 |
| recurring            | 14 | 3.16 | 2.60 | schedule_pause         | 3.69 | 3.35 | schedule_pause         | 2.94 -> 3.55 |
| resume               | 10 | 3.28 | 2.75 | resume_to_markdown     | 3.80 | 3.40 | resume_read            | 3.07 -> 3.64 |
| spreadsheet          | 10 | 3.48 | 2.90 | license_status         | 3.73 | 3.40 | sheet_query            | 3.25 -> 3.60 |
| statement-of-account | 8 | 3.29 | 2.90 | license_status         | 3.67 | 3.45 | statements_report      | 3.13 -> 3.58 |
| time-tracker         | 14 | 3.19 | 2.35 | entry_edit             | 3.68 | 3.40 | timer_status           | 2.85 -> 3.57 |
| timezone             | 11 | 3.28 | 2.90 | license_status         | 3.60 | 3.35 | now                    | 3.13 -> 3.50 |
| work-order           | 12 | 3.32 | 2.90 | license_status         | 3.69 | 3.30 | work_order_list        | 3.15 -> 3.53 |
| zip                  | 9 | 3.27 | 2.90 | license_status         | 3.72 | 3.30 | zip_bundle_month       | 3.12 -> 3.55 |

Estate mean over all 352 tools: 3.339 before, 3.715 after.
Lowest minimum on any server: 2.35 before, 3.15 after.
Servers whose minimum is at or above 3.0: 31 of 31 (0 of 31 before).

## The 3.5 target was not reached, and the reason is a hard constraint

The brief asked for every server's minimum above 3.5. 5 of 31 reach it.
The binding constraint is the estate's own contract test: `MAX_DESCRIPTION = 220` in every
`servers/*/test/contract.test.mjs`, with `OVER_LENGTH_BASELINE` empty, so no description may
exceed 220 characters. Six scored dimensions do not fit in 220 characters at full marks:
naming what a tool returns, what it refuses, its units, its free-tier cap AND the sibling to
prefer instead costs more than that. The descriptions written for this loop were first drafted
at 300 to 600 characters and then cut to the ceiling; what the cut removed was, in nearly every
case, a clause on what the tool refuses or on the sibling to prefer, which are the two signals
Behavioral Transparency and Usage Guidelines score.

That ceiling was not raised, and no name was added to `OVER_LENGTH_BASELINE`. Moving a shared
quality gate to let this work through is not this agent's call. The tools still furthest from
3.5, if the ceiling is ever revisited:

- billing-docs: billing_docs_report at 3.15
- currency: cache_status at 3.20
- calendar: conflicts at 3.25
- bank-statement: recurring_detect at 3.30
- docx: business_set at 3.30
- invoice: invoice_list at 3.30
- kanban: task_update at 3.30
- petty-cash: reconcile at 3.30

## Conventions now stated in the text, because an assistant reads this before calling

- Money is in minor units in every stored figure, and the tools that take MAJOR units say so
  in capitals: `invoice_create.unit_price`, `invoice_mark_paid.amount`, `expense_update.amount`,
  `quote_create.unit_price`, `purchase_order_create`, and every hourly rate in time-tracker.
- Payloads that come back in both scales say which is which, for example
  `change_order_invoice_payload` and `milestone_payload`: invoice_create-ready items in MAJOR
  units and quote_create-ready items in MINOR units, exactly 100x apart.
- Free-tier caps are named with their number wherever one exists, so an assistant can explain
  a refusal instead of retrying it: 3 boards and 200 open tasks (kanban), 7 days (time-tracker),
  30 days (expense-tracker), 3 invoices a month (invoice), 5 statements a month
  (statement-of-account), 5 documents a month (billing-docs), 20 codes and 20 archives a month
  (barcode, zip), 3 watches (price-tracker), 2 calendars (calendar), 5 contacts (timezone).

## Verification

- `npm run build` at the root: clean, all 31 servers plus office-suite and packages/mcp-license.
- `npm test -w servers/<name>` for all 32 servers: 0 failures. Root `npm test`: 34 suites,
  1563 assertions, 0 failures, 0 `not ok` lines.
- `node remote/build-vendor.mjs`: exits 0. Twelve of its exact-string patches match tool
  descriptions and were updated on both sides, keeping the hosted wording's own meaning
  (download links valid one hour, per-token registers, no PDF renderer on Workers).
- `node scripts/validate.mjs`: run 50, 951/951, the same pass count as the start of the loop.
- Contract rules re-checked against live `tools/list` for all 31 servers: 0 descriptions over
  220 characters, 0 file/URL tools missing the imperative opening, 0 with stray whitespace.
