#!/usr/bin/env node
/**
 * Generates servers/<name>/SPEC.md for every shipped server (office-suite excluded:
 * it is a proxy bundle, its contract is the union of its children).
 *
 * Sources, in this order:
 *   1. The built server itself, spawned over stdio: initialize, tools/list,
 *      resources/list, prompts/list. Nothing is read from src for the tool surface.
 *   2. servers/<name>/README.md for the free-vs-pro table.
 *   3. servers/<name>/src/*.ts, grepped for error-message literals (failure modes).
 *   4. The CURATED table below for invariants and storage, which cannot be probed.
 *
 * The output is deterministic: tools, resources, prompts, args and failure modes are
 * sorted, and no timestamp is written. Running it twice produces no diff.
 *
 * Usage: node scripts/gen-spec.mjs [name ...]
 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");

const SERVERS = [
  "amortization", "asset-register", "bank-statement", "cash-book", "billing-docs", "calendar", "catalogue", "change-order", "clauses", "currency", "delivery-schedule", "deposits", "docx",
  "expense-tracker", "image", "invoice", "kanban", "pdf", "per-diem", "petty-cash", "price-tracker", "recurring",
  "resume", "spreadsheet", "statement-of-account", "time-tracker", "timezone", "work-order",
  "packing-list", "checklist",
].sort();

const COMMON_INVARIANTS = [
  "stdout carries JSON-RPC only. Every diagnostic goes to stderr. A single stray stdout write breaks the client session.",
  "A tool never throws across the transport. Failures come back as `{ content: [{ type: \"text\", text: \"Error: ...\" }], isError: true }`.",
  "Writes are atomic: the payload goes to `<file>.<pid>.tmp` and is then `rename`d over the target, so a reader never sees a half-written file.",
  "No partial writes. When a limit or a validation refuses the operation, nothing at all is written; the tool says what was refused and why.",
  "Money is stored and compared in minor units (integer cents), never as a float. Formatting to a decimal string happens at the edge only.",
  "Dates are local calendar dates as `YYYY-MM-DD`. No implicit UTC shift is applied to a user-supplied date.",
  "A store file that fails to parse is quarantined byte-for-byte as `<file>.corrupt-<timestamp>` with a `<file>.corrupt` marker; nothing is overwritten and every later call fails until a human resolves it.",
  "The load-mutate-save cycle is held under an advisory lock directory (`packages/mcp-license` `withFileLock`), so two processes sharing one data dir cannot lose each other's writes.",
];

/**
 * Hand-curated per server: what cannot be read off the wire.
 * `storage` files are relative to the data dir. `extra` invariants are appended to the
 * common list. `caps` documents the enforced limits that a contract test can assert.
 */
