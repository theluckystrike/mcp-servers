# T3 — Internal-Link Fan-In Wave 2: compare + setup pages and guide-to-guide links to /s pages

STATUS: in progress

## Scope
- Repo: /Users/mike/mcp-servers (branch main). Live site https://mcp.zovo.one.
- File edited (exclusive ownership): `billing/src/content.js` ONLY.
- No deploy, no commit (orchestrator tests + deploys). No `sleep`/polling used.

## Baseline (iteration ~1, producing commands)
- `cd billing && node --test test/` → **152 pass / 0 fail** (pre-change).
- `/s` slug set = **42** slugs, identical from `data/distribution.json` `per_server` AND live sitemap:
  `curl -s https://mcp.zovo.one/sitemap.xml | grep -o '/s/[^<]*' | sort -u` → 42. (Each slug confirmed: time-tracker, price-tracker, spreadsheet, invoice, expense-tracker, office-suite, currency, timezone, docx, resume, recurring, clauses, pdf, calendar, kanban, image, bank-statement, quotes, barcode, zip, billing-docs, deposits, per-diem, asset-register, statement-of-account, cash-book, amortization, petty-cash, work-order, catalogue, change-order, packing-list, checklist, bill-of-sale, credit-note, job-card, dunning-letters, supplier-list, service-agreement, maintenance-log, mileage-log, delivery-schedule.)

## Deliverable part (a) — /compare pages link the /s pages they compare
**Verdict: already satisfied by the existing renderer — no code change needed.**

- Compare data lives in `billing/src/compare.js` (`export const COMPARE`, 27 entries); the task limits edits to `billing/src/content.js`, so compare.js is untouched.
- Every `/compare/<slug>` page ALREADY emits a link to the /s page it compares. `billing/src/index.js:1295` (the Related block) renders, unconditionally for every compare slug:
  `<a href="/s/${slug}">Product page</a>`.
- Producing command: node import of `compare.js` → `Object.keys(m.COMPARE)` = 27 slugs; cross-checked against the 42-slug /s set → **0 compare slugs missing a /s page** (`compare slugs not in /s set: []`).
- Since each /compare page compares one of our products vs external competitors, the only our-/s page it compares is its own product page — already linked by the immutable Related block for all 27 pages.
- Body-level `/s/` links: 14/27 compare bodies also contain contextual `/s/` links (calendar, image, quotes, barcode, per-diem, mileage-log, maintenance-log, service-agreement, deposits, cash-book, work-order, asset-register, supplier-list do NOT in body, but all are covered by the Related block). Not edited (compare.js out of scope).

## Deliverable part (b) — 5 new GUIDE_PRODUCT_LINKS entries (high-traffic guides lacking /s cross-links)
Added 5 entries to `billing/src/content.js` `GUIDE_PRODUCT_LINKS` (was 15 keys → now 20). Each chosen guide: high-traffic, product-topic, genuine topic→product match, and previously lacked a GUIDE_PRODUCT_LINKS (structured cross-sell) entry. All product slugs verified to exist in the 42-slug /s set.

| guide key (must exist in GUIDES) | product slugs added | topic justification |
|---|---|---|
| `bank-statement-csv-categorize-reconcile` | `bank-statement`, `expense-tracker` | Guide: "Categorize and reconcile a bank CSV export from chat" — matches bank-statement + expense-tracker. |
| `fixed-assets-and-depreciation-from-chat` | `asset-register`, `billing-docs` | Guide: "Fixed assets and depreciation… on rates tax authorities publish" — matches asset-register (+billing-docs). |
| `invoice-pdf-from-chat` | `invoice`, `quotes` | Guide: "Create an invoice PDF from a chat message" — matches invoice (+quotes). |
| `quotes-and-estimates-to-invoice-in-claude` | `quotes`, `invoice` | Guide: "Send a quote from chat, then turn the yes into an invoice" — matches quote→invoice flow. |
| `recurring-invoices-on-a-schedule` | `recurring`, `invoice` | Guide: "Bill a retainer on a schedule without a billing SaaS" — matches recurring billing + invoice. |

All 5 guides were verified present in `GUIDES` (bad guide keys: `[]`).

### Exact diff summary (unified, content.js GUIDE_PRODUCT_LINKS object)
```
  "best-mcp-servers-for-small-business-accounting": ["office-suite","invoice","cash-book","expense-tracker"],
+ "bank-statement-csv-categorize-reconcile": ["bank-statement", "expense-tracker"],
+ "fixed-assets-and-depreciation-from-chat": ["asset-register", "billing-docs"],
+ "invoice-pdf-from-chat": ["invoice", "quotes"],
+ "quotes-and-estimates-to-invoice-in-claude": ["quotes", "invoice"],
+ "recurring-invoices-on-a-schedule": ["recurring", "invoice"],
 };
```
(5 lines added, no lines removed; lint OK.)

## Validation
1. **Guide keys exist:** `node _t3r2_validate.mjs` → `bad guide keys: []`, `GPL total keys now: 20`, `GPL has added entries: true`. (Temp script since removed.)
2. **Product slugs exist in /s set:** all slugs used across GPL (24 unique) are members of the 42-slug per_server/sitemap set. New slugs used — invoice, quotes, recurring, bank-statement, expense-tracker, asset-register, billing-docs — all confirmed in the /s set.
3. **Test suite green:** `cd billing && node --test test/` → **152 pass / 0 fail** (unchanged from baseline). No test asserts GUIDE_PRODUCT_LINKS counts or guide cross-link counts; the 5 edited guide keys appear in no test file.

## Expected new inbound-count table
Each GUIDE_PRODUCT_LINKS entry renders ONE "Servers used in this guide" footer on its /guides page, adding one inbound link per product slug (renderer: `billing/src/index.js:1254-1255`). New inbound edges = 10 (5 guides × 2). Baseline 192 total inbound → **202** expected.

| /s slug | +added this wave | new inbound |
|---|---|---|
| invoice | +3 (invoice-pdf-from-chat, quotes-and-estimates-to-invoice, recurring-invoices-on-a-schedule) | baseline+3 |
| quotes | +2 (invoice-pdf-from-chat, quotes-and-estimates-to-invoice) | baseline+2 |
| bank-statement | +1 (bank-statement-csv-categorize-reconcile) | baseline+1 |
| expense-tracker | +1 (bank-statement-csv-categorize-reconcile) | baseline+1 |
| asset-register | +1 (fixed-assets-and-depreciation) | baseline+1 |
| billing-docs | +1 (fixed-assets-and-depreciation) | baseline+1 |
| recurring | +1 (recurring-invoices-on-a-schedule) | baseline+1 |

Total expected: **192 → 202** internal inbound links (10 new guide→/s edges). (Final live counts to be confirmed by orchestrator's post-deploy inbound sweep.)

## Notes / observations
- Pre-existing duplicate key in content.js `GUIDE_PRODUCT_LINKS`: `credit-notes-and-purchase-orders-from-chat` appears twice (lines 8923 & 8928) with identical values. Harmless in JS (object dedupes, same value) — left untouched to keep the diff minimal; flagged for the orchestrator.
- Deployed worker serves 106 GUIDES + 27 COMPARE pages + 42 /s pages (per sitemap). R1's 107-guide figure includes the /guides index; GUIDES object has 106 guide keys.

## Files changed
- `billing/src/content.js` — added 5 GUIDE_PRODUCT_LINKS entries (only file modified). No commit, no deploy.

STATUS: complete — 5 new guide→/s mappings authored; deploy+measure owned by orchestrator (capped at iteration 17, work done).
