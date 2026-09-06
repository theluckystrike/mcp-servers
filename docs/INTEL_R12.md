# INTEL_R12 -- 30 fresh freelancer/small-business tokens, empty-slot scoring, round 12

Measured 2026-09-06. Cap: 30 wall minutes, curl -s -m 15 inline, at most 60 registry
requests, no background jobs, no paid APIs.

## Method

One bounded `GET registry.modelcontextprotocol.io/v0/servers?search=<token>&limit=100`
per token, first page only, same style as INTEL_R6/R9/R10. `count` = `metadata.count`
(raw row count, one row per stored version). `capped` = page full (100) with
`metadata.nextCursor`. `empty_slot_score = 100/(1+count)`. `fit` (0-1) = pairing with
the current 28-server suite (amortization, asset-register, bank-statement, barcode,
billing-docs, calendar, cash-book, clauses, currency, deposits, docx, expense-tracker,
image, invoice, kanban, office-suite, pdf, per-diem, petty-cash, price-tracker, quotes,
recurring, resume, spreadsheet, statement-of-account, time-tracker, timezone, zip).
`buildability` (0-1) = pure-TypeScript, no-network, no-paid-API feasibility gate.
`score = empty_slot_score x fit x buildability`.

Cross-checked all 30 tokens against docs/INTEL_R6.md, docs/INTEL_R9.md,
docs/INTEL_R10.md, docs/INTEL_R11.md and NAMING_R5's probed-token lists before probing.
None of the 30 below repeat any earlier token: `job-card`, `service-report`,
`maintenance-log` and `warranty-claim` are distinct from R9's `timesheet`, `retainer`
and `warranty`; `retainer-hours` differs from R9's `retainer`; `project-budget` differs
from R10's `budget-vs-actual` and R6's `budget`; `price-list` differs from the
`price-tracker` server name and R6's `quotes` probe.

## 30 fresh tokens probed

| token | count | capped | fit | buildability | score | decision |
|---|---|---|---|---|---|---|
| **work-order** | 0 | no | 0.85 | 0.9 | **76.5** | **BUILD** |
| job-card | 0 | no | 0.6 | 0.85 | 51.0 | no-build, fit exactly 0.6 fails strict gate; overlaps work-order |
| service-report | 0 | no | 0.75 | 0.85 | 63.75 | qualifies, ranked 4th |
| maintenance-log | 0 | no | 0.7 | 0.9 | 63.0 | qualifies, ranked 5th |
| warranty-claim | 0 | no | 0.65 | 0.75 | 48.75 | no-build, ranked below top 5 |
| rma | 100 | yes | -- | -- | -- | excluded, noisy substring |
| returns | 3 | no | 0.4 | 0.6 | 6.0 | no-build, ambiguous vs tax returns |
| restocking | 0 | no | 0.45 | 0.6 | 27.0 | no-build |
| backorder | 0 | no | 0.4 | 0.55 | 22.0 | no-build |
| **price-list** | 0 | no | 0.8 | 0.9 | **72.0** | **BUILD** |
| **rate-card** | 0 | no | 0.8 | 0.9 | **72.0** | **BUILD** |
| sla-credit | 0 | no | 0.55 | 0.85 | 46.75 | no-build |
| retainer-hours | 0 | no | 0.65 | 0.85 | 55.25 | no-build, ranked 7th |
| time-off | 0 | no | 0.55 | 0.85 | 46.75 | no-build |
| rota | 2 | no | -- | -- | -- | excluded, noisy substring |
| shift | 48 | no | -- | -- | -- | excluded, single-publisher noise |
| commission | 1 | no | 0.75 | 0.9 | 33.75 | no-build, variant candidate |
| royalty | 3 | no | 0.7 | 0.85 | 14.875 | no-build, variant candidate |
| licence-fee | 0 | no | 0.55 | 0.8 | 44.0 | no-build |
| affiliate | 8 | no | 0.5 | 0.6 | 3.33 | no-build, variant candidate |
| referral | 5 | no | 0.5 | 0.6 | 5.0 | no-build, variant candidate |
| gift-aid | 0 | no | 0.4 | 0.75 | 30.0 | no-build, off-thesis (UK charity tax relief) |
| donation | 1 | no | 0.35 | 0.7 | 12.25 | no-build, off-thesis |
| grant-report | 0 | no | 0.35 | 0.6 | 21.0 | no-build, off-thesis |
| cost-centre | 0 | no | 0.6 | 0.75 | 45.0 | no-build |
| project-budget | 0 | no | 0.7 | 0.8 | 56.0 | no-build, ranked 6th |
| wip | 13 | no | -- | -- | -- | excluded, noisy substring |
| retention | 9 | no | 0.5 | 0.7 | 3.5 | no-build, variant candidate |
| snagging | 0 | no | 0.5 | 0.85 | 42.5 | no-build |
| handover | 5 | no | 0.45 | 0.85 | 6.375 | no-build, variant candidate |

