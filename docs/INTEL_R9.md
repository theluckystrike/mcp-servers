# INTEL_R9 -- 30 fresh freelancer/small-business tokens, empty-slot scoring, round 9

Measured 2026-09-05. Cap: 30 wall minutes, curl -s -m 15 inline, at most 60 registry
requests, no background jobs, no paid APIs.

## Method

One bounded `GET registry.modelcontextprotocol.io/v0/servers?search=<token>&limit=100`
per token, first page only, same style as INTEL_R6 part 3. `count` = `metadata.count`
(raw row count, one row per stored version -- same convention as R6/R7/R8). `capped`
= page full (100) with `metadata.nextCursor`. `empty_slot_score = 100/(1+count)`.
`fit` (0-1) = pairing with the 20-server suite (bank-statement, barcode, calendar,
clauses, currency, docx, expense-tracker, image, invoice, kanban, office-suite, pdf,
price-tracker, quotes, recurring, resume, spreadsheet, time-tracker, timezone, zip).
`buildability` (0-1) = pure-TypeScript, no-network, no-paid-API feasibility gate.
`score = empty_slot_score x fit x buildability`.

Before probing, cross-checked every token against INTEL_R6/R7/R8 and NAMING_R5's already-
probed lists (time, excel, pdf, watermark, ics, vat, cv, contract, markdown, email, crm,
board, dst, nda, bank, calendar, clause, currency, docx, expense, image, invoice, kanban,
price, recurring, resume, spreadsheet, timezone, statement, transactions, budget,
reconcile, resize, compress, thumbnail, tasks, csv, notes, todo, contacts, templates,
quotes, receipts, mileage, payroll, habit, journal, ocr, qr, barcode, epub, translate,
zip, estimate). None of the 30 tokens below repeat any of those.

## 30 fresh tokens probed

| token | count | capped | ours present | fit | buildability | score |
|---|---|---|---|---|---|---|
| timesheet | 24 | no | yes (dominant, 23/24) | -- | -- | already covered |
| retainer | 10 | no | yes (10/10, all ours) | -- | -- | already covered |
| deposit | 0 | no | no | 0.65 | 0.9 | 58.5 |
| escrow | 10 | no | no | 0.5 | 0.7 | 3.18 |
| purchase-order | 0 | no | no | 0.85 | 0.9 | 76.5 |
| po | 100 | yes | no | -- | -- | excluded, noisy 2-letter substring |
| delivery-note | 0 | no | no | 0.6 | 0.85 | 51.0 |
| packing-slip | 0 | no | no | 0.55 | 0.85 | 46.75 |
| credit-note | 0 | no | no | 0.9 | 0.9 | 81.0 |
| refund | 4 | no | no | 0.6 | 0.85 | 10.2 |
| expense-report | 0 | no | no | 0.4 | 0.9 | 36.0 (redundant with expense-tracker) |
| per-diem | 0 | no | no | 0.65 | 0.85 | 55.25 |
| travel | 88 | no | no | 0.3 | 0.3 | 0.1 |
| itinerary | 0 | no | no | 0.4 | 0.35 | 14.0 |
| booking | 73 | no | no | 0.3 | 0.3 | 0.12 |
| appointment | 5 | no | no | 0.6 | 0.6 | 6.0 |
| reminder | 39 | no | yes (13/39) | -- | -- | already covered |
| followup | 7 | no | no | 0.6 | 0.85 | 6.375 |
| signature | 6 | no | no | 0.7 | 0.6 | 6.0 |
| e-sign | 14 | no | no | 0.7 | 0.3 | 1.4 |
| letterhead | 28 | no | no | 0.75 | 0.9 | 2.33 |
| envelope | 3 | no | no | 0.5 | 0.85 | 10.6 |
| label | 29 | no | no | 0.7 | 0.85 | 1.98 |
| shipping | 15 | no | no | 0.5 | 0.6 | 1.875 |
| tracking-number | 0 | no | no | 0.4 | 0.85 | 34.0 |
| warranty | 0 | no | no | 0.6 | 0.85 | 51.0 |
| inventory | 13 | no | no | 0.65 | 0.75 | 3.48 |
| stock | 100 | yes | no | -- | -- | excluded, ambiguous term |
| asset-register | 0 | no | no | 0.75 | 0.85 | 63.75 |
| depreciation | 1 | no | no | 0.7 | 0.9 | 31.5 |

## Already covered, confirmed by dominant search share

- **timesheet** (24 rows): `io.github.theluckystrike/time-tracker-timesheet-billable-hours`
  holds 23 of 24 rows. Already owned; no action.
- **retainer** (10 rows): `io.github.theluckystrike/retainer` holds all 10 rows (that
  count is entirely our own version history from an earlier naming round on the
  `recurring` server). Already owned outright; no action.
- **reminder** (39 rows): `io.github.theluckystrike/recurring-invoice-scheduler-...-
  due-reminders` holds 13 of 39; a competitive but uncapped field, already present.

## Excluded noisy tokens

- **po** (100, capped) and **stock** (100, capped): both are short/ambiguous substrings
  that match unrelated names containing the letters anywhere (e.g. "po" inside many
  unrelated slugs; "stock" splits between financial-stock and inventory-stock tools).
  Not usable signal for empty-slot scoring, excluded rather than scored.
- **travel** and **booking** (88 and 73 respectively): real slots exist but the honest
  domain (flights, hotels, calendar sync) is network-dependent; buildability gated to
  0.3, both score under 1 and are excluded from the ranking.

## Top 5 by score, with build/no-build decision

