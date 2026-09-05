# mcp-cash-book: build

Date 2026-09-06. Scope: `servers/cash-book` only, plus `scripts/gen-spec.mjs` (one
`CURATED` entry and one name in `SERVERS`) and this file. `servers/invoice/src/index.ts`
was NOT touched: this server does not read the shared business profile, so `PROFILE_READERS`
does not gain it, and `servers/invoice/test/profile-readers.test.mjs` re-runs the grep that
proves it. Nothing in `servers/invoice`, `servers/billing-docs`, `servers/deposits`,
`servers/expense-tracker`, `servers/bank-statement`, `servers/asset-register`,
`servers/statement-of-account`, `packages/mcp-license`, `remote/`, the pages, the bundles or
the hosting layer was changed by this build; the orchestrator wires those. Zero paid API
calls, zero network:
`grep -rEn "fetch\(|https?://|node:http|node:net|node:dns" servers/cash-book/src/`
returns only the checkout host in the licensing copy, and the contract suite asserts that.

One thing outside the scope has to be landed by the orchestrator: adding a 25th server that
sells Pro makes `packages/mcp-license/test/bundle-link.test.mjs` fail on `SERVER_COUNT`,
which is 24 in both `packages/mcp-license/src/index.ts` and `remote/src/shims/license.ts`.
That test names the fix itself: bump both to 25, together, or every cap message in the suite
quotes a stale count. Both files carry the bump in the working tree, and neither is in this
commit.

The server is `@theluckystrike/mcp-cash-book` 0.14.0, 6 tools plus the two license tools,
one resource and one prompt. It holds no copy of the money formatting (`formatMoney` from
`@theluckystrike/mcp-invoice/lib`), no copy of the payment reconstruction (`paymentRows`
from `@theluckystrike/mcp-statement-of-account/lib`), no copy of the depreciation schedule
(`buildSchedule` and `chargeForMonth` from `@theluckystrike/mcp-asset-register/lib`), no
copy of the corrupt-store quarantine (`readJsonFile`, again from the invoice engine) and no
copy of the licensing or locking code. It exports its own `./lib` (the chart of accounts,
the posting rules, the bank matching, the trial balance and the CSV writer).

## Design decisions worth stating

**The bank import posts nothing.** This is the decision the whole ledger rests on and it is
counter-intuitive, because the account is called cash and the bank statement is the record
of cash. A bank line and a payment record are not two transactions, they are one transaction
seen twice: `invoice_mark_paid` records the receipt, and the same receipt arrives again when
the statement is imported. So cash is posted from the DOCUMENTS, which are the only rows
that carry a second leg, and each bank row is matched to a posted cash movement of the same
amount, the same direction and a date within three days, as evidence, written onto the line
as `bank_ref`. The leftovers are the output that matters: a bank debit with no expense,
refund or asset behind it is a payment nobody entered, and a posted cash movement with no
bank line behind it either has not cleared or did not happen. See the measured insight
below; this is the single decision that changes the most numbers.

**A bank row that could match two postings is matched to neither.** Picking the first would
be a coin toss written into a ledger, and two candidates for one bank line is exactly the
case a human has to look at. Probe 20 seeds two expenses of the same amount on the same day
against one bank debit.

**Nothing is ever balanced with a plug.** Every entry is posted exactly as the source
document states it, and when its own legs do not add up the entry is still posted and the
difference is raised by name. A trial balance can only find a broken document if it is
allowed to come out non-zero: forcing a balancing figure would turn the one check this
server exists for into a formality that always passes. `offenders` names the entry, the
source server and the source document behind every unit of the difference.

**An unreadable store is never read as an empty one, and no store is fatal.** The invoice
ledger is not fatal either, unlike in `servers/statement-of-account`, because a business
with only bank imports and expenses still has a cash book. What a missing store costs is
stated per store and in words, and the reason it has to be stated is that a ledger short one
whole store still balances perfectly: both legs of every missing entry are missing. The
`sources` block carries `read: false` with an error, which is a figure that could not be
computed, distinctly from `read: true, rows: 0`, which is a figure that is genuinely zero.

**A deposit applied to an invoice never touches cash.** `deposit_apply` in
`servers/deposits` raises the invoice's `paid_minor` and appends nothing to `payments[]`,
and the cash arrived earlier, when the deposit was received. So the application debits
deposits held and credits receivables. The first cut posted it to cash, which received the
same money twice: once as the deposit and once as the payment.

**`paid_minor` is the authority and `payments[]` only the attribution**, and that rule is
not re-implemented here. `paymentRows` from `servers/statement-of-account` already knows it,
including what to do when the deposit book and the invoice ledger disagree, and a second
copy of a reconciliation rule is a second rule to drift.