## Excluded noisy tokens

Four tokens returned 0 usable signal, same failure mode as prior rounds' `po`/`stock`/
`aging`/`dso`/`sla`:

- **rma** (100, capped): substring collisions on `norma`, `wfirma`, `mermail`,
  `dealermax` -- zero genuine returns-merchandise-authorization servers on page 1.
- **rota** (2): a surname (Sirota) and `frotas` (Portuguese "fleets") substring
  collisions -- zero real staff-scheduling hits.
- **shift** (48, not capped): dominated entirely by one publisher's repeated versions
  (`com.shiftinbits/constellation`, 9 of the top 10 rows) -- not shift-scheduling
  servers, so treated as a single noisy source rather than real coverage.
- **wip** (13): `wiplash`, `swipe`/`swiper`/`swipa` substring collisions -- zero real
  work-in-progress accounting hits.

## Top 5 by score, with build/no-build decision

Decision rule: build only if count < 20 AND fit > 0.6 AND buildability > 0.7.

1. **work-order** (count 0, fit 0.85, buildability 0.9, score 76.5) -- **BUILD**.
   Pure-TS work-order generator for trade/repair/service freelancers: job description,
   parts/labor line items, customer sign-off field, status (open/in-progress/complete),
   PDF export reusing the invoice template engine; no network calls, converts directly
   to invoice.
2. **price-list** (count 0, fit 0.8, buildability 0.9, score 72.0) -- **BUILD**.
   Pure-TS price-list / catalog generator: SKU or service line, tiered pricing,
   currency-aware formatting (pairs with the currency server), PDF and CSV export; no
   network calls, feeds directly into quotes and invoice.
3. **rate-card** (count 0, fit 0.8, buildability 0.9, score 72.0) -- **BUILD**. Pure-TS
   freelancer/agency rate-card builder: role or service tiers, hourly/day/project
   rates, validity window, client-facing PDF; no network calls, shares the quotes/
   invoice template pipeline and pairs with time-tracker's logged rates.
4. **service-report** (count 0, fit 0.75, buildability 0.85, score 63.75) -- **BUILD**.
   Pure-TS field-service completion report: site/asset reference, work performed,
   parts used, time on site, customer signature block, PDF export; no network calls,
   pairs with work-order and maintenance-log as a three-part field-service kit.
5. **maintenance-log** (count 0, fit 0.7, buildability 0.9, score 63.0) -- **BUILD**.
   Pure-TS equipment/asset maintenance history log: dated service entries, next-due
   scheduling by interval, cost roll-up, export; no network calls, pairs with
   asset-register (which holds the asset) and service-report (which produces the
   entries).

Three more cleared or nearly cleared the build-score range but are recorded no-build
either by rank or by gate: **project-budget** (56.0, ranked 6th), **retainer-hours**
(55.25, ranked 7th), and **job-card** (51.0, ranked 6th-adjacent but fit is exactly
0.6, failing the strict `fit > 0.6` gate -- it also substantially overlaps work-order,
which is the stronger and more general term of the two).

