# mcp-statement-of-account: build

Date 2026-09-05. Scope: `servers/statement-of-account` only, plus `scripts/gen-spec.mjs`
(one `CURATED` entry and one name in `SERVERS`), `servers/invoice/src/index.ts`
(`PROFILE_READERS` gains `statement-of-account`, because this server reads the shared
business profile for the bank details a dunning letter prints) and this file. Nothing in
`servers/billing-docs`, `servers/deposits`, `packages/mcp-license`, `remote/`, the pages,
the bundles or the hosting layer was touched; the orchestrator wires those. Zero paid API
calls, zero network:
`grep -rEn "fetch\(|https?://|node:http|node:net|node:dns" servers/statement-of-account/src/`
returns only the checkout host in the licensing copy, and the contract suite asserts that.

The server is `@theluckystrike/mcp-statement-of-account` 0.13.0, 6 tools plus the two
license tools, one resource and one prompt. It holds no copy of the money arithmetic
(`formatMoney` from `@theluckystrike/mcp-invoice/lib`), no copy of the page renderer
(`renderDocPdf` from `@theluckystrike/mcp-billing-docs/lib`), no copy of the deposit
movement arithmetic (`movements` from `@theluckystrike/mcp-deposits/lib`), no copy of the
corrupt-store quarantine (`readJsonFile`, again from the invoice engine) and no copy of the
licensing or locking code. It exports its own `./lib` (the client resolution, the payment
reconstruction, the movement ledger, the balance identity and the aging buckets) for the
next server that needs to state an account.

## Design decisions worth stating

**This server writes into no book it reports on.** It reads three stores -- the invoice
ledger, the credit note store and the deposit store -- and writes exactly one file of its
own, a register of the statements that were built. No balance is ever read back out of that
register. A statement of account is a view over books other servers own, and a second copy
of a balance is a second number to be wrong. The contract suite asserts the bytes AND the
mtimes of five sibling files are unchanged across all six tools, including the PDF path.

**A sibling store that is unreadable is never read as an empty one.** The common case on a
real machine is that the user runs `mcp-invoice` and has never installed `mcp-deposits`:
that statement is correct, it simply has no deposit line, and it says `read: true, rows: 0`.
A store that is on disk and did not parse is a different thing: money exists that could not
be read, so the answer carries `read: false` with the error and a sentence naming which
figure is therefore incomplete. Turning a balance that could not be computed into a balance
of nothing owed is the one failure that would be invisible in the answer and expensive in
the world. The invoice ledger is the exception to "never fatal": with no invoices there is
no statement, so a corrupt `invoices.json` refuses all six tools by name.

**`paid_minor` is the authority and `payments[]` is only the attribution.** The two do not
have to agree, and on a real machine they routinely do not: `invoice_mark_paid` writes
both, `deposit_apply` in `servers/deposits` raises `paid_minor` and appends NOTHING to
`payments[]` (the movement lives on the deposit as a `DepositApplication`), and an invoice
created before that field existed carries a `paid_minor` and a single `paid_date` and no
rows at all. The payment rows are assembled as every `payments[]` row, plus every deposit
application naming the invoice, plus one residual row at `paid_date` for whatever
`paid_minor` still exceeds those two, so they sum to `paid_minor` exactly and the closing
balance reconciles to `total_minor - paid_minor` per invoice. Reconstructing receipts from
`payments[]` alone would have lost 300.00 of the worked month's 900.00 of receipts, a third
of the cash, with no error anywhere.

**When the two books disagree, nothing is scaled and nothing is dropped silently.** If the
attribution sums to MORE than `paid_minor`, the whole attribution is discarded, one row for
`paid_minor` is shown at `paid_date`, and the disagreement comes back as a note naming the
invoice and the difference. Probe 7 seeds exactly that: a deposit book claiming 800.00 went
to an invoice that records 300.00 paid.

**A deposit applied is money that moves once.** `deposit_apply` already put that money on
the invoice as `paid_minor`, so `payments_received` contains it and
`of_which_deposits_applied` breaks it out. It is a breakdown, not a fourth column. The
first cut of this server had it as a fourth column and paid every deposited invoice twice;
the worked month is the test that caught it. Deposit money still HELD is a memo line and is
never in the balance: it is the client's money until it is applied.

**Aging is as at the date asked for, in both directions.** An invoice issued after the date
is not on the books, a payment made after it has not happened, and a credit note issued
after it has not been given. See the measured insight below; this is the single decision
that changes the most numbers.

