# Installing mcp-packing-list (agent instructions)

This file tells an AI coding agent exactly how to install this MCP server. No account, no API key, no network service is required.

Server: **Packing List** (@theluckystrike/mcp-packing-list)
What it does: Packing slips for a shipment. A packing list is raised against an order you name, the lines that order says should ship are declared on it with `packing_expect`, cartons are added with a tare weight and their outside dimensions, and goods go into cartons one `pack_item` call at a time. `packing_shortfall` reports every line as short, complete, over-packed, or packed and not on the order at all. `carton_report` gives the tare, net, gross, volume, volumetric and chargeable weight per carton and for the shipment, at a divisor of 4000, 5000 or 6000 cm3 per kg. The slip carries no prices; the invoice against the same order is a separate document in the invoice server. Mass is in whole grams and dimensions in whole centimetres. Nothing derived is stored.
Source: https://github.com/theluckystrike/mcp-servers/tree/main/servers/packing-list
License: MIT. Support: support@zovo.one

## Status of the npm package

The npm package `@theluckystrike/mcp-packing-list` is not published yet. Until it is, the `npx` command below will fail with E404. Use **Alternative B - from source** further down, which is the supported path today, and keep the same client config with `"command": "node"` and the absolute path to `dist/index.js`. Everything else on this page is unchanged.

## Prerequisites

- Node.js 18 or newer on PATH (`node --version`).
- No native dependencies. The package is pure JavaScript.
- No sibling server is required at runtime. This one reads a single file it does not own, read-only and best-effort: the shared business profile (business name and address), which the invoice server's `business_set` writes. It is never written. The quotes, work-order and invoice stores are NOT opened; the order is named by id and what it says should ship is declared with `packing_expect`.

## Step 1 - the run command

```sh
npx -y @theluckystrike/mcp-packing-list
```

The server speaks MCP over stdio. It writes nothing to stdout except protocol traffic. Do not run it interactively as a check; the client starts it.

## Step 2 - write the client config

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS), `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "packing-list": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-packing-list"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add packing-list -- npx -y @theluckystrike/mcp-packing-list
```

### Cursor

`~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project). Same entry as Claude Desktop.

## Alternative B - from source

```sh
git clone https://github.com/theluckystrike/mcp-servers
cd mcp-servers
npm install
npm run build --workspace @theluckystrike/mcp-packing-list
```

Then point the client at the built entry:

```json
{
  "mcpServers": {
    "packing-list": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-servers/servers/packing-list/dist/index.js"]
    }
  }
}
```

## Step 3 - the optional licence key

The free tier holds 3 open packing lists and answers everything else, the packing slip text
included. A Pro key lifts the cap and lets `packing_slip` write a .txt file to `out_path`.
Set it as `MCP_LICENSE_KEY` in the server's `env` block, or call `license_activate` once and
it is stored in `~/.config/mcp-servers/license.json`.

```json
{
  "mcpServers": {
    "packing-list": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-packing-list"],
      "env": { "MCP_LICENSE_KEY": "MCPL1...." }
    }
  }
}
```

Keys are verified offline against a bundled public key. Nothing is sent anywhere.

## Step 4 - verify

Ask the assistant to call `license_status`. It answers with the tier and where the key came
from. Then ask it to call `packing_list_create` with an order reference and a consignee; a
`PL-YYYY-NNNN` number comes back.

## Where data lives

`${XDG_DATA_HOME:-~/.local/share}/mcp-servers/packing-list/`, as `packing-lists.json` and
`counter.json`. Nothing else on the machine is written, except a slip file when you pass
`out_path`. There is no telemetry and no network call in this server.