## Variant candidates for existing servers, uncapped tokens (count < 100)

| token | count | existing server |
|---|---|---|
| commission | 1 | invoice / quotes |
| royalty | 3 | invoice / quotes |
| returns | 3 | expense-tracker (weak fit, tax-returns ambiguity) |
| donation | 1 | billing-docs (off-thesis, low fit) |
| affiliate | 8 | invoice / recurring |
| referral | 5 | invoice / recurring |
| retention | 9 | billing-docs / invoice (construction retention) |
| handover | 5 | docx / office-suite |

`job-card`, `restocking`, `backorder`, `sla-credit`, `time-off`, `licence-fee`,
`gift-aid`, `grant-report`, `cost-centre`, `project-budget` and `snagging` are all
zero-count but scored below the top 5 on fit/buildability and are recorded no-build
rather than variant candidates (a variant candidate needs an existing server with
nonzero overlap to attach the name to; a zero-count token with no server to pair it to
is either a fresh build candidate or simply shelved).

## Failures / caveats

- None of the 30 probes timed out or errored; all 30 returned on the first
  `curl -s -m 15` (30 registry GETs total, well inside the 60-request budget).
- `count` remains `metadata.count`, a raw row count including one row per stored
  version of the same server name, consistent with R6-R10's convention.
- `job-card` is the second round in a row (after R10's `break-even`) where the top
  cluster's 6th-place token is excluded from the build list purely because its fit
  lands exactly at the 0.6 gate boundary rather than above it -- worth flagging if a
  future round wants to loosen the gate to `fit >= 0.6`.
- `gift-aid`, `donation` and `grant-report` are UK-charity/nonprofit terms that scored
  reasonably on empty-slot alone but were deliberately fit-capped low (0.35-0.4)
  because they sit outside the freelancer/small-business-for-profit thesis the other
  27 servers share.

## Files

- `data/intel_r12.json` (all 30 probes, scores, top 5, variant candidates)
- `docs/INTEL_R12.md` (this file)

## RESULT.md schema block

```
status: DONE
evidence: 30 bounded registry GETs (search=<token>&limit=100, curl -s -m 15) against
  tokens confirmed absent from every prior INTEL/NAMING round's probed-token list. 26
  of 30 scored on empty_slot_score x fit x buildability; 4 (rma, rota, shift, wip)
  excluded as substring-collision or single-publisher noise, same failure mode as
  earlier rounds' po/stock/aging/dso/sla. Top 5 by score all independently clear the
  build gate (count < 20, fit > 0.6, buildability > 0.7): work-order (76.5),
  price-list (72.0), rate-card (72.0), service-report (63.75), maintenance-log
  (63.0). 8 additional uncapped tokens (count < 100) listed as free-variant
  candidates for existing servers rather than new builds.
artifacts: docs/INTEL_R12.md, data/intel_r12.json
cost: well under 30 wall minutes; 30 registry GETs total (curl -s -m 15, sequential,
  no background jobs); zero paid APIs; zero paid submissions
failures: none; all 30 probes returned data on first try, no timeouts
insight: this round's empty-slot cluster is a field-service document kit --
  work-order, service-report and maintenance-log form a natural three-part flow
  (schedule the job, log the visit, track the asset history) that pairs with the
  existing invoice and asset-register servers, while price-list and rate-card are a
  matched pair for freelancers who need to publish pricing before quotes/invoice ever
  fires. The round also reconfirms the naming-ceiling pattern: every short ambiguous
  token tried (rma, rota, shift, wip) collided with unrelated substrings or a single
  noisy publisher rather than surfacing real competitors, meaning genuine empty slots
  keep showing up on compound, domain-specific two-word tokens rather than single
  words -- the vocabulary that is left to mine is increasingly UK/trade-specific
  terminology (snagging, retainer-hours, sla-credit, cost-centre) rather than generic
  English nouns.
```