**Due today is not overdue.** An invoice enters the 0-30 bucket on the first day past its
due date, so the bucket holds days one to thirty and day zero sits in `not_yet_due`, which
is reported beside the four buckets rather than inside them or hidden. The brief asked for
four buckets and there are exactly four; what is outstanding and not yet due is real money
and is shown, but it is not aged, because it is not late.

**A credit note reduces the invoice it names and no other.** An open balance floors at zero
and the excess is reported as `unapplied_credit`. Quietly letting a 1,500.00 credit note on
a paid invoice cancel an unrelated 400.00 invoice would be inventing an agreement the
client never made. The statement, which is a balance rather than an aging, does carry the
whole credit, so a client who is owed money sees a negative closing balance and the text
says "is in your favour".

**Currencies are never added together.** One statement is one currency and a client billed
in two is asked which; `statement_aging` and `statements_report` total per currency. There
is no exchange rate in this server, so there is no rate to be silently wrong.

**A dunning letter escalates in tone and never in figures.** The amounts, the invoice list
and the bank details are identical at all three levels, because a chase whose numbers
escalate was wrong at level one. No level states a late fee, an interest rate or a legal
cost: this server holds no contract terms, no statutory rate and no jurisdiction, and the
one place never to put an invented number is a demand for money. Bank details print only
when the shared profile actually carries them, and when it does not the answer says the
letter asks for payment without saying where to send it. A chaser for a client with nothing
past due is refused, and the refusal names what is outstanding but not yet due.

**The free cap is on the DOCUMENT, not on the question.** `statement_aging` is free and
unlimited on every tier: "who owes me money" is the question this server exists for, and a
free tier that hides it is a demo. Five distinct statements a calendar month are metered by
client, period and currency, so rebuilding one already in the register is free forever, on
every tier and in all three renderings.

**Ids are `STMT-YYYY-NNNN`.** Same reasoning as `INV-`, `CN-`, `DEP-` and `ASSET-`: the
counter is written before the record, so a crash burns an id rather than reusing one, and
existing ids are scanned so a restored register cannot reissue a number that is already on
a statement in a client's inbox.

## The worked month

`test/_client.mjs` seeds one client, Acme Ltd, in EUR, and the statement period is
2026-06-01 to 2026-06-30. Every figure the unit suite asserts is recomputed by hand from
these rows:

| when | document | effect |
| --- | --- | --- |
| 2026-04-10 | `INV-2026-0001` issued, due 2026-05-10 | +1,000.00 |
| 2026-05-02 | payment row on `INV-2026-0001` | -400.00 |
| 2026-05-20 | `CN-2026-0001` against `INV-2026-0001` | -100.00 |
| | **opening balance at 2026-06-01** | **500.00** |
| 2026-06-05 | `INV-2026-0002` issued, due 2026-07-05 | +2,000.00 |
| 2026-06-12 | payment row on `INV-2026-0001` | -600.00 |
| 2026-06-18 | `DEP-2026-0001` applied 300.00 to `INV-2026-0002` | -300.00 |
| 2026-06-20 | `INV-2026-0003` issued, due 2026-06-25 | +750.00 |
| 2026-06-28 | `CN-2026-0002` against `INV-2026-0003` | -50.00 |
| | **closing balance at 2026-06-30** | **2,300.00** |

Aged at 2026-06-30 the same books give 700.00 in the 0-30 bucket (`INV-2026-0003`, 5 days
late), 1,700.00 not yet due (`INV-2026-0002`), and 100.00 of unapplied credit, because
`INV-2026-0001` was paid in full and then credited. Outstanding less that unapplied credit
is 2,300.00: the aging and the statement close at the same place from two different paths.

## Probes

Harness: `servers/statement-of-account/test/_client.mjs` spawns `node
servers/statement-of-account/dist/index.js` on a fresh `XDG_DATA_HOME` /
`XDG_CONFIG_HOME` and seeds the three sibling stores directly, in the record shapes their
own `src/store.ts` files declare. Spawning `mcp-invoice` to create an invoice would test
`mcp-invoice`; what has to be pinned down here is what THIS server computes from a given
set of rows. A contract test greps those three sibling sources for the nine fields this
server depends on, so a rename over there fails here instead of silently zeroing a figure.
Pro runs use `node scripts/sign-license.mjs statement-of-account`. Every row below is
asserted in `test/{unit,adversarial,corrupt,concurrency,contract}.test.mjs`.

