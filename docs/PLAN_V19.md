# Plan v19 (2026-09-05 late, loop 22): statements, month end, mirror retries

## Signals at the start
| Signal | Value | Read |
|---|---|---|
| Bundle downloads | 3,458 | +800 in four hours, the steepest run yet |
| Clicks 7d | 78; two .bundle sources now (a calendar product page and a time-tracker cap) | The bundle is reachable from where clicks come from |
| Sales | 0 | |
| PRs | Docker and four list PRs open, no comments | Wait |
| GSC | key dataless | Unmeasurable |
| Load | 35 (iCloud) | Three agents, per-step disk writes |

## Top 5, ranked by impact x autonomy
1. Build `statement-of-account`: per-client statement from the invoice, credit-note and deposit stores (opening balance, invoices, payments, credits, deposits applied, closing balance, aging buckets 0-30/31-60/61-90/90+), text and PDF via the invoice page renderer, a dunning text with the profile's bank details and a tone level; registry names statement-of-account and aging. Audit, wire (incl. PROFILE_READERS), host, content, catalogs, release v0.14.0.
2. sync-mirrors.sh: retry the GitHub topics call and the push up to three times on EOF; the wiring checklist in docs/RELEASE_CHECK.md gains PROFILE_READERS as a check the release checker enforces (grep readSharedProfile per server vs the invoice list).
3. Month-end guide: one worked month through invoices, a credit note, a deposit applied, a bank import reconciled, expenses, depreciation journal and a per-diem trip, every number from a real stdio run recorded as round 26.
4. Hosted round 25 single-lane on asset-register.
5. Variant names on the uncapped INTEL_R10 tokens where honest (fuel and parking and toll on expense-tracker: only one name per server, pick the one with the fewest results; loan: none honest; margin and discount on quotes if its tools compute them, else skip).
