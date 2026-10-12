# NEW MCP SERVER SPECS — 6 Ideas Ranked by Expected Organic-Traffic + Revenue Value

DATE: 2026-10-12
ESTATE: mcp.zovo.one — 54 local-first MCP servers for freelance/SMB paperwork, $19 single / $39 suite
METHOD: GitHub repo-search field counts + rank-one star counts via
`gh api -X GET search/repositories -f q='<query>' --jq '.total_count, .items[0].stargazers_count'`
(gh authenticated locally, run 2026-10-12). Buyer-intent natural queries are the demand signal.
Strategy applied from CLAUDE.md: enter small uncontested fields (14-91 results, rank-one median
7.5 stars), never contested fields (median 648+ results, rank-one median 998 stars); ship each
server also as a standalone one-server repo (20 of 21 blind-instrument GitHub citations are
one-server repos); make more uncontested buyer questions exist.

STATUS: complete

## FLEET VERIFICATION

Fleet listing (`ls /Users/mike/mcp-servers/servers/`, 54 entries) already contains: invoice,
quotes, receipts, expense-tracker, time-tracker, payroll, mileage-log, tax-calc,
loan-calculator, amortization, dunning-letters, petty-cash, cash-book, budget, credit-note,
bill-of-sale, change-order, work-order, purchase-requisition, billing-docs, bank-statement,
currency, service-agreement, clauses, statement-of-account, recurring, deposits,
statement-of-account, stripe-billing, per-diem, leave, onboarding, job-card, goods-receipt,
packing-list, delivery-schedule, barcode, price-tracker, supplier-list, asset-register,
maintenance-log, checklist, calendar, timezone, pomodoro, kanban, docx, pdf, spreadsheet,
office-suite, image, zip, resume, backlink-checker.
Ideas below are NOT in the fleet. Explicitly rejected as already-covered: timesheet
(92 results, rank-one 46 stars `kimai_mcp`, and time-tracker exists), generic VAT
("mcp vat" = 108 results, rank-one 435 stars `openaccountants` — contested, do not enter),
generic invoice ("mcp invoice" = 763 results — contested).

## RANKED IDEAS (1-6)

### 1. e-invoice-de — EN16931 / XRechnung / ZUGFeRD / Factur-X compliance server (rank: 1)

- Target query set (buyer queries):
  1. "how do I create an XRechnung invoice for a German client"
  2. "how to generate a ZUGFeRD PDF invoice"
  3. "how to make a Factur-X compliant invoice for France"
  4. "what is EN16931 and how do I produce a compliant invoice"
  5. "MCP server XRechnung"
  6. "MCP server ZUGFeRD"
  7. "MCP server Factur-X"
  8. "e-invoice Germany 2027 small business what do I need"
- Why uncontested (all counts: `gh api -X GET search/repositories -f q='<q>' --jq '.total_count, .items[0].stargazers_count'`, 2026-10-12):
  - "mcp xrechnung": 27 results, rank-one 36 stars (`open-invoice-germany`)
  - "mcp zugferd": 29 results, rank-one 5 stars (`invoicexml-mcp`)
  - "mcp factur-x": 25 results, rank-one 5 stars (`invoicexml-mcp`)
  - "mcp en16931": 18 results, rank-one 36 stars (`open-invoice-germany`)
  All four are small fields (18-29) with weak rank-one (5-36 stars) — squarely in the
  14-91 band where the estate already wins. Note `open-invoice-germany` holds two of the
  four phrases, so the repo name must carry the OTHER phrases (zugferd, factur-x) to win.
- Demand evidence: France's B2B e-invoicing mandate went LIVE September 1, 2026 (structured
  e-invoicing mandatory for domestic B2B, e-reporting for all other flows) —
  https://www.vertexinc.com/resources/resource-library/frances-2026-e-invoicing-regulations-explained-scope-deadlines-and-penalties ;
  Germany requires structured e-invoices for businesses above 800,000 EUR turnover from
  January 2027, with the receive mandate live since 2025 —
  https://edicomgroup.com/blog/germany-b2b-electronic-invoice ;
  French SARL/SAS/sole-trader guidance explicitly says "if your accounting software cannot
  read a Factur-X file, that is a problem" — https://www.facturwise.com/en/blog/mandatory-e-invoicing-france-small-company-guide-sarl-sas .
  This is the single most time-sensitive buyer panic in the whole paperwork space right now.
