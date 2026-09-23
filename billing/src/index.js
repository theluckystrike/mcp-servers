import { mintLicense, verifyLicenseKey, hex } from "./license.js";
import { PAGES, CHANGELOG } from "./pages.js";
import { GUIDES, GUIDE_INDEX, GUIDE_PRODUCT_LINKS, GUIDE_RELATED, relatedGuidesBlock } from "./content.js";
import { COMPARE, COMPARE_INDEX } from "./compare.js";
import { setupPage, clientHub, setupIndex, setupUrls, serversFor, CLIENTS, CLIENT_ORDER, SETUP_SERVERS } from "./setup.js";
// Counts derived from the manifests by scripts/build-figures.mjs. Before this import the
// home page stated its own catalogue size three different ways in one document: "Thirty-one"
// in the h1, title and JSON-LD (the number of single-server PRODUCTS), "32 servers" in the
// validation line (the number of server directories), and "The 31 servers" over a table.
// `ls servers/ | wc -l` is 32. Every count on the page now comes from here, as a numeral,
// and billing/test/figures.test.mjs fails if a count on the rendered page is not one of them.
import { LISTED_IDS, HOSTED_IDS as HOSTED_ID_LIST, LISTED_COUNT, LISTED_CHILD_COUNT, HOSTED_COUNT, ANON_TOKEN_DAYS, RATE_LIMIT_FREE, RATE_LIMIT_PRO, FREE as FREE_TIER } from "./figures.js";

export const PRODUCTS = {
  "time-tracker": { desc: "Track billable time from chat: timers, entries, reports, CSV, invoice-ready totals.", free: "Free: unlimited timers, last 7 days of reports, 2 rated projects, currency per entry.", pro: "Pro: full history, invoice summaries, group by tag, unlimited projects.", name: "MCP Time Tracker Pro", price: "price_1UBDU5JKCamubEm1wPMZI8Zf", usd: 19, pkg: "@theluckystrike/mcp-time-tracker", bin: "mcp-time-tracker", payload: "time-tracker" },
  "price-tracker": { desc: "Check and watch product prices on ordinary shop pages, with history and target alerts.", free: "Free: unlimited price checks with confidence, 3 watches, 30 observations each, alerts.", pro: "Pro: unlimited watches, full history, refresh all.", name: "MCP Price Tracker Pro", price: "price_1UBDU6JKCamubEm1ufsEKwSS", usd: 19, pkg: "@theluckystrike/mcp-price-tracker", bin: "mcp-price-tracker", payload: "price-tracker" },
  spreadsheet: { desc: "Read, query, add columns to and convert xlsx and csv files without corrupting them.", free: "Free: read, query with group by and sums, stats up to 5,000 rows; writes up to 500 rows, never partial.", pro: "Pro: no limits.", name: "MCP Spreadsheet Pro", price: "price_1UBDU7JKCamubEm1LZTfrsMd", usd: 19, pkg: "@theluckystrike/mcp-spreadsheet", bin: "mcp-spreadsheet", payload: "spreadsheet" },
  invoice: { desc: "Numbered invoices with tax lines, rendered to a professional PDF, all local.", free: "Free: 3 invoices a month with a small footer line; overdue report included.", pro: "Pro: unlimited, no branding, logo, custom prefix.", name: "MCP Invoice Pro", price: "price_1UBDU8JKCamubEm1Ybcp5IUs", usd: 19, pkg: "@theluckystrike/mcp-invoice", bin: "mcp-invoice", payload: "invoice" },
  "expense-tracker": { desc: "Receipts, mileage and expenses ledger that turns billable spend into invoice lines.", free: "Free: unlimited logging, last 30 days, 3 projects, 5 rules, CSV up to 200 rows.", pro: "Pro: full history, unlimited projects and rules, xlsx export, rebill with markup.", name: "MCP Expense Tracker Pro", price: "price_1UBEoOJKCamubEm1ryEKWxIg", usd: 19, pkg: "@theluckystrike/mcp-expense-tracker", bin: "mcp-expense-tracker", payload: "expense-tracker" },
  currency: { desc: "Currency converter on the European Central Bank reference rates: latest, history, any-date, and fx_rates ready for rebilling.", free: "Free: latest rates, convert, history up to 90 days.", pro: "Pro: full history back to 1999, any-date rates, unlimited windows.", name: "MCP Currency Converter Pro", price: "price_1UBPwqJKCamubEm1dTtEN9PY", usd: 19, pkg: "@theluckystrike/mcp-currency", bin: "mcp-currency", payload: "currency" },
  docx: { desc: "Real Word documents from chat: proposals, contracts, quotes, markdown to .docx, template filling, read existing files.", free: "Free: create, convert and read documents without limit; 3 proposals or contracts a month.", pro: "Pro: unlimited proposals and contracts, letterhead, unlimited template fills.", name: "MCP Docx Pro", price: "price_1UBPwtJKCamubEm1PPpj1fPE", usd: 19, pkg: "@theluckystrike/mcp-docx", bin: "mcp-docx", payload: "docx" },
  timezone: { desc: "Meeting planner across time zones: convert times, find slots inside everyone's working hours, DST changes, .ics files.", free: "Free: conversions, overlap, DST, slots for up to 3 people, 5 contacts.", pro: "Pro: unlimited participants, contacts and calendar files, recurring slot search.", name: "MCP Timezone Planner Pro", price: "price_1UBPwwJKCamubEm13LZyFsDw", usd: 19, pkg: "@theluckystrike/mcp-timezone", bin: "mcp-timezone", payload: "timezone" },
  resume: { desc: "Resumes and cover letters as real Word files from one profile: keyword tailoring, gap analysis, three styles, never invents facts.", free: "Free: profile, modern-style resume, markdown and HTML exports, 3 cover letters a month, tailoring up to 2,000-character job posts.", pro: "Pro: all styles, unlimited cover letters and tailoring, profile variants, letterhead colours.", name: "MCP Resume and Cover Letter Pro", price: "price_1UBSYxJKCamubEm1uaUEIGBI", usd: 19, pkg: "@theluckystrike/mcp-resume", bin: "mcp-resume", payload: "resume" },
  recurring: { desc: "Recurring invoices on a schedule: weekly, monthly, quarterly or yearly, generated into the invoice server with PDFs, idempotent per period, with a revenue forecast.", free: "Free: 3 active schedules, 30-day upcoming view, generate due invoices.", pro: "Pro: unlimited schedules, 12-month forecast, audit history, end-of-month and anchor-day rules.", name: "MCP Recurring Invoices Pro", price: "price_1UBSjCJKCamubEm1gOmfW2db", usd: 19, pkg: "@theluckystrike/mcp-recurring", bin: "mcp-recurring", payload: "recurring" },
  clauses: { desc: "A personal library of contract and proposal clauses with a 25-clause starter set, variables, search, and assembly into Word or markdown.", free: "Free: starter set plus 10 own clauses, search, assemble up to 8 clauses, markdown export.", pro: "Pro: unlimited clauses, jurisdiction and tag filters, JSON import and export, unlimited assembly, versions.", name: "MCP Clause Library Pro", price: "price_1UBSjDJKCamubEm1sA7KYyQs", usd: 19, pkg: "@theluckystrike/mcp-clauses", bin: "mcp-clauses", payload: "clauses" },
  calendar: { desc: "Read .ics calendars and feeds: events in a window, free and busy, conflicts, exports, and meetings turned into billable time entries.", free: "Free: 2 calendars, 31-day windows, exports up to 50 events.", pro: "Pro: unlimited calendars, any window, unlimited exports, URL refresh.", name: "MCP Calendar Pro", price: "price_1UBdQYJKCamubEm1CaxadXyX", usd: 19, pkg: "@theluckystrike/mcp-calendar", bin: "mcp-calendar", payload: "calendar" },
  pdf: { desc: "PDF tools without native code: merge, split, page ranges, rotate, PAID and DRAFT stamps, best-effort text, business watermark.", free: "Free: info, count, text, merge up to 5 files, edits on files up to 30 pages, preset stamps.", pro: "Pro: unlimited files and pages, custom stamps and colours, business watermark, reorder.", name: "MCP PDF Tools Pro", price: "price_1UBdQaJKCamubEm16HxaiJWK", usd: 19, pkg: "@theluckystrike/mcp-pdf", bin: "mcp-pdf", payload: "pdf" },
  image: { desc: "Image tools without native code: resize, convert, compress, crop, thumbnails, strip metadata, watermark with your business name.", free: "Free: info, resize, convert, compress, crop, strip metadata up to 4 MP, batches of 5.", pro: "Pro: unlimited size and batches, custom watermark text, dominant colours.", name: "MCP Image Tools Pro", price: "price_1UBlQEJKCamubEm1u1SKu720", usd: 19, pkg: "@theluckystrike/mcp-image", bin: "mcp-image", payload: "image" },
  "bank-statement": { desc: "Bank CSV exports categorised by your rules, monthly summaries per currency, reconciled against your expenses, subscriptions detected.", free: "Free: 2 accounts, 12 months, 5 rules, summary and search.", pro: "Pro: unlimited accounts, history and rules, reconcile with expenses, recurring detection, export.", name: "MCP Bank Statement Pro", price: "price_1UBlQGJKCamubEm11cATuyBV", usd: 19, pkg: "@theluckystrike/mcp-bank-statement", bin: "mcp-bank-statement", payload: "bank-statement" },
  kanban: { desc: "A local task board per project: columns, due dates, estimates, overdue view, weekly review, and timers that hand off to the time tracker.", free: "Free: 3 projects, 200 open tasks, default columns.", pro: "Pro: unlimited projects and tasks, custom columns, weekly review history, estimates versus actuals.", name: "MCP Kanban Pro", price: "price_1UBlSJJKCamubEm1U7CP7tmo", usd: 19, pkg: "@theluckystrike/mcp-kanban", bin: "mcp-kanban", payload: "kanban" },
  quotes: { desc: "Estimates and quotes on the invoice engine: line items, VAT, validity dates, accept converts to an invoice, PDF, win rate by currency.", free: "Free: 5 open quotes and text export.", pro: "Pro: unlimited quotes, PDF, win-rate report.", name: "MCP Quotes Pro", price: "price_1UBmtuJKCamubEm1y76zV0CC", usd: 19, pkg: "@theluckystrike/mcp-quotes", bin: "mcp-quotes", payload: "quotes" },
  barcode: { desc: "QR codes and barcodes from chat: SEPA payment QR for an invoice, vCard, WiFi, Code128, EAN-13 and UPC-A as SVG or PNG.", free: "Free: 20 codes a month, SVG.", pro: "Pro: unlimited codes, PNG at any size, batch.", name: "MCP Barcode Pro", price: "price_1UBoNQJKCamubEm1X6CTBLdP", usd: 19, pkg: "@theluckystrike/mcp-barcode", bin: "mcp-barcode", payload: "barcode" },
  zip: { desc: "Create, inspect and extract zip archives safely from chat: bomb and traversal guards decided from the central directory, CRC checked per entry, bundle a month of invoices and exports.", free: "Free: archives to 25 MB and 200 entries, 20 archives a month.", pro: "Pro: unlimited size, entries and archives.", name: "MCP Zip Pro", price: "price_1UBqGgJKCamubEm1SoQ76sXZ", usd: 19, pkg: "@theluckystrike/mcp-zip", bin: "mcp-zip", payload: "zip" },
  "billing-docs": { desc: "Credit notes and purchase orders on the same engine as your invoices: the VAT unwound at the rate you charged, and never more credited than the invoice billed.", free: "Free: 5 documents a calendar month, credit notes and purchase orders together, plus unlimited text exports.", pro: "Pro: unlimited documents, both PDFs, your logo, and the credited and on-order report.", name: "MCP Billing Docs Pro", price: "price_1UCCo9JKCamubEm1TyBUQdzO", usd: 19, pkg: "@theluckystrike/mcp-billing-docs", bin: "mcp-billing-docs", payload: "billing-docs" },
  deposits: { desc: "Security and retainer deposits held per client, applied to invoices as a real payment that adds to what was already paid rather than replacing it.", free: "Free: 5 deposits recorded a calendar month, plus unlimited applying, refunds, balances and text statements.", pro: "Pro: unlimited deposits recorded, the A4 statement PDF with your logo, and the held and unapplied report.", name: "MCP Deposits Pro", price: "price_1UCEbNJKCamubEm1kOnmQOiE", usd: 19, pkg: "@theluckystrike/mcp-deposits", bin: "mcp-deposits", payload: "deposits" },
  "per-diem": { desc: "Statutory travel allowances on three bundled rate tables: the Polish delegation regulation at home and per country, the HMRC benchmark scale rates inside the UK, and the US GSA CONUS standard. The HMRC overseas per city rates are not bundled and are refused by name rather than guessed.", free: "Free: unlimited rate lookups and calculations on every scheme, 5 trips saved a calendar month, unlimited trip lists.", pro: "Pro: unlimited trips saved, the expense-tracker export payloads, and the per scheme and per month report.", name: "MCP Per Diem Pro", price: "price_1UCH5MJKCamubEm1wSrTiopx", usd: 19, pkg: "@theluckystrike/mcp-per-diem", bin: "mcp-per-diem", payload: "per-diem" },
  "asset-register": { desc: "A fixed asset register that depreciates on the rates the tax authorities publish: the Polish KST annex rates from the CIT and PIT acts, the UK capital allowance pools with the annual investment allowance, and the US MACRS GDS half-year tables for 3, 5 and 7 year property. The tables are bundled files rather than a feed, and the annex positions that could not be stated with confidence are refused by name rather than guessed.", free: "Free: 10 assets in the register, unlimited depreciation schedules on every table, unlimited register listing and disposals.", pro: "Pro: unlimited assets, the monthly journal with its expense-tracker payload, and the net book value, yearly charge and disposal report.", name: "MCP Asset Register Pro", price: "price_1UCJDmJKCamubEm1lXBcAaEQ", usd: 19, pkg: "@theluckystrike/mcp-asset-register", bin: "mcp-asset-register", payload: "asset-register" },
  "statement-of-account": { desc: "Statements of account and payment chasers built from the invoices, credit notes and deposits you already keep: opening balance, every movement, closing balance, and aging into 0-30, 31-60, 61-90 and over 90 days as at any date you name. It writes into no book it reports on, and it never invents a late fee.", free: "Free: 5 statements a calendar month, unlimited aging on every client, plain-text statements, and dunning letters at the friendly and firm levels.", pro: "Pro: unlimited statements, the A4 PDF with your logo, the final-demand letter, and the all-clients report per currency.", name: "MCP Statement of Account Pro", price: "price_1UCLpbJKCamubEm1vvAD4jzZ", usd: 19, pkg: "@theluckystrike/mcp-statement-of-account", bin: "mcp-statement-of-account", payload: "statement-of-account" },
  "cash-book": { desc: "One double-entry ledger over the books you already keep: invoices, credit notes, deposits, expenses, the bank import and the fixed asset register. Every line carries the server, the document id and the date it came from, and the trial balance is proved to the minor unit. It writes into none of those books, and there is no way to type an entry into it.", free: "Free: 3 periods a calendar month, and the trial balance and the ledger lines unlimited on every tier, because whether the books add up is the question this server exists for.", pro: "Pro: unlimited periods, the month close with its snapshot and exception list, the CSV export and the per-account report.", name: "MCP Cash Book Pro", price: "price_1UCOv4JKCamubEm15469I5YT", usd: 19, pkg: "@theluckystrike/mcp-cash-book", bin: "mcp-cash-book", payload: "cash-book" },
  "amortization": { desc: "Loan and lease schedules from the terms of the agreement: the level payment, the effective annual rate beside the nominal one, and every period's opening balance, interest, principal and closing balance in integer minor units. Compounding and payment frequency are two different clocks, so the periodic rate is always the equivalent rate taken through the compounding clock. It posts nothing and stores no schedule.", free: "Free: 3 loans in the register, and the schedule unlimited on every tier, because the payment and the interest are the question this server exists for.", pro: "Pro: unlimited loans, early settlement and overpayment costed gross and net of the penalty, the payment journal with its expense-tracker payload, and the per-currency report.", name: "MCP Amortization Pro", price: "price_1UCROyJKCamubEm1eWJBgzIj", usd: 19, pkg: "@theluckystrike/mcp-amortization", bin: "mcp-amortization", payload: "amortization" },
  "petty-cash": { desc: "A petty cash float on the imprest system: a voucher for every receipt out of the tin, a count whenever you like with the difference to the minor unit, and the replenishment that puts the float back to its imprest, with the double entry and an expense_add-ready payload per category. The cheque is imprest minus balance, never the sum of the vouchers, and the difference is its own cash_over_short line. No balance is stored and nothing is posted anywhere.", free: "Free: 1 float, 20 vouchers a calendar month, and reconciliation unlimited on every tier, because whether the cash matches the paperwork is the question this server exists for.", pro: "Pro: unlimited floats and vouchers, the replenishment request with its journal and per-category expense payload, and the float report with the history of every difference a count found.", name: "MCP Petty Cash Pro", price: "price_1UCTn3JKCamubEm1IUHxx0kC", usd: 19, pkg: "@theluckystrike/mcp-petty-cash", bin: "mcp-petty-cash", payload: "petty-cash" },
  "work-order": { desc: "Job orders for trades and field work, kept the way a job card is kept: a client the invoice server already knows, a site address, labour as hours at a rate and parts as a quantity at a unit cost with an optional markup, a status that moves one step at a time with every step dated, a completion report with a sign-off block, and an invoice_create-ready payload. No total is stored: value, hours, materials and VAT are derived from the lines on every call.", free: "Free: 5 open work orders, 200 lines each, and the text completion report on every tier. Closing a job frees its slot, and deleting an empty draft is free on every tier.", pro: "Pro: unlimited open work orders, the A4 completion report PDF with the sign-off block, the invoice payload, and the board report with hours this month and unbilled value per currency.", name: "MCP Work Order Pro", usd: 19, pkg: "@theluckystrike/mcp-work-order", bin: "mcp-work-order", payload: "work-order" },
  "catalogue": { desc: "One price list and one labour rate card, kept where the invoice and the quote servers can both read them. A SKU carries a code, a unit, an optional VAT rate and price ROWS with valid-from dates, so the price on a date is worked out on the call and raising a price in July does not rewrite what June was quoted at. lines_resolve hands back the same lines already priced, in the invoice_create argument shape and in the quote_create argument shape at once. Nothing is invented: an unknown code is refused by name.", free: "Free: 25 SKUs, the standard price tier, unlimited rate cards, and every text answer including lines_resolve and the plain-text price list. Deleting an unused SKU is free on every tier.", pro: "Pro: an unlimited catalogue, price tiers beyond standard for trade and wholesale columns, the A4 price list PDF, and the catalogue report naming the rows a later row already replaces.", name: "MCP Catalogue Pro", usd: 19, pkg: "@theluckystrike/mcp-catalogue", bin: "mcp-catalogue", payload: "catalogue" },
  "change-order": { desc: "Change orders against a quote or a work order, kept the way a variation is kept on site: added, removed and changed lines with a quantity, a unit price in minor units, a reason and a date; a status that moves draft to sent to approved or rejected with every step dated; the running contract value as the original plus approved deltas, with pending deltas held apart; and the approved delta as invoice_create-ready items in major units and quote_create-ready items in minor units at once. No delta is stored: value and VAT are derived from the lines on every call.", free: "Free: 5 open change orders, 200 lines each, and the running contract value on every tier. Approving, rejecting or voiding one frees its slot, and deleting an empty draft is free on every tier.", pro: "Pro: unlimited open change orders, the change order document for the client to approve, and the invoice-ready delta payload in both scales.", name: "MCP Change Order Pro", usd: 19, pkg: "@theluckystrike/mcp-change-order", bin: "mcp-change-order", payload: "change-order" },
  "delivery-schedule": { desc: "Dated deliverables against a quote, a work order or a change order. Each one carries what is being handed over, the day it is due, its value in minor units, and a status that moves planned to in progress to delivered to accepted, every step with the day it actually happened. late_report answers the question anybody actually asks about a schedule: what has slipped, as at a date you name. Lateness is never stored, because a stored late flag is a fact about the afternoon somebody last ran the report; it is derived on the call against the date you pass. Accepted milestones come back as invoice_create-ready items in MAJOR units and quote_create-ready items in MINOR units in one call, with the scale printed against each.", free: "Free: 3 open schedules and the late report on every tier. Deleting a schedule frees its slot.", pro: "Pro: unlimited open schedules, the delivery schedule document for the client, and the invoice-ready milestone payload in both scales.", name: "MCP Delivery Schedule Pro", usd: 19, pkg: "@theluckystrike/mcp-delivery-schedule", bin: "mcp-delivery-schedule", payload: "delivery-schedule" },
  "packing-list": { desc: "Packing slips for a shipment, kept the way a warehouse keeps one: an order reference, a consignee, cartons with a tare weight in whole grams and outside dimensions in whole centimetres, and goods packed into a named carton one line at a time with a per-unit weight. packing_shortfall reports every line as short, complete, over-packed, or packed and not on the order at all, matched on SKU where there is one and on the description where there is not. carton_report gives tare, net, gross, volume, volumetric and chargeable weight per carton and for the shipment at a divisor of 4000, 5000 or 6000 cm3 per kg. Nothing derived is stored, and the slip carries no prices at all: the invoice against the same order is a different document.", free: "Free: 3 open packing lists, unlimited cartons and lines, and every text answer including the packing slip itself. Marking a list shipped or cancelling it frees its slot, and deleting a draft is free on every tier.", pro: "Pro: unlimited open packing lists, and writing the packing slip to a .txt file with out_path.", name: "MCP Packing List Pro", usd: 19, pkg: "@theluckystrike/mcp-packing-list", bin: "mcp-packing-list", payload: "packing-list" },
  "checklist": { desc: "Checklists you build once and run many times, and the dated record of each run that somebody signs. A run COPIES its checklist's steps when it starts and records the version it copied, so editing the checklist afterwards never rewrites a run already under way and deleting the checklist leaves its runs readable. Each step is marked pass, fail or not applicable, with who marked it, on what day, and a note. Not applicable counts as ANSWERED and never as passed. A required step unanswered or failed blocks the signature; force signs anyway and the exceptions stay on the record and print on the report. No count is stored: every figure is derived on the call.", free: "Free: 3 checklists, and unlimited runs of them on every tier, with every count and the run report text free. Deleting a checklist frees its slot.", pro: "Pro: unlimited checklists, and writing the run report to a .txt file with out_path.", name: "MCP Checklist Pro", usd: 19, pkg: "@theluckystrike/mcp-checklist", bin: "mcp-checklist", payload: "checklist" },
  "bill-of-sale": { desc: "Bills of sale for equipment, vehicles and stock, kept the way the signed paper is kept: parties, the item with its VIN, serial number or IMEI where it has one, the price and the date, an as-is clause and any warranty in the seller's own words, and signature lines for both sides. Work as a draft, finalize into the frozen signing copy, and render Markdown or a single self-contained HTML file that prints to PDF from any browser. Drafts render with a DRAFT watermark, a byte-identical repeat sale is refused with the id already stored, and a finalized document needs confirm_finalized to delete, with the BOS number never reissued. Currencies are never added together and no total is stored.", free: "Free: 10 open drafts and 5 finalized documents, with rendering, listing, reading and deleting unlimited on every tier, because the document itself is never metered.", pro: "Pro: unlimited drafts and unlimited finalized documents.", name: "MCP Bill of Sale Pro", usd: 19, pkg: "@theluckystrike/mcp-bill-of-sale", bin: "mcp-bill-of-sale", payload: "bill-of-sale" },
  "credit-note": { desc: "Credit notes against an invoice or standalone: recipient, reason, line items with quantity, unit price and tax rate, and currency. Every note starts as a draft with a draft id no client sees; finalizing burns the final CN-YYYY-NNNN number in the issue date's year and freezes it, with the counter written before the record so a crash burns a number rather than reusing one, and the final series never has a gap. The line math is round half-up per line then sum, so the printed document reproduces on a calculator and a total can never drift from the printed lines. Renders are Markdown to paste into an email or a self-contained printable HTML page, and the summary totals what was credited per currency, reason and month.", free: "Free: 10 finalized credit notes, lifetime, with drafts, edits, deletion of drafts, listing, reading, rendering and the totals summary unlimited on every tier. Free renders carry a one-line footer.", pro: "Pro: unlimited finalized credit notes and renders without the footer line.", name: "MCP Credit Note Pro", usd: 19, pkg: "@theluckystrike/mcp-credit-note", bin: "mcp-credit-note", payload: "credit-note" },
  "job-card": { desc: "One card per job, the way the paper one on the dashboard works: client, site, what the job is, currency and scheduled date, then hours per worker at their rate and materials per item, each line rounded half-up to the cent once when it is logged so the running totals are sums of stored line values and can never drift. The status machine moves exactly one step at a time, open to in_progress to done to invoiced to archived, with every step dated in the card's history. Printing renders the card with a signature line for client sign-off, and the daily or weekly summary gives cards touched, hours per worker and value per currency, never mixed across currencies.", free: "Free: 10 active job cards, with entries, totals, printing and the summaries unlimited on every tier; a card stops counting the moment it is archived.", pro: "Pro: unlimited active job cards.", name: "MCP Job Card Pro", usd: 19, pkg: "@theluckystrike/mcp-job-card", bin: "mcp-job-card", payload: "job-card" },
  "dunning-letters": { desc: "Chase overdue invoices on an escalation ladder anchored to the due date: reminder 1, reminder 2 and the final notice at configurable gaps, so a letter sent late moves which stage is next and never moves the schedule. Letters go out strictly in order, the late fee is simple interest pro-rata on a 30-day month on what is outstanding the day the letter is written, and part payments lower the ask. letter_render produces Markdown or a self-contained printable HTML page, and nothing is emailed anywhere: the server writes the text and sending it is your act. The overdue list is worst first, the aging buckets the register, and chase_today answers what has to go out today.", free: "Free: 3 unpaid invoices chased at once, with all three letters in both formats, the aging, the chase list and payment recording on every tier; a paid invoice frees its slot.", pro: "Pro: unlimited concurrent chases.", name: "MCP Dunning Letters Pro", usd: 19, pkg: "@theluckystrike/mcp-dunning-letters", bin: "mcp-dunning-letters", payload: "dunning-letters" },
  "supplier-list": { desc: "A supplier directory that does not rot: who you buy from, what they supply, who to contact and how, the payment terms, the lead time in days and notes, with the date each record was last reviewed on it. supplier_list reads the directory A to Z with a category filter and free-text search, supplier_update changes only the fields you pass, and supplier_due_review answers which records have gone stale, most overdue first, with a record never reviewed always due. A second record carrying a name already in the directory is refused, an ambiguous partial name is refused with the candidates, and the SUP number is never reissued. supplier_export hands the directory over as CSV or Markdown.", free: "Free: 10 suppliers, with adding, listing, reading, updating, removing, review stamps and CSV export unlimited on every tier; removing one frees its slot.", pro: "Pro: unlimited suppliers, Markdown export, and the due-review report.", name: "MCP Supplier List Pro", usd: 19, pkg: "@theluckystrike/mcp-supplier-list", bin: "mcp-supplier-list", payload: "supplier-list" },
  "service-agreement": { desc: "Service agreements for freelancers, written before the work starts: the parties, the scope of services, the deliverables, the rate and payment terms, start and end dates, a termination notice period, a liability cap and the governing jurisdiction. agreement_create stores the agreement and returns it rendered as clean Markdown with a signature block, numbered SA-YYYY-NNNN. agreement_checklist lists the missing fields and flags one-sided gaps neutrally before you send it. The status machine moves draft to sent to signed to expired, one dated step at a time, and a built-in clause library covers IP assignment, confidentiality, late payment interest, kill fee and revision rounds. Every render carries the note that it is a template, not legal advice.", free: "Free: 3 active agreements, with reading, listing, the checklist and Markdown rendering unlimited on every tier; expiring a finished engagement frees its slot.", pro: "Pro: unlimited active agreements, the full clause texts with your variables filled in, and print-ready HTML rendering.", name: "MCP Service Agreement Pro", usd: 19, pkg: "@theluckystrike/mcp-service-agreement", bin: "mcp-service-agreement", payload: "service-agreement" },
  "maintenance-log": { desc: "One register of the equipment you look after and the work done on it: asset_add records a machine with its serial or asset tag, location and currency, and maintenance_log records each service with the day, what was done, the cost in whole cents, the technician, and when the next service falls due as a date or an interval in days. maintenance_due answers what is overdue and by how many days and what falls due within the next N days, computed from the stored dates at the moment you ask, so it can never go stale. asset_history keeps the chronological log with total spend and spend per technician, and maintenance_export hands a date range over as CSV or a Markdown summary per asset.", free: "Free: 3 assets, with logging, the per-asset history and CSV export unlimited on every tier; removing an asset frees its slot.", pro: "Pro: unlimited assets, the due report, and the Markdown summaries.", name: "MCP Maintenance Log Pro", usd: 19, pkg: "@theluckystrike/mcp-maintenance-log", bin: "mcp-maintenance-log", payload: "maintenance-log" },
  "mileage-log": { desc: "The mileage log freelancers need at tax time, kept the moment the drive happens: trip_add logs the date, from and to, the distance in miles or km, the purpose and the category, and rate_set records what one mile or km is worth per category and jurisdiction as an effective-dated series, so each trip earns the rate in force on the day it was driven, rounded half-up to the cent. mileage_summary prices a date range per category with totals per currency, trips with no applicable rate listed with the reason and never silently dropped, and mileage_export is the CSV for the accountant, refusing while any non-personal trip is unpriced. Miles and km are never added together, and no rate ships with the server: the figures are yours to verify, and none of it is tax advice.", free: "Free: 20 trips per calendar month, counted on the month of the trip date, so reconstructing last year's log costs nothing from this month; the list, the summary and one rate per jurisdiction and category included.", pro: "Pro: unlimited trips, the year-over-year rate series, and the CSV export.", name: "MCP Mileage Log Pro", usd: 19, pkg: "@theluckystrike/mcp-mileage-log", bin: "mcp-mileage-log", payload: "mileage-log" },
  onboarding: { desc: "New-hire onboarding as role-based task templates, with a dated checklist per hire that HR and the manager both read.", free: "Free: one hire per template apply, unlimited hires stored, unlimited task add and done, and every read: progress, overdue and hire list.", pro: "Pro: unlimited multi-hire template applies and the CSV export of progress.", name: "MCP Onboarding Pro", usd: 19, pkg: "@theluckystrike/mcp-onboarding", bin: "mcp-onboarding", payload: "onboarding" },
  "backlink-checker": { desc: "Backlink checks from Claude or Cursor: does a page link to your domain, dofollow or nofollow, anchor text, HTTP status, robots guards. Nothing stored.", free: "Free: unlimited single-page link checks and robots guard reads.", pro: "Pro: batch link_audit, one verdict row per page.", name: "MCP Backlink Checker Pro", usd: 19, pkg: "@theluckystrike/mcp-backlink-checker", bin: "mcp-backlink-checker", payload: "backlink-checker" },
  "goods-receipt": { desc: "The receiving record for purchase orders: what arrived, against which line, in what quantity and condition, with the outstanding balance per line derived on every call.", free: "Free: full receiving: create receipts, list them, per-line outstanding quantities and the receipt history.", pro: "Pro: unlimited receipts per period and the CSV export of received-vs-ordered.", name: "MCP Goods Receipt Pro", usd: 19, pkg: "@theluckystrike/mcp-goods-receipt", bin: "mcp-goods-receipt", payload: "goods-receipt" },
  "purchase-requisition": { desc: "Purchase requisitions and dated runs of them: a requisition is built once, each run copies its steps, every step is answered pass, fail or not applicable, and a completed run is signed off.", free: "Free: create requisitions and runs, record pass/fail/n-a results, and read the run summary and sign-off state.", pro: "Pro: unlimited requisitions and runs and the CSV export of results.", name: "MCP Purchase Requisition Pro", usd: 19, pkg: "@theluckystrike/mcp-purchase-requisition", bin: "mcp-purchase-requisition", payload: "purchase-requisition" },
  leave: { desc: "Employee leave and PTO requests: balances, approvals, calendars, and who-is-out summaries.", free: "Free: request and approve leave, balances, who-is-out, the leave calendar and the annual report.", pro: "Pro: unlimited policies and the CSV export of requests and balances.", name: "MCP Leave Pro", usd: 19, pkg: "@theluckystrike/mcp-leave", bin: "mcp-leave", payload: "leave" },
  bundle: { desc: "Every one of the 46 MCP servers in a single lifetime key: finance, documents, tracking and utilities, with all future servers included. Paying for four Pro servers separately costs more than the bundle.", free: "Each server keeps its own free tier.", pro: "Unlimited use of all 46 servers, lifetime, one key.", name: "MCP Servers Bundle (all servers, lifetime)", price: "price_1UBDU9JKCamubEm1dWgRjtoW", usd: 39, pkg: null, bin: null, payload: "*" },
};

