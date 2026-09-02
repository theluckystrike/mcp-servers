# Installing mcp-office-suite (agent instructions)

This file tells an AI coding agent exactly how to install this MCP server. No account, no API key, no network service is required for the free tier.

Server: **Office Suite** (@theluckystrike/mcp-office-suite)
What it does: One stdio server that proxies four sibling servers -- time-tracker, price-tracker, spreadsheet and invoice -- so a client only needs one config entry to get every tool from all four. See the README for the full tool table.
Source: https://github.com/theluckystrike/mcp-servers/tree/main/servers/office-suite
License: MIT. Support: support@zovo.one

## Status of the npm package

The npm package `@theluckystrike/mcp-office-suite` is not published yet, and neither are its four dependencies. Until they are, the `npx` command below will fail with E404. Use **Alternative B - from source** further down, which is the supported path today, and keep the same client config with `"command": "node"` and the absolute path to `dist/index.js`. Everything else on this page is unchanged.

## Prerequisites

- Node.js 18 or newer on PATH (`node --version`).
- No native build tools. The package is pure JavaScript; it spawns its four sibling servers as child processes over stdio.

## Step 1 - the run command

```sh
npx -y @theluckystrike/mcp-office-suite
```

The server speaks MCP over stdio. It prints one readiness line to stderr and nothing to stdout except protocol traffic. Do not run it interactively as a check; the client starts it.

## Step 2 - write the client config

### Claude Desktop

File: macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json`.
Merge this entry into the existing `mcpServers` object; do not overwrite the file.

```json
{
  "mcpServers": {
    "office-suite": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-office-suite"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add office-suite -- npx -y @theluckystrike/mcp-office-suite
```

### Cursor

File: `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project). Same entry as Claude Desktop.

### Cline

File: `cline_mcp_settings.json` (VS Code: Cline panel -> MCP Servers -> Configure MCP Servers). Merge:

```json
{
  "mcpServers": {
    "office-suite": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-office-suite"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Step 3 - restart the client and verify

Restart the client, then call `license_status`. A successful call returns the current free/pro mode for every proxied server and proves the transport, and all four child transports, work. `tools/list` must show the combined tool table from the README (every tool of time-tracker, price-tracker, spreadsheet and invoice, plus exactly one `license_status` and one `license_activate`).

## Optional - Pro key

A single Pro bundle key removes the free-tier limits of all four servers at once. Either add it to the config:

```json
"env": { "MCP_LICENSE_KEY": "MCPL1..." }
```

or call the `license_activate` tool once with the key; it is forwarded to every child server. Keys are verified offline; nothing is sent anywhere. Keys: https://mcp.zovo.one/buy/bundle

## Alternative A - .mcpb bundle (Claude Desktop one-click)

Download `office-suite.mcpb` from https://github.com/theluckystrike/mcp-servers/releases and open it, or drag it onto the Claude Desktop Extensions pane.

## Alternative B - from source

```sh
git clone https://github.com/theluckystrike/mcp-servers
cd mcp-servers
npm install
npm run build
```

Then use `"command": "node", "args": ["<abs path>/mcp-servers/servers/office-suite/dist/index.js"]`.

This server resolves its four children at startup as sibling packages: inside this monorepo it looks for `../../<name>/dist/index.js` next to its own package, so `npm run build` (which builds every workspace) must run before it, in this repo, before the office-suite build.

## Alternative C - Docker

```sh
docker buildx build -f servers/office-suite/Dockerfile -t mcp-office-suite .
```

The build context is the repository root. Run with `docker run -i --rm -v mcp-office-suite-data:/root/.local/share/mcp-servers mcp-office-suite`.

## Troubleshooting

- `command not found: npx` - install Node.js 18+.
- Tools missing after config edit - the client only reads the config at startup; restart it fully.
- `fatal: could not resolve entry for required child <name>` - one of the four sibling packages was not built or not installed next to this one; rebuild from source (Alternative B) or reinstall.
- If one of the four child servers crashes mid-session, office-suite restarts it once and logs the event to stderr; its tools keep working. A second crash of the same child is reported, not retried again.
- Data location: each proxied server keeps its own data under `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/<name>/` (time-tracker, price-tracker, spreadsheet, invoice), unchanged from running that server standalone.

Built by theluckystrike (https://github.com/theluckystrike).
