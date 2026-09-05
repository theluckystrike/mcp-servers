# mcp-billing-docs: build

Date 2026-09-05. Scope: `servers/billing-docs` only, plus this file. Nothing in office-suite,
`scripts/`, the pages, the hosting layer or Stripe was touched; the orchestrator wires those. Zero
paid API calls, zero network: `grep -rEn "fetch|https?://|node:http|node:net|node:dns"
servers/billing-docs/src/` returns nothing. The only URL the server emits is the checkout link inside
the licence gate's upgrade text.

The server is `@theluckystrike/mcp-billing-docs` 0.9.5, 14 tools, one resource, one prompt, built on
`@theluckystrike/mcp-invoice/lib`. It holds no copy of the money, VAT, currency-decimal or
number-formatting code: `computeTotals`, `currencyDecimals`, `formatMoney`, `findClient`,
`getBusiness`, `getClients`, `getInvoices`, `setInvoices`, `hasBusiness`, `isoDate`, `readJsonFile`
and `invoiceLockPath` are imported, and `today` / `isIsoDate` come from
`@theluckystrike/mcp-quotes/lib` rather than being written a second time. It exports its own `./lib`
(the records, the store accessors, `nextDocId`, `lockPath`, `renderDocPdf`, `bodyLines`) for the next
server that needs to read these documents.

## Design decisions worth stating

**A credit note can never exceed the invoice's remaining creditable amount.** Remaining is the
invoice total less everything already credited against it, read from this server's own store. The
check and the write are one critical section under both locks, so two processes cannot each see room
and both take it: ten concurrent EUR 200.00 credits against a EUR 1,107.00 invoice store exactly five
and refuse exactly five (`test/concurrency.test.mjs`).

**Crediting a whole invoice, or a whole invoice line, copies the stored numbers.** This is the
`quote_accept` insight from docs/QUOTES_RESULT.md applied one document further along: the client
agreed to the numbers the invoice printed, and recomputing them from a rounded unit price is how a
document and the credit note that reverses it come to differ by a cent. Only a partial quantity is
recomputed, and then on the invoice's own unit price, tax rate and discount, through `computeTotals`.

**Every money field on a credit note is stored negative, including the unit price.** The quantity
stays positive, so `10 x EUR -90.00 = EUR -900.00` reproduces on a calculator, and a bookkeeper
summing `gross_minor` over a period's documents gets the net of what was billed without knowing which
rows to flip.

**The invoice is not written to.** The invoice engine's `Invoice` record has no `credited_minor`
field (`servers/invoice/src/store.ts`), and adding one would mean two servers writing the same
record, with whichever saved last winning. The link therefore lives on the credit note, and
`credit_note_list {invoice: "INV-2026-0001"}` is the query. The create response says so in one line
rather than leaving it to be discovered. `syncInvoiceCredited` writes the field back only if a future
engine version already carries it, so the two can never disagree by omission.

**Ids are `CN-YYYY-NNNN` and `PO-YYYY-NNNN`.** Same reasoning as `Q-YYYY-NNNN` and `INV-YYYY-NNNN`: a
counter that resets every January collides with last January's document, and the two are different
documents. The counter is written before the row, so a crash burns an id rather than reusing one, and
existing ids are scanned so a restored store cannot reissue one.

**Prices are taken in minor units and a decimal is refused.** `unit_price_minor: 9000` is EUR 90.00
and `150000` is JPY 150,000. Every line is checked to have round-tripped through the engine before
anything is stored.

**Locks: billing-docs first, then invoice**, in every path, the same order `servers/quotes` and
`servers/recurring` use, so no two processes in this repo can deadlock.

## Probes

Harness: `servers/billing-docs/test/_client.mjs` spawns `node servers/billing-docs/dist/index.js` on
a fresh `XDG_DATA_HOME` / `XDG_CONFIG_HOME` and seeds an invoice store directly (spawning the invoice
server to make one would test that server, not this one). Pro runs use `node scripts/sign-license.mjs
billing-docs`. Every row is asserted in `test/{unit,adversarial,corrupt,concurrency,contract}.test.mjs`.