/** Every sellable single-server product; `bundle` is the one entry that is not one. */
export const SINGLE_PRODUCT_IDS = Object.keys(PRODUCTS).filter((id) => id !== "bundle");

/**
 * Buyable ids that are not their own PRODUCTS entry, mapped to the product a purchase
 * actually is. Kept out of PRODUCTS on purpose: SERVER_COUNT, BUNDLE_SAVING_USD and every
 * sentence derived from them count sellable servers, and an alias is not a new server.
 *
 * `office-suite` is the flagship aggregator: it spawns time-tracker, price-tracker,
 * spreadsheet and invoice as child processes and forwards one key to all four, and its
 * `license_activate` is all-or-nothing (servers/office-suite/README.md). verifyLicenseKey
 * (src/license.js) accepts a key for a child only when the signed payload is that child's
 * id or the wildcard `*`, so the ONLY key that makes office-suite Pro work is the bundle
 * key, payload `*`. A separate $19 "office-suite" product would mint a key every one of
 * its four children rejects: money taken, nothing unlocked. The bundle at $39 is also
 * cheaper than the 4 x $19 = $76 those children cost singly, so this is the buyer's price
 * as well as the only fulfillable one. Before this, /buy/office-suite was a bare 404 even
 * though docs/HUMAN_GATED_PACK.md ships that exact URL as office-suite's homepage on every
 * directory submission.
 */
export const PRODUCT_ALIASES = { "office-suite": "bundle" };

/**
 * Servers reachable at https://mcp.zovo.one/mcp/<id> with no install. Derived from the
 * servers that declare a remotes[] block in their registry manifest, checked by a test so
 * this list cannot drift from what is actually hosted. office-suite is absent on purpose:
 * it spawns the others as local child processes, which has no meaning on a worker.
 */
export const HOSTED_SERVERS = new Set([
  "amortization",
  "asset-register",
  "bank-statement",
  "barcode",
  "bill-of-sale",
  "billing-docs",
  "calendar",
  "cash-book",
  "catalogue",
  "change-order",
  "checklist",
  "clauses",
  "credit-note",
  "currency",
  "deposits",
  "delivery-schedule",
  "docx",
  "dunning-letters",
  "expense-tracker",
  "goods-receipt",
  "image",
  "invoice",
  "job-card",
  "kanban",
  "leave",
  "maintenance-log",
  "mileage-log",
  "onboarding",
  "packing-list",
  "pdf",
  "per-diem",
  "petty-cash",
  "price-tracker",
  "purchase-requisition",
  "quotes",
  "recurring",
  "resume",
  "service-agreement",
  "spreadsheet",
  "statement-of-account",
  "supplier-list",
  "time-tracker",
  "timezone",
  "work-order",
  "zip",
]);

/** Ed25519 public key for MCP registry domain verification (see /.well-known/mcp-registry-auth). */
/** Tools office-suite exposes, read from the running v0.22.0 bundle over stdio on 2026-09-13
 * (tools/list returned 380 distinct names across 41 children; the asset_add, trip_list and
 * rate_set pairs collided and are prefixed with their server ids by the proxy). The README
 * claimed four children for weeks; this constant exists so the number has one home. */
const OFFICE_SUITE_TOOLS = 380;

const MCP_REGISTRY_AUTH = "v=MCPv1; k=ed25519; p=KY+O0ut45badUE3n6TtwlXj09gkKnTd+/pkY56Y0A9Q=";

/** Pure: the PRODUCTS id a /buy/<id> path sells, or "" when nothing sells it. */
export function resolveProductId(id) {
  if (PRODUCTS[id]) return id;
  const target = PRODUCT_ALIASES[id];
  return target && PRODUCTS[target] ? target : "";
}

/** The number of single-server products, computed rather than typed, so adding a server cannot leave the prose stale. */
export const SERVER_COUNT = SINGLE_PRODUCT_IDS.length;

/** Every single license at $19 each, less the $39 bundle. */
export const BUNDLE_SAVING_USD =
  SINGLE_PRODUCT_IDS.reduce((n, id) => n + PRODUCTS[id].usd, 0) - PRODUCTS.bundle.usd;

const NUMBER_WORD = { 19: "Nineteen", 20: "Twenty", 21: "Twenty-one", 22: "Twenty-two", 23: "Twenty-three", 24: "Twenty-four", 25: "Twenty-five", 26: "Twenty-six", 27: "Twenty-seven", 28: "Twenty-eight", 29: "Twenty-nine", 30: "Thirty" , 31: "Thirty-one", 32: "Thirty-two", 33: "Thirty-three", 34: "Thirty-four", 35: "Thirty-five", 36: "Thirty-six", 37: "Thirty-seven", 38: "Thirty-eight", 39: "Thirty-nine", 40: "Forty", 41: "Forty-one", 42: "Forty-two", 43: "Forty-three", 44: "Forty-four", 45: "Forty-five", 46: "Forty-six" };

/** The server count as a capitalised English word, e.g. "Twenty". Exported so the copy
 * tests can assert the rendered sentence without pinning a number that a new server moves. */
export const countWord = () => NUMBER_WORD[SERVER_COUNT] || String(SERVER_COUNT);

/**
 * The bundle's own one-line description, derived rather than typed. It named nineteen and
 * $322 as literals until billing-docs made both wrong in the same commit; the count and the
 * saving now come from PRODUCTS, so a twenty-first server moves them on its own.
 */
PRODUCTS.bundle.desc =
  `Every server above, one key, lifetime. Saves $${BUNDLE_SAVING_USD} against buying ` +
  `${(NUMBER_WORD[SERVER_COUNT] || String(SERVER_COUNT)).toLowerCase()}.`;

/**
 * The line under the product name on the Stripe hosted checkout page. Stripe renders a
 * line item's description from the Product's `description`, not from anything the
 * Session can pass alongside a `price` id, so this string is the single source of truth
 * for both: the Session builder sends nothing, and `stripe-sync` below (run by hand with
 * a live key) writes exactly this onto each Product.
 *
 * Audit finding (docs/CHECKOUT_AUDIT.md): before this, the hosted page said only
 * "Pro license for the MCP Invoice server. One-time, lifetime." - the server count and
 * the $322 bundle saving appeared nowhere the buyer could see them.
 */
export function checkoutDescription(productId) {
  const p = PRODUCTS[productId];
  if (!p) throw new Error(`unknown product: ${productId}`);
  const word = NUMBER_WORD[SERVER_COUNT] || String(SERVER_COUNT);
  if (productId === "bundle") {
    return `${word} MCP servers for Claude, one lifetime key, saves $${BUNDLE_SAVING_USD} against buying singly`;
  }
  return `Lifetime key for ${p.name}. The ${word.toLowerCase()}-server bundle is $${PRODUCTS.bundle.usd}`;
}

/**
 * Checkout Session `custom_text`. Two messages the buyer reads before and after the
 * pay button:
 *
 * - `submit`: on a single-server session this is the bundle cross-sell. Stripe has no
 *   `cross_sells` parameter on a Product (probed live: `parameter_unknown`). The Session
 *   *does* accept `optional_items`, and that is deliberately not used: an accepted
 *   optional item makes the Session carry two line items, which `fulfillmentAllowed`
 *   rejects, so the buyer would be charged $58 and minted nothing.
 * - `after_submit`: how the key actually arrives. Nothing is emailed - the key is on the
 *   /success page - and a hosted tenant is bound automatically. That was previously
 *   discoverable only after paying.
 */
export function checkoutCustomText(productId, askedId = productId) {
  const p = PRODUCTS[productId];
  if (!p) throw new Error(`unknown product: ${productId}`);
  const word = NUMBER_WORD[SERVER_COUNT] || String(SERVER_COUNT);
  // An alias buyer clicked one name and is being shown another on the payment page. Say
  // why on the page itself rather than letting them discover it on the receipt.
  const aliasNote = askedId !== productId && PRODUCT_ALIASES[askedId] === productId
    ? `You clicked ${askedId}. ${askedId} runs its sibling servers as child processes and forwards one key to all of them, so the only key that turns it Pro is this bundle key. It costs less than those servers do singly, and it unlocks the other ${SERVER_COUNT - 1} too. `
    : "";
  const submit = productId === "bundle"
    ? `${aliasNote}One payment, one lifetime key for all ${SERVER_COUNT} servers. Saves $${BUNDLE_SAVING_USD} against buying them singly.`
    : `Buying more than one? All ${SERVER_COUNT} servers are $${PRODUCTS.bundle.usd} together, a $${BUNDLE_SAVING_USD} saving: https://mcp.zovo.one/buy/bundle?src=checkout.crosssell.${productId}`;
  const after_submit =
    `Your license key is shown on the confirmation page immediately after payment. It is not emailed, ` +
    `so copy it from that page; the same URL always shows the same key. If you started from a hosted ` +
    `mcp.zovo.one endpoint, that endpoint is upgraded to Pro automatically, with nothing to paste. ` +
    `Bought some other way and already using a hosted endpoint? Run license_activate with the key there ` +
    `and Pro applies to the connection you are on, so the data already stored under it stays put.`;
  return { submit, after_submit };
}

const REPO = "https://github.com/theluckystrike/mcp-servers";

/**
 * The last validation run in data/validation.json, which is 9.2 MB and cannot be bundled
 * into a Worker. It is restated here in the one shape the pages need, and
 * test/checkout-r1.test.mjs recomputes every field from that file and fails if they
 * disagree - so the numbers are pinned to their source rather than typed and forgotten.
 * The home page previously claimed "399 of 399" against a real 951 of 951, and named
 * "Seventeen" servers when there were thirty.
 */
export const VALIDATION = { at: "2026-09-20", pass: 1244, total: 1244, servers: 45, medianMs: 514 };

/**
 * Unit tests in billing/test. Restated for the same reason as VALIDATION and pinned the
 * same way: test/checkout-r1.test.mjs counts the `test(` declarations on disk and fails
 * if this disagrees. The page said 25 when there were 99.
 */
export const BILLING_TEST_COUNT = 156;
/**
 * The npm publish is pending: `npx -y @theluckystrike/mcp-<server>` returns E404 today,
 * and publishing needs an operator browser login (docs/HUMAN_GATED_PACK.md section 1).
 * Every /s/ and /setup page already disclosed this; the home page, /bundle and, worst of
 * all, the /success page a customer reads seconds after paying, did not. One constant, so
 * a page cannot be corrected without correcting all of them - and so the day the packages
 * publish, one edit removes the caveat everywhere.
 */
export const NPM_PENDING_NOTE =
  `The npm publish of these packages is pending, so <code>npx -y @theluckystrike/mcp-&lt;server&gt;</code> returns 404 ` +
  `for everyone, and a client config whose <code>"command"</code> is <code>"npx"</code> will not start a server. ` +
  `Use the hosted URL, the <code>.mcpb</code> bundle from <a href="${REPO}/releases/latest">the latest release</a>, ` +
  `or a clone and build, which all work today.`;

/**
 * Site-ownership keys served at `/<key>.txt`. The body is the key and nothing else.
 * - 22fad93b...: the earlier verification key this worker already served.
 * - db6dbf5c...: IndexNow (data/indexnow.json), the free no-account URL push to Bing,
 *   Yandex, Seznam and Naver. Do not change it: the key in the file and the key at the
 *   URL must be the same string or every submitted URL is rejected.
 */
export const SITE_KEY_FILES = new Set([
  "22fad93b71a88e2e60acae203c4288ae",
  "db6dbf5cfdbc08d1cc9b5365d398145b",
]);

const GUIDE_LINKS = Object.entries(GUIDES)
  .map(([slug, g]) => `<a href="/guides/${slug}">${esc(g.title)}</a>`)
  .join(" &middot; ") + ` &middot; <a href="/guides">All guides</a>`;

// T15 fix 1: a priority-guide block emitted immediately after <body> on every page.
// T15 measured the crawl gap: 95 of 109 guides were never fetched by any major crawler
// in 7d, yet every guide is linked from the homepage and /guides hub -- so the constraint
// is crawl budget, not linkage. Crawlers weight links near the top of the DOM, and this
// block puts 10 measured guides (top by 7d total visits in data/traffic.json, the same
// file scripts/traffic.mjs writes) within the first bytes of every rendered page. Kept
// visually small so it does not push real content down. Regenerate the list when
// data/traffic.json is re-measured: node scripts/gen-priority-guides.mjs.
const PRIORITY_GUIDES = [
  "contract-clauses-library-assembly",
  "zip-archives-safely-from-chat",
  "read-excel-in-cursor",
  "connect-mcp-servers-without-installing",
  "invoice-pdf-from-chat",
  "quotes-and-estimates-to-invoice-in-claude",
  "image-resize-compress-watermark-from-chat",
  "expense-tracking-in-claude",
  "recurring-invoices-on-a-schedule",
  "resume-and-cover-letter-from-chat",
];

