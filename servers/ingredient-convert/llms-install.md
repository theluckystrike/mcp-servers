# Installing mcp-ingredient-convert (agent instructions)

This file tells an AI coding agent exactly how to install this MCP server. No account, no API key, no network service is required.

Server: **Ingredient Converter** (@theluckystrike/mcp-ingredient-convert)
What it does: `convert_ingredient` converts an amount of a named cooking ingredient between cups, tablespoons, teaspoons, milliliters, fluid ounces, grams and ounces using a per-ingredient density table (30+ ingredients, e.g. 1 cup all-purpose flour = 125 g). `scale_recipe` scales recipe lines by a factor into friendly fractions like 1 1/2 cups. `convert_bulk` converts many amounts at once and reports unknown ingredients per item. `decimal_to_fraction` and `fraction_to_decimal` handle the 1 1/2 cup style. `common_conversions` lists the most-googled conversions. `list_ingredients` dumps the density table with sources. All local, deterministic, no network.
Source: https://github.com/theluckystrike/mcp-servers/tree/main/servers/ingredient-convert
License: MIT. Support: support@zovo.one

## Status of the npm package

The npm package `@theluckystrike/mcp-ingredient-convert` is not published yet. Until it is, the `npx` command below will fail with E404. Use **Alternative B - from source** further down, which is the supported path today, and keep the same client config with `"command": "node"` and the absolute path to `dist/index.js`.

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
    "ingredient-convert": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-ingredient-convert"]
    }
  }
}
```

### Claude Code / CLI clients

```sh
claude mcp add ingredient-convert -- npx -y @theluckystrike/mcp-ingredient-convert
```

## Alternative B - from source (supported path today)

```sh
git clone https://github.com/theluckystrike/mcp-servers
cd mcp-servers/servers/ingredient-convert
npm install
npm run build
```

Then point the client at the built binary instead of npx:

```json
{
  "mcpServers": {
    "ingredient-convert": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-servers/servers/ingredient-convert/dist/index.js"]
    }
  }
}
```

## Verify

Ask the client: "convert 1 cup of all-purpose flour to grams". Expected: 125 g, with cups, tablespoons and ounces alongside. "list_ingredients" returns the full density table with sources.
