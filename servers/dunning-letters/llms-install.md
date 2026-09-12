# Installing mcp-dunning-letters (agent instructions)

This file tells an AI coding agent exactly how to install this MCP server. No account, no API key, no network service is required.

Server: **Dunning letters** (@theluckystrike/mcp-dunning-letters)
What it does: Chase overdue invoices on an escalation ladder anchored to the due date. `invoice_register` starts a chase for one unpaid invoice -- client, reference, amount in integer minor units, currency, due date -- and returns a `DUN-YYYY-NNNN` id with the three escalation dates: reminder 1 at due + 7 days, reminder 2 at due + 14, the final notice at due + 21, configurable per invoice. `letter_render` generates the letter for the current stage as Markdown or self-contained printable HTML, `letter_sent` records that a letter actually went out, and `payment_record` lowers what the next letter asks for. `overdue_list` is every unpaid invoice past due, worst first, `aging_summary` buckets the register, and `chase_today` answers what has to go out today. Nothing is emailed or sent anywhere: this server produces the letter text, and sending it is your act.
Source: https://github.com/theluckystrike/mcp-servers/tree/main/servers/dunning-letters
License: MIT. Support: support@zovo.one

## Status of the npm package

The npm package `@theluckystrike/mcp-dunning-letters` is not published yet. Until it is, the `npx` command below will fail with E404. Use **Alternative B - from source** further down, which is the supported path today, and keep the same client config with `"command": "node"` and the absolute path to `dist/index.js`. Everything else on this page is unchanged.

## Prerequisites

- Node.js 18 or newer on PATH (`node --version`).
- No native dependencies. The package is pure JavaScript.
- No sibling server is required at runtime. This one reads a single file it does not own, read-only and best-effort: the shared business profile, which the invoice server's `business_set` writes, for the sender block on the letters. It is never written. No other store is opened.

## Step 1 - the run command

```sh
npx -y @theluckystrike/mcp-dunning-letters
```

The server speaks MCP over stdio. It writes nothing to stdout except protocol traffic. Do not run it interactively as a check; the client starts it.

## Step 2 - write the client config

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS), `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "dunning-letters": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-dunning-letters"]
    }
  }
}
```

### Claude Code

```sh
claude mcp add dunning-letters -- npx -y @theluckystrike/mcp-dunning-letters
```

### Cursor

`~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project). Same entry as Claude Desktop.

## Alternative A - .mcpb bundle (Claude Desktop one-click)

Download `dunning-letters.mcpb` from https://github.com/theluckystrike/mcp-servers/releases and open it, or drag it onto the Claude Desktop Extensions pane. This installs the server without editing JSON and without Node on PATH assumptions.

## Alternative B - from source

```sh
git clone https://github.com/theluckystrike/mcp-servers
cd mcp-servers
npm install
npm run build --workspace @theluckystrike/mcp-dunning-letters
```

The money formatting is imported from `mcp-asset-register`, so build the workspaces before this server rather than this server alone if the import fails to resolve.

Then point the client at the built entry:

```json
{
  "mcpServers": {
    "dunning-letters": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-servers/servers/dunning-letters/dist/index.js"]
    }
  }
}
```

## Step 3 - the optional licence key

The free tier chases 3 unpaid invoices at once, and all three letters in both formats, the aging summary, the day's chase list and payment recording are free on every tier. A paid invoice frees its slot. A Pro key lifts the concurrent-chase cap. Set it as `MCP_LICENSE_KEY` in the server's `env` block, or call `license_activate` once and it is stored in `~/.config/mcp-servers/license.json`.

```json
{
  "mcpServers": {
    "dunning-letters": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-dunning-letters"],
      "env": { "MCP_LICENSE_KEY": "MCPL1...." }
    }
  }
}
```

Keys are verified offline against a bundled public key. Nothing is sent anywhere. Keys: https://mcp.zovo.one/buy/dunning-letters

## Step 4 - verify

Ask the assistant to call `license_status`. It answers with the tier and where the key came from. Then ask it to call `invoice_register` with a client, an invoice reference, an amount in minor units, a currency and a due date; a `DUN-YYYY-NNNN` id comes back with the three escalation dates. Call `letter_render` with that id and the reminder 1 text comes back. `tools/list` must show the eleven tools from the server README.

## Where data lives

`${XDG_DATA_HOME:-~/.local/share}/mcp-servers/dunning-letters/`, as `invoices.json` and `counter.json`. Nothing else on the machine is written; the letters are rendered to text for you to send yourself, and this server holds no mail credentials and wants none. There is no telemetry and no network call in this server.

## Troubleshooting

- `command not found: npx` - install Node.js 18+.
- Tools missing after a config edit - the client only reads the config at startup; restart it fully.
- `the free tier chases 3 unpaid invoices at once` - recording a payment that covers the balance closes that ladder and frees its slot.
- Letters go out in order: an invoice 60 days late with nothing sent is still owed reminder 1, because a final notice that no polite letter preceded reads as a threat, not a chase.
- The ladder is anchored to the due date, not to the last letter, so recording a sending moves which stage is next and never moves the schedule.
- The late fee is simple interest, pro-rata on a 30-day month, on the amount outstanding on the day the letter is written, rounded once to the minor unit.

Built by theluckystrike (https://github.com/theluckystrike).
