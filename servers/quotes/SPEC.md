# quotes: contract spec

Written in the shape `scripts/gen-spec.mjs` emits; the tool tables below were read off the built server
over stdio (`initialize`, `tools/list`), not off `src`. This server is not yet in the generator's list.

| | |
| --- | --- |
| package | `@theluckystrike/mcp-quotes` |
| version | 0.6.1 |
| bin | `mcp-quotes` |
| serverInfo.name | `mcp-quotes` |
| transport | stdio, JSON-RPC 2.0 |
| tools | 12 |
| resources | 1 |
| prompts | 1 |

## What it does

Estimates and quotes for freelancers, on the invoice engine: VAT line items in minor units, a validity date,
a pasteable text version, an A4 PDF, and an accept that becomes a real invoice under the invoice server's
own number series.

## Tools (12)

| tool | description |
| --- | --- |
| `license_activate` | Activate a Pro license key (format MCPL1.xxx.yyy). Verified offline and saved locally. |
| `license_status` | Show whether this server runs in free or Pro mode and where to upgrade. |
| `quote_accept` | Mark a quote accepted and turn it into an invoice: created directly in the invoice server when its store is present, otherwise returned as invoice_create-ready line items. The numbers are copied, never recomputed. |
| `quote_create` | Quote a client: line items with quantity and unit price in minor units, VAT per line or the business default, an optional discount and a validity window. Returns the quote id and the totals. |
| `quote_decline` | Mark a quote as lost, with an optional reason, so it stops counting against the open quotes and shows up in the win rate. An accepted quote is never turned back. |
| `quote_delete` | Delete a draft quote that was never sent, accepted, invoiced or exported, and give its free open-quote slot back. A quote with any of those is refused with the dependent named. The id is never reissued. |
| `quote_get` | The full stored record for one quote: every line with its unit price and VAT, the totals, the validity date, the notes and, when it was accepted, the invoice it became. |
| `quote_list` | Every quote with its client, total, validity and state (open, expired, accepted or declined). Filter by state, by client or by quote date range. |
| `quote_pdf` | Call this tool to write the A4 PDF of one quote and return the file path. Same layout as the invoice PDF, with the validity date and an acceptance block. Pro. |
| `quote_report` | Totals per currency for open, accepted, declined and expired quotes, with counts, the value still open and the win rate. Free covers the current calendar year to date; Pro reports over any date range. |
| `quote_send_text` | Turn a quote into a plain-text summary with the line table, the VAT lines, the total and the validity date, ready to paste into an email. Free on every tier. |
| `quote_update` | Revise a quote that is still open: line items, currency, discount, VAT default, validity or notes. Totals are recomputed. An accepted or declined quote is never edited. |

### `license_activate`

Title: Activate license

Activate a Pro license key (format MCPL1.xxx.yyy). Verified offline and saved locally.

| arg | type | required | description |
| --- | --- | --- | --- |
| `key` | string | yes | License key from the checkout confirmation page |

### `license_status`

Title: License status

Show whether this server runs in free or Pro mode and where to upgrade.

No arguments.

### `quote_accept`

Title: Accept a quote

Mark a quote accepted and turn it into an invoice: created directly in the invoice server when its store is present, otherwise returned as invoice_create-ready line items. The numbers are copied, never recomputed.

| arg | type | required | description |
| --- | --- | --- | --- |
| `allow_expired` | boolean | no | Accept a quote whose validity has run out. Default false: an expired quote is refused so the price is re-confirmed first |
| `create_invoice` | string (auto, always, never) | no | Default "auto": create the invoice when the invoice store exists, otherwise hand back the items. "never" only marks it accepted |
| `due_days` | integer | no | Days until the invoice is due, defaults to your payment terms |
| `id` | string | yes | Quote id such as Q-2026-0001 |
| `issue_date` | string | no | YYYY-MM-DD for the invoice, defaults to today |

### `quote_create`

Title: Create a quote

Quote a client: line items with quantity and unit price in minor units, VAT per line or the business default, an optional discount and a validity window. Returns the quote id and the totals.

| arg | type | required | description |
| --- | --- | --- | --- |
| `client` | string | yes | Client name or id. A name the invoice server already knows brings its address, email and VAT id onto the quote |
| `client_address` | string | no | Postal address for the QUOTE FOR block, newlines allowed |
| `client_email` | string | no | Only if the user gave it; otherwise the stored client's email is used |
| `client_vat_id` | string | no | Client VAT / tax registration id |
| `currency` | string | no | Defaults to your business default currency |
| `discount_percent` | number | no | Discount applied to every line, in percent |
| `issue_date` | string | no | YYYY-MM-DD, defaults to today in your business profile's timezone |
| `items` | array | yes | The line items being quoted |
| `notes` | string | no | Free text printed under the totals, e.g. scope or exclusions |
| `tax_rate` | number | no | VAT percent for lines with no rate of their own. Defaults to the business default |
| `valid_until` | string | no | YYYY-MM-DD, an explicit last valid day. Wins over validity_days |
| `validity_days` | integer | no | Days the quote stays valid, counted from the quote date and inclusive. Default 30 |

