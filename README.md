# MCP servers by theluckystrike

![License](https://img.shields.io/badge/license-MIT-blue)
![MCP Registry](https://img.shields.io/badge/MCP%20registry-listed-brightgreen)
![Release](https://img.shields.io/badge/release-v0.1.1-informational)

Practical Model Context Protocol servers for people who work inside Claude, Cursor and other MCP clients.
Every server runs locally over stdio, keeps all data on your machine, and has a genuinely useful free tier.
Pro unlocks the limits for a one-time payment: $19 per server or $39 for the bundle, lifetime.

| Server | Demo | What it does | Install |
|---|---|---|---|
| [mcp-time-tracker](servers/time-tracker/README.md) | ![time-tracker](assets/demo-time-tracker.gif) | Track billable time from chat: timers, entries, reports, CSV, invoice summaries | `npx -y @theluckystrike/mcp-time-tracker`* |
| [mcp-price-tracker](servers/price-tracker/README.md) | ![price-tracker](assets/demo-price-tracker.gif) | Check and watch product prices on ordinary shop pages, history, target alerts | `npx -y @theluckystrike/mcp-price-tracker`* |
| [mcp-spreadsheet](servers/spreadsheet/README.md) | ![spreadsheet](assets/demo-spreadsheet.gif) | Read, query, add columns to and convert xlsx/csv files without corrupting them | `npx -y @theluckystrike/mcp-spreadsheet`* |
| [mcp-invoice](servers/invoice/README.md) | ![invoice](assets/demo-invoice.gif) | Create numbered invoices with tax lines and render professional PDFs | `npx -y @theluckystrike/mcp-invoice`* |

\* npm publish is pending. Until then, install the `.mcpb` one-click bundle from the
[latest release](https://github.com/theluckystrike/mcp-servers/releases/latest), or clone and build:
`git clone https://github.com/theluckystrike/mcp-servers.git && cd mcp-servers`, `npm install`,
`npm run build -w packages/mcp-license -w servers/<name>`. Each server's README has the full 60-second install
with all three client configs.

Buy Pro: https://mcp.zovo.one  (keys verify offline with Ed25519; no phone-home).

## Why these four

The median MCP server on the public registry gets installed and never called again. Looking at what actually gets
used, two things separate the servers people keep: a config snippet that works on the first try, and a visible
demo of the tool actually answering a real prompt before anyone installs it. Both of those are cheap to provide and
most servers skip them -- READMEs bury the config three scroll-lengths down, or show no output at all. These four
servers were picked because they replace a task people already do in a spreadsheet, a SaaS dashboard or a browser
tab (tracking time, watching a price, editing a sheet, cutting an invoice) with one that runs entirely on-device:
no account, no telemetry, no server-side data at rest. Every README above the fold now leads with the GIF and the
copy-pasteable config, in that order.

## Guides

- [Track time in Claude Code](https://mcp.zovo.one/guides/track-time-in-claude-code)
- [Invoice PDF from chat](https://mcp.zovo.one/guides/invoice-pdf-from-chat)
- [Read Excel in Cursor](https://mcp.zovo.one/guides/read-excel-in-cursor)
- [Price drop alerts with Claude](https://mcp.zovo.one/guides/price-drop-alerts-with-claude)
- [MCP server free vs pro](https://mcp.zovo.one/guides/mcp-server-free-vs-pro)

Repository layout: `servers/*` one package per server, `packages/mcp-license` shared licensing, `billing/` Cloudflare Worker
that sells keys through Stripe Checkout, `dashboard/` status page, `docs/` runbooks.

Built by theluckystrike. https://github.com/theluckystrike  Support: support@zovo.one
