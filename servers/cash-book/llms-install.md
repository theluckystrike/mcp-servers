# Installing mcp-cash-book (agent instructions)

This file tells an AI coding agent exactly how to install this MCP server. No account, no API key, no network service is required.

Server: **Cash book** (@theluckystrike/mcp-cash-book)
What it does: Derive one double-entry ledger from the books this suite already keeps: invoices, credit notes, purchase orders, deposits, expenses, the bank import and the fixed asset register. Every line carries the server, the document id and the date it came from. It proves the trial balance sums to zero to the minor unit, lists what a month leaves unposted or inconsistent, closes the month with a snapshot, and exports the lines as CSV. It reads those stores and writes to none of them.
Source: https://github.com/theluckystrike/mcp-servers/tree/main/servers/cash-book
License: MIT. Support: support@zovo.one

## Status of the npm package

The npm package `@theluckystrike/mcp-cash-book` is not published yet. Until it is, the `npx` command below will fail with E404. Use **Alternative B - from source** further down, which is the supported path today, and keep the same client config with `"command": "node"` and the absolute path to `dist/index.js`. Everything else on this page is unchanged.

## Prerequisites

- Node.js 18 or newer on PATH (`node --version`).
- No native dependencies. The package is pure JavaScript.
- Every sibling store is optional and all of them are read-only from here: `mcp-invoice`, `mcp-billing-docs`, `mcp-deposits`, `mcp-expense-tracker`, `mcp-bank-statement`, `mcp-asset-register`. A store that is not installed is absent from the ledger, which is not an error.

## Step 1 - the run command

```sh
npx -y @theluckystrike/mcp-cash-book
```

The server speaks MCP over stdio. It writes nothing to stdout except protocol traffic. Do not run it interactively as a check; the client starts it.

## Step 2 - write the client config

### Claude Desktop

File: macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json`.
Merge this entry into the existing `mcpServers` object; do not overwrite the file.

```json
{
  "mcpServers": {
    "cash-book": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-cash-book"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add cash-book -- npx -y @theluckystrike/mcp-cash-book
```

### Cursor

File: `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project). Same entry as Claude Desktop.

### Cline

File: `cline_mcp_settings.json` (VS Code: Cline panel -> MCP Servers -> Configure MCP Servers). Merge:

```json
{
  "mcpServers": {
    "cash-book": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-cash-book"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Step 3 - restart the client and verify

Restart the client, then call `license_status`. A successful call returns the current mode (free or pro) and proves the transport works. Then read the `ledger://accounts` resource: it lists the accounts, the seven sibling reads with `read: true` or `read: false` and a row count each, and the two files this server writes. Then call `trial_balance {from, to}` for a month you have documents in: it must come back with `balanced: true`, or with the offending documents named. `tools/list` must show the eight tools from the server README.

## Optional - Pro key

A Pro key removes the free-tier limits listed in the README. Either add it to the config:

```json
"env": { "MCP_LICENSE_KEY": "MCPL1..." }
```

or call the `license_activate` tool once with the key. Keys are verified offline; nothing is sent anywhere. Keys: https://mcp.zovo.one/buy/cash-book

## Alternative A - .mcpb bundle (Claude Desktop one-click)

Download `cash-book.mcpb` from https://github.com/theluckystrike/mcp-servers/releases and open it, or drag it onto the Claude Desktop Extensions pane. This installs the server without editing JSON and without Node on PATH assumptions.

## Alternative B - from source

```sh
git clone https://github.com/theluckystrike/mcp-servers
cd mcp-servers
npm install
npm run build -w servers/timezone -w packages/mcp-license -w servers/invoice -w servers/billing-docs -w servers/quotes -w servers/deposits -w servers/asset-register -w servers/statement-of-account -w servers/cash-book
```

Build the siblings before this server: the invoice ledger, the money formatting and the corrupt-store quarantine come from `mcp-invoice`, the credit notes and purchase orders from `mcp-billing-docs`, the deposit store from `mcp-deposits`, the payment reconstruction from `mcp-statement-of-account`, the depreciation schedules from `mcp-asset-register`, and the timezone-aware "today" from `mcp-quotes`.
Then use `"command": "node", "args": ["<abs path>/mcp-servers/servers/cash-book/dist/index.js"]`.

## Alternative C - Docker

```sh
docker buildx build -f servers/cash-book/Dockerfile -t mcp-cash-book .
```

The build context is the repository root. Run with `docker run -i --rm -v mcp-servers-data:/root/.local/share/mcp-servers mcp-cash-book`. Mount the SAME volume the other servers use, or there will be no books to derive a ledger from.

## Troubleshooting

- `command not found: npx` - install Node.js 18+.
- Tools missing after config edit - the client only reads the config at startup; restart it fully.
- `"the period holds documents in 2 currencies"` - pass `currency`. Currencies are never added together here; there is no exchange rate in this server, so one trial balance over two currencies would be an invented number that balances.
- `balanced: false` - read `offenders`. Each one names the entry, the source server and the source document whose own legs do not add up. The fix is in the server that owns that document; nothing here was adjusted to hide it.
- `"the free tier builds 3 periods a calendar month"` - rebuild a period already in the register at no cost, use `trial_balance` and `ledger_lines`, which are never metered, or activate a Pro key.
- A bank debit reported as unexplained - that is the intended output, not a failure. Cash is posted from the documents and the bank import is evidence; a bank line with no expense, refund or asset behind it is a payment nobody recorded.
- Data location: this server writes only `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/cash-book/periods.json` and `closes.json`. The invoices, credit notes, deposits, expenses, bank rows and assets live in their own servers' directories and are never written to from here.

Built by theluckystrike (https://github.com/theluckystrike).