### `quote_decline`

Title: Decline a quote

Mark a quote as lost, with an optional reason, so it stops counting against the open quotes and shows up in the win rate. An accepted quote is never turned back.

| arg | type | required | description |
| --- | --- | --- | --- |
| `date` | string | no | YYYY-MM-DD, defaults to today |
| `id` | string | yes | Quote id such as Q-2026-0001 |
| `reason` | string | no | Why it was lost, e.g. "price" or "went in-house". Kept on the record |

### `quote_delete`

Title: Delete a draft quote

Delete a draft quote that was never sent, accepted, invoiced or exported, and give its free open-quote slot back. A quote with any of those is refused with the dependent named. The id is never reissued.

| arg | type | required | description |
| --- | --- | --- | --- |
| `id` | string | yes | Quote id such as Q-2026-0001 |

### `quote_get`

Title: Show one quote

The full stored record for one quote: every line with its unit price and VAT, the totals, the validity date, the notes and, when it was accepted, the invoice it became.

| arg | type | required | description |
| --- | --- | --- | --- |
| `id` | string | yes | Quote id such as Q-2026-0001, or an exact client name |

### `quote_list`

Title: List quotes

Every quote with its client, total, validity and state (open, expired, accepted or declined). Filter by state, by client or by quote date range.

| arg | type | required | description |
| --- | --- | --- | --- |
| `client` | string | no | Only quotes for clients whose name contains this text |
| `from` | string | no | YYYY-MM-DD, earliest quote date |
| `state` | string (open, expired, accepted, declined, all) | no | Default "all". "open" excludes quotes whose validity has run out; "expired" is only those |
| `to` | string | no | YYYY-MM-DD, latest quote date |

### `quote_pdf`

Title: Render the quote as a PDF

Call this tool to write the A4 PDF of one quote and return the file path. Same layout as the invoice PDF, with the validity date and an acceptance block. Pro.

| arg | type | required | description |
| --- | --- | --- | --- |
| `id` | string | yes | Quote id such as Q-2026-0001 |
| `out_path` | string | no | Where to write the file. Defaults to the quotes data directory under pdf/ |

### `quote_report`

Title: Quote pipeline and win rate

Totals per currency for open, accepted, declined and expired quotes, with counts, the value still open and the win rate. Free covers the current calendar year to date; Pro reports over any date range.

| arg | type | required | description |
| --- | --- | --- | --- |
| `from` | string | no | YYYY-MM-DD, earliest quote date to count |
| `to` | string | no | YYYY-MM-DD, latest quote date to count |

### `quote_send_text`

Title: Plain-text quote to paste into email

Turn a quote into a plain-text summary with the line table, the VAT lines, the total and the validity date, ready to paste into an email. Free on every tier.

| arg | type | required | description |
| --- | --- | --- | --- |
| `greeting` | string | no | Opening line, default "Hello" plus the client name |
| `id` | string | yes | Quote id such as Q-2026-0001 |
| `sign_off` | string | no | Closing line, default your business name from the shared profile |

### `quote_update`

Title: Change an open quote

Revise a quote that is still open: line items, currency, discount, VAT default, validity or notes. Totals are recomputed. An accepted or declined quote is never edited.

| arg | type | required | description |
| --- | --- | --- | --- |
| `client_address` | string | no |  |
| `client_email` | string | no |  |
| `client_vat_id` | string | no |  |
| `currency` | string | no |  |
| `discount_percent` | number | no |  |
| `id` | string | yes | Quote id such as Q-2026-0001 |
| `items` | array | no | Replaces every line item |
| `notes` | string | no |  |
| `tax_rate` | number | no | VAT percent for lines with no rate of their own |
| `valid_until` | string | no | YYYY-MM-DD. Wins over validity_days, and is how an expired quote is extended |
| `validity_days` | integer | no | Recomputes valid_until from the quote date |

## Resources (1)

| uri | mimeType | what |
| --- | --- | --- |
| `quotes://open` | application/json | Every quote still open and inside its validity window, as the `quote_list` summary shape |

## Prompts (1)

| name | what |
| --- | --- |
| `quote_followup` | Review what is open, what lapses soon and what already lapsed, then draft the chase |

## Storage

Directory `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/quotes/`.

| file | holds |
| --- | --- |
| `quotes.json` | every quote record: client block, lines, totals, state, dates, invoice number |
| `counter.json` | the per-year id counter, `{"Q-2026": 7}` |
| `.lock` | the advisory lock directory every mutation is taken under |
| `pdf/` | rendered quote PDFs, `Q-YYYY-NNNN.pdf` |

Primary file: `quotes.json`. Invoices created by `quote_accept` are written into the INVOICE server's
directory (`.../mcp-servers/invoice/invoices.json`, `clients.json`, `counter.json`) through
`@theluckystrike/mcp-invoice/lib`, under `.../invoice/.lock`.

