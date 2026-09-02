# mcp-expense-tracker

Say "12.30 euros at Adobe, software, billable to Acme" and it is logged, categorised, VAT-split and ready to rebill. This MCP server keeps a local ledger of your business expenses: every amount is held in integer minor units in its own currency, `vat_rate` splits the gross on the receipt into net and VAT, merchant rules categorise new expenses on their own, receipts are attached by path and sha256 so an audit can prove the file has not changed, and business trips are priced from a built-in mileage table. Summaries group by category, project, month or merchant, always per currency and never mixed. It exports to CSV, xlsx or JSON, and `expense_to_invoice` hands the billable expenses of a project to `mcp-invoice` in exactly the line-item shape `invoice_create` expects. Everything is stored in a plain JSON file on your own machine; nothing is uploaded anywhere.

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
| `expense_add` | Log one expense: amount, currency, category, merchant, date, project, note, receipt path, billable flag, VAT rate. An empty category is filled in from the merchant rules |
| `expense_list` | List expenses in a date range, filtered by project, category or billable, with totals per currency |
| `expense_update` | Change any field of a stored expense by id, including clearing the rebilled marker |
| `expense_delete` | Delete one expense by id. The receipt file itself is left alone |
| `receipt_attach` | Attach a receipt file to an expense. The file must exist; its path and sha256 are stored |
| `category_rules` | Set or list the merchant-to-category rules. Each match is tried as a case-insensitive regex, then as a substring |
| `expense_summary` | Totals for a range grouped by category, project, month or merchant, with the gross, net and VAT per currency |
| `mileage_add` | Log a trip in km or miles and price it from the rate table (or your own rate) |
| `expense_export` | Write the range to csv, xlsx or json and return the path. Never writes a partial file |
| `expense_to_invoice` | Turn a project's unbilled billable expenses into `invoice_create` line items, per currency, with an optional markup |
| `license_status` | Show free or Pro mode |
| `license_activate` | Activate a Pro key (verified offline) |

Resource: `expenses://month` returns the current calendar month's totals by category, per currency.

Prompt: `monthly_close` walks the month's totals, the billable expenses not yet invoiced, and the expenses with no receipt attached.

## Mileage rates

| Region | Rate | Unit | Currency |
| --- | --- | --- | --- |
| PL | 1.15 | km | PLN |
| UK | 0.45 | mile | GBP |
| US | 0.70 | mile | USD |
| EU | 0.30 | km | EUR |

With no `region`, miles use the US rate and kilometres the EU rate. `rate_per_km` overrides the table with your own rate for the unit you passed, and `currency` sets the currency for that rate. These are convenience defaults, not tax advice: check the rate your own tax authority allows for the year.

## Pairs with the rest of the collection

`expense_to_invoice` returns `{description, quantity, unit_price, tax_rate}` objects, which is exactly the `items` array [mcp-invoice](../invoice) takes. `unit_price` is the net amount, `tax_rate` is the VAT rate, so the invoice recomputes the same tax rather than double-charging it. Because one invoice carries one currency, the result is grouped per currency and you pass one group. [mcp-time-tracker](../time-tracker) bills the hours on the same project; this server bills what the project cost you.

## Free vs Pro

| | Free | Pro |
| --- | --- | --- |
| Logging expenses, mileage and receipts | Unlimited | Unlimited |
| `expense_list` and `expense_summary` | Last 30 days | Full history |
| Projects | 3 | Unlimited |
| Category rules | 5 | Unlimited |
| CSV and JSON export | Up to 200 rows | Unlimited |
| xlsx export | No | Yes |
| `expense_to_invoice` | 20 items at a time, at cost | Unlimited items, with `markup_percent` |
| Multi-currency, VAT split, receipt hashing | Yes | Yes |

A limit never writes a partial file and never silently truncates: the export is refused with nothing on disk, and the tool says what to narrow.

Pro is a one-time $19, or $39 for every server in the collection, lifetime.

**Get Pro: https://mcp.zovo.one/buy/expense-tracker**

## Numbers and money

Every amount is an integer number of minor units (cents, or whole yen for zero-decimal currencies such as JPY) in the expense's own currency, and every printed amount carries its currency code, for example `EUR 61.50`. The amount you record is the gross on the receipt. `vat_rate` splits it: `net = round(gross * 100 / (100 + rate))`, `vat = gross - net`, so net plus VAT is always exactly the gross. Summaries sum already-rounded per-expense values inside one currency; currencies are never added together and never converted. Mileage money is `round(distance * rate)` in the rate's currency. Dates are ISO `YYYY-MM-DD`.

## Privacy

All data stays local, in `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/expense-tracker/`. There are no network calls: receipts are hashed on your machine, exports are written on your machine, and license keys are verified offline with a public key compiled into the package.

Built by [theluckystrike](https://github.com/theluckystrike).