**The VAT comes out of the gross, never on top of it.** `servers/expense-tracker` stores an
expense amount VAT-INCLUSIVE, so the input VAT is `round(gross * rate / (100 + rate))` and
the category account takes the rest. Adding it on top would overstate the expense and the
reclaim together, and both figures would look ordinary.

**A purchase order is a memo and is never posted.** An order is a commitment, not a
transaction: nothing has been delivered and nothing is owed. A ledger that posts an open
order reports a liability the business does not have, and it is the kind of liability that
gets believed because it came out of a computer.

**A credit note is stored negative by `servers/billing-docs`,** which is the sign a ledger
wants, so no row here flips one. A credit note found stored POSITIVE is posted as it stands
and flagged, because a silent flip would hide the fact that something other than that server
wrote the row.

**Currencies are never added together.** One ledger is one currency, a period holding two is
refused by name until one is chosen, and the documents in the other are counted as excluded
rather than silently dropped. There is no exchange rate in this server, so a single trial
balance over a EUR book and a USD one would be an invented number that balances.

**A close is a snapshot, not a freeze.** `month_close` records what the trial balance said
at the moment of closing. It does not and cannot freeze the sibling stores, which this
server does not own; closing again after one of them moved reports the drift by name rather
than quietly adopting the new figure. The snapshot is the only place that change is visible.

**This ledger opens at nothing.** It derives only what the period itself contains, so an
account balance here is the period's MOVEMENT. No opening balance is carried in from a book
this server does not keep, because an opening figure that nobody can walk back to a document
is the first invented number in a set of books.

**The free cap is on the PERIOD, not on the question.** `trial_balance` and `ledger_lines`
are free and unlimited on every tier: whether the books add up is the question this server
exists for, and a free tier that hides the answer is a demo. Three distinct periods a
calendar month are metered by from, to and currency, so rebuilding one already in the
register is free forever, on every tier.

## The worked month

`test/_client.mjs` seeds six stores and the period is 2026-06-01 to 2026-06-30, in EUR.
Every figure the unit suite asserts is recomputed by hand from these rows:

| when | document | posting |
| --- | --- | --- |
| 2026-06-01 | `DEP-2026-0001` received, 1,000.00 | Dr cash 1,000.00, Cr deposits held 1,000.00 |
| 2026-06-03 | `INV-2026-0001`, net 1,000.00 + 23 percent VAT | Dr receivables 1,230.00, Cr revenue 1,000.00, Cr VAT output 230.00 |
| 2026-06-05 | expense `exp_1`, 123.00 gross at 23 percent | Dr expenses:travel 100.00, Dr VAT input 23.00, Cr cash 123.00 |
| 2026-06-10 | `INV-2026-0002`, net 500.00, no VAT rate | Dr receivables 500.00, Cr revenue 500.00 |
| 2026-06-12 | expense `exp_2`, 50.00 gross, no VAT | Dr expenses:software 50.00, Cr cash 50.00 |
| 2026-06-15 | `ASSET-2026-0002` enters service, 12,000.00 | Dr fixed assets 12,000.00, Cr cash 12,000.00 |
| 2026-06-18 | `DEP-2026-0001` applies 600.00 to `INV-2026-0001` | Dr deposits held 600.00, Cr receivables 600.00 |
| 2026-06-20 | payment row on `INV-2026-0001`, 630.00 | Dr cash 630.00, Cr receivables 630.00 |
| 2026-06-25 | `CN-2026-0001` against `INV-2026-0002`, 100.00 | Dr revenue 100.00, Cr receivables 100.00 |
| 2026-06-30 | `ASSET-2026-0001` depreciation for June | Dr depreciation expense 150.00, Cr accumulated depreciation 150.00 |

Totals: 16,383.00 of debits against 16,383.00 of credits. The account balances, in minor
units, are cash -1,054,300, receivables 40,000, revenue -140,000, VAT output -23,000, VAT
input 2,300, expenses:travel 10,000, expenses:software 5,000, deposits held -40,000, fixed
assets 1,200,000, accumulated depreciation -15,000 and depreciation expense 15,000. All
eleven are asserted in `test/unit.test.mjs`.

Five bank rows are seeded beside them: 1,000.00 in, 123.00 out, 12,000.00 out, 630.00 in and
75.00 out. Four match a posted cash movement. The fifth, an unexplained 75.00 withdrawal, is
the exception `month_close` reports, along with `INV-2026-0002` carrying no VAT rate and
`exp_2` having no bank line behind it.

## Probes

