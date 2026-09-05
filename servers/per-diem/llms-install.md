# Installing mcp-per-diem (agent instructions)

This file tells an AI coding agent exactly how to install this MCP server. No account, no API key, no network service is required.

Server: **Travel per diem** (@theluckystrike/mcp-per-diem)
What it does: Work out the daily travel allowance for a business trip on bundled public rate tables (the Polish delegation regulation domestic and per country, the HMRC benchmark scale rates, and the GSA CONUS standard M&IE and lodging), save the trips, total them per scheme and month, and hand back expense_add arguments for the mcp-expense-tracker server. All data stays on the local machine and no rate is ever fetched at run time.
Source: https://github.com/theluckystrike/mcp-servers/tree/main/servers/per-diem
License: MIT. Support: support@zovo.one

## Status of the npm package

The npm package `@theluckystrike/mcp-per-diem` is not published yet. Until it is, the `npx` command below will fail with E404. Use **Alternative B - from source** further down, which is the supported path today, and keep the same client config with `"command": "node"` and the absolute path to `dist/index.js`. Everything else on this page is unchanged.

## Prerequisites

- Node.js 18 or newer on PATH (`node --version`).
- No native build tools. The package is pure JavaScript.

## Step 1 - the run command

```sh
npx -y @theluckystrike/mcp-per-diem
```

The server speaks MCP over stdio. It prints one readiness line to stderr and nothing to stdout except protocol traffic. Do not run it interactively as a check; the client starts it.

## Step 2 - write the client config

### Claude Desktop

File: macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json`.
Merge this entry into the existing `mcpServers` object; do not overwrite the file.

```json
{
  "mcpServers": {
    "per-diem": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-per-diem"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add per-diem -- npx -y @theluckystrike/mcp-per-diem
```

### Cursor

File: `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project). Same entry as Claude Desktop.

### Cline

File: `cline_mcp_settings.json` (VS Code: Cline panel -> MCP Servers -> Configure MCP Servers). Merge:

```json
{
  "mcpServers": {
    "per-diem": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-per-diem"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Step 3 - restart the client and verify

Restart the client, then call `license_status`. A successful call returns the current mode (free or pro) and proves the transport works. Then call `perdiem_rates {"scheme": "pl"}`: it must return the bundled rates together with a header naming the regulation and its source URL. The traveller name comes from the shared business profile, which is set with `business_set` in the mcp-invoice server, not here. `tools/list` must show the eight tools from the server README.

## Optional - Pro key

A Pro key removes the free-tier limits listed in the README. Either add it to the config:

```json
"env": { "MCP_LICENSE_KEY": "MCPL1..." }
```

or call the `license_activate` tool once with the key. Keys are verified offline; nothing is sent anywhere. Keys: https://mcp.zovo.one/buy/per-diem

## Alternative A - .mcpb bundle (Claude Desktop one-click)

Download `per-diem.mcpb` from https://github.com/theluckystrike/mcp-servers/releases and open it, or drag it onto the Claude Desktop Extensions pane. This installs the server without editing JSON and without Node on PATH assumptions.

## Alternative B - from source

```sh
git clone https://github.com/theluckystrike/mcp-servers
cd mcp-servers
npm install
npm run build -w servers/timezone -w packages/mcp-license -w servers/per-diem
```

Build `servers/timezone` before `servers/per-diem`: the DST-aware datetime resolver and the corrupt-store quarantine come from it, and `mcp-license` reads the shared profile through it.
Then use `"command": "node", "args": ["<abs path>/mcp-servers/servers/per-diem/dist/index.js"]`.

## Alternative C - Docker

```sh
docker buildx build -f servers/per-diem/Dockerfile -t mcp-per-diem .
```

The build context is the repository root. Run with `docker run -i --rm -v mcp-per-diem-data:/root/.local/share/mcp-servers mcp-per-diem`.

## Troubleshooting

- `command not found: npx` - install Node.js 18+.
- Tools missing after config edit - the client only reads the config at startup; restart it fully.
- `"... is not in the bundled table"` - the tables are deliberately partial. A value that could not be stated with confidence from the published regulation was omitted rather than guessed; see the README table for what is in and what is out. This is not a lookup bug.
- `"... has no timezone"` - a per diem is counted in elapsed hours, so a bare `2026-05-04T08:00` is not an instant. Pass `timezone` (an IANA id) or write the offset into the datetime.
- Data location: trips and the id counter in `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/per-diem/`. The rate tables live inside the installed package, not in the data dir. `trip_export` never writes to the expense-tracker store; it returns the `expense_add` arguments to run against that server.

Built by theluckystrike (https://github.com/theluckystrike).
