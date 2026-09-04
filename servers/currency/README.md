# mcp-currency

Ask your assistant what something is worth in another currency and get a real answer with a date on it. It reads the European Central Bank's daily euro foreign exchange reference rates -- the same published series banks, tax authorities and accountants use -- converts amounts between any of the currencies the ECB quotes, and shows how a pair has moved over time. There is no API key, no account and no rate limit, because the ECB publishes the file openly. Both files are cached on your own machine, so after the first download every answer is instant and the server keeps working on a plane. Every answer states which rate date it used, because ECB rates are published once a day and a Sunday carries Friday's rate.

Built by [theluckystrike](https://github.com/theluckystrike).

![currency demo](../../assets/demo-currency.gif)

**Real ECB exchange rates in your chat -- no API key, cached locally, works offline.**

## 60-second install

npm publish for `@theluckystrike/mcp-currency` is pending. Until then, the `.mcpb` one-click bundle or a clone+build
is the working path -- both are verified below.

**One-click (.mcpb):** download `currency.mcpb` from the latest release and double-click it in Claude Desktop:
https://github.com/theluckystrike/mcp-servers/releases/latest

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "currency": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-currency"]
    }
  }
}
```

**Claude Code:**

```sh
claude mcp add currency -- npx -y @theluckystrike/mcp-currency
```

**Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "currency": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-currency"]
    }
  }
}
```

The `npx` form above starts working the moment the package is published. Until then, use the .mcpb bundle above, or
build from source with exactly these three commands:

```sh
git clone https://github.com/theluckystrike/mcp-servers.git && cd mcp-servers
npm install
npm run build -w packages/mcp-license -w servers/currency
```

Then point your client's `command` at `node` with one arg: the absolute path to `servers/currency/dist/index.js`.

To run in Pro mode set `MCP_LICENSE_KEY` in the same config block, or call `license_activate` once with your key.

## Tools

| Tool | What it does |
| --- | --- |
| `rates_latest` | The latest ECB reference rates, re-expressed against any base. Optional `quotes` to narrow the list. |
| `convert` | Convert an amount between two currencies, today or on a past date. States the rate, the rate date and the rounding. |
| `convert_many` | One amount into several currencies at once, all off the same rate date. |
| `fx_rates_for` | Returns the `fx_rates` object the expense tracker's `expense_to_invoice` takes, plus the rate date. |
| `rate_history` | A pair over a window, with min, max, average and the change across it. |
| `rate_on` | The rate on one date, falling back to the last published rate on or before it and saying so. Both directions are returned (`rate` and `inverse_rate`) and `published_direction` names which way round the ECB itself quotes the pair, so the reciprocal is never relayed as the published figure. |
| `currencies_list` | Every currency the ECB quotes, with its euro rate and its number of decimal places. |
| `cache_status` | What is cached, how old it is, when it refreshes next, and where it lives. |
| `license_status` / `license_activate` | Check or activate a Pro key. Verified offline. |

Resource `fx://latest` exposes the cached rates as JSON. Prompt `convert_invoice_lines` walks the whole
expense-tracker -> currency -> invoice chain in one step.

## Free vs Pro

| | Free | Pro ($19 one-time) |
| --- | --- | --- |
| Latest rates, `convert`, `convert_many`, `fx_rates_for` | Yes, unlimited | Yes, unlimited |
| Currencies | All 30+ the ECB quotes | All 30+ the ECB quotes |
| Rate history | Up to 90 days per call, back 90 days; a wider window is shortened and answered, cap named | Unlimited windows, back to 1999-01-04 |
| `rate_on` | Last 90 days | Any date since 1999-01-04 |
| Offline cache | Yes | Yes |

A refused history window returns the reason and the exact narrower call to make; it never silently truncates
a table and it never returns a transport error.

**Get Pro:** https://mcp.zovo.one/buy/currency (or $39 for the whole bundle: https://mcp.zovo.one/buy/bundle)

## Pairs with

- **[expense-tracker](../expense-tracker)** -- `expense_to_invoice` takes `target_currency` plus an `fx_rates`
  object and folds a multi-currency expense set into one invoice currency, but it will not fetch or invent a rate.
  `fx_rates_for {target, currencies}` here returns exactly that object. "Rebill Nova in USD" then works end to end
  without the user typing a single exchange rate.
- **[invoice](../invoice)** -- one invoice carries one currency. Convert first, issue second, and put the returned
  `invoice_note` ("Converted at ECB reference rates of 2026-09-02") on the document so the client can check it.

```
expense_to_invoice {project, from, to}          -> which currencies are actually present
fx_rates_for {target: "USD", currencies: [...]} -> {"EUR": 1.0812, "GBP": 1.2717}, rate date
expense_to_invoice {..., target_currency: "USD", fx_rates: {...}} -> one currency, every line annotated
invoice_create {currency: "USD", items: [...]}  -> the document
```

## How the rates work

- Source: the ECB euro foreign exchange reference rates, `eurofxref-daily.xml` and `eurofxref-hist.xml`.
- Published around 16:00 CET on TARGET business days. There is no rate for a weekend, 1 January, Good Friday,
  Easter Monday, 1 May, or 25 and 26 December.
- Asking for a date with no rate returns the last rate published on or before it -- the convention every bank
  uses -- and the answer says which date it landed on and why. A date inside the cached range with no rate is
  a weekend or a TARGET holiday and is named as one; a date after the newest day in the cache is reported as
  not published yet, with the cache's latest date and whether this call went to the ECB to look for it.
- The ECB quotes everything against the euro, so a USD/PLN rate is a cross rate: the ratio is formed and
  multiplied at full precision, and the only rounding in the path is the last one, to the target currency's
  minor units. The answer carries both numbers: `rate_exact` is the multiplier, `rate` is the same rate rounded
  to 6 decimals for reading. Recomputing by hand from the 6-decimal `rate` can differ by a minor unit or two;
  it is far out for pairs whose rate is nowhere near 1 (1,000,000 VND is KWD 11.667, not KWD 12.000).
- Results are rounded to the target currency's own ISO 4217 minor units: JPY comes back whole, BHD to three places.
- These are reference rates for accounting and reporting. They are not dealing rates; your bank's rate will differ.

## Privacy

All data stays local. The only network request this server makes is to `www.ecb.europa.eu` for the two public rate
files, and only when the local copy is older than 6 hours (daily) or 24 hours (history). Nothing about your amounts,
your currencies or your machine is sent anywhere. The cache lives in
`${XDG_DATA_HOME:-~/.local/share}/mcp-servers/currency/`; delete that directory to reset the server. Set
`ECB_BASE_URL` to point at your own mirror if outbound access is restricted.

MIT licensed. Support: support@zovo.one. Built by [theluckystrike](https://github.com/theluckystrike).