Harness: `servers/cash-book/test/_client.mjs` spawns `node servers/cash-book/dist/index.js`
on a fresh `XDG_DATA_HOME` / `XDG_CONFIG_HOME` and seeds the six sibling stores directly, in
the record shapes their own `src/store.ts` files declare. Spawning `mcp-invoice` to create an
invoice would test `mcp-invoice`; what has to be pinned down here is what THIS server derives
from a given set of rows. A contract test greps those six sibling sources for the fields this
server depends on, so a rename over there fails here instead of silently zeroing a figure
that still balances. Pro runs use `node scripts/sign-license.mjs cash-book`. Every row below
is asserted in `test/{unit,adversarial,concurrency,contract}.test.mjs`.

| # | Probe | Result | What happens |
| --- | --- | --- | --- |
| 1 | The worked month balances | PASS | 1,638,300 minor units of debits against 1,638,300 of credits, zero imbalance, no offenders |
| 2 | Every account carries the hand figure | PASS | All eleven balances asserted against the table above |
| 3 | Every line names its source | PASS | Server, document id and an ISO date on every leg, across five source servers |
| 4 | Every entry balances on its own | PASS | Grouped by entry id, each group sums to zero |
| 5 | A leg is a debit or a credit, never both, and never zero | PASS | Asserted per line |
| 6 | A deposit applied moves the liability, not cash | PASS | Cash debits total 163,000, the 60,000 application is a debit to deposits held |
| 7 | Expense VAT comes out of the gross | PASS | 12,300 gross becomes 10,000 expense, 2,300 VAT input, 12,300 cash |
| 8 | Depreciation is charged by month | PASS | One charge of 15,000 on the asset already in service, dated the month end |
| 9 | An asset entering service posts fixed assets against cash | PASS | 1,200,000 on 2026-06-15, from `ASSET-2026-0002` |
| 10 | The bank import posts nothing | PASS | Zero lines with source `bank-statement`; four lines carry a `bank_ref` |
| 11 | A purchase order is a memo | PASS | One memo of 90,000, zero lines, the trial balance unchanged |
| 12 | `month_close` lists the exceptions and snapshots the trial balance | PASS | Three exceptions by kind, 11 accounts in the snapshot |
| 13 | Closing again after a store moved reports the drift | PASS | 1,638,300 then 1,648,200, named as a change rather than adopted |
| 14 | The CSV | PASS | One row per leg, every field quoted, the source columns present |
| 15 | `ledger_report` | PASS | Receivables 173,000 debits, 133,000 credits, 40,000 balance, read as a debit balance |
| 16 | The register | PASS | One row per distinct period; a rebuild keeps the first-built timestamp |
| 17 | Filters | PASS | By account, by account prefix, by source, by document, by date, with the note that a filtered set is not expected to balance |
| 18 | An empty period | PASS | Balanced at zero with no accounts. Not an error |
| 19 | An invoice ledger alone | PASS | 123,000 balanced, every other store `read: true, rows: 0`, and no degraded note |
| 20 | An unreadable expense ledger | PASS | `read: false` with the parse error, a note saying expenses and VAT input are MISSING, and the ledger still balances |
| 21 | An unreadable invoice ledger | PASS | Not fatal: the credit note still posts, receivables -10,000, no VAT output derived at all |
| 22 | Two currencies | PASS | Refused naming EUR and USD; naming one gives 1,638,300 or 70,000 and counts the other as excluded |
| 23 | An invoice paid twice, by payment row and by deposit | PASS | Receivables clear once, cash 200,000, the deposit still held, and the disagreement named with both figures |
| 24 | A bank row matching two expenses | PASS | Matched to neither, both candidates named, no `bank_ref` written |
| 25 | A deposit applied to an invoice that does not exist | PASS | Not posted, the whole deposit still a liability, and the exception says deposits held is 40,000 too high |
| 26 | A document whose legs do not add up | PASS | Imbalance 500, one offender named, and the verdict says nothing was adjusted to hide it |
| 27 | A period that runs backwards, and dates that are not dates | PASS | 2026-02-30, "yesterday" and a reversed period all refused by name |
| 28 | The free cap | PASS | Three periods, the fourth refused with the price, rebuilds free, the trial balance never metered |
| 29 | Pro gates | PASS | `month_close`, `ledger_export_csv` and `ledger_report` refused on free with the checkout link |
| 30 | Pro key for another product | PASS | A key signed for `deposits` unlocks nothing here |
| 31 | A corrupt register of this server's own | PASS | Building is blocked; the trial balance still answers, because it never touches the register |
| 32 | A credit note stored positive | PASS | Posted as it stands, flagged by name, and the ledger still balances |
| 33 | Twenty periods, two processes | PASS | 20 rows, 20 distinct keys, no lost write |
| 34 | Two processes racing the third free period | PASS | Exactly 3 stored, 5 refused, the check and the write one critical section |
| 35 | Two processes closing the same month | PASS | One close row, carrying 1,638,300 |
| 36 | No sibling store is ever written | PASS | Bytes and mtimes of nine sibling files unchanged across all six tools |
| 37 | The sibling record shapes | PASS | Six `src/store.ts` files grepped for the fields this server reads, plus `DepositApplication.invoice_number`, plus the two stores that still publish no `./lib` |
| 38 | stdout | PASS | Every line across initialize, tools/list, a success and an error parses as JSON-RPC 2.0 |
| 39 | Version identity | PASS | package.json, generated `src/version.ts`, `serverInfo` and all four manifests carry 0.14.0; `sync-versions --check` passes repo-wide |
| 40 | Manifest remotes rule | PASS | `server.mcpb.json` remotes deep-equal `remotes.json` (`/mcp/cash-book`); `server.json`, `server.variant.json` and `server.trial-balance.json` carry none, and the three registry names differ |
| 41 | No tool takes a file path | PASS | Nothing here writes outside its own data directory, including the CSV, which comes back as text |

