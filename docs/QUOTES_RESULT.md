# mcp-quotes: build and adversarial audit

Date 2026-09-04. Scope: `servers/quotes` only (src, test, docs, manifests) plus this file. Nothing in
office-suite, `scripts/validate.mjs`, the pages, the hosting layer or Stripe was touched; the orchestrator wires
those. Zero paid API calls, zero network: `grep -rEn "fetch|https?://|node:http|node:net|node:dns"
servers/quotes/src/` returns nothing at all. The only URL the server ever emits is the checkout link inside the
licence gate's upgrade text.

The server is `@theluckystrike/mcp-quotes` 0.6.1, 11 tools, one resource, one prompt, built on
`@theluckystrike/mcp-invoice/lib`. It holds no copy of the money, VAT, currency-decimal or number-formatting
code: `computeTotals`, `currencyDecimals`, `formatMoney`, `addDays`, `daysBetween`, `isoDate`, `findClient`,
`getClients`, `setClients`, `getInvoices`, `setInvoices`, `getBusiness`, `hasBusiness`, `nextNumber`,
`readJsonFile` and `invoiceLockPath` are all imported. It exports its own `./lib` (the `Quote` record, the store
accessors, `nextQuoteId`, `lockPath`, `renderQuotePdf`, and the timezone-aware `today`) for the next server that
needs to read quotes.

## Design decisions worth stating

**Ids are `Q-YYYY-NNNN`, not `Q-NNNN`.** The brief said "ids like Q-0001 per year". A four-digit id whose
counter resets every January collides across years: 2026's `Q-0001` and 2027's `Q-0001` are two different
documents, both sent to clients, and no later lookup can separate them. The year is in the id and the counter is
keyed `Q-<year>`, exactly as the invoice engine numbers `INV-YYYY-NNNN`.

**Accepting copies, it never recomputes.** See the measured insight at the end.

**`quote_accept` creates the invoice directly when the invoice store is present.** "Present" is defined as
`invoices.json` OR `clients.json` existing in `${XDG_DATA_HOME}/mcp-servers/invoice/`, OR a shared business
profile with a name (`servers/quotes/src/store.ts`, `invoiceStorePresent()`). `create_invoice` overrides it:
`"always"` creates regardless, `"never"` only marks the quote accepted. When no invoice is created the response
carries `invoice_create_args`, ready to forward to the invoice server's `invoice_create`, with unit prices
converted back to major units. This is documented in the tool description, in the README and in the response
itself.

**Accepting bypasses the invoice server's own free cap.** The invoice is written through the shared engine, the
same path `servers/recurring` uses, so `FREE_INVOICES_PER_MONTH` (enforced in that server's tool handler, not in
the engine) does not apply. The quotes free cap is the one in force. The accept response says this in one line
rather than leaving it to be discovered.

**Prices are taken in minor units and a decimal is refused.** `unit_price_minor: 9000` is EUR 90.00 and
`150000` is JPY 150,000. `computeTotals` takes major units, so the value is divided by `10^decimals` on the way
in and every line is checked to have round-tripped to the same integer before anything is stored.

---

## Part 1 - adversarial probes

Harness: `servers/quotes/test/harness.mjs` spawns `node servers/quotes/dist/index.js` on a fresh
`XDG_DATA_HOME`/`XDG_CONFIG_HOME`, writes JSON-RPC lines to stdin and records every stdout line. Pro runs use
`node scripts/sign-license.mjs quotes`. Every row below is asserted in
`servers/quotes/test/{adversarial,corrupt,concurrency,smoke,contract}.test.mjs`, except rows 15 and 16.

