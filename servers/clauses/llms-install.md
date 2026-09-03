# Installing mcp-clauses (agent instructions)

This file tells an AI coding agent exactly how to install this MCP server. No account, no API key, no network service is required.

Server: **Contract clause library** (@theluckystrike/mcp-clauses)
What it does: Keeps a searchable library of reusable contract and proposal clauses with {{variables}}, ships 25 generic freelance starters, and assembles a selection into a real Word .docx or a markdown file with the variables filled and every missing fact left as a bracketed prompt. All files stay on the local machine.
Source: https://github.com/theluckystrike/mcp-servers/tree/main/servers/clauses
License: MIT. Support: support@zovo.one

Note for the agent: the clauses are generic templates, not legal advice. Say so when you present assembled output to the user; the server prints the same line at the top of every document it writes.

## Status of the npm package

The npm package `@theluckystrike/mcp-clauses` is not published yet. Until it is, the `npx` command below will fail with E404. Use **Alternative B - from source** further down, which is the supported path today, and keep the same client config with `"command": "node"` and the absolute path to `dist/index.js`. Everything else on this page is unchanged.

## Prerequisites

- Node.js 18 or newer on PATH (`node --version`).
- No native build tools. Document assembly runs through `@theluckystrike/mcp-docx`, which is pure JavaScript.

## Step 1 - the run command

```sh
npx -y @theluckystrike/mcp-clauses
```

The server speaks MCP over stdio. It prints one readiness line to stderr and nothing to stdout except protocol traffic. Do not run it interactively as a check; the client starts it.

## Step 2 - write the client config

### Claude Desktop

File: macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json`.
Merge this entry into the existing `mcpServers` object; do not overwrite the file.

```json
{
  "mcpServers": {
    "clauses": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-clauses"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add clauses -- npx -y @theluckystrike/mcp-clauses
```

### Cursor

File: `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project). Same entry as Claude Desktop.

### Cline

File: `cline_mcp_settings.json` (VS Code: Cline panel -> MCP Servers -> Configure MCP Servers). Merge:

```json
{
  "mcpServers": {
    "clauses": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-clauses"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Step 3 - restart the client and verify

Restart the client, then call `license_status`. A successful call returns the current mode (free or pro) and proves the transport works. `tools/list` must show the twelve tools from the server README. Calling `clause_list` on a fresh install returns the 25 starter clauses.

## Optional - Pro key

A Pro key removes the free-tier limits listed in the README (10 own clauses, 8 clauses per assembled document, no JSON import/export, no jurisdiction or tag filters, no clause version history). Either add it to the config:

```json
"env": { "MCP_LICENSE_KEY": "MCPL1..." }
```

or call the `license_activate` tool once with the key. Keys are verified offline; nothing is sent anywhere. Keys: https://mcp.zovo.one/buy/clauses

## Alternative A - .mcpb bundle (Claude Desktop one-click)

Download `clauses.mcpb` from https://github.com/theluckystrike/mcp-servers/releases and open it, or drag it onto the Claude Desktop Extensions pane. This installs the server without editing JSON and without Node on PATH assumptions.

## Alternative B - from source

```sh
git clone https://github.com/theluckystrike/mcp-servers
cd mcp-servers
npm install
npm run build -w packages/mcp-license -w servers/docx -w servers/clauses
```

`servers/docx` is built on purpose: this server has no document engine of its own, it imports `@theluckystrike/mcp-docx/lib`.

Then use `"command": "node", "args": ["<abs path>/mcp-servers/servers/clauses/dist/index.js"]`.

## Alternative C - Docker

```sh
docker buildx build -f servers/clauses/Dockerfile -t mcp-clauses .
```

The build context is the repository root. Run with `docker run -i --rm -v mcp-clauses-data:/root/.local/share/mcp-servers mcp-clauses`.

## Troubleshooting

- `command not found: npx` - install Node.js 18+.
- Tools missing after config edit - the client only reads the config at startup; restart it fully.
- `Cannot find package '@theluckystrike/mcp-docx'` after a source build - run the build command above, which builds the docx workspace too.
- A deleted starter clause does not come back. Seeding runs once, on the first load; `clause_import` can restore clauses from an export.
- Data location: `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/clauses/`. Deleting that directory resets the library to the 25 starters; documents written elsewhere are not touched.
- If `data.json` is ever unparseable the server quarantines it as `data.json.corrupt-<timestamp>`, writes a `data.json.corrupt` marker and refuses every call until the marker is removed. Nothing is overwritten.

Built by theluckystrike (https://github.com/theluckystrike).