const CURATED = {
  "amortization": {
    summary: "Loan and lease schedules derived from the terms of a credit agreement and nothing else: the level payment, the effective annual rate, the schedule period by period in integer minor units, what settling or overpaying early costs and saves, and the double entry for a payment in the cash book's own account names. No schedule is stored; every row is derived on the call.",
    storageFiles: [
      ["loans.json", "the register of agreements, each carrying the terms it was created with and nothing derived from them but the payment and the effective rate"],
      ["counter.json", "the LOAN number series, per year of the start date"],
    ],
    primaryFile: "loans.json",
    caps: [
      "`FREE_LOANS` = 3 agreements in the register on free. `loan_schedule` and `loan_list` are free and unlimited on every tier.",
      "`loan_repay_early`, `loan_journal` and `loans_report` are Pro. The refusal is an answer, not a protocol error, and nothing is written.",
      "`MAX_PERIODS` = 600 payment periods in one schedule; `MAX_RATE_BPS` = 1,000,000 basis points; `MAX_MINOR` = 1e14 per amount field.",
      "`MAX_ROWS` = 600 rows returned by one `loan_schedule` or `loan_list` answer.",
    ],
    extra: [
      "THE PAYMENT NEVER VARIES AND THE LAST PERIOD ABSORBS THE ROUNDING RESIDUAL, in its interest and principal split rather than in the payment. Rounding each period's interest to the minor unit leaves the closing balance a few units off after a chain of subtractions, and there are only two places to put that: the final payment, which is the amount the borrower is contractually due to pay, or the final split, which is not. On the reference loan the final interest is 882 rather than the 880 an unrounded balance carries, the payment stays 88,849, and the closing balance is exactly zero.",
      "A residual is only absorbed while it IS a residual. The drift from per-period rounding is about one minor unit a period, so a gap wider than the term is not drift, it is a final period that is genuinely short, and then the PAYMENT gives way and the interest stays what was actually charged. An interest figure is never negative and a closing balance never passes through zero.",
      "A level payment rounded once, repeated, can clear the debt EARLY. At 250 basis points over 360 annual periods the schedule closes at period 356 and says so; it never runs on into a negative balance to fill out the term.",
      "Compounding and payment frequency are two different clocks. The rate for one payment period is the EQUIVALENT rate through the compounding clock, (1 + r/m)^(m/p) - 1, never the nominal rate divided by the number of payments: on a nominal 12 percent compounded monthly with quarterly payments that is 3.0301 percent a quarter and not 3.0000, worth 1.0 percent of the whole interest bill on a one-year loan.",
      "The nominal rate and the effective annual rate are reported side by side on every agreement. A nominal 12 percent compounded monthly is an effective 12.68 percent, and the 0.68 is the part of the price the headline rate does not carry.",
      "NO SCHEDULE IS STORED. The register holds the terms and only two derived figures, the payment and the effective rate; every row is rebuilt on the call. A stored schedule is a second copy of what the rate and the term already decide, and the copy is the one that gets believed after somebody edits the rate.",
      "ONLY THE INTEREST IS AN EXPENSE. `loan_journal` debits interest expense and loan liability and credits cash, and the `expense_add`-ready payload carries the INTEREST alone. Booking the whole payment as an expense overstates the cost of the business by the principal, every period, and still reconciles against the bank.",
      "The three account ids are the cash book's. `cash` is `servers/cash-book`'s own `CASH` id character for character; `loan_liability` and `interest_expense` are new, because that server derives no loan entries yet, and they follow its id convention exactly so no journal produced here has to be re-mapped later.",
      "A balloon is due WITH the last payment and is never inside it. The closing balance of the final period IS the balloon, and the answer says in words that the borrower owes it on top of the payment shown.",
      "Fees are not interest. An arrangement fee is paid at drawdown, sits outside every payment row and outside the total interest, and the cost of credit is stated as the two added together.",
      "An early settlement is stated GROSS and NET of the penalty, and the verdict says which way it goes. A penalty larger than the interest saved makes repaying early a loss, and that case is reported as a cost rather than as a smaller saving.",
      "Nothing is written by `loan_repay_early`: the stored agreement keeps its original terms. It answers what would happen, and the agreement is amended by whoever signs it.",
      "Currencies are never added together. This server holds no exchange rate, so one outstanding figure over a EUR loan and a USD one would be invented.",
      "Month arithmetic CLAMPS to the end of the target month, so a loan drawn on the 31st pays on the 28th in February and on the 31st again in March. Rolling forward instead would move a payment into the next month and shift every date after it.",
    ],
  },
  "catalogue": {
    summary: "One price list and one labour rate card, kept where the invoice and the quote servers can both read them. A SKU carries a code, a name, a unit, an optional VAT rate and price ROWS, each row a currency, a tier, a valid-from date and an amount in minor units; a role carries an hourly rate the same way. The price on a date is the latest valid_from at or before it, worked out on the call. lines_resolve hands back the same lines in both sibling argument shapes, already priced. No current price is stored and no price is ever invented.",
    storageFiles: [
      ["skus.json", "the catalogue lines, each carrying its price rows and nothing worked out from them"],
      ["rates.json", "the labour rate cards, each carrying its rate rows and the SKU it bills under"],
      ["register.json", "one row per SKU or role a resolution has priced a line from, which is what makes sku_delete safe to leave free"],
      ["counter.json", "the RES resolution number series, per year of the resolution date"],
      ["pdf/", "price lists written by price_list_pdf when no out_path is given"],
    ],
    primaryFile: "skus.json",
    caps: [
      "`FREE_SKUS` = 25 SKUs in the catalogue on free. Deleting one that nothing depends on is free on every tier, so the cap is one you can get back under without a key.",
      "Price tiers other than `standard` are Pro, on every tool that takes a tier. `price_list_pdf` and `catalogue_report` are Pro. The refusal is an answer, not a protocol error, and nothing is written.",
      "`MAX_PRICE_ROWS` = 100 price rows on one SKU; `MAX_RATE_ROWS` = 100 rate rows on one card; `MAX_MINOR` = 1e12 per money field; `MAX_QUANTITY` = 1,000,000; `MAX_HOURS` = 100,000; `MAX_VAT` = 1000 percent.",
      "`MAX_LINES` = 200 lines in one `lines_resolve` call; `MAX_ROWS` = 500 rows returned by one `sku_list`, `price_list_text` or `catalogue_report` section.",
    ],
    extra: [
      "THE TWO SIBLING SERVERS TAKE THE SAME PRICE IN DIFFERENT SCALES, AND THE GAP IS EXACTLY 100x. `invoice_create`'s item carries `unit_price` in MAJOR units; `quote_create`'s item carries `unit_price_minor` in MINOR units. Neither tool can tell that the number it was handed was scaled for the other one. So the catalogue stores MINOR units, which is the only lossless form, and `lines_resolve` builds BOTH payloads itself in one call with the scale printed against each, rather than returning one price the caller reshapes.",
      "THE MONEY IS THE INVOICE SERVER'S OWN. `computeTotals`, `currencyDecimals`, `formatMoney` and `roundHalfUp` are imported from `@theluckystrike/mcp-invoice/lib` and no arithmetic is restated here, so a resolution's totals ARE what `invoice_create` will compute rather than a second implementation that agrees today.",
      "EVERY STORED PRICE IS A WHOLE NUMBER OF MINOR UNITS, so the major-unit form in the invoice payload rounds straight back to the integer it came from and `rounding_drift_minor` on a resolution is zero by construction. The unit suite asserts it, which is the machine-checkable form of \"the invoice will show the figure the price list showed\".",
      "NO CURRENT PRICE IS STORED. A SKU holds its price rows with the day each came into force; the price on a date is derived on the call. A stored current price is a second copy of what the rows already decide, and the copy is the one still being quoted a month after the rise.",
      "THE PRICE ON A DATE IS THE LATEST `valid_from` AT OR BEFORE IT, for that currency and that tier. A date before every row has no price and is refused naming the earliest row, because a price that did not exist yet is not a price, and filling it with the earliest row would reprice history.",
      "ONE ROW PER CURRENCY, TIER AND VALID-FROM DATE. Setting a row on a key that already exists REPLACES it and says what it replaced, so two rows can never share one key and the price on that day is never a coin toss. A call that would change nothing at all is refused by name rather than rewriting `updated` and reporting a repricing that did not happen.",
      "A SECOND CODE CARRYING THE SAME NAME, UNIT AND PRICE IS REFUSED BEFORE THE FREE CAP IS CONSULTED, so the refusal names the code already stored rather than selling an upgrade, and burns neither a slot nor a place in the price list. `duplicate_ok` is the way through for a genuine second product.",
      "AN UNKNOWN SKU OR ROLE IS REFUSED BY NAME AND NOTHING IS PRICED. There is no fallback price, no profile default rate and no nearest match: a price this server invented would be printed on a document a customer pays from. The refusal names the code and points at `sku_list` or `sku_set`.",
      "A SKU IS DELETED ONLY WHILE NOTHING DEPENDS ON IT: no rate card points at it, and no resolution has ever priced a line from it. The register records one row per priced ref, so the refusal names the times it was used and the last resolution id. Deleting is free on every tier, because a way back under the cap that only a Pro key can reach is not a way back.",
      "THIS SERVER CREATES NO INVOICE AND NO QUOTE. `lines_resolve` returns arguments and says `posted: false`; the caller runs `invoice_create` in the invoice server or `quote_create` in the quotes server.",
      "ONE RESOLUTION CARRIES ONE CURRENCY. A line in another currency is refused rather than converted, because this server holds no exchange rate. A SKU with no price in the profile's default currency is counted by `catalogue_report`, since that is the row that stops a resolution dead.",
      "THE PRICE LIST PDF PRINTS EVERY LINE AT A QUANTITY OF ONE and labels the figure at the bottom as the sum of one of each, not a quotation. A price list has no total of its own, and printing one as though it were a document total would put a number on a customer's desk that means nothing.",
      "THE NAME ON THE PRICE LIST COMES FROM THE SHARED PROFILE, NOT FROM THE INVOICE SERVER'S `getBusiness()`, because that function's `dataDir()` CREATES `mcp-servers/invoice/` as a side effect of a read. The contract suite asserts the only sibling path this process touches is the shared profile file.",
      "The A4 price list is `renderDocPdf` from `@theluckystrike/mcp-billing-docs/lib`, the same page a credit note and a purchase order use, so a price list and the invoice it becomes are recognisably one document family.",
    ],
  },
  "delivery-schedule": {
    summary: "Dated deliverables against a quote, a work order or a change order: what is being handed over, the day it is due, its value in whole minor units when it is separately priced, and a dated status history that runs planned to in progress to delivered to accepted with the client's acceptance note on the accepted move. A late report for any date the caller names, worst first, with the value at risk per currency. The delivered-and-accepted milestones as invoice_create-ready items in MAJOR units and quote_create-ready items in MINOR units at once. No status, no lateness and no total is stored.",
    storageFiles: [
      ["schedules.json", "the schedules, each carrying its reference, that document's date, its deliverables with their due dates, values and dated status histories, and nothing derived from them"],
      ["counter.json", "the DS number series, per year of the reference date"],
    ],
    primaryFile: "schedules.json",
    caps: [
      "`FREE_OPEN_SCHEDULES` = 3 OPEN schedules on free, where open means at least one deliverable is not yet accepted. Accepting the last deliverable completes a schedule and frees its slot without deleting it, and an empty schedule can be deleted; both are free on every tier.",
      "`delivery_schedule_document` and `milestone_payload` are Pro. The refusal is an answer, not a protocol error, and nothing is written.",
      "`MAX_DELIVERABLES` = 200 deliverables on one schedule; `MAX_MINOR` = 1e12 per money field; `MAX_VAT` = 1000 percent.",
      "`MAX_ROWS` = 500 rows per section of one `late_report` answer and 500 schedules in one `delivery_schedule_list` answer. A cut list reports `truncated` true, the number of rows left out, and the fact that the counts above it are still complete.",
    ],
    extra: [
      "LATE IS NOT A STATUS, IT IS A READING. The four stored statuses are planned, in progress, delivered and accepted; late, due today, not yet due, delivered on time and delivered late are derived from the due date and the `as_of` the CALLER passes. A stored late flag is a fact about the afternoon somebody last ran the report and goes on being reported after the work lands. The same deliverable reads late at one `as_of` and delivered late at another, from one unchanged store, and the unit suite asserts all three readings.",
      "A DELIVERABLE IS LATE ONLY ONCE `as_of` IS PAST ITS DUE DATE. One due on `as_of` is `due_today`, which is the same rule the statement server ages an invoice by, so a deliverable and an invoice due on one day never disagree about whether that day has run out. Every comparison is between two YYYY-MM-DD strings and every day count is the difference of two UTC midnights, so the answer does not move with the machine's timezone; a suite replays every call under four zones fourteen hours apart and asserts the responses are byte-identical.",
      "THE STATUS AS AT A DATE IS THE LAST DATED MOVE AT OR BEFORE IT. A delivery dated after `as_of` has not happened yet, so `delivered_date` is null and the deliverable is still owed. Nothing is stored for it: `statusAsOf` reads the history, and the current status is the same function read at a date later than any schedule can carry.",
      "NOTHING MAY PREDATE THE REFERENCE DOCUMENT. The date on the quote, work order or change order is stated once on the schedule, and a due date or a status move dated before it is refused: nothing can be owed, or delivered, before the document that ordered it exists. A move dated before the previous move on the same deliverable is refused too, so the history reads as a timeline; the same day is allowed.",
      "ACCEPTING SOMETHING THAT WAS NEVER DELIVERED IS REFUSED BY NAME. Acceptance is the client's answer to a handover, and a deliverable accepted on a day nothing was handed over has no delivered date to bill from. Accepted is final and nothing moves back: work the client sent back is a new deliverable with its own due date, so the record keeps both the miss and the fix.",
      "A DELIVERABLE WITH NO VALUE IS NOT WORTH ZERO. It is one whose price was never stated here, usually because the job is a lump sum. It is counted apart wherever a total is printed, and `milestone_payload` lists it under `excluded.accepted_but_unpriced` rather than billing it as zero. When every accepted deliverable is unpriced the payload refuses rather than emitting an invoice for nothing.",
      "THE TWO SIBLING SERVERS TAKE THE SAME MILESTONE IN DIFFERENT SCALES, AND THE GAP IS EXACTLY 100x. `invoice_create`'s item carries `unit_price` in MAJOR units; `quote_create`'s item carries `unit_price_minor` in MINOR units. So the store holds MINOR units and `milestone_payload` builds BOTH payloads itself in one call with the scale printed against each. The unit suite re-derives the net from each payload's own items and asserts the quotient is 100. No description carries a bare minor-unit figure, because one lands beside a MAJOR unit price on the customer's own document.",
      "THE MONEY IS THE INVOICE SERVER'S OWN. `computeTotals`, `currencyDecimals`, `formatMoney` and `daysBetween` are imported from `@theluckystrike/mcp-invoice/lib` and no arithmetic is restated here, so the payload's totals ARE what `invoice_create` will compute rather than a second implementation that agrees today.",
      "ONE REFERENCE CARRIES ONE SCHEDULE. A second against the same quote or work order is refused by name, because two schedules give two answers to what is late on it and the caller sees whichever they happened to open. The refusal is checked BEFORE the free cap, so it names an id rather than selling an upgrade.",
      "A DELIVERABLE ID IS NEVER REISSUED. The D series is allocated from a per-schedule counter that only goes up, not from the deliverable count, so deleting D04 does not hand D04 to a different piece of work. A gap in the series is the record that one was removed.",
      "VALUE IS NEVER SUMMED ACROSS CURRENCIES. This server holds no exchange rate, so `value_at_risk` is a row per currency and a single figure over two of them is never printed.",
      "NO SIBLING STORE IS OPENED. The reference is a name and its date is stated here; the quotes, work-order and change-order `dataDir()` functions create a directory on read, and a schedule that refused to exist until its reference could be found on this machine would refuse every job quoted on another one. `milestone_payload` returns arguments and says `posted: false`; it creates no invoice and no quote.",
    ],
  },
  "packing-list": {
    summary: "Packing slips for a shipment, kept the way a warehouse keeps one: an order reference and a consignee, the lines that order says should ship declared on the list itself, cartons carrying a tare weight in whole grams and their outside dimensions in whole centimetres, and goods packed into a named carton one line at a time with a per-unit weight. The shortfall reports every line as short, complete, over-packed or packed and not on the order at all. The tare, net, gross, volume, volumetric and chargeable weights are derived per carton and for the shipment. No weight and no shortfall is stored, and the document carries no prices at all.",
    storageFiles: [
      ["packing-lists.json", "the packing lists, each carrying its order reference, its consignee, its cartons, its declared order lines and its packed lines, and nothing derived from them"],
      ["counter.json", "the PL number series, per year of the packing list date"],
    ],
    primaryFile: "packing-lists.json",
    caps: [
      "`FREE_OPEN_LISTS` = 3 OPEN packing lists on free, where open means draft or packed. Marking a list shipped or cancelling it frees its slot without deleting it, and deleting a draft is free on every tier.",
      "`packing_slip` writing a FILE with `out_path` is Pro. The slip TEXT comes back on every tier, because the slip is the reason to install this at all. The refusal is an answer, not a protocol error, and nothing is written to disk before it.",
      "`MAX_CARTONS` = 500 cartons and `MAX_LINES` = 2000 packed lines and 2000 declared lines on one list; `MAX_QUANTITY` = 1e6 units per line; `MAX_GRAMS` = 1e8 (100 tonnes) per mass field; `MAX_CM` = 2000 per dimension.",
      "`MAX_ROWS` = 500 packing lists in one `packing_list_list` answer. A cut list reports `truncated` with the total and how to narrow it.",
    ],
    extra: [
      "A PACKING SLIP CARRIES NO PRICES, AND THAT IS ENFORCED RATHER THAN ASSUMED. The document travels inside the box and the consignee's warehouse is not the party that sees what the goods cost. So `@theluckystrike/mcp-invoice` is not a dependency, no money function name appears in non-comment source, no currency is stored on a record, and the unit suite asserts no currency symbol reaches the rendered slip. The invoice against the same order is a different document in a different server.",
      "MASS IS IN WHOLE GRAMS AND DIMENSIONS IN WHOLE CENTIMETRES, for the reason money is in minor units: a kilogram carried as a float accumulates error over a hundred lines and then disagrees with the carrier's scale. Every mass the server emits is an integer, the contract suite asserts it, and the kilogram figures beside them are formatting at the edge only.",
      "THE CHARGEABLE WEIGHT IS THE NUMBER THAT COSTS MONEY, AND ITS DIVISOR IS A TARIFF TERM, NOT A CONSTANT. Volumetric grams are `ceil(length x width x height / divisor x 1000)`, rounded UP because carriers round the chargeable figure up and never down, and the chargeable weight is `max(gross, volumetric)`. The divisor is a parameter on every tool that reports one: 5000 cm3/kg courier air (default), 6000 the older IATA air figure, 4000 some road tariffs. On the worked shipment the shipment chargeable weight is 20.000 kg at 5000 and 20.400 kg at 4000, and only the second carton changes basis; a server that hardcoded 5000 would under-state that shipment by 400 g and nobody would find it until the carrier's account was reconciled.",
      "A CARTON WITH TWO OF THREE DIMENSIONS IS REFUSED, AND ONE WITH NONE MAKES THE SHIPMENT CHARGEABLE TOTAL NULL. Two of three cannot make a volume, and a partially measured box would drop silently out of the shipment total. A total that quietly skipped three unmeasured boxes reads like a complete figure and is not one, so it comes back as null with the count of cartons that caused it.",
      "AN UNWEIGHED LINE MAKES EVERY NET AND GROSS FIGURE A LOWER BOUND, SAID OUT LOUD. `unit_grams` is optional because things genuinely ship unweighed. When any line in a carton carries none, `net_complete` goes false and the caveat is printed in the slip BODY as well as returned as a field, because a caveat that lives only in the JSON does not travel with the text somebody pastes into an email. A `unit_grams` of ZERO is a real weight and is not treated as unweighed.",
      "A PACKED LINE WITH NO ORDERED LINE IS REPORTED, NEVER DROPPED. The shortfall has four states and `not_on_order` is one of them. Dropping it is how a wrong item ships: the report reads clean, the box is heavier than the order, and nobody looks again until the consignee calls. Lines are matched on SKU where there is one and on the normalised description where there is not, so eight shelves in one carton and four in another are ONE row of twelve, with both carton ids on it.",
      "A SHIPPED LIST IS FROZEN ON EVERY EDITING TOOL AND READABLE ON EVERY READING ONE. The goods have gone; a packing slip that changed after the van did is a document nobody can reconcile against what arrived. It cannot be reopened, edited or deleted, and the slip stays reproducible afterwards. Shipping while anything is short, over-packed or unordered is refused unless `force` is passed, and either way the exceptions come back and are recorded as `shipped_with_exceptions`.",
      "NO SIBLING STORE IS OPENED. The order is a name, and what it says should ship is DECLARED here with `packing_expect`. The quotes, work-order and invoice `dataDir()` functions create a directory on read, and a packing list that refused to exist until its order could be found on this machine would refuse every order raised on another one.",
      "THIS SERVER IS STDIO AND .MCPB ONLY. It has no hosted endpoint, so there is no `remotes.json` and no manifest carries a `remotes` block. The registry binds one endpoint URL to exactly one server name, so advertising a URL that does not answer would burn the name; the contract suite asserts the absence rather than trusting it.",
    ],
  },
  "checklist": {
    summary: "Checklists you build once and run many times, and the dated record of each run that somebody signs. A checklist is a named list of steps, optionally grouped into sections, each required or optional. A run is one pass of that checklist against a job: every step marked pass, fail or not applicable, with who marked it, on what day, and a note. A run COPIES its checklist's steps when it starts and records the version it copied. Sign-off puts a name and a date on it and freezes it. No count is stored: progress, the failures, and whether a run can be signed off are derived on every call.",
    storageFiles: [
      ["templates.json", "the checklists, each carrying its name, category, version and its steps in order, and nothing derived from them"],
      ["runs.json", "the runs, each carrying its own COPY of the steps it started with, the checklist version it copied, every answer with who and when, and its dated status history"],
      ["counter.json", "the CL and RUN number series, the RUN series per year of the run date"],
    ],
    primaryFile: "runs.json",
    caps: [
      "`FREE_TEMPLATES` = 3 checklists on free. RUNS ARE NEVER CAPPED on any tier, because capping the running of a checklist would cap the only thing a checklist is for. Deleting a checklist frees its slot.",
      "`run_report` writing a FILE with `out_path` is Pro. The report TEXT comes back on every tier. The refusal is an answer, not a protocol error, and nothing is written to disk before it.",
      "`MAX_ITEMS` = 500 steps on one checklist; `MAX_TEMPLATES` = 500 checklists; `MAX_SECTION` = 60 characters for a section heading or a category, refused at the schema rather than trimmed.",
      "`MAX_ROWS` = 500 rows in one `run_list` or `checklist_list` answer. A cut list reports `truncated` with the total and how to narrow it.",
    ],
    extra: [
      "A RUN SNAPSHOTS ITS CHECKLIST, AND THAT IS THE WHOLE SERVER. The steps are copied into the run when it starts, text and all, with the checklist's version number recorded beside them. Editing the checklist afterwards never changes a run already under way, and deleting the checklist leaves every run readable and complete. Without it, editing a checklist rewrites history: a handover certificate signed for ten checks silently becomes a certificate for eleven, and no field anywhere in the record shows that it happened, so no reader could ever detect it. The contract suite asserts it on the raw `runs.json` bytes and not only through the API.",
      "NOT APPLICABLE IS NOT A PASS. `na` counts as ANSWERED and never as passed. A step that was looked at and dismissed is a different fact from a step that passed, and merging the two is how a checklist reports full marks for a job where half the steps did not apply. The arithmetic that catches it: `pass + fail + na + pending` equals the item count AND `answered + pending` equals the item count, which only both hold if na sits on the answered side.",
      "COMPLETE IS A READING, NEVER A CLAIM. A run becomes complete when its last step is answered and goes back to open when a step is set back to pending, and each change is written to the run's history. It is recomputed inside `run_check` rather than set by any tool, so no caller can assert a completeness the steps do not support.",
      "SETTING A STEP BACK TO PENDING CLEARS WHO ANSWERED IT AND WHEN. A name against an unanswered step is a false record, and it is the kind that survives into a signed document.",
      "A REQUIRED STEP IS THE ONLY REASON `required` EXISTS. A required step unanswered or failed blocks the signature; an optional one failing does not, though an optional one unanswered does. `force: true` signs anyway and the exceptions stay on the record and print on the report under a heading that names them, so a signature taken over an exception is visible rather than lost.",
      "SIGN-OFF REFUSES ON THE REASONS, NOT ON THE STATUS MACHINE. A CLOSED run is refused on the machine, because a signature is the point at which a run stops moving. An OPEN one is refused on which steps are outstanding, because `an open run cannot go straight to signed_off` is true and useless. The two can never disagree: the sign-off test is only ready when nothing is pending, and a run with nothing pending is already complete.",
      "A SIGNED-OFF RUN IS IMMUTABLE ON EVERY EDITING TOOL AND READABLE ON EVERY READING ONE, and it cannot be deleted, because it is the record of what somebody put their name to. An ABANDONED run is closed but is not a signature: it prints the blank signature block and it CAN be deleted.",
      "NO SIBLING STORE IS OPENED. The job a run is against is a name and nothing more, so a run raised against a work order created on another machine still exists here.",
      "THERE IS NO MONEY ANYWHERE. A checklist has no amounts: `@theluckystrike/mcp-invoice` is not a dependency, no money function name appears in non-comment source, and no currency symbol appears in src. The contract suite asserts all three.",
      "THIS SERVER IS STDIO AND .MCPB ONLY, and it ships THREE registry names on one bundle: `checklist`, `snag-list-defect-handover-signoff` and `onboarding-checklist-inspection-runs`. Registry search matches a substring of the full name and never the description, so more names is the only way to be findable on more tokens; the measured landing ranks are 7, 2, 3 and 7 on checklist, snag, handover and onboarding (docs/TOKEN_DEMAND_R1.md). A contract test asserts the tokens are actually present in the names, because a name that lost its token in an edit is a server that silently stops being findable.",
    ],
  },
  "change-order": {
    summary: "Change orders against a quote or a work order, kept the way a variation is kept on site: added, removed and changed lines, each with a quantity, a unit price in minor units, a reason and a date; a status that moves draft to sent to approved or rejected, each step dated; the running contract value as the original plus APPROVED deltas with pending deltas held apart; a plain-text document for the client to approve; and the approved delta as invoice_create-ready items in MAJOR units and quote_create-ready items in MINOR units at once. No delta is stored and no original value is invented.",
    storageFiles: [
      ["change-orders.json", "the change orders, each carrying its reference, its original value, its lines and its status history and nothing derived from them"],
      ["counter.json", "the CO number series, per year of the change order date"],
    ],
    primaryFile: "change-orders.json",
    caps: [
      "`FREE_OPEN_ORDERS` = 5 OPEN change orders on free, counting draft and sent. Approving, rejecting or voiding one frees its slot, and so does deleting a draft with no lines; all of those are free on every tier.",
      "`change_order_document` and `change_order_invoice_payload` are Pro. The refusal is an answer, not a protocol error, and nothing is written.",
      "`MAX_LINES` = 200 lines on one change order; `MAX_MINOR` = 1e12 per money field; `MAX_QUANTITY` = 1,000,000; `MAX_VAT` = 1000 percent.",
      "`MAX_ROWS` = 500 rows returned by one `change_order_list` answer.",
    ],
    extra: [
      "THE TWO SIBLING SERVERS TAKE THE SAME DELTA IN DIFFERENT SCALES, AND THE GAP IS EXACTLY 100x. `invoice_create`'s item carries `unit_price` in MAJOR units; `quote_create`'s item carries `unit_price_minor` in MINOR units. Neither tool can tell that the number it was handed was scaled for the other one. So the store holds MINOR units, which is the only lossless form, and `change_order_invoice_payload` builds BOTH payloads itself in one call with the scale printed against each. The unit suite re-derives the net from each payload's own items and asserts the quotient is 100.",
      "THE MONEY IS THE INVOICE SERVER'S OWN. `computeTotals`, `currencyDecimals`, `formatMoney` and `roundHalfUp` are imported from `@theluckystrike/mcp-invoice/lib` and no arithmetic is restated here, so the payload's totals ARE what `invoice_create` will compute rather than a second implementation that agrees today.",
      "A CHANGED LINE IS TWO ITEMS, A REVERSAL AND THE REVISED LINE, NEVER ONE NET ITEM. 3 x 450.00 becoming 5 x 420.00 is worth +750.00, but an item of quantity 1 at 750.00 shows the customer nothing they can check; -3 x 450.00 and 5 x 420.00 both reproduce on a calculator and sum to the same +750.00, because `roundHalfUp` is symmetric in sign. A removal is a negative quantity at the unit price it was booked at, which `invoice_create` accepts.",
      "THE QUOTE PAYLOAD IS READY ONLY WHEN EVERY QUANTITY IS POSITIVE. `quote_create` refuses a quantity that is not greater than zero, so a delta with a removal or a reversal cannot be quoted as it stands. The items are still emitted in MINOR units so the scale identity holds, and `quote_create.ready` is false with the rule named.",
      "NO DELTA AND NO RUNNING VALUE IS STORED. A record holds its reference, its original value, its lines and its status history; the delta, the running value and the VAT are derived on every call. The contract suite greps the raw store for the derived key names and asserts a record holds its facts only.",
      "THE RUNNING CONTRACT VALUE IS THE ORIGINAL PLUS APPROVED DELTAS. Draft and sent deltas are pending and shown as a separate figure, with the value if every pending one were approved beside it, so the two are never added by hand. Rejected and void change orders count for nothing and are listed so they can be seen to count for nothing.",
      "THE ORIGINAL VALUE IS STATED ONCE PER REFERENCE AND INHERITED. This server opens neither the quotes store nor the work-order store (their `dataDir()` creates a directory on read), so the first change order against a reference must carry `original_value_minor`, every later one inherits it, and a later one that states a different figure is refused by name with the figure on file. One reference carries one currency; a second is refused rather than converted.",
      "The status machine: draft to sent; sent to approved or rejected; draft or sent to void. Approved, rejected and void are final. A draft cannot be approved directly, because approval is the client's answer to something they were sent, and the refusal names the step that is next. A step dated before the change order's date or before the last step is refused so the history reads as a timeline; the same day as the last step is allowed.",
      "LINES ARE ADDED ONLY WHILE A CHANGE ORDER IS A DRAFT. Once sent, the client is looking at a document, and a line added under them makes their approval an approval of something else. A sent change order that needs another line is voided and raised again. A draft with no lines cannot be sent.",
      "ONLY AN APPROVED CHANGE ORDER HAS AN INVOICE PAYLOAD. A draft or sent one is not agreed; a rejected or void one bills nothing. The refusal names the status and the date it was reached. This server creates no invoice and no quote: the payload returns arguments and says `posted: false`.",
      "A byte-identical change order (reference, title, client, currency) is refused BEFORE the free cap is consulted, so the refusal names the id already on file rather than selling an upgrade, and burns neither a slot nor a CO number. `duplicate_ok` is the way through.",
      "A change order is DELETED only while it is a draft with no lines. Once there is a line, or it has been sent, it has a history and is voided rather than erased. The CO series never reissues a number, so a gap in it is the record that one was deleted.",
      "Currencies are never added together. This server holds no exchange rate, so one delta over a EUR contract and a PLN one would be an invented number.",
    ],
  },
  "work-order": {
    summary: "Job orders for trades and field work, kept the way a job card is kept: the client and the site, the parts and the hours the job actually used, the status the job stands at with the date it reached it, the completion report the customer signs, and an invoice_create-ready payload whose unit prices are already the billed units. No total is stored; every figure is derived from the lines on the call.",
    storageFiles: [
      ["orders.json", "the work orders, each carrying its client record, its lines and its status history and nothing derived from them"],
      ["counter.json", "the WO number series, per year of the requested date"],
      ["pdf/", "completion reports written by completion_report_pdf when no out_path is given"],
    ],
    primaryFile: "orders.json",
    caps: [
      "`FREE_OPEN_ORDERS` = 5 OPEN work orders on free, counting draft, scheduled and in_progress. Closing one frees its slot, and so does deleting a draft with no lines; both are free on every tier.",
      "`completion_report_pdf`, `work_order_invoice_payload` and `work_orders_report` are Pro. The refusal is an answer, not a protocol error, and nothing is written.",
      "`MAX_LINES` = 200 lines on one work order; `MAX_MINOR` = 1e12 per money field; `MAX_HOURS` = 100,000; `MAX_QUANTITY` = 1,000,000; `MAX_MARKUP` = 1000 percent.",
      "`MAX_ROWS` = 500 rows returned by one `work_order_list` or `work_orders_report` answer.",
    ],
    extra: [
      "THE MARKUP GOES ON THE UNIT COST, NEVER ON THE LINE TOTAL. The invoice server rounds a unit price to the minor unit first and multiplies (D-R24, servers/invoice/src/money.ts), so the marked-up UNIT is the only basis an invoice can reproduce. Seven parts at 1299 with 15 percent on top is 1494 a unit and 10,458 on the line; marking up the line total is round(9093 x 1.15) = 10,457. One minor unit, on every line whose marked-up unit does not land on a whole cent, and it never nets out across lines.",
      "THE MONEY IS THE INVOICE SERVER'S OWN. `computeTotals`, `currencyDecimals`, `formatMoney` and `roundHalfUp` are imported from `@theluckystrike/mcp-invoice/lib` and no arithmetic is restated here, so the payload's totals ARE what `invoice_create` will compute rather than a second implementation that agrees today.",
      "NO TOTAL IS STORED. A work order record holds its client, its lines and its status history; the value, the hours, the materials and the VAT are derived on every call. A stored total is a second copy of what the lines already decide, and the copy is the one that gets believed after somebody edits a line.",
      "The status machine moves ONE STEP FORWARD at a time: draft to scheduled to in_progress to done to invoiced. A skipped step is refused naming the step that is next, because every step carries its own timestamp and skipping one loses the day the job reached it; a backwards step is refused because a job that has to go back is a new work order.",
      "A status change is refused when it is dated before the requested date, or before the step already recorded, so the history always reads as a timeline.",
      "THIS SERVER CREATES NO INVOICE AND MARKS NOTHING. `work_order_invoice_payload` returns arguments; the caller runs `invoice_create` in the invoice server and then sets the status to invoiced here. An already-invoiced order refuses a second payload by name, so the customer cannot be billed twice through this route.",
      "An invoiced work order takes no more lines: adding one would change a job the customer has already been billed for. The extra work is a second work order.",
      "A work order is DELETED only while it is a draft with no lines. Once there is an hour or a part on it, or a status past draft, the job has a history and is corrected rather than erased. The WO series never reissues a number, so a gap in it is the record that one was deleted.",
      "A byte-identical work order (client, site, requested date, description, priority, currency) is refused BEFORE the free cap is consulted, so the refusal names the id already stored rather than selling an upgrade, and burns neither a slot nor a WO number.",
      "AN UNKNOWN CLIENT NAME WITH NO ADDRESS IS REFUSED. A bare name that matches no invoice client record is a misspelling far more often than a new customer, and the invoice raised from the job would carry an empty BILL TO block. Either `client_add` in the invoice server first, or pass `client_address` and the job records the client inline and says so.",
      "A LABOUR RATE IS NEVER IMPROVISED. The shared business profile carries a default currency, a default tax rate and payment terms but no default hourly rate (`PROFILE_FIELDS`, packages/mcp-license/src/profile.ts), so `rate_minor` is refused by name with the field that would have filled it rather than guessed.",
      "Hours in the board report are counted on the LINE date, not on the date the job was requested, so a February call worked in March counts in March.",
      "Currencies are never added together. This server holds no exchange rate, so one value over a EUR job and a PLN one would be an invented number.",
      "The A4 completion report is `renderDocPdf` from `@theluckystrike/mcp-billing-docs/lib`, the same page a credit note and a purchase order use, so a report and the invoice it becomes are recognisably one document family.",
    ],
  },
  "petty-cash": {
    summary: "A petty cash float on the imprest system, kept as the paperwork keeps it: the vouchers paid out of the tin, the count that reconciles them to the cash actually there, and the replenishment that puts the float back to its imprest, with the double entry and an expense_add-ready payload per category in the cash book's own account names. No balance is stored; every balance is derived from the imprest, the top-ups, the vouchers and what each count found.",
    storageFiles: [
      ["floats.json", "the floats, each carrying its imprest, its custodian, its top-ups and every count that was made on it"],
      ["vouchers.json", "the vouchers paid out, each carrying the count that reconciled it and the top-up that reimbursed it"],
      ["counter.json", "the FLOAT and VOU number series, per year"],
    ],
    primaryFile: "floats.json",
    caps: [
      "`FREE_FLOATS` = 1 float open on free. `FREE_VOUCHERS_PER_MONTH` = 20 vouchers a calendar month on free, counted by the voucher date.",
      "`reconcile` is free and unlimited on every tier, and so are `voucher_delete` and `topup_record`: the question this server exists to answer is whether the cash in the tin matches the paperwork, and a free tier that withholds the answer is a demo.",
      "`replenish_request` and `float_report` are Pro. The refusal is an answer, not a protocol error, and nothing is written.",
      "`MAX_MINOR` = 1e14 per amount field; `MAX_ROWS` = 2000 unreconciled vouchers listed per float by one `float_report` answer.",
    ],
    extra: [
      "THE REPLENISHMENT IS `imprest - balance`, NOT THE SUM OF THE VOUCHERS. The two differ by exactly what the counts found over or short. On the worked month the vouchers total 20,194 minor units and the cheque is 20,205, because the count found the tin 11 short; reimbursing the voucher total instead restores the float 11 light, every cycle, while every later reconciliation still balances against a book that was already wrong.",
      "A COUNT IS A FACT. Once a count is recorded the book balance IS what was counted, and the difference is carried as a `cash_over_short` line into the next replenishment rather than repeated at every later count. The count history keeps every difference, so a tin that is short by a little every month is visible as a run and not as one number.",
      "NO BALANCE IS STORED. The float record holds the imprest, the top-ups and the counts; every balance is derived on the call from those and the vouchers. A stored balance is a second copy of what the vouchers already decide, and the copy is the one that gets believed after somebody deletes a voucher.",
      "A float is CASH IN A TIN and can never hold less than nothing. A voucher larger than the balance on its own date is refused, and so is a back-dated one that would make any later day negative: back-dating takes the cash out earlier, so every day after it is short too.",
      "A byte-identical voucher is refused by name, with the id of the one already stored. Same float, date, amount, category, description, payee and receipt reference is one voucher entered twice far more often than it is two identical purchases, and the second one is admitted only when `duplicate_ok` says so out loud.",
      "A RECONCILED VOUCHER CANNOT BE DELETED. The cash it took out was counted on the day of the count, so removing it would make that recorded count wrong by its own amount. Deletion is free while a voucher is still uncounted, and the number is never reissued: a gap in the VOU series is the record that a voucher was deleted.",
      "`replenish_request` WRITES NOTHING. It says what the cheque should be; the cash is recorded with `topup_record` when it is physically back in the tin, and that is what marks the vouchers reimbursed.",
      "Under the imprest system `petty_cash` does not move. It is debited once when the float is opened and again only if the imprest itself is changed; a replenishment credits `cash` and debits the expenses.",
      "The account ids are the cash book's, IMPORTED from `@theluckystrike/mcp-cash-book/lib` rather than retyped: `cash` and the per-category `expenses:<category>` ids come from its own `expenseAccount`, so a category spelled three ways is one account. `petty_cash` and `cash_over_short` are new, because that server derives no float entries yet, and they follow its id convention exactly.",
      "The custodian comes from the SHARED BUSINESS PROFILE when the call does not name one, and the answer always says which of the two it was. A float with no custodian still opens: a tin nobody is named for is a real and reportable state, not a reason to refuse the record.",
      "Currencies are never added together. This server holds no exchange rate, so one balance over a EUR tin and a PLN one would be an invented number.",
      "A count dated before the float was opened, or before the count before it, is refused: an earlier count would be reconciling a book that a later count has already moved.",
    ],
  },
  "cash-book": {
    summary: "One double-entry ledger derived from books this server does not own: the invoice ledger, the credit note and purchase order store, the deposit store, the expense ledger, the bank import and the fixed asset register, all read-only. Every line is derived on the call and carries the server, the document id and the date it came from; the trial balance is proved to the minor unit; a month closes with a snapshot and a list of what is unposted or inconsistent.",
    storageFiles: [
      ["periods.json", "the register of periods a ledger was built for, which is what the free tier meters"],
      ["closes.json", "the months that were closed, each with the trial balance snapshot as it stood at the close"],
    ],
    primaryFile: "periods.json",
    caps: [
      "`FREE_PERIODS_PER_MONTH` = 3 DISTINCT periods a calendar month on free, counted per from, to and currency. Rebuilding a period already in the register is free forever, on every tier.",
      "`trial_balance` is free and unlimited on every tier, and so is `ledger_lines`: the question this server exists to answer is whether the books add up, and a free tier that hides the answer is a demo.",
      "`month_close`, `ledger_export_csv` and `ledger_report` are Pro. The refusal is an answer, not a protocol error, and nothing is written.",
      "`ledger_export_csv` gates shape, not content: `ledger_lines` already returns every field, `bank_ref` included, free and unlimited. The export only lays the same fields out as RFC 4180 columns in a file.",
      "`MAX_ROWS` = 5000 lines returned by one `ledger_lines` answer.",
    ],
    extra: [
      "This server WRITES NOTHING into any of the six stores it reads. It holds two files of its own, a register of built periods and a register of closed months, and no balance is ever read back out of them to compute another. Every debit and every credit is derived on the call: a ledger you can type into is a ledger that can disagree with the books it is made of.",
      "The BANK IMPORT POSTS NOTHING. A bank line and a payment record are one transaction seen twice, so cash is posted from the DOCUMENTS, which are the only rows that carry a second leg, and a bank row is matched to a posted cash movement of the same amount, the same direction and a date within 3 days as EVIDENCE, written on the line as `bank_ref`. On the worked month 1,375,300 of the 1,380,300 minor units of cash movement, 99.6 percent, appear in both books; a union of the two would double them and would still balance.",
      "A bank row that could match TWO postings is matched to NEITHER, and is reported. Picking the first would be a coin toss written into a ledger, and the two candidates are exactly the case a human has to look at.",
      "A sibling store that is missing or empty is reported and never fatal, and there is no fatal store here at all, not even the invoice ledger: a business with only bank imports and expenses still has a cash book. An unreadable store is never read as an empty one, because a missing figure is not a zero, and a ledger short one whole store still balances perfectly, since both legs of every missing entry are missing.",
      "An entry whose own legs do not add up is posted AS IT STANDS and reported, never balanced with a plug. The trial balance can only find a broken document if it is allowed to come out non-zero, and `offenders` names the entry, the source server and the source document behind every unit of the difference.",
      "`paid_minor` on the invoice is the authority and `payments[]` only the attribution, so the payment rows come from `paymentRows` in servers/statement-of-account rather than from a second copy of that rule here. A payment made by APPLYING a deposit debits deposits held and not cash, because the cash arrived when the deposit was received.",
      "servers/expense-tracker stores an expense amount VAT-INCLUSIVE, so the VAT is taken OUT of the gross (`round(gross * rate / (100 + rate))`) and is never added on top of it. Adding it on top would overstate both the expense and the VAT reclaim.",
      "servers/billing-docs stores every money field on a credit note NEGATIVE, which is the sign a ledger wants, so no row here flips one. A credit note found stored POSITIVE is posted as it stands and flagged, because a silent flip would hide the fact that something other than that server wrote it.",
      "An open PURCHASE ORDER is a memo and is never posted. An order is a commitment, not a transaction: nothing has been delivered and nothing is owed, and a ledger that posts it reports a liability the business does not have.",
      "Currencies are never added together. One ledger is one currency, a period holding two is REFUSED by name until one is chosen, and the documents in the other are counted as excluded rather than silently dropped. This server holds no exchange rate, so a single trial balance over two currencies would be an invented number that balances.",
      "Depreciation is charged by whole months from the fixed asset register, using that server's own `buildSchedule` and `chargeForMonth`, so the ledger cannot drift from the register's own schedule. A disposal inside the period is REPORTED and not posted: the removal of cost and accumulated depreciation lands in the bank and expense books in ways only a human can attribute.",
      "A close records what the trial balance said at the MOMENT of closing. It does not freeze the sibling stores, which this server does not own; closing again after one of them moved reports the drift by name instead of quietly adopting the new figure.",
      "This ledger opens at nothing. It derives only what the period itself contains, so an account balance here is the period's MOVEMENT and no opening figure is ever carried in from a book this server does not keep.",
    ],
  },
  "statement-of-account": {
    summary: "Per-client statements of account assembled from books this server does not own: the invoice ledger, the credit note store and the deposit store, all read-only. Builds a statement for a period with the opening balance, the invoices issued, the payments received, the credit notes and the closing balance; ages the open invoices into 0-30, 31-60, 61-90 and over 90 days past due; writes the plain-text statement, the A4 PDF and a dunning letter at three levels; and reports what every client owes, per currency.",
    storageFiles: [
      ["statements.json", "the register of statements that were built, with the figures each one carried"],
      ["counter.json", "the STMT number series, per year"],
    ],
    primaryFile: "statements.json",
    caps: [
      "`FREE_STATEMENTS_PER_MONTH` = 5 DISTINCT statements a calendar month on free, counted per client, period and currency. Rebuilding one already in the register is free forever, on every tier.",
      "`statement_aging` is free and unlimited on every tier, and `dunning_text` is free at levels 1 and 2.",
      "`statement_pdf`, `dunning_text` level 3 and `statements_report` are Pro. The refusal is an answer, not a protocol error, and no file is written.",
      "`MAX_ROWS` = 2000 invoice rows returned by one `statement_aging` answer; `statements_report` lists 20 clients by default and 200 at most.",
    ],
    extra: [
      "This server WRITES NOTHING into the invoice, credit note or deposit stores. It holds one file of its own, a register of the statements that were built, and no balance is ever read back out of it. A statement is a view over books other servers own; a second copy of a balance is a second number to be wrong.",
      "A sibling store that is missing, empty or QUARANTINED is reported and never fatal, with one exception: the INVOICE store. With no invoice ledger there is no statement, so a corrupt invoices.json refuses every tool by name rather than answering that nothing is owed. A corrupt credit note store still answers, and says in words that the closing balance is too high by whatever was credited.",
      "An unreadable store is never read as an empty one. That distinction is the whole point of the `sources` block every answer carries: `read: false` with an error is a figure that could not be computed, `read: true` with `rows: 0` is a figure that is genuinely zero.",
      "`paid_minor` on the invoice is the AUTHORITY and `payments[]` is only the attribution, because the two do not have to agree: `invoice_mark_paid` writes both, `deposit_apply` in servers/deposits raises `paid_minor` and appends NOTHING to `payments[]`, and an invoice created before that field existed has no rows at all. The payment rows are assembled as every `payments[]` row, plus every deposit application naming the invoice, plus one residual row at `paid_date` for the rest, so they sum to `paid_minor` exactly.",
      "When the attribution sums to MORE than `paid_minor` the invoice book and the deposit book disagree about real money. Nothing is scaled and nothing is dropped silently: the attribution is discarded, one row for `paid_minor` is shown, and the disagreement is returned as a note naming the invoice and the difference.",
      "A deposit applied to an invoice is money that moves ONCE. It is inside `payments_received`, because `deposit_apply` already put it on the invoice; `of_which_deposits_applied` breaks it out and never adds it again. Deposit money still HELD is a memo line and is never in the balance: it is the client's money until it is applied.",
      "A credit note's `total_minor` is stored NEGATIVE by servers/billing-docs, which is the sign a statement wants, so no row in this server flips it.",
      "Aging is AS AT the date asked for, in every direction: an invoice issued after it is not on the books, a payment made after it has not happened, and a credit note issued after it has not been given. Aging that mixes a historic due date with a present-day `paid_minor` produces a bucket nobody can reproduce next month.",
      "An invoice is overdue only once the date is PAST its due date, so due today sits in `not_yet_due` and the 0-30 bucket holds days one to thirty. `not_yet_due` is reported beside the four buckets, never inside them and never hidden.",
      "A credit note reduces the invoice it names and no other. An open balance floors at zero and any excess is reported as `unapplied_credit`, rather than quietly cancelling an invoice the client never agreed it against. The statement, which is a balance rather than an aging, does carry the whole credit, so a client who is owed money sees a negative closing balance.",
      "Currencies are never added together. One statement is one currency and a client billed in two is asked which; `statement_aging` and `statements_report` total per currency. This server holds no exchange rate, so a single figure over a EUR ledger and a USD one would be invented.",
      "A dunning letter escalates in TONE and never in figures: the amounts, the invoice list and the bank details are identical at all three levels, because a chase whose numbers escalate was wrong at level one. No level states a late fee, interest or a legal cost: this server holds no contract terms, no statutory rate and no jurisdiction, so any such number would be made up and would be made up inside a demand for money.",
      "Bank details are printed only when the shared business profile actually carries them, and when it does not the answer says the letter asks for payment without saying where to send it.",
      "A chaser for a client with nothing overdue is REFUSED, and the refusal names what is outstanding but not yet due. A reminder about an invoice that is not late is the fastest way to lose a client.",
    ],
  },
  "asset-register": {
    summary: "A fixed asset register and its depreciation, on bundled public tax tables: the Polish annual rates from the annex to the CIT and PIT acts keyed to the KST classification, the UK capital allowance pools with the annual investment allowance, and the US MACRS GDS half-year tables for 3, 5 and 7 year property. Adds an asset, builds the schedule to zero or residual, journals a month, records a disposal with its gain or loss, and reports net book value per category and currency.",
    storageFiles: [
      ["assets.json", "the register, each asset carrying the rate, life and convention it was added with"],
      ["counter.json", "the ASSET number series, per year"],
    ],
    primaryFile: "assets.json",
    caps: [
      "`FREE_ASSETS` = 10 assets in the register on free. `asset_schedule`, `asset_list` and `asset_dispose` are free and unlimited on every tier.",
      "`asset_journal` and `asset_report` are Pro. The refusal is an answer, not a protocol error, and nothing is written.",
      "`MAX_PERIODS` = 120 periods in one schedule; `UK_POOL_PERIODS` = 25 for a UK reducing-balance pool, whose last period writes off the balance a reducing rate can never close.",
      "`MAX_MINOR` = 1e14 per amount field. Cost, residual and proceeds are whole minor units; a decimal is refused.",
      "`MAX_ROWS` = 2000 rows returned by one `asset_list` answer.",
    ],
    extra: [
      "The rate tables are BUNDLED JSON under `src/tables/`, read from disk on first use. There is no network call anywhere in this server: a depreciation rate that changed under the user between two runs of the same register is worse than one that is visibly stale, because the stale one is checkable against the file the build shipped.",
      "Every table carries a `header` naming the authority, the instrument, the source URL, the date the rates took effect, the date they were read and the convention, and the `assets://categories` resource returns those headers with the rates, so the provenance travels with the number.",
      "A value that could not be stated with confidence from the public text is OMITTED, and the header's `coverage` field says what was left out and why. The 18 and 25 percent positions of the Polish annex are not bundled; the UK table carries the two pools and the AIA only; the US table carries the half-year convention only, for the 3, 5 and 7 year classes.",
      "A category is matched by exact code, then exact name, then a PREFIX of four characters or more. Never a substring: `\"land\".includes(\"and\")` is true, and a substring fallback would price a delivery van at the land row's 0 percent and say nothing about it.",
      "The schedule sums to the depreciable base to the MINOR UNIT by construction. `allocate` rounds the cumulative total at each step and takes each period as the difference between two rounded cumulatives, with the last period set to the remainder, and the same rule splits a period into months, so the months sum to their year and the years sum to the base.",
      "The convention is the table's, not the caller's. Poland charges from the month AFTER the asset enters the register (art. 16h ust. 1 pkt 1), the published US GDS percentages already carry the half-year convention, and a UK writing down allowance is a full-period allowance on a pool and is not prorated by month.",
      "The Polish declining-balance method switches to straight line in the first year the declining amount would fall below the straight-line one (art. 16k), and rows the annex excludes from the method -- passenger cars, buildings, civil engineering works -- refuse it by name rather than computing it anyway.",
      "MACRS ignores salvage value. A residual passed for a US asset is reported back as NOT applied and kept on the record for book purposes, rather than silently reducing the base below what the published percentages recover.",
      "Depreciation is charged up to and including the month of disposal, then stops. A disposal dated before the in-service date is refused: an asset cannot leave the business before it joined it, and booking it would produce a result against a book value that never existed.",
      "Currencies are never added together. `asset_list`, `asset_journal` and `asset_report` total per currency, because this server holds no exchange rate and one number over a PLN register and a USD one would be an invented one.",
      "`asset_journal` writes NOTHING into the expense ledger. servers/expense-tracker publishes no library entry point and its id counter, category rules, VAT split and currency defaults all live inside its own `expense_add` handler; the journal returns the exact `expense_add` arguments instead, one payload per currency, the same contract servers/per-diem and servers/kanban use.",
      "The shared business profile has no country field, so the scheme is derived from `default_currency` and the derivation is always reported as a derivation, never presented as a stored fact.",
    ],
  },
  "per-diem": {
    summary: "Daily travel allowances on bundled public rate tables: the Polish delegation regulation (domestic and per country), the HMRC benchmark scale rates, and the GSA CONUS standard M&IE and lodging. Prices one trip from a start and end instant, saves it, totals it per scheme and month, and hands back expense_add arguments for the expense tracker.",
    storageFiles: [
      ["trips.json", "saved trips, each carrying the whole calculation it was priced with"],
      ["counter.json", "the TRIP number series, per year"],
    ],
    primaryFile: "trips.json",
    caps: [
      "`FREE_TRIPS_PER_MONTH` = 5 trips saved per calendar month on free, counted by the trip's start date. `perdiem_rates` and `perdiem_calc` are free and unlimited on every tier.",
      "`trip_export` and `perdiem_report` are Pro. The refusal is an answer, not a protocol error, and nothing is written.",
      "`MAX_TRIP_DAYS` = 366. A longer trip is refused: past a year a posting is a relocation and none of these schemes price it as travel subsistence.",
      "`MAX_ROWS` = 2000 rows returned by one `trip_list` or `perdiem_rates` answer.",
    ],
    extra: [
      "The rate tables are BUNDLED JSON under `src/tables/`, read from disk on first use. There is no network call anywhere in this server: a per diem figure that changed under the user between two runs of the same trip is worse than one that is visibly stale.",
      "Every table carries a `header` naming the authority, the instrument, the source URL, the date the rates took effect and the date they were read, and `perdiem_rates` returns that header with the rates, so the provenance travels with the number.",
      "A value that could not be stated with confidence from public regulation text is OMITTED, and the header's `coverage` field says what was left out and why. The HMRC overseas per-city scale rates are not bundled at all for this reason; the Polish annex ships 34 of its roughly 120 countries; the US table ships the CONUS standard rate only.",
      "A destination is matched by exact country name, then ISO code, then exact locality, then a PREFIX. Never a substring: `\"romania\".includes(\"oman\")` is true, so a substring fallback prices a trip to a country this build deliberately does not bundle at another country's rate and says nothing.",
      "Start and end are INSTANTS, not wall clocks: either ISO 8601 carrying its own offset, or a local datetime plus an IANA `timezone` resolved through `@theluckystrike/mcp-timezone/lib`. Elapsed hours are an epoch difference, so a trip across a clock change is 23 or 25 hours, not 24.",
      "The day model differs by scheme and is stated in every answer: `pl` and `uk` count 24-hour periods from departure (the Polish `doba`, and the shape HMRC's hour bands assume), `us` counts calendar days in the destination zone (FTR 301-11.101).",
      "Meal deductions are the scheme's own: Poland domestic 25/50/25 percent of the day, Poland foreign 15/30/30, US the published breakfast/lunch/dinner amounts of the M&IE tier, UK a pro rata share of the band. A day is floored at zero, never negative.",
      "Currencies are never added together. `trip_list` and `perdiem_report` total per currency, because this server holds no exchange rate and one number over two currencies would be an invented one.",
      "`trip_export` writes NOTHING into the expense ledger. servers/expense-tracker publishes no library entry point and its id counter, category rules, VAT split and currency defaults all live inside its own `expense_add` handler; the export returns the exact `expense_add` arguments instead, one payload per currency, the same contract servers/kanban uses for time-tracker's `timer_start`.",
      "The shared business profile has no country field, so the home scheme is derived from `default_currency` and the derivation is always reported as a derivation, never presented as a stored fact.",
    ],
  },
  "deposits": {
    summary: "Security and retainer deposits per client: record what was received, apply part or all of it to an invoice in the invoice server's store as a payment on that invoice, refund the rest, and answer what is still held per client and per currency.",
    storageFiles: [
      ["deposits.json", "deposits, with the applications and refunds on each"],
      ["counter.json", "the DEP number series, per year"],
    ],
    primaryFile: "deposits.json",
    caps: [
      "`FREE_DEPOSITS_PER_MONTH` = 5 deposits recorded per calendar month on free, counted by received date. Applying, refunding, listing, balances and the text statement are free and unlimited on every tier.",
      "`deposit_statement_pdf` and `deposits_report` are Pro. The refusal is an answer, not a protocol error, and no file is written.",
      "`MAX_MINOR` = 1e12 per amount field. Amounts are whole minor units; a decimal is refused at the schema.",
      "`MAX_ROWS` = 2000 deposit rows returned by one `deposit_list` answer.",
    ],
    extra: [
      "A deposit pays out at most what it still holds: received less everything already applied to an invoice and everything already refunded. The check and the write are one critical section under both locks.",
      "`deposit_apply` never applies more than the invoice's own open balance (`total_minor - paid_minor`), so an invoice cannot be shown overpaid and the difference owed back twice.",
      "The payment is written onto the invoice record exactly as the invoice server's `invoice_mark_paid` writes one -- `paid_minor`, `paid_date`, `status` -- because the engine exports no `recordPayment`. The one deliberate difference: `invoice_mark_paid` SETS `paid_minor` from the amount it is given, `deposit_apply` ADDS to it, so a deposit applied after a part payment does not erase that payment.",
      "A deposit is applied at its own currency and never converted: a deposit and an invoice in different currencies is refused by name.",
      "The stored `status` is derived from the movements every time one is written, never taken from the caller: `held` while anything is still held, otherwise `applied` if any of it went to an invoice and `refunded` if it all went back.",
      "One statement is in one currency. A client holding two currencies is asked which, rather than having the two added up.",
      "Money and currency decimals come from `@theluckystrike/mcp-invoice/lib` and the A4 page from `@theluckystrike/mcp-billing-docs/lib` (`renderDocPdf`). This server holds no copy of either.",
      "Locks are always taken deposits first, then invoice, the same order servers/billing-docs, servers/quotes and servers/recurring use, so no two processes in this repo can deadlock.",
    ],
  },
  "billing-docs": {
    summary: "Credit notes against the invoices in the invoice server's store and purchase orders to suppliers: negative line totals in minor units, the invoice's own VAT rates reused, an A4 PDF and a pasteable text version.",
    storageFiles: [
      ["credit-notes.json", "credit notes, with the invoice number each was issued against"],
      ["purchase-orders.json", "purchase orders and their receipts"],
      ["counter.json", "the CN and PO number series, per prefix and year"],
    ],
    primaryFile: "credit-notes.json",
    caps: [
      "`FREE_DOCS_PER_MONTH` = 5 documents per calendar month on free, credit notes and purchase orders together, counted by issue date.",
      "`credit_note_pdf`, `purchase_order_pdf` and `billing_docs_report` are Pro. The refusal is an answer, not a protocol error, and no file is written.",
      "`MAX_ITEMS` = 200 line items per purchase order.",
      "`MAX_MINOR` = 1e12 per amount field.",
    ],
    extra: [
      "Money and VAT come from `@theluckystrike/mcp-invoice/lib` (`computeTotals`, `currencyDecimals`, `formatMoney`). This server holds no copy of that arithmetic.",
      "A credit note never exceeds the invoice's remaining creditable amount: the invoice total less everything already credited against it. The check and the write are one critical section under both locks.",
      "Crediting a whole invoice, or a whole invoice line, COPIES the stored line and its totals rather than recomputing them. Only a partial quantity is recomputed, on the same unit price and rate the invoice used.",
      "Every money field on a credit note is stored negative in minor units, including the line unit price, so summing a period's documents gives the net of what was billed.",
      "The invoice engine's `Invoice` record has no `credited_minor` field, so the link lives on the credit note and `credit_note_list {invoice}` is the query. The field is written back only if a future engine version already carries it.",
      "Locks are always taken billing-docs first, then invoice, the same order servers/quotes and servers/recurring use, so no two processes in this repo can deadlock.",
    ],
  },
  "bank-statement": {
    summary: "Reads a bank CSV, OFX or QIF export into a local ledger: import, list, search, categorise with rules, summarise a period, detect recurring charges, and reconcile against the expense-tracker ledger.",
    storageFiles: [["data.json", "accounts, transactions and category rules"]],
    primaryFile: "data.json",
    caps: [
      "`FREE_ACCOUNTS` = 2 accounts on free.",
      "`FREE_WINDOW_MONTHS` = 12 months of history read back on free.",
      "`FREE_RULES` = 5 category rules on free.",
      "`FREE_RECONCILE_DAYS` = 31 days per `reconcile_expenses` answer on free. The guardrail answers over the most recent slice and names the cap (docs/GUARDRAILS_RESULT.md).",
      "`FREE_RECURRING_MONTHS` = 3 months and `FREE_RECURRING_CHARGES` = 5 charges per `recurring_detect` answer on free. It answers and names the cap; it does not refuse.",
      "`statement_export` is Pro. The refusal is an answer, not a protocol error, and no file is written.",
      "`MAX_FILE_BYTES` = 32 MB and `MAX_ROWS` = 200000 per imported statement.",
      "`MAX_REGEX_SOURCE` = 100 characters of rule pattern and `MAX_MATCH_INPUT` = 512 characters matched against it.",
    ],
    extra: [
      "Import always stores every row, on either tier. Dropping rows on the way in would make the ledger disagree with the bank; the free limit is on what is read back.",
      "`amount_minor` is a SIGNED integer: a debit is negative, a credit positive. A trailing minus (`12.50-`, the German, Polish and SAP export form) is a debit, not income (D-B1).",
      "A category rule whose `match` is empty or whitespace is refused. `description.includes(\"\")` is true for every row, so an empty rule rewrites the whole ledger (D-B2).",
      "Statement text is decoded from the bytes: a UTF-16 byte-order mark either way is honoured, UTF-8 otherwise (D-B3).",
      "`statement_export` writes through `<out>.<pid>.tmp` then `rename`, and removes the tmp file if the write fails, so a failed export leaves no partial file. Replacing an existing file is allowed but always reported.",
      "The expense-tracker ledger is read read-only, from the same XDG data root; a missing or corrupt sibling store is ignored rather than raised.",
    ],
  },
  "calendar": {
    summary: "Reads .ics calendar exports into a local store and answers questions about them: what is on, what is free, what conflicts, what is next, and writes a chosen set of events back out as a new .ics file.",
    storageFiles: [["data.json", "imported calendars, their events and the source they came from"]],
    primaryFile: "data.json",
    caps: [
      "`FREE_MAX_CALENDARS` = 2 calendars kept on free.",
      "`FREE_MAX_WINDOW_DAYS` = 31 days per question on free.",
      "`FREE_MAX_EXPORT_EVENTS` = 50 events per `event_export` on free. Over the cap nothing is written.",
      "`conflicts` over a longer window is answered for the first 31 days with the cap named, not refused (docs/GUARDRAILS_RESULT.md).",
      "Importing from a `url` or webcal feed is Pro. The refusal names the free path that gets the same result: paste the file contents as `text`.",
      "`MAX_BYTES` = 5 MB per fetched feed, `MAX_TEXT_BYTES` = 5 MB of pasted text, `MAX_WINDOW_DAYS` = 1830, `MAX_IDS` = 500, `MAX_LIST_ROWS` = 500.",
      "`MAX_CANDIDATES` = 100000 and `MAX_OCCURRENCES` = 20000 bound recurrence expansion, so an endless RRULE cannot run away.",
    ],
    extra: [
      "There is exactly one network call in the server, and only when the caller passes a `url`: one fetch, 12-second timeout, 5 MB cap, and loopback, private and cloud-metadata addresses refused before and after any redirect.",
      "Folds are rejoined on the raw bytes before decoding, so a multi-byte character split across an Outlook fold survives (D-24).",
      "`FREQ=HOURLY` is expanded; `FREQ=SECONDLY` and `FREQ=MINUTELY` are deliberately not, and the note says why. `BYSETPOS`, `BYDAY` ordinals and `RDATE`/`EXDATE` are parsed (D-12, D-14).",
      "A `DTEND` before `DTSTART` is read as zero length and says so rather than rendering a plausible appointment (D-19).",
      "A `TZID` that `Intl` does not know keeps the event, read as local time, with the reason named once per file.",
      "Exported times are written in UTC, and one occurrence of a recurring event is one addressable UID, not twelve VEVENTs sharing one.",
      "A per-process parse cache is keyed on the stored file's path, size and mtime, so four questions over a 20,000-event calendar do not re-parse it four times.",
      "ORGANIZER and ATTENDEE (with CN, ROLE, PARTSTAT, RSVP and the mailto value) are carried through export exactly as parsed from the source .ics, never re-derived or invented; an event imported with no attendees exports none (D-R61).",
    ],
    dropInvariants: ["Money is stored and compared in minor units"],
  },
  "image": {
    summary: "Local image work with no native dependency: read a header, resize, convert, compress, crop, thumbnail, watermark, strip metadata, batch-resize a folder, and report the dominant colours.",
    storageFiles: [["operations.json", "the last 500 operations this server performed, for the image://recent resource"]],
    primaryFile: "operations.json",
    caps: [
      "`FREE_MAX_PIXELS` = 4000000 output pixels per written file on free. The limit is on what is WRITTEN, not on what is read.",
      "`FREE_MAX_BATCH` = 5 files per `image_thumbnails` or `image_batch_resize` call on free.",
      "`FREE_MAX_COLORS` = 3 colours from `image_dominant_colors` on free. It answers with the top 3 rather than refusing, because a refusal made the model invent hex codes (docs/IMAGE_AUDIT.md).",
      "Custom `image_watermark` text is Pro; free watermarks with the business name from the shared profile.",
      "`MAX_BYTES` = 50 MB and `MAX_DIM` = 10000 px on any input, on either tier.",
    ],
    extra: [
      "`process.stdout.write` is wrapped before the transport is created: anything not beginning `{` or `[` is diverted to stderr, and `console.log/info/warn/debug` are bound to stderr outright. A decoder warning from `omggif` or `jpeg-js` on stdout killed the session (D-I1).",
      "A tier limit is an answer, not a protocol error: it comes back without `isError`, and nothing is written when one refuses a call.",
      "The operation register is best effort. The image is already on disk when the register is touched, so a corrupt register is quarantined and reported as a note on a successful answer, never as \"nothing was written\".",
      "An animated GIF is read as its first frame and the output is a still; the count of frames and that fact are stated rather than left silent (D-I2).",
      "EXIF orientation is applied on read. When the header disagrees, `image_info` prints `declared_in_header` and says a copy written here carries no EXIF block and will not be turned again (D-I3).",
      "A resize past the source resolution says the extra pixels are interpolated, not new detail (D-I4).",
      "Watermark text outside the bundled Latin-1 bitmap font is transliterated or reported, never silently drawn as nothing (D-I5).",
    ],
    dropInvariants: [
      "Money is stored and compared in minor units",
      "A store file that fails to parse is quarantined",
    ],
  },
  "kanban": {
    summary: "A local task board per project: add, move, update and finish tasks across columns, search them, see what is overdue, run a weekly review, and start a timer on the time-tracker server.",
    storageFiles: [["data.json", "boards, their columns and every task"]],
    primaryFile: "data.json",
    caps: [
      "`FREE_PROJECTS` = 3 project boards on free.",
      "`FREE_OPEN_TASKS` = 200 open tasks on free.",
      "`columns_set` (custom columns) is Pro; free boards use the default five: backlog, todo, doing, review, done.",
      "`weekly_review` is free for the current week; a past week is Pro.",
      "`MAX_TITLE` = 300, `MAX_NOTES` = 5000, `MAX_PROJECT` = 100, `MAX_ID` = 64, `MAX_COLUMN_NAME` = 40, `MAX_COLUMNS` = 12, `MAX_TAGS` = 30, `MAX_TAG` = 60, `MAX_QUERY` = 200, `MAX_MINUTES` = 100000.",
      "Listing prints 200 rows by default and `limit` reaches 2000 (`MAX_ROW_LIMIT`). The totals line still counts every row.",
    ],
    extra: [
      "A blank project name is refused, and `resolveProject` never near-matches an empty stored name, so a board with an empty name cannot swallow every later project (D-K2).",
      "`columns_set` validates the normalised list, not the raw array, so a board cannot be collapsed to one column, which would make every task on it read as done (D-K4).",
      "`task_list`, `task_search` and `overdue` cap the printed rows and say what was cut. One 5,000-task listing was 430 KB, roughly 110,000 tokens, which no client can use (D-K9).",
      "`task_start_timer` reads the sibling `time-tracker/data.json` under the same XDG data root, read-only and best effort, and warns before starting when the two stores would resolve the project name differently (D-K10).",
      "Accepted due-date forms: `YYYY-MM-DD` (a real calendar day), `today`, `tomorrow`, `yesterday`, `+Nd`, a bare weekday meaning the nearest on or after today, and `next <weekday>` meaning the nearest strictly after. Anything else is refused with the list.",
    ],
    dropInvariants: ["Money is stored and compared in minor units"],
  },
  "pdf": {
    summary: "Local PDF work with no native dependency: read a document's shape, count and extract pages, merge, split, rotate, reorder, stamp, add a business footer, and read the text back out.",
    storageFiles: [["operations.json", "the last 500 operations this server performed, for the pdf://recent resource"]],
    primaryFile: "operations.json",
    caps: [
      "`FREE_MAX_MERGE_FILES` = 5 files per `pdf_merge` on free.",
      "`FREE_MAX_PAGES` = 30 pages per file for `pdf_split`, `pdf_pages` and `pdf_rotate` on free.",
      "`pdf_stamp` is free for the `PAID` and `DRAFT` presets in their preset colours; custom text, colour and size are Pro.",
      "`pdf_watermark_business` and `pdf_reorder` are Pro.",
      "`MAX_BYTES` = 100 MB per input, `MAX_FONT_SIZE` = 1600 points, `MAX_TEXT_CHARS` = 200000 per `pdf_text` answer.",
    ],
    extra: [
      "`reserveOutput(out, overwrite, inputs)` refuses an `out_path` that resolves to, or shares an inode with, any input of the same call, before any directory is made and before any work. `overwrite: true` does not override it: it is consent to replace some other file, never to consume an input (D-P1).",
      "A tier limit is an answer, not a protocol error: it comes back without `isError`, and nothing is written when one refuses a call.",
      "The operation register is best effort. The file is already on disk when the register is touched, so a corrupt register is quarantined and reported as a note on a successful answer, never as \"nothing was written\".",
      "Stamp text is sanitised, not deleted: a whitespace control is a word separator (D-P2), and a character outside WinAnsi is transliterated (`OPLACONE` for `OPŁACONE`) with the count of replacements and the text actually drawn reported (D-P3).",
      "A stamp that does not fit is refused with the measurement, not drawn off the page: the width is compared against the room available and the overflow is named in points (D-P4).",
      "`pdf_text` is best effort and says so: it reads `Tj`, `TJ`, `'` and `\"` out of the FlateDecode content streams with `node:zlib`. A scan carries no text operators, and the answer names the exact argument that continues a truncated read (D-P6).",
    ],
    dropInvariants: [
      "Money is stored and compared in minor units",
      "A store file that fails to parse is quarantined",
    ],
  },
  "clauses": {
    summary: "A local clause library for contracts: store your own clauses, search them, and assemble a contract from a list of clause titles with variables filled in.",
    storageFiles: [["data.json", "clause library, own clauses plus imports"]],
    primaryFile: "data.json",
    caps: ["`FREE_OWN_CLAUSES` = 10 stored clauses on free.", "`FREE_ASSEMBLE_CLAUSES` = 8 clauses per assembled contract on free."],
    extra: ["`contract_assemble` refuses when a variable referenced by a clause has no value, rather than shipping a contract with an unfilled placeholder."],
  },
  "currency": {
    summary: "ECB reference rates: convert amounts, look up a rate on a past date, and read the local rate cache. One public download from the ECB, cached on disk.",
    storageFiles: [["daily.json", "latest ECB daily reference rates"], ["history.json", "the ECB 90-day / historical series"]],
    primaryFile: "daily.json",
    caps: ["`FREE_HISTORY_DAYS` = 90 days of history on free."],
    extra: [
      "The cache is the only network surface in the repo besides price-tracker: one GET of the ECB eurofxref files, no API key.",
      "A rate is reported with the ECB reference date it belongs to. The ECB publishes around 16:00 CET, so \"today\" before that resolves to the previous business day and the tool says so.",
      "Quarantine wording differs here: the store calls it `the cache file is corrupt`, because losing a cache is recoverable by re-downloading.",
    ],
  },
  "docx": {
    summary: "Writes real .docx files: documents from markdown or sections, proposals, contracts, and template filling. Reads a .docx back to text.",
    storageFiles: [["business.json", "issuer profile printed on proposals and contracts"], ["counter.json", "proposal and contract reference numbers"], ["documents.json", "documents this server has written"]],
    primaryFile: "documents.json",
    caps: ["`FREE_AGREEMENTS_PER_MONTH` = 3 proposals or contracts per calendar month on free.", "`FREE_TEMPLATE_PLACEHOLDERS` = 10 placeholders per template fill on free."],
    extra: ["A reference number is allocated only after every argument has validated, so a rejected call never burns a number."],
  },
  "expense-tracker": {
    summary: "Logs business expenses with categories, VAT, mileage and receipts, and hands the billable ones to the invoice server without double-taxing them.",
    storageFiles: [["data.json", "expenses, category rules, settings"]],
    primaryFile: "data.json",
    caps: [
      "`FREE_WINDOW_DAYS` = 30 days of history readable on free.",
      "`FREE_PROJECTS` = 3 projects on free.",
      "`FREE_RULES` = 5 category rules on free.",
      "`FREE_EXPORT_ROWS` = 200 rows per export on free. Over the cap nothing is written.",
      "`FREE_REBILL_ITEMS` = 20 items per `expense_to_invoice` handoff on free.",
    ],
    extra: [
      "`expense_add` defaults `billable` to true, so an expense logged against a project is not silently dropped from the next invoice.",
      "`expense_to_invoice` passes net amounts and the tax rate separately; it never re-applies VAT to a gross figure.",
      "`expense_mark_rebilled` is the only thing that flips the rebilled flag, and it is not implied by the export.",
    ],
  },
  "invoice": {
    summary: "Issues numbered invoices with per-line tax, discounts and multi-currency lines, renders a PDF, and reports what is overdue.",
    storageFiles: [["business.json", "issuer profile"], ["clients.json", "client records"], ["counter.json", "per-year invoice number counter"], ["invoices.json", "issued invoices"]],
    primaryFile: "invoices.json",
    caps: ["`FREE_INVOICES_PER_MONTH` = 3 invoices per calendar month on free. Over the cap nothing is stored and no number is consumed."],
    extra: [
      "The invoice number is allocated after every argument validates. An impossible `issue_date` is refused before `nextNumber()` runs, so the sequence never carries a gap.",
      "`quantity` and `unit_price` are bounded to a finite +/-1e12 and a total that is not a safe integer is refused, so `total_minor` is never `null`.",
      "Every money value printed by a tool carries its ISO currency code. A bare number is a defect.",
      "A missing business profile never blocks an invoice; the PDF prints a placeholder issuer and the response says so.",
      "`overdue_report` is free. A report about money owed is not a paywall surface.",
    ],
  },
  "price-tracker": {
    summary: "Watches a public product page for its price, keeps the history, and reports drops against a target.",
    storageFiles: [["watches.json", "watched URLs, targets and price history"]],
    primaryFile: "watches.json",
    caps: ["`FREE_WATCH_LIMIT` = 3 watches on free.", "`FREE_HISTORY_LIMIT` = 30 history points per watch on free."],
    extra: [
      "The free-tier check is re-evaluated against a freshly loaded store after the network fetch, because a limit checked before an `await` is not a limit.",
      "`watch_refresh` merges into a freshly loaded store, so a watch added during a refresh is not dropped.",
      "The page read is capped at 2 MB. Only http and https are fetched.",
      "Quarantine wording differs here: the store calls it `the price database ... is not valid JSON`.",
    ],
  },
  "recurring": {
    summary: "Recurring invoice schedules: define a cadence, see what is due, and generate the invoices through the invoice engine.",
    storageFiles: [["schedules.json", "recurring schedules"], ["history.json", "generated runs, one row per issued invoice"]],
    primaryFile: "schedules.json",
    caps: ["`FREE_ACTIVE_SCHEDULES` = 3 active schedules on free.", "`FREE_UPCOMING_DAYS` = 30 days of lookahead on free.", "`FREE_FORECAST_MONTHS` = 3 months of forecast on free."],
    extra: [
      "Reads go through the invoice engine's `readJsonFile`, so the quarantine contract is identical to invoice's.",
      "`invoice_generate_due` is idempotent per period: a period already generated is skipped, not issued twice.",
      "Month arithmetic clamps to the end of a short month rather than rolling into the next one.",
    ],
  },
  "resume": {
    summary: "Keeps a structured profile and writes resumes, cover letters and job-tailored variants from it, as markdown, HTML or .docx.",
    storageFiles: [["profiles.json", "the profile and its named variants"], ["letters.json", "cover letters written, for the per-month cap"]],
    primaryFile: "profiles.json",
    caps: ["`FREE_LETTERS_PER_MONTH` = 3 cover letters per calendar month on free.", "`FREE_JD_CHARS` = 2000 characters of job description on free."],
    extra: ["`tailor_to_job` refuses to write a claim that is not in the stored profile. Inventing experience is a defect, not a feature."],
  },
  "spreadsheet": {
    summary: "Reads, queries and writes CSV and XLSX without a native dependency: filter with an expression, compute stats, add a computed column, convert between formats.",
    storageFiles: [],
    primaryFile: null,
    caps: [
      "`FREE_MAX_ROWS` = 5000 rows and `FREE_MAX_BYTES` = 5 MB per read on free. Over the read cap the tool returns the first 5,000 rows and says what was left out.",
      "`FREE_WRITE_ROWS` = 500 rows per written file on free. Over the write cap nothing is written at all.",
    ],
    extra: [
      "This server is stateless: it owns no store under the data dir and holds nothing between calls. Every path comes from the caller.",
      "The `where` expression is evaluated by the server's own parser, never by `eval` or `Function`.",
      "The read cap truncates and says so; the write cap refuses. A partial file that looks complete is worse than no file.",
    ],
    dropInvariants: [
      "A store file that fails to parse is quarantined",
      "The load-mutate-save cycle is held under an advisory lock",
      "Money is stored and compared in minor units",
    ],
  },
  "time-tracker": {
    summary: "A stopwatch and a manual time log per project, with rates, tags, a billable flag, reports and CSV export.",
    storageFiles: [["data.json", "entries, projects and rates, the running timer"]],
    primaryFile: "data.json",
    caps: ["`FREE_WINDOW_DAYS` = 7 days of history readable on free.", "`FREE_RATED_PROJECTS` = 2 projects with a rate on free."],
    extra: [
      "`timer_stop` with no timer running is a normal answer, not an error.",
      "An entry needs either an `end` or `minutes`; `end` before `start` is refused.",
      "`entry_mark_billed` is the seam to invoice: only it flips the billed flag, so hours cannot be invoiced twice.",
    ],
  },
  "timezone": {
    summary: "Timezone arithmetic for scheduling: current time in several zones, overlap between working hours, meeting slots, DST changes, business days, and an .ics file.",
    storageFiles: [["data.json", "saved contacts with their zones and working hours"]],
    primaryFile: "data.json",
    caps: [
      "`FREE_MAX_PARTICIPANTS` = 3 participants per search on free.",
      "`FREE_MAX_DAYS` = 5 days searched on free.",
      "`FREE_MAX_CONTACTS` = 5 saved contacts on free.",
      "`FREE_ICS_PER_MONTH` = 3 .ics files per calendar month on free.",
    ],
    extra: [
      "Zone arithmetic uses the platform IANA database through `Intl`, so DST is correct without a bundled tzdata.",
      "There is no holiday calendar. `business_days` counts weekdays and says so rather than implying it knows local holidays.",
      "When no slot fits, the tool says no slot fits. It never widens the stated working hours on its own.",
    ],
  },
};

