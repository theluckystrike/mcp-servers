# INTEL_R13 -- 30 fresh freelancer/small-business tokens, empty-slot scoring, round 13

Measured 2026-09-06. Cap: 30 wall minutes, curl -s -m 15 inline, at most 60 registry
requests, no background jobs, no paid APIs.

## Method

One bounded `GET registry.modelcontextprotocol.io/v0/servers?search=<token>&limit=100`
per token, first page only, same style as INTEL_R6/R9/R10/R12. `count` = `metadata.count`
(raw row count, one row per stored version). `capped` = page full (100) with
`metadata.nextCursor`. `empty_slot_score = 100/(1+count)`. `fit` (0-1) = pairing with
the current 29-server suite (amortization, asset-register, bank-statement, barcode,
billing-docs, calendar, cash-book, clauses, currency, deposits, docx, expense-tracker,
image, invoice, kanban, office-suite, pdf, per-diem, petty-cash, price-tracker, quotes,
recurring, resume, spreadsheet, statement-of-account, time-tracker, timezone,
work-order, zip). `buildability` (0-1) = pure-TypeScript, no-network, no-paid-API
feasibility gate. `score = empty_slot_score x fit x buildability`.

Cross-checked all 30 tokens against docs/INTEL_R6.md, docs/INTEL_R9.md,
docs/INTEL_R10.md, docs/INTEL_R11.md, docs/INTEL_R12.md, and
mcp-registry-naming-ceiling.md's probed-token lists before probing. None of the 30
below repeat any earlier token: `booking-calendar` and `class-schedule` are distinct
from R9's `booking`; `timesheet-approval` differs from R9's `timesheet`;
`expense-claim`/`reimbursement` differ from R9's `expense-report`; `snag-list` and
`punch-list` differ from R12's `snagging`; `incident-report` differs from R10's
`incident`; `per-client-budget` differs from R10's `budget-vs-actual` and R12's
`project-budget`.

## 30 fresh tokens probed

| token | count | capped | fit | buildability | score | decision |
|---|---|---|---|---|---|---|
| **change-order** | 0 | no | 0.8 | 0.85 | **68.0** | **BUILD** |
| **delivery-schedule** | 0 | no | 0.65 | 0.85 | **55.25** | **BUILD** |
| **equipment-loan** | 0 | no | 0.65 | 0.85 | **55.25** | **BUILD** |
| **punch-list** | 0 | no | 0.65 | 0.85 | **55.25** | **BUILD** |
| **per-client-budget** | 0 | no | 0.65 | 0.8 | **52.0** | **BUILD** |
| attendance | 0 | no | 0.6 | 0.85 | 51.0 | no-build, ranked 6th-adjacent |
| snag-list | 0 | no | 0.6 | 0.85 | 51.0 | no-build, ranked 6th-adjacent, near-dup of R12 snagging |
| timesheet-approval | 0 | no | 0.65 | 0.75 | 48.75 | no-build, ranked below top 5 |
| inspection | 0 | no | 0.6 | 0.8 | 48.0 | no-build |
| procedure | 0 | no | 0.55 | 0.85 | 46.75 | no-build |
| onboarding-checklist | 0 | no | 0.55 | 0.85 | 46.75 | no-build |
| key-register | 0 | no | 0.55 | 0.85 | 46.75 | no-build |
| deliverable | 0 | no | 0.6 | 0.75 | 45.0 | no-build |
| class-schedule | 0 | no | 0.55 | 0.8 | 44.0 | no-build |
| risk-register | 0 | no | 0.55 | 0.8 | 44.0 | no-build |
| expense-claim | 0 | no | 0.5 | 0.85 | 42.5 | no-build, overlaps expense-tracker |
| reimbursement | 0 | no | 0.5 | 0.85 | 42.5 | no-build, overlaps expense-tracker/per-diem |
| hours-cap | 0 | no | 0.55 | 0.75 | 41.25 | no-build |
| booking-calendar | 0 | no | 0.5 | 0.8 | 40.0 | no-build, overlaps existing calendar server |
| offboarding | 0 | no | 0.5 | 0.8 | 40.0 | no-build |
| visitor-log | 0 | no | 0.45 | 0.85 | 38.25 | no-build, off-thesis (facilities) |
| near-miss | 0 | no | 0.45 | 0.8 | 36.0 | no-build, off-thesis (safety compliance) |
| overrun | 0 | no | 0.45 | 0.65 | 29.25 | no-build, generic/ambiguous |
| sign-off | 1 | no | 0.7 | 0.85 | 29.75 | no-build, variant candidate |
| milestone | 1 | no | 0.75 | 0.85 | 31.875 | no-build, variant candidate |
| variation | 0 | no | 0.4 | 0.6 | 24.0 | no-build, generic/ambiguous |
| acceptance | 2 | no | 0.7 | 0.85 | 19.83 | no-build, variant candidate |
| checklist | 5 | no | 0.7 | 0.9 | 10.5 | no-build, variant candidate |
| incident-report | 11 | no | 0.5 | 0.8 | 3.33 | no-build, off-thesis, single-publisher heavy |
| sop | 61 | no | -- | -- | -- | excluded, noisy substring |

## Excluded noisy tokens

One token returned zero usable signal, same failure mode as prior rounds' `rma`/
`rota`/`shift`/`wip`:

- **sop** (61, not capped): dominated by substring collisions on `sophon`
  (`consulting.sophon/sophon-consulting`) and `autosophia` (`io.autosophia/*`, 4 of
  the top 5 rows) -- zero genuine standard-operating-procedure servers on page 1.

