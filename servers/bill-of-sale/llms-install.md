# Installing mcp-bill-of-sale (agent instructions)

This file tells an AI coding agent exactly how to install this MCP server. No account, no API key, no network service is required.

Server: **Bill of sale** (@theluckystrike/mcp-bill-of-sale)
What it does: Record a sale of equipment, a vehicle or stock and get a printable bill of sale with signature lines. `sale_create` stores seller, buyer, the item with its VIN, serial number or IMEI where it has one, the price in integer minor units and the date, and returns a `BOS-YYYY-NNNN` id. Work on it as a draft, `sale_finalize` freezes it into the signing copy, and `sale_render` prints it as Markdown or as a single self-contained HTML file that prints to PDF from any browser. Drafts render with a DRAFT watermark so a review copy cannot be signed by mistake. An identical repeat sale is refused unless it is confirmed. No total is stored; every figure is derived on the call.
Source: https://github.com/theluckystrike/mcp-servers/tree/main/servers/bill-of-sale
License: MIT. Support: support@zovo.one

## Status of the npm package

The npm package `@theluckystrike/mcp-bill-of-sale` is not published yet. Until it is, the `npx` command below will fail with E404. Use **Alternative B - from source** further down, which is the supported path today, and keep the same client config with `"command": "node"` and the absolute path to `dist/index.js`. Everything else on this page is unchanged.

## Prerequisites

- Node.js 18 or newer on PATH (`node --version`).
- No native dependencies. The package is pure JavaScript.
- No sibling server is required at runtime. This one reads a single file it does not own, read-only and best-effort: the shared business profile, which the invoice server's `business_set` writes, for the seller name. It is never written. No other store is opened.

## Step 1 - the run command

```sh
npx -y @theluckystrike/mcp-bill-of-sale
```

The server speaks MCP over stdio. It writes nothing to stdout except protocol traffic. Do not run it interactively as a check; the client starts it.

## Step 2 - write the client config

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS), `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "bill-of-sale": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-bill-of-sale"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add bill-of-sale -- npx -y @theluckystrike/mcp-bill-of-sale
```

### Cursor

`~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project). Same entry as Claude Desktop.

## Alternative A - .mcpb bundle (Claude Desktop one-click)

Download `bill-of-sale.mcpb` from https://github.com/theluckystrike/mcp-servers/releases and open it, or drag it onto the Claude Desktop Extensions pane. This installs the server without editing JSON and without Node on PATH assumptions.

## Alternative B - from source

```sh
git clone https://github.com/theluckystrike/mcp-servers
cd mcp-servers
npm install
npm run build --workspace @theluckystrike/mcp-bill-of-sale
```

Then point the client at the built entry:

```json
{
  "mcpServers": {
    "bill-of-sale": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-servers/servers/bill-of-sale/dist/index.js"]
    }
  }
}
```

## Step 3 - the optional licence key

The free tier holds 10 open drafts and 5 finalized documents, and rendering, listing, reading and deleting are free and unlimited on every tier. A Pro key lifts both record caps. Set it as `MCP_LICENSE_KEY` in the server's `env` block, or call `license_activate` once and it is stored in `~/.config/mcp-servers/license.json`.

```json
{
  "mcpServers": {
    "bill-of-sale": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-bill-of-sale"],
      "env": { "MCP_LICENSE_KEY": "MCPL1...." }
    }
  }
}
```

Keys are verified offline against a bundled public key. Nothing is sent anywhere. Keys: https://mcp.zovo.one/buy/bill-of-sale

## Step 4 - verify

Ask the assistant to call `license_status`. It answers with the tier and where the key came from. Then ask it to call `sale_create` with a seller, a buyer, an item description, a price in minor units and a date; a `BOS-YYYY-NNNN` id comes back. Call `sale_render` with that id and the Markdown comes back with a DRAFT watermark. `tools/list` must show the ten tools from the server README.

## Where data lives

`${XDG_DATA_HOME:-~/.local/share}/mcp-servers/bill-of-sale/`, as `sales.json` and `counter.json`, plus rendered documents under `documents/`. Nothing else on the machine is written. There is no telemetry and no network call in this server.

## Troubleshooting

- `command not found: npx` - install Node.js 18+.
- Tools missing after a config edit - the client only reads the config at startup; restart it fully.
- `the free tier holds 10 drafts` - `sale_delete` frees a slot and `sale_finalize` turns a draft into the signing copy, and both stay free.
- A VIN that is not 17 characters or an IMEI that is not 15 digits is stored as given and flagged in the response, because those are the two identifiers a buyer most often misreads.
- `is already this sale, to the byte` - the same seller, buyer, item, price and date is already recorded. Pass `duplicate_ok: true` if the same item really was sold twice.
- The rendered document is a generic template, not legal advice. Bills of sale for vehicles, boats and regulated goods may have statutory form or filing requirements where the sale happens.

Built by theluckystrike (https://github.com/theluckystrike).
