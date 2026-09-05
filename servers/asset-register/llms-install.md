# Installing mcp-asset-register (agent instructions)

This file tells an AI coding agent exactly how to install this MCP server. No account, no API key, no network service is required.

Server: **Fixed asset register** (@theluckystrike/mcp-asset-register)
What it does: Keep a fixed asset register and depreciate it on bundled public tax tables (the Polish annual rates from the annex to the CIT and PIT acts keyed to the KST classification, the UK capital allowance pools with the annual investment allowance, and the US MACRS GDS half-year tables for 3, 5 and 7 year property). Adds an asset, builds the schedule year by year or month by month, journals a month, records a disposal with its gain or loss, and reports net book value per category and currency. All data stays on the local machine and no rate is ever fetched at run time.
Source: https://github.com/theluckystrike/mcp-servers/tree/main/servers/asset-register
License: MIT. Support: support@zovo.one

## Status of the npm package

The npm package `@theluckystrike/mcp-asset-register` is not published yet. Until it is, the `npx` command below will fail with E404. Use **Alternative B - from source** further down, which is the supported path today, and keep the same client config with `"command": "node"` and the absolute path to `dist/index.js`. Everything else on this page is unchanged.

## Prerequisites

- Node.js 18 or newer on PATH (`node --version`).
- No native build tools. The package is pure JavaScript.

## Step 1 - the run command

```sh
npx -y @theluckystrike/mcp-asset-register
```

The server speaks MCP over stdio. It writes nothing to stdout except protocol traffic. Do not run it interactively as a check; the client starts it.

## Step 2 - write the client config

### Claude Desktop

File: macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json`.
Merge this entry into the existing `mcpServers` object; do not overwrite the file.

```json
{
  "mcpServers": {
    "asset-register": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-asset-register"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add asset-register -- npx -y @theluckystrike/mcp-asset-register
```

### Cursor

File: `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project). Same entry as Claude Desktop.

### Cline

File: `cline_mcp_settings.json` (VS Code: Cline panel -> MCP Servers -> Configure MCP Servers). Merge:

```json
{
  "mcpServers": {
    "asset-register": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-asset-register"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Step 3 - restart the client and verify

Restart the client, then call `license_status`. A successful call returns the current mode (free or pro) and proves the transport works. Then read the `assets://categories` resource: it must return the three bundled tables, each with a header naming the authority, the instrument and its source URL. Then call `asset_schedule {"scheme": "us", "category": "5-year", "cost_minor": 1000000, "currency": "USD", "purchase_date": "2026-01-05", "method": "declining-balance"}`: the six periods must be 200000, 320000, 192000, 115200, 115200 and 57600 minor units, which is the published IRS Table A-1 row. `tools/list` must show the eight tools from the server README.

## Optional - Pro key

A Pro key removes the free-tier limits listed in the README. Either add it to the config:

```json
"env": { "MCP_LICENSE_KEY": "MCPL1..." }
```

or call the `license_activate` tool once with the key. Keys are verified offline; nothing is sent anywhere. Keys: https://mcp.zovo.one/buy/asset-register

## Alternative A - .mcpb bundle (Claude Desktop one-click)

Download `asset-register.mcpb` from https://github.com/theluckystrike/mcp-servers/releases and open it, or drag it onto the Claude Desktop Extensions pane. This installs the server without editing JSON and without Node on PATH assumptions.

## Alternative B - from source

```sh
git clone https://github.com/theluckystrike/mcp-servers
cd mcp-servers
npm install
npm run build -w servers/timezone -w packages/mcp-license -w servers/asset-register
```

Build `servers/timezone` before `servers/asset-register`: the corrupt-store quarantine comes from it, and `mcp-license` reads the shared business profile through it.
Then use `"command": "node", "args": ["<abs path>/mcp-servers/servers/asset-register/dist/index.js"]`.

## Alternative C - Docker

```sh
docker buildx build -f servers/asset-register/Dockerfile -t mcp-asset-register .
```

The build context is the repository root. Run with `docker run -i --rm -v mcp-asset-register-data:/root/.local/share/mcp-servers mcp-asset-register`.

## Troubleshooting

- `command not found: npx` - install Node.js 18+.
- Tools missing after config edit - the client only reads the config at startup; restart it fully.
- `"... is not a category in the bundled table"` - the tables are deliberately partial. A value that could not be stated with confidence from the published text was omitted rather than guessed; see the README table for what is in and what is out. This is not a lookup bug. Pass `life_years` or `rate_pct` to depreciate something the table does not cover.
- `"... may not use the declining-balance method"` - the scheme excludes that class from the method (Polish passenger cars and buildings, for instance). Use `method: "straight-line"`.
- `"cost must be greater than zero"` after passing a decimal - `cost_minor`, `residual_minor` and `proceeds_minor` are MINOR units. 5499.00 is `549900`, not `5499`.
- Data location: the register and the id counter in `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/asset-register/`. The rate tables live inside the installed package, not in the data dir. `asset_journal` never writes to the expense-tracker store; it returns the `expense_add` arguments to run against that server.

Built by theluckystrike (https://github.com/theluckystrike).
