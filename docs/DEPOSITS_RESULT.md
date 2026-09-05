# mcp-deposits: build

Date 2026-09-05. Scope: `servers/deposits` only, plus `scripts/gen-spec.mjs` (one `CURATED`
entry and one name in `SERVERS`) and this file. Nothing in `servers/invoice`,
`servers/billing-docs`, `remote/`, the pages, the bundles or the hosting layer was touched;
the orchestrator wires those. Zero paid API calls, zero network:
`grep -rEn "fetch|https?://|node:http|node:net|node:dns" servers/deposits/src/` returns only
the checkout link inside the licence gate's upgrade text.

The server is `@theluckystrike/mcp-deposits` 0.10.0, 10 tools, one resource, one prompt. It
holds no copy of the money, currency-decimal, formatting, client or store code:
`currencyDecimals`, `formatMoney`, `findClient`, `getBusiness`, `getInvoices`, `setInvoices`,
`hasBusiness`, `invoiceLockPath`, `isoDate` and `readJsonFile` come from
`@theluckystrike/mcp-invoice/lib`, `today` / `isIsoDate` from `@theluckystrike/mcp-quotes/lib`,
and the A4 page from `@theluckystrike/mcp-billing-docs/lib` (`renderDocPdf`). It exports its own
`./lib` (the records, the store accessors, `movements`, `statusOf`, `nextDepositId`, `lockPath`)
for the next server that needs to read these deposits.

## Design decisions worth stating

**The invoice engine exports no payment function, so the payment is written the way the invoice
server's own tool writes it.** `servers/invoice/src/lib.ts` re-exports `getInvoices` and
`setInvoices` and nothing that records a payment. `invoice_mark_paid` in
`servers/invoice/src/index.ts` sets three fields under the invoice lock -- `paid_minor`,
`paid_date`, `status` (`paid` when `paid_minor >= total_minor`, `partial` above zero, else
`unpaid`) -- and `deposit_apply` sets the same three, on the same record, under the same lock.

**With one deliberate difference: `invoice_mark_paid` SETS `paid_minor`, `deposit_apply` ADDS to
it.** That is the measured insight below. A deposit is normally not the first money on an
invoice, and assignment would delete whatever arrived first.

**A deposit pays out at most what it still holds**, held being received less everything already
applied and everything already refunded, and never more than the invoice's own open balance
(`total_minor - paid_minor`). Both checks and the write are one critical section under both
locks, so two processes cannot each see room and both take it: ten concurrent EUR 200.00
applications against a EUR 500.00 deposit store exactly two and refuse exactly eight
(`test/concurrency.test.mjs`).