## Caps

- `FREE_OPEN_QUOTES` = 5 quotes in the `open` state on free. Accepted, declined and expired quotes do not count.
- `MAX_ITEMS` = 200 line items per quote.
- `MAX_MINOR` = 1e12 per quantity and per unit price; a total that is not a safe integer is refused.
- `MAX_VALIDITY_DAYS` = 3650.
- `quote_pdf` is Pro-only. `quote_delete` is free on every tier: the way out of the open-quote cap is never behind the paywall.
- `quote_report` is free for the current calendar year to date; a wider range is Pro. The response names the cap.

## Invariants

- stdout carries JSON-RPC only. Every diagnostic goes to stderr. A single stray stdout write breaks the client session.
- A tool never throws across the transport. Failures come back as `{ content: [{ type: "text", text: "Error: ..." }], isError: true }`.
- Writes are atomic: the payload goes to `<file>.<pid>.tmp` and is then `rename`d over the target, so a reader never sees a half-written file.
- No partial writes. When a limit or a validation refuses the operation, nothing at all is written; the tool says what was refused and why.
- Money is stored and compared in minor units (integer cents), never as a float. Prices are TAKEN in minor units too; a decimal `unit_price_minor` is refused.
- The money, VAT and currency-decimal arithmetic is `@theluckystrike/mcp-invoice/lib`'s `computeTotals`, `currencyDecimals` and `formatMoney`. This server holds no second copy.
- One quote is one currency. Two currencies across the line items, or a line that disagrees with the stated quote currency, is refused and nothing is stored.
- Dates are calendar dates as `YYYY-MM-DD`. "Today" is computed in the shared business profile's `timezone` when one is set, so expiry does not depend on the host machine's zone.
- A quote id `Q-<YYYY>-<NNNN>` is never reissued: the counter is written before the quote is stored, and ids already present in the store are skipped.
- `quote_create` refuses a quote identical to one already OPEN. The fingerprint is the client name and every line description trimmed and case-folded, the currency uppercased, the line quantities, unit prices in minor units and VAT rates, the discount percent, the total in minor units, the quote date, the last valid day and the notes. The refusal names the existing id; nothing is written, no id is allocated and no free slot is spent. Accepted and declined quotes are not compared against: re-quoting the same work after a closed document is a new offer.
- `quote_delete` removes a DRAFT only, and a draft is a quote with no dependent: not accepted, not invoiced, not declined, never handed to the client by `quote_send_text` and with no rendered document still on disk. A quote with any of those is refused with the dependent named and nothing is deleted. A delete really frees a free-tier slot, because the cap counts quotes in the open state and the row leaves `quotes.json`. The id is not reissued: the year counter is never rolled back.
- `quote_send_text` stamps `sent_date` the first time it hands the text over, and `quote_pdf` stamps `exported_path`. Those two stamps are what separates a draft from a document someone is holding.
- A quote is a document once it is closed. `quote_update` refuses an accepted or declined quote; `quote_accept` refuses a second acceptance; `quote_decline` refuses an accepted quote.
- `quote_accept` copies the quote's stored lines and totals into the invoice. It never recomputes them, so a business-profile VAT change between issuing and accepting cannot move the agreed total.
- An expired quote is refused by `quote_accept` unless `allow_expired: true`.
- A store file that fails to parse is quarantined byte-for-byte as `<file>.corrupt-<timestamp>` with a `<file>.corrupt` marker; nothing is overwritten and every later call fails until a human resolves it.
- The load-mutate-save cycle is held under an advisory lock directory (`packages/mcp-license` `withFileLock`), so two processes sharing one data dir cannot lose each other's writes. Lock order is always quotes, then invoice.

## Failure modes

Error strings a caller can match on:

- `no quote matches "<ref>". Run quote_list to see the ids.`
- `"<ref>" matches more than one quote: ... Pass the exact quote id.`
- `the free tier keeps 5 quotes open at a time and you have 5. ...`
- `the line items carry more than one currency (EUR, USD). ...`
- `the quote currency is EUR but a line item says USD. ...`
- `<id> was already accepted on <date> and invoiced as <number>. ...`
- `<id> was declined on <date>. ...`
- `<id> was valid until <date> and today is <date>, so it has lapsed by N day(s). ...`
- `<id> was accepted ... so it is a closed document and is not edited.`
- `issue_date "<v>" is not a real date in YYYY-MM-DD form.`
- `valid_until <date> is before the quote date <date>. Nothing was stored.`
- `that quote totals more than can be represented exactly in minor units. Nothing was stored.`
- `line N (<desc>) does not round-trip: ... Nothing was stored.`
- `this is quote <id> again, line for line: ... Nothing was written and no free open slot was used. ... remove it with quote_delete {id: "<id>"} and its slot comes back.`
- `<id> (<client>, <total>) is not a draft: <dependent>; <dependent>. Deleting it would leave that behind with no quote to point at, so nothing was deleted. ...`
- `data file is corrupt; moved to <path>; nothing was written. ...`
