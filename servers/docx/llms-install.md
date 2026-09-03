# Installing mcp-docx (agent instructions)

This file tells an AI coding agent exactly how to install this MCP server. No account, no API key, no network service is required.

Server: **Word documents** (@theluckystrike/mcp-docx)
What it does: Writes real Word .docx files - proposals, quotes, contracts, statements of work, letters - from chat, converts markdown to .docx, reads existing .docx back as text, and fills {{placeholders}} in .docx templates. All files stay on the local machine.
Source: https://github.com/theluckystrike/mcp-servers/tree/main/servers/docx
License: MIT. Support: support@zovo.one

## Status of the npm package

The npm package `@theluckystrike/mcp-docx` is not published yet. Until it is, the `npx` command below will fail with E404. Use **Alternative B - from source** further down, which is the supported path today, and keep the same client config with `"command": "node"` and the absolute path to `dist/index.js`. Everything else on this page is unchanged.

## Prerequisites

- Node.js 18 or newer on PATH (`node --version`).
- No native build tools. The only runtime dependency beyond the MCP SDK is `docx`, which is pure JavaScript.

## Step 1 - the run command

```sh
npx -y @theluckystrike/mcp-docx
```

The server speaks MCP over stdio. It prints one readiness line to stderr and nothing to stdout except protocol traffic. Do not run it interactively as a check; the client starts it.

## Step 2 - write the client config

### Claude Desktop

File: macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json`.
Merge this entry into the existing `mcpServers` object; do not overwrite the file.

```json
{
  "mcpServers": {
    "docx": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-docx"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add docx -- npx -y @theluckystrike/mcp-docx
```

### Cursor

File: `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project). Same entry as Claude Desktop.

### Cline

File: `cline_mcp_settings.json` (VS Code: Cline panel -> MCP Servers -> Configure MCP Servers). Merge:

```json
{
  "mcpServers": {
    "docx": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-docx"],
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

or call the `license_activate` tool once with the key. Keys are verified offline; nothing is sent anywhere. Keys: https://mcp.zovo.one/buy/docx

## Alternative A - .mcpb bundle (Claude Desktop one-click)

Download `docx.mcpb` from https://github.com/theluckystrike/mcp-servers/releases and open it, or drag it onto the Claude Desktop Extensions pane. This installs the server without editing JSON and without Node on PATH assumptions.

## Alternative B - from source

```sh
git clone https://github.com/theluckystrike/mcp-servers
cd mcp-servers
npm install
npm run build
```

Then use `"command": "node", "args": ["<abs path>/mcp-servers/servers/docx/dist/index.js"]`.

## Alternative C - Docker

```sh
docker buildx build -f servers/docx/Dockerfile -t mcp-docx .
```

The build context is the repository root. Run with `docker run -i --rm -v mcp-docx-data:/root/.local/share/mcp-servers mcp-docx`.

## Troubleshooting

- `command not found: npx` - install Node.js 18+.
- Tools missing after config edit - the client only reads the config at startup; restart it fully.
- There is no `doc_to_pdf`. Every pure-JS Word-to-PDF path needs a native dependency or a headless browser. Use `doc_to_html` and print the page to PDF from the browser.
- Data location: `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/docx/`. Deleting that directory resets the server; generated .docx files written elsewhere are not touched.

Built by theluckystrike (https://github.com/theluckystrike).
