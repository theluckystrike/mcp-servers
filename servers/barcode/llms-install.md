# Installing mcp-barcode (agent instructions)

This file tells an AI coding agent exactly how to install this MCP server. No account, no API key, no network service is required.

Server: **QR codes and barcodes** (@theluckystrike/mcp-barcode)
What it does: Draw QR codes (text, URL, WiFi join, vCard, EPC SEPA payment code) and linear barcodes (Code 128, EAN-13, EAN-8, UPC-A) as SVG or PNG files, entirely offline.
Source: https://github.com/theluckystrike/mcp-servers/tree/main/servers/barcode
License: MIT. Support: support@zovo.one

## Status of the npm package

The npm package `@theluckystrike/mcp-barcode` is not published yet. Until it is, the `npx` command below will fail with E404. Use **Alternative B - from source** further down, which is the supported path today, and keep the same client config with `"command": "node"` and the absolute path to `dist/index.js`.

## Prerequisites

- Node.js 18 or newer on PATH (`node --version`).
- No native build tools. The package is pure JavaScript.

## Step 1 - the run command

```sh
npx -y @theluckystrike/mcp-barcode
```

The server speaks MCP over stdio. It prints one readiness line to stderr and nothing to stdout except protocol traffic. Do not run it interactively as a check; the client starts it.

## Step 2 - write the client config

### Claude Desktop

File: macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json`.
Merge this entry into the existing `mcpServers` object; do not overwrite the file.

```json
{
  "mcpServers": {
    "barcode": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-barcode"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add barcode -- npx -y @theluckystrike/mcp-barcode
```

### Cursor

File: `.cursor/mcp.json` in the project, or `~/.cursor/mcp.json` globally. Same JSON as Claude Desktop.

## Alternative B - from source

```sh
git clone https://github.com/theluckystrike/mcp-servers
cd mcp-servers
npm install
npm run build --workspace @theluckystrike/mcp-barcode
```

Then point the client at the built entry point:

```json
{
  "mcpServers": {
    "barcode": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-servers/servers/barcode/dist/index.js"]
    }
  }
}
```

## Step 3 - optional Pro key

Set `MCP_LICENSE_KEY` in the server's `env` block, or call the `license_activate` tool once with the key. Free tier: 20 codes per calendar month, SVG output. Pro: unlimited codes, PNG at any size, `barcode_batch`.

## Step 4 - verify

Restart the client and ask it to run `license_status`, then `barcode_create` with `symbology: "code128"` and `value: "TEST-1"`. A successful call returns the symbol as inline SVG. Nothing leaves the machine.

## Notes for the agent

- Data lives in `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/barcode/`. Deleting `codes.json` resets the register and this month's free count.
- `out_path` is a normal filesystem path. Directories, missing parents and an existing file without `overwrite: true` are refused with a sentence; nothing is written in those cases.
- PNG output always needs `out_path`; the server never returns base64 image data.