| # | Probe | Result | What happens |
| --- | --- | --- | --- |
| 1 | The worked month | PASS | Opening 500.00, invoiced 2,750.00, received 900.00, credited 50.00, closing 2,300.00, and the printed strings match the minor units |
| 2 | The movement rows sum to the balance | PASS | Five rows in date order, each naming its document, and opening plus their sum equals the closing balance |
| 3 | The opening balance is a computation, not a stored figure | PASS | The same books from 2000-01-01 open at zero and close at 2,300.00; starting one day later moves exactly the 2026-06-05 invoice into the opening balance |
| 4 | A deposit applied moves once | PASS | 300.00 of the 900.00 received came from the deposit, broken out and not added again; 200.00 still held is a memo and not in the balance |
| 5 | An invoice paid with no payment row, and one paid with a partial row | PASS | Three payment rows across two invoices, summing to `paid_minor` exactly, the residual dated at `paid_date` and labelled as recorded on the invoice |
| 6 | Aging at 2026-06-30 | PASS | 700.00 in 0-30, nothing in the other three, 1,700.00 not yet due, 100.00 unapplied credit, and outstanding less that credit is the statement's closing balance |
| 7 | Aging as at a past date | PASS | At 2026-06-10 the 600.00 payment of 2026-06-12 has not happened and 500.00 of `INV-2026-0001` is 31 days late |
| 8 | The bucket boundaries | PASS | Due dates sitting exactly 0, 30, 31, 61 and 91 days back land in not-yet-due, 0-30, 31-60, 61-90 and over 90 |
| 9 | `statement_text` | PASS | Greeting, period line, every movement, both balances, the deposits-applied breakdown, the held-deposit memo and the profile's sign-off |
| 10 | Dunning at all three levels | PASS | Identical figures and bank details at every level, only the tone and the deadline move; no fee, interest or cost anywhere |
| 11 | `statements_report` | PASS | One total per currency, two clients, the oldest overdue invoice named across the whole book |
| 12 | Clients ordered by overdue, not by balance | PASS | A 100,000.00 balance that is not yet due ranks below a 100.00 balance that is late |
| 13 | `statement_pdf` | PASS | `%PDF` magic bytes, the statement id as the document number, the closing balance returned |
| 14 | The register | PASS | One row per distinct statement; rebuilding the same one updates it and keeps the id |
| 15 | An unknown client | PASS | Refused with every client that does appear on a document; with no books at all the refusal says so instead of printing an empty list |
| 16 | An ambiguous client name | PASS | "acme" against Acme Ltd and Acme Holdings is refused with both, never resolved to the first |
| 17 | An empty period | PASS | Answers with the balance carried, zero movements, opening equal to closing. Not an error |
| 18 | Mixed currencies | PASS | Refused until a currency is named; EUR and USD state separately; aging and the report keep them apart and no line anywhere holds the sum |
| 19 | A credit exceeding the paid invoice it reverses | PASS | 1,500.00 credited against a paid 1,000.00 invoice becomes unapplied credit, does not cancel the unrelated 400.00 invoice, and the statement closes at -1,100.00 with "in your favour" |
| 20 | The invoice book and the deposit book disagreeing | PASS | `paid_minor` wins, the attribution is discarded, and the note names the invoice and the difference |
| 21 | A period that runs backwards, and dates that are not dates | PASS | 2026-02-30, 30-06-2026 and "yesterday" all refused by name |
| 22 | A chaser with nothing overdue | PASS | Refused, naming what is outstanding but not yet due |
| 23 | A chaser with no bank details | PASS | No IBAN is printed and the answer says the letter asks for payment without saying where to send it |
| 24 | Dunning tiers | PASS | Levels 1 and 2 free, level 3 Pro, levels 0 and 4 rejected at the schema |
| 25 | The free cap | PASS | Five statements, the sixth refused with the tool name and the price, rebuilds of the five still free, aging never metered |
| 26 | Pro key for another product | PASS | A key signed for `deposits` unlocks nothing here |
| 27 | Missing sibling stores | PASS | Invoice ledger alone builds a correct statement with no notes and `rows: 0` on the other two |
| 28 | A deposit and no invoice | PASS | States at a zero balance with the held deposit as a memo |
| 29 | Corrupt credit note store | PASS | The statement is still built, the balance is too high by exactly the two credit notes, the note says so, and the file is quarantined byte for byte |
| 30 | Corrupt deposit store | PASS | The balance is unchanged, because the applied money is on the invoice; what is lost is the label, and the note says that |
| 31 | Corrupt invoice store | PASS | All six tools refuse, each naming itself and the store, rather than answering that nothing is owed |
| 32 | Corrupt statement register | PASS | Building is blocked; aging still answers, because it never touches the register |
| 33 | Corrupt shared profile | PASS | The statement still renders, with the placeholder issuer and no leaked business name |
| 34 | Twenty statements, two processes | PASS | 20 rows, 20 unique ids, counter at exactly 20 |
| 35 | Two processes racing the fifth free statement | PASS | Exactly 5 stored, 11 refused, the check and the write one critical section |
| 36 | Two processes building the SAME statement | PASS | One row, one id, both callers told the same one |
| 37 | No sibling store is ever written | PASS | Bytes and mtimes of five sibling files unchanged across all six tools, including the PDF path |
| 38 | The sibling record shapes | PASS | Nine fields greppped out of the three sibling `src/store.ts` files, plus `DepositApplication.invoice_number`, the only join between the deposit book and the invoice ledger |
| 39 | stdout | PASS | Every line across initialize, tools/list, a success and an error parses as JSON-RPC 2.0 |
| 40 | Version identity | PASS | package.json, generated `src/version.ts`, `serverInfo` and all four manifests carry 0.13.0; `sync-versions --check` passes repo-wide |
| 41 | Manifest remotes rule | PASS | `server.mcpb.json` remotes deep-equal `remotes.json` (`/mcp/statement-of-account`); `server.json`, `server.variant.json` and `server.dunning.json` carry none, and the three registry names differ |

