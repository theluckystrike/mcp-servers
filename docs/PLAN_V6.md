# Plan v6 (2026-09-04, loop 9): correctness of the handshake, one more server, hosted round 11

## Signals at the start
| Signal | Value | Read |
|---|---|---|
| Bundle downloads | 703 (609 at loop 8 start) | Catalog-driven; still 0 repo views |
| Sales, keys minted | 0, 0 | 4 human checkout sessions in the last 100; binding path live, no conversion |
| GSC | 179 submitted, 0 indexed, sitemap fetched 2026-09-04 01:41Z | Home page "discovered, never crawled"; zovo.one footer link live since 09:20 machine |
| Registry findable share | 41% (target 60) | templates slot has 1 result, quotes 21, payroll 8, epub 6, barcode 9, zip 14 |
| Handshake version | 14 of 17 servers announce a stale serverInfo.version | Catalogs say 0.6.0, the server says up to 0.1.0 |
| KPI table defects | "Hosted endpoints coverage" reads 0 of 16 (reader drift); "Pro tenants" 507 counts validation keys | Two KPIs lie on the dashboard |
| Audits | kanban 18/18, image 16/18, bank 13/18 (stdio) | None of the three has been through the hosted connect-by-URL path |

## Top 5, ranked by impact x autonomy
1. Handshake version from package.json in all 17 servers, coordinated with remote/build-vendor.mjs; fix the two KPI readers. Pass: every bundle boots announcing 0.6.x; kpi.json hosted coverage 16 of 16; Pro tenants excludes probe keys.
2. Build `quotes` (estimates and quotes on the invoice engine: line items, validity date, accept converts to an invoice, PDF via the same renderer, shared business profile), plus registry variant `templates` on docx. Pass: tests, SPEC, contract test, audit, wired into office-suite, validate probes, pages, hosting.
3. Round 11: kanban, image, bank-statement through the hosted connect-by-URL path with a fresh anonymous token, the way a claude.ai user arrives. Pass: scored scenarios, seam fixes with tests.
4. Bank export routing: measure single-server packaging vs two ledgers on the "export September" prompt; add an export line to expense-tracker naming statement_export when the bank ledger holds the period. Pass: prompt scores 3 in at least one packaging with evidence.
5. Organic: inspect five storefront URLs in GSC after the footer link, IndexNow the changed pages, re-probe registry for the templates and quotes slots after publish. Pass: numbers in docs/INTEL_R7.md.

Release v0.6.1 (version fix) and v0.7.0 (quotes) only if sources change; validation, measure, KPIs, sprint log, dashboard, memory, sound at the end.
