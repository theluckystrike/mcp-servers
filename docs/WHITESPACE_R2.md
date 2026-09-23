# WHITESPACE R2 — Buyer-Intent Guide Blocks (Batch 2)

STATUS: complete

## Task
Append 6 buyer-intent guide blocks to the `GUIDES` export in `billing/src/content.js`, following existing block patterns exactly, then run the billing test suite and report results.

## Deliverables
- [x] `billing/src/content.js` — 6 new GUIDE blocks appended inside `GUIDES` (before the closing `};`, NOT inside GUIDE_RELATED)
- [x] Billing test suite run — 163 pass / 1 fail (fail is pre-existing, unrelated)
- [x] Report

## Slugs added (all uncovered; each references real product slugs)
1. `timesheet-hour-tracking` → products: time-tracker, invoice
2. `csv-to-json-conversion` → products: spreadsheet, pdf
3. `nda-agreement-templates` → products: clauses, service-agreement
4. `packing-list-and-delivery-note-from-chat` → products: packing-list, invoice
5. `barcode-inventory-count-from-chat` → products: barcode, catalogue
6. `invoice-numbering-and-sequence-from-chat` → products: invoice, recurring

## Verification
- Each block follows existing shape: `title`, `description`, `` `html` `` (with `<h1>`, `<h2>`, product `<a href="/s/...">` links, `install([...])`, `${FOOT}`), `faq[]`.
- All 6 imported cleanly via `import('./src/content.js')` → valid ES module / JS syntax.
- GUIDES slug count went 122 → 128.
- All referenced `/s/` product slugs exist in the estate (verified against existing guide links and `servers/`).

## Test results
`cd billing && export PATH=/opt/homebrew/bin:$PATH && export npm_config_cache=/Users/mike/.npm-cache-local && npm test`
- **pass: 163, fail: 1**
- The 1 failure is `test/figures.test.mjs` — `billing/src/figures.js is out of date; run node scripts/build-figures.mjs`. This is a **pre-existing generated-build-artifact drift** (figures.js is produced from data manifests), **not related** to the content.js edit. `git status` confirmed only `billing/src/content.js` was modified by this work; `figures.js` was untouched.

## Notes
- No commit, no push, no deploy (per task contract).
- The three suggested candidate slugs with no matching product in the estate (`api-rate-limit-handling`, `soc2-compliance-logging`, `webhook-signature-verification`) were replaced with uncovered buyer queries that map to real products, because each guide must reference 1-2 genuine product slugs.