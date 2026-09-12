# Installing mcp-credit-note (agent instructions)

This file tells an AI coding agent exactly how to install this MCP server. No account, no API key, no network service is required.

Server: **Credit note** (@theluckystrike/mcp-credit-note)
What it does: Issue a credit note (credit memo) against an invoice or standalone: the recipient, the reason (returned goods, overcharge, discount correction, service issue, other), line items with quantity, unit price in integer minor units and tax rate, and the currency. Every credit note starts as a draft with a `CN-DRAFT-YYYY-NNNN` id; `credit_note_finalize` burns the final `CN-YYYY-NNNN` number and freezes it. `credit_note_render` returns Markdown to paste into an email or a self-contained printable HTML page, and `credit_note_summary` gives the totals credited per currency, reason and month. The line math is round half-up per line, then sum, so the printed document reproduces on a calculator.
Source: https://github.com/theluckystrike/mcp-servers/tree/main/servers/credit-note
License: MIT. Support: support@zovo.one

## Status of the npm package

The npm package `@theluckystrike/mcp-credit-note` is not published yet. Until it is, the `npx` command below will fail with E404. Use **Alternative B - from source** further down, which is the supported path today, and keep the same client config with `"command": "node"` and the absolute path to `dist/index.js`. Everything else on this page is unchanged.

## Prerequisites

- Node.js 18 or newer on PATH (`node --version`).
- No native dependencies. The package is pure JavaScript.
- No sibling server is required at runtime. This one opens no other server's store: a credit against an invoice names the invoice by its reference and nothing more.

## Step 1 - the run command

```sh
npx -y @theluckystrike/mcp-credit-note
```

The server speaks MCP over stdio. It writes nothing to stdout except protocol traffic. Do not run it interactively as a check; the client starts it.

## Step 2 - write the client config

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS), `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "credit-note": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-credit-note"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add credit-note -- npx -y @theluckystrike/mcp-credit-note
```

### Cursor

`~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project). Same entry as Claude Desktop.

## Alternative A - .mcpb bundle (Claude Desktop one-click)

Download `credit-note.mcpb` from https://github.com/theluckystrike/mcp-servers/releases and open it, or drag it onto the Claude Desktop Extensions pane. This installs the server without editing JSON and without Node on PATH assumptions.

## Alternative B - from source

```sh
git clone https://github.com/theluckystrike/mcp-servers
cd mcp-servers
npm install
npm run build --workspace @theluckystrike/mcp-credit-note
```

Then point the client at the built entry:

```json
{
  "mcpServers": {
    "credit-note": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-servers/servers/credit-note/dist/index.js"]
    }
  }
}
```

## Step 3 - the optional licence key

The free tier finalizes 10 credit notes lifetime, and drafts, deletes, reads, lists, renders and the totals summary are free and unlimited on every tier. A Pro key lifts the finalized cap and removes the one-line footer from renders. Set it as `MCP_LICENSE_KEY` in the server's `env` block, or call `license_activate` once and it is stored in `~/.config/mcp-servers/license.json`.

```json
{
  "mcpServers": {
    "credit-note": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-credit-note"],
      "env": { "MCP_LICENSE_KEY": "MCPL1...." }
    }
  }
}
```

Keys are verified offline against a bundled public key. Nothing is sent anywhere. Keys: https://mcp.zovo.one/buy/credit-note

## Step 4 - verify

Ask the assistant to call `license_status`. It answers with the tier and where the key came from. Then ask it to call `credit_note_create` with a recipient, a reason, one line and a currency; a `CN-DRAFT-YYYY-NNNN` id comes back. Call `credit_note_render` with that id and the Markdown comes back with a DRAFT banner. `tools/list` must show the ten tools from the server README.

## Where data lives

`${XDG_DATA_HOME:-~/.local/share}/mcp-servers/credit-note/`, as `notes.json` and `counter.json`. Nothing else on the machine is written; the renders are returned as text and this server writes no document files. There is no telemetry and no network call in this server.

## Troubleshooting

- `command not found: npx` - install Node.js 18+.
- Tools missing after a config edit - the client only reads the config at startup; restart it fully.
- `the free tier finalizes 10 credit notes` - finalizing is the metered act because that is what turns a draft into the document the client sees. Everything else stays free.
- A finalized credit note cannot be edited or deleted, because it is a document the client may have seen. Record the correction as a new credit note or a new invoice.
- The final `CN-YYYY-NNNN` number is assigned only at finalize, in the issue date's year, and the counter is written before the record, so a crash burns a number rather than reusing one and the final series never has a gap.

Built by theluckystrike (https://github.com/theluckystrike).