**A deposit is applied at its own currency and never converted.** A EUR deposit against a USD
invoice is refused by name, with the two currencies in the message and the way out (refund it
and record it again in the invoice's currency). There is no exchange rate anywhere in this
server, so there is no rate to be silently wrong.

**The stored `status` is derived from the movements every time one is written**, never taken
from the caller: `held` while anything is still held, otherwise `applied` if any of it went to
an invoice and `refunded` if it all went back. A stored status that disagrees with the movement
list is how a deposit comes to look returned while the money is still on the books.

**A refund does not touch the invoice server.** Giving a client their own money back is not a
payment of a bill, and writing it as one would show an invoice paid that nobody paid.

**One statement is in one currency.** A client holding EUR and USD has two balances; adding them
would be a made-up number, so the currency is asked for rather than guessed, with both named.

**Ids are `DEP-YYYY-NNNN`.** Same reasoning as `INV-YYYY-NNNN` and `CN-YYYY-NNNN`: a counter that
resets every January collides with last January's receipt. The counter is written before the row,
so a crash burns an id rather than reusing one, and existing ids are scanned so a restored store
cannot reissue one.

**Amounts are taken in minor units and a decimal is refused** at the schema: `50000` is EUR
500.00 and `50000` is JPY 50,000, with the decimal count from the invoice engine's ISO 4217 table.

**Locks: deposits first, then invoice**, in every path, the same order `servers/billing-docs`,
`servers/quotes` and `servers/recurring` use, so no two processes in this repo can deadlock.

**The free cap is on recording new deposits only.** Applying, refunding, listing, balances and
the text statement are free and unlimited on every tier: a cap that trapped a client's deposit
would be a limit on their money rather than on the user's usage.

## Probes

Harness: `servers/deposits/test/_client.mjs` spawns `node servers/deposits/dist/index.js` on a
fresh `XDG_DATA_HOME` / `XDG_CONFIG_HOME` and seeds an invoice store directly (spawning the
invoice server to make one would test that server, not this one). Pro runs use
`node scripts/sign-license.mjs deposits`. Every row is asserted in
`test/{unit,adversarial,corrupt,concurrency,contract}.test.mjs`.

| # | Probe | Result | What happens |
| --- | --- | --- | --- |
| 1 | apply EUR 500.01 of a EUR 500.00 deposit | PASS | `holds EUR 500.00 and this would apply EUR 500.01 ... Nothing was changed`; no application row, `paid_minor` still 0 |
| 2 | apply EUR 200.00 more after EUR 400.00 of EUR 500.00 is applied | PASS | refused naming the EUR 100.00 left; the store keeps one application and the invoice keeps 40000 |
| 3 | apply EUR 200.00 to an invoice that owes EUR 100.00 | PASS | `still owes EUR 100.00 and this would apply EUR 200.00 ... would show the invoice overpaid and leave the difference owed to the client twice` |
| 4 | apply to an invoice already paid in full | PASS | `already paid in full: EUR 100.00 of EUR 100.00 received`; the paid invoice is untouched |
| 5 | apply a EUR deposit to a USD invoice | PASS | `held in EUR and INV-2026-0001 is in USD ... never converted here`; nothing written on either side |
| 6 | apply from a deposit that is fully refunded | PASS | `has nothing left held`; `paid_minor` still 0 |
| 7 | refund EUR 500.01 of EUR 500.00, and EUR 250.00 after EUR 300.00 was applied | PASS | both refused; the second names the EUR 200.00 held and that the rest is `already applied to an invoice` |
| 8 | refund from a deposit with nothing held | PASS | names received, applied and refunded in the refusal; one refund row, not two |
| 9 | `amount_minor` of `90.5`, `0`, `-100` | PASS | refused at the schema, before any server code runs; `deposits.json` is never created |
| 10 | unknown invoice, unknown deposit, ambiguous client name | PASS | the first names the invoice numbers that do exist; the third is `matches more than one deposit ... Pass the exact id` and refunds nothing |
| 11 | a movement dated before the deposit arrived; `2026-02-30` | PASS | `before DEP-2026-0001 was received on 2026-09-10`, both on apply and on refund; the impossible date is `not a real date` |
| 12 | statement for a client holding EUR and USD | PASS | `deposits in EUR and USD ... pass currency to choose`; with `currency: "EUR"` the USD deposit does not appear on the page |
| 13 | corrupt `deposits.json` | PASS | moved byte-for-byte to `deposits.json.corrupt-<stamp>`, no fresh file written, and `deposit_list`, `deposit_balance`, `deposit_apply`, `deposit_refund`, `deposit_statement_text` and `deposits_report` all fail afterwards, not only the writes. A corrupt `counter.json` blocks the write and leaves the deposits readable |
| 14 | two processes, one data dir, 40 concurrent `deposit_record` | PASS | 40 rows, 40 unique ids, `counter.json` reads `{"DEP-2026": 40}` |
| 15 | two processes, ten concurrent EUR 200.00 applications against EUR 500.00 | PASS | exactly 2 stored, exactly 8 refused, applied EUR 400.00, invoice `paid_minor` 40000, never past what was held |
| 16 | free tier | PASS | 5 deposits in a calendar month, then a refusal naming the count and `https://mcp.zovo.one/buy/deposits?src=deposits.deposit_record`; a deposit received in another month is not blocked, and apply, refund and the text statement all still work. The PDF and the report refuse with the Pro text and write no file. A key signed for another product does not unlock them |
| 17 | zero-decimal currency | PASS | `JPY 150000` held, no decimal point, from the invoice engine's ISO 4217 table |
| 18 | 200 deposits on one client, Pro | PASS | `deposit_record` 0.8 ms each, `deposit_balance` 1 ms, `deposits_report` 1 ms, `deposit_statement_text` 1 ms (14,975 chars), `deposit_statement_pdf` 37 ms for a 19,034-byte multi-page A4, store 76,602 bytes |
| 19 | stdout carries JSON-RPC only | PASS | no `console.*` in `src/`; the readiness line goes to stderr. Asserted over `initialize`, `tools/list` and both the success and the error paths |
| 20 | version contract | PASS | `package.json`, generated `src/version.ts`, `serverInfo.version` and all four manifests agree, the three registry names differ, every manifest description is under 100 characters, every package entry is stdio with no `remotes` block, and `scripts/sync-versions.mjs --check` passes for the whole repo |

## Free vs Pro, as shipped

| | Free | Pro |
| --- | --- | --- |
| Deposits recorded per calendar month | 5, by received date | Unlimited |
| `deposit_apply`, `deposit_refund`, `deposit_list`, `deposit_balance` | Yes, unlimited | Yes |
| `deposit_statement_text` | Yes, unlimited | Yes |
| `deposit_statement_pdf` | No | Yes, plus the logo and no footer credit |
| `deposits_report` | No | Yes |

## Measured insight

The invoice server's own payment tool overwrites, so a deposit routed through it deletes the
payment that came before.

Measured against `servers/invoice/dist/index.js` on a EUR 1,000.00 invoice: `invoice_mark_paid
{amount: 200}` for a bank transfer reports "balance due EUR 800.00", then `invoice_mark_paid
{amount: 300}` for the deposit reports "balance due EUR 700.00" and leaves `paid_minor` at
`30000`. The EUR 200.00 that actually arrived is gone from the record. Nothing errors, nothing
warns, and the number that is wrong is the one the client gets chased for.

`deposit_apply` writes the same three fields on the same record -- there is no `recordPayment`
to call -- but adds to `paid_minor` instead of assigning it: the same two payments leave
`paid_minor` at `50000` and EUR 500.00 due. Asserted in `test/unit.test.mjs`, "a second
application ADDS to paid_minor, it does not replace it".

The general form, and the reason it is worth a line here: when two servers share a store, the
field names matching is not the contract. The arithmetic on them is, and it is only visible by
reading the owning server's write path. A schema-level review of this change would have passed
the assignment version.

## Not done here (orchestrator)

- Not wired, not hosted, not released. `server.mcpb.json` carries `fileSha256: "TBD"` until the
  bundle is built, and no manifest carries a `remotes` block: the server is not hosted and
  nothing here assumes it will be. There is no `remotes.json`.
- `node scripts/release-check.mjs` will fail for `deposits` on the wiring outside
  `servers/deposits/`: the bundle, the mirrors, the pages, the facts and tool lists, the product
  and setup entries, the comparison and guide pages, the demo gif and the logo.
- The README has no demo gif line, because `assets/demo-deposits.gif` does not exist yet.