## Final test summary

    npm run build                                   tsc clean, no output
    npm test -w servers/statement-of-account        # tests 47 / # pass 47 / # fail 0
    npm test -w servers/invoice                     # tests 49 / # pass 48 / # fail 0
    npm test                                        exit code 0
    node scripts/sync-versions.mjs --check          0 file(s) written
    node scripts/gen-spec.mjs statement-of-account  tools=8 resources=1 prompts=1 failure_modes=9

47 tests across `unit` (14), `adversarial` (15), `corrupt` (5), `concurrency` (3) and
`contract` (10).

## RESULT.md block

    status: DONE
    evidence:
    - npm run build (repo-wide): tsc clean
    - npm test -w servers/statement-of-account: # tests 47 / # pass 47 / # fail 0
    - npm test -w servers/invoice: # tests 49 / # pass 48 / # fail 0
    - npm test (repo-wide): exit code 0
    - node scripts/sync-versions.mjs --check: 0 file(s) written
    - no network and no stdout write in src, asserted in contract.test.mjs
    - the worked month closes at 2,300.00 EUR, recomputed by hand from four invoices, two
      credit notes and one deposit application
    - no sibling store file changes bytes or mtime across all six tools
    artifacts:
    - /Users/mike/mcp-servers/servers/statement-of-account/
    - /Users/mike/mcp-servers/docs/STATEMENT_RESULT.md
    cost: 50 wall minutes
    failures:
    - The first design counted a deposit application as a fourth credit column beside
      payments received. It is not: deposit_apply raises the invoice's paid_minor, so the
      money was already there and the closing balance paid every deposited invoice twice
    - Four unit assertions were written against "2300.00 EUR" and the shared formatMoney
      emits "EUR 2300.00". The tests were wrong, not the formatter
    - A bucket-boundary test asserted 1 day and 30 days into different buckets. 30 days is
      the last day of the 0-30 bucket; the due dates were moved onto 0, 30, 31, 61 and 91
    - An aging test expected 2,000.00 outstanding at 2026-06-10 and got 2,500.00, because
      the test author forgot that a payment dated 2026-06-12 has not happened on 2026-06-10
    - The contract suite's grep for network calls threw instead of passing, because grep
      exits 1 when it finds nothing, which is the passing case
    insight:
    - Aging a past date with today's payment figures does not go slightly wrong, it goes
      silently empty. Measured on the worked month at 2026-06-10: the as-at rule reports
      2,500.00 outstanding of which 500.00 is 31 days late; the ordinary "subtract
      paid_minor, bucket by due date" rule reports 1,700.00 outstanding and ZERO overdue,
      because a payment that arrived two days after the aging date has already been
      subtracted. A third of the balance and all of the overdue disappear, the buckets
      still add up, and the answer cannot be reproduced next month because the input keeps
      moving. The dated subtraction is the part nobody writes a test for, and it is the
      only part that decides who gets chased

## The measured insight, reproduced

    node /tmp/naive.mjs        # aging the worked month at 2026-06-10, two rules
    {
      "as_of": "2026-06-10",
      "as_at_rule": { "outstanding": 250000, "overdue": 50000 },
      "naive_rule":  { "outstanding": 170000, "overdue": 0 }
    }

The naive rule is the one almost every aging report is written as: take each invoice,
subtract `paid_minor`, subtract the credit notes, bucket by the due date. It understates
what was owed on 2026-06-10 by 800.00 of 2,500.00 and reports nothing overdue on a date
when 500.00 was 31 days late, because the subtraction is the step nobody dates. The
`as_at_rule` figures are asserted in `test/unit.test.mjs`.

Built by theluckystrike. https://github.com/theluckystrike
