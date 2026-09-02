# MCP servers by theluckystrike

Practical Model Context Protocol servers for people who work inside Claude, Cursor and other MCP clients.
Every server runs locally over stdio, keeps all data on your machine, and has a genuinely useful free tier.
Pro unlocks the limits for a one-time payment: $19 per server or $39 for the bundle, lifetime.

| Server | What it does | Install |
|---|---|---|
| mcp-time-tracker | Track billable time from chat: timers, entries, reports, CSV, invoice summaries | `npx -y @theluckystrike/mcp-time-tracker` |
| mcp-price-tracker | Check and watch product prices on ordinary shop pages, history, target alerts | `npx -y @theluckystrike/mcp-price-tracker` |
| mcp-spreadsheet | Read, query, add columns to and convert xlsx/csv files without corrupting them | `npx -y @theluckystrike/mcp-spreadsheet` |
| mcp-invoice | Create numbered invoices with tax lines and render professional PDFs | `npx -y @theluckystrike/mcp-invoice` |

Buy Pro: https://mcp.zovo.one  (keys verify offline with Ed25519; no phone-home).

Repository layout: `servers/*` one package per server, `packages/mcp-license` shared licensing, `billing/` Cloudflare Worker
that sells keys through Stripe Checkout, `dashboard/` status page, `docs/` runbooks.

Built by theluckystrike. https://github.com/theluckystrike  Support: support@zovo.one
