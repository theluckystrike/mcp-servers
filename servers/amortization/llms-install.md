# Installing mcp-amortization (agent instructions)

This file tells an AI coding agent exactly how to install this MCP server. No account, no API key, no network service is required.

Server: **Amortization** (@theluckystrike/mcp-amortization)
What it does: Record a loan or a lease from its terms and derive everything from them: the level payment, the effective annual rate, the schedule period by period (opening, payment, interest, principal, closing), what settling or overpaying early costs and saves, the double entry for a payment, and what is owed per currency. Every amount is an integer number of minor units and every closing balance reaches the balloon, or zero, exactly.
Source: https://github.com/theluckystrike/mcp-servers/tree/main/servers/amortization
License: MIT. Support: support@zovo.one

## Status of the npm package

The npm package `@theluckystrike/mcp-amortization` is not published yet. Until it is, the `npx` command below will fail with E404. Use **Alternative B - from source** further down, which is the supported path today, and keep the same client config with `"command": "node"` and the absolute path to `dist/index.js`. Everything else on this page is unchanged.

## Prerequisites

- Node.js 18 or newer on PATH (`node --version`).
- No native dependencies. The package is pure JavaScript.
- No sibling server is required. This one reads no other store and writes into none.

## Step 1 - the run command

```sh
npx -y @theluckystrike/mcp-amortization
```

The server speaks MCP over stdio. It writes nothing to stdout except protocol traffic. Do not run it interactively as a check; the client starts it.

## Step 2 - write the client config

### Claude Desktop

File: macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json`.
Merge this entry into the existing `mcpServers` object; do not overwrite the file.

```json
{
  "mcpServers": {
    "amortization": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-amortization"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add amortization -- npx -y @theluckystrike/mcp-amortization
```

### Cursor

File: `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project). Same entry as Claude Desktop.

### Cline

File: `cline_mcp_settings.json` (VS Code: Cline panel -> MCP Servers -> Configure MCP Servers). Merge:

```json
{
  "mcpServers": {
    "amortization": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-amortization"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Step 3 - restart the client and verify

Restart the client, then call `license_status`. A successful call returns the current mode (free or pro) and proves the transport works. Then read the `loan://accounts` resource: it lists the three account ids a payment touches and the one directory this server writes. Then call `loan_create` with a known loan and check the payment: 1,000,000 minor units at 1200 basis points, compounded and paid monthly over 12 periods on the annuity method must return a payment of 88,849 and total interest of 66,188. `tools/list` must show the eight tools from the server README.

## Optional - Pro key

A Pro key removes the free-tier limits listed in the README. Either add it to the config:

```json
"env": { "MCP_LICENSE_KEY": "MCPL1..." }
```

or call the `license_activate` tool once with the key. Keys are verified offline; nothing is sent anywhere. Keys: https://mcp.zovo.one/buy/amortization

## Alternative A - .mcpb bundle (Claude Desktop one-click)

Download `amortization.mcpb` from https://github.com/theluckystrike/mcp-servers/releases and open it, or drag it onto the Claude Desktop Extensions pane. This installs the server without editing JSON and without Node on PATH assumptions.

## Alternative B - from source

```sh
git clone https://github.com/theluckystrike/mcp-servers
cd mcp-servers
npm install
npm run build -w servers/timezone -w packages/mcp-license -w servers/invoice -w servers/quotes -w servers/asset-register -w servers/amortization
```

Build the siblings before this server: the corrupt-store quarantine comes from `mcp-timezone`, the money formatting and the exact minor-unit allocator from `mcp-asset-register`, and the timezone-aware "today" from `mcp-quotes`.
Then use `"command": "node", "args": ["<abs path>/mcp-servers/servers/amortization/dist/index.js"]`.

## Alternative C - Docker

```sh
docker buildx build -f servers/amortization/Dockerfile -t mcp-amortization .
```

The build context is the repository root. Run with `docker run -i --rm -v mcp-servers-data:/root/.local/share/mcp-servers mcp-amortization`.

## Troubleshooting

- `command not found: npx` - install Node.js 18+.
- Tools missing after config edit - the client only reads the config at startup; restart it fully.
- `"the free tier holds 3 loans"` - every schedule stays free and unlimited; the meter is on agreements held. Delete nothing to work around it, activate a Pro key.
- `"term must be at least 1 period"` - the term is in PAYMENT PERIODS, not years. A five-year loan paid monthly is 60.
- A rate that looks wrong - `rate_bps` is the NOMINAL annual rate in basis points: 1200 is 12 percent. The effective annual rate comes back on the answer and is the larger number.
- `"the schedule closes at period N of M"` - not an error. The level payment is rounded to the minor unit once, and over a long schedule that repeated rounding clears the balance before the last period falls due. The schedule stops where the debt does.
- Data location: this server writes only `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/amortization/loans.json` and `counter.json`, and nothing else anywhere. The journal it produces is a payload for whoever owns the ledger; it is never posted from here.

Built by theluckystrike (https://github.com/theluckystrike).
