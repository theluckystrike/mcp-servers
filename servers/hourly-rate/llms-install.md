# Installing mcp-hourly-rate (agent instructions)

This file tells an AI coding agent exactly how to install this MCP server. No account, no API key, no network service is required.

Server: **Hourly Rate Calculator** (@theluckystrike/mcp-hourly-rate)
What it does: The minimum hourly rate a freelancer must charge to hit a desired after-tax annual income. `calculate_rate` takes desired income, business expenses, billable hours per week, weeks per year and the tax rate on profit, and reports the gross revenue needed, the billable hours per year, the minimum hourly rate and the pre-tax rate it was lifted from. `break_even` answers the narrower rate that covers expenses alone. `what_if` prices 2 to 12 scenarios side by side, highest rate first. Pure arithmetic: no store, no files, no network.
Source: https://github.com/theluckystrike/mcp-servers/tree/main/servers/hourly-rate
License: MIT. Support: support@zovo.one

## Status of the npm package

The npm package `@theluckystrike/mcp-hourly-rate` is not published yet. Until it is, the `npx` command below will fail with E404. Use **Alternative B - from source** further down, which is the supported path today, and keep the same client config with `"command": "node"` and the absolute path to `dist/index.js`.

## Prerequisites

- Node.js 18 or newer on PATH (`node --version`).
- No native dependencies. The package is pure JavaScript.
- No sibling server is required at runtime.

## Step 1 - the run command

The server speaks MCP over stdio. It writes nothing to stdout except protocol traffic. Do not run it interactively as a check; the client starts it.

## Step 2 - write the client config

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS), `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "hourly-rate": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-hourly-rate"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add hourly-rate -- npx -y @theluckystrike/mcp-hourly-rate
```

### Cursor

`~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project). Same entry as Claude Desktop.

## Alternative B - from source

```sh
git clone https://github.com/theluckystrike/mcp-servers
cd mcp-servers
npm install
npm run build --workspace @theluckystrike/mcp-hourly-rate
```

Then point the client at the built entry:

```json
{
  "mcpServers": {
    "hourly-rate": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-servers/servers/hourly-rate/dist/index.js"]
    }
  }
}
```

## Step 3 - there is no licence key

The whole server is free: three tools, no metering, no key. There is no `MCP_LICENSE_KEY` and nothing is gated.

## Step 4 - verify

Ask the assistant to call `calculate_rate` with a desired annual income of 60000, business expenses of 10000, 25 billable hours a week, 46 weeks and a 30 percent tax rate. It answers: 70,000 gross, 1,150 billable hours, a minimum hourly rate of $86.96 (pre-tax $60.87). Then ask `what_if` with the same numbers at 40 weeks to see the scenario table.

## Where data lives

Nowhere. The server opens no store, writes no file, makes no network call, and keeps no telemetry. Every answer is derived from the numbers in the call.