## Top 5 by score, with build/no-build decision

Decision rule: build only if count < 20 AND fit > 0.6 AND buildability > 0.7.

1. **change-order** (count 0, fit 0.8, buildability 0.85, score 68.0) -- **BUILD**.
   Pure-TS change-order / variation-order generator for trades and contractors: link
   to an original quote or work-order, itemized scope change, price delta, client
   approval field, PDF export reusing the quotes/invoice template engine; no network
   calls.
2. **delivery-schedule** (count 0, fit 0.65, buildability 0.85, score 55.25) --
   **BUILD**. Pure-TS delivery/appointment schedule builder: recurring or one-off
   delivery slots, address and time window, status tracking, calendar-format export;
   no network calls, pairs with the calendar server.
3. **equipment-loan** (count 0, fit 0.65, buildability 0.85, score 55.25) --
   **BUILD**. Pure-TS equipment loan/checkout tracker: item reference, borrower,
   loan and due-back dates, condition notes at checkout/return, overdue flagging; no
   network calls, pairs directly with asset-register (which holds the asset record).
4. **punch-list** (count 0, fit 0.65, buildability 0.85, score 55.25) -- **BUILD**.
   Pure-TS punch-list / defect-list generator for construction and renovation
   handover: itemized defect with location and trade, photo-reference field, status
   (open/fixed/verified), client sign-off PDF; no network calls, pairs with
   work-order and maintenance-log.
5. **per-client-budget** (count 0, fit 0.65, buildability 0.8, score 52.0) --
   **BUILD**. Pure-TS per-client project budget tracker: budget ceiling per client
   or engagement, running spend roll-up from logged time/expenses, remaining-balance
   alert threshold; no network calls, pairs with time-tracker and expense-tracker.

Two more cleared or nearly cleared the build-score range but are recorded no-build by
rank: **attendance** (51.0, ranked 6th) and **snag-list** (51.0, ranked 6th-adjacent,
also substantially overlapping R12's `snagging`, which was itself recorded no-build).

## Variant candidates for existing servers, uncapped tokens (count < 100)

| token | count | existing server |
|---|---|---|
| milestone | 1 | invoice / quotes |
| sign-off | 1 | invoice / clauses |
| acceptance | 2 | quotes / clauses |
| checklist | 5 | docx / office-suite |
| incident-report | 11 | billing-docs (weak fit, off-thesis) |

`booking-calendar`, `class-schedule`, `expense-claim`, `reimbursement`,
`onboarding-checklist`, `offboarding`, `key-register`, `visitor-log`, `deliverable`,
`inspection`, `procedure`, `hours-cap`, `overrun`, `variation`, `near-miss` and
`risk-register` are all zero-count but scored below the top 5 on fit/buildability and
are recorded no-build rather than variant candidates (no existing server to attach the
name to with nonzero overlap).

## Failures / caveats

- None of the 30 probes timed out or errored; all 30 returned on the first
  `curl -s -m 15` (30 registry GETs total, well inside the 60-request budget).
- `count` remains `metadata.count`, a raw row count including one row per stored
  version of the same server name, consistent with R6-R12's convention.
- `expense-claim` and `reimbursement` both scored inside striking distance of the top
  5 but were deliberately fit-capped at 0.5 because they substantially duplicate the
  existing `expense-tracker` server's job rather than opening a genuinely empty slot.
- `sign-off` and `milestone` are the second round in a row (after R12's `job-card`,
  R10's `break-even`) where a token lands just under the top-5 cutoff on score while
  independently clearing the strict build gate on its own merits -- both are recorded
  as variant candidates for `invoice`/`quotes`/`clauses` rather than fresh builds,
  since a nonzero-count server already exists to extend.

## Files

- `data/intel_r13.json` (all 30 probes, scores, top 5, variant candidates)
- `docs/INTEL_R13.md` (this file)

## RESULT.md schema block

```
status: DONE
evidence: 30 bounded registry GETs (search=<token>&limit=100, curl -s -m 15) against
  tokens confirmed absent from every prior INTEL/NAMING round's probed-token list. 29
  of 30 scored on empty_slot_score x fit x buildability; 1 (sop) excluded as
  substring-collision noise, same failure mode as earlier rounds' rma/rota/shift/wip.
  Top 5 by score all independently clear the build gate (count < 20, fit > 0.6,
  buildability > 0.7): change-order (68.0), delivery-schedule (55.25),
  equipment-loan (55.25), punch-list (55.25), per-client-budget (52.0). 5 additional
  uncapped tokens (count < 100) listed as free-variant candidates for existing
  servers rather than new builds.
artifacts: docs/INTEL_R13.md, data/intel_r13.json
cost: well under 30 wall minutes; 30 registry GETs total (curl -s -m 15, sequential,
  no background jobs); zero paid APIs; zero paid submissions
failures: none; all 30 probes returned data on first try, no timeouts
insight: this round's empty-slot cluster is a construction/contracting document kit
  distinct from R12's field-service kit -- change-order, punch-list and
  equipment-loan cover the scope-change, handover-defect and asset-checkout stages of
  a project lifecycle, while delivery-schedule and per-client-budget serve
  scheduling and per-engagement budget control for any freelancer, not just trades.
  The round also reconfirms the naming-ceiling pattern: the one short ambiguous
  token tried (sop) collided with unrelated substrings (sophon, autosophia) rather
  than surfacing real competitors, and the vocabulary that keeps yielding fresh
  zero-count slots is compound, domain-specific two-word phrasing (change-order,
  punch-list, equipment-loan) rather than single generic English words, which are
  now almost entirely exhausted or noisy.
```
