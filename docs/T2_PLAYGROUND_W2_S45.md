# T2 PLAYGROUND WAVE 2 — S45

STATUS: complete

Full-estate batch submission to MCP Playground (mcpplaygroundonline.com) via the proven
`POST /api/mcp-submit` recipe (no captcha, no account, review-gated).

## Result: 36 of 36 remaining servers submitted and confirmed

Every one of the 36 wave-2 targets has a logged HTTP 200 `{"success":true}` followed by an
HTTP 409 duplicate-confirmation on the retry pass (server-side persistence double-proof).
Combined with wave-1 (invoice, bank-statement, expense-tracker, bill-of-sale,
service-agreement, office-suite), the **entire 42-product estate is now submitted**.

Per-server evidence (200 then 409): time-tracker, price-tracker, spreadsheet, currency,
docx, timezone, resume, recurring, clauses, calendar, pdf, image, kanban, quotes, barcode,
zip, billing-docs, deposits, per-diem, asset-register, statement-of-account, cash-book,
amortization, petty-cash, work-order, catalogue, change-order, delivery-schedule,
packing-list, checklist, credit-note, job-card, dunning-letters, supplier-list,
maintenance-log, mileage-log.

Raw log: docs/w2_results.log (200s and 409s interleaved from the two passes).

## Mechanics observed
- Rate limit ~1 submission / 2-3 min; 429 `{"error":"Too many submissions. Please wait a few minutes."}`
  handled by 120s backoff, up to 12 attempts per server. Zero failures.
- Script docs/submit_w2.mjs is resumable (replays docs/w2_results.log). Two passes ran;
  the 409s are pass-2 duplicate confirmations, not errors.
- Verification: listings are review-gated — no public URL yet. Recheck in ~1 week
  (fold into T3 platform recheck cadence).

## Roll-up for the sprint
- MCP Playground total submitted: 42/42 products (6 wave-1 + 36 wave-2), all double-confirmed.
