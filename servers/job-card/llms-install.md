# Installing mcp-job-card (agent instructions)

This file tells an AI coding agent exactly how to install this MCP server. No account, no API key, no network service is required.

Server: **Job card** (@theluckystrike/mcp-job-card)
What it does: One card per job, the way the paper one on the dashboard works. `job_card_create` opens a card for the client, the site, what the job is, the currency and the scheduled date, and returns a `JC-YYYY-NNNN` id. `job_card_log_labor` and `job_card_log_material` record the hours each worker puts in at their rate and the materials that go into the job, and the card keeps the running totals in integer cents. `job_card_update_status` moves the card one step at a time, open to in_progress to done to invoiced to archived, stamping date and note into its history. `job_card_print` renders the card with a signature line for client sign-off, as Markdown or self-contained HTML. `job_card_summary` answers a day or a week: cards touched, hours per worker, value per currency.
Source: https://github.com/theluckystrike/mcp-servers/tree/main/servers/job-card
License: MIT. Support: support@zovo.one

## Status of the npm package

The npm package `@theluckystrike/mcp-job-card` is not published yet. Until it is, the `npx` command below will fail with E404. Use **Alternative B - from source** further down, which is the supported path today, and keep the same client config with `"command": "node"` and the absolute path to `dist/index.js`. Everything else on this page is unchanged.

## Prerequisites

- Node.js 18 or newer on PATH (`node --version`).
- No native dependencies. The package is pure JavaScript.
- No sibling server is required at runtime. This one opens no other server's store.

## Step 1 - the run command

```sh
npx -y @theluckystrike/mcp-job-card
```

The server speaks MCP over stdio. It writes nothing to stdout except protocol traffic. Do not run it interactively as a check; the client starts it.

## Step 2 - write the client config

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS), `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "job-card": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-job-card"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add job-card -- npx -y @theluckystrike/mcp-job-card
```

### Cursor

`~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project). Same entry as Claude Desktop.

## Alternative A - .mcpb bundle (Claude Desktop one-click)

Download `job-card.mcpb` from https://github.com/theluckystrike/mcp-servers/releases and open it, or drag it onto the Claude Desktop Extensions pane. This installs the server without editing JSON and without Node on PATH assumptions.

## Alternative B - from source

```sh
git clone https://github.com/theluckystrike/mcp-servers
cd mcp-servers
npm install
npm run build --workspace @theluckystrike/mcp-job-card
```

Then point the client at the built entry:

```json
{
  "mcpServers": {
    "job-card": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-servers/servers/job-card/dist/index.js"]
    }
  }
}
```

## Step 3 - the optional licence key

The free tier holds 10 active job cards, and logging, totals, printing and the daily and weekly summaries are free and unlimited on every tier. A card stops counting the moment it is archived. A Pro key lifts the active-card cap. Set it as `MCP_LICENSE_KEY` in the server's `env` block, or call `license_activate` once and it is stored in `~/.config/mcp-servers/license.json`.

```json
{
  "mcpServers": {
    "job-card": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-job-card"],
      "env": { "MCP_LICENSE_KEY": "MCPL1...." }
    }
  }
}
```

Keys are verified offline against a bundled public key. Nothing is sent anywhere. Keys: https://mcp.zovo.one/buy/job-card

## Step 4 - verify

Ask the assistant to call `license_status`. It answers with the tier and where the key came from. Then ask it to call `job_card_create` with a client, a site, a description and a currency; a `JC-YYYY-NNNN` id comes back. Log an hour with `job_card_log_labor` and print the card with `job_card_print`. `tools/list` must show the eleven tools from the server README.

## Where data lives

`${XDG_DATA_HOME:-~/.local/share}/mcp-servers/job-card/`, as `cards.json` and `counter.json`. Nothing else on the machine is written. There is no telemetry and no network call in this server.

## Troubleshooting

- `command not found: npx` - install Node.js 18+.
- Tools missing after a config edit - the client only reads the config at startup; restart it fully.
- `the free tier holds 10 active cards` - archiving a finished card frees its slot, and logging, totals, printing and summaries stay free on every tier.
- `job_card_delete` refuses a card holding labor or materials, because that card is the record of work done. Archive it instead.
- A labor line is hours times the hourly rate rounded half-up to the cent once, at the moment it is logged, and totals are the sums of those stored line values, so a total can never drift from its lines. Currencies are never added together.

Built by theluckystrike (https://github.com/theluckystrike).
