# DIST R28b — 2026-09-26

## mcpservers.org submissions (browser-form automation)
Accepted this round (12 new, total 16):
mcp-quotes, mcp-time-tracker, mcp-expense-tracker, mcp-currency,
mcp-invoice-generator, mcp-pomodoro, mcp-loan-calculator, mcp-receipts,
mcp-budget, mcp-payroll, mcp-tax-calc, mcp-stripe-billing.

Key learnings:
- Leave "Official MCP Registry Name" EMPTY — non-matching value blocks submit.
- Single-call browser_console script with native prototype setters is reliable.
- Category values observed: finance, productivity.

## 7 new servers shipped (b22b5d62)
pomodoro, loan-calculator, receipts, budget, payroll, tax-calc, stripe-billing.
- Each: standalone repo github.com/theluckystrike/mcp-<name> + estate subfolder servers/<name> + server.json (official registry schema, npm package type).
- All smoke-tested end-to-end via MCP client (stdio transport, real tool calls).
- Dead-link catch: submissions initially pointed at nonexistent repos; gh repo create fixed all 7 before verification pass.

## Commits
- b22b5d62 — 7 new servers + server.json
- kpi update — 16 mcpservers.org, 7 queued for registry publish
- dashboard R28b — session 97, HTML stack check 0/0

## Next levers
1. Official registry publish run for the 7 new server.json entries.
2. Remaining ~31 mcpservers.org submissions from the 47-server estate.
3. Smithery remote-server listings.
4. Human-gated: Glama claim + mcp.so sign-in (one manual browser session each).