// T15 fix 4: featured-servers block rendered on guide pages. Guides take the crawler
// and human traffic (measured: /s/spreadsheet 66, /s/invoice 23, /s/expense-tracker 21
// human-verified 7d), but before this block a guide linked products only through a small
// footer line. Featured pages are the top human-verified /s/ routes from
// data/traffic.json; regenerate with node scripts/gen-featured-servers.mjs. GUIDE_ONLY
// pages (no price of their own) still earn the link: they funnel into the bundle.
const FEATURED_SERVERS = [
  "spreadsheet",
  "invoice",
  "expense-tracker",
  "recurring",
  "docx",
  "bill-of-sale",
  "zip",
  "job-card",
];

/**
 * Pure fulfillment decision (review #3, #8). No I/O: the caller passes a Checkout
 * Session already retrieved with expand[]=line_items.
 * Mint only when the session is a completed one-time payment for exactly the
 * Price ID configured for `product`, at the expected amount. A 100% promotion
 * code yields payment_status "no_payment_required" with amount_total 0; that is
 * accepted only when the recorded discount equals the full expected amount.
 */
export function fulfillmentAllowed(session, product) {
  const p = PRODUCTS[product];
  if (!p) return { ok: false, reason: `unknown product: ${product}` };
  if (!session || typeof session !== "object") return { ok: false, reason: "no session" };
  if (session.mode !== "payment") return { ok: false, reason: `mode is ${session.mode}, not payment` };
  if (session.status !== "complete") return { ok: false, reason: `session status is ${session.status}, not complete` };
  if (session.metadata?.product !== product) return { ok: false, reason: "session metadata product mismatch" };

  const items = session.line_items?.data;
  if (!Array.isArray(items) || items.length !== 1) return { ok: false, reason: "expected exactly one line item" };
  const item = items[0];
  if (item.quantity !== 1) return { ok: false, reason: `quantity is ${item.quantity}, not 1` };
  // Identity of what was bought. A product with a configured Price id must match it
  // exactly. A product priced inline with `price_data` has an ad-hoc Price created at
  // Session time whose id nobody can know in advance, so the binding is the one thing a
  // buyer cannot touch: `metadata.product`, which this worker wrote when it created the
  // Session and which is asserted above. What is still checked here is that the item is a
  // real one-time Price rather than a subscription or a zero-priced stand-in. Without this
  // branch every inline-priced sale would take the money and then refuse the key on
  // "price undefined is not the price for <id>".
  if (typeof p.price === "string" && p.price.startsWith("price_")) {
    if (item.price?.id !== p.price) return { ok: false, reason: `price ${item.price?.id} is not the price for ${product}` };
  } else {
    if (typeof item.price?.id !== "string" || !item.price.id.startsWith("price_")) return { ok: false, reason: "line item has no Stripe price" };
    if (item.price?.type !== "one_time") return { ok: false, reason: `price type is ${item.price?.type}, not one_time` };
  }

  const expected = p.usd * 100;
  if (item.price?.unit_amount !== expected) return { ok: false, reason: "price unit_amount changed" };
  if ((session.currency || item.currency) !== "usd") return { ok: false, reason: "currency is not usd" };

  if (session.payment_status === "paid") {
    if (session.amount_total !== expected) return { ok: false, reason: `amount_total ${session.amount_total} is not ${expected}` };
    return { ok: true, reason: "paid" };
  }
  if (session.payment_status === "no_payment_required") {
    if (session.amount_total !== 0) return { ok: false, reason: "zero-total session with a nonzero amount_total" };
    if (session.total_details?.amount_discount !== expected) return { ok: false, reason: "discount does not cover the full price" };
    return { ok: true, reason: "100% promotion code" };
  }
  return { ok: false, reason: `payment_status is ${session.payment_status}` };
}

/** Anonymous hosted-endpoint token shape, matches remote/src/index.ts. */
const TENANT_RE = /^anon_[0-9a-f]{32}$/;

/** Pure: is this a well-formed anonymous tenant token? */
export function validTenant(tenant) {
  return typeof tenant === "string" && TENANT_RE.test(tenant);
}

/**
 * Pure: decide whether a fulfilled purchase should write a hosted `bind:<tenant>`
 * record. Only a valid tenant token on an already-fulfilled session binds; an
 * absent or malformed tenant (someone typed `/buy/x?tenant=`) mints the key
 * normally but writes nothing to the shared KV.
 */
export function bindDecision(session, fulfilled) {
  if (!fulfilled) return { bind: false, reason: "not fulfilled" };
  const tenant = session?.metadata?.tenant;
  if (!validTenant(tenant)) return { bind: false, reason: "no valid tenant" };
  return { bind: true, tenant };
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * OpenGraph tags for social/link previews. Every page already emits a meta
 * description and a canonical link; OG mirrors those two plus the title and URL
 * so a shared link renders a real preview card instead of a bare URL. No og:image
 * is emitted because this site has no per-page image asset and fabricating one
 * would be worse than omitting it. type defaults to website; product pages pass
 * "product" and article pages pass "article".
 */
function og(title, description, url, type = "website") {
  // Twitter Card mirrors the OG values so a shared link renders on X as well as on the
  // OG-consuming networks. The site has no og:image anywhere (no per-page image asset;
  // fabricating one would be worse than omitting it), so summary is the card type, never
  // summary_large_image. Added additively in T13; the OG tags above are unchanged.
  const tw = `<meta name="twitter:card" content="summary"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description).slice(0, 155)}">`;
  return `<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description).slice(0, 155)}"><meta property="og:url" content="${esc(url)}"><meta property="og:type" content="${type}"><meta property="og:site_name" content="MCP Servers by theluckystrike">${tw}`;
}

/**
 * ItemList JSON-LD for suite hub pages. Each list item names a per-server page with
 * its own URL, so search engines see the hub as a structured collection pointing at
 * the pages that actually rank. Added in R13 — the three /suites/* pages previously
 * shipped with zero structured data while every /s/<id> page already carried
 * SoftwareApplication schema.
 */
function hubItemList(name, url, serverIds) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    url,
    itemListElement: serverIds.map((id, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://mcp.zovo.one/s/${id}`,
      name: PAGES[id] ? PAGES[id].title : id,
    })),
  };
}

/**
 * Progressive copy button for every `<pre class="prompt">` block (guide pages, the
 * bundle page and the /s/<id> "First five minutes" sections). No CSP header is set
 * on this service (grepped: none), so a plain inline script is fine; if one is ever
 * added, it needs a nonce or hash here rather than loosening the policy. Without
 * JavaScript the `<pre class="prompt">` blocks render exactly as before, just without
 * the button: this script only adds to the DOM, it never changes what is already
 * there. One string, included once in the shared page shell below.
 */
const COPY_BUTTON_SCRIPT = `<script>(function(){
function init(){
  var blocks = document.querySelectorAll("pre.prompt");
  for (var i = 0; i < blocks.length; i++) {
    var pre = blocks[i];
    if (pre.dataset.copyReady) continue;
    pre.dataset.copyReady = "1";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy-btn";
    btn.textContent = "Copy";
    btn.addEventListener("click", (function(pre, btn){
      return function(){
        var text = pre.textContent;
        var done = function(){
          btn.textContent = "Copied";
          setTimeout(function(){ btn.textContent = "Copy"; }, 2000);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, done);
        } else {
          var ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand("copy"); } catch (e) {}
          document.body.removeChild(ta);
          done();
        }
      };
    })(pre, btn));
    pre.insertAdjacentElement("afterend", btn);
  }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
})();</script>`;