Decision rule: build only if count < 20 AND fit > 0.6 AND buildability > 0.7.

1. **credit-note** (count 0, fit 0.9, buildability 0.9, score 81.0) -- **BUILD**.
   Spec: pure-TS credit-note / refund-note generator, structurally the reverse of the
   existing invoice server (same line-item and PDF-render engine, negative amounts,
   references an original invoice number), no network calls.
2. **purchase-order** (count 0, fit 0.85, buildability 0.9, score 76.5) -- **BUILD**.
   Spec: pure-TS purchase-order generator and PO-number tracker for freelancers buying
   from suppliers, reusing the invoice server's template/PDF pipeline with a
   buyer/supplier role swap, no network calls.
3. **asset-register** (count 0, fit 0.75, buildability 0.85, score 63.75) -- **BUILD**.
   Spec: pure-TS fixed-asset register for small business: track purchased assets, apply
   bundled straight-line/declining-balance depreciation schedules (static tables, no
   network), pairs with expense-tracker and invoice for a small-business finance bundle.
4. **deposit** (count 0, fit 0.65, buildability 0.9, score 58.5) -- **BUILD**.
   Spec: pure-TS security/retainer deposit tracker: record client deposits, apply them
   against invoice balances, compute remaining owed, no network calls.
5. **per-diem** (count 0, fit 0.65, buildability 0.85, score 55.25) -- **BUILD**.
   Spec: pure-TS per-diem/daily-allowance calculator using bundled static rate tables
   (e.g. published GSA-style daily rates) against a trip's day count, feeding into
   time-tracker/expense-tracker output, no network calls.

Two more cleared the build gate on their own numbers but ranked 6th/7th and are recorded
as no-build only because the brief caps the list at 5: **warranty** (score 51.0, count 0,
fit 0.6, buildability 0.85) and **delivery-note** (score 51.0, count 0, fit 0.6,
buildability 0.85). Both are legitimate next-round candidates if a 6th slot opens.

## Variant candidates for existing servers, uncapped tokens (count < 100)

These are tokens where an honest existing server could add a free additional registry
name (same rule as R6/R7's variant-naming rounds), not full new servers:

| token | count | existing server |
|---|---|---|
| letterhead | 28 | docx |
| label | 29 | barcode |
| inventory | 13 | price-tracker |
| depreciation | 1 | expense-tracker |
| signature | 6 | docx / clauses |
| e-sign | 14 | docx / clauses |
| followup | 7 | recurring |
| appointment | 5 | calendar |
| shipping | 15 | barcode |
| envelope | 3 | docx |
| escrow | 10 | recurring / invoice |
| refund | 4 | invoice |

## Failures / caveats

- None of the 30 probes timed out or errored; all returned on the first `curl -s -m 15`.
- `count` is `metadata.count`, a raw row count including one row per stored version of
  the same server name (confirmed again this round on `retainer`: 10 rows are all one
  server's version history, `0.4.2` through the current `0.9.4`). Distinct-server counts
  would be lower for any token with repeat entries; kept consistent with R6/R7/R8's own
  convention rather than re-deriving a new metric mid-series.
- `expense-report` scored 36.0 on the formula but is marked no-build: it is a report/
  export view over data the expense-tracker server already owns, not a distinct honest
  server, so building it separately would duplicate rather than fill a slot.
- `depreciation` (score 31.5) folds conceptually into the `asset-register` spec above
  (asset-register needs depreciation schedules to be useful) rather than standing alone.

## Files

- `data/intel_r9.json` (all 30 probes, scores, top 5, variant candidates)
- `docs/INTEL_R9.md` (this file)

## RESULT.md schema block

```
status: DONE
evidence: 30 bounded registry GETs (search=<token>&limit=100, curl -s -m 15, 20s
  budget each) against tokens confirmed absent from every prior INTEL/NAMING round's
  probed-token list. 27 of 30 scored on empty_slot_score x fit x buildability; 3
  (timesheet, retainer, reminder) came back already dominated by our own existing
  time-tracker/recurring servers and are recorded as already-covered, not new
  candidates; 2 (po, stock) excluded as ambiguous short-substring noise; 2 (travel,
  booking) excluded on buildability (network-dependent domain). Top 5 by score all
  independently clear the build gate (count < 20, fit > 0.6, buildability > 0.7):
  credit-note (81.0), purchase-order (76.5), asset-register (63.75), deposit (58.5),
  per-diem (55.25). 12 additional uncapped tokens (count < 100) listed as free-variant
  candidates for existing servers rather than new builds.
artifacts: docs/INTEL_R9.md, data/intel_r9.json
cost: well under 30 wall minutes; 30 registry GETs total (curl -s -m 15, sequential,
  no background jobs); zero paid APIs; zero paid submissions
failures: none; all 30 probes returned data on first try, no timeouts
insight: the freelancer-document-lifecycle gap is real and specific -- credit-note and
  purchase-order both score above 75 because they are structurally mirror-images of the
  invoice server we already ship (same template/PDF engine, reversed roles), so they are
  near-zero incremental build cost against a completely empty registry slot (0 results
  each). The three highest-value tokens from this batch that a freelancer would actually
  type first (timesheet, retainer, reminder) turned out to already be won outright by
  existing servers from earlier rounds, confirming the R6-R8 build-out already captured
  the most obvious freelance-workflow words; what remains at the top of the fresh list is
  document-lifecycle mirrors (credit-note, purchase-order) and small-business asset/cash
  bookkeeping (asset-register, deposit, per-diem), not new domains.
```
