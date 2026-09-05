# INTEL_R10 -- 30 fresh freelancer/small-business tokens, empty-slot scoring, round 10

Measured 2026-09-05. Cap: 30 wall minutes, curl -s -m 15 inline, at most 60 registry
requests, no background jobs, no paid APIs.

## Method

One bounded `GET registry.modelcontextprotocol.io/v0/servers?search=<token>&limit=100`
per token, first page only, same style as INTEL_R6/R9. `count` = `metadata.count` (raw
row count, one row per stored version). `capped` = page full (100) with
`metadata.nextCursor`. `empty_slot_score = 100/(1+count)`. `fit` (0-1) = pairing with the
current 22-server suite (bank-statement, barcode, billing-docs, calendar, clauses,
currency, deposits, docx, expense-tracker, image, invoice, kanban, office-suite, pdf,
per-diem, price-tracker, quotes, recurring, resume, spreadsheet, time-tracker, timezone,
zip; asset-register is being built). `buildability` (0-1) = pure-TypeScript, no-network,
no-paid-API feasibility gate. `score = empty_slot_score x fit x buildability`.

Cross-checked all 30 tokens against every prior round's probed-token list (R6, R7, R8,
R9, and NAMING_R5's already-probed tokens, listed in full in `data/intel_r10.json`
`already_probed_excluded`). None of the 30 below repeat any earlier token: `mileage-log`
differs from R6's `mileage`; `budget-vs-actual` differs from R6's `budget`;
`statement-of-account` differs from R6's `statement`; `payment-reminder` differs from
R9's `reminder`.

## 30 fresh tokens probed

| token | count | capped | fit | buildability | score | decision |
|---|---|---|---|---|---|---|
| mileage-log | 0 | no | 0.35 | 0.85 | 29.75 | no-build, redundant with expense-tracker's existing mileage coverage |
| fuel | 7 | no | 0.55 | 0.75 | 4.64 | no-build, variant candidate |
| parking | 2 | no | 0.4 | 0.6 | 8.0 | no-build, variant candidate |
| toll | 49 | no | 0.4 | 0.6 | 0.48 | no-build, noisy-ish (mostly x402/crypto "toll" servers) |
| receipt-scan | 0 | no | 0.5 | 0.4 | 20.0 | no-build, OCR heavy lift |
| **cash-book** | 0 | no | 0.85 | 0.9 | **76.5** | **BUILD** |
| **petty-cash** | 0 | no | 0.8 | 0.9 | **72.0** | **BUILD** |
| loan | 9 | no | 0.6 | 0.9 | 5.4 | no-build, variant candidate |
| **amortization** | 0 | no | 0.75 | 0.95 | **71.25** | **BUILD** |
| interest | -- | -- | -- | -- | -- | excluded, noisy (Pinterest substring) |
| late-fee | 0 | no | 0.7 | 0.9 | 63.0 | qualifies but ranked 6th, no-build (cap at 5) |
| dunning | 0 | no | 0.75 | 0.85 | **63.75** | **BUILD** |
| payment-reminder | 0 | no | 0.5 | 0.85 | 42.5 | no-build, overlaps recurring + dunning |
| **statement-of-account** | 0 | no | 0.8 | 0.85 | **68.0** | **BUILD** |
| aging | 100 | yes | -- | -- | -- | excluded, noisy (imaging/staging/paging) |
| dso | 100 | yes | -- | -- | -- | excluded, noisy (name-substring collisions) |
| cashflow-forecast | 0 | no | 0.6 | 0.6 | 36.0 | no-build |
| budget-vs-actual | 0 | no | 0.55 | 0.8 | 44.0 | no-build |
| break-even | 0 | no | 0.6 | 0.95 | 57.0 | no-build, fails strict fit>0.6 gate on a technicality |
| margin | 8 | no | 0.65 | 0.95 | 6.86 | no-build, variant candidate |
| markup | 5 | no | 0.5 | 0.9 | 7.5 | no-build, semi-ambiguous term |
| discount | 3 | no | 0.6 | 0.9 | 13.5 | no-build, variant candidate |
| coupon | 1 | no | 0.55 | 0.85 | 23.375 | no-build, overlaps discount |
| gift-card | 0 | no | 0.45 | 0.85 | 38.25 | no-build |
| voucher | 0 | no | 0.55 | 0.9 | 49.5 | no-build |
| membership | 0 | no | 0.5 | 0.85 | 42.5 | no-build |
| subscription-box | 0 | no | 0.3 | 0.5 | 15.0 | no-build, off-thesis |
| sla | 100 | yes | -- | -- | -- | excluded, noisy (name-substring collisions) |
| uptime | 29 | no | 0.2 | 0.2 | 0.13 | no-build, off-thesis, needs network |
| incident | 24 | no | 0.2 | 0.5 | 0.4 | no-build, off-thesis |

