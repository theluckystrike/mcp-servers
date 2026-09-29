# R7 NAMING — Honest Registry Name Variants

STATUS: DONE (2026-09-29, orchestrator-run after naming subagent 504-failed)

## Method
Probed 33 candidate tokens via /v0/servers?version=latest&search=<token> — 33 of
36 returned 0 rows (wide open). Honesty-checked candidate servers' tool
descriptions verbatim in servers/<x>/server.mcpb.json. Max 1 variant per server.

| token | search count | mapped server | decision | reason |
|---|---|---|---|---|
| payment-reminder | 0 | dunning-letters | PUBLISH | desc: "Chase overdue invoices: reminder 1, reminder 2, final notice, escalation dates, aging" — literal |
| expense-report | 0 | expense-tracker | PUBLISH | desc: "Log expenses, receipts and mileage; auto-categorise, split VAT, summarise, export" — literal |
| timesheet | 1 | time-tracker | PUBLISH | desc: "Track billable time: timers, entries, reports, CSV export" — literal |
| delivery-note | 0 | delivery-schedule | PUBLISH | desc: "Dated deliverables vs a quote or work order: due dates, sign-off, what is late" — literal fit |
| receipt-scanner | 1 | (none) | skip | expense-tracker stores receipt data but does no scanning/OCR; scanner overstates |
| nda-templates / offer-letter / employee-handbook / shift-roster / attendance-sheet / gdpr-data-request / vat-gst / stock-inventory / etc. | 0 | (none) | skip | no server's tools do these (no HR/NDA/roster/GDPR/inventory tools in estate) |

## Published (server.<token>.json, v0.22.0, mcp-publisher publish)
- io.github.theluckystrike/payment-reminder 0.22.0 -> servers/dunning-letters
- io.github.theluckystrike/expense-report 0.22.0 -> servers/expense-tracker
- io.github.theluckystrike/timesheet 0.22.0 -> servers/time-tracker
- io.github.theluckystrike/delivery-note 0.22.0 -> servers/delivery-schedule

## Verification (post-publish, ~45s lag)
All 4 re-probed via registry search: 4/4 LIVE.
Note: registry rejects descriptions >100 chars (422) — kept short.

## Summary
Estate now 104 unique active registry names (was 100 verified pre-round).
