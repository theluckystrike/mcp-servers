# Installing mcp-change-order (agent instructions)

This file tells an AI coding agent exactly how to install this MCP server. No account, no API key, no network service is required.

Server: **Change Order** (@theluckystrike/mcp-change-order)
What it does: Change orders against a quote or a work order. A change order names its reference, its client and a title, and carries added, removed and changed lines, each with a quantity, a unit price in minor units, a reason and a date. It moves draft to sent to approved or rejected (or void), each step dated. `contract_value` gives the running value of a reference: the original plus APPROVED deltas, with pending draft and sent deltas shown separately and never added in. `change_order_invoice_payload` turns an approved delta into `invoice_create`-ready items in MAJOR units and `quote_create`-ready items in MINOR units at once. No delta is stored; the first change order against a reference states the original value once and every later one inherits it.
Source: https://github.com/theluckystrike/mcp-servers/tree/main/servers/change-order
License: MIT. Support: support@zovo.one

## Status of the npm package

The npm package `@theluckystrike/mcp-change-order` is not published yet. Until it is, the `npx` command below will fail with E404. Use **Alternative B - from source** further down, which is the supported path today, and keep the same client config with `"command": "node"` and the absolute path to `dist/index.js`. Everything else on this page is unchanged.

## Prerequisites

- Node.js 18 or newer on PATH (`node --version`).
- No native dependencies. The package is pure JavaScript.
- No sibling server is required at runtime. This one reads a single file it does not own, read-only and best-effort: the shared business profile (default currency, default VAT rate, business name), which the invoice server's `business_set` writes. It is never written. The quotes and work-order stores are NOT opened; the reference is named by id and its original value is stated on the first change order.

## Step 1 - the run command

```sh
npx -y @theluckystrike/mcp-change-order
```

The server speaks MCP over stdio. It writes nothing to stdout except protocol traffic. Do not run it interactively as a check; the client starts it.

## Step 2 - write the client config

### Claude Desktop

File: macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json`.
Merge this entry into the existing `mcpServers` object; do not overwrite the file.

```json
{
  "mcpServers": {
    "change-order": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-change-order"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add change-order -- npx -y @theluckystrike/mcp-change-order
```

### Cursor

File: `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project). Same entry as Claude Desktop.

### Cline

File: `cline_mcp_settings.json` (VS Code: Cline panel -> MCP Servers -> Configure MCP Servers). Merge:

```json
{
  "mcpServers": {
    "change-order": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-change-order"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Step 3 - restart the client and verify

Restart the client, then call `license_status`. A successful call returns the current mode (free or pro) and proves the transport works. Then read the `changeorder://contract` resource: it states the five statuses and the legal moves, how the running value is built, the two payload scales, the free-tier limits and the one directory this server writes. Then run the worked check: `change_order_create` with `reference` Q-2026-0003, `client` Harbour Cafe, `title` Second page, `date` 2026-03-10 and `original_value_minor` 2000000; then `change_order_add_line` with `kind` changed, `description` Website audit, `quantity` 5, `unit_price_minor` 42000, `was_quantity` 3, `was_unit_price_minor` 45000 and a `reason`; then `contract_value` for Q-2026-0003. It must come back with `current_value_minor` 2000000 (the draft is pending, not part of the contract) and `pending_delta_minor` 75000. `tools/list` must show the eleven tools from the server README.

## Optional - Pro key

A Pro key removes the free-tier limits listed in the README. Either add it to the config:

```json
"env": { "MCP_LICENSE_KEY": "MCPL1..." }
```

or call the `license_activate` tool once with the key. Keys are verified offline; nothing is sent anywhere. Keys: https://mcp.zovo.one/buy/change-order

## Alternative A - .mcpb bundle (Claude Desktop one-click)

Download `change-order.mcpb` from https://github.com/theluckystrike/mcp-servers/releases and open it, or drag it onto the Claude Desktop Extensions pane. This installs the server without editing JSON and without Node on PATH assumptions.

## Alternative B - from source

```sh
git clone https://github.com/theluckystrike/mcp-servers
cd mcp-servers
npm install
npm run build --workspaces --if-present
```

The money and VAT arithmetic is imported from `mcp-invoice`, the timezone-aware "today" from `mcp-quotes` and the corrupt-store quarantine from `mcp-timezone`, so build the workspaces before this server rather than this server alone.
Then use `"command": "node", "args": ["<abs path>/mcp-servers/servers/change-order/dist/index.js"]`.

## Alternative C - Docker

```sh
docker buildx build -f servers/change-order/Dockerfile -t mcp-change-order .
```

The build context is the repository root. Run with `docker run -i --rm -v mcp-servers-data:/root/.local/share/mcp-servers mcp-change-order`.

## Troubleshooting

- `command not found: npx` - install Node.js 18+.
- Tools missing after config edit - the client only reads the config at startup; restart it fully.
- The invoice came out 100x the delta - the two payloads are in different scales on purpose. `invoice_create.arguments.items` carry `unit_price` in MAJOR units and `quote_create.arguments.items` carry `unit_price_minor` in MINOR units. Pass the payload that matches the tool you are calling; do not move a field between them.
- `"has no change order yet, so original_value_minor is required"` - the first change order against a reference states the contract value before any change, net of VAT, in whole minor units. Every later one inherits it.
- `"original value is on file as ..."` - a later change order stated a different original value. Omit `original_value_minor` to inherit the figure on file.
- `"is draft and has not been sent"` - a draft cannot be approved or rejected directly. Move it to sent first, with the day it went out.
- `"a line can only be added to a draft"` - once sent, the client is looking at the document. Void it and raise a new one with every line.
- `"the free tier holds 5 open change orders"` - approve, reject or void one, or delete an empty draft. All of those are free on every tier.
- `quote_create.ready` is false - the delta carries a removal or a reversal, and `quote_create` refuses a quantity that is not greater than zero. Invoice the delta, or re-quote the job whole in the quotes server.
- Data location: this server writes only `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/change-order/` (`change-orders.json`, `counter.json`) and nothing else anywhere. `change_order_invoice_payload` creates no invoice and no quote; call `invoice_create` or `quote_create` yourself with the matching arguments.

Built by theluckystrike (https://github.com/theluckystrike).