## Final test summary

    npm run build                          tsc clean, no output
    npm test -w servers/cash-book          # tests 41 / # pass 41 / # fail 0
    npm test -w servers/invoice            # tests 51 / # pass 50 / # fail 0
    npm test                               exit code 0
    node scripts/sync-versions.mjs --check 0 file(s) written
    node scripts/gen-spec.mjs cash-book    tools=8 resources=1 prompts=1 failure_modes=3

41 tests across `unit` (14), `adversarial` (13), `concurrency` (3) and `contract` (11).

## RESULT.md block

    status: DONE
    evidence:
    - npm run build (repo-wide): tsc clean
    - npm test -w servers/cash-book: # tests 41 / # pass 41 / # fail 0
    - npm test -w servers/invoice: # tests 51 / # pass 50 / # fail 0
    - npm test (repo-wide): exit code 0, after SERVER_COUNT 24 -> 25
    - node scripts/sync-versions.mjs --check: 0 file(s) written
    - no network and no stdout write in src, asserted in contract.test.mjs
    - the worked month posts 1,638,300 minor units of debits against 1,638,300 of credits
    - no sibling store file changes bytes or mtime across all six tools
    artifacts:
    - /Users/mike/mcp-servers/servers/cash-book/
    - /Users/mike/mcp-servers/docs/CASH_BOOK_RESULT.md
    cost: 55 wall minutes
    failures:
    - The first cut posted the bank import to cash alongside the documents. On the worked
      month that doubled 99.6 percent of the cash movement and the trial balance still came
      to zero, because every duplicated receipt carried its own contra
    - A deposit application was first posted as a debit to cash, which received the same
      money twice: once when the deposit arrived and once when it was applied
    - A month_close description was 223 characters, three over the 220 ceiling the contract
      suite ratchets
    - An adversarial assertion expected revenue to be absent when the invoice ledger is
      unreadable. A credit note still debits revenue; the assertion was wrong
    insight:
    - Four of the five bank rows in the worked month are money already posted from a
      document. Posting the import as well takes cash from -10,543.00 to -21,111.00 EUR and
      the trial balance still comes to zero
    open:
    - packages/mcp-license/src/index.ts and remote/src/shims/license.ts need SERVER_COUNT
      24 -> 25, which is outside this unit's commit scope. Both are bumped in the working
      tree and neither is committed

## The measured insight, reproduced

The worked month, with the bank rows matched against the posted cash movements:

    {
      "posted_cash_movement": 1380300,
      "cash_balance_minor": -1054300,
      "bank_rows": 5,
      "duplicated_minor": 1375300,
      "duplicated_pct": 99.6,
      "new_information_minor": 7500,
      "naive_union_cash_balance": -2111100
    }

Four of the five bank rows are the same money as a document that was already posted:
1,375,300 of the 1,380,300 minor units of cash movement, 99.6 percent. Posting the bank
import as well as the documents, which is the obvious way to build a cash book and the way
most spreadsheets do it, moves the cash balance from -10,543.00 to -21,111.00 EUR.

The part that makes it dangerous is that the check does not catch it. Every duplicated
receipt arrives with its own contra, so the trial balance still comes to zero, every
individual line is plausible, and the only symptom is an account that is off by nearly a
factor of two in a direction nobody audits. The bank import is the most trustworthy document
in the set and it is the one that must not be posted.

What is left after matching is 7,500 minor units, one unexplained withdrawal. That 0.4
percent is the entire reason to import a statement at all, and it is exactly what a
duplicate-heavy ledger buries.

Built by theluckystrike. https://github.com/theluckystrike
