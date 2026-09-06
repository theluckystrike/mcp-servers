# Installing mcp-catalogue (agent instructions)

This file tells an AI coding agent exactly how to install this MCP server. No account, no API key, no network service is required.

Server: **Catalogue** (@theluckystrike/mcp-catalogue)
What it does: Keep one price list and one labour rate card that the quotes and invoice servers read by SKU. A SKU carries a code, a name, a unit, an optional VAT rate and price ROWS, each row a currency, a tier, a valid-from date and an amount in minor units. The price on a date is the latest valid_from at or before it. `lines_resolve` turns a list of sku and role lines into `invoice_create`-ready and `quote_create`-ready items, priced from the catalogue as of each line's date. An unknown code is refused by name; no price is ever invented.
Source: https://github.com/theluckystrike/mcp-servers/tree/main/servers/catalogue
License: MIT. Support: support@zovo.one

## Status of the npm package

The npm package `@theluckystrike/mcp-catalogue` is not published yet. Until it is, the `npx` command below will fail with E404. Use **Alternative B - from source** further down, which is the supported path today, and keep the same client config with `"command": "node"` and the absolute path to `dist/index.js`. Everything else on this page is unchanged.

## Prerequisites

- Node.js 18 or newer on PATH (`node --version`).
- No native dependencies. The package is pure JavaScript.
- No sibling server is required at runtime. This one reads a single file it does not own, read-only and best-effort: the shared business profile (default currency, default VAT rate, business name), which the invoice server's `business_set` writes. It is never written.

## Step 1 - the run command

```sh
npx -y @theluckystrike/mcp-catalogue
```

The server speaks MCP over stdio. It writes nothing to stdout except protocol traffic. Do not run it interactively as a check; the client starts it.

## Step 2 - write the client config

### Claude Desktop

File: macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json`.
Merge this entry into the existing `mcpServers` object; do not overwrite the file.

```json
{
  "mcpServers": {
    "catalogue": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-catalogue"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add catalogue -- npx -y @theluckystrike/mcp-catalogue
```

### Cursor

File: `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project). Same entry as Claude Desktop.

### Cline

File: `cline_mcp_settings.json` (VS Code: Cline panel -> MCP Servers -> Configure MCP Servers). Merge:

```json
{
  "mcpServers": {
    "catalogue": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-catalogue"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Step 3 - restart the client and verify

Restart the client, then call `license_status`. A successful call returns the current mode (free or pro) and proves the transport works. Then read the `catalogue://price-list` resource: it states how a price is chosen on a date, the two payload scales, the free-tier limits and the one directory this server writes. Then run the worked check: `sku_set` with `sku` WEB-AUDIT, `name` Website audit, `unit` each, `price_minor` 45000, `valid_from` 2026-01-01; then `sku_set` the same code at `price_minor` 49500 from 2026-07-01; then `sku_get` with `date` 2026-03-15. The price must come back 45000 from the 2026-01-01 row, with `superseded_by` naming 2026-07-01, not 49500. `tools/list` must show the twelve tools from the server README.

## Optional - Pro key

A Pro key removes the free-tier limits listed in the README. Either add it to the config:

```json
"env": { "MCP_LICENSE_KEY": "MCPL1..." }
```

or call the `license_activate` tool once with the key. Keys are verified offline; nothing is sent anywhere. Keys: https://mcp.zovo.one/buy/catalogue

## Alternative A - .mcpb bundle (Claude Desktop one-click)

Download `catalogue.mcpb` from https://github.com/theluckystrike/mcp-servers/releases and open it, or drag it onto the Claude Desktop Extensions pane. This installs the server without editing JSON and without Node on PATH assumptions.

## Alternative B - from source

```sh
git clone https://github.com/theluckystrike/mcp-servers
cd mcp-servers
npm install
npm run build --workspaces --if-present
```

The money and VAT arithmetic is imported from `mcp-invoice`, the A4 renderer from `mcp-billing-docs`, the timezone-aware "today" from `mcp-quotes` and the corrupt-store quarantine from `mcp-timezone`, so build the workspaces before this server rather than this server alone.
Then use `"command": "node", "args": ["<abs path>/mcp-servers/servers/catalogue/dist/index.js"]`.

## Alternative C - Docker

```sh
docker buildx build -f servers/catalogue/Dockerfile -t mcp-catalogue .
```

The build context is the repository root. Run with `docker run -i --rm -v mcp-servers-data:/root/.local/share/mcp-servers mcp-catalogue`.

## Troubleshooting

- `command not found: npx` - install Node.js 18+.
- Tools missing after config edit - the client only reads the config at startup; restart it fully.
- The invoice came out 100x the price - the two payloads are in different scales on purpose. `invoice_create.arguments.items` carry `unit_price` in MAJOR units and `quote_create.arguments.items` carry `unit_price_minor` in MINOR units. Pass the payload that matches the tool you are calling; do not move a field between them.
- `"has no EUR price at tier standard on ..."` - the date is before every row for that currency and tier. A price that did not exist yet is not a price, so nothing is invented. Ask for a later date, or run `sku_set` with an earlier `valid_from`.
- `"tier ... is a second price for the same product"` - price tiers are Pro. The free tier keeps one price list, `standard`.
- `"the free tier holds 25 SKUs"` - delete one that no rate card points at and that has never priced a resolved line. `sku_delete` is free on every tier.
- `"has priced N resolved line(s)"` - the code is on a document somebody sent, so it is not deleted. Reprice it to withdraw it from sale; the history stays true.
- `"already says exactly that"` - the call would change nothing. Change the price, the date or the tier, or leave it alone.
- Data location: this server writes only `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/catalogue/` (`skus.json`, `rates.json`, `register.json`, `counter.json`, `pdf/`) and nothing else anywhere. `lines_resolve` creates no invoice and no quote; call `invoice_create` or `quote_create` yourself with the matching arguments.

Built by theluckystrike (https://github.com/theluckystrike).
