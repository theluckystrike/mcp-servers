# Installing mcp-maintenance-log (agent instructions)

This file tells an AI coding agent exactly how to install this MCP server. No account, no API key, no network service is required.

Server: **Maintenance log** (@theluckystrike/mcp-maintenance-log)
What it does: One local register of the equipment you look after and the work done on it. `asset_add` records a machine with its name, serial or asset tag, location and currency, and returns an `AST-YYYY-NNNN` id. `maintenance_log` records each service or repair: the day, what was done, the cost in whole cents, who did it, and when the next service falls due, as a date or as an interval in days. `maintenance_due` is the report: what is overdue and by how many days, what falls due within the next N days, computed from the stored dates at the moment you ask, so it can never go stale. `asset_history` reads one asset's whole log with its total spend, and `maintenance_export` hands a date range over as CSV or a Markdown summary per asset.
Source: https://github.com/theluckystrike/mcp-servers/tree/main/servers/maintenance-log
License: MIT. Support: support@zovo.one

## Status of the npm package

The npm package `@theluckystrike/mcp-maintenance-log` is not published yet. Until it is, the `npx` command below will fail with E404. Use **Alternative B - from source** further down, which is the supported path today, and keep the same client config with `"command": "node"` and the absolute path to `dist/index.js`. Everything else on this page is unchanged.

## Prerequisites

- Node.js 18 or newer on PATH (`node --version`).
- No native dependencies. The package is pure JavaScript.
- No sibling server is required at runtime. This one opens no other server's store.

## Step 1 - the run command

```sh
npx -y @theluckystrike/mcp-maintenance-log
```

The server speaks MCP over stdio. It writes nothing to stdout except protocol traffic. Do not run it interactively as a check; the client starts it.

## Step 2 - write the client config

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS), `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "maintenance-log": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-maintenance-log"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add maintenance-log -- npx -y @theluckystrike/mcp-maintenance-log
```

### Cursor

`~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project). Same entry as Claude Desktop.

## Alternative A - .mcpb bundle (Claude Desktop one-click)

Download `maintenance-log.mcpb` from https://github.com/theluckystrike/mcp-servers/releases and open it, or drag it onto the Claude Desktop Extensions pane. This installs the server without editing JSON and without Node on PATH assumptions.

## Alternative B - from source

```sh
git clone https://github.com/theluckystrike/mcp-servers
cd mcp-servers
npm install
npm run build --workspace @theluckystrike/mcp-maintenance-log
```

Then point the client at the built entry:

```json
{
  "mcpServers": {
    "maintenance-log": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-servers/servers/maintenance-log/dist/index.js"]
    }
  }
}
```

## Step 3 - the optional licence key

The free tier holds 3 assets on the register, and logging work on the assets you have, the per-asset history with its total spend, and CSV export are free and unlimited on every tier. Removing an asset frees its slot. A Pro key lifts the asset cap and adds the due report and the Markdown summaries. Set it as `MCP_LICENSE_KEY` in the server's `env` block, or call `license_activate` once and it is stored in `~/.config/mcp-servers/license.json`.

```json
{
  "mcpServers": {
    "maintenance-log": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-maintenance-log"],
      "env": { "MCP_LICENSE_KEY": "MCPL1...." }
    }
  }
}
```

Keys are verified offline against a bundled public key. Nothing is sent anywhere. Keys: https://mcp.zovo.one/buy/maintenance-log

## Step 4 - verify

Ask the assistant to call `license_status`. It answers with the tier and where the key came from. Then ask it to call `asset_add` with a name and, optionally, a serial or tag; an `AST-YYYY-NNNN` id comes back. Log work against it with `maintenance_log` and read it back with `asset_history`. `tools/list` must show the eight tools from the server README.

## Where data lives

`${XDG_DATA_HOME:-~/.local/share}/mcp-servers/maintenance-log/`, as `assets.json` and `counter.json`. Nothing else on the machine is written. There is no telemetry and no network call in this server.

## Troubleshooting

- `command not found: npx` - install Node.js 18+.
- Tools missing after a config edit - the client only reads the config at startup; restart it fully.
- `the free tier holds 3 assets` - removing one you no longer look after frees its slot, and logging on the assets you have stays free on every tier.
- A serial or asset tag identifies one machine: adding a second asset with the same tag is refused; log against the asset that already carries it.
- Pass either `next_due` (a date) or `interval_days` (a number of days) to `maintenance_log`, never both: one says when, the other says after how long.
- `asset_remove` refuses an asset that carries a maintenance log unless `confirm: true`, because removing it loses the record of work done.

Built by theluckystrike (https://github.com/theluckystrike).
