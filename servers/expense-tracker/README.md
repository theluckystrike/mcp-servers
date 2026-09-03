# mcp-expense-tracker

![expense-tracker demo](../../assets/demo-expense-tracker.gif)

Say "12.30 euros at Adobe, software, billable to Acme" and it is logged, categorised, VAT-split and ready to rebill. This MCP server keeps a local ledger of your business expenses: every amount is held in integer minor units in its own currency, `vat_rate` splits the gross on the receipt into net and VAT (set it once with `expense_settings` and every later expense is split without repeating it), merchant rules categorise new expenses on their own, receipts are attached by path and sha256 so an audit can prove the file has not changed, and business trips are priced from a built-in mileage table. Summaries group by category, project, month or merchant, always per currency and never mixed. It exports to CSV, xlsx or JSON, and `expense_to_invoice` hands the billable expenses of a project to `mcp-invoice` in exactly the line-item shape `invoice_create` expects. Everything is stored in a plain JSON file on your own machine; nothing is uploaded anywhere.

**Log receipts and mileage in chat, split the VAT, and rebill them onto an invoice -- no expense SaaS required.**

## 60-second install

npm publish for `@theluckystrike/mcp-expense-tracker` is pending. Until then, the `.mcpb` one-click bundle or a
clone+build is the working path -- both are verified below.

**One-click (.mcpb):** download `expense-tracker.mcpb` from the latest release and double-click it in Claude Desktop:
https://github.com/theluckystrike/mcp-servers/releases/latest

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "expense-tracker": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-expense-tracker"]
    }
  }
}
```

**Claude Code:**

```sh
claude mcp add expense-tracker -- npx -y @theluckystrike/mcp-expense-tracker
```

**Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "expense-tracker": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-expense-tracker"]
    }
  }
}
```

The `npx` form above starts working the moment the package is published. Until then, use the .mcpb bundle above, or
build from source with exactly these three commands:

```sh
git clone https://github.com/theluckystrike/mcp-servers.git && cd mcp-servers
npm install
npm run build -w packages/mcp-license -w servers/expense-tracker
```

Then point your client's `command` at `node` with one arg: the absolute path to `servers/expense-tracker/dist/index.js`.

To run in Pro mode set `MCP_LICENSE_KEY` in the same config block, or call `license_activate` once with your key.

## Tools

| Tool | What it does |
| --- | --- |
| `expense_add` | Log one expense: amount, currency, category, merchant, date, project, note, receipt path, billable flag, VAT rate. An empty category is filled in from the merchant rules. `billable` defaults to **true when a `project` is given** and false otherwise, and the response always states which value was used |
| `expense_settings` | Read or set the defaults `expense_add` uses when a call names none: `default_vat_rate`, `default_currency` |
| `expense_list` | List expenses in a date range, filtered by project, category or billable, with totals per currency |
| `expense_update` | Change any field of a stored expense by id. `rebilled: false` clears both the rebilled marker and the invoice number. Amount, currency and `vat_rate` are refused on an expense already rebilled unless you pass `unlink_rebill: true`, which clears the rebill link, because the invoice charged something else |
| `expense_delete` | Delete one expense by id. The receipt file itself is left alone |
| `receipt_attach` | Attach a receipt file to an expense. The file must exist; its path and sha256 are stored |
| `category_rules` | Set or list the merchant-to-category rules. A match with no regex metacharacters is a plain substring; one with them is compiled only if it cannot backtrack exponentially, and a pattern like `(a+)+` is refused |
| `expense_summary` | Totals for a range grouped by category, project, month or merchant, with the gross, net and VAT per currency |
| `mileage_add` | Log a trip in km or miles and price it from the rate table (or your own rate) |
| `expense_export` | Write the range to csv, xlsx or json and return the path. Never writes a partial file |
| `expense_to_invoice` | Preview a project's unbilled billable expenses as `invoice_create` line items, per currency, with an optional markup and an optional `assume_vat_rate`. Pass `target_currency` + `fx_rates` to fold every currency into one group. When nothing matches it returns `count: 0`, no `fx_note`, and the plain reason. Marks nothing as rebilled, ever |
| `expense_mark_rebilled` | Mark expenses rebilled once the invoice exists, by ids or by project, date range and `currency`. `invoice_number` is required |
| `license_status` | Show free or Pro mode |
| `license_activate` | Activate a Pro key (verified offline) |

