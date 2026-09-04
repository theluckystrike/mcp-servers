# mcp-bank-statement

<img src="../../assets/bank-statement-logo.png" alt="bank-statement" width="120" />

Export the CSV from your bank, say "import this", and the month is readable. This MCP server turns a bank export into a local ledger: it finds the header row under whatever preamble the bank prints above it, works out which column is the date, which is the money and which way the money went, and reads amounts in the file's own locale, so `1 234,56` from mBank and `1,234.56` from a US bank both become the same number. A debit is stored negative and a credit positive, once, at import, so nothing downstream has to guess. Re-importing the same export adds nothing: every line carries a hash of its date, amount, currency and description, with an occurrence index, so two identical coffees on one day stay two transactions while a second import of the same file stays zero. Your rules categorise transactions as they arrive, summaries report money in, money out and the net per currency and never mix currencies, `recurring_detect` finds the subscriptions and what each costs per year, and `reconcile_expenses` matches bank debits against the receipts in `mcp-expense-tracker` so you can see which debits have no receipt and which receipts never reached the bank. Everything is a plain JSON file on your own machine; nothing is uploaded anywhere.

**Turn a bank CSV into a categorised, reconciled month in chat -- no accounting SaaS required.**

Bank profiles: Revolut, Wise, mBank, PKO BP, ING, N26, and a generic reader that works from the headers alone.

## 60-second install

npm publish for `@theluckystrike/mcp-bank-statement` is pending. Until then, the `.mcpb` one-click bundle or a
clone+build is the working path -- both are verified below.

**One-click (.mcpb):** download `bank-statement.mcpb` from the latest release and double-click it in Claude Desktop:
https://github.com/theluckystrike/mcp-servers/releases/latest

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "bank-statement": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-bank-statement"]
    }
  }
}
```

**Claude Code:**

```sh
claude mcp add bank-statement -- npx -y @theluckystrike/mcp-bank-statement
```

**Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "bank-statement": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-bank-statement"]
    }
  }
}
```

The `npx` form above starts working the moment the package is published. Until then, use the .mcpb bundle above, or
build from source with exactly these three commands:

```sh
git clone https://github.com/theluckystrike/mcp-servers.git && cd mcp-servers
npm install
npm run build -w packages/mcp-license -w servers/spreadsheet -w servers/bank-statement
```

Then point your client's `command` at `node` with one arg: the absolute path to `servers/bank-statement/dist/index.js`.

To run in Pro mode set `MCP_LICENSE_KEY` in the same config block, or call `license_activate` once with your key.

## Tools

| Tool | What it does |
| --- | --- |
| `statement_import` | Read a bank CSV into the ledger. Detects the header row under any preamble, the date, description, amount (or debit and credit) and currency columns, the date order and the number locale. Reports what it detected, what it stored, how many lines were duplicates of what is already there, and every line it skipped with the reason |
| `transactions_list` | List transactions in a date range, filtered by account, category or `uncategorized`, with totals per currency |
| `transactions_search` | Find transactions whose description, counterparty, category or account contains the query. Substring only, never a regex |
| `category_rules` | Set or list the rules that categorise transactions. A plain match is a case-insensitive substring; `regex: true` compiles the pattern only if it cannot backtrack exponentially, and `(a+)+` is refused and used as a substring. Setting rules re-applies them to stored transactions |
| `transaction_categorize` | Set the category on transactions by id. Nothing changes unless every id exists |
| `statement_summary` | Money in, money out and the net for a range, grouped by category, month, account or counterparty, always per currency |
| `reconcile_expenses` | Match bank debits against the receipts in `mcp-expense-tracker`: same currency, same amount, within a date window. Reports matches, bank lines with no receipt, and receipts that never reached the bank. The expense ledger is only ever read |
| `recurring_detect` | Find subscriptions and recurring charges: the same counterparty, an amount that barely moves, a steady cadence. Reports the cadence, the typical amount, the next expected date and the annualised cost |
| `statement_export` | Write a range to csv or json and return the path. Written atomically, so a failure never leaves a half file |
| `accounts_list` | The imported accounts, with bank, currencies, transaction count, date range and last balance |
| `license_status` | Show free or Pro mode |
| `license_activate` | Activate a Pro key (verified offline) |

Resource `bank://month` returns this month's money in, money out and net, grouped by category, per currency.
Prompt `monthly_review` drives the whole month-end pass: totals, uncategorised lines, subscriptions, reconciliation.

## Free vs Pro

| | Free | Pro |
| --- | --- | --- |
| Accounts | 2 | unlimited |
| History read back | last 12 months | all of it |
| Category rules | 5 | unlimited |
| Import, list, search, summarise | yes | yes |
| `reconcile_expenses` | no | yes |
| `recurring_detect` | no | yes |
| `statement_export` | no | yes |

Import always stores every row, whatever the tier: silently dropping lines on the way in would make the ledger
disagree with the bank. The free limit is on what is read back.

**Get Pro:** https://mcp.zovo.one/buy/bank-statement -- $19 one-time for this server, $39 for every server, lifetime.
Keys are verified offline; nothing is sent anywhere.

## Pairs with

- **[mcp-expense-tracker](../expense-tracker)** -- log the receipts and the mileage; `reconcile_expenses` reads that
  ledger and tells you which bank debits have no receipt behind them.
- **[mcp-spreadsheet](../spreadsheet)** -- this server parses your bank CSV with the spreadsheet server's own RFC 4180
  reader and locale number parser, so `1 234,56` means the same thing in both. Use it to slice an exported range.
- **[mcp-invoice](../invoice)** -- the income side: raise the invoice, then watch the payment land in
  `statement_summary` grouped by counterparty.

## Privacy

Everything stays on your machine. Statements are parsed locally and stored in a plain JSON file under
`${XDG_DATA_HOME:-~/.local/share}/mcp-servers/bank-statement/`. The server makes no network calls at all -- not for
licensing, not for parsing, not for anything. Deleting that directory resets it.

Built by [theluckystrike](https://github.com/theluckystrike). Support: support@zovo.one
