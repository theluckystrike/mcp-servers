# Installing mcp-backlink-checker (agent instructions)

This file tells an AI coding agent exactly how to install this MCP server. No account, no API key, no network service is required.

Server: **Backlink Checker** (@theluckystrike/mcp-backlink-checker)
What it does: Fetches a referring page live and reports whether it links to a target domain, dofollow or nofollow, the anchor text, HTTP status, and page-level robots guards (meta robots / X-Robots-Tag noindex, nofollow). `link_check` covers one URL, `link_audit` a list with a per-URL table, `robots_guard_check` the guards alone. Every tool is a read; the page is fetched at call time and nothing is stored.
Source: https://github.com/theluckystrike/mcp-servers/tree/main/servers/backlink-checker
License: MIT. Support: support@zovo.one

## Status of the npm package

The npm package `@theluckystrike/mcp-backlink-checker` is not published yet. Until it is, the `npx` command below will fail with E404. Use **Alternative B - from source** further down, which is the supported path today, and keep the same client config with `"command": "node"` and the absolute path to `dist/index.js`.

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
    "backlink-checker": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-backlink-checker"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add backlink-checker -- npx -y @theluckystrike/mcp-backlink-checker
```

### Cursor

`~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project). Same entry as Claude Desktop.

## Alternative B - from source

```sh
git clone https://github.com/theluckystrike/mcp-servers
cd mcp-servers
npm install
npm run build --workspace @theluckystrike/mcp-backlink-checker
```

Then point the client at the built entry:

```json
{
  "mcpServers": {
    "backlink-checker": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-servers/servers/backlink-checker/dist/index.js"]
    }
  }
}
```

## Step 3 - the optional licence key

The free tier runs `link_check` and `robots_guard_check` without limit and `link_audit` up to 3 URLs per call. A Pro key ($19, once) lifts the `link_audit` cap. Set it as `MCP_LICENSE_KEY` in the server's `env` block, or call `license_activate` once and it is stored in `~/.config/mcp-servers/license.json`.

```json
{
  "mcpServers": {
    "backlink-checker": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-backlink-checker"],
      "env": { "MCP_LICENSE_KEY": "MCPL1...." }
    }
  }
}
```

Keys are verified offline against a bundled public key. Nothing is sent anywhere by the licence check.

## Step 4 - verify

Ask the assistant to call `license_status`. It answers with the tier and where the key came from. Then ask it to call `link_check` with a page URL and a target domain; it fetches the page and answers with the status, indexability, and every link to that domain with its rel attribute and anchor text.

## Where data lives

Nowhere. This server makes no network call except the one URL per check it was asked to fetch, writes no file, and keeps no store. There is no telemetry.