| # | Probe | Result | What happens |
| --- | --- | --- | --- |
| 1 | credit EUR 1,107.01 of a EUR 1,107.00 invoice | PASS | `at most EUR 1107.00 can still be credited; this credit note is for EUR 1107.01. A credit note that gives back more than was billed is a refund, not a credit note. Nothing was stored.` `credit-notes.json` does not exist afterwards |
| 2 | credit the same invoice in full twice | PASS | the second call names what is already credited and refuses; the store still holds exactly one credit note |
| 3 | three partial credits summing to the invoice, then one more cent | PASS | the three are taken, the cent is refused, `credit_note_list` reads EUR -1107.00 |
| 4 | credit 11 units of a line invoiced with 10 | PASS | `was invoiced with a quantity of 10, so 11 cannot be credited` |
| 5 | credit line 4 of a one-line invoice; the same line twice | PASS | `has 1 line(s), so there is no line 4`; `line 1 was given twice. Credit it once, with the total quantity` |
| 6 | `amount_minor` and `lines` together | PASS | refused rather than one silently winning: `pass amount_minor or lines, not both` |
| 7 | `amount_minor: 90.5`, `-100`, no `reason` | PASS | refused at the schema, before any server code runs |
| 8 | credit an invoice number that does not exist | PASS | refused, naming the most recent invoice numbers that do |
| 9 | receive a purchase order twice in full | PASS | `already received in full on 2026-09-03`; a partial receipt first keeps it open and stays on the record |
| 10 | receive dated before the order; delivery date before the order date | PASS | both refused by name; nothing stored |
| 11 | two line currencies on one purchase order | PASS | `more than one currency (EUR, USD)`; nothing stored |
| 12 | ambiguous reference ("Acme" matching two orders) | PASS | `matches more than one purchase order ... Pass the exact id` |
| 13 | corrupt `credit-notes.json` | PASS | moved byte-for-byte to `credit-notes.json.corrupt-<stamp>`, no fresh file written, and `credit_note_list`, `credit_note_get` and `billing_docs_report` all fail afterwards, not only the writes. A corrupt `purchase-orders.json` blocks the orders and leaves the credit notes readable |
| 14 | two processes, one data dir, 40 concurrent `purchase_order_create` | PASS | 40 orders, 40 unique ids, `counter.json` reads `{"PO-2026": 40}` |
| 15 | two processes, ten concurrent EUR 200.00 credits against EUR 1,107.00 | PASS | exactly 5 stored, exactly 5 refused, credited total EUR -1000.00, never past the invoice |
| 16 | free tier | PASS | 5 documents in a calendar month across both kinds, then a refusal naming the count and `https://mcp.zovo.one/buy/billing-docs?src=billing-docs.purchase_order_create`; a document dated in another month is not blocked. Both text exports are free; both PDFs and the report refuse with the Pro text. A key signed for another product does not unlock it |
| 17 | zero-decimal currency | PASS | `JPY -300000`, `JPY -150000` per unit, no decimal point, from the invoice engine's ISO 4217 table |
| 18 | 200-line purchase order | PASS | create 5 ms, PDF 29 ms for a 14,391-byte multi-page A4 with running headers and a `page N of M` footer, store 69,156 bytes |
| 19 | stdout carries JSON-RPC only | PASS | no `console.*` in `src/`; the readiness line goes to stderr. Asserted over `initialize`, `tools/list` and both the success and the error paths, in two suites |
| 20 | version contract | PASS | `package.json`, generated `src/version.ts`, `serverInfo.version` and all four registry manifests agree, the three registry names differ, every manifest description is under 100 characters, and `scripts/sync-versions.mjs --check` passes for the whole repo |

## Free vs Pro, as shipped

| | Free | Pro |
| --- | --- | --- |
| Documents per calendar month | 5, credit notes and purchase orders together | Unlimited |
| `credit_note_text`, `purchase_order_text` | Yes, unlimited | Yes |
| Full, partial and per-line credit notes, VAT, multi-currency, receiving orders | Yes | Yes |
| `credit_note_pdf`, `purchase_order_pdf` | No | Yes, plus the logo and no footer credit |
| `billing_docs_report` | No | Yes |

## Measured insight

Crediting part of a mixed-VAT invoice at one rate is wrong by far more than the rounding anybody
budgets for, and the client can never see it.

An invoice of EUR 1,000.00 consulting at 23% plus EUR 500.00 print at 8% totals EUR 1,770.00. Credit
ten percent of it, EUR 177.00, as a single-rate credit note would: net EUR 143.90, VAT EUR 33.10.
Split across the rates the invoice actually used, in proportion to each rate's share of the total:
net EUR 150.00, VAT EUR 23.00 at 23% and EUR 4.00 at 8%, EUR 27.00 in all.

**The gross is identical either way**, EUR 177.00, so the document the client receives and the
payment that follows are the same under both methods and nothing downstream ever surfaces the error.
The VAT line differs by EUR 6.10, 22.6 percent of it, and that is the number that goes on a VAT
return. Measured with `servers/billing-docs/test/_client.mjs` and asserted in `test/unit.test.mjs`,
"a credit note by amount splits the gross across the invoice's VAT rates and reuses each rate".

The general form, and the reason it is worth a line here: when a wrong answer and a right answer
agree on the figure the counterparty checks, no amount of downstream review finds it. The split has
to be right at the point the document is written.

## Not done here (orchestrator)

- `servers/billing-docs/SPEC.md` was generated by `scripts/gen-spec.mjs` after temporarily adding a
  `CURATED` entry and putting `"billing-docs"` in `SERVERS`. That edit was reverted, because
  `scripts/` is outside this unit's commit scope; the SPEC.md it produced is committed. The entry
  has to be added to `scripts/gen-spec.mjs` for the next regeneration to reproduce the file. Its
  content is the `caps` and `extra` lists visible in the committed SPEC.md's Invariants and Limits
  sections.
- `node scripts/release-check.mjs` will fail for `billing-docs` on `children`, `mcpb-lists`,
  `mirrors`, `pages`, `facts`, `tools`, `product`, `setup` (six ANGLE entries), `compare`, `guide`,
  `gif` and `logo`. All of them are wiring outside `servers/billing-docs/`, listed there rather than
  guessed at here. `server.mcpb.json` carries `fileSha256: "TBD"` until the bundle is built. There is
  no `remotes.json`: the server is not hosted, and nothing here assumes it will be.
