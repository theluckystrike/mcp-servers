# MCP servers by theluckystrike

![License](https://img.shields.io/badge/license-MIT-blue)
![MCP Registry](https://img.shields.io/badge/MCP%20registry-listed-brightgreen)
![Release](https://img.shields.io/badge/release-v0.2.1-informational)

Practical Model Context Protocol servers for people who work inside Claude, Cursor and other MCP clients.
Every server runs locally over stdio, keeps all data on your machine, and has a genuinely useful free tier.
Pro unlocks the limits for a one-time payment: $19 per server or $39 for the bundle, lifetime. Five of the
six are also reachable as a hosted remote endpoint with no install at all (see below).

| Server | Demo | What it does | Install |
|---|---|---|---|
| [mcp-time-tracker](servers/time-tracker/README.md) | ![time-tracker](assets/demo-time-tracker.gif) | Track billable time from chat: timers, entries, reports, CSV, invoice summaries | `npx -y @theluckystrike/mcp-time-tracker`* |
| [mcp-price-tracker](servers/price-tracker/README.md) | ![price-tracker](assets/demo-price-tracker.gif) | Check and watch product prices on ordinary shop pages, history, target alerts | `npx -y @theluckystrike/mcp-price-tracker`* |
| [mcp-spreadsheet](servers/spreadsheet/README.md) | ![spreadsheet](assets/demo-spreadsheet.gif) | Read, query, add columns to and convert xlsx/csv files without corrupting them | `npx -y @theluckystrike/mcp-spreadsheet`* |
| [mcp-invoice](servers/invoice/README.md) | ![invoice](assets/demo-invoice.gif) | Create numbered invoices with tax lines and render professional PDFs | `npx -y @theluckystrike/mcp-invoice`* |
| [mcp-expense-tracker](servers/expense-tracker/README.md) | ![expense-tracker](assets/demo-expense-tracker.gif) | Log receipts and mileage in chat, split the VAT, rebill onto an invoice | `npx -y @theluckystrike/mcp-expense-tracker`* |
| [mcp-office-suite](servers/office-suite/README.md) | ![office-suite](assets/demo-office-suite.gif) | One install that proxies all five servers above behind a single config line | `npx -y @theluckystrike/mcp-office-suite`* |
| [mcp-currency](servers/currency/README.md) | ![currency](assets/demo-currency.gif) | Real ECB exchange rates in chat: convert, compare pairs, rate history, cached offline | `npx -y @theluckystrike/mcp-currency`* |
| [mcp-timezone](servers/timezone/README.md) | ![timezone](assets/demo-timezone.gif) | Convert times across cities, find meeting slots everyone can make, write the invite | `npx -y @theluckystrike/mcp-timezone`* |
| [mcp-docx](servers/docx/README.md) | ![docx](assets/demo-docx.gif) | Write real Word documents from chat: proposals, contracts, letters and templates | `npx -y @theluckystrike/mcp-docx`* |

\* npm publish is still pending for all six packages (see npm status below). Until then, the fastest path is the
`.mcpb` one-click bundle from the
[latest release](https://github.com/theluckystrike/mcp-servers/releases/latest) -- double-click it in Claude
Desktop and it installs, no terminal needed. Or clone and build:
`git clone https://github.com/theluckystrike/mcp-servers.git && cd mcp-servers`, `npm install`,
`npm run build -w packages/mcp-license -w servers/<name>`. Each server's README has the full 60-second install
with all three client configs.

Buy Pro: https://mcp.zovo.one  (keys verify offline with Ed25519; no phone-home).

## Hosted endpoints (no install)

Five of the six servers are also live behind streamable HTTP, for clients that connect to a URL instead of
spawning a local process:

- Base URL: `https://mcp.zovo.one/mcp` -- `GET` returns an index of the endpoints; each server is
  `https://mcp.zovo.one/mcp/<server>` (time-tracker, price-tracker, spreadsheet, invoice, expense-tracker).
- Auth: `Authorization: Bearer <token>`. `GET https://mcp.zovo.one/mcp/token` mints a free anonymous token
  (`anon_<32 hex>`, 30-day KV TTL, refreshed on every request); a Pro license key (`MCPL1....`) works the same
  way and lifts the free-tier limits.
- `spreadsheet` runs in inline-data mode remotely, since a hosted worker has no disk to read a path from:
  `sheet_load {name, csv}` or `sheet_load {name, xlsx_base64}` loads the data into the request's virtual
  filesystem first, then `sheet_query`, `sheet_stats`, `sheet_add_column` and `sheet_convert` work on it as
  usual. The stdio install is still the answer for files that live on your own disk.
- Anything a tool would normally write to a file (an invoice PDF, a CSV export, a converted spreadsheet) comes
  back as a download link, `https://mcp.zovo.one/mcp/download/<token>`, valid for one hour; invoices render as
  an HTML document rather than a PDF on this path.
- office-suite is not hosted: it is a stdio proxy that spawns the other five as local child processes, which
  has no meaning on a remote worker. Install it locally to get all five in one config line instead.

## Registry names

The MCP registry listing for all six of these servers uses word-rich names instead of the plain directory
name, for example `time-tracker-timesheet-billable-hours` instead of `time-tracker`, or
`office-suite-time-invoice-expense-excel-price` instead of `office-suite`: every extra token is a word the
server's own tool descriptions already use, and registry search matches on whole words, so a name built only
from `time-tracker` was invisible to a search for "timesheet" or "billable hours". The old short names are
deprecated on the registry; npm package names, directory names and checkout URLs are unchanged.

## Why these six

The median MCP server on the public registry gets installed and never called again. Looking at what actually gets
used, two things separate the servers people keep: a config snippet that works on the first try, and a visible
demo of the tool actually answering a real prompt before anyone installs it. Both of those are cheap to provide and
most servers skip them -- READMEs bury the config three scroll-lengths down, or show no output at all. These servers
were picked because they replace a task people already do in a spreadsheet, a SaaS dashboard or a browser
tab (tracking time, watching a price, editing a sheet, cutting an invoice, logging a receipt) with one that runs
entirely on-device: no account, no telemetry, no server-side data at rest (the hosted endpoints are the one
exception, and they say plainly what they keep and for how long). office-suite exists because the most-used
server in this category, measured across the registry, is an aggregator: one install beats five.

## Guides

- [Track time in Claude Code](https://mcp.zovo.one/guides/track-time-in-claude-code)
- [Invoice PDF from chat](https://mcp.zovo.one/guides/invoice-pdf-from-chat)
- [Read Excel in Cursor](https://mcp.zovo.one/guides/read-excel-in-cursor)
- [Price drop alerts with Claude](https://mcp.zovo.one/guides/price-drop-alerts-with-claude)
- [Expense tracking in Claude](https://mcp.zovo.one/guides/expense-tracking-in-claude)
- [MCP server free vs pro](https://mcp.zovo.one/guides/mcp-server-free-vs-pro)

## Validation

Before anything ships: 186 unit tests across the six servers and the shared license package (protocol smoke
tests over real stdio, plus adversarial cases: bad input, oversized strings, path traversal, concurrent
writers, zero-byte files), a 121-check live validation database run against the built servers and the hosted
worker, three rounds of user-value testing through a real MCP client (one prompt per conversation, not a unit
test), and an independent adversarial review plus a separate Codex model review of the billing and remote
worker code. Details: [docs/AUDIT.md](docs/AUDIT.md), [docs/EXPENSE_AUDIT.md](docs/EXPENSE_AUDIT.md),
[docs/USER_VALUE.md](docs/USER_VALUE.md), [docs/USER_VALUE_R2.md](docs/USER_VALUE_R2.md),
[docs/USER_VALUE_R3.md](docs/USER_VALUE_R3.md), [docs/CODEX_REVIEW.md](docs/CODEX_REVIEW.md),
[docs/CODEX_REVIEW_REMOTE.md](docs/CODEX_REVIEW_REMOTE.md), [docs/REMOTE_RESULT.md](docs/REMOTE_RESULT.md).

## npm status

None of the six packages are on npm yet (the account's publish token is dead; see
[docs/NPM_AUTH_RESULT.md](docs/NPM_AUTH_RESULT.md)). The working install paths today are the `.mcpb` one-click
bundle from the [latest release](https://github.com/theluckystrike/mcp-servers/releases/latest), a clone and
build from source, or the hosted endpoints above -- no local install at all. The `npx` lines in this README and
in each server's own README start working the moment npm publish succeeds; nothing else about them changes.

Repository layout: `servers/*` one package per server, `packages/mcp-license` shared licensing, `billing/` Cloudflare Worker
that sells keys through Stripe Checkout, `remote/` Cloudflare Worker serving the hosted endpoints, `dashboard/` status page, `docs/` runbooks.

Built by theluckystrike. https://github.com/theluckystrike  Support: support@zovo.one