// ---------------------------------------------------------------- stdio client

function rpc(entry, env = {}) {
  const home = mkdtempSync(join(tmpdir(), "mcp-genspec-"));
  const child = spawn(process.execPath, [entry], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, XDG_DATA_HOME: join(home, "data"), XDG_CONFIG_HOME: join(home, "config"), MCP_LICENSE_KEY: "", ...env },
  });
  child.stderr.resume();
  let buf = "";
  const pending = new Map();
  child.stdout.on("data", (d) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      let m; try { m = JSON.parse(line); } catch { continue; }
      const r = pending.get(m.id);
      if (r) { pending.delete(m.id); r(m); }
    }
  });
  let id = 0;
  const send = (method, params) => new Promise((res, rej) => {
    const mid = ++id;
    pending.set(mid, res);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: mid, method, params }) + "\n");
    const t = setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); rej(new Error(`timeout on ${method}`)); } }, 20000);
    t.unref();
  });
  return {
    send,
    async init() {
      const r = await send("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "gen-spec", version: "0" } });
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n");
      return r.result;
    },
    close() { child.kill(); try { rmSync(home, { recursive: true, force: true }); } catch { /* best effort */ } },
  };
}

// ---------------------------------------------------------------- rendering

const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();

/** JSON Schema (as emitted by zod-to-json-schema) -> a short type word. */
function typeOf(s) {
  if (!s || typeof s !== "object") return "any";
  if (s.enum) return s.enum.map((v) => JSON.stringify(v)).join(" | ");
  if (s.const !== undefined) return JSON.stringify(s.const);
  if (Array.isArray(s.anyOf)) return s.anyOf.map(typeOf).join(" | ");
  if (Array.isArray(s.oneOf)) return s.oneOf.map(typeOf).join(" | ");
  if (Array.isArray(s.allOf)) return s.allOf.map(typeOf).join(" & ");
  if (s.type === "array") return `${typeOf(s.items)}[]`;
  if (s.type === "object") {
    const keys = Object.keys(s.properties ?? {}).sort();
    return keys.length ? `object{${keys.join(", ")}}` : "object";
  }
  if (Array.isArray(s.type)) return s.type.join(" | ");
  return s.type ?? "any";
}