## Excluded noisy tokens

Four tokens returned 0 usable signal: page-1 results were entirely unrelated name
collisions on the raw substring, same failure mode as R9's `po`/`stock`.

- **interest** (0 useful hits of 10): every result is a "Pinterest" substring match
  (pinterest-ads, pinterest-mcp, pinterest-brand-presence-mapper).
- **aging** (100, capped): imaging/staging/paging/messaging substring collisions
  (CAST-Extend/imaging-mcp-server, alpic-poc-staging, whatsapp-messaging).
- **dso** (100, capped): name-substring collisions (dsouzaAnush, dvdsosa, edsonvmendes,
  foxdavidson).
- **sla** (100, capped): name-substring collisions (islamic-knowledge, translate,
  acquislaw, smithery-ai-slack).

`toll` (49, not capped) is borderline: spot-checking page 1 shows most hits are x402/
crypto payment-gateway servers using "toll" as a metaphor (tollbooth-x402, tollmint,
snaptoll), not toll-road expense tools -- kept in the scored table since it returned
data, but flagged as weak signal and scored low on fit as a result.

## Top 5 by score, with build/no-build decision

Decision rule: build only if count < 20 AND fit > 0.6 AND buildability > 0.7.

1. **cash-book** (count 0, fit 0.85, buildability 0.9, score 76.5) -- **BUILD**.
   Pure-TS cash-book / general ledger for freelancers and small businesses: dated
   debit/credit entries, running balance, category tags, monthly close and export; no
   network calls, pairs with expense-tracker and invoice.
2. **petty-cash** (count 0, fit 0.8, buildability 0.9, score 72.0) -- **BUILD**.
   Pure-TS petty-cash fund tracker: opening float, itemized disbursements with receipt
   references, reconciliation to a target float, replenishment log; no network calls,
   pairs with cash-book and expense-tracker.
3. **amortization** (count 0, fit 0.75, buildability 0.95, score 71.25) -- **BUILD**.
   Pure-TS loan/asset amortization schedule generator: principal, rate, term in; full
   period-by-period schedule (principal/interest/balance) out via static formulas; no
   network calls, pairs with asset-register depreciation and the per-diem finance
   bundle.
4. **statement-of-account** (count 0, fit 0.8, buildability 0.85, score 68.0) --
   **BUILD**. Pure-TS client statement-of-account generator: rolls up an invoice/
   payment/credit-note history for one client into a running-balance statement PDF,
   reusing the invoice server's template/PDF engine; no network calls.
5. **dunning** (count 0, fit 0.75, buildability 0.85, score 63.75) -- **BUILD**. Pure-TS
   dunning/collections letter sequence generator: staged reminder-to-formal-notice
   templates keyed off invoice due-date and overdue-days thresholds, reusing the docx/
   invoice template engine; no network calls.

One more cleared the build gate on its own numbers but ranked 6th and is recorded as
no-build only because the brief caps the list at 5: **late-fee** (score 63.0, count 0,
fit 0.7, buildability 0.9) -- a legitimate next-round candidate. **break-even** scored
higher (57.0) but its fit is exactly 0.6, which fails the strict `fit > 0.6` gate, so it
is recorded no-build on a technicality rather than a 6th qualifier.