| # | Probe | Result | What happens |
| --- | --- | --- | --- |
| 1 | `quote_create` with no arguments | PASS | zod: `Required at client`, `Required at items` |
| 2 | `quote_create {client: "A"}`, no items | PASS | `Required at items`; `items: []` gives `a quote needs at least one line item` |
| 3 | negative quantity (`-3`) and zero quantity | PASS | `quantity must be greater than zero at items[0].quantity`. Nothing written: `quotes.json` does not exist afterwards |
| 4 | `unit_price_minor: 90.5` | PASS | `unit_price_minor must be a whole number of minor units (cents), e.g. 9000 for 90.00 EUR`. A decimal price is the one input error that would silently bill a hundredth of the amount |
| 5 | `unit_price_minor: -1`, empty description | PASS | `cannot be negative`, `every line needs a description` |
| 6 | huge totals: `quantity 1e9 x unit_price_minor 1e12` | PASS | refused with `that quote totals more than can be represented exactly in minor units. Nothing was stored.` The per-field cap (`1e12`) catches the larger inputs before that |
| 7 | 201 line items | PASS | `a quote can carry at most 200 line items` |
| 8 | two currencies across lines (EUR + USD) | PASS | `the line items carry more than one currency (EUR, USD). A quote is issued in ONE currency ...`; nothing stored |
| 9 | quote currency EUR, line currency USD | PASS | `the quote currency is EUR but a line item says USD.` A single agreed line currency with no quote currency becomes the quote's (`usd` -> `USD 100.00`) |
| 10 | `issue_date: "2026-02-30"`, `valid_until: "not-a-date"`, `valid_until` before `issue_date` | PASS | each refused by name: `is not a real date in YYYY-MM-DD form`, `is before the quote date` |
| 11 | accept the same quote twice | PASS | second call: `Q-2026-0001 was already accepted on <date> and invoiced as INV-2026-0001. Accepting it again would issue a second invoice for the same work, so nothing was done.` `invoices.json` still holds exactly one invoice |
| 12 | edit or decline an accepted quote | PASS | `quote_update` refuses (`closed document ... is not edited`), `quote_decline` refuses and names the invoice. Declining an already-declined quote is refused too |
| 13 | accept an expired quote | PASS | refused: `was valid until <date> and today is <date>, so it has lapsed by 59 day(s)` (a quote dated 60 days ago, valid for one day), naming both fixes (`quote_update {id, valid_until}` or `allow_expired: true`). Both routes then accept |
| 14 | do expired quotes block the free tier? | PASS | no. Six lapsed quotes plus one live one still leave four of the five open slots free; the cap counts state `open` only |
| 15 | `quote_pdf {out_path: "../../../../etc/passwd"}` | UNMEASURABLE HERE | not a server behaviour: under the macOS sandbox this session runs in, a raw `createWriteStream("/etc/passwd")` emits neither `open` nor `error` within 5 s, so the call times out with no response at all. Measured directly, outside the tool, before blaming the server |
| 16 | `quote_pdf` to a directory (`out_path: <a dir>`) | PASS | the measurable neighbour of 15: `Error: EISDIR: illegal operation on a directory`, and the next `quote_list` on the same session answers normally. No sandboxing of the path is attempted; the caller names the file, as in `expense_export` and `statement_export` |
| 17 | ambiguous client reference (`"Acme"` matching two quotes) | PASS | `"Acme" matches more than one quote: Q-2026-0001 (Acme Ltd, open), Q-2026-0002 (Acme Digital, open). Pass the exact quote id.` An unknown id gives `no quote matches "..."` |
| 18 | corrupt `quotes.json` | PASS | moved byte-for-byte to `quotes.json.corrupt-<stamp>`, a `.corrupt` marker written, no fresh `quotes.json` created, and `quote_list` / `quote_get` / `quote_accept` all fail afterwards, not only the writes |
| 19 | `counter.json` reset to `{}` (a restored backup) | PASS | ids already in the store are skipped, so `Q-2026-0001` is not reissued |
| 20 | two processes, one data dir, 40 concurrent `quote_create` | PASS | 40 quotes, 40 unique ids, `counter.json` reads `{"Q-2026": 40}`. The failure this catches is a reissued id, not a lost row |
| 21 | stdout carries JSON-RPC only | PASS | no `console.*` in `src/`; the only stdout writer is the transport, the readiness line goes to stderr. Asserted over `initialize`, `tools/list` and both the success and the error paths in two suites |
| 22 | VAT default changes between issuing and accepting | PASS after the design decision below | the invoice carries the quoted EUR 1,230.00 and `tax_lines[0].rate === 23`, not the profile's new 8% |
| 23 | free-tier gating | PASS | 5 open quotes, then a refusal naming the count and `https://mcp.zovo.one/buy/quotes`; `quote_send_text` is free on every quote; `quote_pdf` and `quote_report` refuse with the Pro text. A key signed for another product does not unlock it |
| 24 | 200-line quote | PASS | `quote_create` 8 ms, `quote_pdf` 47 ms for a 21,213-byte multi-page PDF with running headers and a `page N of M` footer, `quotes.json` 79,106 bytes |
| 25 | zero-decimal currency | PASS | `JPY 150000 x 2 = JPY 300000`, formatted with no decimal point, from the invoice engine's ISO 4217 table |

### The one code change the probes caused

**Stream-error listener ordering in `src/pdf.ts` (hardening, not a measured defect).** Probe 15's hang sent me
looking at the write path. The renderer used to attach its `finish`/`error` listeners after `doc.end()`.
Measured: that is safe *today*, because every drawing call between `createWriteStream` and `doc.end()` is
synchronous, so the listeners land in the same tick as the failing `open`; both orderings return the same clean
`EISDIR`. Also measured: a listener attached one macrotask later is already too late -- the error is unhandled,
it takes the process down, and the client sees no response rather than a refusal. Since the only thing keeping
the old ordering safe was the absence of an `await` in the drawing code, the promise is now built at stream
creation. `servers/invoice/src/pdf.ts` has the same original shape and the same current safety; it is out of
this unit's write scope and is noted here rather than changed.

### Defects fixed during the build

**Text-export alignment.** The totals block in `quote_send_text` was padded against the description column
width, so `VAT 23% on EUR 1800.00` pushed its amount 12 characters right of the line amounts in the pasteable
email. Fixed by right-aligning the totals labels against a column computed from the line layout, so the amount
column lands in the same place for any description width.

---

## Free vs Pro, as shipped

| | Free | Pro |
| --- | --- | --- |
| Open quotes | 5 at a time (accepted, declined and expired do not count) | Unlimited |
| `quote_send_text` | Yes, unlimited | Yes |
| Create, revise, accept, decline, VAT, discounts, multi-currency | Yes | Yes |
| `quote_pdf` | No | Yes, plus the logo and no footer credit |
| `quote_report` | No | Yes |

---

## Measured insight

Copying an accepted quote's stored lines into the invoice, rather than recomputing them, is worth a measurable
amount of money, and the mechanism is the shared business profile that makes this suite coherent in the first
place.

A quote of EUR 1,000.00 net is issued with no per-line tax rate, so it takes the profile's `default_tax_rate` of
23%: the client is given **EUR 1,230.00**. The profile is then changed to 8% before the client answers. A
recompute-at-acceptance invoice reads **EUR 1,080.00** -- EUR 150.00 below the document the client agreed to,
with nothing on either record saying why they differ. Copying the stored lines invoices EUR 1,230.00 and keeps
`tax_lines[0].rate === 23`.

Asserted in `servers/quotes/test/adversarial.test.mjs`, "a VAT rate change between quote and acceptance never
moves the agreed total". The general form: a shared profile is the right place to read an identity from, and the
wrong place to read a price from twice.