// Freshness validator for crawlers: every content page carries Last-Modified = the
// newest CHANGELOG release date (the same honest site-wide value the sitemap lastmod
// uses -- every release redeploys every page from this source) and a content-derived
// strong ETag so a conditional GET can revalidate instead of refetching the full body.
// The ETag is a SHA-256 of the rendered body (first 16 hex chars, quoted), so it is a
// genuine validator: it changes iff the body changes, and it is strong (no W/ prefix).
// The previous value was runtime-static ('"'+d8(lm)+'-v3"') and Cloudflare's validator
// classifier never put it on the wire (docs/T5_FIXES_R1.md §4b); a content-derived
// strong ETag is the fix.
function siteLastModified() {
  const d = ((CHANGELOG && CHANGELOG.releases) || []).map((r) => r && r.date).find((x) => /^\d{4}-\d{2}-\d{2}$/.test(x || ""));
  return d ? new Date(d + "T00:00:00Z").toUTCString() : undefined;
}
async function contentHeaders(body, extra = {}) {
  const lm = siteLastModified();
  const h = { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600", ...extra };
  if (lm) h["last-modified"] = lm;
  if (typeof body === "string" && body.length > 0) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
    // Weak ETag: Cloudflare strips STRONG ETags from compressed (gzip/brotli) HTML
    // responses but preserves weak ones. Verified live 2026-09-18: SHA-256 strong
    // ETag never reached the wire on origin; llms.txt (text/plain, uncompressed)
    // ETag survives. A W/ ETag is still a valid revalidation validator for crawlers.
    h.etag = 'W/"' + hex + '"';
  }
  return h;
}
function d8(s) { return String(s).replace(/[^0-9a-z]/gi, "").slice(0, 12).toLowerCase(); }
function llmsHeaders() {
  const h = { "content-type": "text/plain; charset=utf-8" };
  const lm = siteLastModified();
  if (lm) { h["last-modified"] = lm; h.etag = '"' + d8(lm) + '-llms"'; }
  return h;
}
function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<!-- Twitter Card fallback so every rendered page carries a card; handlers that emit OG also
emit a richer twitter:title + twitter:description via the og() helper, which simply repeats
these two harmless values. card is summary: the site has no og:image asset. Added in T13. -->
<meta name="twitter:card" content="summary"><meta name="twitter:title" content="${esc(title)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600&family=Space+Mono&display=swap">
<style>
:root{color-scheme:dark;--bg:#0a0a0a;--fg:#e8e8e8;--mut:#888;--bd:#222;--ac:#06b6d4;--ok:#22c55e;--warn:#eab308;--pur:#a855f7;--red:#ef4444}
body{background:var(--bg);color:var(--fg);font:16px/1.6 "IBM Plex Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:860px;margin:0 auto;padding:32px 20px}
h1,h2,h3,th{font-family:"Space Mono",ui-monospace,Menlo,monospace}
h1{font-size:32px;margin:0 0 12px;letter-spacing:-.5px}h2{font-size:19px;margin:32px 0 8px;color:var(--fg)}
a{color:var(--ac);text-decoration:none}a:hover{text-decoration:underline}
.muted{color:var(--mut)}
table{border-collapse:collapse;width:100%;margin:20px 0;font-size:14px}
td,th{text-align:left;padding:10px 8px;border-bottom:1px solid var(--bd);vertical-align:middle}
th{color:var(--mut);text-transform:uppercase;font-size:11px;letter-spacing:.8px;border-bottom:2px solid var(--bd)}
tbody tr:nth-child(even){background:#111}
td p{margin:.4em 0}
a.buy{display:inline-block;padding:7px 14px;border:1px solid var(--ac);border-radius:0;color:var(--ac);text-decoration:none;font-weight:600;white-space:nowrap;font-size:13px}
a.buy:hover{background:var(--ac);color:var(--bg);text-decoration:none}
button.buy{display:inline-block;padding:9px 16px;border:1px solid var(--ac);border-radius:0;background:transparent;color:var(--ac);font:inherit;font-size:13px;font-weight:600;cursor:pointer}
button.buy:hover{background:var(--ac);color:var(--bg)}
pre{background:#111;border:1px solid var(--bd);padding:12px;border-radius:0;overflow-x:auto;font-size:13px}
code{font-family:"Space Mono",ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.92em}
.key{font-size:13px;word-break:break-all;user-select:all;color:var(--warn)}
footer{margin-top:48px;font-size:13px;color:var(--mut);border-top:1px solid var(--bd);padding-top:16px}
nav.pg{font-size:12px;margin:0 0 24px;color:var(--mut)}
nav.pg a{margin-right:2px}
p.feat{font-size:14px;background:#111;border:1px solid var(--bd);padding:10px 12px;border-radius:0;margin:0 0 20px}
.copy-btn{display:inline-block;margin:-8px 0 4px;padding:3px 10px;font-size:12px;line-height:1.6;border:1px solid var(--bd);border-radius:0;background:transparent;color:var(--fg);cursor:pointer;font-family:inherit}
.copy-btn:hover{border-color:var(--ac);color:var(--ac)}
a.grid{display:inline-block;width:31%;min-width:200px;margin:0 1% 6px 0;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;vertical-align:top}
.lede{font-size:15px;color:var(--fg);margin:.4em 0 0}
.det{font-size:13px;color:var(--mut);margin:.3em 0 0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
@media(max-width:640px){a.grid{width:100%}}
</style></head><body><nav class="pg" aria-label="Popular guides">${PRIORITY_GUIDES.filter((s) => GUIDES[s]).slice(0, 10).map((s) => `<a href="/guides/${s}">${esc(GUIDES[s].title)}</a>`).join(" &middot; ")}</nav>${body}
<footer>Home: <a href="/">All servers</a> &middot; <a href="/guides">Guides</a> &middot; <a href="/setup">Setup</a> &middot; <a href="/compare">Compare</a> &middot; <a href="/changelog">Changelog</a> &middot; <a href="https://tg.zovo.one">Tiny Telegram Tools</a> &middot; Support: support@zovo.one &middot; Built by <a href="${REPO}">theluckystrike</a></footer>
${COPY_BUTTON_SCRIPT}
</body></html>`;
}

const HOME_DESCRIPTION =
  `${LISTED_COUNT} MCP servers for Claude: invoicing, time tracking, expenses, spreadsheets and more for freelancers and small businesses. Free tier needs no key. Connect by URL in under a minute, or install the .mcpb. Bundle $${PRODUCTS.bundle.usd} lifetime, or $${PRODUCTS[SINGLE_PRODUCT_IDS[0]].usd} per server.`;

const SERVER_IDS = Object.keys(PRODUCTS).filter((id) => id !== "bundle");

// One-line descriptions pulled from each server's README (servers/*/README.md), used by the
// /servers landing page. Kept in sync with the fleet; each entry is the first descriptive
// sentence of the README, trimmed to a single line. SEO_R1.
const SERVER_DESCS = {
  amortization: "Loan and lease schedules for an AI assistant.",
  "asset-register": "Keep a fixed asset register and depreciate it on the rates the tax authorities actually publish.",
  "backlink-checker": "Backlink checking for solopreneurs and small studios: does a page link to your domain, dofollow or nofollow, with anchor text and HTTP status.",
  "bank-statement": "Export the CSV from your bank, say \"import this\", and the month is readable.",
  barcode: "Make a QR code or a barcode in the conversation you are already in.",
  "bill-of-sale": "Record a sale and get a signed-paper-ready bill of sale.",
  "billing-docs": "Credit notes and purchase orders, on the same engine as your invoices.",
  calendar: "Your calendar app can show you next Tuesday; this server tells you where your week actually went.",
  "cash-book": "One double-entry ledger over the books you already keep.",
  catalogue: "One price list and one rate card, kept where the invoice and the quote can both read them.",
  "change-order": "Change orders against a quote or a work order, kept the way a variation is kept on site.",
  checklist: "Checklists you build once and run many times, with the dated record of each run that somebody signs.",
  clauses: "Say \"draft a service agreement for Beta Corp, 4,500 EUR, 14-day terms\" and get a real .docx built from your own clause library.",
  "credit-note": "Credit notes (credit memos) for freelancers and small businesses, kept the way the paperwork keeps them.",
  currency: "Ask your assistant what something is worth in another currency and get a real answer with a date on it.",
  "delivery-schedule": "Dated deliverables against a quote, a work order or a change order.",
  deposits: "Security and retainer deposits, held per client, on the same engine as your invoices.",
  docx: "Say \"write a proposal for Beta Corp, checkout rebuild, 4,500 EUR, three phases\" and get a real .docx you can send.",
  "dunning-letters": "Chase overdue invoices without losing the thread.",
  "expense-tracker": "Say \"12.30 euros at Adobe, software, billable to Acme\" and it is logged, categorised, VAT-split and ready to rebill.",
  "goods-receipt": "Purchase orders and the goods-receipt notes that receive them.",
  image: "Say \"make these five photos 1200 pixels wide\" or \"shrink this screenshot and strip the GPS out of it\" and it happens, on your machine, in a second.",
  invoice: "Create numbered invoices with tax lines and a real PDF from chat, no invoicing SaaS required.",
  "job-card": "One card per job, the way the paper one on the dashboard works.",
  kanban: "A task board for each of your projects, driven from your AI chat.",
  leave: "Employee leave/PTO tracking for solopreneurs and small studios: who is off, when, and how many days each person has left.",
  "maintenance-log": "A maintenance log for the workshop, rental flats, van fleet or studio: one local register of every piece of equipment and the work done on it.",
  "mileage-log": "A mileage tracker that keeps the log freelancers need at tax time, the moment the drive happens instead of reconstructed from memory in April.",
  "office-suite": "One install for the whole freelancer office.",
  onboarding: "New-hire onboarding as role-based task templates, with a dated checklist per hire.",
  "packing-list": "The packing slip for a shipment, and the answer to the only two questions anybody asks while packing one: what is in which box, and what is still to pack.",
  pdf: "Small PDF jobs done in chat: merge, split, rotate, stamp PAID, add a footer, count pages and read text back.",
  "per-diem": "Work out the daily travel allowance for a business trip on the rate tables the tax authorities actually publish, and keep the trips you priced.",
  "petty-cash": "A petty cash float, kept the way the paperwork keeps it.",
  "price-tracker": "Ask your assistant what something costs right now.",
  "purchase-requisition": "Purchase requisitions you build once and run many times, with the dated record of each run that somebody signs.",
  quotes: "Say \"quote Acme for 12 hours at 90 EUR plus a 300 EUR setup, 23% VAT, good for 14 days\" and get a numbered quote you can send today.",
  recurring: "Say \"bill Acme 12 hours at 90 EUR on the 1st of every month\" once, and stop remembering it.",
  resume: "Store your CV facts once, then tailor your resume to a posting and write the cover letter.",
  "service-agreement": "An mcp service agreement writer for freelancers who are about to start client work and do not want to copy a rotting template off the internet again.",
  spreadsheet: "Hand your AI assistant a spreadsheet and talk to it.",
  "statement-of-account": "Send a client the one document that answers \"what do I actually owe you\".",
  "supplier-list": "This is the mcp supplier list server: a supplier directory inside your MCP client that does not rot the way the spreadsheet does.",
  "time-tracker": "Track billable time without leaving your AI chat.",
  timezone: "Work with clients in other countries without doing time zone arithmetic in your head.",
  "work-order": "Job orders for trades and field work, kept the way a job card is kept.",
  zip: "Make a zip, look inside one, and unpack one, in the conversation you are already in.",
};

// Human-readable landing page listing every server with a one-line description from its README.
// Served at /servers (SEO_R1). The root / homepage remains the commercial entry point; this page
// is the crawlable, description-rich index of the whole fleet.
function serversPage() {
  const rows = Object.keys(SERVER_DESCS).sort().map((id) =>
    `<tr><td><a href="/s/${id}">${esc(id)}</a></td><td>${esc(SERVER_DESCS[id])}</td></tr>`
  ).join("");
  const body = `
<h1>All ${Object.keys(SERVER_DESCS).length} MCP servers</h1>
<p class="muted">Every server in the mcp.zovo.one fleet, with a one-line description from its README. Each has a free tier that needs no key — connect by URL in under a minute.</p>
<table>
<thead><tr><th>Server</th><th>What it does</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<p><a href="/">Back to the homepage</a></p>`;
  return page("All MCP servers on mcp.zovo.one", body);
}

function home() {
  // One row per server directory, not per priced product: office-suite is a server with no
  // price of its own and it belongs in a list of what you get. The URL column carries the
  // form that actually runs a tool. The bare https://mcp.zovo.one/mcp/<server> answers
  // initialize and tools/list without a credential and returns 401 on tools/call, measured
  // 2026-09-10, so printing it here without the token segment would hand a reader a URL
  // that fails on their first call.
  const hosted = new Set(HOSTED_ID_LIST);
  const answerRows = LISTED_IDS.map((id) => {
    const p = PRODUCTS[id];
    const pg = PAGES[id];
    const name = p ? p.name.replace(/ Pro$/, "") : (pg ? pg.title : id);
    const what = p ? p.desc : (pg ? pg.tagline : "");
    // Split each description at the first colon: the lead clause before it becomes the
    // one-line summary the eye lands on; the detail after it drops to a muted second line.
    // Descriptions that are themselves multi-sentence essays (no short lead before the
    // colon) fall back to the first sentence as the lede so no cell carries a 600-char wall.
    const ci = what.indexOf(": ");
    let lede, det;
    if (ci > 0 && ci <= 90) {
      lede = what.slice(0, ci);
      det = what.slice(ci + 2);
    } else {
      const si = what.search(/[.!?] /);
      lede = si > 0 ? what.slice(0, si + 1) : what;
      det = si > 0 ? what.slice(si + 2) : "";
    }
    const whatHtml = `<p class="lede">${esc(lede)}</p>${det ? `<p class="det">${esc(det)}</p>` : ""}`;
    const url = hosted.has(id)
      ? `<code>https://mcp.zovo.one/mcp/${esc(id)}/t/&lt;token&gt;</code>`
      : `<span class="muted">No URL yet. Bundle or clone.</span>`;
    const price = p ? `$${p.usd}` : `<span class="muted">In the $${PRODUCTS.bundle.usd} bundle</span>`;
    return `<tr><td><a href="/s/${esc(id)}">${esc(name)}</a></td><td>${whatHtml}</td><td>${url}</td><td>${price}</td></tr>`;
  }).join("\n");
  const rows = Object.entries(PRODUCTS).map(([id, p]) =>
    `<tr><td><strong>${p.pkg ? `<a href="/s/${esc(id)}">${esc(p.name)}</a>` : esc(p.name)}</strong><br>${esc(p.desc)}<br><span class="muted">${esc(p.free)} ${esc(p.pro)}</span>${p.pkg ? `<br><span class="muted">Install: <code>npx -y ${esc(p.pkg)}</code> &middot; <a href="${REPO}/tree/main/servers/${esc(id)}#readme">docs</a></span>` : ""}</td>
<td>$${p.usd}</td><td><a class="buy" href="/buy/${id}?src=store.home.table.${id}">Buy</a></td></tr>`).join("\n");
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "MCP Servers Bundle",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "macOS, Windows, Linux",
      description: HOME_DESCRIPTION,
      url: "https://mcp.zovo.one/",
      author: { "@type": "Person", name: "theluckystrike", url: "https://github.com/theluckystrike" },
      offers: [
        { "@type": "Offer", price: "0", priceCurrency: "USD", name: "Free tier, any server" },
        { "@type": "Offer", price: "19", priceCurrency: "USD", name: "Pro, one server, lifetime" },
        { "@type": "Offer", price: "39", priceCurrency: "USD", name: "Pro bundle, all servers, lifetime" },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "MCP servers for Claude",
      itemListElement: SERVER_IDS.map((id, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `https://mcp.zovo.one/s/${id}`,
        name: PRODUCTS[id].name,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "MCP Servers by theluckystrike",
      url: "https://mcp.zovo.one/",
      sameAs: ["https://github.com/theluckystrike"],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "MCP servers for Claude",
      url: "https://mcp.zovo.one/",
      publisher: {
        "@type": "Organization",
        name: "theluckystrike",
        url: "https://github.com/theluckystrike",
      },
      // No SearchAction: the worker has no /search route (checked T13), so pointing one at a
      // search template that does not exist would be a broken signal for search engines.
    },
  ].map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("");
  const meta = `<meta name="description" content="${esc(HOME_DESCRIPTION).slice(0, 155)}"><link rel="canonical" href="https://mcp.zovo.one/">${ld}`;
  const html = page("MCP servers for Claude: invoices, time tracking and freelance tools", `<h1>${LISTED_COUNT} MCP servers for Claude, for freelancers and small businesses</h1>
<p>Each row below is one MCP server. ${HOSTED_COUNT} of the ${LISTED_COUNT} answer at a URL, so you can use them with nothing installed. Get a free token with one request, then paste the URL into whatever asks for a remote MCP server.</p>
<pre><code>curl -X POST https://mcp.zovo.one/mcp/token</code></pre>
<p>It returns a token shaped <code>anon_&lt;32 hex&gt;</code>. No account, no email, no OAuth. The token is good for ${ANON_TOKEN_DAYS} days and allows ${RATE_LIMIT_FREE} calls an hour. The two servers with no URL run from the <a href="${REPO}/releases/latest">.mcpb bundle</a> or a clone.</p>
<h2>Every server, what it does, and the URL to paste</h2>
<table><tr><th>Server</th><th>What it does</th><th>Paste this URL</th><th>Pro</th></tr>${answerRows}</table>
<p>Free tier on every one of them, with no key, no account and no expiry. Pro is $${PRODUCTS[SINGLE_PRODUCT_IDS[0]].usd} once for one server or $${PRODUCTS.bundle.usd} once for all ${LISTED_CHILD_COUNT} sold singly, lifetime, and the key verifies offline. Price arithmetic is at <a href="/bundle">/bundle</a>.</p>
<h2>Four ways to start, three of which work today</h2>
<ol>
<li>Connect by URL, no install: open <a href="/mcp/connect">/mcp/connect</a>, it mints a token and prints a ready URL for every server. Paste that URL into a Claude.ai custom connector, the Claude Desktop connector dialog, Claude Code (<code>claude mcp add --transport http</code>), Cursor, or VS Code. No header, no config file.</li>
<li>Install the .mcpb: download the Claude Desktop bundle from the <a href="${REPO}/releases/latest">releases page</a> and open it; Claude Desktop installs the server.</li>
<li>Install from a clone: <code>git clone</code>, <code>npm install</code>, <code>npm run build -w packages/mcp-license -w servers/&lt;server&gt;</code>, then point your client's <code>command</code> at <code>node</code> and its one argument at the built <code>dist/index.js</code>; exact steps for six clients are on the <a href="/setup">setup pages</a>.</li>
<li>Install with npx, not yet: <code>npx -y @theluckystrike/mcp-&lt;server&gt;</code> is the line the day the npm publish lands. It returns 404 today, so do not paste it into a config expecting a server to start.</li>
</ol>
<p class="muted">Suite hubs: <a href="/suites/freelancer">freelancer</a>, <a href="/suites/documents">documents</a>, <a href="/suites/field-ops">field ops</a>.</p>
<p class="muted">${NPM_PENDING_NOTE} The first three paths above need no npm.</p>
<p>A Pro key removes the free-tier limits on any of these three paths: run <code>license_activate</code> with the key in Claude, set <code>MCP_LICENSE_KEY</code>, or paste the key where the connect-by-URL token goes. Keys verify offline; nothing is sent anywhere after checkout. Refunds within 14 days: support@zovo.one.</p>
<h2>Measured, not claimed</h2>
<p>As of ${VALIDATION.at}: ${VALIDATION.pass} of ${VALIDATION.total} automated checks passing across all ${VALIDATION.servers} servers, ${BILLING_TEST_COUNT} unit tests green on the billing service, and a <code>tools/list</code> call answers at a ${VALIDATION.medianMs}&nbsp;ms median (p50) across those servers. Full detail: <a href="${REPO}/blob/main/data/validation.json">validation.json</a>.</p>
<h2>Free and Pro limits, server by server</h2>
<table><tr><th>Product</th><th>Price</th><th></th></tr>${rows}</table>
<h2>Hosted endpoints</h2><p>No install: <a href="/mcp/connect">/mcp/connect</a> mints an anonymous token and prints a URL per server, <code>mcp.zovo.one/mcp/&lt;server&gt;/t/&lt;token&gt;</code>, that needs no headers. A Pro key can replace the token to remove free-tier limits.</p><h2>How activation works</h2>
<p>After payment you get a key like <code>MCPL1.xxx.yyy</code>. In Claude, run <code>license_activate</code> with the key, or set the environment variable <code>MCP_LICENSE_KEY</code>.</p>
<h2>Setup guides per client</h2>
<p>The exact config file, key and entry for every server in <a href="/setup/claude-desktop">Claude Desktop</a>, <a href="/setup/claude-code">Claude Code</a>, <a href="/setup/cursor">Cursor</a>, <a href="/setup/vscode">VS Code</a>, <a href="/setup/windsurf">Windsurf</a> and <a href="/setup/cline">Cline</a>: <a href="/setup">all 36 setup pages</a>.</p>
<h2>Guides</h2>
<p>${GUIDE_LINKS.split(" &middot; ").map((l) => `<a class="grid" href="${l.match(/href="([^"]+)"/)[1]}">${l.match(/>([^<]+)</)[1]}</a>`).join("")}</p>
<p>Source and docs: <a href="${REPO}">${REPO}</a></p>`);
  return html.replace("</title>", "</title>" + meta);
}

/** Free tier of each server in about five words, for the /bundle table. Hand-written from
 * data/facts.json `servers.<id>.free`, not a truncation of that longer sentence. */
const FREE_FIVE_WORDS = {
  "time-tracker": "Unlimited timers, 7-day report window",
  "price-tracker": "Unlimited checks, three tracked watches",
  spreadsheet: "Reads and queries up to 5,000 rows",
  invoice: "Three invoices a month, footer branding",
  "expense-tracker": "Unlimited logging, 30-day history window",
  currency: "Latest rates, 90-day history window",
  docx: "Unlimited docs, three monthly contracts",
  timezone: "Slots for three people, five contacts",
  resume: "One profile, three cover letters",
  recurring: "Three schedules, 30-day upcoming view",
  clauses: "Starter set plus ten own clauses",
  calendar: "Two calendars, 31-day windows",
  pdf: "Merge five files, thirty pages",
  kanban: "Three projects, 200 open tasks",
  image: "Resize and compress, batches of five",
  "bank-statement": "Two accounts, twelve months of history",
  quotes: "Five open quotes at once",
  barcode: "Twenty codes a month, every symbology",
  zip: "Twenty archives a month, unlimited reading",
  "billing-docs": "Five documents a month, unlimited text",
  deposits: "Five deposits a month, unlimited applying",
  "per-diem": "Five trips a month, unlimited rate lookups",
  "asset-register": "Ten assets, unlimited depreciation schedules",
  "statement-of-account": "Five statements a month, unlimited aging",
  "cash-book": "Three periods a month, unlimited trial balances",
  "amortization": "Three loans, unlimited schedules",
  "petty-cash": "One float, twenty vouchers a month",
  "work-order": "Five open work orders, 200 lines each",
  "catalogue": "Twenty-five SKUs, the standard price tier",
  "change-order": "Five open change orders, the running value free",
  "delivery-schedule": "Five schedules, the late report free",
};

const BUNDLE_DESCRIPTION =
  `${SERVER_COUNT} MCP servers for Claude, one $${PRODUCTS.bundle.usd} key, lifetime. Buying singly is $${SERVER_COUNT * PRODUCTS[SERVER_IDS[0]].usd}, so the bundle saves $${BUNDLE_SAVING_USD}.`;

/**
 * GET /bundle: the case for the $39 key on its own page, separate from the home price
 * table. Every number here is computed from PRODUCTS (SERVER_COUNT, BUNDLE_SAVING_USD),
 * never typed twice, so a twentieth server cannot leave this page's math stale.
 */
export function bundlePage() {
  const singleTotal = SERVER_IDS.reduce((n, id) => n + PRODUCTS[id].usd, 0);
  const rows = SERVER_IDS.map((id) => {
    const tagline = PAGES[id]?.tagline || PRODUCTS[id].desc;
    return `<tr><td><a href="/s/${esc(id)}">${esc(PRODUCTS[id].name.replace(/ Pro$/, ""))}</a></td><td>${esc(tagline)}</td><td>${esc(FREE_FIVE_WORDS[id] || "")}</td></tr>`;
  }).join("\n");
  const canonical = "https://mcp.zovo.one/bundle";
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: PRODUCTS.bundle.name,
      description: BUNDLE_DESCRIPTION,
      url: canonical,
      brand: { "@type": "Person", name: "theluckystrike", url: "https://github.com/theluckystrike" },
      offers: {
        "@type": "Offer",
        price: String(PRODUCTS.bundle.usd),
        priceCurrency: "USD",
        url: `${canonical.replace("/bundle", "")}/buy/bundle?src=store.bundle`,
        availability: "https://schema.org/InStock",
      },
    },
  ].map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("");
  const meta = `<meta name="description" content="${esc(BUNDLE_DESCRIPTION).slice(0, 155)}"><link rel="canonical" href="${canonical}">${ld}`;
  // Numeral, not "Thirty-one". A spelled-out count is the one nobody greps for, and it is
  // how the home page came to contradict itself in words while its numerals disagreed too.
  // billing/test/figures.test.mjs fails on a spelled count on any rendered page.
  const title = `${SERVER_COUNT} MCP servers for Claude, one $${PRODUCTS.bundle.usd} key`;
  const body = `<h1>${esc(title)}</h1>
<p>One lifetime key unlocks Pro on every server below. Bought singly that is ${SERVER_COUNT} &times; $${PRODUCTS[SERVER_IDS[0]].usd} = $${singleTotal}; the bundle is $${PRODUCTS.bundle.usd}, a saving of $${BUNDLE_SAVING_USD}. One key, one payment, no per-server checkout.</p>
<p><a class="buy" href="/buy/bundle?src=store.bundle">Buy the bundle, $${PRODUCTS.bundle.usd}</a></p>
<h2>The ${SERVER_COUNT} servers</h2>
<table><tr><th>Server</th><th>What it does</th><th>Free tier</th></tr>${rows}</table>
<h2>Four ways to start, three of which work today</h2>
<ol>
<li>Connect by URL, no install: open <a href="/mcp/connect">/mcp/connect</a>, it mints a token and prints a ready URL for every server; paste it into a Claude.ai custom connector, the Claude Desktop connector dialog, Claude Code (<code>claude mcp add --transport http</code>), Cursor or VS Code. The bundle key can replace that token on any of them to remove the free-tier limits.</li>
<li>Install the .mcpb: download each server's bundle from the <a href="${REPO}/releases/latest">releases page</a> and open it; Claude Desktop installs the server.</li>
<li>Install from a clone: build once with <code>npm run build</code> and point each client entry's <code>command</code> at <code>node</code> and its one argument at that server's built <code>dist/index.js</code>; exact steps for six clients are on the <a href="/setup">setup pages</a>.</li>
<li>Install with npx, not yet: <code>npx -y @theluckystrike/mcp-&lt;server&gt;</code> is the line the day the npm publish lands. It returns 404 today, so do not paste it into a config expecting a server to start.</li>
</ol>
<p class="muted">Suite hubs: <a href="/suites/freelancer">freelancer</a>, <a href="/suites/documents">documents</a>, <a href="/suites/field-ops">field ops</a>.</p>
<p class="muted">${NPM_PENDING_NOTE} The first three paths above need no npm.</p>
<h2>How the key arrives</h2>
<p>Nothing is emailed. The key is rendered once, on the <code>/success</code> page right after payment; reloading that URL always shows the same key, and <code>/recover?session_id=...</code> gets it back from a lost tab. If you bought while connected through a hosted <code>mcp.zovo.one</code> endpoint, that endpoint's token is bound to Pro automatically, with nothing to paste there (docs/CHECKOUT_AUDIT.md).</p>
<p><a class="buy" href="/buy/bundle?src=store.bundle">Buy the bundle, $${PRODUCTS.bundle.usd}</a></p>
<p><a href="/">All ${SERVER_COUNT} servers priced singly</a> &middot; <a href="/setup">Setup per client</a> &middot; <a href="/guides">Guides</a></p>`;
  return page(title, body).replace("</title>", "</title>" + meta);
}

/**
 * GET /changelog: one section per docs/RELEASE_V*.md, newest first, built at
 * scripts/build-pages.mjs time into CHANGELOG (billing/src/pages.js). Every sentence
 * rendered here is copied from that release's own file, never composed: the evidence
 * line as a short paragraph, the insight line as one quoted sentence, and the GitHub
 * release link. A release whose header carried no date says so rather than guessing one.
 */
export function changelogPage() {
  const title = `Changelog: v${CHANGELOG.currentVersion?.replace(/^v/, "")}, ${CHANGELOG.serverCount} servers`;
  const description = `Every release from v${CHANGELOG.releases[CHANGELOG.releases.length - 1]?.version.replace(/^v/, "")} to ${CHANGELOG.currentVersion}, newest first: what shipped and one measured insight per release.`;
  const sections = CHANGELOG.releases.map((r) => {
    const dateLine = r.date ? ` (${esc(r.date)})` : " (date not recorded in the release file)";
    const insight = r.insightSentence ? `<p><em>"${esc(r.insightSentence)}"</em></p>` : "";
    const link = r.releaseUrl ? `<p><a href="${esc(r.releaseUrl)}">GitHub release ${esc(r.version)}</a></p>` : "";
    return `<h2>${esc(r.version)}${dateLine}</h2>
<p>${esc(r.evidence)}</p>
${insight}${link}`;
  }).join("\n");
  const body = `<p class="muted"><a href="/">Home</a></p>
<h1>Changelog</h1>
<p>Current version ${esc(CHANGELOG.currentVersion)}, ${CHANGELOG.serverCount} servers. ${CHANGELOG.releases.length} releases below, newest first.</p>
${sections}
<p><a href="/">All ${CHANGELOG.serverCount} servers and prices</a> &middot; <a href="${REPO}">Source</a></p>`;
  const meta = `<meta name="description" content="${esc(description).slice(0, 159)}"><link rel="canonical" href="https://mcp.zovo.one/changelog">`;
  return page(title, body).replace("</title>", "</title>" + meta);
}

async function stripe(env, path, params, method = "POST") {
  const init = { method, headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } };
  if (method === "POST") {
    init.headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = new URLSearchParams(params).toString();
  }
  const res = await fetch(`https://api.stripe.com/v1/${path}`, init);
  const json = await res.json();
  if (!res.ok) throw new Error(`stripe ${path}: ${json?.error?.message || res.status}`);
  return json;
}

/**
 * The one line item a Checkout Session is created with.
 *
 * A product that has a Stripe Price id keeps using it: those 28 prices are the live funnel
 * and re-pricing them inline would change nothing for the buyer but would lose the Price
 * object every past receipt points at.
 *
 * A product with no Price id is priced INLINE with `price_data`, which makes Stripe create
 * the Product and the Price implicitly as the Session is created. That needs only
 * `checkout_session_write` on the worker's key, never `product_write`, which is the
 * permission the operator's key lost on 2026-09-06 and the reason work-order, catalogue
 * and change-order served a 503 `x-mcp-buy: price-pending-human` instead of a checkout.
 *
 * It is also the future-proofing: a server added to PRODUCTS tomorrow with `usd` and no
 * `price` gets a working checkout on deploy, with no Dashboard step and no human at all.
 * `unit_amount` is derived from the same `usd` field the storefront prints, so the page
 * price and the charged price cannot drift apart.
 */
export function checkoutLineItem(p) {
  if (typeof p.price === "string" && p.price.startsWith("price_")) {
    return { "line_items[0][price]": p.price, "line_items[0][quantity]": "1" };
  }
  const item = {
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(p.usd * 100),
    "line_items[0][price_data][product_data][name]": p.name,
    "line_items[0][quantity]": "1",
  };
  // Stripe rejects an empty description; the storefront one-liner is trimmed to a length
  // Checkout renders without truncating mid-sentence.
  const d = (p.desc || "").trim();
  if (d) item["line_items[0][price_data][product_data][description]"] = firstSentences(d, 300);
  return item;
}

/**
 * Pure: whole sentences from `text`, never longer than `max` characters and never cut
 * mid-word. The ellipsis counts against the budget: an earlier version appended it after
 * slicing to `max` and returned `max + 3`, which is how a 300-character cap produced a
 * 302-character Stripe description.
 */
export function firstSentences(text, max) {
  if (text.length <= max) return text;
  const stop = text.slice(0, max).lastIndexOf(". ");
  if (stop > 60) return text.slice(0, stop + 1);
  const body = text.slice(0, max - 3);
  const space = body.lastIndexOf(" ");
  return (space > 60 ? body.slice(0, space) : body).replace(/[\s,;:]+$/, "") + "...";
}

async function createCheckout(env, host, productId, probeTag = "", tenant = "", askedId = productId, source = "direct") {
  const p = PRODUCTS[productId];
  const ct = checkoutCustomText(productId, askedId);
  const s = await stripe(env, "checkout/sessions", {
    mode: "payment",
    ...checkoutLineItem(p),
    success_url: `https://${host}/success?session_id={CHECKOUT_SESSION_ID}`,
    // S129: cancelling returns to the /buy intent page for the same product with the
    // session id, so the buyer who abandons at the card step lands one button away from
    // resuming the same Stripe session instead of on the storefront homepage (the old
    // cancel_url), where the funnel restarted from zero and every session ended unpaid.
    cancel_url: `https://${host}/buy/${encodeURIComponent(productId)}?src=checkout.cancel&session_id={CHECKOUT_SESSION_ID}`,
    // Off (audit): a discount field on a $19 one-time page invites the buyer to leave and
    // hunt for a code that does not exist. fulfillmentAllowed keeps its 100%-discount
    // branch for any code issued from the Dashboard against an older session.
    allow_promotion_codes: "false",
    // Always create a Customer, so the email Checkout collects is kept on an object the
    // receipt and any later support lookup can be found by, not only inside the Session.
    customer_creation: "always",
    "custom_text[submit][message]": ct.submit,
    "custom_text[after_submit][message]": ct.after_submit,
    "metadata[product]": productId,
    "metadata[product_name]": p.name,
    "metadata[site]": host,
    "metadata[source]": source,
    "metadata[campaign]": "mcp_lifetime_checkout",
      ...(askedId !== productId ? { "metadata[asked]": askedId } : {}),
      ...(probeTag ? { "metadata[probe]": "1" } : {}),
      ...(tenant ? { client_reference_id: tenant, "metadata[tenant]": tenant } : {}),
    "payment_intent_data[statement_descriptor_suffix]": "MCP PRO",
    "payment_intent_data[metadata][product]": productId,
    "payment_intent_data[metadata][product_name]": p.name,
    "payment_intent_data[metadata][site]": host,
    "payment_intent_data[metadata][source]": source,
    "payment_intent_data[metadata][campaign]": "mcp_lifetime_checkout",
    // Expanded on create so the caller can assert what Stripe actually stored - the item
    // name and the amount - instead of asserting the request it just sent. A 303 to
    // checkout.stripe.com is not evidence that the right product is on the page.
    "expand[]": "line_items",
  });
  return s;
}

/** Write the hosted bind record. No TTL: a purchase is a lifetime key. */
async function bindTenant(env, tenant, key) {
  await env.REMOTE_DATA.put(`bind:${tenant}`, key);
}

/**
 * Conversion instrument (docs/CONVERSION_INSTRUMENT.md). Every cap message's upgrade
 * link carries ?src=<product>.<tool-or-slug>; a well-formed one is lowercase, digits,
 * dot, underscore and hyphen only, so it is safe to fold into a KV key unescaped.
 */
const SRC_RE = /^[a-z0-9][a-z0-9._-]{0,90}$/;

/** Header-safe ASCII, so a product name can never inject a header. */
const headerSafe = (v) => String(v ?? "").replace(/[^\x20-\x7e]/g, " ").slice(0, 120);

/**
 * What a probe needs in order to assert that the checkout it was redirected to is the
 * right product at the right price. Taken from the Session Stripe returned, never from
 * the PRODUCTS row that was sent, so it is an independent reading rather than an echo.
 * Only ever attached to an explicitly tagged probe request; a buyer sees none of it.
 */
export function probeHeaders(session) {
  const item = session?.line_items?.data?.[0] || {};
  return {
    "x-mcp-probe-amount": headerSafe(session?.amount_total),
    "x-mcp-probe-currency": headerSafe(session?.currency),
    "x-mcp-probe-item": headerSafe(item.description),
    "x-mcp-probe-price": headerSafe(item.price?.id),
    "x-mcp-probe-livemode": headerSafe(session?.livemode),
  };
}

/** Pure: is this a well-formed src tag? */
export function validSrc(src) {
  return typeof src === "string" && SRC_RE.test(src);
}

const CLICK_DAY_TTL = 60 * 60 * 24 * 120; // 120 days of daily buckets is enough for any 7/30d KPI

/**
 * Instrument v2 writes under its own key prefix. The v1 counters under `click:` reached
 * 1,685 on 2026-09-10 having been 294 on 2026-09-07 (docs/CONVERSION_R1.md) on a property
 * with no search impressions in 99 days: they are crawler traffic and this repo's own
 * agents, and mixing them into the new counters would make the new ones unreadable for
 * months. They are still listed, under `legacy`, so nothing is lost. Reverting this file
 * reverts to the v1 keys with the v1 numbers intact.
 */
const CLICK_PREFIX = "click:v2:";
const LEGACY_CLICK_PREFIX = "click:";
/** A src that no live page emits is bucketed here and kept out of the headline totals. */
export const UNATTRIBUTED_PREFIX = "unattributed.";

/**
 * A User-Agent that names a crawler or an HTTP library is never a buyer. The old test was
 * `/^(curl|python|node|wget|go-http|undici|axios|httpie)/i` - anchored to the START of the
 * string - so `Mozilla/5.0 (compatible; Googlebot/2.1; ...)` and
 * `Mozilla/5.0 ... HeadlessChrome/120` walked straight past it. Both are matched here
 * wherever the token sits.
 */
export const BOT_UA_RE = /(googlebot|bingbot|claudebot|gptbot|oai-searchbot|chatgpt-user|perplexitybot|ccbot|bytespider|amazonbot|applebot|ahrefsbot|semrushbot|mj12bot|dotbot|petalbot|duckduckbot|baiduspider|yandexbot|facebookexternalhit|slackbot|twitterbot|discordbot|telegrambot|linkedinbot|whatsapp|headlesschrome|phantomjs|puppeteer|playwright|selenium|scrapy|crawler|spider|slurp|\bbot\b|bot\/)/i;
/** Named HTTP clients, matched anywhere in the string rather than only at position 0. */
export const TOOL_UA_RE = /(curl|libcurl|wget|python-requests|python-urllib|python\/|node-fetch|node\.js|undici|axios|httpie|go-http-client|okhttp|java\/|apache-httpclient|libwww|powershell|postmanruntime|insomnia|guzzle|restsharp|scrapy)/i;

/**
 * Is this request a real person navigating a browser to this URL?
 *
 * Counting is opt-IN on the Fetch Metadata pair rather than opt-out on a probe header.
 * Every top-level browser navigation since Chrome 76, Firefox 90 and Safari 16.4 sends
 * BOTH `sec-fetch-mode: navigate` and `sec-fetch-dest: document`; no crawler sends them,
 * and no HTTP library sends them unless it is told to, one header at a time. That is the
 * point: an opt-out can be forgotten, and every agent in this repo that forgot
 * `x-mcp-probe: 1` was counted as a buyer. Forging this pair takes two deliberate `-H`
 * flags, which nobody does by accident.
 *
 * `accept: text/html` is NOT sufficient and was the hole: every crawler sends it. That is
 * why the counter went 294 -> 1,685 in three days, 522 of them (31.0%) on the seven
 * `store.setup.<client>` sources, i.e. something walking the 89 setup pages.
 */
export function isHumanNavigation(headers) {
  const get = (h) => (headers.get(h) || "").toLowerCase();
  if (get("x-mcp-probe") === "1") return false;
  const ua = headers.get("user-agent") || "";
  if (BOT_UA_RE.test(ua) || TOOL_UA_RE.test(ua)) return false;
  if (get("sec-fetch-mode") !== "navigate" || get("sec-fetch-dest") !== "document") return false;
  // Instrument v3: every real browser navigation sends a Referer (the default
  // referrerpolicy, strict-origin-when-cross-origin, still sends the origin). Same-origin
  // referer names the page the buyer was on; cross-origin referer (mcpservers.org, reddit,
  // a search result) is external human traffic we specifically want to count. A header set
  // without Referer is the shape of curl, a script or a prefetcher -- the setup-page walker
  // of 2026-09-17 sent none -- so it is not counted as demand.
  const ref = headers.get("referer");
  if (typeof ref !== "string" || ref.length === 0) return false;
  // Instrument v4 (S137): the 2026-09-23 cycle measured 146 "7d clicks" of which the
  // entire tail (3 each on ~40 srcs) was curl walking /buy/ pages with a browser UA and
  // only these two Sec-Fetch headers — no Sec-Fetch-Site. Every browser navigation sets
  // Sec-Fetch-Site (same-origin, none, or cross-site); curl and scripts omit it. Requiring
  // it closes the last scripted-UA hole without turning away any real browser.
  if (!get("sec-fetch-site")) return false;
  return true;
}

/**
 * A Checkout Session is a payment resource, not a page-view counter.  A GET can come from
 * a crawler, link previewer, browser prefetcher, synthetic monitor or agent browser, all of
 * which can reproduce a browser-shaped header set.  Only an explicit same-origin HTML form
 * submission is allowed to create one.  This leaves ordinary Buy links shareable and makes
 * the extra click the unambiguous boundary between viewing an offer and starting payment.
 */
export function isCheckoutIntent(request, body) {
  const headers = request.headers;
  const get = (h) => (headers.get(h) || "").toLowerCase();
  const ua = headers.get("user-agent") || "";
  if (request.method !== "POST") return false;
  if (BOT_UA_RE.test(ua) || TOOL_UA_RE.test(ua)) return false;
  if (get("content-type").split(";", 1)[0].trim() !== "application/x-www-form-urlencoded") return false;
  if (get("origin") !== new URL(request.url).origin.toLowerCase()) return false;
  if (get("sec-fetch-mode") !== "navigate" || get("sec-fetch-dest") !== "document") return false;
  return new URLSearchParams(body).get("intent") === "checkout";
}

/** Render the no-side-effect step between a Buy link and Stripe. */
export function checkoutIntentPage(url, productId, askedId = productId, tenant = "") {
  const p = PRODUCTS[productId];
  const alias = askedId !== productId
    ? `<p class="muted">${esc(askedId)} is unlocked by the full bundle key.</p>`
    : "";
  const bound = tenant
    ? `<p class="muted">This purchase will upgrade the hosted connection you came from automatically.</p>`
    : "";
  const action = `${url.pathname}${url.search}`;
  // What the $19 actually buys, on the page where the decision is made. Until this ran the
  // buyer saw the free tier line and a one-line desc, then a button: nothing said which
  // tools/lines a single licence unlocks, and 334 clicks produced 100 confirmations and no
  // payment. `p.pro` is the seller's own short list; when a product has no free tier the
  // line is omitted rather than invented.
  const gets = p.pro ? p.pro.replace(/^Pro:\s*/, "") : "";
  const free = p.free ? `<li>Free tier, no key: ${esc(p.free.replace(/^Free:\s*/, ""))}</li>` : "";
  const whatYouGet = `<h2>What you get for $${p.usd}</h2>
<ul>
<li><strong>Your Pro key, in the Stripe receipt</strong> &mdash; same minute the payment clears, re-sendable from <a href="/recover">/recover</a>.</li>${gets ? `\n<li>Pro unlocks: ${esc(gets)}</li>` : ""}${free}
${productId === "bundle"
      ? `<li><strong>All ${SERVER_COUNT} servers, one key, lifetime</strong>, for $${PRODUCTS.bundle.usd} instead of $${PRODUCTS.bundle.usd + BUNDLE_SAVING_USD} bought one at a time.</li>`
      : `<li><strong>All ${SERVER_COUNT} servers instead for $${PRODUCTS.bundle.usd}</strong> &mdash; one key, lifetime, a $${BUNDLE_SAVING_USD} saving: <a href="/buy/bundle?src=store.buy.${esc(productId)}">the bundle</a>.</li>`}
</ul>`;
  return page(`Buy ${p.name}`, `<h1>${esc(p.name)}</h1>
${alias}<p><strong>$${p.usd}.00 USD</strong> &middot; one payment &middot; lifetime licence</p>
<p>${esc(p.desc || (productId === "bundle" ? `All ${SERVER_COUNT} servers, one key.` : ""))}</p>
${whatYouGet}
<form method="post" action="${esc(action)}"><input type="hidden" name="intent" value="checkout">
<button class="buy" type="submit">Continue to secure Stripe checkout</button></form>
<p class="muted">No payment session has been created yet. Stripe collects the card on the next page.</p>
${purchasePromiseHtml(p.usd)}
${bound}<p class="muted"><a href="/#faq">FAQ</a> &middot; <a href="/changelog">Changelog</a> &middot; Source at <a href="${REPO}">github.com/theluckystrike/mcp-servers</a></p>
<p><a href="${productId === "bundle" ? "/" : `/s/${encodeURIComponent(askedId)}`}">Back</a></p>`);
}
/**
 * The buyer-facing promise block: the two risks an email-only digital sale leaves open
 * (does the key turn up, and what if the thing is no good) answered without a testimonial
 * we do not have and without a countdown or a struck-through price we never charged.
 *
 * Applied to the pitch page (see `checkoutIntentPage`) and to /success, so the promise a
 * buyer reads before paying is the same one they read after, in the same words. Nothing
 * here is invented: each line is a measurable property of the product (offline tools, the
 * refund window the seller honours, the key arriving in the receipt and being re-sendable
 * from /recover).
 */
/** The promise a buyer read before paying (checkoutIntentPage), repeated here after it, in
 * the same words. Post-payment is where a refund fear is cheapest to defuse: no support
 * ticket, no chargeback. `purchasePromiseHtml` takes only the amount paid so the block
 * reads identically on both pages, which is the point - a buyer who reads two versions of a
 * guarantee has read no guarantee. */
export function purchasePromiseHtml(paidUsd = PRODUCTS.bundle.usd) {
  return `<h2>One key, ${SERVER_COUNT} servers, yours for good</h2>
<ul>
<li><strong>Lifetime licence.</strong> One payment of $${paidUsd}&mdash; or $${PRODUCTS.bundle.usd} for all ${SERVER_COUNT} together. No subscription, no renewals, no per-seat charge, no usage cap.</li>
<li><strong>The key arrives in the Stripe receipt</strong>, seconds after the card clears &mdash; and re-sendable any time from the same address at <a href="/recover">/recover</a>. No email from a human in between.</li>
<li><strong>Runs offline.</strong> Every server does its work on your machine. No account, no cloud round-trip, your invoices and client data never leave the box.</li>
<li><strong>Keep the files you already have.</strong> The tools read and write plain Markdown, CSV and PDF; there is no proprietary store and no lock-in.</li>
<li><strong>14-day refund</strong> on the first payment, from support@zovo.one.</li>
<li><strong>Every server, the source included</strong>, plus the working tree behind them at <a href="${REPO}">github.com/theluckystrike/mcp-servers</a>.</li>
</ul>`;
}
/** Probe Checkout Sessions are reused for 23h; Stripe expires a Session after 24h. */
const PROBE_SESSION_TTL = 23 * 60 * 60;

/**
 * Count one human click on an upgrade link, before the redirect to Stripe. Two counters
 * per src: a per-day bucket (`click:<src>:<yyyy-mm-dd>`, TTL'd) for recent-window KPIs,
 * and a running total (`click:<src>:total`, no TTL) for lifetime counts. Stored in
 * REMOTE_DATA rather than LICENSES: clicks are hosted-traffic telemetry, the same bucket
 * as anon tokens and rate-limit counters, not a licensing record, and LICENSES is kept
 * lean for the session:/lic: keys the mint path depends on. Read-then-write like the
 * hosted rate limiter (remote/src/index.ts): an undercount under concurrency is the same
 * already-accepted approximation, not a new one.
 */
export async function recordClick(env, src) {
  const day = new Date().toISOString().slice(0, 10);
  const dayKey = `${CLICK_PREFIX}${src}:${day}`;
  const totalKey = `${CLICK_PREFIX}${src}:total`;
  const [dayN, totalN] = await Promise.all([env.REMOTE_DATA.get(dayKey), env.REMOTE_DATA.get(totalKey)]);
  await Promise.all([
    env.REMOTE_DATA.put(dayKey, String((Number(dayN) || 0) + 1), { expirationTtl: CLICK_DAY_TTL }),
    env.REMOTE_DATA.put(totalKey, String((Number(totalN) || 0) + 1)),
  ]);
}

/**
 * Aggregate click:<src>:<day|total> keys into per-src totals and trailing-7-day counts.
 * REMOTE_DATA.list() is a real runtime binding call (not just a wrangler CLI feature), so
 * this works from a live request, not only from local tooling.
 */
export async function clickStats(env) {
  const today = new Date();
  const last7 = new Set();
  for (let i = 0; i < 7; i++) last7.add(new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10));
  // One `get` per key, awaited one at a time, made this a two-minute request at 257
  // sources: a 45 s curl timed out on it on 2026-09-10. The gets in a list page are
  // independent, so they go out together.
  async function collect(prefix, skipV2) {
    const bySrc = {};
    let cursor;
    for (;;) {
      const page = await env.REMOTE_DATA.list({ prefix, cursor });
      const wanted = [];
      for (const k of page.keys) {
        if (skipV2 && k.name.startsWith(CLICK_PREFIX)) continue;
        const rest = k.name.slice(prefix.length);
        const sep = rest.lastIndexOf(":");
        if (sep < 0) continue;
        const tag = rest.slice(sep + 1);
        if (tag !== "total" && !last7.has(tag)) continue; // older daily buckets don't affect any reported figure
        wanted.push({ src: rest.slice(0, sep), tag, name: k.name });
      }
      const values = await Promise.all(wanted.map((w) => env.REMOTE_DATA.get(w.name)));
      wanted.forEach((w, i) => {
        const n = Number(values[i]) || 0;
        bySrc[w.src] ??= { total: 0, last7d: 0 };
        if (w.tag === "total") bySrc[w.src].total = n;
        else bySrc[w.src].last7d += n;
      });
      if (page.list_complete || !page.cursor) break;
      cursor = page.cursor;
    }
    return bySrc;
  }
  const bySrc = await collect(CLICK_PREFIX, false);
  const legacyBySrc = await collect(LEGACY_CLICK_PREFIX, true);
  const sum = (o, field, pred) => Object.entries(o).reduce((a, [src, s]) => a + (pred(src) ? s[field] : 0), 0);
  const attributed = (src) => !src.startsWith(UNATTRIBUTED_PREFIX);
  const unattributed = (src) => src.startsWith(UNATTRIBUTED_PREFIX);
  return {
    generated_at: new Date().toISOString(),
    instrument: 3,
    counting_rule: "a click counts only when the request carries sec-fetch-mode: navigate AND sec-fetch-dest: document, its User-Agent names no crawler or HTTP library, it sends no x-mcp-probe header, it carries a Referer (any origin, real browsers always send one; scripts and the 2026-09-17 setup-page walker do not), and its ?src= is one a live page emits. Everything else is either not counted or bucketed under unattributed.*, which is excluded from total_clicks and clicks_7d.",
    by_src: bySrc,
    total_clicks: sum(bySrc, "total", attributed),
    clicks_7d: sum(bySrc, "last7d", attributed),
    unattributed_total: sum(bySrc, "total", unattributed),
    unattributed_7d: sum(bySrc, "last7d", unattributed),
    legacy: {
      note: "instrument v1 (`click:` keys). Counted crawlers and this repo's own agents; never quote as demand. See docs/FUNNEL_R1.md.",
      by_src: legacyBySrc,
      total_clicks: sum(legacyBySrc, "total", () => true),
      clicks_7d: sum(legacyBySrc, "last7d", () => true),
    },
  };
}

class MintError extends Error {}

/**
 * Idempotent mint: the key for a session is derived once and cached in KV.
 * The caller must have run fulfillmentAllowed() first; productId is the checked id.
 * Review #14: every freshly minted key is verified against the embedded public key
 * before it is stored or returned, so a private/public key mismatch fails loudly
 * instead of charging a customer for an unusable key.
 */
async function keyForSession(env, session, productId) {
  const cached = await env.LICENSES.get(`session:${session.id}`);
  if (cached) return cached;
  const p = PRODUCTS[productId];
  if (!p) throw new Error(`unknown product: ${productId}`);
  const email = session.customer_details?.email || session.customer_email || "";
  const { key } = await mintLicense(env.LICENSE_PRIVATE_KEY_PEM, {
    product: p.payload,
    id: hex(6),
    iat: session.created || Math.floor(Date.now() / 1000),
    email,
  });
  const check = await verifyLicenseKey(key, productId);
  if (!check.ok) {
    console.error(`mint verification failed for session ${session.id} product ${productId}: ${check.reason}`);
    throw new MintError(check.reason);
  }
  // Store-if-absent: re-read to keep a concurrent webhook and /success in agreement.
  const again = await env.LICENSES.get(`session:${session.id}`);
  if (again) return again;
  await env.LICENSES.put(`session:${session.id}`, key, { metadata: { product: productId, email } });
  return key;
}

/** Retrieve a Checkout Session with its line items expanded (review #3). */
async function retrieveSession(env, sid) {
  return stripe(env, `checkout/sessions/${encodeURIComponent(sid)}?expand[]=line_items`, null, "GET");
}

/**
 * Install instructions, in the order the paths actually work. The npx form was first and
 * uncaveated, which meant the very first instruction a customer read after paying was a
 * command that returns E404. The two paths that work today lead instead, and the npx line
 * keeps its place with the same disclosure the /s/ and /setup pages already carried.
 */
function installSnippet(productId) {
  const p = PRODUCTS[productId];
  const name = p.pkg ? p.bin.replace(/^mcp-/, "") : "time-tracker";
  const pkg = p.pkg || "@theluckystrike/mcp-time-tracker";
  const bundleLine = p.pkg
    ? `<p><strong>1. Claude Desktop, one click.</strong> Download <code>${esc(name)}.mcpb</code> from <a href="${REPO}/releases/latest">the latest release</a> and open it.</p>`
    : `<p><strong>1. Claude Desktop, one click.</strong> Download any server's <code>.mcpb</code> from <a href="${REPO}/releases/latest">the latest release</a> and open it. This key unlocks Pro on every one of them.</p>`;
  return `${bundleLine}
<p><strong>2. No install at all.</strong> Open <a href="/mcp/connect">/mcp/connect</a>, and paste the key below where the token goes. Nothing to download.</p>
<p><strong>3. Local, with npx.</strong></p>
<pre><code># Claude Code
claude mcp add ${esc(name)} -- npx -y ${esc(pkg)}

# Claude Desktop (claude_desktop_config.json)
{
  "mcpServers": {
    "${esc(name)}": { "command": "npx", "args": ["-y", "${esc(pkg)}"] }
  }
}</code></pre>
<p class="muted">${NPM_PENDING_NOTE}</p>`;
}

export function successPage(key, productId, session, boundTenant = "") {
  const p = PRODUCTS[productId];
  const hostedNote = boundTenant
    ? `<h2>Hosted endpoints</h2>
<p>The hosted endpoint you were using (token <code>${esc(boundTenant)}</code>) is already Pro for ${esc(p.name)} -
nothing further to do there. The key below still works for a local, stdio install.</p>`
    : "";
  return page("Your MCP Pro license key", `<h1>Payment received</h1>
<p>${esc(p.name)} - $${p.usd} one-time, lifetime.</p>
${hostedNote}
<h2>Your license key</h2>
<pre class="key"><code>${esc(key)}</code></pre>
<p class="muted">Save this key now; it is shown again only at this URL. No email is sent with the key.
Reloading this page always shows the same key. If you lose it, email support@zovo.one with your Stripe receipt
(it carries the session id) and the key can be recovered from <code>/recover?session_id=...</code>.</p>
<h2>Activate it</h2>
<p>In Claude: run <code>license_activate</code> with this key.</p>
<p>Alternative, set an environment variable before starting the server:</p>
<pre><code>MCP_LICENSE_KEY=${esc(key)}</code></pre>
<h2>Install</h2>
${installSnippet(productId)}
${purchasePromiseHtml(p.usd)}
<p>Docs: <a href="${REPO}">${REPO}</a></p>`);
}

/** Constant-time comparison of two equal-length hex strings. */
function ctEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Stripe signature check. Review #9: a header may carry several v1 values during
 * secret rotation, so every one is kept and each is compared in constant time.
 * Review #10: the timestamp must be a safe integer, otherwise Number(t) is NaN
 * and the replay-window comparison passes.
 */
export async function verifySig(env, body, header) {
  let t = null;
  const v1s = [];
  for (const field of String(header || "").split(",")) {
    const i = field.indexOf("=");
    if (i < 0) continue;
    const k = field.slice(0, i).trim();
    const v = field.slice(i + 1).trim();
    if (k === "t" && t === null) t = v;
    else if (k === "v1") v1s.push(v);
  }
  if (t === null || v1s.length === 0) return false;
  if (!/^\d{1,15}$/.test(t)) return false;
  const ts = Number(t);
  if (!Number.isSafeInteger(ts)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) return false;

  const enc = new TextEncoder();
  const mac = await crypto.subtle.importKey("raw", enc.encode(env.STRIPE_WEBHOOK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", mac, enc.encode(`${t}.${body}`)));
  const expected = [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
  let matched = false;
  for (const v1 of v1s) if (ctEqual(expected, v1)) matched = true; // no early exit
  return matched;
}

const worker = {
  async fetch(request, env, ctx) {
    const handler = worker.fetch;
    const url = new URL(request.url);
    const host = url.host;
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const method = request.method === "HEAD" ? "GET" : request.method;

    // Trailing-slash duplicates: the strip above made /s/invoice/ and /s/invoice serve the
    // same 200 body, doubling every crawlable URL and leaving consolidation to the
    // canonical tag alone. The sibling property whose pages DO get crawled and indexed
    // 301s the slash form instead (measured 2026-09-12:
    // https://zovo.one/free-tools/html-entity-encoder/ -> 301 to the bare form). Match
    // that. GET/HEAD only, so POST flows (/verify, /bound, /buy) keep working exactly as
    // before; the strip below already guarantees the redirect target resolves.
    if (path !== "/" && url.pathname !== path && (request.method === "GET" || request.method === "HEAD")) {
      return new Response(null, { status: 301, headers: { Location: `${url.origin}${path}${url.search}`, "cache-control": "public, max-age=86400" } });
    }

    if (path === "/health") {
      // signer check: mint a throwaway key in-runtime and verify it. No secrets leak.
      let signer = "unavailable";
      try {
        const probe = await mintLicense(env.LICENSE_PRIVATE_KEY_PEM, { product: "health-probe", id: "000000000000", iat: 0 });
        signer = (await verifyLicenseKey(probe.key, "health-probe")).ok ? "ok" : "verify-failed";
      } catch (e) {
        signer = `error: ${e.message}`;
      }
      return Response.json({
        ok: signer === "ok",
        service: "mcp-billing",
        signer,
        products: Object.keys(PRODUCTS),
        stripe_mode: (env.STRIPE_SECRET_KEY || "").includes("_live_") || (env.STRIPE_SECRET_KEY || "").startsWith("rk_live") ? "live" : "test",
        time: new Date().toISOString(),
      });
    }

    if (path === "/" && method === "GET") {
      // The homepage was the one content route hand-rolling its own header object, so it
      // shipped no Last-Modified, no ETag and no Cache-Control while every sibling route got
      // all three from contentHeaders(). / is the first URL in the sitemap, so the strongest
      // crawl target had the weakest freshness signal: a conditional GET on / could not
      // revalidate and always refetched the full 89KB body. Same helper, same date scheme
      // (newest CHANGELOG release date) as every other page.
      const body = home();
      return new Response(body, { headers: await contentHeaders(body) });
    }

    if (path === "/servers" && method === "GET") {
      // SEO_R1: crawlable, description-rich index of the whole fleet. Additive route; does
      // not touch /mcp* (served by the remote worker) or any MCP protocol path.
      const body = serversPage();
      return new Response(body, { headers: await contentHeaders(body) });
    }

    if (path === "/bundle" && method === "GET") {
      const body = bundlePage();
      return new Response(body, { headers: await contentHeaders(body) });
    }

    if (path === "/suites/documents" && method === "GET") {
      // positions_sweep follow-up: "free MCP servers for documents" cluster.
      const HUB_SERVERS = ["docx", "pdf", "spreadsheet", "resume", "clauses", "zip", "image", "barcode"];
      const rows = HUB_SERVERS.map((id) => {
        const pg = PAGES[id];
        return `<tr><td><a href="/s/${id}">${esc(pg ? pg.title : id)}</a></td><td>${esc(pg ? pg.description : "")}</td><td><a class="buy" href="/buy/${id}?src=store.suites.documents">$${PRODUCTS[resolveProductId(id)] ? PRODUCTS[resolveProductId(id)].usd : PRODUCTS.bundle.usd}</a></td></tr>`;
      }).join("");
      const hubBody = `<h1>Free MCP Servers for Documents — Word, PDF, Spreadsheets</h1>
<p>Create and edit Word documents, merge and split PDFs, query spreadsheets, all from Claude or any MCP client. Every server is a free remote endpoint you connect by URL: no install, no account. ${SERVER_COUNT} servers in the full suite.</p>
<table><thead><tr><th>Server</th><th>What it does</th><th>Pro</th></tr></thead><tbody>${rows}</tbody></table>
<h2>Why free?</h2>
<p>Every server has a free tier that is useful on its own — real limits, not a crippled demo. Pro keys are one-time payments, not subscriptions, when you outgrow them.</p>
<h2>Connect one in 60 seconds</h2>
<p>Open <a href="/mcp/connect">mcp.zovo.one/mcp/connect</a>, pick a server, paste its URL into your client's MCP config. That is the whole setup.</p>
${relatedGuidesBlock("docx")}`;
      const hubMeta = `<meta name="description" content="Free remote MCP servers for documents: Word .docx, PDF merge and split, spreadsheets, resumes and more. Connect by URL in Claude, Cursor or any MCP client — no install."><link rel="canonical" href="https://mcp.zovo.one/suites/documents">${og("Free MCP Servers for Documents", "Word, PDF, spreadsheets and more — free remote MCP servers, connect by URL, no install.", "https://mcp.zovo.one/suites/documents", "website")}
<script type="application/ld+json">${JSON.stringify(hubItemList("Free MCP servers for documents", "https://mcp.zovo.one/suites/documents", HUB_SERVERS))}</script>`;
      const hubHtml = page("Free MCP Servers for Documents | zovo.one", hubBody).replace("</title>", "</title>" + hubMeta);
      return new Response(hubHtml, { headers: await contentHeaders(hubHtml) });
    }

    if (path === "/suites/field-ops" && method === "GET") {
      // positions_sweep follow-up: trades/field-service cluster (job cards, work orders,
      // delivery, receipts). Same hub pattern.
      const HUB_SERVERS = ["job-card", "work-order", "delivery-schedule", "packing-list", "goods-receipt", "maintenance-log", "checklist", "change-order"];
      const rows = HUB_SERVERS.map((id) => {
        const pg = PAGES[id];
        return `<tr><td><a href="/s/${id}">${esc(pg ? pg.title : id)}</a></td><td>${esc(pg ? pg.description : "")}</td><td><a class="buy" href="/buy/${id}?src=store.suites.field-ops">$${PRODUCTS[resolveProductId(id)] ? PRODUCTS[resolveProductId(id)].usd : PRODUCTS.bundle.usd}</a></td></tr>`;
      }).join("");
      const hubBody = `<h1>Free MCP Servers for Field Ops and Trades</h1>
<p>Job cards, work orders, delivery schedules, goods receipts and maintenance logs, every one a free remote MCP server you connect by URL: no install, no account. ${SERVER_COUNT} servers in the full suite.</p>
<table><thead><tr><th>Server</th><th>What it does</th><th>Pro</th></tr></thead><tbody>${rows}</tbody></table>
<h2>Why free?</h2>
<p>Every server has a free tier that is useful on its own — real limits, not a crippled demo. Pro keys are one-time payments, not subscriptions, when you outgrow them.</p>
<h2>Connect one in 60 seconds</h2>
<p>Open <a href="/mcp/connect">mcp.zovo.one/mcp/connect</a>, pick a server, paste its URL into your client's MCP config. That is the whole setup.</p>
${relatedGuidesBlock("job-card")}`;
      const hubMeta = `<meta name="description" content="Free remote MCP servers for field operations: job cards, work orders, delivery schedules, goods receipts, maintenance logs. Connect by URL in Claude, Cursor or any MCP client — no install."><link rel="canonical" href="https://mcp.zovo.one/suites/field-ops">${og("Free MCP Servers for Field Ops", "Job cards, work orders, deliveries, maintenance logs — free remote MCP servers, connect by URL, no install.", "https://mcp.zovo.one/suites/field-ops", "website")}
<script type="application/ld+json">${JSON.stringify(hubItemList("Free MCP servers for field operations", "https://mcp.zovo.one/suites/field-ops", HUB_SERVERS))}</script>`;
      const hubHtml = page("Free MCP Servers for Field Ops | zovo.one", hubBody).replace("</title>", "</title>" + hubMeta);
      return new Response(hubHtml, { headers: await contentHeaders(hubHtml) });
    }

    if (path === "/suites/freelancer" && method === "GET") {
      // rows competing — a dedicated hub page with the exact phrase owns it. Links the 8
      // per-server pages from the R9 query-matched set so crawl equity flows to them.
      const HUB_SERVERS = ["invoice", "time-tracker", "expense-tracker", "pdf", "docx", "kanban", "dunning-letters", "petty-cash"];
      const rows = HUB_SERVERS.map((id) => {
        const pg = PAGES[id];
        return `<tr><td><a href="/s/${id}">${esc(pg ? pg.title : id)}</a></td><td>${esc(pg ? pg.description : "")}</td><td><a class="buy" href="/buy/${id}?src=store.suites.freelancer">$${PRODUCTS[resolveProductId(id)] ? PRODUCTS[resolveProductId(id)].usd : PRODUCTS.bundle.usd}</a></td></tr>`;
      }).join("");
      const hubBody = `<h1>Free MCP Servers for Freelancers — Invoices, Time Tracking, Expenses</h1>
<p>Nine-plus tools for running a one-person business, every one a free remote MCP server you connect by URL — no install, no account. Works in Claude Desktop, Claude Code, Cursor, VS Code and any MCP client. ${SERVER_COUNT} servers in the full suite.</p>
<table><thead><tr><th>Server</th><th>What it does</th><th>Pro</th></tr></thead><tbody>${rows}</tbody></table>
<h2>Why free?</h2>
<p>Every server has a free tier that is useful on its own — real limits, not a crippled demo. Pro keys are one-time payments, not subscriptions, when you outgrow them.</p>
<h2>Connect one in 60 seconds</h2>
<p>Open <a href="/mcp/connect">mcp.zovo.one/mcp/connect</a>, pick a server, paste its URL into your client's MCP config. That is the whole setup.</p>
${relatedGuidesBlock("invoice")}`;
      const hubMeta = `<meta name="description" content="Free remote MCP servers for freelancers: invoicing, time tracking, expenses, PDF, Word, kanban and more. Connect by URL in Claude, Cursor or any MCP client — no install."><link rel="canonical" href="https://mcp.zovo.one/suites/freelancer">${og("Free MCP Servers for Freelancers", "Invoicing, time tracking, expenses, PDF and more — free remote MCP servers, connect by URL, no install.", "https://mcp.zovo.one/suites/freelancer", "website")}
<script type="application/ld+json">${JSON.stringify(hubItemList("Free MCP servers for freelancers", "https://mcp.zovo.one/suites/freelancer", HUB_SERVERS))}</script>`;
      const hubHtml = page("Free MCP Servers for Freelancers | zovo.one", hubBody).replace("</title>", "</title>" + hubMeta);
      return new Response(hubHtml, { headers: await contentHeaders(hubHtml) });
    }

    if (path === "/changelog" && method === "GET") {
      const body = changelogPage();
      return new Response(body, { headers: await contentHeaders(body) });
    }

    if (path.startsWith("/s/") && method === "GET") {
      const id = path.slice(3);
      const pg = PAGES[id];
      if (!pg) return new Response(page("Not found", `<h1>Unknown server</h1><p><a href="/">Back to products</a></p>`), { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
      // office-suite, and any future alias, has a product page but is not itself a PRODUCTS
      // row: it sells the bundle, because a $19 key minted under its own name would be
      // rejected by every child it forwards to. Price the page from what it actually sells.
      const sold = PRODUCTS[resolveProductId(id)] || PRODUCTS[id];
      const soldUsd = sold ? sold.usd : PRODUCTS.bundle.usd;
      const meta = `<meta name="description" content="${esc(pg.description).slice(0, 155)}"><link rel="canonical" href="https://mcp.zovo.one/s/${esc(id)}">${og(pg.title, pg.description, `https://mcp.zovo.one/s/${id}`, "product")}
<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "SoftwareApplication", name: pg.title, applicationCategory: "DeveloperApplication", operatingSystem: "macOS, Windows, Linux", description: pg.description, url: `https://mcp.zovo.one/s/${id}`, author: { "@type": "Person", name: "theluckystrike", url: "https://github.com/theluckystrike" }, offers: [{ "@type": "Offer", price: "0", priceCurrency: "USD", name: "Free tier" }, { "@type": "Offer", price: String(soldUsd), priceCurrency: "USD", name: "Pro, lifetime", url: `https://mcp.zovo.one/buy/${id}?src=store.s.${id}` }] })}</script>`;
      const setupLinks = SETUP_SERVERS[id]
        ? CLIENT_ORDER.map((c) => `<a href="/setup/${c}/${id}">${esc(CLIENTS[c].name)}</a>`).join(" &middot; ")
        : null;
      // Two ways to run this actually work today, and until now the page led with the price
      // and buried the zero-install one at character 20,676 of 21,905. The registry is the
      // only channel that measurably delivers people here, and a good share of them arrive
      // from clients that take a URL and cannot set a header, so the hosted line goes above
      // the fold with the bundle. HOSTED is empty for office-suite, which spawns local child
      // processes and has no remote endpoint.
      const hostedLine = HOSTED_SERVERS.has(id)
        ? `<p>Two ways to run it, both free to start. Open <a href="https://mcp.zovo.one/mcp/connect">mcp.zovo.one/mcp/connect</a>, copy the ${esc(id)} URL and paste it into any client that takes a URL. It already carries a free token, so there is nothing to install, no account and no header to set. The URL is <code>https://mcp.zovo.one/mcp/${esc(id)}/t/&lt;token&gt;</code>. The token is not optional: the bare <code>https://mcp.zovo.one/mcp/${esc(id)}</code> connects and lists its tools and then answers every tool call with HTTP 401, so use the link from /mcp/connect or send <code>Authorization: Bearer &lt;token&gt;</code>. Or download <a href="${REPO}/releases/latest">${esc(id)}.mcpb</a> and double-click it in Claude Desktop.</p>`
        // The absence of a URL has to be stated, not implied. A reader who has just been
        // told on the home page that most of these servers connect by URL will otherwise
        // assume this one does too, and an assistant answering from this page has no way to
        // know the endpoint 404s. Both servers without one are named here for a reason:
        // office-suite spawns its siblings as local child processes, and delivery-schedule
        // has no endpoint yet.
        : `<p><b>Install it in one click.</b> Download <a href="${REPO}/releases/latest">${esc(id)}.mcpb</a> and double-click it in Claude Desktop. <b>There is no hosted URL for this one.</b> ${id === "office-suite" ? "It starts every sibling server as a local child process, which only works on your own machine." : "The other servers answer at <code>https://mcp.zovo.one/mcp/&lt;server&gt;/t/&lt;token&gt;</code>; this one has no endpoint yet, and that address returns 404 for it."} Run it from the bundle above or from a clone.</p>`;
      // The price comparison stays above the fold. The hero below it now leads with the
      // connect path (docs/FUNNEL_R1.md), which is longer than the line it replaced, and
      // the only bundle cross-sell on this page sits several thousand words down inside
      // pg.html. The reason anyone buys the set rather than one server is that $39 beats
      // $${SERVER_COUNT * PRODUCTS[SERVER_IDS[0]].usd}, and that argument has to be reachable without scrolling.
      const body = `<p><a href="/">All servers</a> &middot; <a class="buy" href="/buy/${esc(id)}?src=store.s.${esc(id)}">Buy Pro $${soldUsd}</a> &middot; <a href="/bundle">All ${SERVER_COUNT} for $${PRODUCTS.bundle.usd}</a> &middot; <a href="${REPO}/tree/main/servers/${esc(id)}">Source</a></p>${hostedLine}${pg.html}
${setupLinks ? `<h2>Set it up in your client</h2>\n<p>Exact config path, entry and caveats: ${setupLinks} &middot; <a href="/setup">all clients</a></p>` : ""}
${COMPARE[id] ? `<h2>Compared with the alternatives</h2>\n<p><a href="/compare/${esc(id)}">${esc(COMPARE[id].title)}</a> &middot; <a href="/compare">all comparisons</a></p>` : ""}
<h2>Guides</h2>
<p>${GUIDE_LINKS}</p>
${(() => {
  // Search-crawler fan-in (docs/T6_SEARCH_FANIN_S45): Googlebot fetched only 16 of 193
  // sitemap URLs in 7d. The /s pages it did fetch are the only sure re-crawl seeds, so
  // every product page now links a rotating window of 8 sibling product pages. This
  // gives each of the 42 /s pages 8 additional internal inbound links from templates
  // Googlebot has demonstrably crawled, without touching the human-facing copy above.
  const ids = SERVER_IDS.filter((x) => x !== id);
  const start = Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % ids.length;
  const sib = Array.from({ length: Math.min(8, ids.length) }, (_, k) => ids[(start + k) % ids.length]);
  return `<h2>More servers</h2>\n<p>${sib.map((s) => `<a href="/s/${esc(s)}">${esc(PAGES[s] ? PAGES[s].title : s)}</a>`).join(" &middot; ")}</p>`;
})()}`;
      const html = page(pg.title + " | zovo.one", body).replace("</title>", "</title>" + meta);
      return new Response(html, { headers: await contentHeaders(html) });
    }

    if (path === "/guides" && method === "GET") {
      const items = Object.entries(GUIDES).map(([slug, g]) =>
        `<li><a href="/guides/${esc(slug)}">${esc(g.title)}</a><br><span class="muted">${esc(g.description)}</span></li>`).join("\n");
      const body = `<h1>${esc(GUIDE_INDEX.title)}</h1>
<p>${esc(GUIDE_INDEX.description)} Every server runs locally over stdio, has a free tier that is useful on its own, and a Pro key that is a one-time payment.</p>
<ul>${items}</ul>
<p><a href="/">All servers and prices</a></p>`;
      const meta = `<meta name="description" content="${esc(GUIDE_INDEX.description).slice(0, 155)}"><link rel="canonical" href="https://mcp.zovo.one/guides">${og(GUIDE_INDEX.title, GUIDE_INDEX.description, "https://mcp.zovo.one/guides", "website")}<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "ItemList", name: GUIDE_INDEX.title, url: "https://mcp.zovo.one/guides", itemListElement: Object.entries(GUIDES).map(([slug, g], i) => ({ "@type": "ListItem", position: i + 1, url: `https://mcp.zovo.one/guides/${slug}`, name: g.title })) })}</script>`;
      const html = page(GUIDE_INDEX.title, body).replace("</title>", "</title>" + meta);
      return new Response(html, { headers: await contentHeaders(html) });
    }

    // Old guide slugs that were renamed. The body and slug both aged out of date
    // (nineteen servers, 186 tools) when the count moved on; redirect rather than 404.
    const GUIDE_REDIRECTS = {
      "one-install-nineteen-servers-office-suite": "one-install-office-suite",
    };
    if (path.startsWith("/guides/") && method === "GET") {
      const oldSlug = path.slice("/guides/".length);
      if (GUIDE_REDIRECTS[oldSlug]) {
        return Response.redirect(`https://${host}/guides/${GUIDE_REDIRECTS[oldSlug]}`, 301);
      }
    }

    if (path.startsWith("/guides/") && method === "GET") {
      const slug = path.slice("/guides/".length);
      const g = GUIDES[slug];
      if (!g) return new Response(page("Not found", `<h1>Unknown guide</h1><p><a href="/guides">All guides</a></p>`), { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
      const canonical = `https://mcp.zovo.one/guides/${slug}`;
      const faqHtml = g.faq.map((f) => `<h3>${esc(f.q)}</h3>\n<p>${esc(f.a)}</p>`).join("\n");
      const ld = [
        { "@context": "https://schema.org", "@type": "TechArticle", headline: g.title, description: g.description, url: canonical, author: { "@type": "Person", name: "theluckystrike", url: "https://github.com/theluckystrike" }, publisher: { "@type": "Organization", name: "theluckystrike", url: "https://mcp.zovo.one" } },
        { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: g.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
      ].map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("");
      const meta = `<meta name="description" content="${esc(g.description).slice(0, 155)}"><link rel="canonical" href="${canonical}">${og(g.title, g.description, canonical, "article")}${ld}`;
      // Every guide points at the product pages it is actually about. Without this the
      // Related block linked only /, /guides and /buy/bundle, so 15 of the 42 /s/<slug>
      // pages had 0 or 1 internal inbound link and were effectively orphaned for crawlers.
      const cross = (GUIDE_PRODUCT_LINKS[slug] || []).filter((s) => PRODUCTS[s] || PAGES[s]);
      const crossHtml = cross.length
        ? `\n<p>Servers used in this guide: ${cross.map((s) => `<a href="/s/${esc(s)}">${esc(PAGES[s] ? PAGES[s].title : s)}</a>`).join(" &middot; ")}</p>`
        : "";
      // T15 fix 4: featured-servers strip near the top of the guide article. Guides are
      // the pages where search and AI-crawler traffic actually lands; this puts the
      // measured top /s/ pages one hop from every guide without touching the article.
      const featured = FEATURED_SERVERS.filter((s) => PRODUCTS[s] || PAGES[s])
        .filter((s) => !cross.includes(s))
        .slice(0, 8)
        .map((s) => `<a href="/s/${esc(s)}">${esc(PAGES[s] ? PAGES[s].title.replace(/^MCP /, "").replace(/ Pro$/, "") : s)}</a>`)
        .join(" &middot; ");
      const featuredHtml = featured ? `\n<p class="feat">Popular servers: ${featured}</p>` : "";
      // Guide->guide topical mesh (GUIDE_RELATED, symmetric): crawl paths + session depth.
      const related = (GUIDE_RELATED[slug] || []).filter((s) => GUIDES[s]);
      const relatedHtml = related.length
        ? `\n<p>Related guides: ${related.map((s) => `<a href="/guides/${esc(s)}">${esc(GUIDES[s].title)}</a>`).join(" &middot; ")}</p>`
        : "";
      const body = `<p class="muted"><a href="/">Home</a> &middot; <a href="/guides">Guides</a></p>
${featuredHtml}
${g.html}
<h2>Questions</h2>
${faqHtml}
<h2>Related</h2>
<p><a href="/">All MCP servers and prices</a> &middot; <a href="/guides">All guides</a> &middot; <a class="buy" href="/buy/bundle?src=store.guide.${slug}">Buy the bundle $${PRODUCTS.bundle.usd}</a></p>${relatedHtml}${crossHtml}`;
      const html = page(g.title, body).replace("</title>", "</title>" + meta);
      return new Response(html, { headers: await contentHeaders(html) });
    }

    if (path === "/compare" && method === "GET") {
      const items = Object.entries(COMPARE).map(([slug, c]) =>
        `<li><a href="/compare/${esc(slug)}">${esc(c.title)}</a><br><span class="muted">${esc(c.description)}</span></li>`).join("\n");
      const body = `<h1>${esc(COMPARE_INDEX.title)}</h1>
<p>${esc(COMPARE_INDEX.description)} Where a competing server does something we do not, the page says so and names the tool.</p>
<ul>${items}</ul>
<p><a href="/">All servers and prices</a> &middot; <a href="/guides">Guides</a> &middot; <a href="/setup">Setup</a></p>`;
      const meta = `<meta name="description" content="${esc(COMPARE_INDEX.description).slice(0, 155)}"><link rel="canonical" href="https://mcp.zovo.one/compare">${og(COMPARE_INDEX.title, COMPARE_INDEX.description, "https://mcp.zovo.one/compare", "website")}`;
      const html = page(COMPARE_INDEX.title, body).replace("</title>", "</title>" + meta);
      return new Response(html, { headers: await contentHeaders(html) });
    }

    if (path.startsWith("/compare/") && method === "GET") {
      const slug = path.slice("/compare/".length);
      const c = COMPARE[slug];
      if (!c) return new Response(page("Not found", `<h1>Unknown comparison</h1><p><a href="/compare">All comparisons</a></p>`), { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
      const canonical = `https://mcp.zovo.one/compare/${slug}`;
      const faqHtml = c.faq.map((f) => `<h3>${esc(f.q)}</h3>\n<p>${esc(f.a)}</p>`).join("\n");
      const ld = [
        { "@context": "https://schema.org", "@type": "TechArticle", headline: c.title, description: c.description, url: canonical, author: { "@type": "Person", name: "theluckystrike", url: "https://github.com/theluckystrike" }, publisher: { "@type": "Organization", name: "theluckystrike", url: "https://mcp.zovo.one" } },
        { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: c.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
      ].map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("");
      const meta = `<meta name="description" content="${esc(c.description).slice(0, 155)}"><link rel="canonical" href="${canonical}">${og(c.title, c.description, canonical, "article")}${ld}`;
      const body = `<p class="muted"><a href="/">Home</a> &middot; <a href="/compare">Comparisons</a></p>
${c.html}
<h2>Questions</h2>
${faqHtml}
<h2>Related</h2>
<p><a href="/s/${esc(slug)}">Product page</a> &middot; <a href="/setup">Setup per client</a> &middot; <a href="/guides">Guides</a> &middot; <a href="/compare">All comparisons</a>${PRODUCTS[slug] ? ` &middot; <a class="buy" href="/buy/${esc(slug)}?src=store.compare.${esc(slug)}">Buy Pro $${PRODUCTS[slug].usd}</a>` : ""}</p>
${relatedGuidesBlock(slug)}`;
      const html = page(c.title, body).replace("</title>", "</title>" + meta);
      return new Response(html, { headers: await contentHeaders(html) });
    }

    if ((path === "/setup" || path.startsWith("/setup/")) && method === "GET") {
      const parts = path.split("/").filter(Boolean); // ["setup", client?, server?]
      let pg = null;
      let faq = null;
      if (parts.length === 1) pg = setupIndex();
      else if (parts.length === 2) pg = clientHub(parts[1]);
      else if (parts.length === 3) {
        const sp = setupPage(parts[1], parts[2]);
        if (sp) { pg = sp; faq = sp.faq; }
      }
      if (!pg) return new Response(page("Not found", `<h1>Unknown setup page</h1><p><a href="/setup">All setup guides</a></p>`), { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
      const ld = [
        { "@context": "https://schema.org", "@type": "TechArticle", headline: pg.title, description: pg.description, url: pg.canonical, author: { "@type": "Person", name: "theluckystrike", url: "https://github.com/theluckystrike" }, publisher: { "@type": "Organization", name: "theluckystrike", url: "https://mcp.zovo.one" } },
      ];
      if (faq) ld.push({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) });
      // The 216 client x product permutations measured 73.6-77.5% text-similar to their
      // siblings and drew 8 human views in 7 days across all 224 setup URLs, while
      // Googlebot read sitemap.xml seven times and then crawled 2 of 312 pages. They stay
      // live and keep passing link value, but they are not offered to a crawler as
      // separately indexable. See docs/SEO_INDEXATION_R1.md.
      const robots = parts.length === 3 ? `<meta name="robots" content="noindex,follow">` : "";
      const meta = `<meta name="description" content="${esc(pg.description).slice(0, 155)}"><link rel="canonical" href="${pg.canonical}">${og(pg.title, pg.description, pg.canonical, "article")}${robots}` +
        ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("");
      const html = page(pg.title, pg.body).replace("</title>", "</title>" + meta);
      return new Response(html, { headers: await contentHeaders(html) });
    }

    if (path === "/sitemap.xml") {
      // /mcp/connect is served by the remote worker on this same host, and since loop 33
      // it is the hero destination of every /s/ page and of /llms.txt: it is where a free
      // token comes from, so it is the entry point to the entire free tier. It was the one
      // page never offered to a crawler. It is safe to list only because the remote worker
      // no longer mints a token for a crawler, a prefetch or a HEAD (see
      // remote/src/index.ts isBrowserNavigation); before that fix, listing it would have
      // left a 30-day junk tenant per fetch and could have returned 429 to everyone behind
      // a shared address. robots.txt needs no change: it names only the private per-buyer
      // paths, and this page is deliberately public.
      // lastmod is the one scheduling hint the sitemap protocol gives a crawler, and this
      // host's problem is a Discovered queue that does not drain (docs/GOOGLE_INDEX_R1.md):
      // the sibling property that does get crawled ships lastmod on 407 of 407 sitemap URLs
      // (zovo.one/sitemap-01-main.xml, measured 2026-09-12); this host shipped it on 0 of
      // 171. The date is the newest CHANGELOG release carrying a real ISO date: every
      // release re-bundles and redeploys every page from this same source, and the catalog
      // pages enumerate the fleet the release changed. Guides and compare entries carry no
      // per-page date field, so the release date is the most recent honest site-wide value,
      // and it moves on its own each release instead of going stale like a constant. If no
      // release has a valid date, lastmod is omitted rather than fabricated.
      const siteDate = ((CHANGELOG && CHANGELOG.releases) || []).map((r) => r && r.date).find((d) => /^\d{4}-\d{2}-\d{2}$/.test(d || ""));
      const urls = ["/", "/servers", "/mcp/connect", "/bundle", "/changelog", "/guides", "/compare", "/privacy", "/suites/freelancer", "/suites/documents", "/suites/field-ops", ...Object.keys(PAGES).map((k) => `/s/${k}`), ...Object.keys(GUIDES).map((k) => `/guides/${k}`), ...Object.keys(COMPARE).map((k) => `/compare/${k}`), ...setupUrls().filter((u) => u.split("/").filter(Boolean).length <= 2)].map((u) => `<url><loc>https://mcp.zovo.one${u}</loc>${siteDate ? `<lastmod>${siteDate}</lastmod>` : ""}</url>`).join("");
      return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, { headers: { "content-type": "application/xml" } });
    }
    // MCP registry domain verification. The registry fetches
    // https://<domain>/.well-known/mcp-registry-auth and reads one line holding an Ed25519
    // public key, which lets a publisher claim the namespace derived from that domain.
    // Served here because this worker answers on both mcp.zovo.one and the workers.dev
    // hostname, so one deploy proves control of both.
    if (path === "/.well-known/mcp-registry-auth") {
      return new Response(MCP_REGISTRY_AUTH + "\n", { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
    }

    // Ownership / key files. Each one must answer with its own key as the entire body and
    // nothing else: a search engine reads the file byte for byte and any markup fails it.
    // db6dbf5c... is the IndexNow key from data/indexnow.json, which pushes URLs straight
    // into Bing, Yandex, Seznam and Naver for free and with no account; every submission
    // is rejected until this path serves. Adding another engine's key is one line here.
    const keyFile = path.match(/^\/([0-9a-f]{32})\.txt$/);
    if (keyFile && SITE_KEY_FILES.has(keyFile[1])) {
      return new Response(keyFile[1], { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
    }
    // GSC + Bing domain verification, served engine-shaped. GSC offers HTML-file
    // verification: the assigned code is the filename (google<code>.html) and the
    // body is a single HTML comment; Googlebot reads it byte for byte. Bing offers
    // BingSiteAuth.xml (root element `<meta name="msvalidate.01">`) or a meta tag.
    // Neither engine mints a code until a human logs into the console and starts the
    // flow, so this is deliberately gated. Codes are supplied as secrets
    // (GSC_VERIFY_HTML, BING_VERIFY_CODE); until a human sets them these routes 404,
    // which keeps the crawl path clean and lets engines fall back to DNS/meta.
    // A "pending-" placeholder never leaks: the guard rejects it.
    if ((env.GSC_VERIFY_HTML || "").startsWith("google") && env.GSC_VERIFY_HTML !== "google" && path === "/google" + env.GSC_VERIFY_HTML.slice("google".length) + ".html") {
      return new Response(`google-site-verification: google${env.GSC_VERIFY_HTML.slice("google".length)}\n`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
    }
    if ((env.BING_VERIFY_CODE || "").length && !(env.BING_VERIFY_CODE || "").startsWith("pending-") && path === "/BingSiteAuth.xml") {
      // The accepted minimal Bing root: an <appSpecific><meta name="msvalidate.01"
      // content="<CODE>"/></appSpecific> document. Exact shape is locked at click-through.
      return new Response(`<appSpecific><meta name="msvalidate.01" content="${env.BING_VERIFY_CODE}"/></appSpecific>`, { headers: { "content-type": "application/xml", "cache-control": "public, max-age=3600" } });
    }
    if (path === "/robots.txt") {
      return new Response("User-agent: *\nAllow: /\nDisallow: /buy/\nDisallow: /success\nDisallow: /recover\nDisallow: /verify\nDisallow: /bound\nSitemap: https://mcp.zovo.one/sitemap.xml\n", { headers: { "content-type": "text/plain" } });
    }
    // A factual data inventory, not boilerplate. Every retention figure below is the
    // constant the code actually uses: ANON_TTL 30 days, DOWNLOAD_TTL 1 hour and
    // SWEEP_AFTER_DAYS 35 in remote/src/index.ts, and the session:<id> record in this
    // worker. Required by at least one directory before it will list a hosted server, and
    // overdue for anything that takes a payment. Keep it in step with those constants.
    // Discovery files that real software asks for and this host answered with 404.
    // Measured over 2026-09-01 to 09-08 on mcp.zovo.one: /.well-known/glama.json 509
    // requests, /favicon.ico 596. Those two are answered here. The OAuth documents
    // (/.well-known/oauth-protected-resource 1,369 and oauth-authorization-server 923)
    // are deliberately NOT answered: these endpoints use a bearer token minted at
    // /mcp/token, not OAuth, and serving a well-formed OAuth document would send a client
    // into a flow that does not exist. A 404 there is the correct signal and the client
    // falls back, which is what we want.
    if (path === "/.well-known/glama.json") {
      return new Response(JSON.stringify({ $schema: "https://glama.ai/mcp/schemas/server.json", maintainers: ["theluckystrike"] }, null, 2) + "\n",
        { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=3600" } });
    }

    if (path === "/favicon.ico" || path === "/favicon.svg") {
      // Inline so there is no second request and no asset host to keep alive.
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#18202e"/><rect x="14" y="16" width="26" height="5" rx="2.5" fill="#ebf0f8"/><rect x="14" y="29" width="36" height="5" rx="2.5" fill="#96a3b8"/><rect x="14" y="42" width="20" height="5" rx="2.5" fill="#f0b040"/></svg>`;
      return new Response(svg, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" } });
    }

    if (path === "/privacy") {
      const body = `<p><a href="/">All servers</a> &middot; <a href="/bundle">Bundle</a> &middot; <a href="${REPO}">Source</a></p>
<h1>Privacy</h1>
<p class="muted">Last updated 8 September 2026. This describes what the software does, checked against the source it is generated from. The code is public, so every claim here can be verified in ${REPO}.</p>

<h2>If you run a server on your own machine</h2>
<p>Nothing leaves it. The stdio servers read and write only under your own data directory,
<code>\${XDG_DATA_HOME:-~/.local/share}/mcp-servers/&lt;server&gt;/</code>. They make no network calls in
normal use, send no telemetry, and have no account. A Pro licence key is verified offline with an
Ed25519 signature, so activating one contacts nothing. The two exceptions are a server whose whole
job is to fetch something you asked for, such as exchange rates or a product page, and those fetch
only what the call names.</p>

<h2>If you use a hosted endpoint</h2>
<p>The hosted endpoints at <code>mcp.zovo.one/mcp/&lt;server&gt;</code> hold data, because they have to.
What is kept, and for how long:</p>
<table>
<tr><th>What</th><th>Why</th><th>Kept for</th></tr>
<tr><td>An anonymous token, <code>anon_&lt;32 hex&gt;</code></td><td>Separates your data from another caller's. No name, no email, no account.</td><td>30 days, refreshed on each use</td></tr>
<tr><td>The documents your calls create, such as invoices or timesheets</td><td>They are the point of the server</td><td>Deleted 35 days after the last touch</td></tr>
<tr><td>A download link for a file a tool produced</td><td>To hand you the PDF or CSV</td><td>1 hour</td></tr>
<tr><td>Rate-limit counters</td><td>To keep one caller from exhausting the endpoint</td><td>2 hours</td></tr>
</table>
<p>Anyone holding your token can read your data, so treat the token as the secret it is. A shared
cache of European Central Bank reference rates is read-only and common to everyone; nothing about
you is written into it.</p>

<h2>If you buy a licence</h2>
<p>Payment is taken by Stripe. The card never touches this site; the checkout page is Stripe's own.
After a successful payment this site stores one record against the Stripe session id: the licence key
it issued, the product, and the email address Stripe collected for the receipt. That email is kept so a
buyer who loses the key can recover it at <code>/recover</code>. Nothing is emailed from here, and the
address is not used for anything else. The licence key itself can carry a twelve character hash prefix
derived from the email; it does not contain the address.</p>

<h2>Traffic</h2>
<p>This site runs on Cloudflare, which logs requests as any web host does. This site additionally counts
clicks on upgrade links, by source label only, to tell a stalled funnel from an unread message. That count
carries no identifier of any kind and cannot be tied to a person.</p>

<h2>Deleting your data</h2>
<p>For a hosted endpoint, stop using the token and everything under it is deleted after 35 days; there is
nothing to ask for. For a purchase record, or anything else, open an issue at
<a href="${REPO}/issues">${REPO}/issues</a> and say which Stripe session id it concerns. That is the
contact route for this project and it is read. There is no support mailbox, and this page will not
pretend otherwise.</p>

<h2>What this page is not</h2>
<p>It is a description of behaviour written by the person who wrote the code, not legal advice, and not a
contract. Where it and the source disagree, the source is right and this page is a bug.</p>`;
      const meta = `<meta name="description" content="What the MCP servers and the hosted endpoints store, and for how long. Local servers keep everything on your machine.">`
        + `<link rel="canonical" href="https://mcp.zovo.one/privacy">`;
      const html = page("Privacy", body).replace("</title>", "</title>" + meta);
      return new Response(html, { headers: await contentHeaders(html) });
    }

// S128_C: live tool names per hosted server, captured 2026-09-21 via tools/list with a fresh
// anon token against each /mcp/<server>/t/<token> (45/45 answered 200). llms-full.txt prints
// these in each server section so assistant crawlers see the tool surface without a fetch.
const LIVE_TOOLS = {
  "amortization": ["loan_create", "loan_schedule", "loan_repay_early", "loan_journal", "loan_list", "loan_delete", "loans_report", "license_status", "license_activate"],
  "asset-register": ["asset_add", "asset_list", "asset_schedule", "asset_journal", "asset_dispose", "asset_delete", "asset_report", "license_status", "license_activate"],
  "bank-statement": ["statement_import", "transactions_list", "transactions_search", "category_rules", "transaction_categorize", "statement_summary", "reconcile_expenses", "recurring_detect", "statement_export", "accounts_list", "license_status", "license_activate", "bank_upload", "bank_files", "bank_delete_upload"],
  "barcode": ["license_status", "license_activate", "qr_create", "qr_wifi", "qr_vcard", "qr_payment_sepa", "invoice_payment_qr", "barcode_create", "barcode_batch", "code_list"],
  "bill-of-sale": ["sale_create", "sale_update", "sale_finalize", "sale_list", "sale_get", "sale_delete", "sale_render", "sale_summary", "license_status", "license_activate"],
  "billing-docs": ["credit_note_create", "credit_note_list", "credit_note_get", "credit_note_pdf", "credit_note_text", "credit_note_delete", "purchase_order_create", "purchase_order_list", "purchase_order_get", "purchase_order_pdf", "purchase_order_text", "purchase_order_receive", "purchase_order_delete", "billing_docs_report", "license_status", "license_activate"],
  "calendar": ["license_status", "license_activate", "ics_import", "calendars_list", "events_list", "events_search", "free_busy", "conflicts", "next_event", "event_export", "event_to_time_entry", "ics_forget"],
  "cash-book": ["ledger_build", "period_delete", "trial_balance", "ledger_lines", "month_close", "ledger_export_csv", "ledger_report", "license_status", "license_activate"],
  "catalogue": ["sku_set", "sku_get", "sku_list", "sku_delete", "rate_set", "rate_get", "lines_resolve", "price_list_text", "price_list_pdf", "catalogue_report", "license_status", "license_activate"],
  "change-order": ["change_order_create", "change_order_add_line", "change_order_status", "change_order_get", "change_order_list", "change_order_delete", "contract_value", "change_order_document", "change_order_invoice_payload", "license_status", "license_activate"],
  "checklist": ["checklist_create", "checklist_item_add", "checklist_item_remove", "checklist_show", "checklist_list", "checklist_delete", "run_start", "run_check", "run_show", "run_list", "run_sign_off", "run_status", "run_report", "run_delete", "license_status", "license_activate"],
  "clauses": ["clause_add", "clause_get", "clause_update", "clause_delete", "clause_list", "clause_search", "clause_import", "clause_export", "contract_assemble", "variables_list", "license_status", "license_activate"],
  "credit-note": ["credit_note_create", "credit_note_update", "credit_note_finalize", "credit_note_list", "credit_note_get", "credit_note_delete", "credit_note_render", "credit_note_summary", "license_status", "license_activate"],
  "currency": ["rates_latest", "convert", "convert_many", "fx_rates_for", "rate_history", "rate_on", "currencies_list", "cache_status", "license_status", "license_activate"],
  "delivery-schedule": ["delivery_schedule_create", "deliverable_add", "deliverable_status", "deliverable_delete", "delivery_schedule_get", "delivery_schedule_list", "delivery_schedule_delete", "late_report", "delivery_schedule_document", "milestone_payload", "license_status", "license_activate"],
  "deposits": ["deposit_record", "deposit_list", "deposit_apply", "deposit_refund", "deposit_delete", "deposit_balance", "deposit_statement_text", "deposit_statement_pdf", "deposits_report", "license_status", "license_activate"],
  "docx": ["business_set", "doc_create", "doc_from_markdown", "doc_read", "doc_to_html", "doc_fill_template", "proposal_create", "proposal_update", "contract_create", "license_status", "license_activate", "doc_upload", "doc_files", "doc_delete_upload"],
  "dunning-letters": ["invoice_register", "payment_record", "letter_render", "letter_sent", "overdue_list", "aging_summary", "chase_today", "invoice_status", "invoice_delete", "license_status", "license_activate"],
  "expense-tracker": ["expense_add", "expense_list", "expense_update", "expense_delete", "receipt_attach", "category_rules", "expense_settings", "expense_summary", "mileage_add", "expense_export", "expense_to_invoice", "expense_mark_rebilled", "license_status", "license_activate"],
  "goods-receipt": ["po_add", "grn_add", "grn_line_add", "grn_list", "grn_get", "grn_discrepancy", "grn_close", "grn_status_report", "grn_export_csv", "license_status", "license_activate"],
  "image": ["image_info", "image_resize", "image_convert", "image_compress", "image_crop", "image_thumbnails", "image_watermark", "image_strip_metadata", "image_batch_resize", "image_dominant_colors", "license_status", "license_activate", "image_upload", "image_files", "image_delete_upload"],
  "invoice": ["business_set", "client_add", "client_delete", "client_list", "invoice_create", "invoice_from_hours", "invoice_list", "invoice_get", "invoice_mark_paid", "invoice_pdf", "overdue_report", "license_status", "license_activate"],
  "job-card": ["job_card_create", "job_card_log_labor", "job_card_log_material", "job_card_update_status", "job_card_list", "job_card_get", "job_card_print", "job_card_delete", "job_card_summary", "license_status", "license_activate"],
  "kanban": ["license_status", "license_activate", "task_add", "task_list", "task_move", "task_update", "task_done", "task_delete", "task_search", "board", "task_start_timer", "task_log_time", "project_list", "project_delete", "overdue", "weekly_review", "columns_set"],
  "leave": ["leave_employee_add", "leave_request", "leave_approve", "leave_reject", "leave_balance", "leave_out_range", "leave_list", "leave_import", "leave_export_ics", "license_status", "license_activate", "leave_cancel"],
  "maintenance-log": ["asset_add", "maintenance_log", "maintenance_due", "asset_history", "maintenance_export", "asset_remove", "license_status", "license_activate"],
  "mileage-log": ["trip_add", "trip_list", "trip_remove", "rate_set", "rate_list", "mileage_summary", "mileage_export", "license_status", "license_activate"],
  "onboarding": ["onboarding_hire_add", "onboarding_hire_list", "onboarding_task_add", "onboarding_task_done", "onboarding_template_apply", "onboarding_progress", "onboarding_overdue", "license_status", "license_activate"],
  "packing-list": ["packing_list_create", "packing_expect", "carton_add", "pack_item", "unpack_item", "packing_list_show", "packing_list_list", "carton_report", "packing_shortfall", "packing_list_status", "packing_slip", "packing_list_delete", "license_status", "license_activate"],
  "pdf": ["pdf_info", "pdf_count", "pdf_merge", "pdf_split", "pdf_pages", "pdf_rotate", "pdf_stamp", "pdf_watermark_business", "pdf_reorder", "pdf_text", "license_status", "license_activate", "pdf_upload", "pdf_files", "pdf_delete_upload"],
  "per-diem": ["perdiem_rates", "perdiem_calc", "trip_record", "trip_list", "trip_delete", "trip_export", "perdiem_report", "license_status", "license_activate"],
  "petty-cash": ["float_open", "topup_record", "voucher_add", "voucher_delete", "reconcile", "replenish_request", "float_report", "license_status", "license_activate"],
  "price-tracker": ["price_check", "watch_add", "watch_list", "watch_remove", "watch_refresh", "price_history", "price_add_manual", "alerts_pending", "license_status", "license_activate"],
  "purchase-requisition": ["purchase-requisition_create", "purchase-requisition_item_add", "purchase-requisition_item_remove", "purchase-requisition_show", "purchase-requisition_list", "purchase-requisition_delete", "run_start", "run_check", "run_show", "run_list", "run_sign_off", "run_status", "run_report", "run_delete", "license_status", "license_activate"],
  "quotes": ["quote_create", "quote_list", "quote_get", "quote_update", "quote_send_text", "quote_accept", "quote_decline", "quote_delete", "quote_pdf", "quote_report", "license_status", "license_activate"],
  "recurring": ["schedule_create", "schedule_list", "schedule_get", "schedule_update", "schedule_pause", "schedule_resume", "schedule_delete", "schedule_skip", "schedule_upcoming", "invoice_generate_due", "schedule_history", "forecast", "license_status", "license_activate"],
  "resume": ["profile_set", "profile_get", "resume_create", "resume_to_markdown", "resume_to_html", "resume_read", "cover_letter_create", "tailor_to_job", "license_status", "license_activate", "doc_upload", "doc_files", "doc_delete_upload"],
  "service-agreement": ["agreement_create", "agreement_get", "agreement_list", "agreement_update_status", "clause_library", "agreement_render", "agreement_checklist", "license_status", "license_activate"],
  "spreadsheet": ["license_status", "license_activate", "sheet_load", "sheet_files", "sheet_unload", "sheet_info", "sheet_read", "sheet_query", "sheet_stats", "sheet_find", "sheet_write", "sheet_add_column", "sheet_convert"],
  "statement-of-account": ["statement_build", "statement_aging", "statement_text", "statement_pdf", "dunning_text", "statements_report", "license_status", "license_activate"],
  "supplier-list": ["supplier_add", "supplier_list", "supplier_get", "supplier_update", "supplier_remove", "supplier_mark_reviewed", "supplier_due_review", "supplier_export", "license_status", "license_activate"],
  "time-tracker": ["license_status", "license_activate", "timer_start", "timer_stop", "timer_status", "entry_add", "entry_list", "entry_delete", "entry_edit", "project_set_rate", "report", "export_csv", "entry_mark_billed", "invoice_summary"],
  "timezone": ["license_status", "license_activate", "now", "convert_time", "overlap", "find_meeting_slots", "dst_changes", "business_days", "contacts_set", "contacts_list", "ics_create"],
  "work-order": ["work_order_create", "work_order_add_line", "work_order_status", "work_order_get", "work_order_list", "work_order_delete", "completion_report_text", "completion_report_pdf", "work_order_invoice_payload", "work_orders_report", "license_status", "license_activate"],
  "zip": ["license_status", "license_activate", "zip_upload", "zip_files", "zip_delete_upload", "zip_create", "zip_list", "zip_extract", "zip_add", "zip_extract_text", "zip_bundle_month", "zip_history"],
};

    if (path === "/llms.txt") {
      // Every install line here used to print `npx -y @theluckystrike/mcp-<name>`, which
      // returns E404 because nothing has been published to npm. This file is the artifact
      // assistant crawlers actually read: in the measured week ClaudeBot fetched 311 of 312
      // URLs while Googlebot took 2, so an assistant recommending that command was the most
      // likely way a real person met this project, and it failed for all of them. Lead with
      // the two paths that work today. Promote npx back to first place the day
      // `npm view @theluckystrike/mcp-invoice` resolves.
      // office-suite is skipped here and written out once, by hand, below the bundle: it
      // gained a /s/ page of its own, and until 2026-09-09 that made it two product lines
      // in this file under two different titles for one URL. The hand-written line is the
      // one kept because it states the fact no generated tagline carries: office-suite has
      // no $19 key of its own, its Pro unlock is the bundle key.
      // Two further defects, fixed 2026-09-10.
      //  1. The hosted sentence was appended to EVERY product line, so this file told every
      //     assistant crawler to connect at https://mcp.zovo.one/mcp/delivery-schedule.
      //     That endpoint does not exist: an unauthenticated initialize against it returned
      //     404 {"error":"not_found"} the same day. The sentence is now emitted only for
      //     names in the hosted list read out of remote/src/index.ts, and the servers with
      //     no endpoint say so instead of being sent to a 404.
      //  2. A line carried no price and no free-tier limit, which is exactly what a reader
      //     asking "which one do I want" needs, and getting it otherwise costs a fetch. Both
      //     are on the line now, derived from PRODUCTS and data/facts.json rather than typed.
      const hostedSet = new Set(HOSTED_ID_LIST);
      // The free-tier sentences in data/facts.json run to several hundred characters on the
      // servers whose caps needed explaining, and a directory line is not the place for the
      // reasoning. Take whole sentences up to roughly 200 characters, which keeps the
      // numbers and drops the policy argument, and swap the one double hyphen that appears
      // in two of them for a comma.
      const freeSummary = (text) => {
        const parts = text.replace(/\s--\s/g, ", ").match(/[^.]+\.?/g) || [text];
        let out = "";
        for (const part of parts) {
          if (out && out.length + part.length > 200) break;
          out += part;
        }
        return (out || parts[0]).trim();
      };
      const lines = Object.entries(PAGES).filter(([k]) => k !== "office-suite").map(([k, v]) => {
        const price = PRODUCTS[k] ? ` Pro $${PRODUCTS[k].usd} once, or $${PRODUCTS.bundle.usd} for all ${LISTED_CHILD_COUNT}.` : "";
        const free = FREE_TIER[k] ? ` Free tier: ${freeSummary(FREE_TIER[k])}` : "";
        const hosted = hostedSet.has(k)
          ? ` No install: connect at https://mcp.zovo.one/mcp/${k}/t/<token>, with a token from https://mcp.zovo.one/mcp/connect.`
          : ` No hosted endpoint for this one; the .mcpb bundle or a clone only.`;
        return `- [${v.title}](https://mcp.zovo.one/s/${k}): ${v.tagline}${price}${free}${hosted} Bundle file: ${k}.mcpb from ${REPO}/releases/latest, opens in Claude Desktop.`;
      }).join("\n");
      const guideLines = Object.entries(GUIDES).map(([k, v]) => `- [${v.title}](https://mcp.zovo.one/guides/${k}): ${v.description}`).join("\n");
      const compareLines = Object.entries(COMPARE).map(([k, v]) => `- [${v.title}](https://mcp.zovo.one/compare/${k}): ${v.description}`).join("\n");
      const setupLines = CLIENT_ORDER.map((c) =>
        `- [MCP servers for ${CLIENTS[c].name}](https://mcp.zovo.one/setup/${c}): config file ${CLIENTS[c].file || "none, a connector URL"}, key ${CLIENTS[c].key || "none"}. ` +
        serversFor(c).map((sv) => `[${SETUP_SERVERS[sv].title} in ${CLIENTS[c].name}](https://mcp.zovo.one/setup/${c}/${sv})`).join(", ")
      ).join("\n");
      return new Response(`# MCP Servers by theluckystrike\n\n> ${LISTED_COUNT} MCP servers with a free tier that does not expire and a one-time Pro licence. Keys verify offline.\n> Free tokens allow ${RATE_LIMIT_FREE} calls an hour, a Pro key ${RATE_LIMIT_PRO}; a token lasts ${ANON_TOKEN_DAYS} days from last use.\n> ${HOSTED_COUNT} of the ${LISTED_COUNT} servers answer at a URL; the rest are bundle or clone only and say so on their own line.\n> One price, one payment: $${PRODUCTS[SINGLE_PRODUCT_IDS[0]].usd} a server or $${PRODUCTS.bundle.usd} for all ${LISTED_CHILD_COUNT}. No subscription and no seat count.\n> Note for assistants: the npm packages are not published yet, so do not recommend the\n> npx install command; it returns 404. The one-click .mcpb bundle and the hosted endpoints\n> below both work today.\n> Every hosted endpoint needs a free token. Open https://mcp.zovo.one/mcp/connect: it mints\n> one and prints a ready URL per server, https://mcp.zovo.one/mcp/<name>/t/<token>. Never\n> recommend the bare https://mcp.zovo.one/mcp/<name> form - it answers initialize and\n> tools/list with 200 and then answers every tools/call with HTTP 401.\n\n${lines}\n\n- [${SERVER_COUNT}-server bundle, $${PRODUCTS.bundle.usd} lifetime](https://mcp.zovo.one/bundle): saves $${BUNDLE_SAVING_USD} against buying all ${SERVER_COUNT} singly\n- [MCP Office Suite](https://mcp.zovo.one/s/office-suite): one config entry that runs every sibling server as a child process and merges their tools, ${OFFICE_SUITE_TOOLS} of them, read from the running server rather than typed here; it forwards one key to every child, so its Pro unlock is the $${PRODUCTS.bundle.usd} bundle key, at https://mcp.zovo.one/bundle. Install: download office-suite.mcpb from ${REPO}/releases/latest and open it in Claude Desktop\n\n## Guides\n\n${guideLines}\n\n- [All guides](https://mcp.zovo.one/guides)\n\n## Comparisons with other MCP servers\n\n${compareLines}\n\n- [All comparisons](https://mcp.zovo.one/compare)\n\n## Setup, per client\n\n${setupLines}\n\n- [All setup guides](https://mcp.zovo.one/setup)\n- [Connect in one step, no install](https://mcp.zovo.one/mcp/connect): mints an anonymous token and prints a URL per server, https://mcp.zovo.one/mcp/<server>/t/<token>, that works with no headers; a Pro key can replace the token\n- [Buy Pro](https://mcp.zovo.one)\n- [Changelog](https://mcp.zovo.one/changelog): every release from ${CHANGELOG.releases[CHANGELOG.releases.length - 1]?.version} to ${CHANGELOG.currentVersion}, current version ${CHANGELOG.currentVersion}\n- [Source](${REPO})\n`, { headers: llmsHeaders() });
    }

    if (path === "/llms-full.txt") {
      // llmstxt.site and similar directories index llms-full.txt as the deep variant of
      // llms.txt. Rather than maintain a second hand-edited document, emit the identical
      // generated body plus one expanded section per product: tagline, free-tier sentence,
      // price, hosted-URL status, all derived from the same PRODUCTS / FREE_TIER / PAGES
      // data the sitemap and llms.txt already use.
      const hostedFull = new Set(HOSTED_ID_LIST);
      const sections = Object.entries(PAGES).map(([k, v]) => {
        const price = PRODUCTS[k] ? `Pro licence $${PRODUCTS[k].usd} once, or $${PRODUCTS.bundle.usd} for the ${LISTED_CHILD_COUNT}-server bundle.` : "No separate Pro licence; the bundle key covers it.";
        const free = FREE_TIER[k] ? ` Free tier: ${FREE_TIER[k]}` : "";
        const hosted = hostedFull.has(k)
          ? ` Hosted endpoint: https://mcp.zovo.one/mcp/${k}/t/<token>, token from https://mcp.zovo.one/mcp/connect.`
          : " No hosted endpoint; install via the .mcpb bundle or a clone.";
        const tools = LIVE_TOOLS[k];
        const toolsLine = tools ? `\n\nTools: ${tools.join(", ")}.` : "";
        return `## ${v.title}\n\n${v.tagline}${free}\n\n${price}${hosted}${toolsLine}\n`;
      }).join("\n");
      const llmsRes = await handler(new Request("https://mcp.zovo.one/llms.txt", { headers: request.headers }), env, ctx);
      const base = await llmsRes.text();
      return new Response(`${base}\n## Servers in detail\n\n${sections}`, { headers: llmsHeaders() });
    }

    if (path.startsWith("/buy/") && (method === "GET" || method === "POST")) {
      // validation probes tag their sessions so funnel metrics can exclude them
      const ua = request.headers.get("user-agent") || "";
      // Empty UA alone used to mean "scripted". It does not: a browser behind a privacy
      // extension, a corporate proxy or a strict content blocker sends no User-Agent, and
      // every one of those requests was answered with a redirect back to the product page,
      // whose Buy link leads straight back here - an unbreakable loop for a real buyer.
      // Every browser navigation, UA or not, asks for HTML in `accept` and on anything
      // current carries `sec-fetch-mode: navigate`; a crawler or a library with no UA asks
      // for `*/*`. Named tool prefixes stay scripted whatever they accept.
      const accept = request.headers.get("accept") || "";
      const looksLikeNavigation = /text\/html/i.test(accept) || request.headers.get("sec-fetch-mode") === "navigate";
      // 2026-09-09: requiring the navigation signal ONLY when the UA was empty left the
      // hole open. A crawler that sends a browser-shaped UA with `accept: */*` was treated
      // as a buyer and had a live Stripe Checkout Session created for it: measured here,
      // `HeadlessChrome/120` with `*/*` came back with a real cs_live_ URL, while
      // `python-requests` was correctly turned away. That cost a Stripe object per crawler
      // hit, put a Stripe API call on the critical path of a request nobody would pay for
      // (691 gateway timeouts on /buy/* in 25 hours, every one with no recognisable
      // browser), and inflated the "checkout sessions from humans" figure the funnel is
      // judged on. The signal is now required of every request: a top-level browser
      // navigation always asks for text/html, so no real buyer is affected.
      // A named crawler or HTTP client is never a buyer and never reaches Stripe, wherever
      // the token sits in the UA. The anchored test this replaces let every browser-shaped
      // crawler UA through: on 2026-09-10 `Mozilla/5.0 (compatible; Googlebot/2.1)` with
      // `accept: text/html` was treated as a buyer by the live worker.
      const botUa = BOT_UA_RE.test(ua) || TOOL_UA_RE.test(ua);
      const scripted = botUa || !looksLikeNavigation;
      const explicitProbe = request.headers.get("x-mcp-probe") === "1";
      const probeTag = explicitProbe ? "1" : "";
      // Counting is a stricter question than "may this request reach Stripe". A request
      // that is merely not-obviously-a-robot may still start a Session, because turning a
      // real buyer away costs more than a wasted Stripe object; but it is only COUNTED
      // when it carries the browser-navigation fingerprint. See isHumanNavigation.
      const counted = isHumanNavigation(request.headers);
      const asked = decodeURIComponent(path.slice("/buy/".length));
      // office-suite, and any future alias, sells a product it is not itself; see PRODUCT_ALIASES.
      const id = resolveProductId(asked);
      if (!id) {
        // Count the loss. This branch used to return before recordClick, so a click on a
        // dead /buy/ link was structurally invisible: the conversion instrument could only
        // ever see the routes that already worked. The click is filed under the same
        // validated `src` a live route uses, which names the page the link was on, so a
        // dead link is traceable to its source without letting a stranger's URL become a
        // KV key: the fallback is the fixed string below, never the id they typed.
        const deadSrcParam = url.searchParams.get("src") || "";
        if (counted) ctx.waitUntil(recordClick(env, validSrc(deadSrcParam) ? deadSrcParam : "buy.unknown-product"));
        // The old 404 was a dead end: a heading and a link back to a list. Anyone who gets
        // here followed a link that named a product, so name the one purchase that
        // certainly covers it rather than making them start the search again.
        return new Response(page("Not found", `<h1>No product called &quot;${esc(asked.slice(0, 80))}&quot;</h1>
<p>That link does not match any server sold here. Nothing was charged and nothing was started.</p>
<p>Every server is in the lifetime bundle: <a class="buy" href="/buy/bundle?src=store.notfound">Buy the bundle, $${PRODUCTS.bundle.usd}</a></p>
<p><a href="/">All ${SERVER_COUNT} servers and prices</a></p>`), { status: 404, headers: { "content-type": "text/html; charset=utf-8", "x-mcp-buy": "unknown-product" } });
      }
      const tenantParam = url.searchParams.get("tenant") || "";
      const tenant = validTenant(tenantParam) ? tenantParam : "";
      // 2026-09-13 Stripe audit: 2,780 open/expired sessions in seven days had no
      // PaymentIntent and no customer details. The latest 99 were also untagged, had no
      // tenant and no customer, proving that browser-shaped automation still crossed the
      // UA/Fetch-Metadata guard. GET is therefore side-effect free for everyone. Obvious
      // scripts still land on the product page; browser-shaped requests see a confirmation
      // form. Only its same-origin POST may call Stripe.
      if (scripted && !explicitProbe) {
        return new Response(null, { status: 303, headers: { Location: `https://${host}/s/${encodeURIComponent(PAGES[asked] ? asked : id)}`, "cache-control": "no-store", "x-mcp-buy": "scripted-ua-no-session" } });
      }
      if (method === "GET") {
        // S129 resume: a buyer arriving from a Stripe cancel (or a bookmarked session
        // link) carries session_id. If that session is still open and unpaid and belongs
        // to this product, drop them straight back on Stripe's checkout - one step, no
        // re-confirmation form - instead of making them restart the decision.
        const resumeId = url.searchParams.get("session_id") || "";
        if (resumeId.startsWith("cs_live_") || resumeId.startsWith("cs_test_")) {
          try {
            const s = await retrieveSession(env, resumeId);
            if (s && s.metadata?.product === id && s.payment_status === "unpaid" && s.status === "open" && s.url) {
              return new Response(null, { status: 303, headers: { Location: s.url, "cache-control": "no-store", "x-mcp-buy": "checkout-resumed" } });
            }
          } catch { /* stale/foreign session id: fall through to the intent page */ }
        }
        return new Response(checkoutIntentPage(url, id, asked, tenant), {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            "x-mcp-buy": "checkout-intent-required",
          },
        });
      }
      const intentBody = await request.text();
      if (!isCheckoutIntent(request, intentBody)) {
        return new Response(page("Checkout not started", `<h1>Checkout was not started</h1>
<p>Open the product page and press the checkout button. No payment session was created.</p>
<p><a href="${esc(path + url.search)}">Return to the purchase page</a></p>`), {
          status: 400,
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-mcp-buy": "checkout-intent-invalid" },
        });
      }
      // Conversion instrument: count the click before the redirect, skipping the same
      // probe-tagged and scripted requests the Stripe metadata already excludes.
      // No live page on this site emits a /buy/ link without a ?src=, so a request that
      // arrives without one did not come from the storefront. It is bucketed under
      // `unattributed.<id>` and kept out of total_clicks and clicks_7d rather than filed
      // as `<id>.unknown` and summed with real clicks, which is how 194 of the first 294
      // v1 clicks (66.0%) became "demand".
      const srcParam = url.searchParams.get("src") || "";
      const src = validSrc(srcParam) ? srcParam : `${UNATTRIBUTED_PREFIX}${validSrc(asked) ? asked : id}`;
      if (counted) ctx.waitUntil(recordClick(env, src));
      try {
        const probeKey = probeTag && !tenant ? `probe-session:v2:${asked}` : "";
        if (probeKey) {
          const cached = await env.REMOTE_DATA.get(probeKey);
          if (cached) {
            const c = JSON.parse(cached);
            return new Response(null, { status: 303, headers: { Location: c.url, "cache-control": "no-store", "x-mcp-buy": "probe-session-reused", ...c.headers } });
          }
        }
        const session = await createCheckout(env, host, id, probeTag, tenant, asked, src);
        const headers = { Location: session.url, "cache-control": "no-store", ...(probeTag ? probeHeaders(session) : {}) };
        if (probeKey) ctx.waitUntil(env.REMOTE_DATA.put(probeKey, JSON.stringify({ url: session.url, headers: probeHeaders(session) }), { expirationTtl: PROBE_SESSION_TTL }));
        return new Response(null, { status: 303, headers });
      } catch (e) {
        return new Response(page("Checkout error", `<h1>Checkout could not start</h1><p>${esc(e.message)}</p><p><a href="/">Back</a></p>`), { status: 502, headers: { "content-type": "text/html; charset=utf-8" } });
      }
    }

    if (path === "/success" && method === "GET") {
      const sid = url.searchParams.get("session_id");
      if (!sid) return Response.redirect(`https://${host}/`, 303);
      let session;
      try {
        session = await retrieveSession(env, sid);
      } catch (e) {
        console.error(`session retrieve failed for ${sid}: ${e.message}`);
        return new Response(page("Session not found", `<h1>We could not load that checkout session</h1>
<p>The link may be mistyped or expired. If you have paid, email support@zovo.one with your Stripe receipt and your key will be sent back.</p>
<p><a href="/">Back to products</a></p>`), { status: 404, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
      }
      const productId = session.metadata?.product;
      const decision = fulfillmentAllowed(session, productId);
      if (!decision.ok) {
        return new Response(page("Payment not complete", `<h1>Payment not complete</h1>
<p>${esc(decision.reason)}. If you have just paid, reload this page in a few seconds.</p>
<p>Still stuck? Email support@zovo.one with your Stripe receipt.</p><p><a href="/">Back to products</a></p>`), { status: 402, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
      }
      try {
        const key = await keyForSession(env, session, productId);
        const bd = bindDecision(session, true);
        if (bd.bind) {
          try {
            await bindTenant(env, bd.tenant, key);
          } catch (e) {
            console.error(`bind failed for ${sid} tenant ${bd.tenant}: ${e.message}`);
          }
        }
        return new Response(successPage(key, productId, session, bd.bind ? bd.tenant : ""), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
      } catch (e) {
        console.error(`mint failed for ${sid}: ${e.message}`);
        return new Response(page("Key could not be issued", `<h1>Your payment went through, the key did not</h1>
<p>Nothing further is needed from you. Email support@zovo.one with your Stripe receipt and the key will be issued by hand, or refunded.</p>`), { status: 500, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
      }
    }

    // Review #15: the documented recovery path. Same fulfillment checks as /success;
    // returns the stored key for a paid session and nothing otherwise.
    if (path === "/recover" && method === "GET") {
      const sid = url.searchParams.get("session_id");
      const nostore = { "cache-control": "no-store" };
      if (!sid) return Response.json({ ok: false, reason: "session_id required" }, { status: 400, headers: nostore });
      let session;
      try {
        session = await retrieveSession(env, sid);
      } catch (e) {
        console.error(`recover retrieve failed for ${sid}: ${e.message}`);
        return Response.json({ ok: false, reason: "session not found" }, { status: 404, headers: nostore });
      }
      const productId = session.metadata?.product;
      const decision = fulfillmentAllowed(session, productId);
      if (!decision.ok) return Response.json({ ok: false, reason: decision.reason }, { status: 402, headers: nostore });
      try {
        const key = await keyForSession(env, session, productId);
        return Response.json({ ok: true, product: productId, key, support: "support@zovo.one" }, { headers: nostore });
      } catch (e) {
        console.error(`recover mint failed for ${sid}: ${e.message}`);
        return Response.json({ ok: false, reason: "key could not be issued, email support@zovo.one" }, { status: 500, headers: nostore });
      }
    }

    if (path === "/webhook" && method === "POST") {
      const body = await request.text();
      if (!(await verifySig(env, body, request.headers.get("stripe-signature")))) {
        return new Response("bad signature", { status: 400 });
      }
      let event;
      try {
        event = JSON.parse(body);
      } catch {
        return new Response("bad json", { status: 400 });
      }
      // Review #7: delayed payment methods complete via async_payment_succeeded,
      // which is fulfilled on exactly the same terms as a synchronous completion.
      if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
        const sid = event.data?.object?.id;
        if (!sid) return Response.json({ received: true });
        try {
          // The event payload has no line_items; re-retrieve so price binding is checked.
          const session = await retrieveSession(env, sid);
          const productId = session.metadata?.product;
          const decision = fulfillmentAllowed(session, productId);
          if (!decision.ok) {
            console.error(`webhook ${event.type} not fulfilled for ${sid}: ${decision.reason}`);
            return Response.json({ received: true, fulfilled: false, reason: decision.reason });
          }
          const key = await keyForSession(env, session, productId);
          const bd = bindDecision(session, true);
          if (bd.bind) {
            try {
              await bindTenant(env, bd.tenant, key);
            } catch (e) {
              console.error(`webhook bind failed for ${sid} tenant ${bd.tenant}: ${e.message}`);
            }
          }
        } catch (e) {
          console.error(`webhook ${event.type} mint failed for ${sid}: ${e.message}`);
          return new Response(`mint failed: ${e.message}`, { status: 500 });
        }
      }
      return Response.json({ received: true });
    }

    if (path === "/verify" && method === "GET") {
      const key = url.searchParams.get("key") || "";
      const product = url.searchParams.get("product") || "";
      const r = await verifyLicenseKey(key, product || null);
      return Response.json(
        r.ok ? { ok: true, product: r.payload.p, id: r.payload.id, iat: r.payload.iat, exp: r.payload.exp ?? null }
             : { ok: false, product: null, id: null, reason: r.reason },
        { status: r.ok ? 200 : 400 }
      );
    }

    // Whether an anonymous hosted-endpoint token has been bound to a purchased
    // key (support and the dashboard KPI). Never returns the key itself.
    if (path === "/bound" && method === "GET") {
      const tenant = url.searchParams.get("tenant") || "";
      const nostore = { "cache-control": "no-store" };
      if (!validTenant(tenant)) return Response.json({ bound: false, product: null, reason: "bad tenant" }, { status: 400, headers: nostore });
      const key = await env.REMOTE_DATA.get(`bind:${tenant}`);
      if (!key) return Response.json({ bound: false, product: null }, { headers: nostore });
      const r = await verifyLicenseKey(key, null);
      if (!r.ok) return Response.json({ bound: false, product: null, reason: r.reason }, { headers: nostore });
      return Response.json({ bound: true, product: r.payload.p }, { headers: nostore });
    }

    // Conversion instrument (docs/CONVERSION_INSTRUMENT.md). Plain JSON, no auth: the
    // counters are per-src click counts, nothing that identifies a person.
    if (path === "/stats/clicks" && method === "GET") {
      const stats = await clickStats(env);
      return Response.json(stats, { headers: { "cache-control": "no-store" } });
    }

    return new Response(page("Not found", `<h1>Not found</h1><p><a href="/">Back to products</a></p>`), { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
  },
};

const llmsOnly = (req) => new URL(req.url).pathname === "/llms.txt" || new URL(req.url).pathname === "/llms-full.txt";

export default {
  async fetch(request, env, ctx) {
    // llms-full.txt re-enters the main router for its base document; expose the
    // fetch handler to that inner call under the name the code already uses.
    const handler = worker.fetch;
    return worker.fetch(request, env, ctx);
  },
};