Resource: `expenses://month` returns the current calendar month's totals by category, per currency.

Prompt: `monthly_close` walks the month's totals, the billable expenses not yet invoiced, and the expenses with no receipt attached.

## Mileage rates

The table holds one flat rate per region. Each row is an approximation with a stated assumption, not a tax calculation:

| Region | Rate | Unit | Currency | What it assumes |
| --- | --- | --- | --- | --- |
| PL | 1.15 | km | PLN | A car over 900 cm3. The Polish limit is PLN 0.89/km up to 900 cm3, and there are separate motorcycle and moped rates |
| UK | 0.45 | mile | GBP | A car, within the first 10,000 business miles of the tax year. HMRC pays a lower rate above that threshold, and different rates for motorcycles and bicycles |
| US | 0.70 | mile | USD | The IRS business standard rate for one calendar year. The IRS re-issues it every year, and has changed it mid-year |
| EU | 0.30 | km | EUR | A generic per-kilometre allowance. There is no single EU rate; each member state sets its own |

There are deliberately no year, vehicle or threshold tables behind these numbers: a table that looks authoritative but is a year out of date is worse than one that says what it is. Every `mileage_add` reply names the rate it used and repeats that caveat, for example `(table rate PL 1.15 PLN/km, an approximation; pass rate_per_km for your exact scheme)`.

With no `region`, miles use the US rate and kilometres the EU rate. `rate_per_km` overrides the table with your own rate for the unit you passed, which is the supported way to claim an exact scheme (an engine class, a mid-year rate, the band above 10,000 miles). `currency` is only accepted **together with** `rate_per_km`: a table rate is quoted in its own currency, and relabelling PLN 1.15/km as EUR 1.15/km would convert nothing and book roughly four times the real cost, so that call is refused.

## Pairs with the rest of the collection

`expense_to_invoice` returns `{description, quantity, unit_price, tax_rate}` objects, which is exactly the `items` array [mcp-invoice](../invoice) takes. `unit_price` is the net amount, `tax_rate` is the VAT rate recorded on the expense, so the invoice recomputes the same tax rather than double-charging it, and the line total comes back to the gross on the receipt. Where rounding the tax a second time cannot reproduce that gross (EUR 0.03 at 23% splits into 0.02 + 0.01, but 0.02 taxed at 23% rounds to 0.00), the `unit_price` is nudged by the one cent if that lands the invoice exactly, and otherwise the group carries a visible `[rounding adjustment ...]` line at `tax_rate: 0`; `rounding_adjustment_lines` counts them.

### Mixed currencies

One invoice carries one currency, so a week of USD hours, a EUR receipt and a GBP mileage line comes back as three groups. To get a single invoice, supply the target and your own rates:

```
expense_to_invoice {project: "Nova", from: "2026-09-01", to: "2026-09-07",
                    target_currency: "USD", fx_rates: {"EUR": 1.08, "GBP": 1.27}}
```

`fx_rates` reads as "1 unit of that currency = X units of `target_currency`". Every line is converted and one group is returned, and each converted line says so on its own face: `... [converted from EUR 12.40 at 1.08]`. Nothing here fetches or invents a rate; a currency with no rate is refused by name. Without `fx_rates`, a mixed range returns the exact call to make instead of leaving you to work it out.

A stored `vat_rate` of `0` is a rate, not a gap: an exempt receipt stays exempt. An expense recorded with **no** rate holds a gross amount, and it is rebilled as-is with `tax_rate: 0` and `tax_rate: 0 (VAT unknown, gross rebilled as-is; pass assume_vat_rate to split)` in the description, so a default rate on the invoice cannot tax the receipt twice. The `expense_settings` default is applied when the expense is **inserted** and never retroactively at rebill time: changing that default later must not rewrite the tax meaning of receipts entered before it existed. To split those older lines anyway, pass `assume_vat_rate` explicitly on the `expense_to_invoice` call and the lines are flagged `[vat assumed 23%]`.