- First 5 tools:
  1. `xrechnung_generate` — build an EN16931 XRechnung XML from line items, parties, VAT IDs
  2. `zugferd_embed` — produce a ZUGFeRD/Factur-X hybrid PDF (CII XML embedded in PDF/A-3)
  3. `facturx_validate` — profile-check a Factur-X file against EN16931 business rules
  4. `einvoice_extract` — parse an XRechnung/ZUGFeRD/Factur-X file back to JSON fields
  5. `peppol_bis_check` — validate an invoice against Peppol BIS 3.0 rules (validation only;
     sending needs network accreditation, which is NOT local-first — exclude access-point duty)
- Funnel fit: direct upgrade path from `invoice`, `billing-docs`, `credit-note`, `currency`
  (multi-currency + VAT fields). Suite anchor: "compliance tier".
- Effort: M (XML schemas are fussy; CII validation rules are the long pole)
- Expected value: highest — statutory deadline demand, four winnable small fields,
  time-panic buyer intent, and no competitor carries all four phrases.

### 2. purchase-order — purchase order generator + tracker server (rank: 2)

- Target query set:
  1. "how do I create a purchase order for my small business"
  2. "purchase order vs invoice what is the difference"
  3. "free purchase order template with numbering"
  4. "MCP server purchase order"
  5. "MCP purchase order generator"
  6. "how to track purchase order status"
  7. "3-way match purchase order goods receipt invoice"
- Why uncontested:
  - "mcp purchase order": 21 results, rank-one 2 stars (`MCP_PurchaseOrderFlow`)
  - "mcp purchase order generator": 0 results (positive control: the 21-result parent query
    proves the search index works; the zero is a real empty sub-field)
  - "mcp purchase requisition" adjacency already won by fleet's `purchase-requisition`.
- Demand evidence: PO workflow (PO -> goods receipt -> invoice match) is standard SMB
  procurement; query 2 and 7 are perennial evergreen questions. The 21-result parent field
  with a 2-star rank-one is the classic winnable profile from GH_SEARCH_R2.
- First 5 tools:
  1. `po_create` — numbered PO with lines, supplier, terms, approval status
  2. `po_update_status` — issued / acknowledged / partially received / closed
  3. `po_match_invoice` — 3-way match PO vs goods-receipt vs invoice with tolerance rules
  4. `po_render` — PDF/HTML PO document
  5. `po_list_by_supplier` — open PO exposure per supplier
- Funnel fit: completes the procurement triangle with existing `purchase-requisition`,
  `goods-receipt`, `supplier-list`, `invoice`, `change-order`, `work-order`. Strongest
  suite-bundle fit of the six (5 existing servers link to it).
- Effort: S (pure CRUD + document render, mirrors existing servers)
- Expected value: highest certainty — weakest competition, strongest existing-funnel
  adjacency, S effort.

### 3. tax-forms-1099 — W-9 / 1099-NEC contractor forms server (rank: 3)

- Target query set:
  1. "how do I send a 1099-NEC to my contractor"
  2. "when do I need to collect a W-9"
  3. "1099 filing deadline small business"
  4. "MCP server 1099"
  5. "MCP w9 form"
  6. "do I have to 1099 someone I paid 600 dollars"
  7. "1099 penalties for late filing"
- Why uncontested:
  - "mcp 1099": 5 results, rank-one 1 star (`vp1099-kubernetes-mcp-server` — a name-collision
    Kubernetes repo, i.e. effectively zero relevant competition)
  - "mcp w9 form": 0 results
  - "mcp 1099 nec": 1 result, rank-one 1 star (`Tax-Form-to-Excel-Sheet` — an extractor, not a generator)
