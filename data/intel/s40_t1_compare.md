# s40_t1 — Compare-page expansion

- STATUS: superseded — this agent exhausted its budget on selection + fact research without writing entries; a follow-up agent (s40_t1b) wrote the 8 entries from this research and the orchestrator deduped, gated, deployed, and verified them live. See s40_t1b_compare.md.

## Selection basis

Existing COMPARE keys (5): time-tracker, price-tracker, spreadsheet, invoice, expense-tracker, plus
rendered keys currency, docx, timezone, resume, recurring, clauses, pdf, calendar, kanban, image,
bank-statement, quotes, barcode, per-diem (18 total per COMPARE_INDEX).

Task's named candidates that ALREADY have a compare page and were therefore skipped:
invoice (139 traffic), time-tracker (98), pdf (59), spreadsheet (63), price-tracker (69), currency (73).

Candidates actually lacking a compare page, ranked by /s/<slug> traffic in data/traffic.json
(all 8 named task picks + highest-traffic uncompared servers):

| slug | /s traffic | source |
|---|---|---|
| deposits | 50 | traffic.json |
| cash-book | 49 | traffic.json |
| work-order | 48 | traffic.json |
| asset-register | 46 | traffic.json |
| mileage-log | 0 (buyer intent: IRS/HMRC mileage deduction) | task-named |
| supplier-list | 0 | task-named |
| maintenance-log | 0 | task-named |
| service-agreement | 0 | task-named |

meeting-minutes and contract-review do NOT exist as servers (verified: no servers/ dir) — skipped.

## THE 8 KEYS ADDED
mileage-log, supplier-list, maintenance-log, service-agreement, deposits, cash-book, work-order,
asset-register

## Live probes (curl hosted endpoints, 2026-09-17)

/s/<slug> all 200; /compare/<slug> all 404 before this change (correct — pages did not exist).
tools/list against https://mcp.zovo.one/mcp/<slug>:

- mileage-log (9): trip_add trip_list trip_remove rate_set rate_list mileage_summary mileage_export
  license_status license_activate
  Free tier: 20 trips/calendar month. rate year-over-year series = Pro. mileage_export = Pro.
- deposits (11): deposit_record deposit_list deposit_apply deposit_refund deposit_delete
  deposit_balance deposit_statement_text deposit_statement_pdf deposits_report license_status
  license_activate
  deposit_statement_text free on every tier; deposit_statement_pdf = Pro; deposits_report = Pro.
- cash-book (9): ledger_build period_delete trial_balance ledger_lines month_close
  ledger_export_csv ledger_report license_status license_activate
  Free: 3 periods/month. trial_balance/ledger_lines free+unlimited. month_close, ledger_export_csv,
  ledger_report = Pro.
- work-order (12): work_order_create work_order_add_line work_order_status work_order_get
  work_order_list work_order_delete completion_report_text completion_report_pdf
  work_order_invoice_payload work_orders_report license_status license_activate
  Free tier: 5 open orders. completion_report_text free; completion_report_pdf,
  work_order_invoice_payload, work_orders_report = Pro.
- asset-register (9): asset_add asset_list asset_schedule asset_journal asset_dispose asset_delete
  asset_report license_status license_activate
  Free tier: 10 assets. asset_list/asset_schedule free. asset_journal, asset_report = Pro.
  Bundled schemes: pl (Polish KST), uk (HMRC capital allowance pools), us (IRS MACRS GDS).
- supplier-list (10): supplier_add supplier_list supplier_get supplier_update supplier_remove
  supplier_mark_reviewed supplier_due_review supplier_export license_status license_activate
  Free tier: 10 suppliers (slot freed on remove). CSV export free; Markdown + supplier_due_review = Pro.
- maintenance-log (8): asset_add maintenance_log maintenance_due asset_history maintenance_export
  asset_remove license_status license_activate
  Free tier: 3 assets; logging work never metered. CSV free; Markdown + maintenance_due = Pro.
- service-agreement (9): agreement_create agreement_get agreement_list agreement_update_status
  clause_library agreement_render agreement_checklist license_status license_activate
  Free tier: 3 active agreements. clause_library titles/summaries free, full texts + HTML render = Pro.
  Built-in clauses: IP assignment, mutual confidentiality, late payment interest, kill fee, revision rounds.

Site-wide Pro price: $19 once (40x "$19 once", 33x "$19 one-time" in billing/src/*.js), $39 bundle.

## Competitor fact-check sources (web_search, 2026-09-17)

- mileage-log: MileIQ pricing https://mileiq.com/pricing — Free $0 (40 drives/mo per
  mileiq.com/blog/how-much-does-mileiq-cost), Unlimited $13.99/mo ($11.66/mo annual).
  Stride https://apps.apple.com/us/app/stride-mileage-tax-tracker/id1041591359 — free, IRS-ready
  standard mileage log. IRS 2026 rate https://www.irs.gov/tax-professionals/standard-mileage-rates —
  76 cents/mile business (effective July 1 2026), 14 charitable, 23.5 medical.
- maintenance-log: UpKeep CMMS — asset/maintenance management, quote-based pricing (no public list).
  Snipe-IT https://snipeitapp.com/pricing — Self-Hosted free (AGPL-3.0, PHP/Laravel, needs PHP/MySQL
  stack + backups + updates), Basic Hosting $39.99/mo, Small Business $99.99/mo, Dedicated $249.99/mo.
- service-agreement: Bonsai https://www.hellobonsai.com/contracts — attorney-reviewed contract
  templates, create/send/e-sign; pricing $9-$59/user/month across published sources
  (taskip.net/bonsai-pricing reports $15-$59/user/mo; usereviews.io reports Basic $9/user/mo annual,
  Essentials $19) — range is wide, page states the range honestly.
- deposits: Baselane https://www.baselane.com/resources/15-best-landlord-software-platforms — landlord
  software generally free-to-$50-150/mo mid-range; Baselane Smart $20/mo.
- cash-book: Wave https://www.waveapps.com/accounting — free accounting/invoicing tier, Pro $19/mo
  (NerdWallet https://www.nerdwallet.com/business/software/reviews/wave-accounting: Starter free,
  Pro $19/mo or $190/yr); 300,000+ small businesses.
- work-order: Jobber https://www.getjobber.com/comparison/jobber-vs-servicetitan/ — Core $49/mo
  ($29/mo annual), Connect $199, Grow $399, Plus $699; extra users $29/mo. ServiceTitan — quote-only,
  no published pricing (fieldcamp.ai reports $1,700/mo real-world for some users).
- asset-register: Snipe-IT (above) for asset registry; depreciation schemes bundled: HMRC capital
  allowances, IRS MACRS GDS, Polish KST.
- supplier-list: vendor management software typical small-business price $30-$100/user/month or from
  ~$499/mo (mindsprint.com vendor-management-software survey).

## Gate outputs
(pending)

