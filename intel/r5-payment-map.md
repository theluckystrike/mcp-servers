# R5: Payment Map Audit

DATE: 2026-09-24
STATUS: COMPLETE — 10 checkout probes, 12 storefront pages, 5 registry rows audited. No budget spent on further probes.

Audit goal: verify every VISIBLY discoverable hosted server name maps to a working purchase path.

**Method**: All probes run with browser UA + `Origin: https://mcp.zovo.one` where applicable. Curl-based. Sampled 10 ids for checkout + 10 storefront pages + 5 registry rows across the catalogue. No sleeps/polls. READ-ONLY network probes; no purchases initiated.

## Source of truth (billing/src/index.js)
- PRODUCTS single ids (46): time-tracker, price-tracker, spreadsheet, invoice, expense-tracker, currency, docx, timezone, resume, recurring, clauses, calendar, pdf, image, bank-statement, kanban, quotes, barcode, zip, billing-docs, deposits, per-diem, asset-register, statement-of-account, cash-book, amortization, petty-cash, work-order, catalogue, change-order, delivery-schedule, packing-list, checklist, bill-of-sale, credit-note, job-card, dunning-letters, supplier-list, service-agreement, maintenance-log, mileage-log, onboarding, backlink-checker, goods-receipt, purchase-requisition, leave
- Also products: `bundle` + alias `office-suite`
- HOSTED_SERVERS (45): amortization, asset-register, bank-statement, barcode, bill-of-sale, billing-docs, calendar, cash-book, catalogue, change-order, checklist, clauses, credit-note, currency, deposits, delivery-schedule, docx, dunning-letters, expense-tracker, goods-receipt, image, invoice, job-card, kanban, leave, maintenance-log, mileage-log, onboarding, packing-list, pdf, per-diem, petty-cash, price-tracker, purchase-requisition, quotes, recurring, resume, service-agreement, spreadsheet, statement-of-account, supplier-list, time-tracker, timezone, work-order, zip

## Audit grid
| # | id | buy/<id> checkout (POST) | storefront /s/<id> | registry remote | registry websiteUrl | verdict |
|---|----|--------------------------|--------------------|-----------------|---------------------|---------|
| 1 | time-tracker | 303 ✓ | 200 ✓ | **MISSING** (stdio-only mcpb) | /buy/time-tracker | ⚠ registry lacks hosted remote; row DEPRECATED |
| 2 | credit-note | 303 ✓ | 200 ✓ | (not sampled) | — | ✓ |
| 3 | calendar | 303 ✓ | 200 ✓ | **MISSING** | **/s/timezone (wrong product)** | ⚠ no remote; websiteUrl points to timezone not calendar |
| 4 | asset-register | 303 ✓ | 200 ✓ | **remote ✓** mcp/asset-register | /s/asset-register | ✓ GREEN |
| 5 | leave | 303 ✓ | 200 ✓ | (not sampled) | — | ✓ |
| 6 | work-order | 303 ✓ | 200 ✓ | (not sampled) | — | ✓ |
| 7 | image | 303 ✓ | 200 ✓ | (not sampled) | — | ✓ |
| 8 | dunning-letters | 303 ✓ | 200 ✓ | **remote ✓** mcp/dunning-letters | /s/dunning-letters | ✓ GREEN |
| 9 | purchase-requisition | 303 ✓ | 200 ✓ | (not sampled) | — | ✓ |
| 10 | zip | 303 ✓ | 200 ✓ | **MISSING** (stdio-only mcpb) | /s/zip | ⚠ registry lacks hosted remote |
| 11 | bundle | 303 ✓ but → **/s/bundle = 404** | /s/bundle **404** (but /bundle = 200) | — | — | ✗ DEFECT: checkout redirect lands on 404 store page |
| 12 | office-suite (alias) | 303 ✓ | /s/office-suite 200 ✓ | — | — | ✓ (alias resolved) |

## Verified-Green Summary
- **All 10 sampled checkout POSTs** `/buy/<id>` return HTTP **303** (valid working checkout signal; no 404s/500s).
- **All 10 sampled storefront pages** `/s/<id>` return **200** for single-product ids sampled.
- **office-suite alias** resolves: both `/buy/office-suite` and `/s/office-suite` respond.
- **Registry rows with hosted remote + correct homepage** (asset-register, dunning-letters) are fully green in both signal AND discovery.

## DEFECTS / FLAWS FOUND
1. **[DEFECT] bundle checkout redirect target 404s.** `POST /buy/bundle` → 303 `location: https://mcp.zovo.one/s/bundle`, but `/s/bundle` returns **404**. The bundle's real store page lives at `/bundle` (200). The redirect must point to `/bundle`, not `/s/bundle`. This is a broken discoverable purchase landing for the flagship bundle product. `office-suite` alias works because it maps to its own fine path — but the canonical `bundle` name is broken post-checkout.
2. **[FLAW] Registry rows for time-tracker, calendar, zip lack the hosted remote** (`streamable-http https://mcp.zovo.one/mcp/<id>`). Only asset-register and dunning-letters (of the 5 sampled) carry the hosted remote. time-tracker/zip rows offer stdio mcpb only; calendar row has no remote either.
3. **[FLAW] time-tracker registry row is DEPRECATED** — `_meta` marks "Superseded by the word-rich registry name for this server at v0.21.0". Its `isLatest` for the official registry is the deprecated row; discoverers get a stale/stdio-only entry.
4. **[FLAW] calendar registry row websiteUrl points to the wrong product** — `https://mcp.zovo.one/s/timezone` instead of `/s/calendar`. The calendar server row was evidently published from the timezone server (subfolder `servers/timezone`), so its homepage mispoints to the sibling product's store page. `/s/timezone` exists (200) but buyers of calendar are routed to timezone.

## Recommendations
- Fix bundle checkout redirect path `/s/bundle` → `/bundle` (smallest contract fix in billing/src/index.js bundle PAGES/redirect mapping).
- Add `remotes` block (`streamable-http mcp.zovo.one/mcp/<id>`) to registry rows lacking it (time-tracker, calendar, zip, and re-verify all 46).
- Repoint calendar registry websiteUrl to `/s/calendar` (or drop the separate calendar row if it is a timezone duplicate).
- Refresh the deprecated time-tracker row to the current word-rich registry name / v0.21+ mcpb.