- Demand evidence: IRS requires Form 1099-NEC for any contractor paid >= $600/year
  (https://www.irs.gov/businesses/small-businesses-self-employed/forms-and-associated-taxes-for-independent-contractors ;
  https://www.uschamber.com/co/run/finance/how-to-issue-form-1099); penalties for missing
  the January 31 deadline are a recurring panic query
  (https://turbotax.intuit.com/tax-tips/small-business-taxes/penalties-for-not-filing-a-1099-misc-irs-form/L4mwyM8Tk).
  Paid e-filing runs $2.99/form (https://efilemyforms.com/file-form-1099-nec/) — price
  anchor for the $19 server.
- First 5 tools:
  1. `w9_collect` — structured W-9 intake (TIN, entity type, backup-withholding flags)
  2. `tin_match_check` — TIN/name format validation pre-filing (local heuristics only, no IRS API)
  3. `necdraft_1099` — draft 1099-NEC from payment totals with box math
  4. `payment_summary_by_contractor` — annual per-contractor totals against the $600 threshold
  5. `form_render` — printable W-9 / 1099-NEC PDFs
- Funnel fit: pairs with `payroll` (contractor vs employee), `tax-calc`,
  `expense-tracker` (payments feed 1099 totals), `clauses` (contractor agreement TIN clause).
- Effort: S (forms are static-layout PDF math; no external API needed)
- Expected value: high — panic-deadline demand every January, effectively empty field.

### 4. rent-receipts — rent receipt + landlord paperwork server (rank: 4)

- Target query set:
  1. "how do I write a rent receipt"
  2. "free rent receipt template"
  3. "do landlords have to give rent receipts"
  4. "MCP server rent receipt"
  5. "rent ledger for tenant"
  6. "landlord rent statement"
  7. "rent invoice for tenant company reimbursement"
- Why uncontested:
  - "mcp rent receipt": 0 results
  - "mcp rental invoice": 1 result, rank-one 0 stars (`zensched-str-turnover-kit`)
  - "mcp landlord": 10 results, rank-one 0 stars (`landlordtasksai-mcp`)
  Positive control: plain "rent receipt" = 209 results, rank-one 13 stars
  (`rent-receipt-generator`) — demand exists, the MCP field is genuinely empty. This is the
  exact CLAUDE.md n=2 pattern: winners carry the full query phrase in the repo name.
- Demand evidence: the 209-result generic field with an active top generator proves buyer
  volume; SMB/landlord paperwork is the estate's home turf; tenants claiming employer
  housing reimbursement (query 7) is a cross-border evergreen.
- First 5 tools:
  1. `rent_receipt_issue` — numbered receipt with period, method, landlord/tenant IDs
  2. `rent_ledger` — per-tenant payment history with arrears calculation
  3. `rent_invoice` — invoice a tenant (or their employer) for a period
  4. `rent_statement` — periodic statement of account for a tenancy
  5. `receipt_render` — printable receipt batch PDFs
- Funnel fit: reuses `receipts`, `statement-of-account`, `invoice`, `deposits`, `cash-book`.
- Effort: S
- Expected value: high volume, zero MCP competition; slightly below #3 because generic
  templates are free everywhere (revenue pull is weaker than statutory/deadline panic).

### 5. ar-math — late fee / interest / AR math server (rank: 5)

- Target query set:
  1. "can I charge late fees on unpaid invoices"
  2. "how much interest to charge on an overdue invoice"
  3. "late fee calculator invoice"
  4. "MCP late fee calculator"
  5. "statutory interest rate for late commercial payments"
  6. "how to calculate interest from due date"
  7. "aging report accounts receivable"
- Why uncontested:
  - "mcp late fee": 1 result, rank-one 2 stars (`accounts-receivable-skills`)
  - "mcp late fee calculator": 0 results
  - "mcp overdue invoice interest": 0 results
  - "mcp aging report" adjacency served by fleet's `statement-of-account` (no direct hit needed).
- Demand evidence: queries 1-2 are perennial bookkeeping questions; the single 2-star
  skill-repo in the parent field is not an MCP server. Fee math is jurisdiction-dependent
  (EU late-payment directive, US state caps) — content depth is the moat.
- First 5 tools:
  1. `late_fee_calculate` — flat/percentage/daily-interest fee from due date and grace period
  2. `statutory_interest` — EU late-payment directive and common-jurisdiction rate tables
  3. `aging_report` — AR buckets 30/60/90/120 from a payment ledger
  4. `dunning_fee_schedule` — escalating fee plan aligned with dunning letter steps
  5. `fee_line_item` — render the fee as an invoice adjustment line (feeds `invoice-adjacent` docs)
- Funnel fit: the natural computation layer under existing `dunning-letters`,
  `statement-of-account`, `invoice`, `credit-note`, `deposits`.
- Effort: S
- Expected value: solid but narrower audience than 1-4 (only businesses WITH overdue
  invoices act on it); very cheap to build and pure funnel glue.

### 6. gig-tax — quarterly estimated tax + home office deduction server (rank: 6)

- Target query set:
  1. "how much should I set aside for quarterly estimated taxes"
  2. "quarterly estimated tax due dates freelancer"
  3. "safe harbor rule estimated taxes"
  4. "MCP quarterly estimated tax"
  5. "MCP home office deduction"
  6. "simplified home office deduction square footage"
  7. "MCP gig tax"
- Why uncontested:
  - "mcp quarterly estimated tax": 1 result, rank-one 0 stars (`gig-tax-mcp` — exists but zero stars)
  - "mcp gig tax": 1 result, rank-one 0 stars (same repo)
  - "mcp home office deduction": 0 results
  - "mcp self employed tax": 3 results, rank-one 1 star (`planfi-self-employed-planner`)
  - "mcp estimated tax": 5 results, rank-one 5 stars (`ContextTax`)
- Demand evidence: quarterly deadlines (Apr/Jun/Sep/Jan) are four panic windows per year;
  safe-harbor and simplified home-office (flat $5/sq ft, 300 sq ft cap) are evergreen
  calculation questions with deterministic answers — ideal for a deterministic local server.
- First 5 tools:
  1. `estimated_tax_project` — project annual liability from YTD income/expenses
  2. `quarterly_schedule` — due dates + per-quarter amounts, safe-harbor options
  3. `home_office_deduction` — simplified vs actual method comparison
  4. `setaside_rate` — recommended per-payment set-aside percentage
  5. `deduction_worksheet` — Schedule C style expense-category rollup (feeds from `expense-tracker`)
- Funnel fit: `tax-calc`, `expense-tracker`, `mileage-log`, `per-diem`, `time-tracker` all feed it.
- Effort: M (tax rules change yearly; need a versioned rule table)
- Expected value: ranked last only because a zero-star incumbent (`gig-tax-mcp`) already
  carries the exact phrase and US-only scope; still very winnable and cheap.

## RANKING RATIONALE

Ranked by expected (organic traffic x revenue conversion), applying CLAUDE.md's measured rules:

1. **e-invoice-de** — statutory deadline demand (France live 2026-09-01, Germany 2027),
   four small fields (18-29 results, rank-one 5-36 stars), highest buyer urgency. Traffic
   ceiling highest of the six; compliance buyers pay for certainty.
2. **purchase-order** — 21-result field, 2-star rank-one, S effort, densest existing-funnel
   fit (5+ servers). Best certainty-per-effort.
3. **tax-forms-1099** — effectively zero relevant competition (5-result field whose rank-one
   is an unrelated Kubernetes repo), annual statutory deadline, clear $19 price anchor vs
   $2.99/form paid e-filing.
4. **rent-receipts** — zero-result MCP field against a 209-result generic demand field;
   positive control run per CLAUDE.md rule 10. Weaker revenue pull (free templates abound).
5. **ar-math** — 0-1 result fields, pure computation, cheapest build; audience limited to
   businesses with overdue invoices.
6. **gig-tax** — zero-star incumbent on the exact phrase, US-only; four annual panic windows
   keep it worth building, but contested-adjacent.

All six: small/uncontested fields, no paid APIs, local-first (no account creation), each
shippable as a standalone one-server repo plus a fleet server, per the measured
recommendation-source profile.

## EVIDENCE LOG

All GitHub counts, 2026-10-12, command template:
`gh api -X GET search/repositories -f q='<q>' --jq '.total_count, .items[0].stargazers_count'`

| query | results | rank-one stars | rank-one repo |
|---|---|---|---|
| mcp invoice | 763 | 19 | mcp-holded (contested — excluded) |
| mcp purchase order | 21 | 2 | MCP_PurchaseOrderFlow |
| mcp purchase order generator | 0 | — | — |
| mcp proforma invoice | 1 | 0 | oblio-mcp-server |
| mcp xrechnung | 27 | 36 | open-invoice-germany |
| mcp zugferd | 29 | 5 | invoicexml-mcp |
| mcp factur-x | 25 | 5 | invoicexml-mcp |
| mcp en16931 | 18 | 36 | open-invoice-germany |
| mcp electronic invoicing | 24 | 24 | hacienda-cr |
| mcp peppol | 33 | 14 | phoss-peppol-mcp |
| mcp e-invoice | 78 | 23 | fattureincloud-mcp |
| mcp 1099 | 5 | 1 | vp1099-kubernetes-mcp-server |
| mcp 1099 nec | 1 | 1 | Tax-Form-to-Excel-Sheet |
| mcp w9 | 1 | 0 | (name-collision junk repo) |
| mcp w9 form | 0 | — | — |
| mcp rent receipt | 0 | — | — |
| rent receipt (positive control) | 209 | 13 | rent-receipt-generator |
| mcp rental invoice | 1 | 0 | zensched-str-turnover-kit |
| mcp landlord | 10 | 0 | landlordtasksai-mcp |
| mcp late fee | 1 | 2 | accounts-receivable-skills |
| mcp late fee calculator | 0 | — | — |
| mcp overdue invoice interest | 0 | — | — |
| mcp invoice reminder | 4 | 0 | invoice-pilot |
| mcp progress billing | 1 | 0 | operations-mcp |
| mcp sales tax | 6 | 9 | genpark-sales-tax-exempt-checker-skill |
| mcp sales tax calculator | 1 | 8 | genpark-...-rate-calculator-skill |
| mcp vat | 108 | 435 | openaccountants (contested — excluded) |
| mcp vat calculator | 4 | 8 | genpark-...-normalizer-skill |
| mcp quarterly estimated tax | 1 | 0 | gig-tax-mcp |
| mcp gig tax | 1 | 0 | gig-tax-mcp |
| mcp home office deduction | 0 | — | — |
| mcp self employed tax | 3 | 1 | planfi-self-employed-planner |
| mcp estimated tax | 5 | 5 | ContextTax |
| mcp timesheet | 92 | 46 | kimai_mcp (time-tracker exists — excluded) |

Web demand sources (fetched 2026-10-12, listed in idea sections above):
- https://edicomgroup.com/blog/germany-b2b-electronic-invoice
- https://www.vertexinc.com/resources/resource-library/frances-2026-e-invoicing-regulations-explained-scope-deadlines-and-penalties
- https://www.facturwise.com/en/blog/mandatory-e-invoicing-france-small-company-guide-sarl-sas
- https://www.irs.gov/businesses/small-businesses-self-employed/forms-and-associated-taxes-for-independent-contractors
- https://www.uschamber.com/co/run/finance/how-to-issue-form-1099
- https://efilemyforms.com/file-form-1099-nec/
- https://turbotax.intuit.com/tax-tips/small-business-taxes/penalties-for-not-filing-a-1099-misc-irs-form/L4mwyM8Tk

## RECOMMEND-NEXT

Build **e-invoice-de** (idea 1) in the next sprint. It is the only idea with a live statutory
deadline driving buyer panic (France mandatory B2B e-invoicing since 2026-09-01; Germany's
issue mandate for >EUR 800k turnover hits 2027-01), four winnable small fields, and no single
competitor carrying all four phrase families (xrechnung / zugferd / factur-x / en16931 —
`open-invoice-germany` holds two, so name the repo for zugferd/factur-x coverage). Ship it as
a standalone one-server repo AND a fleet server, with the four query phrases in the repo name
and description, and add a Factur-X reading section to the existing `invoice` product page to
catch the funnel. Validation-first: `zugferd_embed` + `facturx_validate` are the demo tools
that prove the product in the shipping test (a real `tools/call` through the advertised URL).