function constraints(s) {
  if (!s || typeof s !== "object") return "";
  const bits = [];
  if (s.minimum !== undefined) bits.push(`min ${s.minimum}`);
  if (s.maximum !== undefined) bits.push(`max ${s.maximum}`);
  if (s.minLength !== undefined) bits.push(`minLength ${s.minLength}`);
  if (s.maxLength !== undefined) bits.push(`maxLength ${s.maxLength}`);
  if (s.pattern) bits.push(`pattern \`${s.pattern}\``);
  if (s.default !== undefined) bits.push(`default ${JSON.stringify(s.default)}`);
  return bits.length ? ` (${bits.join(", ")})` : "";
}

function argTable(schema) {
  const props = schema?.properties ?? {};
  const required = new Set(schema?.required ?? []);
  const names = Object.keys(props).sort();
  if (!names.length) return "No arguments.\n";
  const rows = names.map((n) => {
    const p = props[n];
    return `| \`${n}\` | ${esc(typeOf(p))} | ${required.has(n) ? "yes" : "no"} | ${esc((p?.description ?? "") + constraints(p))} |`;
  });
  return ["| arg | type | required | description |", "| --- | --- | --- | --- |", ...rows].join("\n") + "\n";
}

/** The free-vs-pro markdown table out of the server README. */
function freeProTable(name) {
  const p = join(REPO, "servers", name, "README.md");
  if (!existsSync(p)) return "_No README.md._\n";
  const lines = readFileSync(p, "utf8").split("\n");
  const start = lines.findIndex((l) => /^#{2,3}\s+free\s+vs\.?\s+pro/i.test(l.trim()));
  if (start < 0) return "_No \"Free vs Pro\" section in the README._\n";
  const out = [];
  let seen = false;
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^#{1,6}\s/.test(l)) break;
    if (l.trim().startsWith("|")) { out.push(l.trimEnd()); seen = true; }
    else if (seen && !l.trim()) break;
  }
  return out.length ? out.join("\n") + "\n" : "_No table under \"Free vs Pro\" in the README._\n";
}