## Variant candidates for existing servers, uncapped tokens (count < 100)

Tokens where an honest existing server could add a free additional registry name
(same rule as R6/R9's variant-naming rounds), not full new servers:

| token | count | existing server |
|---|---|---|
| fuel | 7 | expense-tracker |
| parking | 2 | expense-tracker |
| toll | 49 | expense-tracker |
| loan | 9 | per-diem / asset-register (amortization spec above covers this better standalone) |
| margin | 8 | quotes / invoice |
| discount | 3 | invoice / quotes |

`mileage-log`, `payment-reminder` and `coupon` are recorded as redundant folds into
existing coverage (mileage on expense-tracker, reminder/dunning on recurring, discount
on the discount slot above) rather than standalone variant candidates.

## Failures / caveats

- None of the 30 probes timed out or errored; all returned on the first `curl -s -m 15`.
- `count` remains `metadata.count`, a raw row count including one row per stored version
  of the same server name, consistent with R6-R9's convention.
- `receipt-scan` scored 20.0 on the formula (0 results, real freelance-workflow demand)
  but is held out of the top 5 on a deliberately conservative buildability call (0.4):
  pure-JS OCR via a bundled tesseract.js/wasm build is technically no-network, but the
  bundle size and accuracy tradeoffs make it a heavier and riskier build than the five
  picked, which are all closed-form math or template generation.
- `break-even` is the one token this round whose score (57.0) clears every other
  server's top-5 threshold from R6/R9 but is excluded by the strict `fit > 0.6` decision
  rule on a fit score of exactly 0.6 -- worth re-scoring at 0.65+ next round if the
  suite gains a dedicated pricing/quotes-adjacent server that raises its pairing value.

## Files

- `data/intel_r10.json` (all 30 probes, scores, top 5, variant candidates)
- `docs/INTEL_R10.md` (this file)

## RESULT.md schema block

```
status: DONE
evidence: 30 bounded registry GETs (search=<token>&limit=100, curl -s -m 15, 20s
  budget each) against tokens confirmed absent from every prior INTEL/NAMING round's
  probed-token list. 26 of 30 scored on empty_slot_score x fit x buildability; 4
  (interest, aging, dso, sla) excluded as ambiguous short-substring name-collision
  noise, same failure mode as R9's po/stock. Top 5 by score all independently clear
  the build gate (count < 20, fit > 0.6, buildability > 0.7): cash-book (76.5),
  petty-cash (72.0), amortization (71.25), statement-of-account (68.0), dunning
  (63.75). 6 additional uncapped tokens (count < 100) listed as free-variant
  candidates for existing servers rather than new builds.
artifacts: docs/INTEL_R10.md, data/intel_r10.json
cost: well under 30 wall minutes; 30 registry GETs total (curl -s -m 15, sequential,
  no background jobs); zero paid APIs; zero paid submissions
failures: none; all 30 probes returned data on first try, no timeouts
insight: this round's empty-slot cluster is small-business cash and collections
  bookkeeping, not new domains -- cash-book, petty-cash, amortization,
  statement-of-account and dunning all score above 60 because each is either a
  zero-competition slot (0 registry results) or a near-mirror of an engine we already
  ship (statement-of-account reuses invoice's PDF pipeline, dunning reuses docx's
  template engine, amortization is the loan-side twin of asset-register's
  depreciation math). The freelancer vocabulary explored this round (fuel, parking,
  loan, margin, markup, discount, coupon, gift-card, voucher, membership) mostly
  scored low not from lack of demand but from either real-world overlap with existing
  servers (fold-in candidates) or ambiguous/noisy registry substrings (interest,
  aging, dso, sla all collide with unrelated common-word names), confirming that
  clean new empty slots are getting harder to find as prior rounds capture the
  obvious terms.
```
