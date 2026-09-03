# Installing mcp-currency (agent instructions)

This file tells an AI coding agent exactly how to install this MCP server. No account and no API key are required. The only outbound request it ever makes is to www.ecb.europa.eu for the two public exchange rate files; after the first download it answers from a local cache and works offline.

Server: **Currency** (@theluckystrike/mcp-currency)
What it does: Convert currencies and read exchange rate history from the European Central Bank daily reference rates. No API key, no account. Rates are cached locally and the server works offline after the first download.
Source: https://github.com/theluckystrike/mcp-servers/tree/main/servers/currency
License: MIT. Support: support@zovo.one

## Status of the npm package

The npm package `@theluckystrike/mcp-currency` is not published yet. Until it is, the `npx` command below will fail with E404. Use **Alternative B - from source** further down, which is the supported path today, and keep the same client config with `"command": "node"` and the absolute path to `dist/index.js`. Everything else on this page is unchanged.

## Prerequisites

- Node.js 18 or newer on PATH (`node --version`).
- No native build tools. The package is pure JavaScript.

## Step 1 - the run command

```sh
npx -y @theluckystrike/mcp-currency
```

The server speaks MCP over stdio. It prints one readiness line to stderr and nothing to stdout except protocol traffic. Do not run it interactively as a check; the client starts it.

## Step 2 - write the client config

### Claude Desktop

File: macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json`.
Merge this entry into the existing `mcpServers` object; do not overwrite the file.

```json
{
  "mcpServers": {
    "currency": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-currency"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add currency -- npx -y @theluckystrike/mcp-currency
```

### Cursor

File: `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project). Same entry as Claude Desktop.

### Cline

File: `cline_mcp_settings.json` (VS Code: Cline panel -> MCP Servers -> Configure MCP Servers). Merge:

```json
{
  "mcpServers": {
    "currency": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-currency"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Step 3 - restart the client and verify

Restart the client, then call `license_status`. A successful call returns the current mode (free or pro) and proves the transport works. `tools/list` must show the tool table from the server README.

## Optional - Pro key

A Pro key removes the free-tier limits listed in the README. Either add it to the config:

```json
"env": { "MCP_LICENSE_KEY": "MCPL1..." }
```

or call the `license_activate` tool once with the key. Keys are verified offline; nothing is sent anywhere. Keys: https://mcp.zovo.one/buy/currency

## Alternative A - .mcpb bundle (Claude Desktop one-click)

Download `currency.mcpb` from https://github.com/theluckystrike/mcp-servers/releases and open it, or drag it onto the Claude Desktop Extensions pane. This installs the server without editing JSON and without Node on PATH assumptions.

## Alternative B - from source

```sh
git clone https://github.com/theluckystrike/mcp-servers
cd mcp-servers
npm install
npm run build
```

Then use `"command": "node", "args": ["<abs path>/mcp-servers/servers/currency/dist/index.js"]`.

## Alternative C - Docker

```sh
docker buildx build -f servers/currency/Dockerfile -t mcp-currency .
```

The build context is the repository root. Run with `docker run -i --rm -v mcp-currency-data:/root/.local/share/mcp-servers mcp-currency`.

## Troubleshooting

- `command not found: npx` - install Node.js 18+.
- Tools missing after config edit - the client only reads the config at startup; restart it fully.
- Restricted outbound access: set `ECB_BASE_URL` to a mirror that serves `eurofxref-daily.xml` and `eurofxref-hist.xml`.
- Data location: `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/currency/`. Deleting that directory resets the server.

Built by theluckystrike (https://github.com/theluckystrike).
