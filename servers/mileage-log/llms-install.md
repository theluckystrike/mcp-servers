# Installing mcp-mileage-log (agent instructions)

This file tells an AI coding agent exactly how to install this MCP server. No account, no API key, no network service is required.

Server: **Mileage log** (@theluckystrike/mcp-mileage-log)
What it does: The mileage log freelancers need at tax time, kept the moment the drive happens. `trip_add` logs one drive: the date, where from and to, the distance in miles or km, the purpose and the category (business, medical, moving, charitable, personal), and returns a `TR-YYYY-NNNN` id. `rate_set` records what one mile or km is worth for one category in one jurisdiction from a date forward, as an effective-dated series. `mileage_summary` prices every trip at the rate in force on the day it was driven, per category and per currency, and `mileage_export` hands the log to an accountant as CSV. Trips with no applicable rate are listed with the reason, never silently dropped. No rate ships with the server and none of it is tax advice: the rates you set are your own figures to verify.
Source: https://github.com/theluckystrike/mcp-servers/tree/main/servers/mileage-log
License: MIT. Support: support@zovo.one

## Status of the npm package

The npm package `@theluckystrike/mcp-mileage-log` is not published yet. Until it is, the `npx` command below will fail with E404. Use **Alternative B - from source** further down, which is the supported path today, and keep the same client config with `"command": "node"` and the absolute path to `dist/index.js`. Everything else on this page is unchanged.

## Prerequisites

- Node.js 18 or newer on PATH (`node --version`).
- No native dependencies. The package is pure JavaScript.
- No sibling server is required at runtime. This one opens no other server's store.

## Step 1 - the run command

```sh
npx -y @theluckystrike/mcp-mileage-log
```

The server speaks MCP over stdio. It writes nothing to stdout except protocol traffic. Do not run it interactively as a check; the client starts it.

## Step 2 - write the client config

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS), `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "mileage-log": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-mileage-log"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add mileage-log -- npx -y @theluckystrike/mcp-mileage-log
```

### Cursor

`~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project). Same entry as Claude Desktop.

## Alternative A - .mcpb bundle (Claude Desktop one-click)

Download `mileage-log.mcpb` from https://github.com/theluckystrike/mcp-servers/releases and open it, or drag it onto the Claude Desktop Extensions pane. This installs the server without editing JSON and without Node on PATH assumptions.

## Alternative B - from source

```sh
git clone https://github.com/theluckystrike/mcp-servers
cd mcp-servers
npm install
npm run build --workspace @theluckystrike/mcp-mileage-log
```

Then point the client at the built entry:

```json
{
  "mcpServers": {
    "mileage-log": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-servers/servers/mileage-log/dist/index.js"]
    }
  }
}
```

## Step 3 - the optional licence key

The free tier holds 20 trips per calendar month, counted on the month of the trip date, so reconstructing last year's log at tax time does not consume this month's allowance. The trip list and the summary are never metered, and one rate per jurisdiction and category is free (overwriting it stays free). A Pro key lifts the monthly cap, adds the year-over-year rate series, and unlocks the CSV export. Set it as `MCP_LICENSE_KEY` in the server's `env` block, or call `license_activate` once and it is stored in `~/.config/mcp-servers/license.json`.

```json
{
  "mcpServers": {
    "mileage-log": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-mileage-log"],
      "env": { "MCP_LICENSE_KEY": "MCPL1...." }
    }
  }
}
```

Keys are verified offline against a bundled public key. Nothing is sent anywhere. Keys: https://mcp.zovo.one/buy/mileage-log

## Step 4 - verify

Ask the assistant to call `license_status`. It answers with the tier and where the key came from. Then ask it to call `rate_set` with a jurisdiction, a category, a rate, a unit, a currency and an effective-from date, and `trip_add` with a past date, from, to, a distance, a unit, a purpose and a category; a `TR-YYYY-NNNN` id comes back. `mileage_summary` then prices the trip. `tools/list` must show the nine tools from the server README.

## Where data lives

`${XDG_DATA_HOME:-~/.local/share}/mcp-servers/mileage-log/`, as `trips.json`, `rates.json` and `counter.json`. Nothing else on the machine is written. There is no telemetry and no network call in this server.

## Troubleshooting

- `command not found: npx` - install Node.js 18+.
- Tools missing after a config edit - the client only reads the config at startup; restart it fully.
- `the free tier holds 20 trips per calendar month` - the cap is counted on the month of the trip date, so trips dated in another month still log.
- A trip dated in the future is refused: it cannot have been driven yet. Distances in miles and in km are kept apart and never added together; a trip whose unit differs from the rate's is converted first (1 mile = 1.609344 km exactly).
- When more than one jurisdiction has a rate for a category, `trip_add` asks which prices the trip: pass `jurisdiction`.
- A trip id is never reissued: a gap in the TR series is the record that a trip was removed.

Built by theluckystrike (https://github.com/theluckystrike).