Nothing is marked rebilled by that call, and there is no option to make it: create the invoice first, then call `expense_mark_rebilled` with a required `invoice_number`. Because one invoice carries one currency, the result is grouped per currency, each group carries its own `expense_ids`, and you pass one group. Marking by ids is the precise route; marking by project and date range additionally **requires** `currency`, and touches only billable, not-yet-rebilled expenses in it, so invoicing the EUR group cannot mark the PLN one. [mcp-time-tracker](../time-tracker) bills the hours on the same project; this server bills what the project cost you.

## Free vs Pro

| | Free | Pro |
| --- | --- | --- |
| Logging expenses, mileage and receipts | Unlimited | Unlimited |
| `expense_list` and `expense_summary` | Last 30 days | Full history |
| Projects | 3 | Unlimited |
| Category rules | 5 | Unlimited |
| CSV and JSON export | Up to 200 rows | Unlimited |
| xlsx export | No | Yes |
| `expense_to_invoice` | 20 items at a time, `markup_percent` included | Unlimited items |
| Multi-currency, VAT split, receipt hashing | Yes | Yes |

A limit never writes a partial file and never silently truncates: the export is refused with nothing on disk, and the tool says what to narrow.

Pro is a one-time $19, or $39 for every server in the collection, lifetime.

**Get Pro: https://mcp.zovo.one/buy/expense-tracker**

## Numbers and money

Every amount is an integer number of minor units in the expense's own currency, and every printed amount carries its currency code, for example `EUR 61.50`. How many minor units make one unit comes from an ISO 4217 table, not a guess: 2 for most currencies, 0 for JPY, KRW, VND, CLP, ISK and the rest of the zero-decimal list, 3 for BHD, IQD, JOD, KWD, LYD, OMR and TND, 4 for CLF and UYW. So `KWD 1.234` is 1234 minor units, not 123. The same table is used by [mcp-invoice](../invoice), because the two servers exchange amounts. HUF is 2 decimals here: ISO 4217 gives it two minor digits even though it is usually quoted without them.

The amount you record is the gross on the receipt. `vat_rate` splits it by rounding the VAT, not the net: `vat = round(gross * rate / (100 + rate))`, `net = gross - vat`, so net plus VAT is always exactly the gross and a half-cent of VAT rounds up instead of disappearing (EUR 0.03 at 23% is net 0.02 plus VAT 0.01). Summaries sum already-rounded per-expense values inside one currency; currencies are never added together and never converted. Mileage money is `round(distance * rate)` in the rate's currency. Dates are ISO `YYYY-MM-DD`.

## Privacy

If `data.json` is ever unreadable or not valid JSON, it is not treated as "no expenses yet". The file is moved aside byte-for-byte as `data.json.corrupt-<timestamp>`, a `data.json.corrupt` marker is written, and every tool returns `data file is corrupt; moved to ...; nothing was written` until you restore a good copy and delete the marker -- so a truncated file can never be overwritten by an empty database.

All data stays local, in `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/expense-tracker/`. There are no network calls: receipts are hashed on your machine, exports are written on your machine, and license keys are verified offline with a public key compiled into the package.

Built by [theluckystrike](https://github.com/theluckystrike).

## One business profile for the whole suite

Your identity is stored once, at `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/profile/business.json`,
and every server in the suite reads it: the invoice issuer, the docx letterhead, the recurring
issuer, expense-tracker's default VAT rate, time-tracker's and timezone's home zone, and the
resume and contract letterheads. Set it once with `business_set` (invoice or docx) - you never
repeat it anywhere else. An email address is only ever taken from that profile or from an explicit
argument; when none is stored, documents show `[add: email]` and the tool says so rather than
letting anyone improvise an address.
