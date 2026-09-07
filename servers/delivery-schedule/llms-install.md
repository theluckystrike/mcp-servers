# Installing mcp-delivery-schedule (agent instructions)

This file tells an AI coding agent exactly how to install this MCP server. No account, no API key, no network service is required.

Server: **Delivery Schedule** (@theluckystrike/mcp-delivery-schedule)
What it does: Dated deliverables against a quote, a work order or a change order. A schedule names its reference, that document's own date, the client and a title. Each deliverable carries what is being handed over, the day it is due, its value in whole minor units when it is separately priced, and a dated status history that runs planned to in progress to delivered to accepted, with the client's acceptance note on the accepted move. `late_report` says what has slipped as at a date you name, worst first, with the value at risk per currency. `milestone_payload` turns the delivered-and-accepted deliverables into `invoice_create`-ready items in MAJOR units and `quote_create`-ready items in MINOR units at once. Nothing derived is stored: the current status, the delivered date, the lateness and every total are worked out on the call.
Source: https://github.com/theluckystrike/mcp-servers/tree/main/servers/delivery-schedule
License: MIT. Support: support@zovo.one

## Status of the npm package

The npm package `@theluckystrike/mcp-delivery-schedule` is not published yet. Until it is, the `npx` command below will fail with E404. Use **Alternative B - from source** further down, which is the supported path today, and keep the same client config with `"command": "node"` and the absolute path to `dist/index.js`. Everything else on this page is unchanged.

## Prerequisites

- Node.js 18 or newer on PATH (`node --version`).
- No native dependencies. The package is pure JavaScript.
- No sibling server is required at runtime. This one reads a single file it does not own, read-only and best-effort: the shared business profile (default currency, default VAT rate, business name), which the invoice server's `business_set` writes. It is never written. The quotes, work-order and change-order stores are NOT opened; the reference is named by its id and that document's own date is stated once on the schedule.

## Step 1 - the run command

```sh
npx -y @theluckystrike/mcp-delivery-schedule
```

The server speaks MCP over stdio. It writes nothing to stdout except protocol traffic. Do not run it interactively as a check; the client starts it.

## Step 2 - write the client config

### Claude Desktop

File: macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json`.
Merge this entry into the existing `mcpServers` object; do not overwrite the file.

```json
{
  "mcpServers": {
    "delivery-schedule": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-delivery-schedule"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add delivery-schedule -- npx -y @theluckystrike/mcp-delivery-schedule
```

### Cursor

File: `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project). Same entry as Claude Desktop.

### Cline

File: `cline_mcp_settings.json` (VS Code: Cline panel -> MCP Servers -> Configure MCP Servers). Merge:

```json
{
  "mcpServers": {
    "delivery-schedule": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-delivery-schedule"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Step 3 - restart the client and verify

Restart the client, then call `license_status`. A successful call returns the current mode (free or pro) and proves the transport works. Then read the `deliveryschedule://contract` resource: it states the four stored statuses and the legal moves, why late is not one of them, the two payload scales, the free-tier limits and the one directory this server writes.

Then run the worked check. `delivery_schedule_create` with `reference` WO-2026-0011, `reference_date` 2026-04-01, `client` Harbour Cafe, `title` Website rebuild. Then `deliverable_add` with `description` Copy for the five main pages, `due_date` 2026-04-20 and `value_minor` 47988. Then `late_report` twice on the same store:

- `as_of` 2026-04-22 must come back with `late_count` 1 and `days_late` 2.
- `as_of` 2026-04-19 must come back with `late_count` 0 and `not_yet_due_count` 1.

Two answers from one store is the point of the server, not a bug. `tools/list` must show the twelve tools from the server README.

## Optional - Pro key

A Pro key removes the free-tier limits listed in the README. Either add it to the config:

```json
"env": { "MCP_LICENSE_KEY": "MCPL1..." }
```

or call the `license_activate` tool once with the key. Keys are verified offline; nothing is sent anywhere. Keys: https://mcp.zovo.one/buy/delivery-schedule

## Alternative A - .mcpb bundle (Claude Desktop one-click)

Download `delivery-schedule.mcpb` from https://github.com/theluckystrike/mcp-servers/releases and open it, or drag it onto the Claude Desktop Extensions pane. This installs the server without editing JSON and without Node on PATH assumptions.

## Alternative B - from source

```sh
git clone https://github.com/theluckystrike/mcp-servers
cd mcp-servers
npm install
npm run build --workspaces --if-present
```

The money arithmetic and the date helpers are imported from `mcp-invoice`, the timezone-aware "today" from `mcp-quotes` and the corrupt-store quarantine from `mcp-timezone`, so build the workspaces before this server rather than this server alone.
Then use `"command": "node", "args": ["<abs path>/mcp-servers/servers/delivery-schedule/dist/index.js"]`.

## Alternative C - Docker

```sh
docker buildx build -f servers/delivery-schedule/Dockerfile -t mcp-delivery-schedule .
```

The build context is the repository root. Run with `docker run -i --rm -v mcp-servers-data:/root/.local/share/mcp-servers mcp-delivery-schedule`.

## Troubleshooting

- `command not found: npx` - install Node.js 18+.
- Tools missing after config edit - the client only reads the config at startup; restart it fully.
- The same deliverable reads late in one report and delivered late in another - that is correct. Every reading is as at `as_of`, and the two reports were run for different dates. Check `as_of` and `as_of_source` in the answer; `as_of_source` is `today` when nothing was passed.
- Nothing is late but you expected something to be - a deliverable due on `as_of` is not late yet, it is in `due_today`. Pass the day after to see it as late.
- `"is planned and has not been delivered"` - a deliverable is not accepted directly. Record the delivery first, with the day it was handed over, then the acceptance.
- `"and this move is dated ..., before it"` - a move cannot predate the reference document's own date or the previous move on that deliverable. Fix the date, or the `reference_date` on the schedule.
- `"already has a delivery schedule"` - one reference carries one schedule, because two would give two answers to what is late on it. Add the deliverables to the schedule the refusal names.
- `"the free tier holds 3 open delivery schedules"` - a schedule stops counting once every deliverable on it is accepted, and an empty one can be deleted. Both stay free.
- `milestone_payload` came back with fewer items than you expected - it carries only what was DELIVERED and then ACCEPTED by `as_of`. What was left out is listed under `excluded`, with an accepted deliverable that carries no `value_minor` under `accepted_but_unpriced`; nothing is billed as zero.
- The invoice came out 100x the milestone - the two payloads are in different scales on purpose. `invoice_create.arguments.items` carry `unit_price` in MAJOR units and `quote_create.arguments.items` carry `unit_price_minor` in MINOR units. Pass the payload that matches the tool you are calling; do not move a field between them.
- Data location: this server writes only `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/delivery-schedule/` (`schedules.json`, `counter.json`) and nothing else anywhere. `milestone_payload` creates no invoice and no quote; call `invoice_create` or `quote_create` yourself with the matching arguments.

Built by theluckystrike (https://github.com/theluckystrike).