/**
 * Failure modes: the literal head of every error message constructed in src.
 * Matches `fail("...")`, `err("...")`, `bad("...")` and `new *Error("...")`, keeping the
 * literal prefix up to the first interpolation. Sorted and deduped, so it is stable.
 */
function failureModes(name) {
  const dir = join(REPO, "servers", name, "src");
  if (!existsSync(dir)) return [];
  const re = /(?:\b(?:fail|err|bad)\(|new (?:[A-Za-z]+)?Error\()\s*(?:`|")((?:[^`"$\\\n]|\\.)*)/g;
  const out = new Set();
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith(".ts")) continue;
    const text = readFileSync(join(dir, f), "utf8");
    for (const m of text.matchAll(re)) {
      const lit = m[1].replace(/\\(.)/g, "$1").trim();
      if (lit.length >= 12) out.add(lit);
    }
  }
  return [...out].sort();
}

function invariantsFor(name) {
  const c = CURATED[name];
  const drop = c.dropInvariants ?? [];
  const base = COMMON_INVARIANTS.filter((i) => !drop.some((d) => i.startsWith(d)));
  return [...base, ...(c.extra ?? [])];
}

// ---------------------------------------------------------------- generation

async function genOne(name) {
  const c = CURATED[name];
  if (!c) throw new Error(`no curated block for ${name}`);
  const entry = join(REPO, "servers", name, "dist", "index.js");
  if (!existsSync(entry)) throw new Error(`${entry} is missing; run npm run build first`);
  const pkg = JSON.parse(readFileSync(join(REPO, "servers", name, "package.json"), "utf8"));

  const cli = rpc(entry);
  let info, tools, resources, prompts;
  try {
    info = await cli.init();
    tools = (await cli.send("tools/list", {})).result?.tools ?? [];
    const r = await cli.send("resources/list", {});
    resources = r.result?.resources ?? [];
    const p = await cli.send("prompts/list", {});
    prompts = p.result?.prompts ?? [];
  } finally {
    cli.close();
  }
  tools = [...tools].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  resources = [...resources].sort((a, b) => (a.uri < b.uri ? -1 : 1));
  prompts = [...prompts].sort((a, b) => (a.name < b.name ? -1 : 1));

  const L = [];
  L.push(`# ${name}: contract spec`);
  L.push("");
  L.push("Generated by `scripts/gen-spec.mjs` from the built server. Do not edit by hand: re-run the generator.");
  L.push("");
  L.push("| | |");
  L.push("| --- | --- |");
  L.push(`| package | \`${pkg.name}\` |`);
  L.push(`| version | ${pkg.version} |`);
  L.push(`| bin | \`${Object.keys(pkg.bin ?? {}).sort().join(", ") || "none"}\` |`);
  L.push(`| serverInfo.name | \`${esc(info?.serverInfo?.name)}\` |`);
  L.push(`| transport | stdio, JSON-RPC 2.0 |`);
  L.push(`| tools | ${tools.length} |`);
  L.push(`| resources | ${resources.length} |`);
  L.push(`| prompts | ${prompts.length} |`);
  L.push("");
  L.push("## What it does");
  L.push("");
  L.push(c.summary);
  L.push("");

  L.push(`## Tools (${tools.length})`);
  L.push("");
  L.push("| tool | description |");
  L.push("| --- | --- |");
  for (const t of tools) L.push(`| \`${t.name}\` | ${esc(t.description)} |`);
  L.push("");
  for (const t of tools) {
    L.push(`### \`${t.name}\``);
    L.push("");
    if (t.title) L.push(`Title: ${esc(t.title)}`), L.push("");
    L.push(esc(t.description) || "_No description._");
    L.push("");
    L.push(argTable(t.inputSchema));
  }

  L.push("## Resources");
  L.push("");
  if (resources.length) {
    L.push("| uri | name | description |");
    L.push("| --- | --- | --- |");
    for (const r of resources) L.push(`| \`${r.uri}\` | ${esc(r.name)} | ${esc(r.description)} |`);
  } else {
    L.push("None.");
  }
  L.push("");

  L.push("## Prompts");
  L.push("");
  if (prompts.length) {
    L.push("| name | description |");
    L.push("| --- | --- |");
    for (const p of prompts) L.push(`| \`${p.name}\` | ${esc(p.description)} |`);
  } else {
    L.push("None.");
  }
  L.push("");

  L.push("## Invariants");
  L.push("");
  for (const i of invariantsFor(name)) L.push(`- ${i}`);
  L.push("");

  L.push("## Free vs Pro");
  L.push("");
  L.push("From `servers/" + name + "/README.md`.");
  L.push("");
  L.push(freeProTable(name).trimEnd());
  L.push("");
  L.push("Enforced limits in the source:");
  L.push("");
  for (const cap of c.caps) L.push(`- ${cap}`);
  L.push("");

  L.push("## Storage");
  L.push("");
  if (c.storageFiles.length) {
    L.push("Data dir: `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/" + name + "/`");
    L.push("");
    L.push("| file | holds |");
    L.push("| --- | --- |");
    for (const [f, holds] of c.storageFiles) L.push(`| \`${f}\` | ${holds} |`);
    L.push("");
    L.push(`Primary file (the one a corrupt-store test targets): \`${c.primaryFile}\`.`);
    L.push("");
    L.push("Also written on failure: `<file>.corrupt-<timestamp>` (the quarantined original, byte-for-byte) and `<file>.corrupt` (the marker that blocks every later call). Transient: `<file>.<pid>.tmp` and the `.lock` directory.");
  } else {
    L.push("None. This server keeps no state under the data dir; every path is supplied by the caller.");
  }
  L.push("");
  L.push("Licence key lookup order: `MCP_LICENSE_KEY` env, then `${XDG_CONFIG_HOME:-~/.config}/mcp-servers/license.json`, then free tier.");
  L.push("");

  const fm = failureModes(name);
  L.push("## Failure modes");
  L.push("");
  L.push("Literal error-message heads found in `servers/" + name + "/src/*.ts`. Each is returned as `Error: <text>` with `isError: true`, sorted, truncated at the first interpolation.");
  L.push("");
  if (fm.length) for (const f of fm) L.push("- `Error: " + f.replace(/`/g, "'") + "`");
  else L.push("_None matched the literal grep; this server builds its messages entirely from interpolated values._");
  L.push("");

  const out = L.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
  writeFileSync(join(REPO, "servers", name, "SPEC.md"), out);
  return { name, tools: tools.length, resources: resources.length, prompts: prompts.length, failureModes: fm.length };
}

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : SERVERS;
const rows = [];
for (const n of wanted) rows.push(await genOne(n));
for (const r of rows) {
  process.stdout.write(`servers/${r.name}/SPEC.md  tools=${r.tools} resources=${r.resources} prompts=${r.prompts} failure_modes=${r.failureModes}\n`);
}
