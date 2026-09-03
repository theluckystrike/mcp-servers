# Installing mcp-pdf (agent instructions)

This file tells an AI coding agent exactly how to install this MCP server. No account, no API key, no network service is required.

Server: **PDF pages** (@theluckystrike/mcp-pdf)
What it does: Merges, splits, extracts, rotates, reorders and stamps PDF pages, puts the shared business name and VAT id in the footer, counts pages across files, and reads PDF text back on a best-effort basis. Every file stays on the local machine; inputs are never modified.
Source: https://github.com/theluckystrike/mcp-servers/tree/main/servers/pdf
License: MIT. Support: support@zovo.one

## Status of the npm package

The npm package `@theluckystrike/mcp-pdf` is not published yet. Until it is, the `npx` command below will fail with E404. Use **Alternative B - from source** further down, which is the supported path today, and keep the same client config with `"command": "node"` and the absolute path to `dist/index.js`. Everything else on this page is unchanged.

## Prerequisites

- Node.js 18 or newer on PATH (`node --version`).
- No native build tools. The only runtime dependency beyond the MCP SDK is `pdf-lib`, which is pure JavaScript. Text extraction uses `node:zlib` and a content-stream parser in this repository; there is no `pdfjs` and no OCR.

## Step 1 - the run command

```sh
npx -y @theluckystrike/mcp-pdf
```

The server speaks MCP over stdio. It prints one readiness line to stderr and nothing to stdout except protocol traffic. Do not run it interactively as a check; the client starts it.

## Step 2 - write the client config

### Claude Desktop

File: macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json`.
Merge this entry into the existing `mcpServers` object; do not overwrite the file.

```json
{
  "mcpServers": {
    "pdf": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-pdf"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add pdf -- npx -y @theluckystrike/mcp-pdf
```

### Cursor

File: `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project). Same entry as Claude Desktop.

### Cline

File: `cline_mcp_settings.json` (VS Code: Cline panel -> MCP Servers -> Configure MCP Servers). Merge:

```json
{
  "mcpServers": {
    "pdf": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-pdf"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Step 3 - restart the client and verify

Restart the client, then call `license_status`. A successful call returns the current mode (free or pro) and proves the transport works. `tools/list` must show twelve tools: `pdf_info`, `pdf_count`, `pdf_merge`, `pdf_split`, `pdf_pages`, `pdf_rotate`, `pdf_stamp`, `pdf_watermark_business`, `pdf_text`, `pdf_reorder`, `license_status`, `license_activate`.

## Optional - Pro key

A Pro key removes the free-tier limits listed in the README (5 files per merge, 30 pages for split/pages/rotate, the PAID and DRAFT stamp presets only, no business footer, no reorder). Either add it to the config:

```json
"env": { "MCP_LICENSE_KEY": "MCPL1..." }
```

or call the `license_activate` tool once with the key. Keys are verified offline; nothing is sent anywhere. Keys: https://mcp.zovo.one/buy/pdf

## Alternative A - .mcpb bundle (Claude Desktop one-click)

Download `pdf.mcpb` from https://github.com/theluckystrike/mcp-servers/releases and open it, or drag it onto the Claude Desktop Extensions pane. This installs the server without editing JSON and without Node on PATH assumptions.

## Alternative B - from source

```sh
git clone https://github.com/theluckystrike/mcp-servers
cd mcp-servers
npm install
npm run build
```

Then use `"command": "node", "args": ["<abs path>/mcp-servers/servers/pdf/dist/index.js"]`.

## Alternative C - Docker

```sh
docker buildx build -f servers/pdf/Dockerfile -t mcp-pdf .
```

The build context is the repository root. Run with `docker run -i --rm -v mcp-pdf-data:/root/.local/share/mcp-servers -v "$PWD":/work -w /work mcp-pdf` - the container can only touch PDFs on a path you mount.

## Behaviour an agent must know before calling the tools

- Every tool writes a **new** file and never modifies its input. There is no in-place mode.
- An `out_path` that already exists is refused with `already exists and nothing was written`. Pass `overwrite: true` only when the user asked for the original to be replaced.
- Encrypted PDFs are refused by every writing tool. Do not retry; tell the user to remove the protection in a reader and pass the new file.
- Inputs over 100 MB are refused.
- Page numbers are 1-based everywhere. Ranges accept `1-3,5,7-` and an open-ended part runs to the last page.
- `pdf_text` is best effort: no OCR, and a custom font encoding returns glyph indices. The tool's own answer states which case occurred - relay it rather than presenting the output as complete text.
- Free-tier limits come back as normal answers with an upgrade line, not as errors, and nothing is written. Relay the message.

## Troubleshooting

- `command not found: npx` - install Node.js 18+.
- Tools missing after config edit - the client only reads the config at startup; restart it fully.
- `pdf_text` returned nothing - the page is a scan or uses a custom font encoding. There is no OCR in this server.
- Data location: `${XDG_DATA_HOME:-~/.local/share}/mcp-servers/pdf/`, which holds only the register of operations. Deleting it resets the history; your PDFs are not touched.

Built by theluckystrike (https://github.com/theluckystrike).
