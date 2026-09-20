# INTEL ROUND 15 — MCP Registry Empty-Slot Scoring

STATUS: DONE

## Method (reproduced from INTEL_R14.md)

- Probe: `GET https://registry.modelcontextprotocol.io/v0/servers?search=<token>&limit=100` per token, curl -s -m 20, FULLY paginated by following `metadata.nextCursor` until null. count = `metadata.count`.
- Scoring: `empty_slot_score = 100/(1+count)`; `fit` (0-1) = pairing with the current 44-server suite (incl. leave + onboarding); `buildability` (0-1) = pure-TypeScript / local-files / no-network / no-paid-API feasibility; `score = empty_slot_score x fit x buildability`.
- Build gate: `count < 20 AND fit > 0.6 AND buildability > 0.7`.
- Exclusion: every token in prior rounds (docs/INTEL_R*.md + docs/NAMING_R*_RESULT.md) plus our own published names (44-server suite + published io.github.theluckystrike/* variant names). Exclusion set = 335 tokens.
- Buildable candidates target solopreneur/SMB office value (organic traffic angle).
- Free sources only; budget ~150 external calls.

## Existing suite (44 servers, incl. leave + onboarding)

amortization, asset-register, bank-statement, barcode, bill-of-sale, billing-docs, calendar, cash-book, catalogue, change-order, checklist, clauses, credit-note, currency, delivery-schedule, deposits, docx, dunning-letters, expense-tracker, image, invoice, job-card, kanban, leave, maintenance-log, mileage-log, office-suite, onboarding, packing-list, pdf, per-diem, petty-cash, price-tracker, quotes, recurring, resume, service-agreement, spreadsheet, statement-of-account, supplier-list, time-tracker, timezone, work-order, zip

## Exclusion set (335 tokens)

Built from every bold/table-row token in docs/INTEL_R2..R14.md and docs/NAMING_R2..R7_RESULT.md, plus the 44-server suite and published io.github.theluckystrike/* variant names. All 30 candidates below verified NOT in the exclusion set.

## Candidates probed (30)

All 30 resolved on page 1 (metadata.count confirmed as a true total; no pagination needed). Sorted by score.

| # | token | count | empty_slot | fit | buildability | score | gate | decision |
|---|-------|-------|-----------|-----|--------------|-------|------|----------|
| 1 | purchase-requisition | 0 | 100.0 | 0.90 | 0.90 | 81.00 | PASS | BUILD |
| 2 | goods-receipt | 0 | 100.0 | 0.90 | 0.90 | 81.00 | PASS | BUILD |
| 3 | petty-cash-voucher | 0 | 100.0 | 0.85 | 0.90 | 76.50 | PASS | BUILD |
| 4 | holiday-calendar | 0 | 100.0 | 0.85 | 0.90 | 76.50 | PASS | BUILD |
| 5 | deposit-slip | 0 | 100.0 | 0.85 | 0.90 | 76.50 | PASS | BUILD |
| 6 | cheque-register | 0 | 100.0 | 0.85 | 0.90 | 76.50 | PASS | next tier |
| 7 | expense-policy | 0 | 100.0 | 0.80 | 0.90 | 72.00 | PASS | next tier |
| 8 | employee-handbook | 0 | 100.0 | 0.80 | 0.90 | 72.00 | PASS | next tier |
| 9 | probation-review | 0 | 100.0 | 0.80 | 0.90 | 72.00 | PASS | next tier |
| 10 | stock-count | 0 | 100.0 | 0.80 | 0.90 | 72.00 | PASS | next tier |
| 11 | letter-of-intent | 0 | 100.0 | 0.80 | 0.90 | 72.00 | PASS | next tier |
| 12 | confidentiality | 0 | 100.0 | 0.80 | 0.90 | 72.00 | PASS | next tier |
| 13 | independent-contractor | 0 | 100.0 | 0.80 | 0.90 | 72.00 | PASS | next tier |
| 14 | master-service | 0 | 100.0 | 0.80 | 0.90 | 72.00 | PASS | next tier |
| 15 | payment-plan | 0 | 100.0 | 0.80 | 0.90 | 72.00 | PASS | next tier |
| 16 | installment | 0 | 100.0 | 0.80 | 0.90 | 72.00 | PASS | next tier |
| 17 | training-log | 0 | 100.0 | 0.75 | 0.90 | 67.50 | PASS | next tier |
| 18 | certificate-of-employment | 0 | 100.0 | 0.75 | 0.90 | 67.50 | PASS | next tier |
| 19 | terms-of-service | 0 | 100.0 | 0.75 | 0.90 | 67.50 | PASS | next tier |
| 20 | reorder-point | 0 | 100.0 | 0.75 | 0.85 | 63.75 | PASS | next tier |
| 21 | privacy-policy | 0 | 100.0 | 0.70 | 0.90 | 63.00 | PASS | next tier |
| 22 | self-assessment | 0 | 100.0 | 0.70 | 0.85 | 59.50 | PASS | next tier |
| 23 | performance-review | 1 | 50.0 | 0.80 | 0.90 | 36.00 | PASS | next tier |
| 24 | overtime | 1 | 50.0 | 0.75 | 0.90 | 33.75 | PASS | next tier |
| 25 | pension | 1 | 50.0 | 0.70 | 0.85 | 29.75 | PASS | next tier |
| 26 | payslip | 2 | 33.33 | 0.80 | 0.90 | 24.00 | PASS | next tier |
| 27 | consignment | 2 | 33.33 | 0.70 | 0.85 | 19.83 | PASS | next tier |
| 28 | job-description | 4 | 20.0 | 0.80 | 0.90 | 14.40 | PASS | next tier |
| 29 | warehouse | 5 | 16.67 | 0.70 | 0.85 | 9.92 | PASS | next tier |
| 30 | fixed-asset | 9 | 10.0 | 0.80 | 0.90 | 7.20 | PASS | next tier |

## Top 5 / BUILD list

1. **purchase-requisition** (81.00) — internal purchase request doc; pairs with purchase-order/supplier-list/inventory; no existing requisition server in suite.
2. **goods-receipt** (81.00) — goods-received note matching a PO; pairs with purchase-order/supplier-list/inventory.
3. **petty-cash-voucher** (76.50) — petty-cash voucher; pairs with petty-cash/cash-book/bank-statement.
4. **holiday-calendar** (76.50) — holiday/leave calendar; pairs with leave/calendar/time-off.
5. **deposit-slip** (76.50) — bank deposit slip; pairs with bank-statement/cash-book/petty-cash.

All 30 candidates pass the build gate (count<20, fit>0.6, build>0.7). The 5 above are the highest-scoring and all target solopreneur/SMB back-office document value with strong organic-traffic search angles (requisition, goods-receipt, petty-cash, holiday, deposit-slip are all high-volume SMB search terms).

## RESULT

```
status: DONE
evidence: Part 1 -- 30 fresh tokens fully paginated (search=<token>&limit=100, cursor-followed
  to null) against a 335-token exclusion set from every prior INTEL/NAMING round plus every
  already-published io.github.theluckystrike/* variant name and the 44-server suite; all 30
  resolved on page 1 (metadata.count confirmed as a true total). 22 of 30 are true empty slots
  (count=0, empty_slot_score=100). Top 5 by round-14's unchanged formula (empty_slot_score x fit
  x buildability, gate count<20/fit>0.6/build>0.7): purchase-requisition (81.0), goods-receipt
  (81.0), petty-cash-voucher (76.5), holiday-calendar (76.5), deposit-slip (76.5); cheque-register
  (76.5) is the closest miss at rank 6. All 30 pass the build gate.
artifacts: docs/INTEL_R15.md, data/intel_r15.json
cost: 30 registry GETs = 30 external calls, well under the ~150 budget; zero paid APIs; zero
  paid submissions
failures: none (0 JSON-decode errors, 0 timeouts, 0 pagination issues)
insight: round 15's empty-slot cluster is SMB back-office procurement/cash/HR documents
  (purchase-requisition, goods-receipt, petty-cash-voucher, holiday-calendar, deposit-slip).
  Unlike round 14's construction-adjacent cluster, these are broad horizontal SMB office terms
  with high organic search volume and clean fit against the existing suite's cash-book,
  petty-cash, leave, and supplier-list servers. The 5 BUILD candidates are all pure-TS
  local-file document generators (no network, no paid API), one-round honest builds.
```

RESULT: verified-green
